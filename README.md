# Focus Aligned

Focus Aligned is a local-first Windows desktop MVP that helps you notice when the current screen activity may be drifting away from a chosen focus goal.

The app prioritizes screen-image-based analysis. The MVP captures the screen, runs a local heuristic classifier, compares the inferred activity with the current focus session, and nudges only after drift has continued beyond the configured threshold.

## Current MVP

- Electron + React + TypeScript desktop shell
- Focus session setup with goal, allowed/risky activity descriptions, check interval, drift threshold, and intervention level
- Periodic screen capture through Electron `desktopCapturer`
- Ephemeral screenshot handling by default
- Optional debug thumbnails, off by default
- Local classifier interface: `VisionClassifier.analyzeScreenshot(image)`
- Basic OCR/vision placeholder and heuristic classifier
- Alignment engine that prefers `unknown` when evidence is unclear
- SQLite local logging through `better-sqlite3`
- Dashboard with current activity, alignment state, timing estimates, timeline, pause/resume, snooze, and end session
- Daily/session summary after ending a session
- Local notifications with max-alert and snooze controls

## Setup

```powershell
cd E:\FocusAligned
npm install
npm run dev
```

For a production build:

```powershell
npm run build
```

## Privacy Defaults

- Screenshots are captured only for temporary local analysis.
- Raw screenshots are not saved permanently by default.
- Debug thumbnails are off by default and must be enabled per session.
- Logs are stored locally in SQLite under the app user-data directory.
- External AI API support is not implemented and is disabled by default.
- Use the privacy pause button to stop capture during a session.

See [privacy.md](privacy.md) for the full privacy and security notes.

## Vision Model Plug-In Point

The interface lives at `src/main/vision/VisionClassifier.ts`.

```ts
VisionClassifier.analyzeScreenshot(image) -> {
  category,
  confidence,
  visibleTextSummary,
  visualSummary,
  possibleRiskFlags
}
```

The current `HeuristicVisionClassifier` intentionally contains TODO comments for adding local OCR or a local VLM later. A stronger implementation can replace the class without changing the dashboard, drift detector, or SQLite schema.

## Data Deletion

Close the app, then delete the Focus Aligned app data directory:

```powershell
Remove-Item -Recurse -Force "$env:APPDATA\focus-aligned"
```

If you enabled debug thumbnails, they are inside that same app data directory.

## Repository

Target GitHub repository: <https://github.com/sohneunsoo/focusalign>

`git` is not available on PATH in this environment, so this MVP was created locally and is ready to be committed from a machine with Git installed.
