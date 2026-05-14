# SWTD-Studio

Desktop app for Amazon media production, evolved from `openclaw-hma`.

## Objective
Generate a complete SKU media package:
- 8 listing images
- 5 A+ Premium images
- 12–15s product video

## Current Stage
- Phase 0/1 scaffold in progress
- Private repo initialized under `Tieudi-Worker/SWTD-Studio`

## Structure
- `apps/desktop` — Electron + React shell
- `packages/core` — shared runtime/pipeline adapters
- `runtime` — inherited HMA pipeline engine
- `_shared` — doctrine/rules/prompts/knowledge
- `skills` — existing skill protocol assets

## Run (desktop scaffold)
```bash
cd apps/desktop
npm install
npm run dev
```

## Notes
This repository starts from `openclaw-hma` snapshot and is being transformed into a productized desktop application.
