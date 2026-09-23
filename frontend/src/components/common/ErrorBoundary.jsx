import { Component } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

// Without this, any uncaught error while rendering a page (a malformed
// field, a null we forgot to guard, anything) causes React to unmount the
// entire tree — the browser just shows a blank white screen with no clue
// why. This catches that instead and shows something actionable.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surfaced in the browser console so it's actually diagnosable,
    // instead of just silently going blank.
    console.error("Caught by ErrorBoundary:", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="state-block" style={{ minHeight: "50vh" }}>
          <AlertTriangle size={40} strokeWidth={1.5} color="var(--danger)" />
          <h3>Something went wrong loading this page</h3>
          <p style={{ maxWidth: 420 }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <div style={{ marginTop: 16 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
            >
              <RotateCcw size={14} /> Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;