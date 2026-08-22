import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

const OPTIONS = [
  { value: "light", icon: Sun, label: "Light theme" },
  { value: "dark", icon: Moon, label: "Dark theme" },
  { value: "system", icon: Monitor, label: "System theme" },
];

const ThemeToggle = () => {
  const { mode, setMode } = useTheme();

  return (
    <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setMode(value)}
          aria-label={label}
          aria-pressed={mode === value}
          style={{
            width: 34, height: 34,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: mode === value ? "var(--accent-soft)" : "transparent",
            color: mode === value ? "var(--accent)" : "var(--text-muted)",
            border: "none",
          }}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
};

export default ThemeToggle;
