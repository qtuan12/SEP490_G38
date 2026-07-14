using BPG.Application.Features.Comments.Commands;
using FluentAssertions;
using Xunit;

namespace BPG.Application.UnitTests.Comments
{
    public class AddCommentCommandValidatorTests
    {
        private readonly AddCommentCommandValidator _validator;

        public AddCommentCommandValidatorTests()
        {
            _validator = new AddCommentCommandValidator();
        }

        [Fact]
        public void Validate_ValidCommand_ShouldNotHaveValidationError()
        {
            // Arrange
            var command = new AddCommentCommand { LogId = 1, Content = "A valid comment." };

            // Act
            var result = _validator.Validate(command);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        [Theory]
        [InlineData("")]
        [InlineData(" ")]
        [InlineData(null)]
        public void Validate_EmptyOrNullContent_ShouldHaveValidationError(string? content)
        {
            // Arrange
            var command = new AddCommentCommand { LogId = 1, Content = content };

            // Act
            var result = _validator.Validate(command);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().ContainSingle(e => e.PropertyName == nameof(AddCommentCommand.Content));
        }

        [Fact]
        public void Validate_ContentTooLong_ShouldHaveValidationError()
        {
            // Arrange
            var command = new AddCommentCommand { LogId = 1, Content = new string('A', 1001) };

            // Act
            var result = _validator.Validate(command);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().ContainSingle(e => e.PropertyName == nameof(AddCommentCommand.Content));
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-1)]
        [InlineData(-100)]
        public void Validate_InvalidLogId_ShouldHaveValidationError(long logId)
        {
            // Arrange
            var command = new AddCommentCommand { LogId = logId, Content = "Valid content" };

            // Act
            var result = _validator.Validate(command);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().ContainSingle(e => e.PropertyName == nameof(AddCommentCommand.LogId));
        }
    }
}
