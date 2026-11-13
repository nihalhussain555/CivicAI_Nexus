import api from "./api";

export const analyzeText = async (text, language = "Auto") => {
  const response = await api.post("/ai/analyze", { text, language });
  return response.data;
};

export const chatWithAssistant = async (message, language = "Auto", sessionId = null, voice = null) => {
  const response = await api.post("/ai/chat", {
    message,
    language,
    session_id: sessionId,
    source: voice ? "voice" : "text",
    original_text: voice?.originalText || null,
    audio_url: voice?.audioUrl || null,
  });
  return response.data;
};

/** What speech the deployment can actually do: which provider hears the
 * recordings, which languages it can speak back, and the upload limits the
 * recorder has to respect. */
export const getVoiceStatus = async () => {
  const response = await api.get("/ai/voice/status");
  return response.data;
};

/** Transcribe a recording for review. Nothing is filed or added to the chat
 * here — the citizen sees the words first and corrects them if needed. */
export const transcribeVoiceNote = async (blob, language = "Auto") => {
  const formData = new FormData();
  formData.append("file", blob, "voice-note.webm");
  formData.append("language", language);
  const response = await api.post("/ai/voice/transcribe", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
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