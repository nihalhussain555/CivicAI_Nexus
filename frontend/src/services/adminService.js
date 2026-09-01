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

export const getAdmins = async () => {
  const response = await api.get("/admin/admins");
  return response.data;
};

export const createAdmin = async (data) => {
  const response = await api.post("/admin/admins", data);
  return response.data;
};