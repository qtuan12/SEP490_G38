using BPG.Domain.Constants;
using Microsoft.AspNetCore.Http;

namespace BPG.Application.Common.Files;

/// <summary>
/// Central allow-list for the generic upload endpoints. The client still sends the
/// destination name, but it can only select one of the known business destinations
/// and each destination accepts only the file kinds used by that workflow.
/// </summary>
public static class UploadFilePolicy
{
    public const long MaxFileSizeBytes = 10 * 1024 * 1024;
    public const long MaxProjectDesignFileSizeBytes = 50 * 1024 * 1024;
    public const long MultipartOverheadBytesPerFile = 1024 * 1024;
    public const int MaxFilesPerRequest = 5;

    private const int SignatureProbeLength = 64;

    private static readonly IReadOnlySet<FileKind> Images = new HashSet<FileKind>
    {
        FileKind.Jpeg,
        FileKind.Png,
        FileKind.Gif,
        FileKind.WebP,
        FileKind.Bmp,
        FileKind.Tiff,
        FileKind.Avif,
        FileKind.Heif
    };

    private static readonly IReadOnlySet<FileKind> ImagesAndPdf = new HashSet<FileKind>(Images)
    {
        FileKind.Pdf
    };

    private static readonly IReadOnlySet<FileKind> ProjectDesignFiles = new HashSet<FileKind>(ImagesAndPdf)
    {
        FileKind.LegacyOffice,
        FileKind.OfficeOpenXml,
        FileKind.Dwg,
        FileKind.Dxf
    };

    private static readonly IReadOnlySet<FileKind> IncidentFiles = new HashSet<FileKind>(ImagesAndPdf)
    {
        FileKind.LegacyOffice,
        FileKind.OfficeOpenXml,
        FileKind.Zip,
        FileKind.Rar
    };

    private static readonly IReadOnlyDictionary<string, UploadDestination> Destinations =
        BuildDestinations();

    private static readonly IReadOnlyDictionary<string, FileKind> ExtensionKinds =
        new Dictionary<string, FileKind>(StringComparer.OrdinalIgnoreCase)
        {
            [".jpg"] = FileKind.Jpeg,
            [".jpeg"] = FileKind.Jpeg,
            [".jfif"] = FileKind.Jpeg,
            [".png"] = FileKind.Png,
            [".gif"] = FileKind.Gif,
            [".webp"] = FileKind.WebP,
            [".bmp"] = FileKind.Bmp,
            [".tif"] = FileKind.Tiff,
            [".tiff"] = FileKind.Tiff,
            [".avif"] = FileKind.Avif,
            [".heic"] = FileKind.Heif,
            [".heif"] = FileKind.Heif,
            [".pdf"] = FileKind.Pdf,
            [".doc"] = FileKind.LegacyOffice,
            [".xls"] = FileKind.LegacyOffice,
            [".docx"] = FileKind.OfficeOpenXml,
            [".xlsx"] = FileKind.OfficeOpenXml,
            [".dwg"] = FileKind.Dwg,
            [".dxf"] = FileKind.Dxf,
            [".zip"] = FileKind.Zip,
            [".rar"] = FileKind.Rar
        };

    public static UploadValidationResult ValidateFileCount(int count)
    {
        if (count <= 0)
        {
            return UploadValidationResult.Invalid("Danh sách tệp tải lên rỗng.");
        }

        return count > MaxFilesPerRequest
            ? UploadValidationResult.Invalid($"Chỉ được tải tối đa {MaxFilesPerRequest} tệp mỗi lần.")
            : UploadValidationResult.Valid();
    }

    public static bool TryResolveDestination(
        string? requestedFolder,
        out UploadDestination destination,
        out string errorMessage)
    {
        destination = null!;
        var key = string.IsNullOrWhiteSpace(requestedFolder)
            ? "general"
            : requestedFolder.Trim().Trim('/');

        if (key.Contains('\\') || !Destinations.TryGetValue(key, out destination!))
        {
            errorMessage = "Thư mục tải lên không hợp lệ.";
            return false;
        }

        errorMessage = string.Empty;
        return true;
    }

    public static async Task<UploadValidationResult> ValidateFileAsync(
        IFormFile? file,
        UploadDestination destination,
        CancellationToken cancellationToken = default)
    {
        if (file == null || file.Length <= 0)
        {
            return UploadValidationResult.Invalid("Tệp tải lên không hợp lệ hoặc rỗng.");
        }

        if (file.Length > destination.MaxFileSizeBytes)
        {
            return UploadValidationResult.Invalid(
                $"Kích thước tệp không được vượt quá {destination.MaxFileSizeBytes / 1024 / 1024} MB.");
        }

        var extension = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(extension)
            || !ExtensionKinds.TryGetValue(extension, out var expectedKind)
            || !destination.AllowedKinds.Contains(expectedKind))
        {
            return UploadValidationResult.Invalid(
                $"Định dạng tệp '{extension.TrimStart('.')}' không được hỗ trợ cho thư mục này.");
        }

        var signature = new byte[SignatureProbeLength];
        int bytesRead;
        await using (var stream = file.OpenReadStream())
        {
            bytesRead = await stream.ReadAsync(signature.AsMemory(0, signature.Length), cancellationToken);
        }

        var matchesSignature = MatchesSignature(expectedKind, extension, signature.AsSpan(0, bytesRead));
        var isIncidentRecoveryPlanHtml = !matchesSignature
            && expectedKind == FileKind.LegacyOffice
            && string.Equals(destination.CanonicalFolder, "incidents", StringComparison.OrdinalIgnoreCase)
            && IsHtmlDocument(signature.AsSpan(0, bytesRead));

        if (!matchesSignature && !isIncidentRecoveryPlanHtml)
        {
            return UploadValidationResult.Invalid(
                "Nội dung tệp không khớp với phần mở rộng hoặc tệp đã bị hỏng.");
        }

        return UploadValidationResult.Valid();
    }

    private static IReadOnlyDictionary<string, UploadDestination> BuildDestinations()
    {
        var destinations = new Dictionary<string, UploadDestination>(StringComparer.OrdinalIgnoreCase);

        AddAliases(
            destinations,
            new UploadDestination("general", ImagesAndPdf, Array.Empty<string>()),
            "general");
        AddAliases(
            destinations,
            new UploadDestination(StorageFolders.Avatars, Images, Array.Empty<string>()),
            StorageFolders.Avatars);
        AddAliases(
            destinations,
            new UploadDestination("company", Images, new[] { UserRole.Admin }),
            "company");
        AddAliases(
            destinations,
            new UploadDestination(
                StorageFolders.ProjectDesigns,
                ProjectDesignFiles,
                new[] { UserRole.TechnicalManager },
                MaxProjectDesignFileSizeBytes),
            "projects/design",
            StorageFolders.ProjectDesigns);
        AddAliases(
            destinations,
            new UploadDestination(
                StorageFolders.DailyLogPhotos,
                Images,
                new[] { UserRole.TechnicalManager, UserRole.SiteEngineer }),
            "dailylogs",
            StorageFolders.DailyLogPhotos);
        AddAliases(
            destinations,
            new UploadDestination(StorageFolders.DeliveryPhotos, Images, new[] { UserRole.SiteEngineer }),
            "goodsreceipts",
            StorageFolders.DeliveryPhotos);
        AddAliases(
            destinations,
            new UploadDestination(
                StorageFolders.InvoicePhotos,
                Images,
                new[] { UserRole.TechnicalManager, UserRole.SiteEngineer }),
            StorageFolders.InvoicePhotos);
        AddAliases(
            destinations,
            new UploadDestination(
                "incidents",
                IncidentFiles,
                new[] { UserRole.TechnicalManager, UserRole.SiteEngineer }),
            "incidents",
            StorageFolders.IncidentPhotos);

        return destinations;
    }

    private static void AddAliases(
        IDictionary<string, UploadDestination> destinations,
        UploadDestination destination,
        params string[] aliases)
    {
        foreach (var alias in aliases)
        {
            destinations[alias] = destination;
        }
    }

    private static bool MatchesSignature(
        FileKind expectedKind,
        string extension,
        ReadOnlySpan<byte> bytes)
    {
        return expectedKind switch
        {
            FileKind.Jpeg => StartsWith(bytes, 0xFF, 0xD8, 0xFF),
            FileKind.Png => StartsWith(bytes, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A),
            FileKind.Gif => StartsWithAscii(bytes, "GIF87a") || StartsWithAscii(bytes, "GIF89a"),
            FileKind.WebP => StartsWithAscii(bytes, "RIFF") && HasAscii(bytes, 8, "WEBP"),
            FileKind.Bmp => StartsWithAscii(bytes, "BM"),
            FileKind.Tiff => StartsWith(bytes, 0x49, 0x49, 0x2A, 0x00)
                || StartsWith(bytes, 0x4D, 0x4D, 0x00, 0x2A),
            FileKind.Avif => IsIsoBaseMediaImage(bytes, "avif", "avis"),
            FileKind.Heif => IsIsoBaseMediaImage(bytes, "heic", "heix", "hevc", "hevx", "mif1", "msf1"),
            FileKind.Pdf => StartsWithAscii(bytes, "%PDF-"),
            FileKind.LegacyOffice => StartsWith(bytes, 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1),
            FileKind.OfficeOpenXml => IsZip(bytes),
            FileKind.Dwg => IsDwg(bytes),
            FileKind.Dxf => IsDxf(bytes),
            FileKind.Zip => IsZip(bytes),
            FileKind.Rar => StartsWith(bytes, 0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00)
                || StartsWith(bytes, 0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x01, 0x00),
            _ => false
        };
    }

    private static bool IsIsoBaseMediaImage(ReadOnlySpan<byte> bytes, params string[] brands)
    {
        if (!HasAscii(bytes, 4, "ftyp"))
        {
            return false;
        }

        foreach (var brand in brands)
        {
            for (var offset = 8; offset + brand.Length <= bytes.Length; offset += 4)
            {
                if (HasAscii(bytes, offset, brand))
                {
                    return true;
                }
            }
        }

        return false;
    }

    private static bool IsZip(ReadOnlySpan<byte> bytes) =>
        StartsWith(bytes, 0x50, 0x4B, 0x03, 0x04)
        || StartsWith(bytes, 0x50, 0x4B, 0x05, 0x06)
        || StartsWith(bytes, 0x50, 0x4B, 0x07, 0x08);

    private static bool IsDwg(ReadOnlySpan<byte> bytes) =>
        bytes.Length >= 6
        && StartsWithAscii(bytes, "AC10")
        && bytes[4] is >= (byte)'0' and <= (byte)'9'
        && bytes[5] is >= (byte)'0' and <= (byte)'9';

    private static bool IsDxf(ReadOnlySpan<byte> bytes)
    {
        if (StartsWithAscii(bytes, "AutoCAD Binary DXF"))
        {
            return true;
        }

        var index = bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF ? 3 : 0;
        while (index < bytes.Length && char.IsWhiteSpace((char)bytes[index]))
        {
            index++;
        }

        return index < bytes.Length && bytes[index] == (byte)'0'
            && HasAscii(bytes, SkipLineBreak(bytes, index + 1), "SECTION");
    }

    private static int SkipLineBreak(ReadOnlySpan<byte> bytes, int index)
    {
        while (index < bytes.Length && char.IsWhiteSpace((char)bytes[index]))
        {
            index++;
        }

        return index;
    }

    // The Incident Recovery Plan template is generated in the browser as HTML
    // with a .doc extension so Word can open and edit it. Accept that legacy
    // Word-compatible representation only in the incident evidence folder.
    private static bool IsHtmlDocument(ReadOnlySpan<byte> bytes)
    {
        var index = 0;
        if (bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF)
        {
            index = 3;
        }

        while (index < bytes.Length && char.IsWhiteSpace((char)bytes[index]))
        {
            index++;
        }

        return HasAscii(bytes, index, "<html") || HasAscii(bytes, index, "<!DOCTYPE html");
    }

    private static bool StartsWith(ReadOnlySpan<byte> bytes, params byte[] signature) =>
        bytes.StartsWith(signature);

    private static bool StartsWithAscii(ReadOnlySpan<byte> bytes, string value) =>
        HasAscii(bytes, 0, value);

    private static bool HasAscii(ReadOnlySpan<byte> bytes, int offset, string value)
    {
        if (offset < 0 || bytes.Length < offset + value.Length)
        {
            return false;
        }

        for (var index = 0; index < value.Length; index++)
        {
            if (bytes[offset + index] != (byte)value[index])
            {
                return false;
            }
        }

        return true;
    }

    internal enum FileKind
    {
        Jpeg,
        Png,
        Gif,
        WebP,
        Bmp,
        Tiff,
        Avif,
        Heif,
        Pdf,
        LegacyOffice,
        OfficeOpenXml,
        Dwg,
        Dxf,
        Zip,
        Rar
    }

    public sealed class UploadDestination
    {
        internal UploadDestination(
            string canonicalFolder,
            IReadOnlySet<FileKind> allowedKinds,
            IReadOnlyCollection<string> allowedRoles,
            long maxFileSizeBytes = UploadFilePolicy.MaxFileSizeBytes)
        {
            CanonicalFolder = canonicalFolder;
            AllowedKinds = allowedKinds;
            AllowedRoles = allowedRoles;
            MaxFileSizeBytes = maxFileSizeBytes;
        }

        public string CanonicalFolder { get; }
        internal IReadOnlySet<FileKind> AllowedKinds { get; }
        public IReadOnlyCollection<string> AllowedRoles { get; }
        public long MaxFileSizeBytes { get; }

        public bool IsRoleAllowed(Func<string, bool> isInRole) =>
            AllowedRoles.Count == 0 || AllowedRoles.Any(isInRole);
    }

    public sealed record UploadValidationResult(bool IsValid, string? ErrorMessage)
    {
        public static UploadValidationResult Valid() => new(true, null);
        public static UploadValidationResult Invalid(string message) => new(false, message);
    }
}
