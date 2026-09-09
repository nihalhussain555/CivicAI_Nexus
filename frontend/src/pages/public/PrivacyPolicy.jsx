import { Link } from "react-router-dom";
import {
  ShieldCheck,
  ArrowLeft,
  LockKeyhole,
  Database,
  UserCheck,
  Mail,
} from "lucide-react";

const PrivacyPolicy = () => {
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

          <span className="legal-badge">Privacy & Security</span>
        </div>

        {/* Hero */}
        <section className="legal-hero">
          <div className="legal-icon">
            <LockKeyhole size={30} />
          </div>

          <p className="legal-kicker">LEGAL DOCUMENT</p>

          <h1>Privacy Policy</h1>

          <p>
            Your privacy matters to CivicAI Nexus. This policy explains what
            information we collect, how we use it, and how we protect it when
            you use our platform.
          </p>

          <span className="legal-updated">
            Last updated: {lastUpdated}
          </span>
        </section>

        {/* Content */}
        <main className="legal-content">
          <section className="legal-section">
            <h2>1. Introduction</h2>

            <p>
              CivicAI Nexus is a predictive multimodal grievance intelligence
              platform designed to help citizens submit, track, and manage
              civic complaints.
            </p>

            <p>
              By using CivicAI Nexus, you acknowledge that you have read and
              understood this Privacy Policy.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. Information We Collect</h2>

            <p>Depending on how you use the platform, we may collect:</p>

            <ul>
              <li>Name and email address.</li>
              <li>Phone number and profile information.</li>
              <li>Location or address information provided with a grievance.</li>
              <li>Complaint descriptions and uploaded evidence.</li>
              <li>Account authentication and verification information.</li>
              <li>Language preferences and communication preferences.</li>
              <li>Technical information required to operate the platform.</li>
            </ul>
          </section>

          <section className="legal-section">
            <div className="legal-section-title">
              <Database size={21} />
              <h2>3. How We Use Your Information</h2>
            </div>

            <p>Information may be used to:</p>

            <ul>
              <li>Create and maintain your CivicAI Nexus account.</li>
              <li>Verify your email address.</li>
              <li>Process and manage civic grievances.</li>
              <li>Automatically classify complaints.</li>
              <li>Predict complaint priority and urgency.</li>
              <li>Route complaints to appropriate departments.</li>
              <li>Provide AI-powered assistance and responses.</li>
              <li>Send important account and service notifications.</li>
              <li>Improve platform reliability and functionality.</li>
              <li>Detect abuse, fraud, or unauthorized activity.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>4. AI Processing</h2>

            <p>
              CivicAI Nexus uses artificial intelligence and machine learning
              technologies to assist with complaint classification,
              prioritization, summarization, duplicate detection, sentiment
              analysis, and other platform functions.
            </p>

            <p>
              AI-generated results are intended to assist users and civic
              authorities. They should not automatically be treated as final
              decisions without appropriate human review.
            </p>
          </section>

          <section className="legal-section">
            <h2>5. Information Sharing</h2>

            <p>
              We do not intend to sell your personal information. Information
              may be shared when necessary to operate the CivicAI Nexus
              service, process a grievance, provide requested functionality,
              comply with applicable law, or protect the security of users and
              the platform.
            </p>

            <p>
              Information contained in a grievance may be visible to
              authorized personnel responsible for handling that grievance.
            </p>
          </section>

          <section className="legal-section">
            <h2>6. Data Security</h2>

            <p>
              CivicAI Nexus uses reasonable technical and organizational
              safeguards to protect account information and platform data.
            </p>

            <ul>
              <li>Passwords are stored using secure password hashing.</li>
              <li>Email verification uses time-limited verification codes.</li>
              <li>Password reset links use time-limited secure tokens.</li>
              <li>Authentication uses secure access tokens.</li>
              <li>Access to protected information is restricted where appropriate.</li>
            </ul>

            <p>
              No internet-based system can guarantee absolute security.
              Users should also protect their account credentials and avoid
              sharing passwords or verification codes.
            </p>
          </section>

          <section className="legal-section">
            <div className="legal-section-title">
              <UserCheck size={21} />
              <h2>7. Your Rights</h2>
            </div>

            <p>
              Depending on applicable laws and the nature of your account, you
              may have rights regarding your personal information, including
              the ability to request access, correction, or deletion of
              certain information.
            </p>
          </section>

          <section className="legal-section">
            <h2>8. Data Retention</h2>

            <p>
              We retain information for as long as reasonably necessary to
              provide the platform, maintain records, comply with legal
              obligations, resolve disputes, and protect the service.
            </p>
          </section>

          <section className="legal-section">
            <h2>9. Third-Party Services</h2>

            <p>
              CivicAI Nexus may use third-party infrastructure and services
              such as cloud hosting, databases, email delivery providers, AI
              providers, analytics services, or authentication services.
            </p>

            <p>
              Such services may process information according to their own
              privacy policies and applicable agreements.
            </p>
          </section>

          <section className="legal-section">
            <h2>10. Children's Privacy</h2>

            <p>
              CivicAI Nexus is not intentionally designed to collect personal
              information from children without appropriate authorization.
              If you believe that information belonging to a child has been
              submitted improperly, please contact us.
            </p>
          </section>

          <section className="legal-section">
            <div className="legal-section-title">
              <Mail size={21} />
              <h2>11. Contact</h2>
            </div>

            <p>
              If you have questions about this Privacy Policy or how your
              information is handled, please contact the CivicAI Nexus
              platform team.
            </p>

            <p>
              <strong>Email:</strong> support@civicai-nexus.com
            </p>
          </section>

          <section className="legal-notice">
            <strong>Important:</strong> This Privacy Policy is a project-level
            privacy notice and should be reviewed by an appropriate legal
            professional before being used as the final legal policy for a
            production organization.
          </section>
        </main>

        {/* Bottom Navigation */}
        <div className="legal-bottom-nav">
          <Link to="/terms">Terms & Conditions</Link>
          <Link to="/cookie-policy">Cookie Policy</Link>
          <Link to="/login">Sign In</Link>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;