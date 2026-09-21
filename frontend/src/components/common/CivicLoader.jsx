// A signal-ping loading indicator — a solid core with two expanding,
// fading rings, like a report being broadcast and picked up. Used in
// place of a generic spinner wherever the app is waiting on something
// (auth submissions, etc.) so the loading state feels like part of
// CivicAI Nexus rather than a stock icon.
//
// Inherits color from its parent via currentColor, so it matches
// whatever text color the button/context already uses.
const CivicLoader = ({ size = 18, className = "" }) => (
  <span
    className={`civic-loader ${className}`}
    style={{ width: size, height: size }}
    role="status"
    aria-label="Loading"
  >
    <svg viewBox="0 0 24 24" width={size} height={size}>
      <circle className="civic-loader-ping civic-loader-ping-1" cx="12" cy="12" r="3" />
      <circle className="civic-loader-ping civic-loader-ping-2" cx="12" cy="12" r="3" />
      <circle className="civic-loader-core" cx="12" cy="12" r="3" />
    </svg>
  </span>
);

export default CivicLoader;