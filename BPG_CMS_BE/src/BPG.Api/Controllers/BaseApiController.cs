using System.Collections.Generic;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using BPG.Application.Common.Models;

namespace BPG.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public abstract class BaseApiController : ControllerBase
    {
        private IMediator? _mediator;

        protected IMediator Mediator => _mediator ??= HttpContext.RequestServices.GetRequiredService<IMediator>();

        protected IActionResult ApiOk(string message = "Success")
        {
            return Ok(ApiResponse.SuccessResult(message));
        }

        protected IActionResult ApiOk<T>(T data, string message = "Success")
        {
            if (data is ApiResponse)
            {
                return Ok(data);
            }
            return Ok(ApiResponse<T>.SuccessResult(data, message));
        }

        protected IActionResult ApiPagedOk<T>(PagedList<T> pagedList, string message = "Success")
        {
            return Ok(ApiResponse<PagedList<T>>.SuccessResult(pagedList, message));
        }

        protected IActionResult ApiBadRequest(string message, List<string>? errors = null)
        {
            return BadRequest(ApiResponse<string>.FailureResult(message, errors));
        }

        protected IActionResult ApiNotFound(string message = "Resource not found")
        {
            return NotFound(ApiResponse<string>.FailureResult(message));
        }
    }
}
