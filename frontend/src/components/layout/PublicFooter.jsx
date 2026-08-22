import { ShieldCheck } from "lucide-react";

const PublicFooter = () => (
  <footer className="footer">
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
      <ShieldCheck size={16} /> CivicAI Nexus
    </div>
    <span>© {new Date().getFullYear()} CivicAI Nexus — Predictive Multimodal Grievance Intelligence Platform</span>
  </footer>
);

export default PublicFooter;
