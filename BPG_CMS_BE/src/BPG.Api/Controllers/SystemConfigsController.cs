using BPG.Application.Features.SystemConfigs;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers
{
    [Authorize]
    public class SystemConfigsController : BaseApiController
    {
        /// <summary>
        /// Láº¥y danh sÃ¡ch toÃ n bá»™ cáº¥u hÃ¬nh há»‡ thá»‘ng.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetSystemConfigs(CancellationToken ct)
        {
            var result = await Mediator.Send(new GetSystemConfigsQuery(), ct);
            return Ok(result);
        }

        /// <summary>
        /// Admin cáº­p nháº­t giÃ¡ trá»‹ má»™t tham sá»‘ cáº¥u hÃ¬nh.
        /// </summary>
        [HttpPut("{key}")]
        [Authorize(Roles = RolePolicies.Admin)]
        public async Task<IActionResult> UpdateSystemConfig(string key, [FromBody] UpdateConfigBody body, CancellationToken ct)
        {
            await Mediator.Send(new UpdateSystemConfigCommand { ConfigKey = key, ConfigValue = body.ConfigValue }, ct);
            return ApiOk(true, "Cáº­p nháº­t cáº¥u hÃ¬nh thÃ nh cÃ´ng");
        }

        /// <summary>
        /// Láº¥y tÃªn vÃ  logo cÃ´ng ty. KhÃ´ng yÃªu cáº§u Ä‘Äƒng nháº­p vÃ¬ trang login cÅ©ng cáº§n hiá»ƒn thá»‹.
        /// </summary>
        [AllowAnonymous]
        [HttpGet("company")]
        public async Task<IActionResult> GetCompanyInfo(CancellationToken ct)
        {
            var result = await Mediator.Send(new GetCompanyInfoQuery(), ct);
            return Ok(result);
        }

        /// <summary>
        /// Admin cáº­p nháº­t tÃªn vÃ  logo cÃ´ng ty.
        /// </summary>
        [HttpPut("company")]
        [Authorize(Roles = RolePolicies.Admin)]
        public async Task<IActionResult> UpdateCompanySettings([FromBody] UpdateCompanySettingsCommand command, CancellationToken ct)
        {
            await Mediator.Send(command, ct);
            return ApiOk(true, "Cáº­p nháº­t thÃ´ng tin cÃ´ng ty thÃ nh cÃ´ng");
        }
    }

    public class UpdateConfigBody
    {
        public string ConfigValue { get; set; } = string.Empty;
    }
}

