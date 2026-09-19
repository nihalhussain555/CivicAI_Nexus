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