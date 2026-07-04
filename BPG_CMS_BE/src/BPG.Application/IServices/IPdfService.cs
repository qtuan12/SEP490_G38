using BPG.Application.DTOs;

namespace BPG.Application.IServices;

public interface IPdfService
{
    byte[] GeneratePhaseAcceptancePdf(PhaseAcceptancePdfModel model);
}
