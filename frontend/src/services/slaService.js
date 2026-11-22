import api from "./api";

// SLA Management API client. Mirrors the convention used by every other
// service in this folder: functions resolve with the response envelope
// ({ success, data }), so callers read `res.data` for the payload.

export const getSlaConfig = async () => {
  const response = await api.get("/sla/config");
  return response.data;
};

export const updateSlaConfig = async (payload) => {
  const response = await api.put("/sla/config", payload);
  return response.data;
};

export const getSchedulerHealth = async () => {
  const response = await api.get("/sla/scheduler-health");
  return response.data;
};

export const getSlaDashboard = async (params = {}) => {
  const response = await api.get("/sla/dashboard", { params });
  return response.data;
};

export const getDepartmentPerformance = async (params = {}) => {
  const response = await api.get("/sla/department-performance", { params });
  return response.data;
};

export const getOverdueCases = async (params = {}) => {
  const response = await api.get("/sla/overdue", { params });
  return response.data;
};

export const getWarningCases = async (params = {}) => {
  const response = await api.get("/sla/warnings", { params });
  return response.data;
};

export const getCaseSla = async (grievanceId) => {
  const response = await api.get(`/sla/${grievanceId}`);
  return response.data;
};

export const getCaseSlaHistory = async (grievanceId) => {
  const response = await api.get(`/sla/${grievanceId}/history`);
  return response.data;
};

export const manualEscalate = async (grievanceId, reason) => {
  const response = await api.post(`/sla/${grievanceId}/escalate`, { reason });
  return response.data;
};

// The reports endpoint streams a CSV download. A plain <a href> can't carry
// the Authorization header, so the blob is fetched through the shared api
// instance and handed to the browser.
export const downloadDepartmentReport = async (params = {}) => {
  const response = await api.get("/sla/reports", {
    params: { ...params, format: "csv" },
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `sla-department-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
