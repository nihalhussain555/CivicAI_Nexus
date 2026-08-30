import api from "./api";

export const getOfficers = async (params = {}) => {
  const response = await api.get("/officers/", { params });
  return response.data;
};

export const createOfficer = async (data) => {
  const response = await api.post("/officers/", data);
  return response.data;
};

export const getOfficer = async (officerId) => {
  const response = await api.get(`/officers/${officerId}`);
  return response.data;
};

export const getOfficerPerformance = async (officerId) => {
  const response = await api.get(`/officers/${officerId}/performance`);
  return response.data;
};