import { useState, useRef, useEffect } from "react";
import { Bot, Send, Sparkles, Loader2 } from "lucide-react";
import { chatWithAssistant } from "../../services/aiService";
import { useDiagnostics } from "../../hooks/useDiagnostics";
import DiagnosticCard from "../../components/common/DiagnosticCard";

const SUGGESTIONS = [
  "How does department routing work?",
  "How is priority calculated?",
  "What happens when a citizen reopens a case?",
  "How are community incidents detected?",
];

const Copilot = () => {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi, I'm the CivicAI assistant. Ask me anything about how the platform triages and routes grievances." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { capture } = useDiagnostics();
  const endRef = useRef();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // `repeat` re-asks a failed turn without writing the officer's question twice.
  const send = async (text, repeat = false) => {
    const message = (text ?? input).trim();
    if (!message) return;
    if (!repeat) setMessages((m) => [...m, { role: "user", text: message }]);
    setInput("");
    setLoading(true);
    try {
      const res = await chatWithAssistant(message);
      setMessages((m) => [...m, { role: "assistant", text: res.data.response }]);
    } catch (error) {
      // A toast disappears before an officer reading a thread notices it. The
      // turn itself carries the diagnosis: what failed, why, and the asking
      // again of the very question that failed.
      const diagnosis = capture(error, { feature: "ai_chat" });
      setMessages((m) => [...m, {
        role: "assistant",
        kind: "error",
        diagnosis,
        retry: () => send(message, true),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", height: "calc(100vh - 160px)" }}>
      <div className="page-header">
        <div><h1><Bot size={20} style={{ verticalAlign: "-3px", marginRight: 8, color: "var(--accent)" }} />AI Copilot Assistant</h1>
          <p>General guidance on platform behavior — for a specific case's brief, open that grievance directly.</p></div>
      </div>

      <div className="card" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
        {messages.map((m, i) => (
          m.kind === "error" ? (
            <div key={i} style={{ width: "100%" }}>
              <DiagnosticCard
                variant="inline"
                diagnosis={m.diagnosis}
                onRetry={m.retry}
                retryLabel="Ask again"
              />
            </div>
          ) : (
            <div key={i} className={`message ${m.role === "user" ? "user-message" : "ai-message"}`}>
              {m.text}
            </div>
          )
        ))}
        {loading && <div className="message ai-message"><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /></div>}
        <div ref={endRef} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {SUGGESTIONS.map((s) => (
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
  );
};

export default Copilot;
