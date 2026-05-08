export type ActivityCategory =
  | "writing_document_editing"
  | "coding"
  | "design_visual_editing"
  | "research_reading"
  | "video_tutorial"
  | "video_entertainment"
  | "sns_feed_scrolling"
  | "chat_messaging"
  | "shopping"
  | "idle_unknown";

export type AlignmentState = "aligned" | "weakly_aligned" | "drift" | "unknown";
export type InterventionLevel = "silent" | "tray" | "popup";
export type CheckIntervalSeconds = 30 | 60 | 180;

export interface SessionConfig {
  goal: string;
  allowedActivities: string;
  riskyActivities: string;
  checkIntervalSeconds: CheckIntervalSeconds;
  driftThresholdMinutes: number;
  interventionLevel: InterventionLevel;
  saveDebugThumbnails: boolean;
  maxAlertsPerHour: number;
  confidenceThreshold: number;
}

export interface FocusSession extends SessionConfig {
  id: string;
  startedAt: string;
  endedAt?: string;
  paused: boolean;
  snoozedUntil?: string;
}

export interface VisionAnalysis {
  category: ActivityCategory;
  confidence: number;
  visibleTextSummary: string;
  visualSummary: string;
  possibleRiskFlags: string[];
  source: "heuristic" | "local_vlm" | "external_api";
}

export interface AlignmentResult {
  state: AlignmentState;
  confidence: number;
  rationale: string;
}

export interface ActivityLog {
  id: string;
  sessionId: string;
  capturedAt: string;
  category: ActivityCategory;
  confidence: number;
  alignment: AlignmentState;
  alignmentConfidence: number;
  visibleTextSummary: string;
  visualSummary: string;
  possibleRiskFlags: string[];
  thumbnailPath?: string;
}

export interface SessionSummary {
  session: FocusSession;
  totalSeconds: number;
  alignedSeconds: number;
  weaklyAlignedSeconds: number;
  driftSeconds: number;
  unknownSeconds: number;
  topDriftCategories: Array<{ category: ActivityCategory; count: number }>;
  neutralSummary: string;
}

export interface AppState {
  activeSession?: FocusSession;
  latestLog?: ActivityLog;
  timeline: ActivityLog[];
  summary?: SessionSummary;
  driftSeconds: number;
  privacyPaused: boolean;
  alertsThisHour: number;
}
