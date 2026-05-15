# TASK RUNBOOK — Phase 4 Provider Core Architecture

Status: started
Started: 2026-05-15 09:40 UTC
Branch: listing-slot-preview-review
Worktree: .claude/worktrees/phase-4-provider-core

## Objective
Create SpecKit artifacts for SWTD-Studio Provider Core based on `docs/architecture/PROVIDER_CORE_PLAN_v0.2.md`.

This phase is architecture/spec planning first, not implementation unless explicitly approved.

## Required protocol
Claude Code must follow:
1. Read relevant `.claude/skills/*/SKILL.md` files before planning.
2. Use SpecKit flow: specify → plan → tasks → verify.
3. Keep provider architecture desktop-safe and future cloud-safe.
4. No git push.
5. No destructive cleanup without approval.

## Required skill files
- `.claude/skills/speckit-specify/SKILL.md`
- `.claude/skills/speckit-plan/SKILL.md`
- `.claude/skills/speckit-tasks/SKILL.md`
- `.claude/skills/tinbeta-coding-guardrail/SKILL.md`
- `.claude/skills/matt-git-guardrails-claude-code/SKILL.md`

## Inputs
- `docs/architecture/PROVIDER_CORE_PLAN_v0.2.md`
- `docs/features/phase-3-model-adapter/{spec.md,plan.md,tasks.md}`
- Existing provider code in `apps/desktop/src/lib/providers/`
- Existing Electron main/preload files

## Expected outputs
- `docs/features/phase-4-provider-core/spec.md`
- `docs/features/phase-4-provider-core/plan.md`
- `docs/features/phase-4-provider-core/tasks.md`
- Optional architecture doc updates only if needed

## Verification
- Docs exist and are internally consistent.
- Plan explicitly covers:
  - Provider Registry
  - OpenAI/Gemini/Kie.ai/Fal.ai/Custom Provider settings
  - Web Research / Insight Mining → Brief Intelligence
  - image_generate style contract
  - gpt-image-2/edit reference-image behavior
  - Electron main IPC boundary
  - secure key handling v1/v2
  - media store tmp/approved + 7-day TTL
  - fallback router
  - no renderer direct provider calls in final architecture
