# TOOLS.md — Local Notes

> Documentation index: https://docs.openclaw.ai/llms.txt
> This file is **local-only** and **not shared**. Skills are shareable; setup is yours.

## Required Environment

| Var | Where set | Purpose |
|-----|-----------|---------|
| `KIE_KEY` | `runtime/.env` | KIE.ai API key for nano-banana-pro / seedream-4 / kling-3.0 |
| `LOG_LEVEL` | optional | `info` (default), `debug`, `warn`, `error` |
| `LOG_FILE` | optional | absolute path to JSON log file |

`runtime/.env` is gitignored. Copy from `runtime/.env.example` and fill `KIE_KEY=sk-...`.

## Self-Contained Layout (v0.1.1)

The skill pack ships as a single folder. Legacy production code is embedded under `runtime/legacy/`. No external dependency on `D:\AI PROJECT\handmade-media-agent-v0\`.

| Purpose | Path |
|---------|------|
| Skill pack root (this) | `<install-path>\openclaw-hma\` |
| Embedded legacy code | `<install-path>\openclaw-hma\runtime\legacy\` |
| Per-user SKU data | `<install-path>\openclaw-hma\data\<SKU>\` |
| Openclaw workspace mount | `%USERPROFILE%\.openclaw\workspace\openclaw-hma\` (symlink) |
| Node binary | `C:\Program Files\nodejs\node.exe` (Windows default) |

## One-Shot Install

Run from PowerShell at the openclaw-hma folder:

```powershell
.\setup.ps1
```

This will:
1. `npm install` in `runtime/legacy/` (sharp, pino, dotenv)
2. `npm install` in `runtime/` (dotenv)
3. Create `runtime/.env` from `.env.example` if missing
4. Print the next manual step (fill KIE_KEY)

## Manual Mount Commands

After `setup.ps1` and filling `runtime/.env`:

**Symlink workspace into Openclaw (Windows admin cmd):**
```cmd
mklink /D "%USERPROFILE%\.openclaw\workspace\openclaw-hma" "<install-path>\openclaw-hma"
```

**Or copy without admin (re-copy after edits):**
```cmd
xcopy /E /I /Y "<install-path>\openclaw-hma" "%USERPROFILE%\.openclaw\workspace\openclaw-hma"
```

## Default SKU Folder

When user invokes `/hma-master` without args, default to `data/_active/` (a symlink user points at the SKU currently iterating). If `_active` doesn't exist, list `data/*/` and ask which.

## Notes

- **Sharp on Windows:** needs MSVC redistributable. If `npm install` fails, install Visual C++ 2015-2022 Redistributable first.
- **KIE.ai timeouts:** image 10 min / video 20 min / fast 6 min — configured in `runtime/legacy/utils/kie-client.js`.
- **Antivirus EBUSY:** exclude `<install-path>\openclaw-hma\data\` from real-time scan if sharp write fails.
- **Override embedded legacy:** set `HMA_LEGACY_ROOT` in `runtime/.env` if you want bridge to point at a different copy (advanced — rarely needed).

## Related

- `AGENTS.md` — what HMA does
- `runtime/.env.example` — env template
- `runtime/README.md` — runtime architecture
- `setup.ps1` / `pack.ps1` — install / package scripts
