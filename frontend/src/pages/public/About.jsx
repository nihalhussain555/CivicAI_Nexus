import {
  Target,
  Users2,
  Sparkles,
  ShieldCheck,
  BrainCircuit,
  Globe2,
  Route,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Building2,
  Languages,
} from "lucide-react";
import { Link } from "react-router-dom";

import PublicNavbar from "../../components/layout/PublicNavbar";
import PublicFooter from "../../components/layout/PublicFooter";

const CAPABILITIES = [
  {
    icon: BrainCircuit,
    title: "AI-Powered Intelligence",
    body: "Automatically analyze grievances, identify intent, classify departments, estimate urgency, and generate useful summaries.",
  },
  {
    icon: Languages,
    title: "Multilingual Access",
    body: "Citizens can communicate through supported languages such as English, Tamil, and Hindi for a more accessible reporting experience.",
  },
  {
    icon: Route,
    title: "Smart Routing",
    body: "AI recommends the most relevant department so complaints can reach the right team faster.",
  },
  {
    icon: BarChart3,
    title: "Predictive Insights",
    body: "Priority and urgency predictions help officers focus their attention on complaints that require faster action.",
  },
];

const PRINCIPLES = [
  {
    icon: Target,
    title: "Our Mission",
    body: "Turn fragmented civic complaints into an accountable workflow where every report has a clear owner, status, priority, and path toward resolution.",
  },
  {
    icon: Sparkles,
    title: "Responsible AI",
    body: "AI assists citizens and officers rather than replacing human judgment. Predictions and recommendations remain reviewable before action is taken.",
  },
  {
    icon: Users2,
    title: "Community First",
    body: "Multiple reports describing the same underlying problem can be connected to help departments identify recurring issues and focus on root causes.",
  },
  {
    icon: ShieldCheck,
    title: "Built on Trust",
    body: "Secure authentication, role-based access, verification workflows, and accountable actions help create a safer civic platform.",
  },
];

const FLOW = [
  "Citizen reports an issue",
  "AI understands the grievance",
  "Priority and department are predicted",
  "Officer reviews and acts",
  "Citizen verifies the outcome",
];

const About = () => {
  return (
    <div className="about-page">
      <PublicNavbar />

      {/* Hero */}
      <section
        className="section"
        style={{
          paddingTop: 90,
          paddingBottom: 70,
        }}
      >
        <div
          style={{
            maxWidth: 850,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <div
            className="feature-icon"
            style={{
              margin: "0 auto 20px",
              width: 64,
              height: 64,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BrainCircuit size={30} />
          </div>

          <span
            style={{
              display: "inline-block",
              marginBottom: 12,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--primary, #7c3aed)",
            }}
          >
            AI FOR BETTER CIVIC SERVICES
          </span>

          <h1
            style={{
              fontSize: "clamp(38px, 6vw, 64px)",
              lineHeight: 1.05,
              letterSpacing: "-0.045em",
              marginBottom: 22,
            }}
          >
            Making every civic complaint{" "}
            <span style={{ color: "var(--primary, #7c3aed)" }}>
              easier to understand and act on.
            </span>
          </h1>

          <p
            style={{
              maxWidth: 720,
              margin: "0 auto",
              color: "var(--text-muted)",
              fontSize: 16,
              lineHeight: 1.8,
            }}
          >
            CivicAI Nexus is a predictive, multimodal grievance intelligence
            platform that connects citizens, AI, and civic departments through
            one transparent workflow.
          </p>
        </div>
      </section>

      {/* What is CivicAI */}
      <section
        className="section"
        style={{
          paddingTop: 30,
          paddingBottom: 80,
        }}
      >
        <div
          className="grid grid-2"
          style={{
            maxWidth: 1000,
            margin: "0 auto",
            alignItems: "stretch",
          }}
        >
          <div
            className="card"
            style={{
              padding: 30,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div className="feature-icon">
              <Globe2 size={21} />
            </div>

            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.12em",
                color: "var(--primary, #7c3aed)",
              }}
            >
              THE PROBLEM
            </span>

            <h2 style={{ marginTop: 10, marginBottom: 12 }}>
              Civic problems are everywhere.
            </h2>

            <p
              style={{
                color: "var(--text-muted)",
                lineHeight: 1.75,
                fontSize: 14,
              }}
            >
              Broken roads, overflowing waste, water problems, streetlights,
              public infrastructure issues, and other civic concerns are
              reported every day. But fragmented workflows can make it
              difficult to identify patterns, prioritize urgent cases, and
              keep citizens informed.
            </p>
          </div>

          <div
            className="card"
            style={{
              padding: 30,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div className="feature-icon">
              <Sparkles size={21} />
            </div>

            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.12em",
                color: "var(--primary, #7c3aed)",
              }}
            >
              OUR APPROACH
            </span>

            <h2 style={{ marginTop: 10, marginBottom: 12 }}>
              Intelligence turns reports into action.
            </h2>

            <p
              style={{
                color: "var(--text-muted)",
                lineHeight: 1.75,
                fontSize: 14,
              }}
            >
              CivicAI Nexus adds an intelligence layer to the grievance
              lifecycle. It can understand multimodal reports, classify their
              intent, predict priority, recommend departments, detect similar
              incidents, and provide useful information to the people handling
              the case.
            </p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section
        className="section"
        style={{
          paddingTop: 20,
          paddingBottom: 80,
        }}
      >
        <div className="section-heading">
          <span
            style={{
              color: "var(--primary, #7c3aed)",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.13em",
            }}
          >
            WHAT WE STAND FOR
          </span>

          <h2>Designed around people, accountability, and intelligence.</h2>

          <p>
            CivicAI Nexus is built around four principles that guide the
            platform from reporting to resolution.
          </p>
        </div>

        <div
          className="grid grid-2"
          style={{
            maxWidth: 950,
            margin: "0 auto",
          }}
        >
          {PRINCIPLES.map(({ icon: Icon, title, body }) => (
            <div
              className="feature"
              key={title}
              style={{
                height: "100%",
              }}
            >
              <div className="feature-icon">
                <Icon size={20} />
              </div>

              <h3>{title}</h3>

              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Capabilities */}
      <section
        className="section"
        style={{
          paddingTop: 20,
          paddingBottom: 80,
        }}
      >
        <div className="section-heading">
          <span
            style={{
              color: "var(--primary, #7c3aed)",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.13em",
            }}
          >
            PLATFORM CAPABILITIES
          </span>

          <h2>One platform. Multiple layers of intelligence.</h2>

          <p>
            From understanding a citizen's message to helping officers make
            better decisions.
          </p>
        </div>

        <div
          className="grid grid-2"
          style={{
            maxWidth: 950,
            margin: "0 auto",
          }}
        >
          {CAPABILITIES.map(({ icon: Icon, title, body }) => (
            <div
              className="card"
              key={title}
              style={{
                padding: 26,
              }}
            >
              <div className="feature-icon">
                <Icon size={20} />
              </div>

              <h3 style={{ marginBottom: 8 }}>{title}</h3>

              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: 13.5,
                  lineHeight: 1.7,
                }}
              >
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section
        className="section"
        style={{
          paddingTop: 20,
          paddingBottom: 80,
        }}
      >
        <div
          className="card"
          style={{
            maxWidth: 1000,
            margin: "0 auto",
            padding: "35px 30px",
          }}
        >
          <div className="section-heading" style={{ marginBottom: 35 }}>
            <span
              style={{
                color: "var(--primary, #7c3aed)",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.13em",
              }}
            >
              THE CIVICAI LOOP
            </span>

            <h2>From report to verified resolution.</h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 16,
            }}
          >
            {FLOW.map((item, index) => (
              <div
                key={item}
                style={{
                  textAlign: "center",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    margin: "0 auto 12px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(124, 58, 237, 0.1)",
                    color: "var(--primary, #7c3aed)",
                    fontWeight: 800,
                    fontSize: 14,
                  }}
                >
                  {String(index + 1).padStart(2, "0")}
                </div>

                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    lineHeight: 1.55,
                    color: "var(--text-muted)",
                  }}
                >
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section
        className="section"
        style={{
          paddingTop: 20,
          paddingBottom: 90,
        }}
      >
        <div
          style={{
            maxWidth: 850,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <div
            className="feature-icon"
            style={{
              margin: "0 auto 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Building2 size={21} />
          </div>

          <h2 style={{ marginBottom: 12 }}>
            Technology should strengthen public service.
          </h2>

          <p
            style={{
              maxWidth: 680,
              margin: "0 auto 24px",
              color: "var(--text-muted)",
              lineHeight: 1.75,
              fontSize: 14,
            }}
          >
            CivicAI Nexus is designed to make civic grievance management more
            transparent, intelligent, and citizen-centered while keeping
            humans responsible for important decisions.
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 20,
              flexWrap: "wrap",
              marginBottom: 28,
            }}
          >
            {[
              "Human-reviewed AI",
              "Multilingual",
              "Secure authentication",
              "Transparent workflow",
            ].map((item) => (
              <span
                key={item}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                <CheckCircle2
                  size={15}
                  color="var(--primary, #7c3aed)"
                />
                {item}
              </span>
            ))}
          </div>

          <Link
            to="/how-it-works"
            className="primary-button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            See how it works
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default About;