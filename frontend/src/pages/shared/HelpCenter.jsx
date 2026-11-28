import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bot, LifeBuoy, Mail } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import IssueReportDialog from "../../components/common/IssueReportDialog";

/*
 * Support lives here rather than as a loose icon in the topbar, where the button
 * was being clipped. The topics below are real routes in the app — an answer
 * that sends someone to a page that does not exist is worse than no answer.
 */

const TOPICS = {
  citizen: [
    { to: "/citizen/report", label: "Report a problem", note: "Add photos, pin the spot, and track it." },
    { to: "/citizen/grievances", label: "Track my complaint", note: "See which department holds it now." },
    { to: "/citizen/rewards", label: "Civic rewards", note: "How points and levels are earned." },
  ],
  officer: [
    { to: "/officer/grievances", label: "Work my queue", note: "Assigned cases and their deadlines." },
    { to: "/officer/integrity", label: "Integrity review", note: "Flagged complaints needing a second look." },
    { to: "/officer/analytics", label: "Department performance", note: "Clearance rates against SLA targets." },
  ],
  admin: [
    { to: "/admin/grievances", label: "All grievances", note: "Search and filter across the platform." },
    { to: "/admin/analytics", label: "Platform analytics", note: "Volume, routing accuracy, SLA health." },
    { to: "/admin/sla", label: "SLA management", note: "Targets and escalation rules per department." },
  ],
};

const SUPPORT_EMAIL = "support@civicai-nexus.com";

const HelpCenter = () => {
  const { user } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);

  const role = user?.role || "citizen";
  const topics = TOPICS[role] || TOPICS.citizen;
  const assistantPath = `/${role}/assistant`;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Help Center</h1>
          <p>Guidance on using the platform, and a way to tell us when something breaks.</p>
        </div>
      </div>

      <section className="help-report">
        <div className="help-report-text">
          <h2>
            <LifeBuoy size={18} /> Something not working?
          </h2>
          <p>
            Tell us what you were trying to do. What the app was doing at the time is attached
            automatically, so you do not have to describe the technical side.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setReportOpen(true)}>
          Report a problem
        </button>
      </section>

      <section className="help-section">
        <h2>Common tasks</h2>
        <div className="help-topics">
          {topics.map((topic) => (
            <Link key={topic.to} to={topic.to} className="help-topic">
              <span className="help-topic-label">{topic.label}</span>
              <span className="help-topic-note">{topic.note}</span>
              <ArrowRight size={15} className="help-topic-arrow" />
            </Link>
          ))}
        </div>
      </section>

      <section className="help-section">
        <h2>Ask instead of searching</h2>
        <div className="help-aside">
          <Link to={assistantPath} className="help-card">
            <Bot size={20} />
            <div>
              <strong>CivicAI assistant</strong>
              <p>
                Ask how reporting, routing, priority and timelines work. It answers in English,
                Tamil, Hindi or Malayalam.
              </p>
            </div>
            <ArrowRight size={16} />
          </Link>

          <a href={`mailto:${SUPPORT_EMAIL}`} className="help-card">
            <Mail size={20} />
            <div>
              <strong>{SUPPORT_EMAIL}</strong>
              <p>For anything that needs a person, including privacy or account requests.</p>
            </div>
            <ArrowRight size={16} />
          </a>
        </div>
      </section>

      {reportOpen && (
        <IssueReportDialog open={reportOpen} onClose={() => setReportOpen(false)} defaultFeature="unknown" />
      )}
    </div>
  );
};

export default HelpCenter;
