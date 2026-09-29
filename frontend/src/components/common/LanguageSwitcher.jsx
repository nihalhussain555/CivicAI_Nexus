import { Languages } from "lucide-react";
import { useTranslation } from "../../context/LanguageContext";

const LANGUAGE_OPTIONS = ["English", "Tamil", "Hindi", "Malayalam"];

const LanguageSwitcher = ({ compact = false }) => {
  const { language, setLanguage } = useTranslation();

  if (compact) {
    return (
      <select
        className="language-switcher-compact"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        aria-label="Interface language"
      >
        {LANGUAGE_OPTIONS.map((lang) => (
          <option key={lang} value={lang}>{lang}</option>
        ))}
      </select>
    );
  }

  return (
    <div className="settings-card-row">
      <div className="settings-card-left">
        <div className="settings-icon-box"><Languages size={21} /></div>
        <div>
          <h3>Interface language</h3>
          <p>Changes the app's menus and buttons — not just how complaints are classified.</p>
        </div>
      </div>
      <select className="select" style={{ maxWidth: 180 }} value={language} onChange={(e) => setLanguage(e.target.value)}>
        {LANGUAGE_OPTIONS.map((lang) => (
          <option key={lang} value={lang}>{lang}</option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSwitcher;