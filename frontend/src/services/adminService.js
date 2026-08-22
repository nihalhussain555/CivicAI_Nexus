import api from "./api";

export const getUsers = async (params = {}) => {
  const response = await api.get("/admin/users", { params });
  return response.data;
};

export const deactivateUser = async (userId) => {
  const response = await api.put(`/admin/users/${userId}/deactivate`);
  return response.data;
};

export const activateUser = async (userId) => {
  const response = await api.put(`/admin/users/${userId}/activate`);
  return response.data;
};
