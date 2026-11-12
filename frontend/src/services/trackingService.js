import api from "./api";

// The citizen tracking API. Separate from grievanceService because it talks to
// a different projection of the same case: `/tracking` returns the public-safe
// view the reporter is owed, not the staff document. Anything that should show
// up on the tracking page has to be added to the backend projection first —
// these calls will never surface a field the API didn't choose to send.

export const getTracking = async (grievanceId) => {
  const response = await api.get(`/grievances/${grievanceId}/tracking`);
  return response.data;
};

// Satisfaction rating, given or corrected by the reporter. Sent alongside the
// verification verdict too; this endpoint is for changing your mind afterwards.
export const updateFeedback = async (grievanceId, { rating, feedback }) => {
  const response = await api.put(`/grievances/${grievanceId}/feedback`, {
    ...(rating ? { rating } : {}),
    ...(feedback ? { feedback } : {}),
  });
  return response.data;
};

// --- staff-side actions on the same case ---------------------------------
// Kept here so the remark/reject UI and the citizen-facing readout of it live
// next to each other and cannot drift apart.

export const addRemark = async (grievanceId, { text, audience = "PUBLIC" }) => {
  const response = await api.post(`/grievances/${grievanceId}/remarks`, {
    text,
    audience,
  });
  return response.data;
};

export const rejectGrievance = async (grievanceId, reason) => {
  const response = await api.put(`/grievances/${grievanceId}/reject`, { reason });
  return response.data;
};
