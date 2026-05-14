# VERIFICATION.md

What's verified (automated) and what still needs your hand (manual).

## v0.1.1 — Embedded Legacy

The skill pack is now fully self-contained. Production code lives under `runtime/legacy/`. No external folder dependency.

## Automated — passed

| Check | Result |
|-------|--------|
| 13 `SKILL.md` files exist under `skills/hma-*/` | ✅ |
| 5 user-invocable skills (`hma-master`, `hma-listing`, `hma-aplus`, `hma-video`, `hma-knowledge`) | ✅ |
| 8 internal skills (image-gen, design-director, vision-director, concept, cohesion, research, auto-research, xp) | ✅ |
| Each `SKILL.md` frontmatter has `name` + `description` | ✅ |
| 6 identity files at root (AGENTS, SOUL, IDENTITY, TOOLS, BOOTSTRAP, README) | ✅ |
| 28 assets in `_shared/` | ✅ |
| `runtime/legacy/` embedded (1.3 MB), no `KIE_KEY=sk-` leak | ✅ |
| `runtime/{bin,lib}/*.mjs` lint clean | ✅ |

## Manual — your turn

These steps need KIE_KEY, sample SKU, and Openclaw — things this terminal can't supply. Stop at the first failure.

### Step 1 — One-shot install

From `openclaw-hma/` root, in PowerShell:

```powershell
.\setup.ps1
```

Expected: 2 npm installs run (`runtime/legacy/` then `runtime/`), `runtime/.env` created from example, prints "Edit runtime\.env, set KIE_KEY=...".

### Step 2 — Fill `KIE_KEY`

Edit `runtime/.env`, replace `sk-replace-me` with your real key.

### Step 3 — Smoke test bridge

Pick any SKU folder (you can use a sample brief from `runtime/legacy/briefs/_sample.json`):

```bash
cd runtime
node bin/precheck.mjs ../data/<SKU>
```

Expected: 8 sanitized slot prompts printed. No `[BLOCKED]` lines. No "Embedded legacy code missing" error.

### Step 4 — Mount workspace into Openclaw

**Windows admin cmd:**
```cmd
mklink /D "%USERPROFILE%\.openclaw\workspace\openclaw-hma" "<install-path>\openclaw-hma"
```

Replace `<install-path>` with where you unzipped (e.g. `D:\AI PROJECT\openclaw-hma`).

Or copy without admin:
```cmd
xcopy /E /I /Y "<install-path>\openclaw-hma" "%USERPROFILE%\.openclaw\workspace\openclaw-hma"
```

### Step 5 — Reload Openclaw skills

```
openclaw
/new
/skills list
```

Expected: 13 skills with names `hma-*`. Five marked user-invocable.

### Step 6 — Dry-run a SKU

```
/hma-master ../data/<SKU> --dry-run
```

Expected: pipeline plan printed, zero KIE calls. Sanity-check slot list, brief validation, refs picked.

### Step 7 — Single-slot live run

Cheapest path:

```
/hma-listing ../data/<SKU> --skip-slots slot1
```

Expected: 1 KIE call, 1 JPG at `data/<SKU>/output/listing/<SKU>_slot1_main.jpg` (2000×2000). `_progress.json` updated.

### Step 8 — Full pipeline (only when 1-7 pass)

```
/hma-master ../data/<SKU>
```

Watch credit burn. ~$0.80-1.50/SKU first run.

## If something breaks

1. **`Embedded legacy code missing`** → `runtime/legacy/` was deleted or zip corrupted. Re-extract bundle or re-run `setup.ps1`.
2. **`KIE_KEY missing`** → fill `runtime/.env`. The bridge forwards it to legacy automatically; you do **not** need to also fill `runtime/legacy/config/api-keys.env`.
3. **`Cannot find module 'sharp'`** → `npm install` did not run inside `runtime/legacy/`. Re-run `setup.ps1`.
4. **Sharp build fails on Windows** → install Visual C++ 2015-2022 Redistributable, then retry.
5. **Openclaw doesn't see skills** → check symlink: `ls "%USERPROFILE%\.openclaw\workspace\openclaw-hma\skills"`.
6. **Trace bridge spawn args** → open `runtime/lib/legacy-bridge.mjs`, check `runLegacyScript()`.

## Known v0.1.1 limits

- Process-spawn overhead per pipeline call (~500ms cold start). Negligible vs KIE call time.
- Doctrine duplicated: `_shared/{doctrine,rules,knowledge,prompts,config}/` (skill docs) and `runtime/legacy/{config,knowledge,xp}/` (legacy code reads). Edit BOTH if you change a rule, until v0.2 dedupes.
- `hma-image-gen`, `hma-design-director`, `hma-cohesion` direct CLI calls are no-op stubs — they only run inside `master.js` flow. v0.2 splits them into standalone entries.
- Vision gates (`hma-vision-director`, `hma-concept`, `hma-research`) need Openclaw Vision capability. Fallback: heuristic / manual request file.
- XP history: `runtime/legacy/xp/` includes existing logs from production at copy time. Future XP entries from new runs go there too.

## Sign-off

Once Step 8 produces a publish-ready bundle, tag `v0.1.1` and (optionally) run `pack.ps1` to produce a shareable zip.
