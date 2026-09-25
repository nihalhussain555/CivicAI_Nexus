import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getTourSteps } from "./tourSteps";
import "./OnboardingTour.css";

const MODAL_WIDTH = 420;
const GAP = 18;
const PADDING = 16;

const OnboardingTour = ({ role, onFinish }) => {
  const steps = getTourSteps(role);
  const [index, setIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;
  const Icon = step?.icon;

  const findTarget = () => {
    if (!step?.target) {
      setTargetRect(null);
      return;
    }

    const target = document.querySelector(step.target);

    if (!target) {
      setTargetRect(null);
      return;
    }

    const rect = target.getBoundingClientRect();

    setTargetRect({
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    });
  };

  useLayoutEffect(() => {
    if (!step?.target) {
      setTargetRect(null);
      return;
    }

    const target = document.querySelector(step.target);

    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(findTarget);
    });
  }, [index, step]);

  useEffect(() => {
    const update = () => findTarget();

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [index, step]);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const target = step?.target
      ? document.querySelector(step.target)
      : null;

    if (target) {
      target.classList.add("civic-tour-highlight");
    }

    return () => {
      if (target) {
        target.classList.remove("civic-tour-highlight");
      }
    };
  }, [step]);

  const next = () => {
    if (isLast) {
      onFinish();
      return;
    }

    setIndex((current) => current + 1);
  };

  const previous = () => {
    if (!isFirst) {
      setIndex((current) => current - 1);
    }
  };

  const getCardPosition = () => {
    if (!targetRect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left;
    let top;

    /*
     * Sidebar item:
     * place the tour card to the right of the item.
     */
    if (
      targetRect.right + GAP + MODAL_WIDTH <=
      viewportWidth - PADDING
    ) {
      left = targetRect.right + GAP;
    } else {
      left =
        targetRect.left -
        MODAL_WIDTH -
        GAP;
    }

    /*
     * Align vertically with the selected item.
     */
    top =
      targetRect.top +
      targetRect.height / 2 -
      150;

    /*
     * Keep inside viewport.
     */
    if (top < PADDING) {
      top = PADDING;
    }

    const estimatedHeight = 360;

    if (
      top + estimatedHeight >
      viewportHeight - PADDING
    ) {
      top =
        viewportHeight -
        estimatedHeight -
        PADDING;
    }

    /*
     * Mobile / narrow screens.
     */
    if (viewportWidth < 720) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    return {
      top,
      left: Math.max(PADDING, left),
      transform: "none",
    };
  };

  if (!step) {
    return null;
  }

  return createPortal(
    <div className="civic-tour-root">

      <div className="civic-tour-overlay" />

      {targetRect && (
        <div
          className="civic-tour-spotlight"
          style={{
            top: targetRect.top - 5,
            left: targetRect.left - 5,
            width: targetRect.width + 10,
            height: targetRect.height + 10,
          }}
        />
      )}

      <div
        className={`civic-tour-card ${
          targetRect
            ? "civic-tour-context"
            : "civic-tour-welcome"
        }`}
        style={getCardPosition()}
      >

        {/* HEADER */}

        <div className="civic-tour-header">
          <span>
            Getting started
          </span>

          <button
            type="button"
            className="civic-tour-close"
            onClick={onFinish}
            aria-label="Close tour"
          >
            ×
          </button>
        </div>

        {/* CONTENT */}

        <div className="civic-tour-content">

          <div className="civic-tour-icon">
            {Icon && (
              <Icon
                size={27}
                strokeWidth={2}
              />
            )}
          </div>

          <h2>
            {step.title}
          </h2>

          <p>
            {step.description}
          </p>

          {/* PROGRESS */}

          <div className="civic-tour-progress">
            {steps.map((_, i) => (
              <span
                key={i}
                className={
                  i === index
                    ? "civic-tour-dot active"
                    : "civic-tour-dot"
                }
              />
            ))}
          </div>
        </div>

        {/* FOOTER */}

        <div className="civic-tour-footer">

          <button
            type="button"
            className="civic-tour-secondary"
            onClick={
              isFirst
                ? onFinish
                : previous
            }
          >
            {isFirst
              ? "Skip tour"
              : "← Previous"}
          </button>

          <span className="civic-tour-counter">
            {index + 1} of {steps.length}
          </span>

          <button
            type="button"
            className="civic-tour-primary"
            onClick={next}
          >
            {isLast
              ? "Got it"
              : "Next →"}
          </button>

        </div>
      </div>
    </div>,
    document.body
  );
};

export default OnboardingTour;