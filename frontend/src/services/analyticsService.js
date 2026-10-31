import api from "./api";

export const getAdminOverview =
  async () => {
    const response = await api.get(
      "/analytics/admin/overview"
    );

    return response.data;
  };

export const getCategoryDistribution =
  async () => {
    const response = await api.get(
      "/analytics/admin/category-distribution"
    );

    return response.data;
  };

export const getDepartmentPerformanceAll =
  async () => {
    const response = await api.get(
      "/analytics/admin/department-performance"
    );

    return response.data;
  };

export const getTrends = async (
  days = 30
) => {
  const response = await api.get(
    "/analytics/admin/trends",
    {
      params: { days },
    }
  );

  return response.data;
};

export const getMapMarkers =
  async (params = {}) => {
    const response = await api.get(
      "/analytics/admin/map",
      {
        params,
      }
    );

    return response.data;
  };

export const getOfficerOverview =
  async () => {
    const response = await api.get(
      "/analytics/officer/overview"
    );

    return response.data;
  };

export const getIntegrityStats =
  async (days = 30) => {
    const response = await api.get(
      "/analytics/admin/integrity",
      {
        params: { days },
      }
    );

    return response.data;
  };