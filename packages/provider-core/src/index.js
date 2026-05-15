/**
 * @swtd-studio/provider-core — public surface.
 *
 * `createProviderCore({ keyVault, mediaStore, logger, searchBackend })`
 * returns the singleton bound to a backing key vault, media store, and logger.
 *
 * Two important invariants:
 *   1. Zero `electron` imports here or under `src/**`. The caller passes
 *      `safeStorage` into `createSafeStorageVault` if it wants the v1 backend;
 *      the package itself stays cloud-portable. (Plan §4.1 + §4.7.)
 *   2. The renderer NEVER imports from this package. Renderer goes through
 *      IPC. The factory is consumed by `apps/desktop/electron/main.cjs`.
 *      (Plan §4.1.)
 */

import { createProviderRegistry } from './provider-registry.js'
import { imageGenerate } from './image-generate.js'
import { imageEdit } from './image-edit.js'
import { buildInsightBrief, getInsightBrief } from './insight-brief.js'
import { buildCreativeBrief, getCreativeBrief } from './creative-brief.js'
import { createSafeStorageVault } from './key-vault.js'
import { createMediaStore } from './media-store.js'
import { createLogger, NOOP_LOGGER } from './logger.js'

import { openaiProvider } from './providers/openai.js'
import { geminiProvider } from './providers/gemini.js'
import { kieProvider } from './providers/kie.js'
import { falProvider } from './providers/fal.js'
import {
  customProviderTemplate,
  createCustomProvider
} from './providers/custom-openai-compatible.js'
import { mockProvider } from './providers/mock.js'

import { PROVIDER_CORE_TYPES_VERSION } from './types.js'

export const PROVIDER_CORE_VERSION = '0.1.0'

/**
 * Build the Provider Core instance.
 *
 * @param {object} opts
 * @param {import('./types.js').KeyVault} opts.keyVault
 * @param {import('./types.js').MediaStore} opts.mediaStore
 * @param {object} [opts.logger]
 * @param {object} [opts.searchBackend]
 * @param {object} [opts.routeConfig]
 */
export function createProviderCore(opts = {}) {
  const { keyVault, mediaStore } = opts
  if (!keyVault) throw new TypeError('createProviderCore: keyVault required')
  if (!mediaStore) throw new TypeError('createProviderCore: mediaStore required')
  const logger = opts.logger || NOOP_LOGGER
  const searchBackend = opts.searchBackend || null

  const registry = createProviderRegistry({
    defaultPrimary: opts.routeConfig?.primary || 'openai',
    defaultFallbackChain: opts.routeConfig?.fallbackChain || [],
    allowMockFallback: opts.routeConfig?.allowMockFallback ?? false
  })

  // Register the v1 provider set. Custom is registered as a template (refuses
  // generate until configured); operators can register additional Custom
  // adapters via `registerCustom`.
  registry.registerProvider(openaiProvider)
  registry.registerProvider(geminiProvider)
  registry.registerProvider(kieProvider)
  registry.registerProvider(falProvider)
  registry.registerProvider(customProviderTemplate)
  registry.registerProvider(mockProvider)

  return {
    version: PROVIDER_CORE_VERSION,
    typesVersion: PROVIDER_CORE_TYPES_VERSION,

    /* Registry surface (used by IPC handlers in main) */
    listProviders: (args) => registry.listProviders(args),
    getProvider: registry.getProvider,
    getRouteConfig: registry.getRouteConfig,
    setRouteConfig: registry.setRouteConfig,

    /** Register an additional Custom provider with operator-supplied config. */
    registerCustom(cfg) {
      const adapter = createCustomProvider(cfg)
      registry.registerProvider(adapter)
      return adapter
    },

    /* Key vault surface (renderer NEVER sees getKey) */
    hasKeyFor: (id) => keyVault.hasKey(id),
    saveKey:   (id, value) => keyVault.setKey(id, value),
    clearKey:  (id) => keyVault.clearKey(id),
    keyVaultInfo: () => keyVault.info(),

    /* Media store surface */
    listTmpImages: (args) => mediaStore.listTmpImages(args),
    cleanupTmp: (args) => mediaStore.cleanupExpired(args),
    promoteToApproved: (args) => mediaStore.promoteToApproved(args),

    /* Image generate/edit unified contract */
    generateImage: (input, ctxOverride = {}) => imageGenerate(input, {
      registry, keyVault, mediaStore, logger, ...ctxOverride
    }),
    editImage: (input, ctxOverride = {}) => imageEdit(input, {
      registry, keyVault, mediaStore, logger, ...ctxOverride
    }),

    /* Connection test — the IPC handler is responsible for passing apiKey via ctx */
    async testProvider(providerId, ctxOverride = {}) {
      const provider = registry.getProvider(providerId)
      if (!provider) return { ok: false, reason: 'invalid-input' }
      const apiKey = await keyVault.getKey(providerId)
      const ctx = {
        apiKey, signal: ctxOverride.signal || new AbortController().signal,
        timeoutMs: ctxOverride.timeoutMs || 30_000,
        log: (level, msg, fields) => logger[level] && logger[level](msg, fields)
      }
      return provider.testConnection(ctx)
    },

    /* Research / Insight Brief */
    researchInsight: (input, ctxOverride = {}) => buildInsightBrief(input, {
      skuPath: input?.skuPath, searchBackend, logger, ...ctxOverride
    }),
    getInsightBrief,
    buildCreativeBrief,
    getCreativeBrief
  }
}

// Public type / helper re-exports for IPC handlers that need them
export { createSafeStorageVault, createMediaStore, createLogger }
export { createCustomProvider, customProviderTemplate }
export { PROVIDER_CORE_TYPES_VERSION } from './types.js'
