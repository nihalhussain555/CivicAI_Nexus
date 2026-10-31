import api from "./api";

export const previewAnalysis = async (data) => {
  const response = await api.post(
    "/grievances/preview",
    data
  );

  return response.data;
};

export const submitGrievance = async (data) => {
  const response = await api.post(
    "/grievances/",
    data
  );

  return response.data;
};

export const getMyGrievances = async (
  params = {}
) => {
  const response = await api.get(
    "/grievances/my",
    { params }
  );

  return response.data;
};

export const getQueue = async (
  params = {}
) => {
  const response = await api.get(
    "/grievances/queue",
    { params }
  );

  return response.data;
};

export const getAssigned = async (
  params = {}
) => {
  const response = await api.get(
    "/grievances/assigned",
    { params }
  );

  return response.data;
};

export const getAllGrievances = async (
  params = {}
) => {
  const response = await api.get(
    "/grievances/",
    { params }
  );

  return response.data;
};

export const getUnassignedGrievances =
  async (params = {}) => {
    const response = await api.get(
      "/grievances/unassigned",
      { params }
    );

    return response.data;
  };

export const getGrievance = async (
  grievanceId
) => {
  const response = await api.get(
    `/grievances/${grievanceId}`
  );

  return response.data;
};

export const getCopilotBrief = async (
  grievanceId
) => {
  const response = await api.get(
    `/grievances/${grievanceId}/copilot`
  );

  return response.data;
};

export const acceptCase = async (
  grievanceId
) => {
  const response = await api.put(
    `/grievances/${grievanceId}/accept`
  );

  return response.data;
};

export const assignOfficer = async (
  grievanceId,
  officerId
) => {
  const response = await api.put(
    `/grievances/${grievanceId}/assign`,
    {
      officer_id: officerId,
    }
  );

  return response.data;
};

export const startProgress = async (
  grievanceId
) => {
  const response = await api.put(
    `/grievances/${grievanceId}/start`
  );

  return response.data;
};

export const submitResolution = async (
  grievanceId,
  data
) => {
  const response = await api.put(
    `/grievances/${grievanceId}/resolve`,
    data
  );

  return response.data;
};

export const escalateCase = async (
  grievanceId,
  message
) => {
  const response = await api.put(
    `/grievances/${grievanceId}/escalate`,
    null,
    {
      params: message
        ? { message }
        : {},
    }
  );

  return response.data;
};

export const verifyResolution = async (
  grievanceId,
  data
) => {
  const response = await api.put(
    `/grievances/${grievanceId}/verify`,
    data
  );

  return response.data;
};

export const requestReopen = async (
  grievanceId,
  reason
) => {
  const response = await api.post(
    `/grievances/${grievanceId}/reopen-request`,
    { reason }
  );

  return response.data;
};

export const reviewReopenRequest = async (
  grievanceId,
  { approve, note }
) => {
  const response = await api.put(
    `/grievances/${grievanceId}/reopen-request/review`,
    { approve, note }
  );

  return response.data;
};

export const deleteGrievance = async (
  grievanceId
) => {
  const response = await api.delete(
    `/grievances/${grievanceId}`
  );

  return response.data;
};

export const bulkAcceptCases = async (
  grievanceIds
) => {
  const response = await api.post(
    "/grievances/bulk-accept",
    { grievance_ids: grievanceIds }
  );

  return response.data;
};

export const bulkAssignOfficer = async (
  grievanceIds,
  officerId
) => {
  const response = await api.post(
    "/grievances/bulk-assign",
    { grievance_ids: grievanceIds, officer_id: officerId }
  );

  return response.data;
};

// --- Integrity / fake-report review --------------------------------------
// Separate from the lifecycle calls above: these decide what the platform
// *believes* about a report, not what stage it's at.

export const flagInvalid = async (
  grievanceId,
  reason
) => {
  const response = await api.put(
    `/grievances/${grievanceId}/flag-invalid`,
    { reason }
  );

  return response.data;
};

export const getIntegrityQueue = async (
  params = {}
) => {
  const response = await api.get(
    "/grievances/integrity/queue",
    { params }
  );

  return response.data;
};

export const triageIntegrity = async (
  grievanceId,
  { decision, note }
) => {
  const response = await api.put(
    `/grievances/${grievanceId}/integrity/triage`,
    { decision, note }
  );

  return response.data;
};

export const unflagGrievance = async (
  grievanceId,
  note
) => {
  const response = await api.put(
    `/grievances/${grievanceId}/unflag`,
    { note }
  );

  return response.data;
};

export const appealFlag = async (
  grievanceId,
  reason
) => {
  const response = await api.post(
    `/grievances/${grievanceId}/flag-appeal`,
    { reason }
  );

  return response.data;
};

export const reviewFlagAppeal = async (
  grievanceId,
  { approve, note }
) => {
  const response = await api.put(
    `/grievances/${grievanceId}/flag-appeal/review`,
    { approve, note }
  );

  return response.data;
};

// Other citizens' open reports within a short radius of a point. Used by the
// report form to say "this spot is already being reported" before a duplicate
// is filed; the response carries no identities, and a citizen cannot open
// someone else's case, so the result is context rather than a link.
export const getNearbyReports = async (
  { latitude, longitude, radiusKm = 0.5, district }
) => {
  const response = await api.get(
    "/grievances/nearby",
    {
      params: {
        lat: latitude,
        lng: longitude,
        radius_km: radiusKm,
        ...(district ? { district } : {}),
      },
    }
  );

  return response.data;
};
