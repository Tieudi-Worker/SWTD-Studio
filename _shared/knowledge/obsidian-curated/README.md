# 📚 Obsidian → HMA Knowledge Bridge Convention

## Purpose

HMA can use Obsidian vault as a long-term brain (doctrine, photography rules, niche insights, listing tactics, SOPs, brand style, competition intel). However, Obsidian notes contain private/personal content that must **never** leak into HMA prompts or outputs.

This convention defines the only safe path.

---

## 🔒 Rule Zero — No Raw Notes

**NEVER** paste raw Obsidian Markdown into any HMA prompt, brief, `knowledge_insights`, knowledge file, or summary.

Raw notes may contain:
- Personal diary, private chats, daily logs
- API keys, tokens, credentials
- Financial data (prices, margins, targets)
- Internal strategy not meant for customers
- Conversation transcripts with Boss

---

## ✅ Approved Path (Curated Bridge)

### Step 1 — Curate

Read an Obsidian note → extract only **business-relevant, sanitized** rules → write to:

```
_shared/knowledge/obsidian-curated/{topic}.md
```

### Step 2 — Template

Every curated file must follow this structure:

```markdown
# {Topic}

## Source
- Obsidian source: internal only; do not include in prompts
- Curated by: assistant
- Last verified: YYYY-MM-DD
- Safety: sanitized, no secrets, no personal data

## Actionable Insights
- One short business rule per line.
- No private names unless public/brand-approved.
- No URLs unless the output needs citation.

## Prompt-Safe Hints
- Max 18 words each.
- Scene/listing/creative rules only.
- No raw note excerpts.

## Cross-Reference
- Related HMA doctrine files: (optional)
- Related curated notes: (optional)
```

### Step 3 — Compile

Regenerate `_summary.json` so the pipeline can consume safe hints:

```bash
/hma-knowledge index
```

### Step 4 — Consume

Pipeline may only read `Prompt-Safe Hints` or compiled `_summary.json` entries. Never read full curated files directly into prompts.

---

## 🚫 Forbidden Content

These items must **never** enter the curated bridge:

| Content | Why |
|---------|-----|
| Personal diary, mood, private thoughts | Private, irrelevant |
| API keys, tokens, `.env` values | Security risk |
| Private chats, emails, conversations | Privacy violation |
| Financial targets, actual margins, pricing strategy | Competitive intel leak |
| Raw AI conversation logs (memory/chat) | Prompt/source leak |
| Anything tagged `private`/`confidential`/`do-not-ingest` | Direct violation |
| Employee/partner names with internal context | PII exposure |

If an Obsidian note mixes private and useful content: extract only the useful part. Leave the private part behind.

---

## ⚠️ When in Doubt

- Skip the note entirely.
- Ask Boss: "This note may contain private info; do you want me to curate a safe version?"
- Do not guess what is safe to include.

---

## 📍 Linking Convention

Curated notes may backlink to HMA internal files:

```markdown
- Doctrine: `_shared/doctrine/handmade-product-doctrine.md`
- XP rules: `_shared/rules/xp-rules.md`
- Related curated: `obsidian-curated/product-photography-studio.md`
```

Do **not** include Obsidian internal paths (`obsidian-vault/...`) in curated notes.

---

## ♻️ Refresh Cycle

- Curated notes are valid until the source Obsidian note changes.
- Boss may request: "recurate this from Obsidian" → read source again, update curated file, recompile index.
- Outdated curated notes should note `Last verified: <date>` for freshness tracking.
