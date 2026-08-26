import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Sparkles, Loader2, Plus, MessageSquare, Trash2 } from "lucide-react";
import {
  chatWithAssistant, listChatSessions, getChatSession, deleteChatSession,
} from "../../services/aiService";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../hooks/useAuth";
import { getErrorMessage, formatRelative } from "../../utils/helpers";
import ChatMessage from "../../components/ai/ChatMessage";

const ROLE_CONTENT = {
  citizen: {
    title: "Ask CivicAI",
    subtitle: "Questions about reporting an issue, tracking status, or how the platform works.",
    greeting: "Hi, I'm the CivicAI assistant. Ask me how to report an issue, what happens after you submit, or how to track a grievance.",
    suggestions: [
      "How do I report an issue?",
      "How long will my report take to resolve?",
      "What happens if I'm not happy with the resolution?",
      "How does AI decide the priority of my report?",
    ],
  },
  officer: {
    title: "AI Copilot Assistant",
    subtitle: "General guidance on platform behavior — for a specific case's brief, open that grievance directly.",
    greeting: "Hi, I'm the CivicAI assistant. Ask me anything about how the platform triages and routes grievances.",
    suggestions: [
      "How does department routing work?",
      "How is priority calculated?",
      "What happens when a citizen reopens a case?",
      "How are community incidents detected?",
    ],
  },
  admin: {
    title: "AI Assistant",
    subtitle: "Platform-wide guidance on AI behavior, routing logic, and SLA/escalation rules.",
    greeting: "Hi, I'm the CivicAI assistant. Ask me about routing logic, SLA rules, escalation risk, or incident clustering across the platform.",
    suggestions: [
      "How is escalation risk calculated?",
      "How does incident clustering decide report thresholds?",
      "How is department performance measured?",
      "How does the AI Copilot support officers?",
    ],
  },
};

const AIAssistant = () => {
  const { user } = useAuth();
  const content = ROLE_CONTENT[user?.role] || ROLE_CONTENT.citizen;

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState(null);

  const [messages, setMessages] = useState([{ role: "assistant", text: content.greeting }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const endRef = useRef();

  const loadSessions = useCallback(() => {
    setSessionsLoading(true);
    listChatSessions()
      .then((res) => setSessions(res.data))
      .catch(() => {})
      .finally(() => setSessionsLoading(false));
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([{ role: "assistant", text: content.greeting }]);
  };

  const openSession = async (sessionId) => {
    try {
      const res = await getChatSession(sessionId);
      const loaded = res.data.messages.map((m) => ({ role: m.role, text: m.text }));
      setMessages(loaded.length ? loaded : [{ role: "assistant", text: content.greeting }]);
      setActiveSessionId(sessionId);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const removeSession = async (e, sessionId) => {
    e.stopPropagation();
    try {
      await deleteChatSession(sessionId);
      setSessions((s) => s.filter((sess) => sess._id !== sessionId));
      if (activeSessionId === sessionId) startNewChat();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message) return;
    setMessages((m) => [...m, { role: "user", text: message }]);
    setInput("");
    setLoading(true);
    try {
      const res = await chatWithAssistant(message, "English", activeSessionId);
      setMessages((m) => [...m, { role: "assistant", text: res.data.response }]);
      if (!activeSessionId) setActiveSessionId(res.data.session_id);
      loadSessions();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: 18, height: "calc(100vh - 120px)" }}>
      {/* History sidebar */}
      <div
        className="card"
        style={{
          width: 240, flexShrink: 0, padding: 0, display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
          <button className="btn btn-primary btn-sm btn-block" onClick={startNewChat}>
            <Plus size={14} /> New chat
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {sessionsLoading ? (
            <div style={{ padding: 16, textAlign: "center" }}>
              <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite", color: "var(--text-faint)" }} />
            </div>
          ) : sessions.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-faint)", padding: "8px 6px" }}>No past chats yet.</p>
          ) : (
            sessions.map((s) => (
              <div
                key={s._id}
                onClick={() => openSession(s._id)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "9px 10px",
                  borderRadius: 8, cursor: "pointer", marginBottom: 2,
                  background: activeSessionId === s._id ? "var(--accent-soft)" : "transparent",
                }}
              >
                <MessageSquare size={13} style={{ flexShrink: 0, color: activeSessionId === s._id ? "var(--accent)" : "var(--text-faint)" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    color: activeSessionId === s._id ? "var(--accent-soft-text)" : "var(--text)",
                  }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{formatRelative(s.updated_at)}</div>
                </div>
                <button
                  onClick={(e) => removeSession(e, s._id)}
                  aria-label="Delete chat"
                  style={{ background: "none", border: "none", color: "var(--text-faint)", display: "flex", flexShrink: 0 }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat window */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div className="page-header" style={{ marginBottom: 16 }}>
          <div>
            <h1>
              <Bot size={20} style={{ verticalAlign: "-3px", marginRight: 8, color: "var(--accent)" }} />{content.title}
            </h1>
            <p>{content.subtitle}</p>
          </div>
        </div>

        <div className="card" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
          {messages.map((m, i) => (
            <div key={i} className={`message ${m.role === "user" ? "user-message" : "ai-message"}`}>
              <ChatMessage text={m.text} />
            </div>
          ))}
          {loading && <div className="message ai-message"><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /></div>}
          <div ref={endRef} />
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {content.suggestions.map((s) => (
            <button key={s} className="badge badge-neutral" style={{ cursor: "pointer", border: "none" }} onClick={() => send(s)}>
              <Sparkles size={11} /> {s}
            </button>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: "flex", gap: 10 }}>
          <input className="input" value={input} onChange={(e) => setInput(e.target.value)}
                 placeholder="Ask the CivicAI assistant..." />
          <button type="submit" className="btn btn-primary" disabled={loading}><Send size={15} /></button>
        </form>
      </div>
    </div>
  );
};

export default AIAssistant;