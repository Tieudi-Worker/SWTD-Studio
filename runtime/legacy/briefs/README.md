# briefs/

Sample brief JSON files for testing and onboarding.

## Files

| File | Purpose |
|------|---------|
| `_sample.json` | Generic minimal brief — used by `npm run test:dry-run` |
| `_sample_wood_ornament.json` | Full example for wood ornament category |
| `_sample_acrylic_ornament.json` | Full example for acrylic ornament category |
| `_sample_paper_card.json` | Full example for paper card / plant stake category |

## Usage

### Dry run (no API calls)
```bash
node agents/master.js briefs/_sample.json --dry-run
```

### Real generation (LEGACY mode — prefer NEW MODE folder-based)
```bash
node agents/master.js briefs/_sample_wood_ornament.json
```

### NEW MODE (recommended)
Don't use this folder. Instead create a SKU folder under `data/`:
```
data/MY_SKU_001/
├── input/product/
│   ├── front.jpg
│   └── back.jpg
└── (brief.json auto-generated on first run)
```
Then:
```bash
node agents/master.js ../data/MY_SKU_001
```

## Note
Sample briefs reference `input/product/*.jpg` paths that don't exist
in this repo. Sample briefs are for **schema validation** and **dry
run** only — they will fail at the upload step in a real run unless
you provide actual product images at the referenced paths.
