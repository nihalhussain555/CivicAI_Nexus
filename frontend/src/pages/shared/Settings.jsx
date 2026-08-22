import { useState } from "react";
import { Loader2, KeyRound, Palette, Globe } from "lucide-react";
import { changePassword, updateProfile } from "../../services/authService";
import { useToast } from "../../context/ToastContext";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../hooks/useAuth";
import { getErrorMessage } from "../../utils/helpers";
import { LANGUAGES } from "../../utils/constants";
import ThemeToggle from "../../components/common/ThemeToggle";

const Settings = () => {
  const toast = useToast();
  const { mode } = useTheme();
  const { user, updateUser } = useAuth();
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "" });
  const [saving, setSaving] = useState(false);
  const [language, setLanguage] = useState(user.language || "English");

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await changePassword(pwForm);
      toast.success("Password updated");
      setPwForm({ current_password: "", new_password: "" });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageChange = async (lang) => {
    setLanguage(lang);
    try {
      const res = await updateProfile({ language: lang });
      updateUser(res.data);
      toast.success("Preferred language updated");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="page-header"><div><h1>Settings</h1><p>Preferences and account security.</p></div></div>

      <div className="card">
        <div className="section-title"><Palette size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />Appearance</div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
          Current: <strong style={{ textTransform: "capitalize" }}>{mode}</strong>
        </p>
        <ThemeToggle />
      </div>

      <div className="card">
        <div className="section-title"><Globe size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />Language</div>
        <select className="select" value={language} onChange={(e) => handleLanguageChange(e.target.value)}>
          {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <form className="card" onSubmit={handlePasswordChange}>
        <div className="section-title"><KeyRound size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />Change password</div>
        <div className="form-group">
          <label className="form-label">Current password</label>
          <input type="password" className="input" required
                 value={pwForm.current_password}
                 onChange={(e) => setPwForm((f) => ({ ...f, current_password: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">New password</label>
          <input type="password" className="input" required minLength={6}
                 value={pwForm.new_password}
                 onChange={(e) => setPwForm((f) => ({ ...f, new_password: e.target.value }))} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving && <Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} />}
          Update password
        </button>
      </form>
    </div>
  );
};

export default Settings;
