import { useState } from "react";
import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  ShieldCheck,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

import api from "../../services/api";
import { getErrorMessage } from "../../utils/helpers";


const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [success, setSuccess] =
    useState(false);

  const [error, setError] =
    useState("");


  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    if (!token) {
      setError(
        "This password reset link is invalid."
      );
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must contain at least 6 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    setLoading(true);

    try {

      await api.post(
        "/auth/reset-password",
        {
          token,
          new_password: password,
        }
      );

      setSuccess(true);

      setTimeout(() => {
        navigate("/login", {
          replace: true,
        });
      }, 2500);

    } catch (err) {

      setError(
        getErrorMessage(err)
        || "Unable to reset your password."
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


          {!success ? (

            <>
              <div className="auth-heading">

                <span className="auth-kicker">
                  Account recovery
                </span>

                <h1>
                  Create a new password.
                </h1>

                <p>
                  Choose a strong password for
                  your CivicAI Nexus account.
                </p>

              </div>


              <form
                onSubmit={handleSubmit}
              >

                <div className="form-group input-with-icon">

                  <label
                    className="form-label"
                    htmlFor="new-password"
                  >
                    New password
                  </label>

                  <LockKeyhole size={16} />

                  <input
                    id="new-password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    className="input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword(
                        (visible) =>
                          !visible
                      )
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>

                </div>


                <div className="form-group input-with-icon">

                  <label
                    className="form-label"
                    htmlFor="confirm-password"
                  >
                    Confirm password
                  </label>

                  <LockKeyhole size={16} />

                  <input
                    id="confirm-password"
                    type={
                      showConfirmPassword
                        ? "text"
                        : "password"
                    }
                    className="input"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value
                      )
                    }
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowConfirmPassword(
                        (visible) =>
                          !visible
                      )
                    }
                    aria-label={
                      showConfirmPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>

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

                      Updating...
                    </>
                  ) : (
                    <>
                      Reset password
                      <ArrowRight size={16} />
                    </>
                  )}

                </button>

              </form>

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
                Password updated
              </span>

              <h1>
                You're all set!
              </h1>

              <p>
                Your CivicAI Nexus password
                has been reset successfully.
              </p>

              <p>
                Redirecting you to login...
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
                Continue to login
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
      Secure password recovery
    </div>

    <div className="showcase-copy">

      <h2>
        Stay secure.
        Stay connected.
      </h2>

      <p>
        Protect your CivicAI Nexus
        account and keep your civic
        activity safe.
      </p>

    </div>

  </aside>
);


export default ResetPassword;