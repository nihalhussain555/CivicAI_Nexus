import { Link } from "react-router-dom";
import {
  Bot, Mic, Languages, ShieldCheck, ArrowRight, MapPin, Users2,
  BarChart3, CheckCircle2, Sparkles,
} from "lucide-react";
import PublicNavbar from "../../components/layout/PublicNavbar";
import PublicFooter from "../../components/layout/PublicFooter";

function Landing() {
  return (
    <div>
      <PublicNavbar />

      <section className="hero">
        <div className="hero-content">
          <span className="badge-pill">
            <Sparkles size={13} /> AI-powered civic grievance resolution
          </span>
          <h1>
            Report it once. <span>AI takes it from there.</span>
          </h1>
          <p>
            CivicAI Nexus understands, prioritizes, and routes every citizen report automatically —
            from a pothole to a waterlogging crisis affecting an entire neighborhood — and tracks it
            until you confirm it's actually fixed.
          </p>
          <div className="hero-buttons">
            <Link to="/register" className="primary-button">
              Report an issue <ArrowRight size={16} />
            </Link>
            <Link to="/how-it-works" className="secondary-button">
              See how it works
            </Link>
          </div>
        </div>

        <div className="hero-card">
          <div className="ai-header">
            <div className="ai-icon"><Bot size={20} /></div>
            <div>
              <strong>AI Analysis</strong>
              <small>Live preview, before you submit</small>
            </div>
          </div>
          <div className="message user-message">
            "Garbage hasn't been collected on Anna Nagar 4th Avenue for a week."
          </div>
          <div className="message ai-message">
            Classified as <strong>Waste · High priority</strong>. Routed to Sanitation Department.
            3 similar reports nearby — possible community incident. Estimated resolution: 36h.
          </div>
        </div>
      </section>

      <section className="section" id="features">
        <div className="section-heading">
          <h2>Every report, understood instantly</h2>
          <p>Text, voice, or photo — in English, Hindi, or Tamil. The AI pipeline handles the rest.</p>
        </div>
        <div className="features">
          <div className="feature">
            <div className="feature-icon"><Mic size={20} /></div>
            <h3>Multimodal reporting</h3>
            <p>Speak, type, or attach a photo with your location — whatever's fastest for you.</p>
          </div>
          <div className="feature">
            <div className="feature-icon"><Languages size={20} /></div>
            <h3>Multilingual by default</h3>
            <p>Report in Tamil, Hindi, or English. The AI detects and translates automatically.</p>
          </div>
          <div className="feature">
            <div className="feature-icon"><Users2 size={20} /></div>
            <h3>Community incident detection</h3>
            <p>Nearby reports of the same issue are automatically clustered so root causes get fixed.</p>
          </div>
          <div className="feature">
            <div className="feature-icon"><BarChart3 size={20} /></div>
            <h3>Predictive SLA tracking</h3>
            <p>AI estimates resolution time and flags cases at risk of missing their deadline.</p>
          </div>
          <div className="feature">
            <div className="feature-icon"><ShieldCheck size={20} /></div>
            <h3>Transparent, always labeled</h3>
            <p>Every AI prediction is clearly marked as AI-generated — never presented as fact.</p>
          </div>
          <div className="feature">
            <div className="feature-icon"><MapPin size={20} /></div>
            <h3>Live city map</h3>
            <p>Officers and admins see every grievance and incident plotted geographically.</p>
          </div>
        </div>
      </section>

      <section className="section" id="roles" style={{ background: "var(--surface-hover)", maxWidth: "none", padding: "70px 7%" }}>
        <div className="section-heading">
          <h2>Built for every role in the loop</h2>
          <p>One platform, three purpose-built workspaces.</p>
        </div>
        <div className="role-cards">
          <div className="role-card">
            <h3>Citizens</h3>
            <p>Report issues in seconds and track them to resolution.</p>
            <ul>
              <li><CheckCircle2 size={14} /> Submit via text, voice, or photo</li>
              <li><CheckCircle2 size={14} /> See AI analysis before submitting</li>
              <li><CheckCircle2 size={14} /> Verify or reopen resolutions</li>
            </ul>
          </div>
          <div className="role-card">
            <h3>Officers</h3>
            <p>Work a prioritized queue with an AI Copilot at your side.</p>
            <ul>
              <li><CheckCircle2 size={14} /> AI-ranked priority queue</li>
              <li><CheckCircle2 size={14} /> Case summaries & risk assessment</li>
              <li><CheckCircle2 size={14} /> Accept or modify every suggestion</li>
            </ul>
          </div>
          <div className="role-card">
            <h3>Admins</h3>
            <p>Full visibility into departments, incidents, and SLA health.</p>
            <ul>
              <li><CheckCircle2 size={14} /> City-wide live map</li>
              <li><CheckCircle2 size={14} /> Department performance analytics</li>
              <li><CheckCircle2 size={14} /> AI-predicted escalation risk</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section" id="how-it-works">
        <div className="section-heading">
          <h2>From report to resolution</h2>
          <p>A single grievance moves through a clear, trackable lifecycle.</p>
        </div>
        <div className="steps">
          <div className="step">
            <div className="step-number">01</div>
            <h3>Report</h3>
            <p>Describe the issue with text, voice, a photo, and your location.</p>
          </div>
          <div className="step">
            <div className="step-number">02</div>
            <h3>AI analysis</h3>
            <p>Classified, prioritized, and routed to the right department in seconds.</p>
          </div>
          <div className="step">
            <div className="step-number">03</div>
            <h3>Officer action</h3>
            <p>An officer accepts the case, guided by an AI Copilot, and resolves it.</p>
          </div>
          <div className="step">
            <div className="step-number">04</div>
            <h3>You verify</h3>
            <p>Confirm the fix — or reopen it if the issue isn't actually resolved.</p>
          </div>
        </div>
      </section>

      <section className="section" style={{ textAlign: "center" }}>
        <div className="section-heading" style={{ marginBottom: 28 }}>
          <h2>Ready to report your first issue?</h2>
          <p>It takes less than a minute, and you'll be able to track it the whole way.</p>
        </div>
        <Link to="/register" className="primary-button" style={{ display: "inline-flex" }}>
          Get started <ArrowRight size={16} />
        </Link>
      </section>

      <PublicFooter />
    </div>
  );
}

export default Landing;
