import { Link } from "react-router-dom";
import {
  ShieldCheck,
  ArrowLeft,
  FileText,
  UserCheck,
  AlertTriangle,
  Scale,
} from "lucide-react";

const Terms = () => {
  const lastUpdated = "September 9, 2026";

  return (
    <div className="legal-page">
      <div className="legal-container">
        {/* Header */}
        <div className="legal-header">
          <Link to="/" className="legal-back">
            <ArrowLeft size={17} />
            Back to Home
          </Link>

          <div className="legal-brand">
            <ShieldCheck size={25} />
            <span>
              CivicAI <strong>Nexus</strong>
            </span>
          </div>

          <span className="legal-badge">Terms of Service</span>
        </div>

        {/* Hero */}
        <section className="legal-hero">
          <div className="legal-icon">
            <FileText size={30} />
          </div>

          <p className="legal-kicker">LEGAL DOCUMENT</p>

          <h1>Terms & Conditions</h1>

          <p>
            These terms describe the rules and responsibilities that apply
            when you access or use the CivicAI Nexus platform.
          </p>

          <span className="legal-updated">
            Last updated: {lastUpdated}
          </span>
        </section>

        {/* Content */}
        <main className="legal-content">
          <section className="legal-section">
            <h2>1. Acceptance of Terms</h2>

            <p>
              By accessing or using CivicAI Nexus, you agree to comply with
              these Terms & Conditions and applicable laws.
            </p>

            <p>
              If you do not agree with these terms, please do not use the
              platform.
            </p>
          </section>

          <section className="legal-section">
            <div className="legal-section-title">
              <UserCheck size={21} />
              <h2>2. User Accounts</h2>
            </div>

            <p>
              Certain CivicAI Nexus features require an account. You are
              responsible for providing accurate information and maintaining
              the security of your account credentials.
            </p>

            <ul>
              <li>Keep your password confidential.</li>
              <li>Do not share authentication codes.</li>
              <li>Provide accurate account information.</li>
              <li>Notify the platform team about unauthorized access.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>3. Civic Grievances</h2>

            <p>
              Users may submit civic grievances through the platform. Users
              should provide truthful, relevant, and accurate information.
            </p>

            <p>
              Do not submit intentionally false complaints, misleading
              information, spam, threats, or content designed to abuse the
              grievance system.
            </p>
          </section>

          <section className="legal-section">
            <h2>4. AI-Assisted Services</h2>

            <p>
              CivicAI Nexus may use artificial intelligence to analyze
              grievances and provide recommendations.
            </p>

            <p>
              AI classifications, summaries, priority predictions, suggested
              departments, and responses may contain errors. AI output should
              be treated as assistance rather than an unquestionable final
              decision.
            </p>
          </section>

          <section className="legal-section">
            <h2>5. Prohibited Activities</h2>

            <p>You agree not to:</p>

            <ul>
              <li>Attempt to gain unauthorized access to the platform.</li>
              <li>Submit fraudulent or intentionally misleading complaints.</li>
              <li>Upload malicious software or harmful content.</li>
              <li>Interfere with platform availability or security.</li>
              <li>Attempt to bypass authentication or access controls.</li>
              <li>Use the platform for unlawful activities.</li>
              <li>Abuse automated systems or APIs.</li>
            </ul>
          </section>

          <section className="legal-section">
            <div className="legal-section-title">
              <AlertTriangle size={21} />
              <h2>6. Content Responsibility</h2>
            </div>

            <p>
              You are responsible for the content and information you submit
              to CivicAI Nexus.
            </p>

            <p>
              Do not upload information that you do not have permission to
              share or that violates another person's rights.
            </p>
          </section>

          <section className="legal-section">
            <h2>7. Platform Availability</h2>

            <p>
              We aim to keep CivicAI Nexus available and reliable, but
              uninterrupted availability cannot be guaranteed.
            </p>

            <p>
              Maintenance, infrastructure failures, network issues, security
              incidents, or other circumstances may temporarily affect the
              service.
            </p>
          </section>

          <section className="legal-section">
            <h2>8. Intellectual Property</h2>

            <p>
              CivicAI Nexus software, branding, interface designs, and
              original platform materials may be protected by applicable
              intellectual property laws.
            </p>

            <p>
              Users may not copy, reproduce, modify, or redistribute protected
              platform components without appropriate permission.
            </p>
          </section>

          <section className="legal-section">
            <div className="legal-section-title">
              <Scale size={21} />
              <h2>9. Limitation of Liability</h2>
            </div>

            <p>
              CivicAI Nexus is intended to provide technology-assisted civic
              grievance management. The platform does not guarantee that every
              complaint will be resolved, accepted, or acted upon by a
              government department or other authority.
            </p>

            <p>
              Users should independently verify important information and
              decisions where appropriate.
            </p>
          </section>

          <section className="legal-section">
            <h2>10. Account Suspension</h2>

            <p>
              Access may be restricted or suspended if an account is used in a
              manner that violates these terms, compromises platform security,
              or abuses the grievance system.
            </p>
          </section>

          <section className="legal-section">
            <h2>11. Changes to These Terms</h2>

            <p>
              These Terms & Conditions may be updated periodically to reflect
              changes to the platform, legal requirements, or security
              practices.
            </p>

            <p>
              The updated version will replace the previous version when
              published on this page.
            </p>
          </section>

          <section className="legal-section">
            <h2>12. Contact</h2>

            <p>
              For questions regarding these terms, contact the CivicAI Nexus
              platform team.
            </p>

            <p> <strong>Email:</strong> support@civicai-nexus.com </p>
          </section>

          <section className="legal-notice">
            <strong>Important:</strong> These terms are a project-level
            template and should be reviewed by an appropriate legal
            professional before production use.
          </section>
        </main>

        {/* Bottom Navigation */}
        <div className="legal-bottom-nav">
          <Link to="/privacy-policy">Privacy Policy</Link>
          <Link to="/cookie-policy">Cookie Policy</Link>
          <Link to="/login">Sign In</Link>
        </div>
      </div>
    </div>
  );
};

export default Terms;