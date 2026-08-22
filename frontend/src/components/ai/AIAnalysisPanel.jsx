import { Sparkles, MapPin, Clock, ShieldAlert, Layers } from "lucide-react";
import PriorityBadge from "../grievances/PriorityBadge";
import { CATEGORY_LABELS } from "../../utils/constants";

const AIAnalysisPanel = ({ analysis }) => {
  if (!analysis) return null;

  return (
    <div className="card" style={{ borderColor: "var(--accent)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} color="var(--accent)" />
          <strong style={{ fontSize: 14 }}>AI Analysis</strong>
        </div>
        <span className="ai-tag">AI generated · not final</span>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Category</div>
          <div style={{ fontWeight: 700 }}>{CATEGORY_LABELS[analysis.category] || analysis.category}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Priority</div>
          <PriorityBadge priority={analysis.priority} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Severity</div>
          <PriorityBadge priority={analysis.severity} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>AI Confidence</div>
          <div style={{ fontWeight: 700 }}>{Math.round((analysis.confidence || 0) * 100)}%</div>
        </div>
      </div>

      {analysis.ai_summary && (
        <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.6 }}>
          {analysis.ai_summary}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <MapPin size={14} style={{ marginTop: 2, flexShrink: 0, color: "var(--text-faint)" }} />
          <span>Will be routed to <strong>{analysis.department || analysis.recommended_department}</strong></span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <Clock size={14} style={{ marginTop: 2, flexShrink: 0, color: "var(--text-faint)" }} />
          <span>Estimated resolution: <strong>~{analysis.predicted_resolution_hours}h</strong></span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <ShieldAlert size={14} style={{ marginTop: 2, flexShrink: 0, color: "var(--text-faint)" }} />
          <span>Escalation risk: <strong>{analysis.escalation_risk}</strong></span>
        </div>
        {analysis.duplicate && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <Layers size={14} style={{ marginTop: 2, flexShrink: 0, color: "var(--warning)" }} />
            <span>This looks similar to a report you already filed ({analysis.duplicate_of}).</span>
          </div>
        )}
        {analysis.similar_cases?.length > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <Layers size={14} style={{ marginTop: 2, flexShrink: 0, color: "var(--text-faint)" }} />
            <span>{analysis.similar_cases.length} similar case(s) nearby — may be part of a community incident.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAnalysisPanel;
