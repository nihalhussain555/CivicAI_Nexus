import { useEffect, useState } from "react";
import { Timer, TimerOff, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatDateTime } from "../../utils/helpers";

// Ticking SLA countdown.
//
// The deadline arrives as an absolute instant, so the countdown is anchored to
// that rather than to a locally measured baseline: a phone that sleeps for ten
// minutes, or a tab the citizen left open over lunch, still shows the time
// genuinely left instead of the time that was left when the page loaded. The
// clock is only ever read inside the tick callback, never during render, which
// is what keeps the re-render honest when the page refetches on its own
// interval.
const humanize = (totalSeconds) => {
  const seconds = Math.abs(Math.trunc(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds % 60}s`;
};

const TONE = {
  on_track: { icon: Timer, className: "track-sla-on_track", label: "On track" },
  due_soon: { icon: AlertTriangle, className: "track-sla-due_soon", label: "Due shortly" },
  at_risk: { icon: AlertTriangle, className: "track-sla-at_risk", label: "Running behind" },
  breached: { icon: AlertTriangle, className: "track-sla-breached", label: "Overdue" },
  met: { icon: CheckCircle2, className: "track-sla-met", label: "Deadline met" },
  missed: { icon: TimerOff, className: "track-sla-missed", label: "Deadline missed" },
  unknown: { icon: TimerOff, className: "track-sla-unknown", label: "No deadline set" },
};

const SlaCountdown = ({ sla }) => {
  const tone = TONE[sla?.state] || TONE.unknown;
  const Icon = tone.icon;
  const dueAt = sla?.due_at || null;
  const running = Boolean(sla?.clock_running) && dueAt;

  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (!running) return undefined;

    const deadline = Date.parse(dueAt);
    const sync = () => setRemaining((deadline - Date.now()) / 1000);

    // Sync once off the render pass, then keep time.
    const start = setTimeout(sync, 0);
    const timer = setInterval(sync, 1000);
    return () => {
      clearTimeout(start);
      clearInterval(timer);
    };
  }, [running, dueAt]);

  if (!sla) return null;

  // A stopped clock is not ticking, so there is nothing to measure: the
  // server's frozen figure is the answer, read straight from the payload.
  const shown = running ? remaining : sla.seconds_remaining;
  const hasCount = typeof shown === "number";
  const overdue = hasCount && shown <= 0;

  // A stopped clock has no time "left": once the work is filed the same
  // number reads as the margin the department kept, or the amount by which
  // it ran past the date it promised.
  const countLabel = !sla.clock_running
    ? (overdue ? "past the date" : "to spare")
    : (overdue ? "overdue" : "left");

  return (
    <div className={`track-sla ${tone.className}`}>
      <div className="track-sla-head">
        <Icon size={16} />
        <div>
          <div className="track-sla-state">{tone.label}</div>
          <div className="track-sla-when">
            {dueAt
              ? `Expected by ${formatDateTime(dueAt)}`
              : "The department will confirm a date shortly"}
          </div>
        </div>
        {hasCount && (
          <div className="track-sla-count">
            <strong>{humanize(shown)}</strong>
            <span>{countLabel}</span>
          </div>
        )}
      </div>

      {typeof sla.percent_elapsed === "number" && (
        <>
          <div className="track-sla-track" role="presentation">
            <span
              className="track-sla-fill"
              style={{ width: `${Math.min(100, Math.max(2, sla.percent_elapsed))}%` }}
            />
          </div>
          <p className="track-sla-note">
            {sla.clock_running
              ? `${sla.percent_elapsed}% of the promised window has been used`
              : `The clock stopped at ${sla.percent_elapsed}% of the promised window`}
          </p>
        </>
      )}
    </div>
  );
};

export default SlaCountdown;
