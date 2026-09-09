import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Mail,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

import api from "../../utils/api";
import { getErrorMessage } from "../../utils/helpers";


const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
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

      setError(
        getErrorMessage(err)
        || "Unable to process your request."
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
              <ShieldCheck size={21} />
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


                {error && (
                  <div className="error-message">
                    {error}
                  </div>
                )}


                <button
                  type="submit"
                  className="btn btn-primary btn-block auth-submit"
                  disabled={loading}
                >

                  {loading ? (
                    <>
                      <Loader2
                        size={16}
                        style={{
                          animation:
                            "spin 0.8s linear infinite",
                        }}
                      />

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