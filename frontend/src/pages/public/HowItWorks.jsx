import { Link } from "react-router-dom";
import { ArrowRight, Mic, Sparkles, UserCheck, CheckCircle2 } from "lucide-react";
import PublicNavbar from "../../components/layout/PublicNavbar";
import PublicFooter from "../../components/layout/PublicFooter";

const STEPS = [
  {
    icon: Mic,
    title: "1. Report the issue",
    body: "Describe what's wrong using text, your voice, or a photo — in English, Hindi, or Tamil. Add your location so it reaches the right team.",
  },
  {
    icon: Sparkles,
    title: "2. AI analyzes it",
    body: "In seconds, AI classifies the category, estimates severity and urgency, checks for duplicate or similar nearby reports, and recommends the department to route it to. You review this before submitting.",
  },
  {
    icon: UserCheck,
    title: "3. An officer takes it on",
    body: "The case lands in the right department's priority queue. An officer accepts it, guided by an AI Copilot that summarizes the case and suggests next steps — which the officer can accept or modify.",
  },
  {
    icon: CheckCircle2,
    title: "4. You confirm the fix",
    body: "Once the officer marks it resolved, you're asked to verify. If it's genuinely fixed, it closes. If not, it reopens and goes straight back to the department.",
  },
];

const HowItWorks = () => (
  <div>
    <PublicNavbar />
    <section className="section" style={{ paddingTop: 80 }}>
      <div className="section-heading">
        <h2>How CivicAI Nexus works</h2>
        <p>From the moment you report an issue to the moment it's verified fixed.</p>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        {STEPS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="card" style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
            <div className="feature-icon" style={{ marginBottom: 0, flexShrink: 0 }}><Icon size={20} /></div>
            <div>
              <h3 style={{ marginBottom: 6, fontSize: 16 }}>{title}</h3>
              <p style={{ color: "var(--text-muted)", fontSize: 13.5, lineHeight: 1.65 }}>{body}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", marginTop: 50 }}>
        <Link to="/register" className="primary-button" style={{ display: "inline-flex" }}>
          Report your first issue <ArrowRight size={16} />
        </Link>
      </div>
    </section>
    <PublicFooter />
  </div>
);

export default HowItWorks;
