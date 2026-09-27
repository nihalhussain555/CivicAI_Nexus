import api from "./api";

export const getVapidPublicKey = async () => {
  const response = await api.get("/push/vapid-public-key");
  return response.data;
};

export const subscribePush = async (subscription) => {
  const response = await api.post("/push/subscribe", subscription);
  return response.data;
};

export const unsubscribePush = async (endpoint) => {
  const response = await api.post("/push/unsubscribe", { endpoint });
  return response.data;
};