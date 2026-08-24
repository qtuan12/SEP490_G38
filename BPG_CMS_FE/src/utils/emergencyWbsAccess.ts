import type { IncidentDto } from '../services/incidentService';

export const getCurrentPauseEmergencyIncidentId = (
  pauseReason: string | null | undefined,
): number | null => {
  if (!pauseReason?.trim().startsWith('[')) return null;

  try {
    const history = JSON.parse(pauseReason);
    if (!Array.isArray(history) || history.length === 0) return null;

    const latest = history[history.length - 1];
    const type = String(latest?.type ?? latest?.Type ?? '').toLowerCase();
    if (type !== 'pause') return null;

    const incidentId = Number(
      latest?.emergencyIncidentId ?? latest?.EmergencyIncidentId,
    );
    return Number.isSafeInteger(incidentId) && incidentId > 0 ? incidentId : null;
  } catch {
    return null;
  }
};

export const hasApprovedEmergencyForCurrentPause = (
  pauseReason: string | null | undefined,
  incidents: IncidentDto[] | null | undefined,
): boolean => {
  const incidentId = getCurrentPauseEmergencyIncidentId(pauseReason);
  return incidentId !== null && (incidents ?? []).some(
    incident => incident.incidentId === incidentId
      && incident.isEmergency === true
      && incident.status === 'Approved',
  );
};
