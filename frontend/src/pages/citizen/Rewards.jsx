import { useEffect, useState } from "react";
import { Trophy, History } from "lucide-react";
import { getMyRewards, getLeaderboard } from "../../services/rewardService";
import { SkeletonList } from "../../components/common/Skeleton";
import EmptyState from "../../components/common/EmptyState";

const formatDate = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const Rewards = () => {
  const [summary, setSummary] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);

  useEffect(() => {
    getMyRewards().then((res) => setSummary(res.data));
    getLeaderboard(10).then((res) => setLeaderboard(res.data));
  }, []);

  if (!summary) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1><Trophy size={20} style={{ verticalAlign: "-3px", marginRight: 8, color: "var(--accent)" }} />Civic Rewards</h1>
            <p>Earn points for real civic outcomes — not just how many reports you file.</p>
          </div>
        </div>
        <SkeletonList rows={4} />
      </div>
    );
  }

  const { total_points, tier, next_tier, points_to_next_tier, ledger, all_tiers } = summary;

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
    <div>
      <div className="page-header">
        <div>
          <h1><Trophy size={20} style={{ verticalAlign: "-3px", marginRight: 8, color: "var(--accent)" }} />Civic Rewards</h1>
          <p>Points reflect verified, resolution-worthy contributions — not just submission volume.</p>
        </div>
      </div>

      {/* --- Points + tier progress --- */}
      <div className="rewards-widget" style={{ marginBottom: 30 }}>
        <span className="rewards-widget-icon">{tier.icon}</span>
        <div className="rewards-widget-body">
          <div className="rewards-widget-points">{total_points} Civic Points</div>
          <div className="rewards-widget-tier">Current level: {tier.label}</div>
          <div className="rewards-progress-track">
            <div className="rewards-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="rewards-progress-caption">
            {next_tier
              ? `${points_to_next_tier} points to reach ${next_tier.label}`
              : "You've reached the highest tier — Civic Hero!"}
          </div>
        </div>
      </div>

      {/* --- Tier ladder --- */}
      <div className="section-title">Reward Tiers</div>
      <div className="grid grid-4" style={{ marginBottom: 30, gap: 14 }}>
        {all_tiers.map((t) => (
          <div key={t.key} className={`tier-card ${total_points >= t.min_points ? "tier-reached" : ""}`}>
            <div className="tier-card-icon">{t.icon}</div>
            <div className="tier-card-label">{t.label}</div>
            <div className="tier-card-points">{t.min_points}+ points</div>
            <div className="tier-card-reward">{t.reward}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-2" style={{ gap: 24, alignItems: "start" }}>
        {/* --- Reward history --- */}
        <div>
          <div className="section-title">
            <History size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
            Reward History
          </div>

          <div className="card">
            {ledger.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No points yet"
                description="Points are earned once a grievance is verified by an officer or resolved — not just when you submit it."
              />
            ) : (
              ledger.map((entry) => (
                <div key={entry._id} className="ledger-row">
                  <div>
                    <div className="ledger-row-label">{entry.label}</div>
                    <div className="ledger-row-meta">
                      {entry.grievance_id ? `${entry.grievance_id} • ` : ""}
                      {formatDate(entry.created_at)}
                    </div>
                  </div>
                  <div className={`ledger-row-points ${entry.points >= 0 ? "positive" : "negative"}`}>
                    {entry.points >= 0 ? "+" : ""}{entry.points}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* --- Leaderboard --- */}
        <div>
          <div className="section-title">Top Civic Contributors</div>

          <div className="card">
            {leaderboard === null ? (
              <SkeletonList rows={4} />
            ) : leaderboard.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No leaderboard yet"
                description="Be the first to earn civic points!"
              />
            ) : (
              leaderboard.map((row) => (
                <div key={row.citizen_id} className={`leaderboard-row ${row.rank <= 3 ? "leaderboard-top-3" : ""}`}>
                  <div className="leaderboard-rank">{row.rank}</div>
                  <div className="leaderboard-name">{row.name}</div>
                  <div className="leaderboard-points">{row.points} pts</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Rewards;