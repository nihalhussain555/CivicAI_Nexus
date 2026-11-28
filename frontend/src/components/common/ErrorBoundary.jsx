import { Component } from "react";
import { RotateCcw } from "lucide-react";
import DiagnosticCard from "./DiagnosticCard";
import { diagnose } from "../../utils/errorDiagnosis";
import { reportClientError } from "../../services/diagnosticService";

/*
 * Without this, any uncaught error while rendering a page (a malformed field,
 * a null we forgot to guard, anything) causes React to unmount the entire tree:
 * the browser shows a blank white screen with no clue why. This catches that,
 * names the component that broke, and offers a way out that is not "reload and
 * hope".
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, diagnosis: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surfaced in the console so it is diagnosable there too, then classified
    // and reported — a crash nobody has ever seen is a crash nobody fixes.
    console.error("Caught by ErrorBoundary:", error, info?.componentStack);

    const diagnosis = diagnose(error, {
      feature: this.props.feature || "page_render",
      technical: {
        component: info?.componentStack
          ? info.componentStack.split("\n")[1]?.trim().replace(/^at\s+/, "") || ""
          : "",
      },
    });
    // Only the component name is added; the stack itself is not stored — it is
    // long, machine-specific, and carries no actionable information.
    reportClientError(diagnosis);
    this.setState({ diagnosis });
  }

  render() {
    if (!this.state.error) return this.props.children;

    const { error, diagnosis } = this.state;

    if (this.props.fallback) {
      return this.props.fallback({ error, diagnosis, reset: () => this.setState({ error: null, diagnosis: null }) });
    }

    return (
      <div className="error-boundary-screen">
        <DiagnosticCard
          variant="full"
          diagnosis={diagnosis || {
            category: "internal",
            categoryLabel: "Platform",
            severity: "blocking",
            feature: "page_render",
            featureLabel: "Loading this page",
            what: "This page could not be displayed.",
            // A raw exception string ("Cannot read properties of undefined…") is
            // noise to a citizen, and this branch only runs when the classifier
            // itself failed, so nobody will read the real message anywhere.
            reason: "Something on this page did not load correctly.",
            solution: "Reload the page. If it keeps happening, please report the issue.",
            retryable: true,
            technical: { message: String(error?.message || error) },
          }}
          onRetry={() => window.location.reload()}
          retryLabel="Reload page"
        />
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 14 }}
          onClick={() => this.setState({ error: null, diagnosis: null })}
        >
          <RotateCcw size={13} /> Dismiss and continue
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
