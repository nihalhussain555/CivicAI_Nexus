import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Bot, Send, Sparkles, Plus, MessageSquare, Trash2, History, X } from "lucide-react";
import { chatWithAssistant, listChatSessions, getChatSession, deleteChatSession, } from "../../services/aiService";
import { uploadsBaseUrl } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../hooks/useAuth";
import { getErrorMessage, formatRelative } from "../../utils/helpers";
import ChatMessage from "../../components/ai/ChatMessage";
import ListenButton from "../../components/voice/ListenButton";
import VoiceCapture from "../../components/voice/VoiceCapture";
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
          border: 2px solid color-mix(in srgb, var(--violet) 15%, transparent);
          border-top-color: var(--violet);
          border-right-color: color-mix(in srgb, var(--violet) 78%, white);
          animation: civicAIOrbit 1.1s linear infinite;
        }

        .civic-ai-loader-orbit::after {
          content: "";
          position: absolute;
          inset: 7px;
          border-radius: 50%;
          border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
          border-bottom-color: var(--accent);
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
            color-mix(in srgb, var(--violet) 55%, white) 0%,
            var(--violet) 45%,
            var(--accent) 100%
          );
          box-shadow:
            0 0 8px color-mix(in srgb, var(--violet) 65%, transparent),
            0 0 18px color-mix(in srgb, var(--violet) 50%, transparent);
          animation: civicAICorePulse 1.1s ease-in-out infinite;
          z-index: 2;
        }

        .civic-ai-loader-dot {
          position: absolute;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: color-mix(in srgb, var(--violet) 78%, white);
          box-shadow: 0 0 7px color-mix(in srgb, var(--violet) 75%, transparent);
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
          background: var(--violet);
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
  const [historyOpen, setHistoryOpen] = useState(false);

  const [messages, setMessages] = useState([{ role: "assistant", text: content.greeting }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // True while the assistant has described a complaint and is waiting for the
  // citizen to say yes. Rendered as explicit buttons so a spoken "yes" is not
  // the only way to finish filing.
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
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
    setAwaitingConfirm(false);
    setHistoryOpen(false);
  };

  const openSession = async (sessionId) => {
    try {
      const res = await getChatSession(sessionId);
      const loaded = res.data.messages.map((m) => ({
        role: m.role,
        text: m.text,
        language: m.language || null,
        code: m.language_code || null,
        audioUrl: m.audio_url || null,
        originalText: m.original_text || null,
      }));
      setMessages(loaded.length ? loaded : [{ role: "assistant", text: content.greeting }]);
      setAwaitingConfirm(Boolean(res.data.pending_complaint));
      setActiveSessionId(sessionId);
      setHistoryOpen(false);
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

  /** `voice` is the payload from VoiceCapture (approved words plus where they
   * came from); null for a typed message. */
  const send = async (text, voice = null) => {
    const message = (voice ? voice.text : (text ?? input)).trim();
    if (!message) return;
    setMessages((m) => [...m, {
      role: "user",
      text: message,
      language: voice?.language || null,
      code: voice?.languageCode || null,
      audioUrl: voice?.audioUrl || null,
    }]);
    setInput("");
    setAwaitingConfirm(false);
    setLoading(true);
    try {
      const res = await chatWithAssistant(message, voice?.language || "Auto", activeSessionId, voice);
      const data = res.data;
      setMessages((m) => [...m, {
        role: "assistant",
        text: data.response,
        language: data.language,
        code: data.language_code,
        grievanceId: data.filed_grievance_id || null,
        // Someone who reported by voice gets the answer read back to them
        // without having to find a button; a typed question never starts
        // talking on its own.
        autoSpeak: Boolean(voice),
      }]);
      setAwaitingConfirm(Boolean(data.awaiting_complaint_confirmation));
      if (!activeSessionId) setActiveSessionId(data.session_id);
      loadSessions();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-assistant-shell">
      {/* Backdrop shown behind the history drawer on mobile */}
      <button
        type="button"
        className={`ai-history-backdrop ${historyOpen ? "open" : ""}`}
        aria-label="Close chat history"
        onClick={() => setHistoryOpen(false)}
      />

      {/* History sidebar — becomes an off-canvas drawer under 768px */}
      <div className={`card ai-history-panel ${historyOpen ? "open" : ""}`}>
        <div style={{ padding: 12, borderBottom: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-primary btn-sm btn-block" onClick={startNewChat}>
            <Plus size={14} /> New chat
          </button>

          <button
            type="button"
            className="icon-button"
            aria-label="Close chat history"
            onClick={() => setHistoryOpen(false)}
            style={{ display: historyOpen ? "flex" : "none", flexShrink: 0 }}
          >
            <X size={16} />
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
      <div className="ai-chat-panel">
        <div className="page-header" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <button
              type="button"
              className="icon-button ai-history-toggle"
              aria-label="Open chat history"
              onClick={() => setHistoryOpen(true)}
              style={{ marginTop: 2 }}
            >
              <History size={17} />
            </button>

            <div>
              <h1>
                <Bot size={20} style={{ verticalAlign: "-3px", marginRight: 8, color: "var(--accent)" }} />{content.title}
              </h1>
              <p>{content.subtitle}</p>
            </div>
          </div>
        </div>

        <div className="card" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
          {messages.map((m, i) => (
            <div key={i} className={`message ${m.role === "user" ? "user-message" : "ai-message"}`}>
              <ChatMessage
                text={m.text}
                language={m.language && (m.role === "user" || m.code !== "en") ? m.language : null}
                code={m.code}
              >
                {m.role === "assistant" ? (
                  <>
                    <ListenButton text={m.text} locale={`${m.code || "en"}-IN`} autoPlay={m.autoSpeak} />
                    {m.grievanceId && (
                      <Link to={`/citizen/grievances/${m.grievanceId}`} style={{ color: "var(--accent)", fontWeight: 600 }}>
                        View {m.grievanceId}
                      </Link>
                    )}
                  </>
                ) : (
                  m.audioUrl && <audio controls preload="none" src={`${uploadsBaseUrl}${m.audioUrl}`} />
                )}
              </ChatMessage>
            </div>
          ))}
          {loading && <div className="message ai-message"><AIThinkingLoader small /></div>}
          <div ref={endRef} />
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {awaitingConfirm ? (
            <>
              <button className="badge badge-success suggestion-chip" style={{ cursor: "pointer", border: "none" }}
                      onClick={() => send("Yes, file it")}>
                Yes, file it
              </button>
              <button className="badge badge-neutral suggestion-chip" style={{ cursor: "pointer", border: "none" }}
                      onClick={() => send("No, cancel it")}>
                No, don&apos;t file it
              </button>
            </>
          ) : (
            content.suggestions.map((s) => (
              <button key={s} className="badge badge-neutral suggestion-chip" style={{ cursor: "pointer", border: "none" }} onClick={() => send(s)}>
                <Sparkles size={11} /> {s}
              </button>
            ))
          )}
        </div>

        <form className="composer-row" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input className="input" value={input} onChange={(e) => setInput(e.target.value)}
                 placeholder="Ask the CivicAI assistant — or tap the microphone and speak" />
          <button type="submit" className="btn btn-primary" disabled={loading}><Send size={15} /></button>
        </form>

        <div style={{ marginTop: 10 }}>
          <VoiceCapture onAccept={(voice) => send(null, voice)} disabled={loading} />
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;