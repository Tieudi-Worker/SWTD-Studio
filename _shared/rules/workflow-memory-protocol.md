# Workflow Memory Protocol (Token-Light)

## Goal
Không quên doctrine/rules/XP nhưng không phải load full context mỗi lượt.

## Always-on order
1. Read `_shared/rules/workflow-memory-manifest.json` (tiny index).
2. Read exact slot constraints from `_shared/rules/slot-constraints.json`.
3. Read XP managed block in `prompt-anti-patterns.md` between:
   - `<!-- XP_AUTO_RULES_START -->`
   - `<!-- XP_AUTO_RULES_END -->`
4. Read SKU-local focus file: `data/{SKU}/research/_focus.json`.

## SKU Focus File contract (`_focus.json`)
Contains only:
- failing slots
- top 3 risks
- must-keep product fidelity anchors
- next regen command suggestion

Max size target: < 120 lines.

## Update discipline
- After QC: refresh `_focus.json`.
- After XP compile/apply-rules: refresh XP managed block only.
- Never duplicate rules in many files; link by id/path.

## Rule IDs
- Doctrine/core rules keep native IDs (RULE-016/017/...).
- Auto-compiled XP rules should use `XP-RULE-xxx` to avoid collision.

## Fail-safe
If conflict between files:
1. slot-constraints.json (technical enforce)
2. doctrine (principle)
3. anti-patterns (lessons)
4. SKU focus (current tactical priorities)
