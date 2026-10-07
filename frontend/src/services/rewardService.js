import api from "./api";

export const getMyRewards = async () => {
  const response = await api.get("/rewards/me");
  return response.data;
};

export const getLeaderboard = async (limit = 10) => {
  const response = await api.get("/rewards/leaderboard", { params: { limit } });
  return response.data;
};

export const getRewardTiers = async () => {
  const response = await api.get("/rewards/tiers");
  return response.data;
};

export const downloadCertificate = async (tierKey, filename) => {
  const response = await api.get(`/rewards/certificate/${tierKey}`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `CivicAI_${tierKey}_Certificate.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};