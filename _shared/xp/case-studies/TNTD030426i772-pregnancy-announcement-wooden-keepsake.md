# XP Case Study — TNTD030426i772 Pregnancy Announcement Wooden Keepsake

**Date:** 2026-05-03  
**SKU:** TNTD030426i772  
**Product:** Hi Daddy Pregnancy Announcement For Husband  
**Category:** handmade wooden pregnancy announcement keepsake  
**Primary reference:** `data/TNTD030426i772/input/product/06.jpg`  
**Secondary/package reference:** `data/TNTD030426i772/input/product/05.jpg`  
**Benchmark ASIN:** B0GVM6LBVT  

> Confidentiality note: API keys, raw provider credentials, and temporary signed output URLs are intentionally excluded from this XP log.

---

## 1. Final Operator Verdict

Boss marked the 8-image listing media set as **temporarily acceptable** after multiple iterations. The best usable outputs came from KIE `nano-banana-pro` task recovery and selected runtime outputs, not from FAL/Flux or deterministic composites.

This SKU is a high-value learning case because it exposed the hardest HMA failure mode: **text-heavy personalized/engraved handmade products where product identity must remain exact while scene changes.**

---

## 2. Product Truths That Must Be Preserved

The product is not a generic card, plaque, or ornament. It is a **rigid, flat, upright, two-piece wooden keepsake**:

- Outer frame/cover and inner message piece must remain visually distinct.
- Upright/portrait orientation is mandatory; landscape rotation is a fail.
- The reference `06.jpg` is the source of truth.
- Key visible text:
  - `Hi DADDY`
  - `I can't wait to meet you!`
  - `SOMEONE WANTS TO SAY`
  - `HELLO...`
- Red heart accent must remain red and in the correct approximate position.
- Natural wood tone: neutral/slightly warm; avoid yellow cast and blue cast.
- Product is rigid flat wood; any bending, fabric-like warping, curved paper look, or soft deformation is a fail.

---

## 3. Backend Learnings

### 3.1 OpenAI `gpt-image-2`

**Priority:** Always preferred when quota is available.

**Observed issue:** Direct OpenAI `openai/gpt-image-2` hit `HTTP 429 usage_limit_reached`.  
**Operator decision:** Do not use FAL as a replacement/proxy. The accepted backend hierarchy is:

1. `openai/gpt-image-2`
2. KIE only

### 3.2 FAL / Flux

**Decision:** Remove FAL from this workflow entirely.

Flux image-to-image attempts failed for this SKU:

- Severe text drift.
- Wrong product shape.
- Product warping/bending.
- Lost two-piece mechanism.

**Lesson:** For engraved/text-heavy product references, Flux-style image-to-image is not reliable enough for HMA fidelity requirements.

### 3.3 KIE `nano-banana-pro`

KIE `nano-banana-pro` produced the most usable recovered images for this SKU, especially when the reference image carried the product identity and prompts focused on scene.

Recovered useful KIE tasks:

| Task prefix | Model | Mapped slot | QC verdict |
|---|---|---:|---|
| `c88c1f42` | nano-banana-pro | slot2 | Pass-light: decent style, product small/less premium |
| `970aa0d4` | nano-banana-pro | slot5 | Fail fidelity: grid good but product simplified |
| `553b4072` | nano-banana-pro | slot6 | Pass: strongest flatlay, close to reference |
| `012a0dd5` | nano-banana-pro | slot2 alt | Fail: product collapsed to one piece |
| `31986e94` | nano-banana-pro | slot8 | Pass: strong close-up, two-piece product visible |

Recovered files were saved under:

`data/TNTD030426i772/output/listing/kie_task_recovered/`

### 3.4 KIE `gpt-image-2-image-to-image`

KIE accepted this model and generated images successfully, but outputs were resized from non-square native dimensions in some cases, e.g. `1536x1024`, `1276x1233`, then forced to 2000×2000. This may introduce composition distortion/cropping risk.

**Lesson:** KIE GPT-image-2-image-to-image should be treated as experimental until QC proves it beats `nano-banana-pro` on fidelity.

---

## 4. Credit Discipline Lessons

Boss gave a hard rule after this SKU:

> When sending a generation or regeneration task to either `openai/gpt-image-2` or KIE, submit **only once**, wait until it finishes, return the result, and report. Do not auto-submit another task because the output is slow, not yet finished, or not visually ideal.

Implications:

- No self-directed retry loops for image generation.
- No hidden extra regeneration after self-QC.
- No parallel batch unless Boss explicitly authorizes.
- For multiple requested slots, preserve the exact requested count and version every output immediately.
- If output fails QC, report fail and wait for Boss to approve another paid generation.

This becomes a binding HMA operating rule for credit control.

---

## 5. Versioning Failure and Fix

### What went wrong

Some strong KIE task outputs were generated successfully but not preserved immediately. Later runs overwrote the same canonical files:

- `TNTD030426i772_slot2_in-use.jpg`
- `TNTD030426i772_slot5_size-scale.jpg`
- `TNTD030426i772_slot7_emotional.jpg`

This caused confusion because the better earlier task outputs were no longer present in the active output folder.

### Correct workflow going forward

After every successful paid generation:

1. Save/copy output immediately into a versioned folder.
2. Log task ID → model → slot → output file path.
3. Never run a second backend before preserving the first backend outputs.
4. Use folder naming:
   - `v##_openai_gpt2/`
   - `v##_kie_nbp/`
   - `v##_kie_gpt2_i2i/`
   - `kie_task_recovered/` only for outputs recovered from task IDs.

---

## 6. Prompting Lessons for Text-Heavy Wooden Keepsakes

### 6.1 Prompt text should describe scene, not rebuild product

Over-describing the product structure causes product redrawing. For this SKU, adding too many product-specific guard sentences often made the model reinterpret the design instead of copying `06.jpg`.

Best prompt philosophy:

- Reference image = product identity.
- Prompt text = scene, lighting, mood, camera.
- Product-specific guidance should be short:
  - “use the reference product exactly”
  - “rigid flat two-piece wooden keepsake”
  - “no bending/warping/text changes”

Avoid long anatomy descriptions of the cover/frame mechanism unless the slot is an explicit infographic.

### 6.2 Text fidelity remains the hardest constraint

Any model may rewrite or blur engraved text. For this SKU, a visually beautiful scene is still a fail if:

- `Hi DADDY` is missing or altered.
- `HELLO...` becomes gibberish.
- Only one piece is shown instead of the two-piece mechanism.
- Extra words appear on the product face.

### 6.3 Lifestyle slots need larger product presence

Several outputs looked aesthetically good but product was too small, partly hidden, or not readable. For Amazon conversion, lifestyle composition must still make the product the hero.

Rule of thumb for this SKU type:

- Slot 2/7 lifestyle: product should occupy at least ~35–50% of frame width or be in sharp foreground.
- Hands/people can support emotion but must not obscure text or mechanism.

---

## 7. Slot-Specific Lessons

### Slot 1 — Main hero

Benchmark pattern: pure white background, product 80–85% frame, front/upright, no props.  
For this SKU, Slot 1 should avoid lifestyle or cream background. Amazon main image requires pure white.

### Slot 2 — Lifestyle/in-use

Good direction: warm home/nightstand/kitchen reveal scene.  
Failure modes:

- Product becomes warped/bent.
- Product is too small.
- Two-piece structure collapses into one card.
- Text becomes unreadable.

Use a short prompt and strong reference anchoring. Avoid adding too many props.

### Slot 3 — Infographic/dimensions

Needs actual dimensions/callouts and locked layout.  
Do not use empty arrows or vague callouts. For this SKU, the product mechanism must be explained visually, but not through a long prompt that causes redraw.

### Slot 5 — 4-panel use-case grid

Benchmark asks for gift contexts: husband, grandparents, friends, nursery.  
Failure mode observed: model produces nice grid/use-case image but simplifies the product into one card or generic plaque.

For grid slots:

- Exactly 4 cells.
- One product instance per cell.
- No center hero product.
- Product must stay two-piece in each cell.
- Keep labels simple; avoid extra text on product face.

### Slot 7 — Daddy reveal moment

Best emotional direction: hands-only or torso reveal, no face requirement unless Boss asks.  
Failure modes:

- Product bends like paper.
- Hands cover the message.
- Face/emotion becomes stronger than product.

The product must remain the hero even in emotional scenes.

### Slot 8 — Close-up/detail lifestyle

KIE recovered task `31986e94` was strong: two pieces visible, close-up, good emotion context.  
This suggests close-up lifestyle/detail shots may be safer than complex people scenes for fidelity.

---

## 8. Benchmark Lessons from ASIN B0GVM6LBVT

Useful patterns to reuse:

- Slot 1: pure white hero, product huge, no clutter.
- Slots 2–3: warm lifestyle + clear product visibility.
- Slot 3: infographic with real dimensions and non-empty callouts.
- Slot 5: 4-panel grid for distinct gift contexts.
- Slot 7: emotional reveal scene but still product-led.

Do not copy competitor design; use benchmark as composition/conversion reference only.

---

## 9. Runtime/Config Lessons

### 9.1 Model routing must be explicit

Original routing sent some slots to `seedream-4`; KIE rejected this model as unsupported for the current account/config. Runtime was patched to use KIE `nano-banana-pro` only in fallback routing.

Current accepted hierarchy:

1. OpenAI `gpt-image-2` when quota is available.
2. KIE `nano-banana-pro` fallback.
3. KIE `gpt-image-2-image-to-image` only when Boss explicitly requests a comparison run.
4. No FAL.
5. No Flux.

### 9.2 `--skip-slots` behavior verified

Correct behavior observed after checkpoint clearing:

`--skip-slots slot2,slot5,slot7`

clears those entries and regenerates only those slots while skipping completed slots 1/3/4/6/8.

### 9.3 Cohesion pause is expected

Runtime may exit with code 2 after image generation because CohesionValidator requests Vision review. This does not mean generation failed if slots were already saved and marked OK.

---

## 10. Durable Rules Proposed from This SKU

These are not promoted to global RULE-NNN yet because they are based on one SKU, but they should be watched across future SKUs.

### Candidate: ONE-SUBMIT Credit Discipline

For paid generation providers, submit once, wait, save, report. Never self-regenerate without Boss approval.

### Candidate: Immediate Version Preservation

After every successful generation, copy outputs to a versioned folder before starting any new backend or regen.

### Candidate: Text-Heavy Product Fidelity Gate

For engraved/personalized products, a beautiful scene is not enough. Passing requires readable key text and preserved product mechanism.

### Candidate: Close-up Safer Than Complex People Scene

For small text-heavy keepsakes, close-up lifestyle/detail compositions preserve fidelity better than full people scenes.

---

## 11. Recommended Future Workflow for Similar SKUs

1. Use `openai/gpt-image-2` first if quota is available.
2. If OpenAI quota is unavailable, use KIE `nano-banana-pro` only.
3. Submit one slot/task at a time unless Boss explicitly authorizes batch.
4. Wait for task completion.
5. Save output to version folder immediately.
6. Run QC against reference:
   - text readable?
   - two-piece mechanism preserved?
   - upright portrait?
   - no warping?
   - product large enough?
7. Report result and ask Boss before any paid regen.

---

## 12. Files Created During Learning

Recovered task outputs:

`data/TNTD030426i772/output/listing/kie_task_recovered/`

Versioned comparison folders:

- `data/TNTD030426i772/output/listing/v10_kie_nbp/`
- `data/TNTD030426i772/output/listing/v11_kie_gpt2/`

