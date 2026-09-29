import { createContext, useContext, useEffect, useState } from "react";
import { translations } from "./translations";

const STORAGE_KEY = "civicai_ui_language";

// Maps a UI language to the correct <html lang> code, so screen readers
// pronounce the page correctly and browsers apply the right language
// rules (hyphenation, spellcheck, etc.) — not just a cosmetic label.
const HTML_LANG_CODE = {
  English: "en",
  Tamil: "ta",
  Hindi: "hi",
  Malayalam: "ml",
};

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || "English"
  );

  useEffect(() => {
    document.documentElement.lang = HTML_LANG_CODE[language] || "en";
  }, [language]);

  const setLanguage = (lang) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  };

  // t("nav.dashboard") walks the dot-path in the current language's
  // dictionary; falls back to English, then to the key itself, so a
  // missing translation never renders blank — worst case it just shows
  // English instead of breaking the page.
  const t = (path) => {
    const dict = translations[language] || translations.English;
    const fallback = translations.English;

    const walk = (obj, keys) => keys.reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);

    const keys = path.split(".");
    return walk(dict, keys) ?? walk(fallback, keys) ?? path;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useTranslation must be used within LanguageProvider");
  return ctx;
};