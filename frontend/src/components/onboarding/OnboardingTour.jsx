import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getTourSteps } from "./tourSteps";
import "./OnboardingTour.css";

const GAP = 18;
const MODAL_WIDTH = 420;
const VIEWPORT_PADDING = 20;

const OnboardingTour = ({ role, onFinish }) => {
  const steps = getTourSteps(role);
  const [index, setIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  const Icon = step?.icon;

  /**
   * Find the element that belongs to the current tour step.
   */
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
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
    });
  };

  /**
   * Scroll target into view when moving to a step.
   */
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
        inline: "nearest",
      });
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(findTarget);
    });
  }, [index, step]);

  /**
   * Keep spotlight synchronized while the window changes.
   */
  useEffect(() => {
    const update = () => findTarget();

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [index, step]);

  /**
   * Lock page scrolling while the tour is open.
   */
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  /**
   * Add the active-tour class to the highlighted element.
   */
  useEffect(() => {
    const target = step?.target
      ? document.querySelector(step.target)
      : null;

    if (target) {
      target.classList.add("civic-tour-target");
    }

    return () => {
      if (target) {
        target.classList.remove("civic-tour-target");
      }
    };
  }, [step]);

  const finish = () => {
    onFinish();
  };

  const next = () => {
    if (isLast) {
      finish();
      return;
    }

    setIndex((current) => current + 1);
  };

  const previous = () => {
    if (!isFirst) {
      setIndex((current) => current - 1);
    }
  };

  /**
   * Calculate modal position.
   */
  const getModalPosition = () => {
    // First / welcome screen = centered.
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

    const targetCenter = targetRect.left + targetRect.width / 2;

    /**
     * Sidebar targets:
     * Put the modal to the right of the highlighted navigation item.
     */
    if (targetRect.right + GAP + MODAL_WIDTH <= viewportWidth - VIEWPORT_PADDING) {
      left = targetRect.right + GAP;
    } else {
      left = targetRect.left;
    }

    /**
     * Vertically align modal approximately with target.
     */
    top = targetRect.top + targetRect.height / 2 - 150;

    // Keep modal inside viewport.
    if (top < VIEWPORT_PADDING) {
      top = VIEWPORT_PADDING;
    }

    const estimatedHeight = 330;

    if (top + estimatedHeight > viewportHeight - VIEWPORT_PADDING) {
      top = viewportHeight - estimatedHeight - VIEWPORT_PADDING;
    }

    // If modal would still overlap target, move it to the other side.
    if (
      left < targetRect.right &&
      left + MODAL_WIDTH > targetRect.left
    ) {
      if (targetRect.left - GAP - MODAL_WIDTH >= VIEWPORT_PADDING) {
        left = targetRect.left - GAP - MODAL_WIDTH;
      } else {
        left = Math.max(
          VIEWPORT_PADDING,
          (viewportWidth - MODAL_WIDTH) / 2
        );
      }
    }

    return {
      top,
      left,
      transform: "none",
    };
  };

  const modalPosition = getModalPosition();

  if (!steps.length) {
    return null;
  }

  return createPortal(
    <div className="civic-tour-root">
      {/* Dark overlay */}
      <div className="civic-tour-overlay" />

      {/* Spotlight cutout */}
      {targetRect && (
        <div
          className="civic-tour-spotlight"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      {/* Tour modal */}
      <div
        className={`civic-tour-card ${
          targetRect ? "has-target" : "welcome-step"
        }`}
        style={modalPosition}
      >
        {/* Header */}
        <div className="civic-tour-header">
          <span className="civic-tour-header-title">
            Getting started
          </span>

          <button
            type="button"
            className="civic-tour-close"
            onClick={finish}
            aria-label="Close tour"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="civic-tour-content">
          <div className="civic-tour-icon">
            {Icon && <Icon size={27} strokeWidth={2} />}
          </div>

          <h2>{step.title}</h2>

          <p>{step.description}</p>

          {/* Progress */}
          <div className="civic-tour-progress">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`civic-tour-dot ${
                  i === index ? "active" : ""
                }`}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="civic-tour-footer">
          {!isFirst ? (
            <button
              type="button"
              className="civic-tour-skip"
              onClick={previous}
            >
              ← Previous
            </button>
          ) : (
            <button
              type="button"
              className="civic-tour-skip"
              onClick={finish}
            >
              Skip tour
            </button>
          )}

          <div className="civic-tour-step-count">
            {index + 1} of {steps.length}
          </div>

          {!isLast ? (
            <button
              type="button"
              className="civic-tour-next"
              onClick={next}
            >
              Next
              <span>→</span>
            </button>
          ) : (
            <button
              type="button"
              className="civic-tour-next"
              onClick={finish}
            >
              Got it
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default OnboardingTour;