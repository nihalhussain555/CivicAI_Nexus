import { createContext, useContext, useState, useEffect, useCallback } from "react";

const ThemeContext = createContext(null);

const applyTheme = (mode) => {
  const resolved =
    mode === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : mode;
  document.documentElement.setAttribute("data-theme", resolved);
  return resolved;
};

export const ThemeProvider = ({ children }) => {
  const [mode, setModeState] = useState(() => localStorage.getItem("civicai_theme") || "system");
  const [resolvedTheme, setResolvedTheme] = useState("light");

  useEffect(() => {
    setResolvedTheme(applyTheme(mode));

    if (mode === "system") {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => setResolvedTheme(applyTheme("system"));
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
  }, [mode]);

  const setMode = useCallback((next) => {
    localStorage.setItem("civicai_theme", next);
    setModeState(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, setMode, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
export default ThemeContext;
