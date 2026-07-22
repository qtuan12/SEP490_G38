using BPG.Application.Features.SystemConfigs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers
{
    [Authorize]
    public class SystemConfigsController : BaseApiController
    {
        /// <summary>
        /// Lấy danh sách toàn bộ cấu hình hệ thống.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetSystemConfigs(CancellationToken ct)
        {
            var result = await Mediator.Send(new GetSystemConfigsQuery(), ct);
            return Ok(result);
        }

        /// <summary>
        /// Admin cập nhật giá trị một tham số cấu hình.
        /// </summary>
        [HttpPut("{key}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateSystemConfig(string key, [FromBody] UpdateConfigBody body, CancellationToken ct)
        {
            await Mediator.Send(new UpdateSystemConfigCommand { ConfigKey = key, ConfigValue = body.ConfigValue }, ct);
            return ApiOk(true, "Cập nhật cấu hình thành công");
        }

        /// <summary>
        /// Lấy tên và logo công ty. Không yêu cầu đăng nhập vì trang login cũng cần hiển thị.
        /// </summary>
        [AllowAnonymous]
        [HttpGet("company")]
        public async Task<IActionResult> GetCompanyInfo(CancellationToken ct)
        {
            var result = await Mediator.Send(new GetCompanyInfoQuery(), ct);
            return Ok(result);
        }

        /// <summary>
        /// Admin cập nhật tên và logo công ty.
        /// </summary>
        [HttpPut("company")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateCompanySettings([FromBody] UpdateCompanySettingsCommand command, CancellationToken ct)
        {
            await Mediator.Send(command, ct);
            return ApiOk(true, "Cập nhật thông tin công ty thành công");
        }
    }

    public class UpdateConfigBody
    {
        public string ConfigValue { get; set; } = string.Empty;
    }
}
