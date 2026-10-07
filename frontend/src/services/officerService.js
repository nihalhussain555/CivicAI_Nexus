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

export const getOfficerLeaderboard = async (limit = 10) => {
  const response = await api.get("/officers/leaderboard", { params: { limit } });
  return response.data;
};

export const getMyOfficerBadges = async () => {
  const response = await api.get("/officers/me/badges");
  return response.data;
};

export const downloadOfficerCertificate = async (badgeKey, filename) => {
  const response = await api.get(`/officers/certificate/${badgeKey}`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `CivicAI_Officer_${badgeKey}_Certificate.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};