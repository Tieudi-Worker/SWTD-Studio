/**
 * Provider Core — JSDoc type contracts.
 *
 * Single source of truth for the public surface of `@swtd-studio/provider-core`.
 * No runtime exports beyond a single `version` string; this file exists so the
 * shape is greppable and reviewable in one place.
 *
 * Spec:  docs/features/phase-4-provider-core/spec.md
 * Plan:  docs/features/phase-4-provider-core/plan.md §4.3, §4.5, §4.7, §4.9
 */

export const PROVIDER_CORE_TYPES_VERSION = '0.1.0'

/* -------------------------------------------------------------------------- */
/* Image generate / edit                                                       */
/* -------------------------------------------------------------------------- */

/**
 * @typedef {Object} ImageGenerateInput
 * @property {string}  prompt
 * @property {string=} model           Override per-provider default
 * @property {string=} provider        Override the registry default route
 * @property {string[]=} images        Reference images (paths or swtd-asset:// URIs); presence routes to edit-mode
 * @property {string=} image           Sugar for images:[…]
 * @property {string=} size            e.g. '2048x2048'
 * @property {('1:1'|'4:5'|'9:16'|'16:9')=} aspectRatio
 * @property {('1K'|'2K'|'4K')=} resolution
 * @property {('low'|'medium'|'high'|'auto')=} quality
 * @property {('png'|'jpeg'|'webp')=} outputFormat
 * @property {('transparent'|'opaque'|'auto')=} background
 * @property {number=} count           v1 ignored; always 1 produced
 * @property {number=} timeoutMs
 * @property {(string|number)=} slotId
 * @property {string=} skuPath
 * @property {string=} templateId
 * @property {string=} angleId
 */

/**
 * @typedef {Object} ImageGenerateResult
 * @property {string}  file               Absolute path to PNG/JPEG/WebP under <sku>/output/tmp-generated/
 * @property {string}  sidecarPath        Absolute path to the matching JSON sidecar
 * @property {string}  servedProvider     'openai' | 'fal' | 'gemini' | 'kie' | 'custom' | 'mock'
 * @property {Array<{providerId:string, reason:string, status?:number}>} fallbackChain  Empty when primary served
 * @property {('generate'|'edit')} mode
 * @property {string}  model
 * @property {string}  mime
 * @property {number}  elapsedMs
 * @property {number}  generatedAt
 * @property {number}  expiresAt
 */

/* -------------------------------------------------------------------------- */
/* Provider contract                                                           */
/* -------------------------------------------------------------------------- */

/**
 * @typedef {Object} ProviderAuthField
 * @property {string}  id                'apiKey' | 'baseUrl' | 'providerName' | 'defaultImageModel' | …
 * @property {('secret'|'text'|'url'|'select')} type
 * @property {string}  label
 * @property {boolean=} required
 * @property {string[]=} options          For select
 * @property {string=} default            Default option (select) or placeholder (text/url)
 * @property {string=} hint
 */

/**
 * @typedef {Object} ProviderCapabilities
 * @property {boolean} supportsGenerate
 * @property {boolean} supportsEdit
 * @property {string=} defaultGenerateModel
 * @property {string=} defaultEditModel
 * @property {string[]=} supportedAspectRatios
 * @property {string[]=} supportedQualities
 * @property {string[]=} supportedOutputFormats
 */

/**
 * @typedef {Object} ImageProvider
 * @property {string}                  id
 * @property {string}                  label
 * @property {ProviderAuthField[]}     authFields
 * @property {ProviderCapabilities}    capabilities
 * @property {string[]=}               models          Optional: explicit model list
 * @property {(input: ImageGenerateInput, ctx: ProviderExecCtx) => Promise<ProviderRawResult>} generate
 * @property {(input: ImageGenerateInput, ctx: ProviderExecCtx) => Promise<ProviderRawResult>=} edit
 * @property {(ctx: ProviderExecCtx) => Promise<{ ok:boolean, reason?:string }>} testConnection
 */

/**
 * @typedef {Object} ProviderExecCtx
 * @property {string|null} apiKey
 * @property {AbortSignal} signal
 * @property {number}      timeoutMs
 * @property {(level:string, msg:string, fields?:object) => void} log
 * @property {{ baseUrl?:string, modelPrefix?:string, providerName?:string }=} customConfig
 */

/**
 * @typedef {Object} ProviderRawResult
 * @property {Uint8Array|Buffer} bytes
 * @property {string}            mime
 * @property {string}            model
 * @property {('generate'|'edit')} mode
 * @property {number}            elapsedMs
 * @property {object=}           providerMeta   Debug info; MUST NOT contain auth material
 */

/* -------------------------------------------------------------------------- */
/* ProviderError                                                               */
/* -------------------------------------------------------------------------- */

/**
 * @typedef {Object} ProviderError
 * @property {'ProviderError'} name
 * @property {string}  providerId
 * @property {number=} status
 * @property {('unauthorized'|'rate-limited'|'timeout'|'network'|'invalid-response'|'invalid-input'|'invalid-key'|'aborted'|'provider-unsupported-edit'|'all-providers-failed'|'unknown')} reason
 * @property {string=} hint
 * @property {Array<{providerId:string, reason:string, status?:number}>=} attempted  Populated on all-providers-failed
 */

/* -------------------------------------------------------------------------- */
/* KeyVault                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * @typedef {Object} KeyVault
 * @property {(providerId:string) => Promise<string|null>} getKey       Only called inside main; NEVER exposed to renderer
 * @property {(providerId:string, value:string) => Promise<void>} setKey
 * @property {(providerId:string) => Promise<void>} clearKey
 * @property {(providerId:string) => Promise<boolean>} hasKey
 * @property {() => Promise<string[]>} listProvidersWithKeys
 * @property {() => { encryptionAvailable:boolean, backend:string }} info
 */

/* -------------------------------------------------------------------------- */
/* MediaStore                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * @typedef {Object} MediaStoreSaveInput
 * @property {string}      skuPath
 * @property {string|number} slotId
 * @property {Uint8Array|Buffer} bytes
 * @property {string}      mime
 * @property {string}      providerId
 * @property {string}      model
 * @property {('generate'|'edit')} mode
 * @property {string=}     promptHash
 * @property {string[]=}   sourceImages
 * @property {string=}     aspectRatio
 * @property {string=}     templateId
 * @property {string=}     angleId
 * @property {Array<{providerId:string, reason:string, status?:number}>=} fallbackChain
 */

/**
 * @typedef {Object} MediaStoreEntry
 * @property {string|number} slotId
 * @property {string}        file
 * @property {string}        sidecarPath
 * @property {number}        generatedAt
 * @property {number}        expiresAt
 * @property {string}        providerId
 * @property {string}        model
 * @property {('generate'|'edit')} mode
 * @property {string=}       aspectRatio
 */

/**
 * @typedef {Object} MediaStore
 * @property {(input: MediaStoreSaveInput) => Promise<MediaStoreEntry>} saveTmpImage
 * @property {(args:{skuPath:string}) => Promise<{ entries: MediaStoreEntry[], corrupt: string[] }>} listTmpImages
 * @property {(args:{skuPath:string}) => Promise<{ deleted:number, kept:number }>} cleanupExpired
 * @property {(args:{skuPath:string, slotId:string|number, sourceFile:string, destFile?:string}) => Promise<{ file:string }>} promoteToApproved
 */

/* -------------------------------------------------------------------------- */
/* Route configuration                                                         */
/* -------------------------------------------------------------------------- */

/**
 * @typedef {Object} RouteConfig
 * @property {string}   primary                 Provider id for the default primary route
 * @property {string[]} fallbackChain           Ordered provider ids tried on hard failure
 * @property {boolean}  allowMockFallback       When false (default), `mock` is NEVER auto-substituted
 */

/* -------------------------------------------------------------------------- */
/* Web research / Insight Brief                                                */
/* -------------------------------------------------------------------------- */

/**
 * @typedef {Object} WebResearchInput
 * @property {string[]=} urls
 * @property {string[]=} keywords
 * @property {string=}   productName
 * @property {string=}   productInsight       Operator-provided product description
 * @property {string=}   customerInsight      Operator-provided audience notes
 * @property {string=}   marketplace          'amazon-us' | 'etsy' | 'social' | …
 * @property {('quick'|'standard'|'deep')=} depth
 * @property {string=}   skuPath              Required for persisting brief artifacts
 */

/**
 * @typedef {Object} InsightBriefSource
 * @property {string}  url
 * @property {number}  fetchedAt
 * @property {string}  contentType
 * @property {boolean} sanitized
 * @property {string[]=} flaggedPassages     Quoted prompt-injection candidates preserved for audit
 * @property {string=} excerpt               First N chars of the sanitized body
 */

/**
 * @typedef {Object} InsightBrief
 * @property {{ name?:string, category?:string, materials:string[], features:string[], differentiators:string[], dimensions?:string, useCase?:string }} product
 * @property {{ audience?:string, painPoints:string[], desires:string[], buyingTriggers:string[], language:string[] }} customer
 * @property {{ marketplace?:string, competitors:string[], visualPatterns:string[], claims:string[], risks:string[] }} market
 * @property {{ style?:string, mood?:string, mustShow:string[], mustAvoid:string[] }} creativeDirection
 * @property {{ generatedAt:number, version:string, sources: InsightBriefSource[] }} meta
 */

/**
 * @typedef {Object} CreativeBrief
 * @property {string=}  style
 * @property {string=}  mood
 * @property {string[]} mustShow
 * @property {string[]} mustAvoid
 * @property {{ generatedAt:number, version:string, sourceInsightBriefAt:number }} meta
 */
