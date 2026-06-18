using AutoMapper;
using BPG.Application.Features.MaterialConversions.DTOs;
using BPG.Domain.Entities;

namespace BPG.Application.Features.MaterialConversions.Profiles;

public class MaterialConversionMappingProfile : Profile
{
    public MaterialConversionMappingProfile()
    {
        CreateMap<MaterialConversion, MaterialConversionDto>()
            .ForMember(dest => dest.AlternativeUnitName, opt => opt.MapFrom(src => src.AlternativeUnit != null ? src.AlternativeUnit.UnitName : string.Empty));
    }
}
