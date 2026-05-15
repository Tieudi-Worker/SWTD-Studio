/**
 * Per-provider model + capability catalog.
 *
 * Encodes for each (provider, model) pair the dispatcher needs to know about:
 *   - supportsGenerate / supportsEdit
 *   - supportedAspectRatios / supportedQualities / supportedOutputFormats
 *   - defaultTimeoutMs (one-shot per request; the router does not retry)
 *
 * Lookup-only — no runtime side effects. The Provider Registry consults this
 * catalog during input validation and during default-route resolution.
 *
 * Plan §4.4, §4.10.
 */

/** Default per-provider timeouts (ms). Plan §4.10. */
export const PROVIDER_TIMEOUTS_MS = Object.freeze({
  openai: 90_000,
  fal:    120_000,
  gemini: 90_000,
  kie:    120_000,
  custom: 90_000,
  mock:   10_000
})

const COMMON_ASPECTS = ['1:1', '4:5', '9:16', '16:9']
const COMMON_QUALITIES = ['low', 'medium', 'high', 'auto']
const COMMON_FORMATS = ['png', 'jpeg', 'webp']

/**
 * Catalog entries keyed by provider id. Each entry lists the v1 model set the
 * Provider Registry will surface to operators + which routes (generate/edit)
 * each model supports. Models not listed here are rejected by the dispatcher
 * with `invalid-input` before the request is sent.
 *
 * Boss D3 default route lock: OpenAI's `gpt-image-2/edit` is the default for
 * edit-mode; `gpt-image-2` for generate-mode.
 */
export const MODEL_CATALOG = Object.freeze({
  openai: {
    defaultGenerateModel: 'gpt-image-2',
    defaultEditModel: 'gpt-image-2/edit',
    defaultTimeoutMs: PROVIDER_TIMEOUTS_MS.openai,
    models: {
      'gpt-image-2': {
        supportsGenerate: true, supportsEdit: false,
        supportedAspectRatios: COMMON_ASPECTS,
        supportedQualities: COMMON_QUALITIES,
        supportedOutputFormats: ['png']
      },
      'gpt-image-2/edit': {
        supportsGenerate: false, supportsEdit: true,
        supportedAspectRatios: COMMON_ASPECTS,
        supportedQualities: COMMON_QUALITIES,
        supportedOutputFormats: ['png']
      },
      'gpt-image-1.5': {
        supportsGenerate: true, supportsEdit: false,
        supportedAspectRatios: ['1:1', '4:5', '16:9'],
        supportedQualities: COMMON_QUALITIES,
        supportedOutputFormats: ['png']
      }
    }
  },
  gemini: {
    defaultGenerateModel: 'imagen-3',
    defaultEditModel: null,
    defaultTimeoutMs: PROVIDER_TIMEOUTS_MS.gemini,
    models: {
      'imagen-3': {
        supportsGenerate: true, supportsEdit: false,
        supportedAspectRatios: ['1:1', '4:5', '16:9'],
        supportedQualities: COMMON_QUALITIES,
        supportedOutputFormats: ['png', 'jpeg']
      }
    }
  },
  kie: {
    defaultGenerateModel: 'nano-banana-pro',
    defaultEditModel: 'nano-banana-pro/edit',
    defaultTimeoutMs: PROVIDER_TIMEOUTS_MS.kie,
    models: {
      'nano-banana-pro': {
        supportsGenerate: true, supportsEdit: false,
        supportedAspectRatios: COMMON_ASPECTS,
        supportedQualities: COMMON_QUALITIES,
        supportedOutputFormats: ['png']
      },
      'nano-banana-pro/edit': {
        supportsGenerate: false, supportsEdit: true,
        supportedAspectRatios: COMMON_ASPECTS,
        supportedQualities: COMMON_QUALITIES,
        supportedOutputFormats: ['png']
      },
      'seedream': {
        supportsGenerate: true, supportsEdit: false,
        supportedAspectRatios: COMMON_ASPECTS,
        supportedQualities: COMMON_QUALITIES,
        supportedOutputFormats: ['png']
      },
      'kling': {
        supportsGenerate: true, supportsEdit: false,
        supportedAspectRatios: COMMON_ASPECTS,
        supportedQualities: COMMON_QUALITIES,
        supportedOutputFormats: ['png']
      }
    }
  },
  fal: {
    defaultGenerateModel: 'openai/gpt-image-2',
    defaultEditModel: null,
    defaultTimeoutMs: PROVIDER_TIMEOUTS_MS.fal,
    models: {
      'openai/gpt-image-2': {
        supportsGenerate: true, supportsEdit: false,
        supportedAspectRatios: COMMON_ASPECTS,
        supportedQualities: COMMON_QUALITIES,
        supportedOutputFormats: ['png']
      },
      'flux-dev': {
        supportsGenerate: true, supportsEdit: false,
        supportedAspectRatios: COMMON_ASPECTS,
        supportedQualities: COMMON_QUALITIES,
        supportedOutputFormats: ['png']
      }
    }
  },
  custom: {
    // Custom provider: model list is operator-supplied. The catalog provides
    // a permissive default; the adapter validates the configured baseUrl at
    // call-time.
    defaultGenerateModel: 'gpt-image-2',
    defaultEditModel: 'gpt-image-2/edit',
    defaultTimeoutMs: PROVIDER_TIMEOUTS_MS.custom,
    models: {} // populated dynamically from operator config
  },
  mock: {
    defaultGenerateModel: 'mock-placeholder',
    defaultEditModel: 'mock-placeholder',
    defaultTimeoutMs: PROVIDER_TIMEOUTS_MS.mock,
    models: {
      'mock-placeholder': {
        supportsGenerate: true, supportsEdit: true,
        supportedAspectRatios: COMMON_ASPECTS,
        supportedQualities: COMMON_QUALITIES,
        supportedOutputFormats: COMMON_FORMATS
      }
    }
  }
})

export function getModelEntry(providerId, model) {
  const provider = MODEL_CATALOG[providerId]
  if (!provider) return null
  if (!model) return null
  return provider.models[model] || null
}

export function getProviderCatalog(providerId) {
  return MODEL_CATALOG[providerId] || null
}

/**
 * Resolve the model that should serve a given (providerId, mode) when the
 * operator did not pass an explicit `model` override.
 *
 *   getDefaultModel('openai', 'edit')      → 'gpt-image-2/edit'
 *   getDefaultModel('openai', 'generate')  → 'gpt-image-2'
 *   getDefaultModel('gemini', 'edit')      → null   (gemini lacks edit in v1)
 */
export function getDefaultModel(providerId, mode) {
  const provider = MODEL_CATALOG[providerId]
  if (!provider) return null
  return mode === 'edit' ? provider.defaultEditModel : provider.defaultGenerateModel
}

/**
 * Whether the provider supports the requested mode at all (any model).
 * Used by the fallback router to skip providers that cannot serve the mode.
 */
export function providerSupportsMode(providerId, mode) {
  const provider = MODEL_CATALOG[providerId]
  if (!provider) return false
  if (mode === 'edit') return Boolean(provider.defaultEditModel)
  return Boolean(provider.defaultGenerateModel)
}
