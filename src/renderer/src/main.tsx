import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Bell, Clock, EyeOff, Pause, Play, Shield, Square, TimerReset } from "lucide-react";
import type { ActivityLog, AppState, SessionConfig } from "../../shared";
import "./styles.css";

const defaultConfig: SessionConfig = {
  goal: "Work on AI portfolio PPT",
  allowedActivities: "slide editing, design reference, ChatGPT planning, image generation",
  riskyActivities: "SNS feed, random YouTube, unrelated shopping",
  checkIntervalSeconds: 30,
  driftThresholdMinutes: 5,
  interventionLevel: "tray",
  saveDebugThumbnails: false,
  maxAlertsPerHour: 3,
  confidenceThreshold: 0.55
};

function App(): JSX.Element {
  const [state, setState] = useState<AppState>({ timeline: [], driftSeconds: 0, privacyPaused: false, alertsThisHour: 0 });

  useEffect(() => {
    void window.focusAligned.getState().then(setState);
    return window.focusAligned.onState(setState);
  }, []);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>Focus Aligned</h1>
          <p>Local screen checks for gentle focus drift awareness.</p>
        </div>
        <div className="privacy-pill">
          <Shield size={16} />
          <span>{state.privacyPaused ? "Capture paused" : "Local-first capture"}</span>
        </div>
      </header>

      {!state.activeSession ? (
        <SessionSetup summary={state.summary} onStarted={() => window.focusAligned.getState().then(setState)} />
      ) : (
        <Dashboard state={state} />
      )}
    </main>
  );
}

function SessionSetup({ summary, onStarted }: { summary?: AppState["summary"]; onStarted: () => void }): JSX.Element {
  const [config, setConfig] = useState<SessionConfig>(defaultConfig);
  const update = <K extends keyof SessionConfig>(key: K, value: SessionConfig[K]): void => setConfig((current) => ({ ...current, [key]: value }));

  return (
    <section className="setup-grid">
      <form
        className="setup-form"
        onSubmit={(event) => {
          event.preventDefault();
          void window.focusAligned.startSession(config).then(onStarted);
        }}
      >
        <label>
          Session goal
          <input value={config.goal} onChange={(event) => update("goal", event.target.value)} required />
        </label>
        <label>
          Allowed activity descriptions
          <textarea value={config.allowedActivities} onChange={(event) => update("allowedActivities", event.target.value)} />
        </label>
        <label>
          Risky activity descriptions
          <textarea value={config.riskyActivities} onChange={(event) => update("riskyActivities", event.target.value)} />
        </label>

        <div className="form-row">
          <label>
            Check interval
            <select value={config.checkIntervalSeconds} onChange={(event) => update("checkIntervalSeconds", Number(event.target.value) as SessionConfig["checkIntervalSeconds"])}>
              <option value={30}>30 sec</option>
              <option value={60}>1 min</option>
              <option value={180}>3 min</option>
            </select>
          </label>
          <label>
            Drift threshold
            <input type="number" min={1} max={60} value={config.driftThresholdMinutes} onChange={(event) => update("driftThresholdMinutes", Number(event.target.value))} />
          </label>
        </div>

        <div className="form-row">
          <label>
            Intervention
            <select value={config.interventionLevel} onChange={(event) => update("interventionLevel", event.target.value as SessionConfig["interventionLevel"])}>
              <option value="silent">Silent log only</option>
              <option value="tray">Small tray notification</option>
              <option value="popup">Visible popup</option>
            </select>
          </label>
          <label>
            Max alerts / hour
            <input type="number" min={1} max={12} value={config.maxAlertsPerHour} onChange={(event) => update("maxAlertsPerHour", Number(event.target.value))} />
          </label>
        </div>

        <div className="form-row">
          <label>
            Confidence threshold
            <input type="number" min={0.35} max={0.9} step={0.05} value={config.confidenceThreshold} onChange={(event) => update("confidenceThreshold", Number(event.target.value))} />
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={config.saveDebugThumbnails} onChange={(event) => update("saveDebugThumbnails", event.target.checked)} />
            Save debug thumbnails
          </label>
        </div>

        <button className="primary-button" type="submit">
          <Play size={18} />
          Start session
        </button>
      </form>

      <aside className="summary-panel">
        <h2>Session summary</h2>
        {summary ? <Summary summary={summary} /> : <p>No completed session yet.</p>}
      </aside>
    </section>
  );
}

function Dashboard({ state }: { state: AppState }): JSX.Element {
  const session = state.activeSession;
  if (!session) throw new Error("Dashboard requires an active session.");
  const totals = useMemo(() => deriveTotals(state.timeline, session.checkIntervalSeconds), [state.timeline, session.checkIntervalSeconds]);

  return (
    <section className="dashboard">
      <div className="dashboard-top">
        <div>
          <span className="eyebrow">Current session</span>
          <h2>{session.goal}</h2>
          <p>{state.latestLog?.visualSummary ?? "Waiting for the first screen check."}</p>
        </div>
        <div className={`state-badge ${state.latestLog?.alignment ?? "unknown"}`}>{label(state.latestLog?.alignment ?? "unknown")}</div>
      </div>

      <div className="control-strip">
        <button title="Pause capture" onClick={() => window.focusAligned.updatePrivacyPaused(!state.privacyPaused)}>
          {state.privacyPaused ? <EyeOff size={18} /> : <Shield size={18} />}
          {state.privacyPaused ? "Resume capture" : "Privacy pause"}
        </button>
        <button title="Pause session" onClick={() => (session.paused ? window.focusAligned.resumeSession() : window.focusAligned.pauseSession())}>
          {session.paused ? <Play size={18} /> : <Pause size={18} />}
          {session.paused ? "Resume session" : "Pause session"}
        </button>
        <button title="Snooze nudges" onClick={() => window.focusAligned.snooze(15)}>
          <TimerReset size={18} />
          Snooze 15 min
        </button>
        <button title="End session" onClick={() => window.focusAligned.endSession()}>
          <Square size={18} />
          End session
        </button>
      </div>

      <div className="metric-grid">
        <Metric icon={<Clock size={18} />} label="Aligned" value={formatDuration(totals.aligned)} />
        <Metric icon={<Bell size={18} />} label="Weakly related" value={formatDuration(totals.weaklyAligned)} />
        <Metric icon={<Pause size={18} />} label="Drift" value={formatDuration(totals.drift)} />
        <Metric icon={<EyeOff size={18} />} label="Unknown" value={formatDuration(totals.unknown)} />
      </div>

      <div className="activity-panel">
        <div>
          <h3>Current inferred activity</h3>
          <p>{state.latestLog ? state.latestLog.category.replaceAll("_", " ") : "No check recorded yet."}</p>
        </div>
        <div>
          <h3>Continuous drift</h3>
          <p>{formatDuration(state.driftSeconds)}</p>
        </div>
        <div>
          <h3>Alerts this hour</h3>
          <p>{state.alertsThisHour}</p>
        </div>
      </div>

      <Timeline logs={state.timeline} />
    </section>
  );
}

function Timeline({ logs }: { logs: ActivityLog[] }): JSX.Element {
  return (
    <section className="timeline">
      <h3>Recent timeline</h3>
      {logs.length === 0 ? (
        <p>No activity checks yet.</p>
      ) : (
        <ol>
          {logs.slice().reverse().map((log) => (
            <li key={log.id}>
              <time>{new Date(log.capturedAt).toLocaleTimeString()}</time>
              <span className={`dot ${log.alignment}`} />
              <strong>{label(log.alignment)}</strong>
              <span>{log.category.replaceAll("_", " ")}</span>
              <small>{Math.round(log.alignmentConfidence * 100)}%</small>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Summary({ summary }: { summary: NonNullable<AppState["summary"]> }): JSX.Element {
  return (
    <div className="summary-list">
      <p>{summary.neutralSummary}</p>
      <span>Total: {formatDuration(summary.totalSeconds)}</span>
      <span>Aligned: {formatDuration(summary.alignedSeconds)}</span>
      <span>Weakly related: {formatDuration(summary.weaklyAlignedSeconds)}</span>
      <span>Drift: {formatDuration(summary.driftSeconds)}</span>
      <span>Unknown: {formatDuration(summary.unknownSeconds)}</span>
    </div>
  );
}

function Metric({ icon, label: metricLabel, value }: { icon: React.ReactNode; label: string; value: string }): JSX.Element {
  return (
    <div className="metric">
      {icon}
      <span>{metricLabel}</span>
      <strong>{value}</strong>
    </div>
  );
}

function deriveTotals(logs: ActivityLog[], interval: number): Record<"aligned" | "weaklyAligned" | "drift" | "unknown", number> {
  return {
    aligned: logs.filter((log) => log.alignment === "aligned").length * interval,
    weaklyAligned: logs.filter((log) => log.alignment === "weakly_aligned").length * interval,
    drift: logs.filter((log) => log.alignment === "drift").length * interval,
    unknown: logs.filter((log) => log.alignment === "unknown").length * interval
  };
}

function label(value: ActivityLog["alignment"]): string {
  return value.replace("_", " ");
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes === 0) return `${remaining}s`;
  return `${minutes}m ${remaining}s`;
}

createRoot(document.getElementById("root")!).render(<App />);
