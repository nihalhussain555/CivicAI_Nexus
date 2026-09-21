import { useEffect, useState } from "react";
import { Sparkles, Check, Loader2 } from "lucide-react";

const STEPS = [
  "Understanding your message",
  "Detecting language",
  "Finding the responsible department",
  "Checking for similar complaints nearby",
  "Predicting priority",
];

// A checklist-style loading animation for the AI review step. Steps check
// off roughly in step with a real API call — it's a paced simulation (the
// real analysis is one request, not five), but it reads much better than a
// bare spinner and reflects the actual sub-steps the AI pipeline runs.
// When `done` flips true (the real response has landed), whatever hasn't
// finished animating snaps to checked immediately rather than looking stuck.
const AIProcessingAnimation = ({ done }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (done) {
      setActiveIndex(STEPS.length);
      return;
    }
    if (activeIndex >= STEPS.length - 1) return;

    const timer = setTimeout(() => setActiveIndex((i) => i + 1), 750);
    return () => clearTimeout(timer);
  }, [activeIndex, done]);

  return (
    <div className="card ai-processing-card">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <Sparkles size={17} color="var(--accent)" />
        <strong style={{ fontSize: 15 }}>CivicAI is analyzing your complaint</strong>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {STEPS.map((label, i) => {
          const isDone = i < activeIndex || done;
          const isActive = i === activeIndex && !done;

          return (
            <div key={label} className={`ai-processing-step ${isDone ? "is-done" : ""} ${isActive ? "is-active" : ""}`}>
              <span className="ai-processing-step-icon">
                {isDone ? <Check size={13} /> : isActive ? <Loader2 size={13} className="ai-processing-spin" /> : null}
              </span>
              <span>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AIProcessingAnimation;