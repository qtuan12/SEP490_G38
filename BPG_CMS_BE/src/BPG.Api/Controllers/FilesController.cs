using BPG.Application.DTOs.Files;
using BPG.Application.Common.Files;
using BPG.Api.Configuration;
using BPG.Application.IServices;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Threading.Tasks;

using Microsoft.AspNetCore.RateLimiting;

namespace BPG.Api.Controllers
{
    [Authorize]
    public class FilesController : BaseApiController
    {
        private readonly IFileStorageService _fileStorageService;

        public FilesController(IFileStorageService fileStorageService)
        {
            _fileStorageService = fileStorageService;
        }

        /// <summary>
        /// Tải lên một tệp đơn lẻ (Ảnh, PDF, v.v.) lên Cloudinary.
        /// </summary>
        [HttpPost("upload")]
        [EnableRateLimiting(RateLimitPolicies.Upload)]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(UploadFilePolicy.MaxFileSizeBytes + UploadFilePolicy.MultipartOverheadBytesPerFile)]
        public async Task<IActionResult> UploadSingleFile(
            IFormFile file,
            [FromForm] string? folder,
            CancellationToken cancellationToken)
        {
            if (!UploadFilePolicy.TryResolveDestination(folder, out var destination, out var folderError))
            {
                return ApiBadRequest(folderError);
            }

            if (!destination.IsRoleAllowed(User.IsInRole))
            {
                return Forbid();
            }

            var validation = await UploadFilePolicy.ValidateFileAsync(file, destination, cancellationToken);
            if (!validation.IsValid)
            {
                return ApiBadRequest(validation.ErrorMessage!);
            }

            var fileUrl = await _fileStorageService.UploadFileAsync(
                file,
                destination.CanonicalFolder,
                cancellationToken);

            var response = new UploadFileResponse
            {
                FileName = file.FileName,
                FileUrl = fileUrl,
                ContentType = file.ContentType,
                FileSizeBytes = file.Length
            };

            return ApiOk(response, "Tải tệp lên thành công.");
        }

        /// <summary>
        /// Tải nhiều tệp cùng lúc lên Cloudinary.
        /// </summary>
        [HttpPost("upload-multiple")]
        [EnableRateLimiting(RateLimitPolicies.Upload)]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(UploadFilePolicy.MaxFilesPerRequest
            * (UploadFilePolicy.MaxFileSizeBytes + UploadFilePolicy.MultipartOverheadBytesPerFile))]
        public async Task<IActionResult> UploadMultipleFiles(
            List<IFormFile> files,
            [FromForm] string? folder,
            CancellationToken cancellationToken)
        {
            var countValidation = UploadFilePolicy.ValidateFileCount(files?.Count ?? 0);
            if (!countValidation.IsValid)
            {
                return ApiBadRequest(countValidation.ErrorMessage!);
            }

            if (!UploadFilePolicy.TryResolveDestination(folder, out var destination, out var folderError))
            {
                return ApiBadRequest(folderError);
            }

            if (!destination.IsRoleAllowed(User.IsInRole))
            {
                return Forbid();
            }

            foreach (var file in files!)
            {
                var validation = await UploadFilePolicy.ValidateFileAsync(file, destination, cancellationToken);
                if (!validation.IsValid)
                {
                    return ApiBadRequest($"Tệp '{file?.FileName ?? "không xác định"}': {validation.ErrorMessage}");
                }
            }

            async Task<UploadFileResponse> UploadAndMapAsync(IFormFile file)
            {
                var fileUrl = await _fileStorageService.UploadFileAsync(
                    file,
                    destination.CanonicalFolder,
                    cancellationToken);
                return new UploadFileResponse
                {
                    FileName = file.FileName,
                    FileUrl = fileUrl,
                    ContentType = file.ContentType,
                    FileSizeBytes = file.Length
                };
            }

            var uploadTasks = new List<Task<UploadFileResponse>>();
            foreach (var file in files!)
            {
                uploadTasks.Add(UploadAndMapAsync(file));
            }

            var results = await Task.WhenAll(uploadTasks);
            var uploadResponses = new List<UploadFileResponse>(results);

            return ApiOk(uploadResponses, "Tải lên tệp thành công.");
        }

        /// <summary>
        /// xóa tệp qua URL.
        /// </summary>
        [HttpDelete("delete")]
        [Authorize(Roles = RolePolicies.Admin)]
        [EnableRateLimiting(RateLimitPolicies.Mutation)]
        public async Task<IActionResult> DeleteFile([FromQuery] string fileUrl)
        {
            if (string.IsNullOrWhiteSpace(fileUrl))
            {
                return ApiBadRequest("Đường dẫn không hợp lệ.");
            }

            var deleted = await _fileStorageService.DeleteFileAsync(fileUrl);
            if (!deleted)
            {
                return ApiBadRequest("Không thể xóa tệp. Vui lòng kiểm tra lại.");
            }

            return ApiOk(true, "Xóa tệp thành công.");
        }
    }
}
