import { Link } from "react-router-dom";

const PublicFooter = () => (
  <footer className="footer">
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontWeight: 700,
      }}
    >
      <img src="/logo.png" alt="" style={{ width: 18, height: 18, objectFit: "contain" }} />
      CivicAI Nexus
    </div>

    <span>
      © {new Date().getFullYear()} CivicAI Nexus — Predictive Multimodal
      Grievance Intelligence Platform
    </span>

    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
      aria-label="Legal links"
    >
      <Link to="/privacy-policy">Privacy Policy</Link>

      <Link to="/terms">Terms & Conditions</Link>

      <Link to="/cookie-policy">Cookie Policy</Link>
    </nav>
  </footer>
);

export default PublicFooter;