import { useState } from "react";
import Modal from "../common/Modal";
import { getTourSteps } from "./tourSteps";

const OnboardingTour = ({ role, onFinish }) => {
  const steps = getTourSteps(role);
  const [index, setIndex] = useState(0);

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const Icon = step.icon;

  const next = () => {
    if (isLast) {
      onFinish();
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <Modal
      open
      title="Getting started"
      onClose={onFinish}
      footer={
        <>
          {!isLast && (
            <button className="btn btn-secondary" onClick={onFinish}>
              Skip tour
            </button>
          )}
          <button className="btn btn-primary" onClick={next}>
            {isLast ? "Got it" : "Next"}
          </button>
        </>
      }
    >
      <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--accent-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <Icon size={26} style={{ color: "var(--accent)" }} />
        </div>

        <h3 style={{ marginBottom: 8 }}>{step.title}</h3>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>
          {step.description}
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 22 }}>
          {steps.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === index ? 18 : 6,
                height: 6,
                borderRadius: 999,
                background: i === index ? "var(--accent)" : "var(--border)",
                transition: "all 0.2s ease",
              }}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
};

export default OnboardingTour;