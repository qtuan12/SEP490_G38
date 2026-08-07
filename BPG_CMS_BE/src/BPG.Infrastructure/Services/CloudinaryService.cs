using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using BPG.Application.IServices;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Infrastructure.Services
{
    public class CloudinaryService : IFileStorageService
    {
        private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp",
            ".jfif", ".avif", ".heic", ".heif", ".tif", ".tiff",
        };

        private readonly Cloudinary _cloudinary;
        private readonly ILogger<CloudinaryService> _logger;

        /// <summary>
        /// Ảnh BẮT BUỘC phải upload dưới dạng image, không được rơi vào nhánh raw: link raw của
        /// Cloudinary trả về kèm Content-Disposition attachment, nên mở trên trình duyệt sẽ tải tệp
        /// xuống thay vì hiện ảnh (thẻ img vẫn render được vì nó đọc theo nội dung, khiến lỗi này
        /// rất dễ bị bỏ sót - thumbnail hiện bình thường nhưng bấm vào thì tải file).
        ///
        /// Ưu tiên MIME do trình duyệt gửi lên, vì tên tệp có thể mang đuôi lạ (.heic chụp từ
        /// iPhone, .jfif tải từ web) hoặc không có đuôi.
        /// </summary>
        private static bool IsImage(string? contentType, string? fileName)
        {
            if (!string.IsNullOrWhiteSpace(contentType) &&
                contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            var extension = Path.GetExtension(fileName ?? string.Empty);
            return !string.IsNullOrEmpty(extension) && ImageExtensions.Contains(extension);
        }

        public CloudinaryService(IConfiguration configuration, ILogger<CloudinaryService> logger)
        {
            _logger = logger;
            var cloudName = configuration["Cloudinary:CloudName"];
            var apiKey = configuration["Cloudinary:ApiKey"];
            var apiSecret = configuration["Cloudinary:ApiSecret"];

            if (string.IsNullOrEmpty(cloudName) || string.IsNullOrEmpty(apiKey) || string.IsNullOrEmpty(apiSecret))
            {
                _logger.LogWarning("Thông tin cấu hình Cloudinary chưa được khai báo đầy đủ trong Settings.");
            }

            var account = new Account(cloudName, apiKey, apiSecret);
            _cloudinary = new Cloudinary(account);
        }

        public async Task<string> UploadFileAsync(IFormFile file, string folder, CancellationToken ct = default)
        {
            if (file == null || file.Length == 0)
            {
                _logger.LogWarning("Tệp tin truyền vào rỗng hoặc Null, bỏ qua tải lên Cloudinary.");
                return string.Empty;
            }

            _logger.LogInformation("Bắt đầu upload tệp '{FileName}' (Kích thước: {Length} bytes) lên thư mục '{Folder}'", file.FileName, file.Length, folder);

            using var stream = file.OpenReadStream();
            var isImage = IsImage(file.ContentType, file.FileName);

            UploadResult uploadResult;

            try
            {
                if (isImage)
                {
                    var uploadParams = new ImageUploadParams
                    {
                        File = new FileDescription(file.FileName, stream),
                        Folder = folder
                    };
                    uploadResult = await _cloudinary.UploadAsync(uploadParams, ct);
                }
                else
                {
                    var uploadParams = new RawUploadParams
                    {
                        File = new FileDescription(file.FileName, stream),
                        Folder = folder
                    };
                    uploadResult = await _cloudinary.UploadAsync(uploadParams, "raw", ct);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi kết nối hoặc ngoại lệ xảy ra khi gửi tệp '{FileName}' sang Cloudinary.", file.FileName);
                throw;
            }

            if (uploadResult.Error != null)
            {
                _logger.LogError("Cloudinary từ chối upload tệp '{FileName}'. Lỗi: {ErrorMessage}", file.FileName, uploadResult.Error.Message);
                throw new InvalidOperationException($"Lỗi upload file lên Cloudinary: {uploadResult.Error.Message}");
            }

            _logger.LogInformation("Upload tệp '{FileName}' lên Cloudinary thành công. URL: {SecureUrl}", file.FileName, uploadResult.SecureUrl);
            return uploadResult.SecureUrl.ToString();
        }

        public async Task<string> UploadFileAsync(byte[] fileBytes, string fileName, string folder, CancellationToken ct = default)
        {
            if (fileBytes == null || fileBytes.Length == 0)
            {
                _logger.LogWarning("Dữ liệu byte[] truyền vào rỗng hoặc Null, bỏ qua tải lên Cloudinary.");
                return string.Empty;
            }

            _logger.LogInformation("Bắt đầu upload tệp từ byte[] '{FileName}' (Kích thước: {Length} bytes) lên thư mục '{Folder}'", fileName, fileBytes.Length, folder);

            using var stream = new MemoryStream(fileBytes);
            // Không có MIME ở overload này (dùng cho PDF biên bản nghiệm thu), chỉ còn tên tệp để suy.
            var isImage = IsImage(null, fileName);

            UploadResult uploadResult;

            try
            {
                if (isImage)
                {
                    var uploadParams = new ImageUploadParams
                    {
                        File = new FileDescription(fileName, stream),
                        Folder = folder
                    };
                    uploadResult = await _cloudinary.UploadAsync(uploadParams, ct);
                }
                else
                {
                    var uploadParams = new RawUploadParams
                    {
                        File = new FileDescription(fileName, stream),
                        Folder = folder
                    };
                    uploadResult = await _cloudinary.UploadAsync(uploadParams, "raw", ct);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi kết nối hoặc ngoại lệ xảy ra khi gửi byte[] tệp '{FileName}' sang Cloudinary.", fileName);
                throw;
            }

            if (uploadResult.Error != null)
            {
                _logger.LogError("Cloudinary từ chối upload tệp từ byte[] '{FileName}'. Lỗi: {ErrorMessage}", fileName, uploadResult.Error.Message);
                throw new InvalidOperationException($"Lỗi upload file lên Cloudinary: {uploadResult.Error.Message}");
            }

            _logger.LogInformation("Upload tệp từ byte[] '{FileName}' lên Cloudinary thành công. URL: {SecureUrl}", fileName, uploadResult.SecureUrl);
            return uploadResult.SecureUrl.ToString();
        }

        public async Task<bool> DeleteFileAsync(string fileUrl, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(fileUrl))
            {
                _logger.LogWarning("Yêu cầu xóa tệp với URL rỗng, bỏ qua.");
                return false;
            }

            _logger.LogInformation("Bắt đầu yêu cầu xóa tệp tại URL '{FileUrl}' trên Cloudinary.", fileUrl);

            var publicId = ExtractPublicIdFromUrl(fileUrl);
            if (string.IsNullOrEmpty(publicId))
            {
                _logger.LogWarning("Không thể trích xuất PublicId từ URL '{FileUrl}'.", fileUrl);
                return false;
            }

            var resourceType = GetResourceTypeFromUrl(fileUrl);
            var deletionParams = new DeletionParams(publicId)
            {
                ResourceType = resourceType
            };

            DeletionResult result;
            try
            {
                result = await _cloudinary.DestroyAsync(deletionParams);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi xảy ra khi gửi yêu cầu hủy tệp PublicId '{PublicId}' tới Cloudinary.", publicId);
                throw;
            }

            var success = result.Result == "ok";
            if (success)
            {
                _logger.LogInformation("Xóa tệp PublicId '{PublicId}' trên Cloudinary thành công.", publicId);
            }
            else
            {
                _logger.LogWarning("Yêu cầu xóa tệp PublicId '{PublicId}' trên Cloudinary trả về trạng thái: {ResultStatus}", publicId, result.Result);
            }

            return success;
        }

        private string ExtractPublicIdFromUrl(string url)
        {
            try
            {
                var uploadIndex = url.IndexOf("/upload/");
                if (uploadIndex == -1) return string.Empty;

                var afterUpload = url.Substring(uploadIndex + "/upload/".Length);

                // Skip version folder e.g., v12345678/
                var firstSlashIndex = afterUpload.IndexOf('/');
                if (firstSlashIndex != -1)
                {
                    var possibleVersion = afterUpload.Substring(0, firstSlashIndex);
                    if (possibleVersion.StartsWith("v") && long.TryParse(possibleVersion.Substring(1), out _))
                    {
                        afterUpload = afterUpload.Substring(firstSlashIndex + 1);
                    }
                }

                // Remove file extension if resource type is not "raw" (images and videos don't include extensions in public ID)
                var isRaw = url.Contains("/raw/upload/");
                if (!isRaw)
                {
                    var lastDotIndex = afterUpload.LastIndexOf('.');
                    if (lastDotIndex != -1)
                    {
                        afterUpload = afterUpload.Substring(0, lastDotIndex);
                    }
                }

                return Uri.UnescapeDataString(afterUpload);
            }
            catch
            {
                return string.Empty;
            }
        }

        private ResourceType GetResourceTypeFromUrl(string url)
        {
            if (url.Contains("/raw/upload/")) return ResourceType.Raw;
            if (url.Contains("/video/upload/")) return ResourceType.Video;
            return ResourceType.Image;
        }
    }
}
