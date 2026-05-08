import { app, BrowserWindow, ipcMain, nativeImage, Notification, shell } from "electron";
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { FocusStore } from "./database/store";
import { ScreenCaptureService } from "./services/screenCapture";
import { scoreAlignment } from "./services/alignmentEngine";
import { HeuristicVisionClassifier } from "./vision/HeuristicVisionClassifier";
import type { ActivityLog, AppState, FocusSession, SessionConfig, SessionSummary } from "../shared";

let mainWindow: BrowserWindow | undefined;
let store: FocusStore;
let captureService: ScreenCaptureService;
let classifier: HeuristicVisionClassifier;
let activeSession: FocusSession | undefined;
let latestLog: ActivityLog | undefined;
let summary: SessionSummary | undefined;
let timer: NodeJS.Timeout | undefined;
let privacyPaused = false;
let continuousDriftSeconds = 0;
let alertTimestamps: number[] = [];

const isDev = process.env.NODE_ENV === "development";

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    title: "Focus Aligned",
    backgroundColor: "#f7f5ef",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  store = new FocusStore();
  captureService = new ScreenCaptureService();
  classifier = new HeuristicVisionClassifier();
  registerIpc();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function registerIpc(): void {
  ipcMain.handle("app:get-state", () => buildState());
  ipcMain.handle("session:start", (_event, config: SessionConfig) => startSession(config));
  ipcMain.handle("session:pause", () => setSessionPaused(true));
  ipcMain.handle("session:resume", () => setSessionPaused(false));
  ipcMain.handle("session:snooze", (_event, minutes: number) => snooze(minutes));
  ipcMain.handle("session:end", () => endSession());
  ipcMain.handle("privacy:set-paused", (_event, paused: boolean) => setPrivacyPaused(paused));
}

function startSession(config: SessionConfig): FocusSession {
  clearTimer();
  activeSession = {
    ...config,
    id: randomUUID(),
    startedAt: new Date().toISOString(),
    paused: false
  };
  latestLog = undefined;
  summary = undefined;
  continuousDriftSeconds = 0;
  alertTimestamps = [];
  store.saveSession(activeSession);
  scheduleNextCheck(1000);
  broadcastState();
  return activeSession;
}

function setSessionPaused(paused: boolean): void {
  if (!activeSession) return;
  activeSession.paused = paused;
  store.updateSession(activeSession);
  if (paused) clearTimer();
  else scheduleNextCheck(1000);
  broadcastState();
}

function setPrivacyPaused(paused: boolean): void {
  privacyPaused = paused;
  if (paused) clearTimer();
  else if (activeSession && !activeSession.paused) scheduleNextCheck(1000);
  broadcastState();
}

function snooze(minutes: number): void {
  if (!activeSession) return;
  activeSession.snoozedUntil = new Date(Date.now() + minutes * 60_000).toISOString();
  store.updateSession(activeSession);
  broadcastState();
}

function endSession(): SessionSummary | undefined {
  if (!activeSession) return summary;
  clearTimer();
  activeSession.endedAt = new Date().toISOString();
  store.updateSession(activeSession);
  summary = store.summarize(activeSession);
  activeSession = undefined;
  latestLog = undefined;
  continuousDriftSeconds = 0;
  broadcastState();
  return summary;
}

function scheduleNextCheck(delayMs?: number): void {
  clearTimer();
  if (!activeSession || activeSession.paused || privacyPaused) return;
  timer = setTimeout(() => void runCheck(), delayMs ?? activeSession.checkIntervalSeconds * 1000);
}

async function runCheck(): Promise<void> {
  if (!activeSession || activeSession.paused || privacyPaused) return;
  try {
    const capture = await captureService.capturePrimaryScreen();
    const analysis = await classifier.analyzeScreenshot(capture);
    const alignment = scoreAlignment(activeSession, analysis);
    const thumbnailPath = activeSession.saveDebugThumbnails ? saveDebugThumbnail(activeSession.id, capture.dataUrl) : undefined;

    latestLog = {
      id: randomUUID(),
      sessionId: activeSession.id,
      capturedAt: new Date().toISOString(),
      category: analysis.category,
      confidence: analysis.confidence,
      alignment: alignment.state,
      alignmentConfidence: alignment.confidence,
      visibleTextSummary: analysis.visibleTextSummary,
      visualSummary: `${analysis.visualSummary} ${alignment.rationale}`,
      possibleRiskFlags: analysis.possibleRiskFlags,
      thumbnailPath
    };
    store.saveLog(latestLog);
    updateDriftAndMaybeNotify(latestLog);
    broadcastState();
  } catch (error) {
    latestLog = {
      id: randomUUID(),
      sessionId: activeSession.id,
      capturedAt: new Date().toISOString(),
      category: "idle_unknown",
      confidence: 0,
      alignment: "unknown",
      alignmentConfidence: 0,
      visibleTextSummary: "Capture or classification failed.",
      visualSummary: error instanceof Error ? error.message : "Unknown capture error.",
      possibleRiskFlags: []
    };
    store.saveLog(latestLog);
    broadcastState();
  } finally {
    scheduleNextCheck();
  }
}

function updateDriftAndMaybeNotify(log: ActivityLog): void {
  if (!activeSession) return;
  const thresholdSeconds = activeSession.driftThresholdMinutes * 60;
  const snoozed = activeSession.snoozedUntil && new Date(activeSession.snoozedUntil).getTime() > Date.now();
  continuousDriftSeconds = log.alignment === "drift" ? continuousDriftSeconds + activeSession.checkIntervalSeconds : 0;
  alertTimestamps = alertTimestamps.filter((time) => Date.now() - time < 60 * 60_000);

  if (
    log.alignment !== "drift" ||
    log.alignmentConfidence < activeSession.confidenceThreshold ||
    continuousDriftSeconds < thresholdSeconds ||
    snoozed ||
    alertTimestamps.length >= activeSession.maxAlertsPerHour ||
    activeSession.interventionLevel === "silent"
  ) {
    return;
  }

  alertTimestamps.push(Date.now());
  if (activeSession.interventionLevel === "tray") {
    new Notification({
      title: "Focus Aligned",
      body: "This may be drifting from your session goal.",
      silent: true
    }).show();
  } else if (activeSession.interventionLevel === "popup") {
    mainWindow?.webContents.send("app:state", buildState());
    mainWindow?.show();
    new Notification({
      title: "Focus Aligned",
      body: "This may be drifting from your session goal. You can snooze or adjust your session.",
      silent: true
    }).show();
  }
}

function saveDebugThumbnail(sessionId: string, dataUrl: string): string {
  const dir = join(app.getPath("userData"), "debug-thumbnails", sessionId);
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${Date.now()}.png`);
  const image = nativeImage.createFromDataURL(dataUrl).resize({ width: 320 });
  writeFileSync(filePath, image.toPNG());
  return filePath;
}

function clearTimer(): void {
  if (timer) clearTimeout(timer);
  timer = undefined;
}

function buildState(): AppState {
  return {
    activeSession,
    latestLog,
    timeline: activeSession ? store.getRecentLogs(activeSession.id, 40) : [],
    summary,
    driftSeconds: continuousDriftSeconds,
    privacyPaused,
    alertsThisHour: alertTimestamps.length
  };
}

function broadcastState(): void {
  mainWindow?.webContents.send("app:state", buildState());
}
