import api from "./api";

export const getIncidents = async (params = {}) => {
  const response = await api.get("/incidents/", { params });
  return response.data;
};

export const getIncidentsForMap = async () => {
  const response = await api.get("/incidents/map");
  return response.data;
};

export const getIncident = async (incidentId) => {
  const response = await api.get(`/incidents/${incidentId}`);
  return response.data;
};
