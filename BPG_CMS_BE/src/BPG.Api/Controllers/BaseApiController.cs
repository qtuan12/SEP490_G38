using System.Collections.Generic;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using BPG.Api.Configuration;
using BPG.Application.Common.Models;

using Microsoft.AspNetCore.RateLimiting;

namespace BPG.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [EnableRateLimiting(RateLimitPolicies.Query)]
    public abstract class BaseApiController : ControllerBase
    {
        private IMediator? _mediator;

        protected IMediator Mediator => _mediator ??= HttpContext.RequestServices.GetRequiredService<IMediator>();

        protected IActionResult ApiOk(string message = "Thao tác thành công.")
        {
            return Ok(ApiResponse.SuccessResult(message));
        }

        protected IActionResult ApiOk<T>(T data, string message = "Thao tác thành công.")
        {
            if (data is ApiResponse)
            {
                return Ok(data);
            }
            return Ok(ApiResponse<T>.SuccessResult(data, message));
        }

        protected IActionResult ApiPagedOk<T>(PagedList<T> pagedList, string message = "Thao tác thành công.")
        {
            return Ok(ApiResponse<PagedList<T>>.SuccessResult(pagedList, message));
        }

        protected IActionResult ApiBadRequest(string message, List<string>? errors = null)
        {
            return BadRequest(ApiResponse<string>.FailureResult(message, errors));
        }

        protected IActionResult ApiNotFound(string message = "Không tìm thấy dữ liệu yêu cầu.")
        {
            return NotFound(ApiResponse<string>.FailureResult(message));
        }
    }
}
