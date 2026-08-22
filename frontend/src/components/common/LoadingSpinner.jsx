import { Loader2 } from "lucide-react";

const LoadingSpinner = ({ size = 28, label }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: "var(--text-muted)" }}>
    <Loader2 size={size} className="spin" style={{ animation: "spin 0.8s linear infinite" }} />
    {label && <span style={{ fontSize: 13 }}>{label}</span>}
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export default LoadingSpinner;
