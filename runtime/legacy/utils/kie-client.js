const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
sharp.cache(false); // Prevent Windows EBUSY/EPERM file locks from libvips caching
const { createLogger } = require('./logger');

/**
 * KIE.ai Unified API Client v2 — Parallel-optimized
 *
 * Features:
 *   - Semaphore-based concurrency control
 *   - Smart polling (adaptive intervals per task type)
 *   - Persistent upload cache (file-backed, 3-day TTL)
 *   - runBatch() for parallel task execution
 *   - Flux Kontext support (separate endpoint)
 */

// ═══════════════════════════════════════
//  SEMAPHORE — Concurrency limiter
// ═══════════════════════════════════════

class Semaphore {
  constructor(max) {
    this.max = max;
    this.current = 0;
    this._queue = [];
  }

  async acquire() {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    // Wait for a slot to free up
    return new Promise(resolve => this._queue.push(resolve));
  }

  release() {
    this.current--;
    if (this._queue.length > 0) {
      this.current++;
      const next = this._queue.shift();
      next();
    }
  }
}

// ═══════════════════════════════════════
//  SMART POLLING CONFIG
// ═══════════════════════════════════════

const POLL_PROFILES = {
  image: {
    initialDelayMs: 10000,        // Wait 10s before first poll
    intervals: [3000, 5000, 8000, 12000], // Escalating intervals
    timeoutMs: 10 * 60 * 1000    // 10 min (doubled from 5 min — fewer premature retries on slow nano-banana tasks)
  },
  video: {
    initialDelayMs: 30000,        // Wait 30s before first poll
    intervals: [5000, 8000, 12000, 15000],
    timeoutMs: 20 * 60 * 1000    // 20 min (doubled from 10 min)
  },
  fast: {
    initialDelayMs: 3000,         // BG removal, quick tasks
    intervals: [3000, 3000, 5000, 5000],
    timeoutMs: 6 * 60 * 1000     // 6 min (doubled from 3 min)
  }
};

// ═══════════════════════════════════════
//  KIE CLIENT
// ═══════════════════════════════════════

class KieClient {
  constructor(apiKey) {
    if (!apiKey) throw new Error('[KIE] API key required. Set KIE_KEY in config/api-keys.env');
    this.log = createLogger('KIE');
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.kie.ai';
    this.uploadUrl = 'https://kieai.redpandaai.co';

    // Upload cache — file-backed with in-memory overlay
    this._uploadCache = {};
    this._cacheDir = null;
    this._cachePath = null;

    // Retry config — doubled (was 3 retries / [2s,4s,6s])
    // Rationale: transient errors (timeout, 5xx, 429) deserve more attempts
    // because the primary failure mode is premature give-up, not bad input.
    this.retryMax = 6;
    this.retryDelays = [4000, 8000, 12000, 16000, 20000, 24000];

    // Rate limit tracking
    this._requestTimestamps = [];
    this._rateLimit = 20;
    this._rateWindow = 10000;

    // Concurrency (default, can be overridden)
    this.semaphore = new Semaphore(10);
  }

  // ═══════════════════════════════════════
  //  CONCURRENCY CONTROL
  // ═══════════════════════════════════════

  setConcurrency(max) {
    this.semaphore = new Semaphore(max);
    this.log.info(`Concurrency set to ${max}`);
  }

  setBudget(budget) {
    this._budget = budget;
  }

  // ═══════════════════════════════════════
  //  PERSISTENT UPLOAD CACHE
  // ═══════════════════════════════════════

  setCacheDir(dir) {
    this._cacheDir = dir;
    this._cachePath = path.join(dir, '.kie-upload-cache.json');
    // Load existing cache
    if (fs.existsSync(this._cachePath)) {
      try {
        const cached = JSON.parse(fs.readFileSync(this._cachePath, 'utf8'));
        const now = Date.now();
        const TTL = 3 * 24 * 60 * 60 * 1000; // 3 days
        // Filter expired entries
        for (const [key, entry] of Object.entries(cached)) {
          if (now - new Date(entry.uploadedAt).getTime() < TTL) {
            this._uploadCache[key] = entry.url;
          }
        }
        const validCount = Object.keys(this._uploadCache).length;
        if (validCount > 0) this.log.info(`Cache loaded: ${validCount} URLs from disk`);
      } catch (e) {
        // Corrupt cache, start fresh
      }
    }
  }

  _saveCache(cacheKey, url, fileSize) {
    if (!this._cachePath) return;
    let disk = {};
    if (fs.existsSync(this._cachePath)) {
      try { disk = JSON.parse(fs.readFileSync(this._cachePath, 'utf8')); } catch {}
    }
    disk[cacheKey] = { url, uploadedAt: new Date().toISOString(), fileSize };
    fs.writeFileSync(this._cachePath, JSON.stringify(disk, null, 2));
  }

  // ═══════════════════════════════════════
  //  AUTH & RATE LIMIT
  // ═══════════════════════════════════════

  _headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Fetch with AbortController timeout — prevents indefinite hangs.
   * @param {string} url
   * @param {Object} options - standard fetch options
   * @param {number} timeoutMs - request timeout (default 60s, doubled from 30s)
   */
  async _fetch(url, options = {}, timeoutMs = 60000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
      if (err.name === 'AbortError') throw new Error(`[KIE] Request timeout after ${timeoutMs / 1000}s: ${url.substring(0, 80)}`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async _enforceRateLimit() {
    const now = Date.now();
    this._requestTimestamps = this._requestTimestamps.filter(t => now - t < this._rateWindow);
    if (this._requestTimestamps.length >= this._rateLimit) {
      const oldest = this._requestTimestamps[0];
      const waitMs = this._rateWindow - (now - oldest) + 100;
      this.log.warn(`Rate limit (${this._requestTimestamps.length}/${this._rateLimit}). Waiting ${waitMs}ms...`);
      await new Promise(r => setTimeout(r, waitMs));
    }
    this._requestTimestamps.push(Date.now());
  }

  // ═══════════════════════════════════════
  //  FILE UPLOAD
  // ═══════════════════════════════════════

  async uploadBase64(base64Data, uploadPath, fileName) {
    await this._enforceRateLimit();

    const response = await this._fetch(`${this.uploadUrl}/api/file-base64-upload`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ base64Data, uploadPath, fileName })
    }, 120000); // 120s timeout for file uploads (doubled from 60s)

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(`[KIE] Upload failed: ${data.msg || response.status}`);
    }

    const info = data.data;
    this.log.info(`Uploaded: ${fileName} (${(info.fileSize / 1024).toFixed(0)}KB)`);
    return info.downloadUrl;
  }

  async uploadFromLocal(localPath, uploadPath = 'product-refs', resizeOptions = {}) {
    const cacheKey = `${localPath}:${JSON.stringify(resizeOptions)}`;
    if (this._uploadCache[cacheKey]) return this._uploadCache[cacheKey];

    const { maxSize = 768, quality = 85, format = 'jpeg' } = resizeOptions;
    const fileName = path.basename(localPath).replace(/[^a-zA-Z0-9._-]/g, '_');

    const buffer = await sharp(localPath, { failOn: 'none' })
      .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
      [format]({ quality })
      .toBuffer();

    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const base64Data = `data:${mimeType};base64,${buffer.toString('base64')}`;
    const ext = format === 'png' ? '.png' : '.jpg';
    const uploadFileName = fileName.replace(/\.[^.]+$/, ext);
    const downloadUrl = await this.uploadBase64(base64Data, uploadPath, uploadFileName);

    this._uploadCache[cacheKey] = downloadUrl;
    this._saveCache(cacheKey, downloadUrl, buffer.length);
    return downloadUrl;
  }

  /**
   * Pre-upload multiple local files in parallel (populate cache)
   */
  async preUpload(localPaths, uploadPath = 'product-refs', resizeOptions = {}) {
    const promises = localPaths.map(p =>
      this.uploadFromLocal(p, uploadPath, resizeOptions).catch(err => {
        this.log.warn(`Pre-upload failed: ${path.basename(p)} — ${err.message}`);
        return null;
      })
    );
    const results = await Promise.allSettled(promises);
    const uploaded = results.filter(r => r.status === 'fulfilled' && r.value).length;
    this.log.info(`Pre-uploaded: ${uploaded}/${localPaths.length} refs cached`);
  }

  // ═══════════════════════════════════════
  //  TASK MANAGEMENT
  // ═══════════════════════════════════════

  async createTask(model, input, callBackUrl = null) {
    await this._enforceRateLimit();

    const body = { model, input };
    if (callBackUrl) body.callBackUrl = callBackUrl;

    const response = await this._fetch(`${this.baseUrl}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (data.code !== 200) {
      throw new Error(`[KIE] createTask failed (${model}): ${data.code} - ${data.msg}`);
    }

    return data.data.taskId;
  }

  // ═══════════════════════════════════════
  //  SMART POLLING
  // ═══════════════════════════════════════

  /**
   * Poll with adaptive intervals based on task type
   * @param {string} taskId
   * @param {string} type - 'image' | 'video' | 'fast'
   * @param {string} [label] - human-readable label for logs
   */
  async pollResultSmart(taskId, type = 'image', label = '') {
    const profile = POLL_PROFILES[type] || POLL_PROFILES.image;
    const startTime = Date.now();
    const tag = label || taskId.substring(0, 12);
    let pollCount = 0;

    // Initial delay — don't poll immediately, task needs time to start
    await new Promise(r => setTimeout(r, profile.initialDelayMs));

    while (Date.now() - startTime < profile.timeoutMs) {
      pollCount++;
      await this._enforceRateLimit();

      const response = await this._fetch(
        `${this.baseUrl}/api/v1/jobs/recordInfo?taskId=${taskId}`,
        { headers: this._headers() }
      );

      const data = await response.json();
      if (data.code !== 200) {
        throw new Error(`[KIE] Poll failed: ${data.code} - ${data.msg}`);
      }

      const { state, resultJson, failMsg, failCode, costTime } = data.data;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

      switch (state) {
        case 'success': {
          const costSec = costTime ? (costTime / 1000).toFixed(1) : elapsed;
          this.log.info(`${tag} — SUCCESS (${costSec}s, ${pollCount} polls)`);
          try { return JSON.parse(resultJson); }
          catch { return { resultUrls: [resultJson] }; }
        }
        case 'fail':
          throw new Error(`[KIE] ${tag} failed: ${failMsg || failCode || 'Unknown'}`);
        default: {
          // Log every 3rd poll or every 30s
          if (pollCount % 3 === 0) {
            this.log.debug(`${tag} — ${state} (poll #${pollCount}, ${elapsed}s)`);
          }
          // Adaptive interval: use escalating delays
          const intervalIdx = Math.min(pollCount - 1, profile.intervals.length - 1);
          await new Promise(r => setTimeout(r, profile.intervals[intervalIdx]));
        }
      }
    }

    throw new Error(`[KIE] ${tag} timed out after ${profile.timeoutMs / 1000}s`);
  }

  /**
   * Convenience: createTask + smartPoll with retry
   * @param {string} model
   * @param {Object} input
   * @param {string} type - 'image' | 'video' | 'fast'
   * @param {string} [label]
   */
  /**
   * Classify error as transient (retryable) or permanent (not retryable).
   * Transient: timeouts, 5xx server errors, rate limits (429), network failures.
   * Permanent: 400 bad request, 401/403 auth errors, invalid model/input.
   */
  _isTransientError(error) {
    const msg = (error.message || '').toLowerCase();
    // Permanent errors — do not retry
    if (msg.includes('400') || msg.includes('bad request')) return false;
    if (msg.includes('401') || msg.includes('403') || msg.includes('unauthorized') || msg.includes('forbidden')) return false;
    if (msg.includes('invalid') && (msg.includes('model') || msg.includes('param') || msg.includes('input'))) return false;
    if (msg.includes('api key')) return false;
    // Transient errors — retry
    if (msg.includes('429') || msg.includes('rate limit')) return true;
    if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) return true;
    if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('abort')) return true;
    if (msg.includes('econnreset') || msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('fetch failed')) return true;
    // Default: treat task failures (from API fail state) as transient (model may succeed on retry)
    return true;
  }

  async run(model, input, type = 'image', label = '', retry = 0) {
    const tag = label || model;
    // Charge credit budget on initial attempt only (retries don't double-charge)
    if (retry === 0 && this._budget) {
      const cat = String(model || 'unknown').replace(/[\/-]/g, '_');
      this._budget.charge(cat, 1);
    }
    try {
      const taskId = await this.createTask(model, input);
      return await this.pollResultSmart(taskId, type, tag);
    } catch (error) {
      if (retry < this.retryMax - 1 && this._isTransientError(error)) {
        const baseDelay = this.retryDelays[retry] || 6000;
        const jitter = Math.floor(Math.random() * 1000); // 0-1000ms jitter prevents thundering herd
        const delay = baseDelay + jitter;
        this.log.warn({ model, retry: retry + 1, maxRetry: this.retryMax, delaySec: (delay / 1000).toFixed(1), err: error.message }, `${tag} — transient error, retrying`);
        await new Promise(r => setTimeout(r, delay));
        return this.run(model, input, type, label, retry + 1);
      }
      if (!this._isTransientError(error)) {
        this.log.error({ model, err: error.message }, `${tag} — permanent error, no retry`);
      }
      throw error;
    }
  }

  // ═══════════════════════════════════════
  //  BATCH EXECUTION — Core parallel method
  // ═══════════════════════════════════════

  /**
   * Run multiple tasks in parallel with concurrency control
   * @param {Array<{model, input, type?, label}>} tasks
   * @param {number} concurrency - max concurrent (default: semaphore max)
   * @returns {Array<{label, status:'ok'|'fail', result?, error?}>}
   */
  async runBatch(tasks, concurrency = null) {
    const sem = concurrency ? new Semaphore(concurrency) : this.semaphore;
    const startTime = Date.now();

    this.log.info(`Batch: ${tasks.length} tasks, concurrency ${sem.max}`);

    const promises = tasks.map(async (task) => {
      await sem.acquire();
      try {
        const result = await this.run(
          task.model, task.input,
          task.type || 'image',
          task.label || task.model
        );
        return { label: task.label, status: 'ok', result };
      } catch (error) {
        return { label: task.label, status: 'fail', error: error.message };
      } finally {
        sem.release();
      }
    });

    const results = await Promise.all(promises);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const okCount = results.filter(r => r.status === 'ok').length;
    const failCount = tasks.length - okCount;
    this.log.info({ okCount, failCount, total: tasks.length, elapsedSec: parseInt(elapsed) }, `Batch done: ${okCount}/${tasks.length} OK (${elapsed}s)`);

    return results;
  }

  // ═══════════════════════════════════════
  //  FLUX KONTEXT
  // ═══════════════════════════════════════

  async fluxGenerate(params) {
    await this._enforceRateLimit();
    const defaults = { model: 'flux-kontext-pro', outputFormat: 'jpeg', enableTranslation: true, safetyTolerance: 2 };
    const body = { ...defaults, ...params };

    const response = await this._fetch(`${this.baseUrl}/api/v1/flux/kontext/generate`, {
      method: 'POST', headers: this._headers(), body: JSON.stringify(body)
    });
    const data = await response.json();
    if (data.code !== 200) throw new Error(`[KIE] Flux generate failed: ${data.code} - ${data.msg}`);
    return data.data.taskId;
  }

  async fluxPoll(taskId) {
    const startTime = Date.now();
    const profile = POLL_PROFILES.image;

    await new Promise(r => setTimeout(r, profile.initialDelayMs));

    while (Date.now() - startTime < profile.timeoutMs) {
      await this._enforceRateLimit();
      const response = await this._fetch(
        `${this.baseUrl}/api/v1/flux/kontext/record-info?taskId=${taskId}`,
        { headers: this._headers() }
      );
      const data = await response.json();
      if (data.code !== 200) throw new Error(`[KIE] Flux poll failed: ${data.code} - ${data.msg}`);

      const { successFlag, response: result, errorMessage } = data.data;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

      switch (successFlag) {
        case 1: this.log.info(`Flux SUCCESS (${elapsed}s)`); return result;
        case 2: throw new Error(`[KIE] Flux create failed: ${errorMessage || 'Unknown'}`);
        case 3: throw new Error(`[KIE] Flux gen failed: ${errorMessage || 'Unknown'}`);
        default:
          if (parseInt(elapsed) % 15 === 0 && parseInt(elapsed) > 0) {
            this.log.debug(`Flux: generating (${elapsed}s)`);
          }
          await new Promise(r => setTimeout(r, 3000));
      }
    }
    throw new Error(`[KIE] Flux timed out`);
  }

  async fluxRun(params) {
    const taskId = await this.fluxGenerate(params);
    return this.fluxPoll(taskId);
  }

  // ═══════════════════════════════════════
  //  CREDIT CHECK
  // ═══════════════════════════════════════

  async checkCredit() {
    const response = await this._fetch(`${this.baseUrl}/api/v1/chat/credit`, { headers: this._headers() });
    const data = await response.json();
    if (data.code === 200) this.log.info({ credits: data.data }, 'Credits checked');
    return data.data;
  }
}

module.exports = { KieClient, Semaphore };
