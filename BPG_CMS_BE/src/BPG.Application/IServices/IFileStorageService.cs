using Microsoft.AspNetCore.Http;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.IServices
{
    public interface IFileStorageService
    {
        /// <summary>
        /// Uploads a file to Cloudinary and returns the secure URL.
        /// ResourceType is automatically detected (supports images, PDFs, etc.).
        /// </summary>
        Task<string> UploadFileAsync(IFormFile file, string folder, CancellationToken ct = default);

        /// <summary>
        /// Deletes a file from Cloudinary using its URL.
        /// </summary>
        Task<bool> DeleteFileAsync(string fileUrl, CancellationToken ct = default);
    }
}
