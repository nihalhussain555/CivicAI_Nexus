import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { getMyRewards } from "../../services/rewardService";

const RewardsWidget = () => {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    getMyRewards()
      .then((res) => setSummary(res.data))
      .catch(() => setSummary(null));
  }, []);

  if (!summary) return null;

  const { total_points, tier, next_tier, points_to_next_tier } = summary;

  const progressPercent = next_tier
    ? Math.min(
        100,
        Math.round(
          ((total_points - (tier.min_points || 0)) /
            (next_tier.min_points - (tier.min_points || 0))) *
            100
        )
      )
    : 100;

  return (
    <Link to="/citizen/rewards" className="rewards-widget" style={{ textDecoration: "none", color: "inherit" }}>
      <span className="rewards-widget-icon">{tier.icon}</span>

      <div className="rewards-widget-body">
        <div className="rewards-widget-points">{total_points} Civic Points</div>
        <div className="rewards-widget-tier">{tier.label}</div>

        <div className="rewards-progress-track">
          <div className="rewards-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="rewards-progress-caption">
          {next_tier
            ? `${points_to_next_tier} points to ${next_tier.label}`
            : "You've reached the highest tier!"}
        </div>
      </div>

      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 700, color: "var(--accent)", flexShrink: 0 }}>
        View rewards <ArrowRight size={14} />
      </span>
    </Link>
  );
};

export default RewardsWidget;