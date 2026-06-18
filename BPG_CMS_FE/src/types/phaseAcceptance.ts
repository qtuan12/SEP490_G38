

export interface PhaseAcceptance {
  acceptanceId: number;
  phaseId: number;
  phaseName: string;
  projectName: string;
  acceptedBy: number;
  acceptedByName: string;
  acceptanceDate: string;
  reportContent: string;
  pdfUrl?: string;
  isCancelled: boolean;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledByName?: string;
}

export interface GetPhaseAcceptancesQuery {
  pageIndex: number;
  pageSize: number;
  projectId?: number;
  phaseId?: number;
}

export interface AcceptPhaseCommand {
  phaseId: number;
  reportContent: string;
}

export interface CancelAcceptanceRequest {
  cancellationReason: string;
}
