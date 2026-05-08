# Architecture

## Goals

Focus Aligned is designed as a privacy-first local desktop app. Screenshots are treated as sensitive transient input, not as durable records. The architecture keeps capture, classification, alignment scoring, drift detection, logging, and UI presentation in separate modules so better local vision models can be added later.

## Process Layout

- `src/main`: Electron main process, privacy-sensitive services, SQLite logging, notifications
- `src/preload`: typed IPC bridge exposed to the renderer
- `src/renderer`: React dashboard and session setup UI
- `src/shared.ts`: shared domain types

## Core Flow

1. User starts a focus session in the renderer.
2. Main process stores the session in SQLite.
3. A timer triggers `ScreenCaptureService`.
4. The captured screen image is passed to `VisionClassifier`.
5. `scoreAlignment` compares the classifier output with the session goal and allowed/risky descriptions.
6. The activity log is stored locally without raw screenshots by default.
7. Drift state is accumulated.
8. Notifications are shown only when threshold, confidence, snooze, and rate-limit rules allow it.
9. The renderer receives updated state through IPC.

## Modules

### Screen Capture

`src/main/services/screenCapture.ts`

Uses Electron `desktopCapturer` to capture a display thumbnail. The screenshot data URL is passed in memory to the classifier. It is not written to disk unless debug thumbnails are enabled.

### Vision Classification

`src/main/vision/VisionClassifier.ts`

Stable interface for swappable classifiers.

`src/main/vision/HeuristicVisionClassifier.ts`

Current MVP implementation. It uses available observable text and simple keyword heuristics. The class includes TODOs for local OCR and local VLM integration.

Future options:

- Windows OCR through a Python helper or native Windows APIs
- Tesseract OCR
- Local multimodal model through a Python service
- Optional external AI provider, disabled by default and gated by an explicit setting

### Alignment Engine

`src/main/services/alignmentEngine.ts`

Compares the classifier output with the active goal. It intentionally avoids overjudging: low confidence or unclear categories become `unknown`, not `drift`.

### Drift Detection

`src/main/index.ts`

Tracks continuous drift seconds and only notifies when:

- drift continues beyond the configured threshold
- confidence is above the session threshold
- the session is not snoozed
- max alerts per hour has not been reached
- intervention level is not silent

### Storage

`src/main/database/store.ts`

SQLite file is stored under Electron `app.getPath("userData")`. Tables:

- `sessions`
- `activity_logs`

No raw screenshot column exists. Optional thumbnail paths are recorded only when debug thumbnails are enabled.

## Python Helper Slot

A Python helper service can be added later for OCR or local VLM inference. Recommended contract:

- Electron sends a temporary image buffer over stdin, local HTTP, or a named pipe.
- Python returns the `VisionAnalysis` shape.
- Python never persists raw screenshots unless explicitly configured.

Keep the TypeScript `VisionClassifier` interface as the boundary.
