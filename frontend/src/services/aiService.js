import api from "./api";

export const analyzeText = async (text, language = "Auto") => {
  const response = await api.post("/ai/analyze", { text, language });
  return response.data;
};

export const chatWithAssistant = async (message, language = "English") => {
  const response = await api.post("/ai/chat", { message, language });
  return response.data;
};
