const fs = require('fs');
const path = require('path');

const ROUTING_PATH = path.join(__dirname, '..', 'config', 'model-routing.json');
let _cache = null;

function loadRouting() {
  if (_cache) return _cache;
  try {
    _cache = JSON.parse(fs.readFileSync(ROUTING_PATH, 'utf8'));
  } catch (e) {
    console.warn('[ModelRouter] config missing, default nano-banana-pro');
    _cache = { default: 'nano-banana-pro', slots: {}, fallback_chain: ['nano-banana-pro'], model_specs: {} };
  }
  return _cache;
}

function modelForSlot(slotNumber, brief = {}) {
  const cfg = loadRouting();
  if (brief.slot_model_override?.[slotNumber]) return brief.slot_model_override[slotNumber];
  const slotKey = String(slotNumber);
  if (cfg.slots?.[slotKey]) return cfg.slots[slotKey];
  return cfg.default || 'nano-banana-pro';
}

function maxRefsForModel(modelName) {
  const cfg = loadRouting();
  return cfg.model_specs?.[modelName]?.max_refs || 4;
}

function fallbackChain() {
  const cfg = loadRouting();
  return cfg.fallback_chain || ['nano-banana-pro'];
}

module.exports = { modelForSlot, maxRefsForModel, fallbackChain, clearCache: () => { _cache = null; } };
