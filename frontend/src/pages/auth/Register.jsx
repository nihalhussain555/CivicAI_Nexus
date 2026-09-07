import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShieldCheck, Loader2, UserRound, Mail, Phone, LockKeyhole, Eye, EyeOff,
  Sparkles, ArrowRight, MapPin, CheckCircle2, ShieldQuestion, ArrowLeft,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../utils/helpers";
import { verifyOtp, resendOtp } from "../../services/authService";

const OTP_LENGTH = 6;

const Register = () => {
  const [step, setStep] = useState("form"); // "form" | "otp"
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const otpRefs = useRef([]);

  const { register, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await register(form);
      // Mock EMAIL_PROVIDER (the default, no SMTP configured) returns the
      // code directly so signup can be tried without a real email account.
      if (res.data?.dev_otp) {
        toast.info(`Demo mode: your verification code is ${res.data.dev_otp}`);
      } else {
        toast.success("Verification code sent to your email.");
      }
      setStep("otp");
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    setOtpDigits((prev) => {
      const next = [...prev];
      pasted.split("").forEach((d, i) => { next[i] = d; });
      return next;
    });
    otpRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const code = otpDigits.join("");
    if (code.length < OTP_LENGTH) {
      toast.error("Enter the full verification code.");
      return;
    }
    setVerifying(true);
    try {
      await verifyOtp(form.email, code);
      await login(form.email, form.password);
      toast.success("Email verified — welcome to CivicAI Nexus!");
      navigate("/citizen/dashboard", { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      otpRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await resendOtp(form.email);
      if (res.data?.dev_otp) {
        toast.info(`Demo mode: your new code is ${res.data.dev_otp}`);
      } else {
        toast.success("A new code has been sent to your email.");
      }
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      otpRefs.current[0]?.focus();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-frame auth-frame-register">
        <div className="auth-card auth-card-wide">
          <div className="auth-topline">
            <Link to="/" className="auth-logo"><ShieldCheck size={21} /> CivicAI <span>Nexus</span></Link>
            <p>Already a member? <Link to="/login">Sign in</Link></p>
          </div>

          {step === "form" ? (
            <>
              <div className="auth-heading">
                <span className="auth-kicker">Create your account</span>
                <h1>Make your community voice count.</h1>
                <p>Start reporting and tracking civic issues in your area.</p>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-group input-with-icon">
                  <label className="form-label" htmlFor="name">Full Name</label>
                  <UserRound size={16} />
                  <input id="name" className="input" required minLength={2} value={form.name}
                         onChange={update("name")} placeholder="Full Name" />
                </div>
                <div className="form-group input-with-icon">
                  <label className="form-label" htmlFor="email">Email</label>
                  <Mail size={16} />
                  <input id="email" type="email" className="input" required value={form.email}
                         onChange={update("email")} placeholder="you@gmail.com" />
                </div>
                <div className="form-group input-with-icon">
                  <label className="form-label" htmlFor="phone">Phone (optional)</label>
                  <Phone size={16} />
                  <input id="phone" className="input" value={form.phone}
                         onChange={update("phone")} placeholder="+91 98765 43210" />
                </div>
                <div className="form-group input-with-icon">
                  <label className="form-label" htmlFor="password">Password</label>
                  <LockKeyhole size={16} />
                  <input id="password" type={showPassword ? "text" : "password"} className="input" required minLength={6} value={form.password}
                         onChange={update("password")} placeholder="At least 6 characters" />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  {form.password && <div className={`password-strength ${form.password.length >= 10 ? "strong" : form.password.length >= 6 ? "medium" : "weak"}`}><span /><span /><span /><em>{form.password.length >= 10 ? "Strong" : form.password.length >= 6 ? "Good" : "Use at least 6 characters"}</em></div>}
                </div>
                <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={loading}>
                  {loading ? <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : <>Create account <ArrowRight size={16} /></>}
                </button>
              </form>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }} onClick={() => setStep("form")}>
                <ArrowLeft size={14} /> Back
              </button>

              <div className="auth-heading">
                <span className="auth-kicker">Verify your email</span>
                <h1><ShieldQuestion size={26} style={{ verticalAlign: "-4px", marginRight: 8 }} />Enter your code</h1>
                <p>We sent a {OTP_LENGTH}-digit verification code to <strong>{form.email}</strong>.</p>
              </div>

              <form onSubmit={handleVerify}>
                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (otpRefs.current[index] = el)}
                      className="input"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={index === 0 ? handleOtpPaste : undefined}
                      style={{ textAlign: "center", fontSize: 20, fontWeight: 700, padding: "10px 0" }}
                      aria-label={`Digit ${index + 1} of verification code`}
                    />
                  ))}
                </div>

                <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={verifying}>
                  {verifying ? <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : <>Verify & continue <ArrowRight size={16} /></>}
                </button>
              </form>

              <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", marginTop: 18 }}>
                Didn't get a code?{" "}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 600, cursor: "pointer", padding: 0 }}
                >
                  {resending ? "Sending..." : "Resend code"}
                </button>
              </p>
            </>
          )}
        </div>
        <AuthShowcase />
      </section>
    </div>
  );
};

const AuthShowcase = () => (
  <aside className="auth-visual" aria-hidden="true">
    <div className="auth-ribbon auth-ribbon-top" /><div className="auth-ribbon auth-ribbon-bottom" />
    <div className="showcase-brand"><Sparkles size={15} /> AI-powered public service</div>
    <div className="showcase-copy"><h2>From concern to action, together.</h2><p>Join a secure civic network built for a more responsive community.</p></div>
    <div className="showcase-dashboard">
      <div className="showcase-status"><span><MapPin size={15} /> Issue CX-2048</span><strong>In progress</strong></div>
      <div className="showcase-map"><span className="map-pin"><MapPin size={22} fill="currentColor" /></span><i /><i /><i /></div>
      <div className="showcase-update"><div className="showcase-check"><CheckCircle2 size={20} /></div><div><strong>Routed to City Works</strong><span>Updated just now</span></div></div>
    </div>
  </aside>
);

export default Register;