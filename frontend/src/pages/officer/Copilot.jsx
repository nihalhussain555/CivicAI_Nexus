import { useState, useRef, useEffect } from "react";
import { Bot, Send, Sparkles, Loader2 } from "lucide-react";
import { chatWithAssistant } from "../../services/aiService";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../utils/helpers";

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
  const toast = useToast();
  const endRef = useRef();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message) return;
    setMessages((m) => [...m, { role: "user", text: message }]);
    setInput("");
    setLoading(true);
    try {
      const res = await chatWithAssistant(message);
      setMessages((m) => [...m, { role: "assistant", text: res.data.response }]);
    } catch (error) {
      toast.error(getErrorMessage(error));
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
          <div key={i} className={`message ${m.role === "user" ? "user-message" : "ai-message"}`}>
            {m.text}
          </div>
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
