# runtime/

Runtime executor for the openclaw-hma skill pack. Each skill in `../skills/hma-*/SKILL.md` calls one of the entries under `bin/` via Bash.

## Status: v0.1.1 — Embedded Legacy Bridge

This runtime spawns Node subprocesses against **legacy production code embedded at `runtime/legacy/`**. The skill pack is now fully self-contained — no external dependency on any sibling folder.

**Pros:**
- Working pipeline immediately after `setup.ps1`
- Single zip, single folder, ship anywhere
- Production code unchanged (battle-tested behavior preserved)

**Cons:**
- Process-spawn overhead (~500ms per pipeline call)
- 2× `npm install` (`runtime/` for ESM bridge + `runtime/legacy/` for sharp/pino)
- Doctrine duplicated in `_shared/` (skill docs reference) and `runtime/legacy/{config,knowledge,xp}/` (legacy code reads). v0.2 dedupes.

## v0.2 — Full ESM Port (Deferred)

Future work: port `runtime/legacy/utils/*.js` → `runtime/lib/*.mjs` and `runtime/legacy/agents/*pipeline.js` → `runtime/pipelines/*.mjs`. Estimated effort: 2-3 dev-days.

When complete, `lib/legacy-bridge.mjs` and `runtime/legacy/` are deleted.

## Layout

```
runtime/
├── package.json                  # type: module, dep: dotenv
├── .env.example
├── .gitignore
├── README.md                     # this file
├── bin/                          # User-facing entry scripts (ESM)
│   ├── master.mjs                # /hma-master ../data/<SKU>
│   ├── listing.mjs               # /hma-listing ../data/<SKU>
│   ├── aplus.mjs                 # /hma-aplus ../data/<SKU>
│   ├── video.mjs                 # /hma-video ../data/<SKU>
│   ├── precheck.mjs              # offline prompt validation
│   └── single-skill.mjs          # internal skill dispatcher
├── lib/
│   └── legacy-bridge.mjs         # spawns runtime/legacy/* with proper env + cwd
└── legacy/                       # CommonJS production code (frozen, edit only via clear back-port intent)
    ├── package.json              # production deps: sharp, pino, dotenv
    ├── package-lock.json
    ├── agents/
    ├── utils/
    ├── scripts/
    ├── config/
    │   └── api-keys.env.example  # template; copy to api-keys.env, fill KIE_KEY
    ├── knowledge/
    ├── xp/
    ├── references/
    ├── briefs/                   # sample briefs only (no real customer data)
    ├── run-*.js                  # legacy runners
    └── CLAUDE.md                 # production reference doc
```

## Setup

```powershell
# From openclaw-hma root:
.\setup.ps1
# Then edit runtime\.env, fill KIE_KEY=sk-...
```

Or manually:

```bash
cd runtime/legacy && npm install
cd ../ && npm install
cp .env.example .env
# edit .env, fill KIE_KEY
```

## Smoke Test

```bash
node bin/precheck.mjs ../data/<SKU>
```

If this prints sanitized prompts without errors, the bridge is wired correctly.

## Environment

| Var | Required | Default |
|-----|----------|---------|
| `KIE_KEY` | yes | — |
| `LOG_LEVEL` | no | `info` |
| `LOG_FILE` | no | (stdout only) |
| `HMA_LEGACY_ROOT` | no | `runtime/legacy` (auto-resolved) |

## Argument Pass-Through

Every `bin/*.mjs` entry forwards CLI args to the corresponding legacy script:

```bash
node bin/listing.mjs ../data/<SKU> --skip-slots slot2,slot4
# →  spawn:  node runtime/legacy/agents/master.js <abs-path> --only listing --skip-slots slot2,slot4
```

The bridge resolves relative paths to absolute against `process.cwd()` before spawn.

## Two `KIE_KEY` Surfaces

For v0.1.1, the legacy code reads `KIE_KEY` from `runtime/legacy/config/api-keys.env`. The bridge ALSO reads `runtime/.env` and forwards `KIE_KEY` via spawn env. Either one works:

- **Recommended:** put `KIE_KEY` in `runtime/.env` only. Bridge passes it through.
- **Legacy mode:** if for some reason you need to run legacy directly (`cd runtime/legacy && node agents/master.js ...`), copy `config/api-keys.env.example` → `config/api-keys.env` and fill there too.
