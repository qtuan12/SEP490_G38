using BPG.Application.Features.DailyLogs.Commands;
using FluentAssertions;
using Xunit;

namespace BPG.Application.UnitTests.DailyLogs
{
    public class CreateDailyLogCommandValidatorTests
    {
        private readonly CreateDailyLogCommandValidator _validator;

        public CreateDailyLogCommandValidatorTests()
        {
            _validator = new CreateDailyLogCommandValidator();
        }

        [Fact]
        public void Validate_ValidCommand_ShouldNotHaveValidationError()
        {
            // Arrange
            var command = new CreateDailyLogCommand 
            { 
                TaskId = 10, 
                NewProgressPercent = 50, 
                Description = "A valid progress update description." 
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public void Validate_ProgressIsZero_ShouldNotHaveValidationError()
        {
            // Arrange
            var command = new CreateDailyLogCommand 
            { 
                TaskId = 10, 
                NewProgressPercent = 0, 
                Description = "Initial stage setup." 
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        [Theory]
        [InlineData(101)]
        [InlineData(255)]
        public void Validate_ProgressOutOfRange_ShouldHaveValidationError(byte progress)
        {
            // Arrange
            var command = new CreateDailyLogCommand 
            { 
                TaskId = 10, 
                NewProgressPercent = progress, 
                Description = "Invalid progress update." 
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().ContainSingle(e => e.PropertyName == nameof(CreateDailyLogCommand.NewProgressPercent));
        }

        [Theory]
        [InlineData("")]
        [InlineData(" ")]
        [InlineData(null)]
        public void Validate_EmptyOrNullDescription_ShouldHaveValidationError(string? description)
        {
            // Arrange
            var command = new CreateDailyLogCommand 
            { 
                TaskId = 10, 
                NewProgressPercent = 50, 
                Description = description 
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().ContainSingle(e => e.PropertyName == nameof(CreateDailyLogCommand.Description));
        }

        [Fact]
        public void Validate_DescriptionTooLong_ShouldHaveValidationError()
        {
            // Arrange
            var command = new CreateDailyLogCommand 
            { 
                TaskId = 10, 
                NewProgressPercent = 50, 
                Description = new string('A', 2001) 
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().ContainSingle(e => e.PropertyName == nameof(CreateDailyLogCommand.Description));
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-5)]
        public void Validate_InvalidTaskId_ShouldHaveValidationError(long taskId)
        {
            // Arrange
            var command = new CreateDailyLogCommand 
            { 
                TaskId = taskId, 
                NewProgressPercent = 50, 
                Description = "Valid description" 
            };

            // Act
            var result = _validator.Validate(command);

            // Assert
            result.IsValid.Should().BeFalse();
            result.Errors.Should().ContainSingle(e => e.PropertyName == nameof(CreateDailyLogCommand.TaskId));
        }
    }
}
