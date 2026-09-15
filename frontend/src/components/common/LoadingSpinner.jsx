const LoadingSpinner = ({ size = 28, label }) => (
  <div className="civic-loader-wrapper">
    <div
      className="civic-loader"
      style={{
        width: size,
        height: size,
      }}
    >
      <span className="loader-ring ring-one"></span>
      <span className="loader-ring ring-two"></span>
      <span className="loader-core"></span>
    </div>

    {label && <span className="civic-loader-label">{label}</span>}

    <style>{`
      .civic-loader-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        color: var(--text-muted);
      }

      .civic-loader {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .loader-ring {
        position: absolute;
        inset: 0;
        border: 2px solid transparent;
        border-top-color: #8b5cf6;
        border-right-color: #a855f7;
        border-radius: 50%;
      }

      .ring-one {
        animation: civicSpin 1s linear infinite;
      }

      .ring-two {
        inset: 4px;
        border-top-color: #6366f1;
        border-right-color: transparent;
        animation: civicSpinReverse 0.8s linear infinite;
      }

      .loader-core {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #8b5cf6;
        box-shadow:
          0 0 8px rgba(139, 92, 246, 0.8),
          0 0 16px rgba(139, 92, 246, 0.4);
        animation: civicPulse 1s ease-in-out infinite;
      }

      .civic-loader-label {
        font-size: 13px;
        font-weight: 500;
        letter-spacing: 0.2px;
      }

      @keyframes civicSpin {
        from {
          transform: rotate(0deg);
        }

        to {
          transform: rotate(360deg);
        }
      }

      @keyframes civicSpinReverse {
        from {
          transform: rotate(360deg);
        }

        to {
          transform: rotate(0deg);
        }
      }

      @keyframes civicPulse {
        0%, 100% {
          transform: scale(0.7);
          opacity: 0.65;
        }

        50% {
          transform: scale(1.25);
          opacity: 1;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .loader-ring,
        .loader-core {
          animation: none;
        }
      }
    `}</style>
  </div>
);

export default LoadingSpinner;