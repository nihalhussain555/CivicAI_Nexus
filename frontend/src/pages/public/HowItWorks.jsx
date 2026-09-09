import { Link } from "react-router-dom";
import {
  ArrowRight,
  Mic,
  Sparkles,
  UserCheck,
  CheckCircle2,
  MapPin,
  BrainCircuit,
  Route,
  Bell,
  RefreshCcw,
  ShieldCheck,
  MessageSquareText,
  Camera,
} from "lucide-react";

import PublicNavbar from "../../components/layout/PublicNavbar";
import PublicFooter from "../../components/layout/PublicFooter";

const STEPS = [
  {
    number: "01",
    icon: Mic,
    title: "Report the issue",
    body: "Describe the problem using text, voice, or a photo. Add the relevant location and information so the grievance contains enough context for analysis.",
    tags: ["Text", "Voice", "Photo"],
  },
  {
    number: "02",
    icon: BrainCircuit,
    title: "AI understands the complaint",
    body: "CivicAI analyzes the submitted information to understand the issue, identify its category, summarize the complaint, and extract useful signals.",
    tags: ["Intent", "Category", "Summary"],
  },
  {
    number: "03",
    icon: Sparkles,
    title: "Priority is predicted",
    body: "The platform estimates the urgency and priority of the grievance so potentially critical issues can receive appropriate attention.",
    tags: ["Urgency", "Priority", "Severity"],
  },
  {
    number: "04",
    icon: Route,
    title: "The right department is recommended",
    body: "AI recommends the department best suited to handle the issue. Similar or duplicate reports can also be identified to improve incident-level coordination.",
    tags: ["Department", "Duplicate Detection", "Routing"],
  },
  {
    number: "05",
    icon: UserCheck,
    title: "An officer reviews the case",
    body: "The grievance enters the appropriate workflow. Officers can review the complaint, AI insights, location, evidence, and suggested next steps before taking action.",
    tags: ["Human Review", "AI Copilot", "Case Management"],
  },
  {
    number: "06",
    icon: CheckCircle2,
    title: "The citizen verifies the outcome",
    body: "When the issue is marked resolved, the citizen can verify the outcome. If the problem remains unresolved, the case can be reopened for further action.",
    tags: ["Resolution", "Verification", "Reopen"],
  },
];

const AI_FEATURES = [
  {
    icon: MessageSquareText,
    title: "Natural language understanding",
    text: "Understands citizen descriptions and extracts meaningful information from complaints.",
  },
  {
    icon: Sparkles,
    title: "Priority prediction",
    text: "Helps identify complaints that may require faster attention.",
  },
  {
    icon: Route,
    title: "Department classification",
    text: "Recommends the department most relevant to the reported issue.",
  },
  {
    icon: RefreshCcw,
    title: "Duplicate detection",
    text: "Connects similar reports so recurring problems can be viewed together.",
  },
];

const HowItWorks = () => {
  return (
    <div className="how-it-works-page">
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
            <Sparkles size={29} />
          </div>

          <span
            style={{
              display: "inline-block",
              marginBottom: 12,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.14em",
              color: "var(--primary, #7c3aed)",
            }}
          >
            FROM REPORT TO RESOLUTION
          </span>

          <h1
            style={{
              fontSize: "clamp(38px, 6vw, 62px)",
              lineHeight: 1.05,
              letterSpacing: "-0.045em",
              marginBottom: 22,
            }}
          >
            See how{" "}
            <span style={{ color: "var(--primary, #7c3aed)" }}>
              CivicAI Nexus
            </span>{" "}
            works.
          </h1>

          <p
            style={{
              maxWidth: 700,
              margin: "0 auto",
              color: "var(--text-muted)",
              fontSize: 16,
              lineHeight: 1.8,
            }}
          >
            A civic grievance moves through a structured workflow where AI
            assists with understanding, prioritization, and routing while
            people remain responsible for decisions and resolution.
          </p>
        </div>
      </section>

      {/* Quick visual flow */}
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
            maxWidth: 1050,
            margin: "0 auto",
            padding: "30px 25px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(130px, 1fr))",
              gap: 12,
              alignItems: "center",
            }}
          >
            {[
              { icon: Mic, label: "Report" },
              { icon: BrainCircuit, label: "Understand" },
              { icon: Sparkles, label: "Predict" },
              { icon: Route, label: "Route" },
              { icon: UserCheck, label: "Resolve" },
              { icon: CheckCircle2, label: "Verify" },
            ].map(({ icon: Icon, label }, index, array) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div className="feature-icon" style={{ marginBottom: 0 }}>
                    <Icon size={18} />
                  </div>

                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {label}
                  </span>
                </div>

                {index < array.length - 1 && (
                  <ArrowRight
                    size={15}
                    style={{
                      opacity: 0.35,
                      flexShrink: 0,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Detailed Steps */}
      <section
        className="section"
        style={{
          paddingTop: 10,
          paddingBottom: 90,
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
            THE WORKFLOW
          </span>

          <h2>Six steps from complaint to closure.</h2>

          <p>
            Every stage is designed to make the grievance easier to understand,
            route, manage, and verify.
          </p>
        </div>

        <div
          style={{
            maxWidth: 850,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          {STEPS.map(
            ({ number, icon: Icon, title, body, tags }, index) => (
              <div
                key={title}
                className="card"
                style={{
                  display: "flex",
                  gap: 22,
                  alignItems: "flex-start",
                  padding: 25,
                  position: "relative",
                }}
              >
                {/* Number */}
                <div
                  style={{
                    width: 48,
                    height: 48,
                    minWidth: 48,
                    borderRadius: 15,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(124, 58, 237, 0.1)",
                    color: "var(--primary, #7c3aed)",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {number}
                </div>

                {/* Icon */}
                <div
                  className="feature-icon"
                  style={{
                    marginBottom: 0,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={20} />
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      marginBottom: 8,
                      fontSize: 17,
                    }}
                  >
                    {title}
                  </h3>

                  <p
                    style={{
                      color: "var(--text-muted)",
                      fontSize: 13.5,
                      lineHeight: 1.7,
                      marginBottom: 13,
                    }}
                  >
                    {body}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 7,
                    }}
                  >
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          padding: "5px 9px",
                          borderRadius: 999,
                          background: "rgba(127, 127, 127, 0.08)",
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: "var(--text-muted)",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </section>

      {/* AI layer */}
      <section
        className="section"
        style={{
          paddingTop: 10,
          paddingBottom: 90,
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
          <div
            style={{
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
              marginBottom: 30,
            }}
          >
            <div className="feature-icon" style={{ marginBottom: 0 }}>
              <BrainCircuit size={21} />
            </div>

            <div>
              <span
                style={{
                  color: "var(--primary, #7c3aed)",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.13em",
                }}
              >
                INTELLIGENCE LAYER
              </span>

              <h2 style={{ margin: "6px 0 8px" }}>
                What happens behind the scenes?
              </h2>

              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: 13.5,
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                AI works in the background to transform unstructured citizen
                input into structured information that can support the
                grievance workflow.
              </p>
            </div>
          </div>

          <div
            className="grid grid-2"
            style={{
              gap: 15,
            }}
          >
            {AI_FEATURES.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                style={{
                  padding: 20,
                  borderRadius: 16,
                  border: "1px solid rgba(127, 127, 127, 0.12)",
                }}
              >
                <Icon
                  size={19}
                  style={{
                    color: "var(--primary, #7c3aed)",
                    marginBottom: 12,
                  }}
                />

                <h3
                  style={{
                    fontSize: 14,
                    marginBottom: 7,
                  }}
                >
                  {title}
                </h3>

                <p
                  style={{
                    margin: 0,
                    fontSize: 12.5,
                    lineHeight: 1.65,
                    color: "var(--text-muted)",
                  }}
                >
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Multimodal */}
      <section
        className="section"
        style={{
          paddingTop: 10,
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
            MULTIMODAL REPORTING
          </span>

          <h2>Report the way that works for you.</h2>

          <p>
            Civic issues don't always fit into a text box. CivicAI Nexus is
            designed around multiple ways of communicating a problem.
          </p>
        </div>

        <div
          className="grid grid-2"
          style={{
            maxWidth: 850,
            margin: "0 auto",
          }}
        >
          <div className="feature">
            <div className="feature-icon">
              <Mic size={20} />
            </div>

            <h3>Voice</h3>

            <p>
              Describe the problem naturally using your voice and let the
              platform process the information.
            </p>
          </div>

          <div className="feature">
            <div className="feature-icon">
              <MessageSquareText size={20} />
            </div>

            <h3>Text</h3>

            <p>
              Write a detailed complaint and provide context about what
              happened and where it happened.
            </p>
          </div>

          <div className="feature">
            <div className="feature-icon">
              <Camera size={20} />
            </div>

            <h3>Photo Evidence</h3>

            <p>
              Add visual evidence when an image can help communicate the
              condition or severity of an issue.
            </p>
          </div>

          <div className="feature">
            <div className="feature-icon">
              <MapPin size={20} />
            </div>

            <h3>Location</h3>

            <p>
              Location information can provide important context and help
              connect the grievance with the relevant area.
            </p>
          </div>
        </div>
      </section>

      {/* Human + AI */}
      <section
        className="section"
        style={{
          paddingTop: 10,
          paddingBottom: 90,
        }}
      >
        <div
          className="card"
          style={{
            maxWidth: 850,
            margin: "0 auto",
            padding: 35,
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
            <ShieldCheck size={22} />
          </div>

          <h2 style={{ marginBottom: 12 }}>
            AI assists. People remain accountable.
          </h2>

          <p
            style={{
              maxWidth: 650,
              margin: "0 auto 24px",
              color: "var(--text-muted)",
              fontSize: 14,
              lineHeight: 1.75,
            }}
          >
            CivicAI Nexus is designed so AI recommendations support the
            workflow without automatically making important civic decisions.
            Officers can review and modify AI suggestions before taking
            action.
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 18,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                fontSize: 12,
                color: "var(--text-muted)",
              }}
            >
              <ShieldCheck
                size={15}
                color="var(--primary, #7c3aed)"
              />
              Human review
            </span>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                fontSize: 12,
                color: "var(--text-muted)",
              }}
            >
              <Bell size={15} color="var(--primary, #7c3aed)" />
              Citizen updates
            </span>

            <span
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
              Resolution verification
            </span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="section"
        style={{
          paddingTop: 0,
          paddingBottom: 90,
          textAlign: "center",
        }}
      >
        <h2 style={{ marginBottom: 12 }}>
          Ready to make your first report?
        </h2>

        <p
          style={{
            color: "var(--text-muted)",
            fontSize: 14,
            marginBottom: 25,
          }}
        >
          Create an account and start using CivicAI Nexus.
        </p>

        <Link
          to="/register"
          className="primary-button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          Report your first issue
          <ArrowRight size={16} />
        </Link>
      </section>

      <PublicFooter />
    </div>
  );
};

export default HowItWorks;