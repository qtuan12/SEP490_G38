using BPG.Application.DTOs.Files;
using BPG.Application.IServices;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace BPG.Api.Controllers
{
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
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadSingleFile(IFormFile file, [FromForm] string? folder)
        {
            if (file == null || file.Length == 0)
            {
                return ApiBadRequest("Tệp tải lên không hợp lệ hoặc rỗng.");
            }

            var fileUrl = await _fileStorageService.UploadFileAsync(file, folder ?? "general");

            var response = new UploadFileResponse
            {
                FileName = file.FileName,
                FileUrl = fileUrl,
                ContentType = file.ContentType,
                FileSizeBytes = file.Length
            };

            return ApiOk(response, "Tải lên tệp thành công.");
        }

        /// <summary>
        /// Tải lên nhiều tệp cùng một lúc lên Cloudinary.
        /// </summary>
        [HttpPost("upload-multiple")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadMultipleFiles(List<IFormFile> files, [FromForm] string? folder)
        {
            if (files == null || files.Count == 0)
            {
                return ApiBadRequest("Danh sách tệp tải lên rỗng.");
            }

            async Task<UploadFileResponse> UploadAndMapAsync(IFormFile file)
            {
                var fileUrl = await _fileStorageService.UploadFileAsync(file, folder ?? "general");
                return new UploadFileResponse
                {
                    FileName = file.FileName,
                    FileUrl = fileUrl,
                    ContentType = file.ContentType,
                    FileSizeBytes = file.Length
                };
            }

            var uploadTasks = new List<Task<UploadFileResponse>>();
            foreach (var file in files)
            {
                if (file.Length > 0)
                {
                    uploadTasks.Add(UploadAndMapAsync(file));
                }
            }

            var results = await Task.WhenAll(uploadTasks);
            var uploadResponses = new List<UploadFileResponse>(results);

            return ApiOk(uploadResponses, "Tải lên các tệp thành công.");
        }

        /// <summary>
        /// Xóa tệp từ xa trên Cloudinary dựa trên URL.
        /// </summary>
        [HttpDelete("delete")]
        public async Task<IActionResult> DeleteFile([FromQuery] string fileUrl)
        {
            if (string.IsNullOrWhiteSpace(fileUrl))
            {
                return ApiBadRequest("Đường dẫn fileUrl không hợp lệ.");
            }

            var deleted = await _fileStorageService.DeleteFileAsync(fileUrl);
            if (!deleted)
            {
                return ApiBadRequest("Không thể xóa tệp. Vui lòng kiểm tra lại URL tệp.");
            }

            return ApiOk(true, "Xóa tệp trên Cloudinary thành công.");
        }
    }
}
