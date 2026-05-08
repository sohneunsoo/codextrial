# Privacy and Security

Focus Aligned is local-first and privacy-first.

## What Is Captured

During an active, unpaused session, the app periodically captures a thumbnail of the current screen. The thumbnail is used as input for local activity analysis.

## Where Data Is Stored

Session metadata and activity logs are stored locally in SQLite under Electron's app user-data directory:

```powershell
$env:APPDATA\focus-aligned
```

Logs include:

- session goal and settings
- inferred activity category
- confidence score
- alignment state
- short text/visual summaries
- possible risk flags
- optional debug thumbnail path

## Are Screenshots Saved?

Raw screenshots are not saved permanently by default.

Debug thumbnails are also off by default. If enabled in a session, resized thumbnails are stored locally under the app user-data directory for troubleshooting.

## How To Disable Capture

- Use the privacy pause button during a session.
- Pause the session.
- End the session.
- Close the app.

## External API Use

External AI API support is not enabled in this MVP. If added later, it must be optional, disabled by default, and clearly labeled before any screenshot or derived image data leaves the machine.

## How To Delete Local Data

Close the app, then remove the app data directory:

```powershell
Remove-Item -Recurse -Force "$env:APPDATA\focus-aligned"
```

This removes the SQLite database and any optional debug thumbnails.

## Security Notes

- Treat screenshots as sensitive.
- Avoid enabling debug thumbnails unless you need to inspect classifier behavior.
- Prefer local OCR and local VLM models.
- If external providers are added, require an explicit opt-in and document exactly what is sent.
