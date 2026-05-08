import { app } from "electron";
import Database from "better-sqlite3";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";
import type { ActivityLog, FocusSession, SessionSummary } from "../../shared";

export class FocusStore {
  private readonly db: Database.Database;

  constructor() {
    const dbDir = join(app.getPath("userData"), "data");
    mkdirSync(dbDir, { recursive: true });
    this.db = new Database(join(dbDir, "focus-aligned.sqlite"));
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        goal TEXT NOT NULL,
        allowed_activities TEXT NOT NULL,
        risky_activities TEXT NOT NULL,
        check_interval_seconds INTEGER NOT NULL,
        drift_threshold_minutes REAL NOT NULL,
        intervention_level TEXT NOT NULL,
        save_debug_thumbnails INTEGER NOT NULL,
        max_alerts_per_hour INTEGER NOT NULL,
        confidence_threshold REAL NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        paused INTEGER NOT NULL DEFAULT 0,
        snoozed_until TEXT
      );

      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        category TEXT NOT NULL,
        confidence REAL NOT NULL,
        alignment TEXT NOT NULL,
        alignment_confidence REAL NOT NULL,
        visible_text_summary TEXT NOT NULL,
        visual_summary TEXT NOT NULL,
        possible_risk_flags TEXT NOT NULL,
        thumbnail_path TEXT,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
      );
    `);
  }

  saveSession(session: FocusSession): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO sessions (
          id, goal, allowed_activities, risky_activities, check_interval_seconds,
          drift_threshold_minutes, intervention_level, save_debug_thumbnails,
          max_alerts_per_hour, confidence_threshold, started_at, ended_at, paused,
          snoozed_until
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        session.id,
        session.goal,
        session.allowedActivities,
        session.riskyActivities,
        session.checkIntervalSeconds,
        session.driftThresholdMinutes,
        session.interventionLevel,
        session.saveDebugThumbnails ? 1 : 0,
        session.maxAlertsPerHour,
        session.confidenceThreshold,
        session.startedAt,
        session.endedAt ?? null,
        session.paused ? 1 : 0,
        session.snoozedUntil ?? null
      );
  }

  updateSession(session: FocusSession): void {
    this.saveSession(session);
  }

  saveLog(log: ActivityLog): void {
    if (log.thumbnailPath) {
      mkdirSync(dirname(log.thumbnailPath), { recursive: true });
    }
    this.db
      .prepare(
        `INSERT INTO activity_logs (
          id, session_id, captured_at, category, confidence, alignment,
          alignment_confidence, visible_text_summary, visual_summary,
          possible_risk_flags, thumbnail_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        log.id,
        log.sessionId,
        log.capturedAt,
        log.category,
        log.confidence,
        log.alignment,
        log.alignmentConfidence,
        log.visibleTextSummary,
        log.visualSummary,
        JSON.stringify(log.possibleRiskFlags),
        log.thumbnailPath ?? null
      );
  }

  getRecentLogs(sessionId: string, limit = 60): ActivityLog[] {
    const rows = this.db
      .prepare("SELECT * FROM activity_logs WHERE session_id = ? ORDER BY captured_at DESC LIMIT ?")
      .all(sessionId, limit) as Array<Record<string, unknown>>;
    return rows.reverse().map((row) => this.rowToLog(row));
  }

  summarize(session: FocusSession): SessionSummary {
    const logs = this.getRecentLogs(session.id, 10000);
    const secondsPerLog = session.checkIntervalSeconds;
    const count = (state: string): number => logs.filter((log) => log.alignment === state).length * secondsPerLog;
    const driftCounts = new Map<string, number>();
    logs
      .filter((log) => log.alignment === "drift")
      .forEach((log) => driftCounts.set(log.category, (driftCounts.get(log.category) ?? 0) + 1));

    const totalSeconds = logs.length > 0 ? logs.length * secondsPerLog : this.elapsedSeconds(session);
    const topDriftCategories = Array.from(driftCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category: category as ActivityLog["category"], count }));

    return {
      session,
      totalSeconds,
      alignedSeconds: count("aligned"),
      weaklyAlignedSeconds: count("weakly_aligned"),
      driftSeconds: count("drift"),
      unknownSeconds: count("unknown"),
      topDriftCategories,
      neutralSummary: this.buildNeutralSummary(logs.length, topDriftCategories)
    };
  }

  private elapsedSeconds(session: FocusSession): number {
    const end = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
    return Math.max(0, Math.round((end - new Date(session.startedAt).getTime()) / 1000));
  }

  private buildNeutralSummary(logCount: number, topDriftCategories: SessionSummary["topDriftCategories"]): string {
    if (logCount === 0) return "No screen checks were recorded for this session.";
    if (topDriftCategories.length === 0) return "Most checks stayed aligned, weakly related, or uncertain.";
    return `Some checks may have drifted, most often around ${topDriftCategories[0].category.replaceAll("_", " ")}.`;
  }

  private rowToLog(row: Record<string, unknown>): ActivityLog {
    return {
      id: String(row.id),
      sessionId: String(row.session_id),
      capturedAt: String(row.captured_at),
      category: row.category as ActivityLog["category"],
      confidence: Number(row.confidence),
      alignment: row.alignment as ActivityLog["alignment"],
      alignmentConfidence: Number(row.alignment_confidence),
      visibleTextSummary: String(row.visible_text_summary),
      visualSummary: String(row.visual_summary),
      possibleRiskFlags: JSON.parse(String(row.possible_risk_flags)) as string[],
      thumbnailPath: row.thumbnail_path ? String(row.thumbnail_path) : undefined
    };
  }
}
