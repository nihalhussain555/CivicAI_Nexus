import api from "./api";

export const getDepartments = async () => {
  const response = await api.get("/departments/");
  return response.data;
};

export const createDepartment = async (data) => {
  const response = await api.post("/departments/", data);
  return response.data;
};

export const updateDepartment = async (code, data) => {
  const response = await api.put(`/departments/${code}`, data);
  return response.data;
};

export const getDepartmentPerformance = async (code) => {
  const response = await api.get(`/departments/${code}/performance`);
  return response.data;
};
