import api from "./api";

export const analyzeText = async (text, language = "Auto") => {
  const response = await api.post("/ai/analyze", { text, language });
  return response.data;
};

export const chatWithAssistant = async (message, language = "English", sessionId = null) => {
  const response = await api.post("/ai/chat", { message, language, session_id: sessionId });
  return response.data;
};

export const listChatSessions = async () => {
  const response = await api.get("/ai/chat/sessions");
  return response.data;
};

export const getChatSession = async (sessionId) => {
  const response = await api.get(`/ai/chat/sessions/${sessionId}`);
  return response.data;
};

export const deleteChatSession = async (sessionId) => {
  const response = await api.delete(`/ai/chat/sessions/${sessionId}`);
  return response.data;
};