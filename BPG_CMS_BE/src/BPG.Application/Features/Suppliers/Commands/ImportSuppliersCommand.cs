using BPG.Application.DTOs.Suppliers;
using MediatR;
using Microsoft.AspNetCore.Http;

namespace BPG.Application.Features.Suppliers.Commands
{
    public record ImportSuppliersCommand(IFormFile File) : IRequest<ImportSuppliersResultDto>;
}
