/**
 * Key Vault — v1 backend: Electron `safeStorage` with AES-on-disk fallback.
 *
 * The `KeyVault` interface (see types.js) is the only seam between providers
 * and the underlying secret store. v1 backs onto Electron's `safeStorage`
 * (OS keychain wrapper). If `safeStorage.isEncryptionAvailable()` returns
 * false (Linux without keyring, sandboxed environments), we fall back to
 * AES-256-GCM with a key derived from a machine-specific salt and log a
 * single explicit warning at boot.
 *
 * Provider Core never imports `electron` directly — `safeStorage` is
 * passed in as a dependency by `apps/desktop/electron/main.cjs`. This keeps
 * the package cloud-portable.
 *
 * Plan §4.7, D4.
 */

import {
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
  createHash
} from 'node:crypto'
import { promises as fs, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import { NOOP_LOGGER } from './logger.js'

const FILE_VERSION = 1
const AES_ALG = 'aes-256-gcm'
const SCRYPT_KEYLEN = 32
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 }

/**
 * Build a v1 KeyVault.
 *
 * @param {object} opts
 * @param {object} opts.safeStorage           Electron's safeStorage object (duck-typed; tests pass a mock)
 * @param {string} opts.vaultFilePath         Absolute path to the JSON vault file
 * @param {object} [opts.logger]
 * @param {string} [opts.machineSaltSeed]     Stable per-install string; ONLY used by the AES-on-disk fallback
 * @returns {import('./types.js').KeyVault & { info: () => { encryptionAvailable:boolean, backend:string } }}
 */
export function createSafeStorageVault({ safeStorage, vaultFilePath, logger, machineSaltSeed } = {}) {
  if (!safeStorage || typeof safeStorage.isEncryptionAvailable !== 'function') {
    throw new TypeError('createSafeStorageVault: safeStorage with isEncryptionAvailable() required')
  }
  if (!vaultFilePath || typeof vaultFilePath !== 'string') {
    throw new TypeError('createSafeStorageVault: vaultFilePath required')
  }
  const log = logger || NOOP_LOGGER

  const encryptionAvailable = Boolean(safeStorage.isEncryptionAvailable())
  const backend = encryptionAvailable ? 'safeStorage' : 'aes-on-disk'
  if (!encryptionAvailable) {
    log.warn(
      'OS encryption unavailable; keys stored AES-encrypted on disk with a derived key. ' +
      'Configure a system keyring for stronger protection.'
    )
  }

  // Derive the AES fallback key once. The seed is something machine-specific
  // the caller has (e.g. app.getPath('userData')) — not perfect entropy, but
  // strictly better than plaintext.
  let aesKey = null
  if (!encryptionAvailable) {
    const seed = machineSaltSeed || vaultFilePath
    const salt = createHash('sha256').update(`swtd-provider-core::${seed}`).digest()
    aesKey = scryptSync(seed, salt, SCRYPT_KEYLEN, SCRYPT_OPTS)
  }

  function ensureDir() {
    const dir = dirname(vaultFilePath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }

  async function readVault() {
    try {
      const raw = await fs.readFile(vaultFilePath, 'utf8')
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || typeof parsed.entries !== 'object') {
        return { version: FILE_VERSION, entries: {} }
      }
      return parsed
    } catch (err) {
      if (err && err.code === 'ENOENT') return { version: FILE_VERSION, entries: {} }
      log.error('keyvault: failed to read vault file', { code: err && err.code })
      return { version: FILE_VERSION, entries: {} }
    }
  }

  async function writeVault(data) {
    ensureDir()
    const tmp = vaultFilePath + '.tmp'
    await fs.writeFile(tmp, JSON.stringify(data, null, 2))
    await fs.rename(tmp, vaultFilePath)
  }

  function encrypt(plaintext) {
    if (encryptionAvailable) {
      return safeStorage.encryptString(plaintext).toString('base64')
    }
    const iv = randomBytes(12)
    const cipher = createCipheriv(AES_ALG, aesKey, iv)
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return JSON.stringify({
      v: 1, alg: AES_ALG,
      iv: iv.toString('base64'),
      ct: enc.toString('base64'),
      tag: tag.toString('base64')
    })
  }

  function decrypt(payload) {
    if (encryptionAvailable) {
      const buf = Buffer.from(payload, 'base64')
      return safeStorage.decryptString(buf)
    }
    let obj
    try { obj = JSON.parse(payload) } catch { return null }
    if (!obj || obj.alg !== AES_ALG) return null
    try {
      const iv = Buffer.from(obj.iv, 'base64')
      const ct = Buffer.from(obj.ct, 'base64')
      const tag = Buffer.from(obj.tag, 'base64')
      const decipher = createDecipheriv(AES_ALG, aesKey, iv)
      decipher.setAuthTag(tag)
      const dec = Buffer.concat([decipher.update(ct), decipher.final()])
      return dec.toString('utf8')
    } catch {
      return null
    }
  }

  return {
    info() { return { encryptionAvailable, backend } },

    async getKey(providerId) {
      if (!providerId || typeof providerId !== 'string') return null
      const data = await readVault()
      const entry = data.entries[providerId]
      if (!entry) return null
      try { return decrypt(entry) } catch { return null }
    },

    async setKey(providerId, value) {
      if (!providerId || typeof providerId !== 'string') {
        throw new TypeError('setKey: providerId required')
      }
      if (typeof value !== 'string') {
        throw new TypeError('setKey: value must be a string')
      }
      const data = await readVault()
      data.entries[providerId] = encrypt(value)
      data.version = FILE_VERSION
      await writeVault(data)
    },

    async clearKey(providerId) {
      const data = await readVault()
      if (data.entries[providerId] != null) {
        delete data.entries[providerId]
        await writeVault(data)
      }
    },

    async hasKey(providerId) {
      const data = await readVault()
      return Boolean(data.entries[providerId])
    },

    async listProvidersWithKeys() {
      const data = await readVault()
      return Object.keys(data.entries)
    }
  }
}
