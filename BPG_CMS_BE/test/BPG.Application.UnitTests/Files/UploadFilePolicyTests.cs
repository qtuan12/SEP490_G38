using BPG.Application.Common.Files;
using BPG.Domain.Constants;
using FluentAssertions;
using Microsoft.AspNetCore.Http;

namespace BPG.Application.UnitTests.Files;

public class UploadFilePolicyTests
{
    [Theory]
    [InlineData("users/avatars", "users/avatars")]
    [InlineData("company", "company")]
    [InlineData("projects/design", "projects/designs")]
    [InlineData("dailylogs", "daily-logs/photos")]
    [InlineData("goodsreceipts", "goods-receipts/photos")]
    [InlineData("direct-purchases/invoices", "direct-purchases/invoices")]
    [InlineData("incidents", "incidents")]
    public void TryResolveDestination_ShouldKeepAllCurrentClientFoldersCompatible(
        string requestedFolder,
        string expectedFolder)
    {
        var resolved = UploadFilePolicy.TryResolveDestination(
            requestedFolder,
            out var destination,
            out var errorMessage);

        resolved.Should().BeTrue(errorMessage);
        destination.CanonicalFolder.Should().Be(expectedFolder);
    }

    [Theory]
    [InlineData("../company")]
    [InlineData("incidents/private")]
    [InlineData("incidents\\private")]
    public void TryResolveDestination_ShouldRejectUnknownOrNestedFolders(string folder)
    {
        var resolved = UploadFilePolicy.TryResolveDestination(
            folder,
            out _,
            out var errorMessage);

        resolved.Should().BeFalse();
        errorMessage.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public void DestinationRoles_ShouldMatchTheBusinessWorkflow()
    {
        UploadFilePolicy.TryResolveDestination("company", out var company, out _).Should().BeTrue();
        UploadFilePolicy.TryResolveDestination("incidents", out var incidents, out _).Should().BeTrue();
        UploadFilePolicy.TryResolveDestination("users/avatars", out var avatars, out _).Should().BeTrue();

        company.IsRoleAllowed(role => role == UserRole.Admin).Should().BeTrue();
        company.IsRoleAllowed(role => role == UserRole.TechnicalManager).Should().BeFalse();
        incidents.IsRoleAllowed(role => role == UserRole.TechnicalManager).Should().BeTrue();
        incidents.IsRoleAllowed(role => role == UserRole.SiteEngineer).Should().BeTrue();
        incidents.IsRoleAllowed(role => role == UserRole.Director).Should().BeFalse();
        avatars.IsRoleAllowed(_ => false).Should().BeTrue();
    }

    [Fact]
    public async Task ValidateFileAsync_ShouldAcceptAValidImageSignature()
    {
        UploadFilePolicy.TryResolveDestination("dailylogs", out var destination, out _).Should().BeTrue();
        var file = File("site.jpg", new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10 });

        var result = await UploadFilePolicy.ValidateFileAsync(file, destination);

        result.IsValid.Should().BeTrue(result.ErrorMessage);
    }

    [Fact]
    public async Task ValidateFileAsync_ShouldRejectAnExtensionSignatureMismatch()
    {
        UploadFilePolicy.TryResolveDestination("dailylogs", out var destination, out _).Should().BeTrue();
        var file = File("spoofed.jpg", "%PDF-1.7"u8.ToArray());

        var result = await UploadFilePolicy.ValidateFileAsync(file, destination);

        result.IsValid.Should().BeFalse();
        result.ErrorMessage.Should().Contain("không khớp");
    }

    [Theory]
    [MemberData(nameof(RecoveryPlanFiles))]
    public async Task ValidateFileAsync_ShouldAcceptSupportedRecoveryPlanDocuments(
        string fileName,
        byte[] signature)
    {
        UploadFilePolicy.TryResolveDestination("incidents", out var destination, out _).Should().BeTrue();

        var result = await UploadFilePolicy.ValidateFileAsync(File(fileName, signature), destination);

        result.IsValid.Should().BeTrue(result.ErrorMessage);
    }

    [Fact]
    public async Task ValidateFileAsync_ShouldRejectRecoveryDocumentInAnImageOnlyFolder()
    {
        UploadFilePolicy.TryResolveDestination("goodsreceipts", out var destination, out _).Should().BeTrue();
        var file = File("delivery.pdf", "%PDF-1.7"u8.ToArray());

        var result = await UploadFilePolicy.ValidateFileAsync(file, destination);

        result.IsValid.Should().BeFalse();
        result.ErrorMessage.Should().Contain("không được hỗ trợ");
    }

    [Fact]
    public async Task ValidateFileAsync_ShouldAcceptExactlyTenMiBAndRejectAnythingLarger()
    {
        UploadFilePolicy.TryResolveDestination("incidents", out var destination, out _).Should().BeTrue();
        var signature = "%PDF-1.7"u8.ToArray();
        var exact = File("plan.pdf", signature, UploadFilePolicy.MaxFileSizeBytes);
        var tooLarge = File("plan.pdf", signature, UploadFilePolicy.MaxFileSizeBytes + 1);

        var exactResult = await UploadFilePolicy.ValidateFileAsync(exact, destination);
        var tooLargeResult = await UploadFilePolicy.ValidateFileAsync(tooLarge, destination);

        exactResult.IsValid.Should().BeTrue(exactResult.ErrorMessage);
        tooLargeResult.IsValid.Should().BeFalse();
        tooLargeResult.ErrorMessage.Should().Contain("10 MB");
    }

    [Fact]
    public void ValidateFileCount_ShouldAcceptFiveAndRejectSix()
    {
        UploadFilePolicy.ValidateFileCount(5).IsValid.Should().BeTrue();
        UploadFilePolicy.ValidateFileCount(6).IsValid.Should().BeFalse();
    }

    public static IEnumerable<object[]> RecoveryPlanFiles()
    {
        yield return new object[] { "plan.pdf", "%PDF-1.7"u8.ToArray() };
        yield return new object[] { "plan.doc", new byte[] { 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1 } };
        yield return new object[] { "plan.docx", new byte[] { 0x50, 0x4B, 0x03, 0x04 } };
        yield return new object[] { "evidence.zip", new byte[] { 0x50, 0x4B, 0x05, 0x06 } };
        yield return new object[] { "evidence.rar", new byte[] { 0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x01, 0x00 } };
    }

    private static IFormFile File(string name, byte[] content, long? reportedLength = null)
    {
        var fileMock = new Moq.Mock<IFormFile>();
        var stream = new MemoryStream(content);
        fileMock.Setup(f => f.FileName).Returns(name);
        fileMock.Setup(f => f.Length).Returns(reportedLength ?? content.Length);
        fileMock.Setup(f => f.OpenReadStream()).Returns(() => new MemoryStream(content));
        return fileMock.Object;
    }
}
