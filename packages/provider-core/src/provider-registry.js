/**
 * Provider Registry.
 *
 * In-memory table of registered ImageProvider instances + route configuration.
 * Concrete adapters never import each other — the registry is the only module
 * that knows the full provider list.
 *
 * Stateful: a single registry instance is created per `createProviderCore()`
 * invocation. Tests instantiate their own.
 *
 * Plan §4.4.
 */

import { providerSupportsMode } from './model-catalog.js'

/**
 * @param {object} opts
 * @param {string=} opts.defaultPrimary
 * @param {string[]=} opts.defaultFallbackChain
 * @param {boolean=} opts.allowMockFallback
 */
export function createProviderRegistry(opts = {}) {
  /** @type {Map<string, import('./types.js').ImageProvider>} */
  const providers = new Map()

  let routeConfig = {
    primary: opts.defaultPrimary || 'openai',
    fallbackChain: Array.isArray(opts.defaultFallbackChain)
      ? [...opts.defaultFallbackChain]
      : [],
    allowMockFallback: Boolean(opts.allowMockFallback) || false
  }

  function registerProvider(provider) {
    if (!provider || typeof provider.id !== 'string') {
      throw new TypeError('registerProvider: provider.id required')
    }
    providers.set(provider.id, provider)
  }

  function getProvider(id) {
    return providers.get(id) || null
  }

  function listProviders({ withHasKey } = {}) {
    return Array.from(providers.values()).map((p) => {
      const meta = {
        id: p.id,
        label: p.label,
        authFields: p.authFields,
        capabilities: p.capabilities,
        models: p.models || []
      }
      if (typeof withHasKey === 'function') {
        meta.hasKey = Boolean(withHasKey(p.id))
      }
      return meta
    })
  }

  function getRouteConfig() {
    return {
      primary: routeConfig.primary,
      fallbackChain: [...routeConfig.fallbackChain],
      allowMockFallback: routeConfig.allowMockFallback
    }
  }

  function setRouteConfig(cfg = {}) {
    if (typeof cfg !== 'object' || cfg == null) {
      throw new TypeError('setRouteConfig: object required')
    }
    if (cfg.primary && !providers.has(cfg.primary)) {
      throw new Error(`setRouteConfig: unknown primary provider "${cfg.primary}"`)
    }
    routeConfig = {
      primary: cfg.primary ?? routeConfig.primary,
      fallbackChain: Array.isArray(cfg.fallbackChain)
        ? cfg.fallbackChain.filter((id) => providers.has(id))
        : routeConfig.fallbackChain,
      allowMockFallback: typeof cfg.allowMockFallback === 'boolean'
        ? cfg.allowMockFallback
        : routeConfig.allowMockFallback
    }
    return getRouteConfig()
  }

  /**
   * Compute the ordered list of provider ids that should be attempted for a
   * given input. The fallback router walks this list in order and stops on
   * the first one that succeeds.
   *
   * Rules:
   *   - input.provider (explicit operator override) takes precedence over
   *     routeConfig.primary
   *   - mode=edit filters out providers whose default model does not support
   *     edit; the operator may not realise gemini/fal lack edit, so we skip
   *     silently and emit a 'provider-unsupported-edit' chain entry instead
   *     of failing the whole run
   *   - mock is appended only when allowMockFallback === true
   */
  function getDefaultRoute({ hasReferenceImage, providerOverride } = {}) {
    const mode = hasReferenceImage ? 'edit' : 'generate'
    const primary = providerOverride || routeConfig.primary
    const orderedRaw = [primary, ...routeConfig.fallbackChain.filter((id) => id !== primary)]
    if (routeConfig.allowMockFallback && !orderedRaw.includes('mock')) {
      orderedRaw.push('mock')
    }
    const chain = []
    const skipped = []
    for (const id of orderedRaw) {
      if (!providers.has(id)) continue
      if (!providerSupportsMode(id, mode)) {
        skipped.push({ providerId: id, reason: 'provider-unsupported-edit' })
        continue
      }
      chain.push(id)
    }
    return { mode, chain, skipped }
  }

  return {
    registerProvider,
    getProvider,
    listProviders,
    getRouteConfig,
    setRouteConfig,
    getDefaultRoute
  }
}
