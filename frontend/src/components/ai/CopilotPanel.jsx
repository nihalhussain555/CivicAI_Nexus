import { Bot, RefreshCcw } from "lucide-react";
import LoadingSpinner from "../common/LoadingSpinner";
import { toDisplayText } from "../../utils/helpers";

const CopilotPanel = ({ brief, loading, onRefresh }) => {
  return (
    <div className="card" style={{ borderColor: "var(--accent)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Bot size={16} color="var(--accent)" />
          <strong style={{ fontSize: 14 }}>AI Copilot</strong>
        </div>
        <button className="icon-button" onClick={onRefresh} aria-label="Refresh Copilot brief" disabled={loading}>
          <RefreshCcw size={14} />
        </button>
      </div>

      {loading ? (
        <div style={{ padding: "20px 0" }}><LoadingSpinner label="Generating brief..." /></div>
      ) : brief && typeof brief === "object" && !Array.isArray(brief) ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: 13.5 }}>
          <div>
            <div className="ai-tag" style={{ marginBottom: 6 }}>Case summary</div>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>{toDisplayText(brief.case_summary)}</p>
          </div>
          <div>
            <div className="ai-tag" style={{ marginBottom: 6 }}>Risk assessment</div>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>{toDisplayText(brief.risk_assessment)}</p>
          </div>
          {Array.isArray(brief.similar_cases) && brief.similar_cases.length > 0 && (
            <div>
              <div className="ai-tag" style={{ marginBottom: 6 }}>Similar cases</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {brief.similar_cases.map((id) => (
                  <span key={String(id)} className="badge badge-neutral">{toDisplayText(id)}</span>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="ai-tag" style={{ marginBottom: 6 }}>Recommended action</div>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>{toDisplayText(brief.recommended_action)}</p>
          </div>
          <div>
            <div className="ai-tag" style={{ marginBottom: 6 }}>Suggested citizen response</div>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.6, fontStyle: "italic" }}>
              "{toDisplayText(brief.suggested_citizen_response)}"
            </p>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--text-faint)", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            AI-generated — review before acting. You must explicitly accept or modify these suggestions.
          </p>
        </div>
      ) : (
        <div className="ai-response-empty" role="status"><p>AI description could not be generated. Please try again.</p></div>
      )}
    </div>
  );
};

export default CopilotPanel;
