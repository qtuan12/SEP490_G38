using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using BPG.Application.IServices;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Infrastructure.Services
{
    public class CloudinaryService : IFileStorageService
    {
        private readonly Cloudinary _cloudinary;

        public CloudinaryService(IConfiguration configuration)
        {
            var cloudName = configuration["Cloudinary:CloudName"];
            var apiKey = configuration["Cloudinary:ApiKey"];
            var apiSecret = configuration["Cloudinary:ApiSecret"];

            if (string.IsNullOrEmpty(cloudName) || string.IsNullOrEmpty(apiKey) || string.IsNullOrEmpty(apiSecret))
            {
                // Fallback to avoid crashing on startup if settings are missing
                Console.WriteLine("[Cloudinary Warnings] Cloudinary credentials are not fully configured in settings.");
            }

            var account = new Account(cloudName, apiKey, apiSecret);
            _cloudinary = new Cloudinary(account);
        }

        public async Task<string> UploadFileAsync(IFormFile file, string folder, CancellationToken ct = default)
        {
            if (file == null || file.Length == 0) return string.Empty;

            using var stream = file.OpenReadStream();
            var extension = Path.GetExtension(file.FileName).ToLower();
            var isImage = extension == ".jpg" || extension == ".jpeg" || extension == ".png" || extension == ".gif" || extension == ".webp" || extension == ".bmp";
            var isPdf = extension == ".pdf";

            UploadResult uploadResult;

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

            if (uploadResult.Error != null)
            {
                throw new InvalidOperationException($"Lỗi upload file lên Cloudinary: {uploadResult.Error.Message}");
            }

            return uploadResult.SecureUrl.ToString();
        }

        public async Task<string> UploadFileAsync(byte[] fileBytes, string fileName, string folder, CancellationToken ct = default)
        {
            if (fileBytes == null || fileBytes.Length == 0) return string.Empty;

            using var stream = new MemoryStream(fileBytes);
            var extension = Path.GetExtension(fileName).ToLower();
            var isImage = extension == ".jpg" || extension == ".jpeg" || extension == ".png" || extension == ".gif" || extension == ".webp" || extension == ".bmp";

            UploadResult uploadResult;

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

            if (uploadResult.Error != null)
            {
                throw new InvalidOperationException($"Lỗi upload file lên Cloudinary: {uploadResult.Error.Message}");
            }

            return uploadResult.SecureUrl.ToString();
        }

        public async Task<bool> DeleteFileAsync(string fileUrl, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(fileUrl)) return false;

            var publicId = ExtractPublicIdFromUrl(fileUrl);
            if (string.IsNullOrEmpty(publicId)) return false;

            var resourceType = GetResourceTypeFromUrl(fileUrl);
            var deletionParams = new DeletionParams(publicId)
            {
                ResourceType = resourceType
            };

            var result = await _cloudinary.DestroyAsync(deletionParams);
            return result.Result == "ok";
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
