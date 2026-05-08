# Test Checklist

## Install and Launch

- [ ] `npm install` completes.
- [ ] `npm run dev` opens the Electron app.
- [ ] The app shows the session setup screen.

## Session Setup

- [ ] Start a session with a custom goal.
- [ ] Change check interval to 30 sec, 1 min, and 3 min.
- [ ] Change drift threshold.
- [ ] Switch intervention level between silent, tray, and popup.
- [ ] Confirm debug thumbnails are off by default.

## Capture and Classification

- [ ] Start a session and wait for the first check.
- [ ] Confirm current inferred activity updates.
- [ ] Confirm timeline entries are added.
- [ ] Confirm no raw screenshots are created by default.
- [ ] Enable debug thumbnails in a test session and confirm resized thumbnails are created locally.

## Alignment and Drift

- [ ] Open a goal-related app such as PowerPoint, Canva, Figma, VS Code, or ChatGPT.
- [ ] Confirm the state is aligned, weakly aligned, or unknown.
- [ ] Open a risky page such as social feed, shorts, or shopping.
- [ ] Confirm drift appears only when confidence is high enough.
- [ ] Confirm low-confidence checks become unknown instead of drift.

## Notifications

- [ ] Silent mode logs drift without notification.
- [ ] Tray mode shows a light notification after continuous drift threshold.
- [ ] Popup mode brings attention to the app after threshold.
- [ ] Snooze prevents alerts.
- [ ] Max alerts per hour is respected.

## Pause and End Session

- [ ] Privacy pause stops capture.
- [ ] Resume capture restarts checks.
- [ ] Pause session stops checks.
- [ ] End session shows summary.
- [ ] Summary includes total, aligned, weakly aligned, drift, unknown, and top drift categories.

## Data Deletion

- [ ] Close app.
- [ ] Delete `$env:APPDATA\focus-aligned`.
- [ ] Relaunch and confirm prior logs are gone.
