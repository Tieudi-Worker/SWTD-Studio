/**
 * `image_generate` unified contract.
 *
 * The single entry point that dispatches to generate-mode or edit-mode based
 * on whether the operator passed a reference image. Honors the fallback
 * router and writes through the media store.
 *
 * Plan §4.3, D3.
 */

import { providerError } from './error.js'
import { route } from './fallback-router.js'
import {
  getDefaultModel,
  getModelEntry,
  getProviderCatalog,
  providerSupportsMode
} from './model-catalog.js'

function hasReferenceImage(input) {
  if (!input) return false
  if (typeof input.image === 'string' && input.image.length > 0) return true
  if (Array.isArray(input.images) && input.images.length > 0) return true
  return false
}

function validateAgainstCatalog(providerId, model, mode, input) {
  const entry = getModelEntry(providerId, model)
  if (!entry) {
    // Custom provider has a dynamic catalog; skip strict validation there.
    if (providerId === 'custom') return null
    return providerError(providerId, 'invalid-input', {
      hint: `unknown model "${model}" for provider "${providerId}"`
    })
  }
  if (mode === 'edit' && !entry.supportsEdit) {
    return providerError(providerId, 'provider-unsupported-edit', {
      hint: `model "${model}" cannot edit`
    })
  }
  if (mode === 'generate' && !entry.supportsGenerate) {
    return providerError(providerId, 'invalid-input', {
      hint: `model "${model}" cannot generate`
    })
  }
  if (input.aspectRatio && entry.supportedAspectRatios && !entry.supportedAspectRatios.includes(input.aspectRatio)) {
    return providerError(providerId, 'invalid-input', {
      hint: `aspect ratio ${input.aspectRatio} not supported by ${providerId}/${model}`
    })
  }
  return null
}

/**
 * Run the image_generate pipeline.
 *
 * @param {import('./types.js').ImageGenerateInput} input
 * @param {object} ctx
 * @param {ReturnType<typeof import('./provider-registry.js').createProviderRegistry>} ctx.registry
 * @param {import('./types.js').KeyVault} ctx.keyVault
 * @param {import('./types.js').MediaStore} ctx.mediaStore
 * @param {object} [ctx.logger]
 * @param {AbortSignal} [ctx.signal]
 * @returns {Promise<import('./types.js').ImageGenerateResult>}
 */
export async function imageGenerate(input, ctx) {
  if (!input || typeof input !== 'object') {
    throw providerError('router', 'invalid-input', { hint: 'input object required' })
  }
  if (!input.prompt || typeof input.prompt !== 'string') {
    throw providerError('router', 'invalid-input', { hint: 'prompt required' })
  }
  if (!input.skuPath || typeof input.skuPath !== 'string') {
    throw providerError('router', 'invalid-input', { hint: 'skuPath required for media-store write' })
  }
  if (input.slotId == null) {
    throw providerError('router', 'invalid-input', { hint: 'slotId required' })
  }

  const { registry, keyVault, mediaStore, logger, signal } = ctx
  const mode = hasReferenceImage(input) ? 'edit' : 'generate'

  // 1. Sweep expired tmp entries before dispatching. Phase 3 hook; preserved
  //    so the operator sees fresh outputs only.
  try { await mediaStore.cleanupExpired({ skuPath: input.skuPath }) } catch (err) {
    if (logger) logger.warn('image-generate: cleanupExpired failed', { hint: err.message })
  }

  // 2. Resolve the route. `provider` override lets the operator pin a single
  //    provider for this call; `registry.getDefaultRoute` returns the ordered
  //    chain to try.
  const { chain, skipped } = registry.getDefaultRoute({
    hasReferenceImage: mode === 'edit',
    providerOverride: input.provider
  })

  if (chain.length === 0) {
    throw providerError('router', 'all-providers-failed', {
      attempted: skipped,
      hint: mode === 'edit'
        ? 'no configured provider supports edit'
        : 'no provider available'
    })
  }

  // 3. Execute via the router. The per-provider closure resolves the model,
  //    pulls the key, sets the timeout, and calls provider.generate / edit.
  const execute = async (provider) => {
    if (signal?.aborted) throw providerError(provider.id, 'aborted')

    const catalog = getProviderCatalog(provider.id)
    const explicitModel = typeof input.model === 'string' ? input.model : null
    const model = explicitModel || getDefaultModel(provider.id, mode)
    if (!model) {
      throw providerError(provider.id, mode === 'edit' ? 'provider-unsupported-edit' : 'invalid-input', {
        hint: `no default ${mode} model for provider`
      })
    }
    const validateErr = validateAgainstCatalog(provider.id, model, mode, input)
    if (validateErr) throw validateErr
    if (mode === 'edit' && typeof provider.edit !== 'function') {
      throw providerError(provider.id, 'provider-unsupported-edit')
    }
    if (mode === 'generate' && typeof provider.generate !== 'function') {
      throw providerError(provider.id, 'invalid-input', { hint: 'provider missing generate()' })
    }

    let apiKey = null
    if (provider.id !== 'mock') {
      apiKey = keyVault ? await keyVault.getKey(provider.id) : null
      if (provider.authFields?.some((f) => f.id === 'apiKey' && f.required) && !apiKey) {
        throw providerError(provider.id, 'invalid-key', { hint: 'no API key configured' })
      }
    }

    const providerCtx = {
      apiKey,
      signal: signal || new AbortController().signal,
      timeoutMs: input.timeoutMs || catalog?.defaultTimeoutMs || 90_000,
      log: (level, msg, fields) => logger && logger[level] && logger[level](msg, fields)
    }
    const fn = mode === 'edit' ? provider.edit : provider.generate
    const result = await fn({ ...input, model }, providerCtx)
    if (!result || !result.bytes || !result.mime) {
      throw providerError(provider.id, 'invalid-response', { hint: 'adapter returned no bytes/mime' })
    }
    return { ...result, model }
  }

  const { servedProvider, fallbackChain, result } = await route({
    chain,
    getProvider: registry.getProvider,
    execute,
    skipped,
    logger
  })

  // 4. Persist through media store. Sidecar records the served provider +
  //    fallback chain so SlotCard can render the `via X` badge.
  const entry = await mediaStore.saveTmpImage({
    skuPath: input.skuPath,
    slotId: input.slotId,
    bytes: result.bytes,
    mime: result.mime,
    providerId: servedProvider,
    model: result.model,
    mode,
    promptHash: undefined,
    sourceImages: Array.isArray(input.images) ? input.images : (input.image ? [input.image] : undefined),
    aspectRatio: input.aspectRatio,
    templateId: input.templateId,
    angleId: input.angleId,
    fallbackChain
  })

  return {
    file: entry.file,
    sidecarPath: entry.sidecarPath,
    servedProvider,
    fallbackChain,
    mode,
    model: result.model,
    mime: result.mime,
    elapsedMs: result.elapsedMs,
    generatedAt: entry.generatedAt,
    expiresAt: entry.expiresAt
  }
}

export { hasReferenceImage }
