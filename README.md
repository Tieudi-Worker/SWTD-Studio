# openclaw-hma

Handmade Media Agent (HMA) packaged as an Openclaw skill pack.

Generates the full Amazon US media stack for one handmade SKU at a time: 8 listing images (2000×2000), 5 A+ Premium modules (1464×600), and a 20-25s product video (1920×1080).

> **Status:** 2026-05-03 — v0.1.1 shipped. Self-contained skill pack (legacy embedded at `runtime/legacy/`).
>
> **Bạn vừa giải nén zip? → đọc [`HUONG-DAN.md`](HUONG-DAN.md)** (tiếng Việt, đầy đủ install + use + troubleshoot).
>
> Manual end-to-end SKU run pending — see [`VERIFICATION.md`](VERIFICATION.md).

## Quickstart

```cmd
:: Mount into Openclaw (Windows admin cmd)
mklink /D "%USERPROFILE%\.openclaw\workspace\openclaw-hma" "D:\AI PROJECT\openclaw-hma"

:: Install runtime deps
cd /d "D:\AI PROJECT\openclaw-hma\runtime"
npm install
copy .env.example .env
:: edit .env -> KIE_KEY=sk-...

:: In an Openclaw session
openclaw
/new
/hma-master ../data/<SKU>
```

Full first-run guide: [`BOOTSTRAP.md`](BOOTSTRAP.md).

## Folder Map

```
openclaw-hma/
├── AGENTS.md            # Orchestrator instructions
├── SOUL.md              # Personality
├── IDENTITY.md          # Brand layer
├── TOOLS.md             # Local environment notes (env vars, paths)
├── BOOTSTRAP.md         # First-run setup
├── README.md            # This file
│
├── skills/              # 13 SKILL.md
│   ├── hma-master/
│   ├── hma-listing/
│   ├── hma-aplus/
│   ├── hma-video/
│   ├── hma-knowledge/
│   ├── hma-image-gen/
│   ├── hma-design-director/
│   ├── hma-vision-director/
│   ├── hma-concept/
│   ├── hma-cohesion/
│   ├── hma-research/
│   ├── hma-auto-research/
│   └── hma-xp/
│
├── _shared/             # Doctrine, prompts, rules, configs, knowledge
│   ├── doctrine/
│   ├── prompts/
│   ├── rules/
│   ├── config/
│   ├── knowledge/
│   └── schema/
│
├── runtime/             # Node.js executor (ESM)
│   ├── bin/             # Entry scripts (master, listing, aplus, video, ...)
│   ├── lib/             # kie-client, prompt-guard, checkpoint, image-utils, ...
│   ├── pipelines/       # directref, aplus, video, cohesion-validator
│   ├── package.json
│   └── .env.example
│
└── data/                # User SKU data (gitignored content)
    └── <SKU>/
        ├── brief.json
        ├── input/{product,listing-ref,aplus-ref,video-ref}/
        ├── output/{listing,aplus,video}/
        └── research/
```

## Skills

| Skill | User-invocable | Purpose |
|-------|----------------|---------|
| `hma-master` | `/hma-master` | Full pipeline (research → DNA → listing → A+ → video) |
| `hma-listing` | `/hma-listing` | 8-slot Amazon listing only |
| `hma-aplus` | `/hma-aplus` | 5-module A+ Premium only |
| `hma-video` | `/hma-video` | Storyboard + Kling 3.0 video only |
| `hma-knowledge` | `/hma-knowledge` | CRUD `_shared/knowledge/` |
| `hma-image-gen` | model-only | Compose prompt + KIE call for one image |
| `hma-design-director` | model-only | Heuristic DNA v2 |
| `hma-vision-director` | model-only | Vision-powered DNA v2 (pause/resume) |
| `hma-concept` | model-only | Seduction Gate brainstorm |
| `hma-cohesion` | model-only | Post-listing drift QC |
| `hma-research` | model-only | Vision analyze ref images |
| `hma-auto-research` | model-only | Web search + keyword merge |
| `hma-xp` | model-only | QC scoring + rule compilation |

## Doctrine

`_shared/doctrine/handmade-product-doctrine.md` is the constitution. F1-F8 product fidelity rules are non-negotiable. Doctrine v2.0 was merged 2026-04-12 (HMA-LAW-001).

`_shared/rules/prompt-anti-patterns.md` catalogs A1-A8 universal anti-patterns + RULE-015 → RULE-021 per-slot constraints.

## Lineage

- **Production (frozen):** `D:\AI PROJECT\handmade-media-agent-v0\handmade-media-agent\`
- **Sandbox (deprecated):** `D:\AI PROJECT\hma-skills-test\`
- **This repo:** `D:\AI PROJECT\openclaw-hma\` (Openclaw skill pack)

## License

Internal — not for redistribution. Knowledge base entries that cite external sources retain their original licenses; see `_shared/knowledge/README.md`.
