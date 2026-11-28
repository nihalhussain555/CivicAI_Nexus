import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Mail,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

import api from "../../services/api";
import ErrorState from "../../components/common/ErrorState";
import { useDiagnostics } from "../../hooks/useDiagnostics";
import CivicLoader from "../../components/common/CivicLoader";


const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Held as a diagnosis so the banner can render the what / why / what-to-do.
  const [error, setError] = useState(null);
  const { capture, diagnose } = useDiagnostics();

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError(null);
    setLoading(true);

    try {
      await api.post(
        "/auth/forgot-password",
        {
          email: email.trim(),
        }
      );

      setSubmitted(true);

    } catch (err) {
      // A rate limit is a "wait a minute", the user's correction; only a 5xx or
      // no response at all is our fault, so only those get filed via capture.
      const status = err?.response?.status;
      setError(
        !err?.response || status >= 500
          ? capture(err, { feature: "password_reset" })
          : diagnose(err, { feature: "password_reset" })
      );
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="auth-shell">

      <section className="auth-frame auth-frame-login">

        <div className="auth-card auth-card-wide">

          <div className="auth-topline">

            <Link
              to="/"
              className="auth-logo"
            >
              <img src="/logo.png" alt="CivicAI Nexus" className="auth-logo-icon" />
              CivicAI <span>Nexus</span>
            </Link>

            <p>
              Remember your password?{" "}
              <Link to="/login">
                Sign in
              </Link>
            </p>

          </div>


          {!submitted ? (

            <>
              <div className="auth-heading">

                <span className="auth-kicker">
                  Account recovery
                </span>

                <h1>
                  Forgot your password?
                </h1>

                <p>
                  Enter your registered email and
                  we'll send you a secure password
                  reset link.
                </p>

              </div>


              <form
                onSubmit={handleSubmit}
              >

                <div className="form-group input-with-icon">

                  <label
                    className="form-label"
                    htmlFor="forgot-email"
                  >
                    Email
                  </label>

                  <Mail size={16} />

                  <input
                    id="forgot-email"
                    type="email"
                    className="input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    required
                    autoComplete="email"
                  />

                </div>


                {error && <ErrorState diagnosis={error} />}


                <button
                  type="submit"
                  className="btn btn-primary btn-block auth-submit"
                  disabled={loading}
                >

                  {loading ? (
                    <>
                      <CivicLoader size={16} />

                      Sending...
                    </>
                  ) : (
                    <>
                      Send reset link
                      <ArrowRight size={16} />
                    </>
                  )}

                </button>

              </form>


              <div
                style={{
                  marginTop: "18px",
                  textAlign: "center",
                }}
              >

                <Link to="/login">
                  ← Back to login
                </Link>

              </div>
            </>

          ) : (

            <div
              style={{
                textAlign: "center",
                padding: "25px 5px",
              }}
            >

              <CheckCircle2
                size={54}
                style={{
                  marginBottom: "18px",
                }}
              />

              <span className="auth-kicker">
                Check your inbox
              </span>

              <h1>
                Reset link sent
              </h1>

              <p>
                If an account exists for{" "}
                <strong>{email}</strong>,
                a password reset link has
                been sent to that email.
              </p>

              <p>
                The link will expire after
                30 minutes.
              </p>

              <Link
                to="/login"
                className="btn btn-primary btn-block"
                style={{
                  marginTop: "20px",
                  display: "inline-flex",
                  justifyContent: "center",
                  textDecoration: "none",
                }}
              >
                Back to login
                <ArrowRight size={16} />
              </Link>

            </div>

          )}

        </div>


        <AuthShowcase />

      </section>

    </div>
  );
};


const AuthShowcase = () => (
  <aside
    className="auth-visual"
    aria-hidden="true"
  >

    <div className="auth-ribbon auth-ribbon-top" />
    <div className="auth-ribbon auth-ribbon-bottom" />

    <div className="showcase-brand">
      <Sparkles size={15} />
      Secure account recovery
    </div>

    <div className="showcase-copy">

      <h2>
        Your civic workspace,
        protected.
      </h2>

      <p>
        Secure authentication keeps
        your complaints, profile and
        civic activity protected.
      </p>

    </div>

  </aside>
);


export default ForgotPassword;