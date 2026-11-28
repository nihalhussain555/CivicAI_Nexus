import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Building2,
  Plus,
  Save,
  Timer,
  Trash2,
} from "lucide-react";
import {
  getSchedulerHealth,
  getSlaConfig,
  updateSlaConfig,
} from "../../services/slaService";
import ErrorState from "../../components/common/ErrorState";
import Skeleton from "../../components/common/Skeleton";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import { useDiagnostics, useErrorToast } from "../../hooks/useDiagnostics";
import { DEPARTMENTS, PRIORITIES } from "../../utils/constants";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SlaConfig = () => {
  const { user } = useAuth();
  const toast = useToast();
  const { capture } = useDiagnostics();
  const fail = useErrorToast();
  const isSuperAdmin = user?.role === "admin" && !user?.district;

  const [config, setConfig] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newOverride, setNewOverride] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getSlaConfig();
      setConfig(res.data);
    } catch (err) {
      setError(capture(err, { feature: "admin_list" }));
    }
  }, [capture]);

  useEffect(() => {
    load();
    // Health only decorates a badge; a miss falls back to "no badge" but still
    // has to reach the diagnostics dashboard.
    getSchedulerHealth()
      .then((res) => setHealth(res.data))
      .catch((err) => { capture(err, { feature: "analytics" }); setHealth(null); });
  }, [load, capture]);

  const set = (patch) => setConfig((c) => ({ ...c, ...patch }));
  const setNested = (key, patch) => setConfig((c) => ({ ...c, [key]: { ...c[key], ...patch } }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await updateSlaConfig({
        priority_hours: config.priority_hours,
        thresholds: config.thresholds,
        working_hours: config.working_hours,
        email_notifications: config.email_notifications,
        scheduler_interval_minutes: config.scheduler_interval_minutes,
        priority_change_policy: config.priority_change_policy,
        reopen_policy: config.reopen_policy,
        department_overrides: config.department_overrides,
      });
      setConfig(res.data);
      toast.success("SLA policy saved. New deadlines apply from the next sweep.");
    } catch (err) {
      fail(err, { feature: "admin_list", onRetry: save });
    } finally {
      setSaving(false);
    }
  };

  const addOverride = (department) => {
    if (!department || config.department_overrides[department]) return;
    setNested("department_overrides", {
      [department]: { ...config.priority_hours },
    });
    setNewOverride("");
  };

  const removeOverride = (department) => {
    const next = { ...config.department_overrides };
    delete next[department];
    set({ department_overrides: next });
  };

  if (error) {
    return (
      <div>
        <div className="page-header"><div><h1>SLA Settings</h1></div></div>
        <div className="card"><ErrorState diagnosis={error} title="Couldn't load SLA settings" onRetry={load} /></div>
      </div>
    );
  }
  if (!config) {
    return (
      <div>
        <div className="page-header"><div><h1>SLA Settings</h1></div></div>
        <div className="card"><Skeleton height={220} /></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>SLA Settings</h1>
          <p>Global deadline policy: durations, escalation thresholds and the background scheduler.</p>
        </div>
        {health && (
          <span className={`badge ${health.lease_live ? "badge-success" : "badge-neutral"}`}>
            <Activity size={12} style={{ marginRight: 5, verticalAlign: -2 }} />
            Scheduler {health.enabled ? (health.lease_live ? "live" : "idle") : "disabled"} ·
            {` sweep #${health.run_count}`} · every {health.interval_minutes}m
          </span>
        )}
      </div>

      {!isSuperAdmin && (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--warning)" }}>
          <p className="prose-sm">
            You can review the current policy, but only a super admin can change these settings.
          </p>
        </div>
      )}

      <div className="grid grid-2 chart-grid">
        <div className="card">
          <div className="section-title"><Timer size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Deadline durations (hours)</div>
          {PRIORITIES.map((p) => (
            <div key={p} className="kv-row">
              <span>{p.charAt(0) + p.slice(1).toLowerCase()}</span>
              <input className="input" type="number" min={1} max={8760} style={{ width: 120, textAlign: "right" }}
                     disabled={!isSuperAdmin}
                     value={config.priority_hours[p] ?? ""}
                     onChange={(e) => setNested("priority_hours", { [p]: e.target.value })} />
            </div>
          ))}
          <p className="prose-sm" style={{ marginTop: 8 }}>
            Applied when a complaint is registered. Existing cases keep the deadline they were given.
          </p>
        </div>

        <div className="card">
          <div className="section-title">Escalation thresholds (share of window elapsed)</div>
          {[
            ["warning", "Warn the officer"],
            ["urgent", "Urgent + supervisor"],
            ["breach", "Mark breached + department"],
            ["senior", "Senior authority"],
          ].map(([key, label]) => (
            <div key={key} className="kv-row">
              <span>{label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input className="input" type="number" step="0.05" min="0.05" max="5" style={{ width: 90, textAlign: "right" }}
                       disabled={!isSuperAdmin}
                       value={config.thresholds[key] ?? ""}
                       onChange={(e) => setNested("thresholds", { [key]: e.target.value })} />
                <span className="record-id">{Math.round((Number(config.thresholds[key]) || 0) * 100)}%</span>
              </div>
            </div>
          ))}
          <p className="prose-sm" style={{ marginTop: 8 }}>
            Must increase: warning &lt; urgent ≤ breach &lt; senior. Each threshold fires at most
            once per deadline cycle.
          </p>
        </div>

        <div className="card">
          <div className="section-title">Working hours vs calendar hours</div>
          <div className="kv-row">
            <span>Count only working hours</span>
            <input type="checkbox" checked={config.working_hours.enabled} disabled={!isSuperAdmin}
                   onChange={(e) => setNested("working_hours", { enabled: e.target.checked })} />
          </div>
          <div className="kv-row">
            <span>Day starts (UTC hour)</span>
            <input className="input" type="number" min={0} max={23} style={{ width: 90, textAlign: "right" }}
                   disabled={!isSuperAdmin || !config.working_hours.enabled}
                   value={config.working_hours.start_hour}
                   onChange={(e) => setNested("working_hours", { start_hour: e.target.value })} />
          </div>
          <div className="kv-row">
            <span>Day ends (UTC hour)</span>
            <input className="input" type="number" min={0} max={23} style={{ width: 90, textAlign: "right" }}
                   disabled={!isSuperAdmin || !config.working_hours.enabled}
                   value={config.working_hours.end_hour}
                   onChange={(e) => setNested("working_hours", { end_hour: e.target.value })} />
          </div>
          <div style={{ marginTop: 8 }}>
            {WEEKDAYS.map((d, i) => (
              <label key={d} className="filter-pill" style={{ marginRight: 6, cursor: isSuperAdmin ? "pointer" : "default" }}>
                <input type="checkbox" style={{ marginRight: 4 }} checked={config.working_hours.work_days.includes(i)}
                       disabled={!isSuperAdmin || !config.working_hours.enabled}
                       onChange={() => {
                         const has = config.working_hours.work_days.includes(i);
                         const days = has
                           ? config.working_hours.work_days.filter((x) => x !== i)
                           : [...config.working_hours.work_days, i].sort();
                         setNested("working_hours", { work_days: days });
                       }} />
                {d}
              </label>
            ))}
          </div>
          <p className="prose-sm" style={{ marginTop: 8 }}>
            When disabled, deadlines run on plain 24/7 calendar hours. Times are UTC.
          </p>
        </div>

        <div className="card">
          <div className="section-title">Policies</div>
          <div className="kv-row">
            <span>On priority change</span>
            <select className="select" style={{ width: 210 }} disabled={!isSuperAdmin}
                    value={config.priority_change_policy}
                    onChange={(e) => set({ priority_change_policy: e.target.value })}>
              <option value="RECALCULATE">Recalculate window, keep original start</option>
              <option value="KEEP">Keep the existing deadline</option>
            </select>
          </div>
          <div className="kv-row">
            <span>On reopen</span>
            <select className="select" style={{ width: 210 }} disabled={!isSuperAdmin}
                    value={config.reopen_policy}
                    onChange={(e) => set({ reopen_policy: e.target.value })}>
              <option value="NEW_SLA">Start a fresh full SLA</option>
              <option value="REMAINING">Give only the remaining time</option>
            </select>
          </div>
          <div className="kv-row">
            <span>Email escalation</span>
            <input type="checkbox" checked={config.email_notifications} disabled={!isSuperAdmin}
                   onChange={(e) => set({ email_notifications: e.target.checked })} />
          </div>
          <div className="kv-row">
            <span>Scheduler interval (min)</span>
            <input className="input" type="number" min={1} max={1440} style={{ width: 90, textAlign: "right" }}
                   disabled={!isSuperAdmin}
                   value={config.scheduler_interval_minutes}
                   onChange={(e) => set({ scheduler_interval_minutes: e.target.value })} />
          </div>
          <p className="prose-sm" style={{ marginTop: 8 }}>
            Email requires SMTP to be configured on the backend; in-app notifications always fire.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title"><Building2 size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Department-specific durations</div>
        {Object.keys(config.department_overrides).length === 0 && (
          <p className="prose-sm">No overrides — every department uses the global durations above.</p>
        )}
        {Object.entries(config.department_overrides).map(([dept, hours]) => (
          <div key={dept} className="list-row list-row-start">
            <div className="list-row-main">
              <div>
                <div className="list-row-title">{dept}</div>
                <div className="badge-row" style={{ marginTop: 6 }}>
                  {PRIORITIES.map((p) => (
                    <span key={p} className="badge badge-neutral">
                      {p.charAt(0) + p.slice(1).toLowerCase()}:{" "}
                      <input
                        className="input"
                        type="number" min={1} max={8760}
                        style={{ width: 64, marginLeft: 4, padding: "1px 4px", textAlign: "right" }}
                        disabled={!isSuperAdmin}
                        value={hours[p] ?? ""}
                        onChange={(e) => setNested("department_overrides", {
                          [dept]: { ...hours, [p]: e.target.value },
                        })}
                      />
                      h
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {isSuperAdmin && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeOverride(dept)}>
                <Trash2 size={14} /> Remove
              </button>
            )}
          </div>
        ))}
        {isSuperAdmin && (
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <select className="select" style={{ maxWidth: 280 }} value={newOverride}
                    onChange={(e) => setNewOverride(e.target.value)}>
              <option value="">Add an override…</option>
              {DEPARTMENTS
                .filter((d) => !config.department_overrides[d])
                .map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => addOverride(newOverride)} disabled={!newOverride}>
              <Plus size={14} /> Add
            </button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={saving}>
          Discard changes
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={!isSuperAdmin || saving}>
          <Save size={14} /> {saving ? "Saving…" : "Save SLA policy"}
        </button>
      </div>
    </div>
  );
};

export default SlaConfig;
