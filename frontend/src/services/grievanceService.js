import api from "./api";

export const previewAnalysis = async (data) => {
  const response = await api.post("/grievances/preview", data);
  return response.data;
};

export const submitGrievance = async (data) => {
  const response = await api.post("/grievances/", data);
  return response.data;
};

export const getMyGrievances = async (params = {}) => {
  const response = await api.get("/grievances/my", { params });
  return response.data;
};

export const getQueue = async (params = {}) => {
  const response = await api.get("/grievances/queue", { params });
  return response.data;
};

export const getAssigned = async (params = {}) => {
  const response = await api.get("/grievances/assigned", { params });
  return response.data;
};

export const getAllGrievances = async (params = {}) => {
  const response = await api.get("/grievances/", { params });
  return response.data;
};

export const getGrievance = async (grievanceId) => {
  const response = await api.get(`/grievances/${grievanceId}`);
  return response.data;
};

export const getCopilotBrief = async (grievanceId) => {
  const response = await api.get(`/grievances/${grievanceId}/copilot`);
  return response.data;
};

export const acceptCase = async (grievanceId) => {
  const response = await api.put(`/grievances/${grievanceId}/accept`);
  return response.data;
};

export const assignOfficer = async (grievanceId, officerId) => {
  const response = await api.put(`/grievances/${grievanceId}/assign`, { officer_id: officerId });
  return response.data;
};

export const startProgress = async (grievanceId) => {
  const response = await api.put(`/grievances/${grievanceId}/start`);
  return response.data;
};

export const submitResolution = async (grievanceId, data) => {
  const response = await api.put(`/grievances/${grievanceId}/resolve`, data);
  return response.data;
};

export const escalateCase = async (grievanceId, message) => {
  const response = await api.put(`/grievances/${grievanceId}/escalate`, null, {
    params: message ? { message } : {},
  });
  return response.data;
};

export const verifyResolution = async (grievanceId, data) => {
  const response = await api.put(`/grievances/${grievanceId}/verify`, data);
  return response.data;
};
