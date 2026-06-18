using AutoMapper;
using BPG.Application.Features.Units.DTOs;
using BPG.Domain.Entities;

namespace BPG.Application.Features.Units.Profiles;

public class UnitMappingProfile : Profile
{
    public UnitMappingProfile()
    {
        CreateMap<Unit, UnitDto>();
    }
}
