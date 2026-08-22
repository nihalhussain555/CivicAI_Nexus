import { Target, Users2, Sparkles, ShieldCheck } from "lucide-react";
import PublicNavbar from "../../components/layout/PublicNavbar";
import PublicFooter from "../../components/layout/PublicFooter";

const About = () => (
  <div>
    <PublicNavbar />
    <section className="section" style={{ paddingTop: 80 }}>
      <div className="section-heading">
        <h2>About CivicAI Nexus</h2>
        <p>
          A predictive, multimodal grievance intelligence platform built to close the loop between
          citizens and the departments responsible for public infrastructure.
        </p>
      </div>

      <div className="grid grid-2" style={{ maxWidth: 900, margin: "0 auto 50px" }}>
        <div className="feature">
          <div className="feature-icon"><Target size={20} /></div>
          <h3>Our mission</h3>
          <p>
            Civic issues are reported every day, but too often disappear into disconnected systems.
            CivicAI Nexus gives every report a clear owner, a predicted timeline, and a citizen who
            can verify the outcome — so nothing gets lost.
          </p>
        </div>
        <div className="feature">
          <div className="feature-icon"><Sparkles size={20} /></div>
          <h3>How AI helps, responsibly</h3>
          <p>
            AI classifies, prioritizes, and drafts recommendations — but never takes action on its own.
            Every prediction is clearly labeled as AI-generated, and officers must explicitly review
            and accept AI suggestions before anything happens.
          </p>
        </div>
        <div className="feature">
          <div className="feature-icon"><Users2 size={20} /></div>
          <h3>Community-first design</h3>
          <p>
            When many citizens report the same underlying problem, CivicAI groups those reports into
            a single incident — so departments fix root causes instead of chasing duplicate tickets.
          </p>
        </div>
        <div className="feature">
          <div className="feature-icon"><ShieldCheck size={20} /></div>
          <h3>Built on trust</h3>
          <p>
            Role-based access, audit logging, and secure authentication ensure every action on the
            platform is accountable — from a citizen's first report to an officer's final resolution.
          </p>
        </div>
      </div>
    </section>
    <PublicFooter />
  </div>
);

export default About;
