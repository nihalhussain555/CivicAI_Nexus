import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Sparkles, Plus, MessageSquare, Trash2 } from "lucide-react";
import { chatWithAssistant, listChatSessions, getChatSession, deleteChatSession, } from "../../services/aiService";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../hooks/useAuth";
import { getErrorMessage, formatRelative } from "../../utils/helpers";
import ChatMessage from "../../components/ai/ChatMessage";
const AIThinkingLoader = ({ small = false }) => {
  const [statusIndex, setStatusIndex] = useState(0);

  const statuses = [
    "Thinking...",
    "Understanding your question...",
    "Analyzing information...",
    "Preparing response...",
  ];

  useEffect(() => {
    if (small) return;

    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statuses.length);
    }, 1800);

    return () => clearInterval(interval);
  }, [small]);

  return (
    <>
      <div className={`civic-ai-loader ${small ? "civic-ai-loader-small" : ""}`}>
        <div className="civic-ai-loader-orbit">
          <span className="civic-ai-loader-dot dot-one"></span>
          <span className="civic-ai-loader-dot dot-two"></span>
          <span className="civic-ai-loader-dot dot-three"></span>

          <div className="civic-ai-loader-core">
            <Sparkles size={small ? 9 : 13} />
          </div>
        </div>

        {!small && (
          <div className="civic-ai-thinking-text">
            <span className="civic-ai-status">
              {statuses[statusIndex]}
            </span>

            <span className="civic-ai-thinking-dots">
              <i></i>
              <i></i>
              <i></i>
            </span>
          </div>
        )}
      </div>

      <style>{`
        .civic-ai-loader {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 6px 10px;
        }

        .civic-ai-loader-orbit {
          width: 42px;
          height: 42px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .civic-ai-loader-orbit::before {
          content: "";
          position: absolute;
          inset: 1px;
          border-radius: 50%;
          border: 2px solid rgba(139, 92, 246, 0.15);
          border-top-color: #8b5cf6;
          border-right-color: #a855f7;
          animation: civicAIOrbit 1.1s linear infinite;
        }

        .civic-ai-loader-orbit::after {
          content: "";
          position: absolute;
          inset: 7px;
          border-radius: 50%;
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-bottom-color: #6366f1;
          animation: civicAIOrbitReverse 0.8s linear infinite;
        }

        .civic-ai-loader-core {
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: white;
          background: radial-gradient(
            circle,
            #c084fc 0%,
            #8b5cf6 45%,
            #6366f1 100%
          );
          box-shadow:
            0 0 8px rgba(139, 92, 246, 0.8),
            0 0 18px rgba(139, 92, 246, 0.5);
          animation: civicAICorePulse 1.1s ease-in-out infinite;
          z-index: 2;
        }

        .civic-ai-loader-dot {
          position: absolute;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #a855f7;
          box-shadow: 0 0 7px rgba(168, 85, 247, 0.9);
          z-index: 3;
        }

        .civic-ai-loader-dot.dot-one {
          top: 0;
          left: 18px;
          animation: civicAIDotPulse 1s ease-in-out infinite;
        }

        .civic-ai-loader-dot.dot-two {
          right: 1px;
          bottom: 9px;
          animation: civicAIDotPulse 1s ease-in-out 0.25s infinite;
        }

        .civic-ai-loader-dot.dot-three {
          left: 1px;
          bottom: 9px;
          animation: civicAIDotPulse 1s ease-in-out 0.5s infinite;
        }

        .civic-ai-thinking-text {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 18px;
          color: var(--text-muted);
          font-size: 12px;
          font-weight: 500;
          transition: opacity 0.3s ease;
        }

        .civic-ai-status {
          animation: civicAIStatusFade 0.4s ease;
        }

        .civic-ai-thinking-dots {
          display: flex;
          gap: 3px;
          margin-left: 4px;
        }

        .civic-ai-thinking-dots i {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: #8b5cf6;
          animation: civicAIDotText 1.2s ease-in-out infinite;
        }

        .civic-ai-thinking-dots i:nth-child(2) {
          animation-delay: 0.2s;
        }

        .civic-ai-thinking-dots i:nth-child(3) {
          animation-delay: 0.4s;
        }

        .civic-ai-loader-small {
          padding: 0;
        }

        .civic-ai-loader-small .civic-ai-loader-orbit {
          width: 20px;
          height: 20px;
        }

        .civic-ai-loader-small .civic-ai-loader-orbit::before {
          border-width: 1.5px;
        }

        .civic-ai-loader-small .civic-ai-loader-orbit::after {
          inset: 4px;
          border-width: 1px;
        }

        .civic-ai-loader-small .civic-ai-loader-core {
          width: 8px;
          height: 8px;
        }

        .civic-ai-loader-small .civic-ai-loader-dot {
          width: 3px;
          height: 3px;
        }

        .civic-ai-loader-small .civic-ai-loader-dot.dot-one {
          left: 8.5px;
        }

        .civic-ai-loader-small .civic-ai-loader-dot.dot-two {
          right: 0;
          bottom: 4px;
        }

        .civic-ai-loader-small .civic-ai-loader-dot.dot-three {
          left: 0;
          bottom: 4px;
        }

        @keyframes civicAIOrbit {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes civicAIOrbitReverse {
          from {
            transform: rotate(360deg);
          }
          to {
            transform: rotate(0deg);
          }
        }

        @keyframes civicAICorePulse {
          0%, 100% {
            transform: scale(0.85);
          }
          50% {
            transform: scale(1.1);
          }
        }

        @keyframes civicAIDotPulse {
          0%, 100% {
            transform: scale(0.6);
            opacity: 0.4;
          }
          50% {
            transform: scale(1.25);
            opacity: 1;
          }
        }

        @keyframes civicAIDotText {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.35;
          }
          30% {
            transform: translateY(-3px);
            opacity: 1;
          }
        }

        @keyframes civicAIStatusFade {
          from {
            opacity: 0;
            transform: translateY(3px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
};


const ROLE_CONTENT = {
  citizen: {
    title: "CivicAI",
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
    title: "CivicAi",
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
    title: "CivicAi",
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
              <AIThinkingLoader small />
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
          {loading && <div className="message ai-message"><AIThinkingLoader small /></div>}
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