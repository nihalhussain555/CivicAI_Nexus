import { Link } from "react-router-dom";
import {
  ShieldCheck,
  ArrowLeft,
  Cookie,
  Settings,
  BarChart3,
  Shield,
} from "lucide-react";

const CookiePolicy = () => {
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

          <span className="legal-badge">Cookies</span>
        </div>

        {/* Hero */}
        <section className="legal-hero">
          <div className="legal-icon">
            <Cookie size={30} />
          </div>

          <p className="legal-kicker">LEGAL DOCUMENT</p>

          <h1>Cookie Policy</h1>

          <p>
            This policy explains how CivicAI Nexus may use cookies and similar
            technologies to operate and improve the platform.
          </p>

          <span className="legal-updated">
            Last updated: {lastUpdated}
          </span>
        </section>

        {/* Content */}
        <main className="legal-content">
          <section className="legal-section">
            <h2>1. What Are Cookies?</h2>

            <p>
              Cookies are small pieces of information stored by a website or
              application in your browser or device. They can help websites
              remember settings, maintain sessions, and understand how
              features are being used.
            </p>
          </section>

          <section className="legal-section">
            <div className="legal-section-title">
              <Settings size={21} />
              <h2>2. How CivicAI Nexus Uses Cookies</h2>
            </div>

            <p>Cookies or similar technologies may be used to:</p>

            <ul>
              <li>Keep users signed in where applicable.</li>
              <li>Maintain authentication sessions.</li>
              <li>Remember user preferences.</li>
              <li>Support security features.</li>
              <li>Improve website performance.</li>
              <li>Understand how platform features are used.</li>
            </ul>
          </section>

          <section className="legal-section">
            <div className="legal-section-title">
              <Shield size={21} />
              <h2>3. Essential Technologies</h2>
            </div>

            <p>
              Some storage mechanisms may be necessary for the platform to
              function correctly. These may include authentication information
              and user preferences.
            </p>

            <p>
              Disabling essential technologies may prevent some CivicAI Nexus
              features from working correctly.
            </p>
          </section>

          <section className="legal-section">
            <h2>4. Authentication Storage</h2>

            <p>
              CivicAI Nexus may use browser storage mechanisms to maintain
              authentication state and remember information needed by the
              application.
            </p>

            <p>
              Authentication information should never be intentionally shared
              with another person or stored on an untrusted device.
            </p>
          </section>

          <section className="legal-section">
            <div className="legal-section-title">
              <BarChart3 size={21} />
              <h2>5. Analytics</h2>
            </div>

            <p>
              If analytics services are enabled in a particular deployment,
              they may use cookies or similar technologies to collect
              aggregated information about website usage.
            </p>

            <p>
              Analytics should be configured according to the applicable
              privacy requirements of the deployment.
            </p>
          </section>

          <section className="legal-section">
            <h2>6. Third-Party Services</h2>

            <p>
              Some third-party services integrated into CivicAI Nexus may use
              their own cookies or similar technologies. Their use of such
              technologies is governed by their respective policies.
            </p>
          </section>

          <section className="legal-section">
            <h2>7. Managing Cookies</h2>

            <p>
              Most modern browsers allow you to control or delete cookies
              through browser settings.
            </p>

            <p>
              You can usually find these controls under your browser's
              privacy, security, or site settings.
            </p>

            <p>
              Blocking certain cookies or browser storage mechanisms may
              affect authentication and other application functionality.
            </p>
          </section>

          <section className="legal-section">
            <h2>8. Updates to This Policy</h2>

            <p>
              This Cookie Policy may be updated when CivicAI Nexus changes its
              technologies, integrations, or privacy practices.
            </p>
          </section>

          <section className="legal-section">
            <h2>9. Contact</h2>

            <p>
              If you have questions about cookies or similar technologies used
              by CivicAI Nexus, please contact the platform team.
            </p>

            <p>
              <strong>Email:</strong> support@civicai-nexus.com
            </p>
          </section>

          <section className="legal-notice">
            <strong>Important:</strong> This Cookie Policy is a project-level
            template and should be reviewed before production deployment,
            particularly if analytics, advertising, or third-party tracking
            services are introduced.
          </section>
        </main>

        {/* Bottom Navigation */}
        <div className="legal-bottom-nav">
          <Link to="/privacy-policy">Privacy Policy</Link>
          <Link to="/terms">Terms & Conditions</Link>
          <Link to="/login">Sign In</Link>
        </div>
      </div>
    </div>
  );
};

export default CookiePolicy;