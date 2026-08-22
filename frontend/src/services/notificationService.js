import api from "./api";

export const getNotifications = async (params = {}) => {
  const response = await api.get("/notifications/", { params });
  return response.data;
};

export const markRead = async (notificationId) => {
  const response = await api.put(`/notifications/${notificationId}/read`);
  return response.data;
};

export const markAllRead = async () => {
  const response = await api.put("/notifications/read-all");
  return response.data;
};
