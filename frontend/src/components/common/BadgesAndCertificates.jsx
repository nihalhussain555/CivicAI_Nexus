import { useEffect, useState } from "react";
import { Award, Download } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { getMyRewards, downloadCertificate } from "../../services/rewardService";
import { getMyOfficerBadges, downloadOfficerCertificate } from "../../services/officerService";

const BadgesAndCertificates = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [badges, setBadges] = useState(null); // normalized: [{key,label,icon,earned,target,progress}]

  useEffect(() => {
    if (user?.role === "citizen") {
      getMyRewards().then((res) => {
        const { total_points, all_tiers } = res.data;
        setBadges(
          all_tiers.map((t) => ({
            key: t.key, label: t.label, icon: t.icon,
            earned: total_points >= t.min_points, target: t.min_points, progress: total_points,
          }))
        );
      }).catch(() => setBadges([]));
    } else if (user?.role === "officer") {
      getMyOfficerBadges().then((res) => setBadges(res.data)).catch(() => setBadges([]));
    } else {
      setBadges([]);
    }
  }, [user?.role]);

  const download = async (badge) => {
    try {
      if (user.role === "citizen") {
        await downloadCertificate(badge.key, `CivicAI_${badge.label.replace(/\s+/g, "_")}_Certificate.pdf`);
      } else {
        await downloadOfficerCertificate(badge.key, `CivicAI_Officer_${badge.label.replace(/\s+/g, "_")}_Certificate.pdf`);
      }
    } catch {
      toast.error("Couldn't download certificate — please try again.");
    }
  };

  if (!badges || badges.length === 0) return null;

  return (
    <div className="card">
      <div className="section-title">
        <Award size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
        Badges &amp; Certificates
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
        {badges.map((b) => (
          <div
            key={b.key}
            className="card"
            style={{
              textAlign: "center", padding: 14,
              opacity: b.earned ? 1 : 0.45,
              borderColor: b.earned ? "var(--accent)" : "var(--border)",
            }}
          >
            <div style={{ fontSize: 28 }}>{b.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 12.5, marginTop: 6 }}>{b.label}</div>
            {b.earned ? (
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => download(b)}>
                <Download size={12} /> Download
              </button>
            ) : (
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>Not yet earned</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BadgesAndCertificates;