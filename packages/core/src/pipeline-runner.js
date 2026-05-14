import { spawn } from 'node:child_process'

/**
 * Spawn a child process, stream stdout/stderr line-by-line via `onLine`,
 * and resolve with `{ code, ok, stdout, stderr, signal }` on close.
 *
 * Accepts an external AbortSignal so callers can cancel mid-run.
 * If `signal.abort()` fires we send SIGTERM, then SIGKILL after `killGraceMs`.
 */
export async function runPipeline({
  cmd,
  args = [],
  cwd,
  env,
  onLine,
  signal,
  killGraceMs = 4000,
}) {
  return new Promise((resolve, reject) => {
    let child
    try {
      child = spawn(cmd, args, {
        cwd,
        env: env ? { ...process.env, ...env } : process.env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (err) {
      reject(err)
      return
    }

    const outLines = []
    const errLines = []
    let stdoutBuf = ''
    let stderrBuf = ''

    function pump(buf, chunk, stream, sink) {
      const merged = buf + chunk.toString()
      const parts = merged.split(/\r?\n/)
      const tail = parts.pop()
      for (const line of parts) {
        if (line.length === 0) continue
        sink.push(line)
        if (onLine) onLine({ stream, line, ts: Date.now() })
      }
      return tail
    }

    child.stdout.on('data', (d) => {
      stdoutBuf = pump(stdoutBuf, d, 'stdout', outLines)
    })
    child.stderr.on('data', (d) => {
      stderrBuf = pump(stderrBuf, d, 'stderr', errLines)
    })

    let killTimer = null
    let aborted = false
    const onAbort = () => {
      if (!child.pid || child.exitCode !== null) return
      aborted = true
      try { child.kill('SIGTERM') } catch {}
      killTimer = setTimeout(() => {
        try { child.kill('SIGKILL') } catch {}
      }, killGraceMs)
    }
    if (signal) {
      if (signal.aborted) onAbort()
      else signal.addEventListener('abort', onAbort, { once: true })
    }

    child.on('error', (err) => {
      if (killTimer) clearTimeout(killTimer)
      if (signal) signal.removeEventListener?.('abort', onAbort)
      reject(err)
    })

    child.on('close', (code, sig) => {
      if (killTimer) clearTimeout(killTimer)
      if (signal) signal.removeEventListener?.('abort', onAbort)
      // Flush trailing partial lines.
      if (stdoutBuf) {
        outLines.push(stdoutBuf)
        if (onLine) onLine({ stream: 'stdout', line: stdoutBuf, ts: Date.now() })
      }
      if (stderrBuf) {
        errLines.push(stderrBuf)
        if (onLine) onLine({ stream: 'stderr', line: stderrBuf, ts: Date.now() })
      }
      resolve({
        code,
        ok: code === 0 && !aborted,
        signal: sig || null,
        aborted,
        stdout: outLines,
        stderr: errLines,
      })
    })
  })
}

/**
 * Convenience adapter for `node <runtimeRoot>/bin/<binName>.mjs <skuPath> [...extra]`.
 *
 * The HMA legacy bridge resolves relative SKU paths against `process.cwd()`, so
 * we always pass an absolute SKU path and run from the repo root for stable
 * behavior regardless of where the Electron process is launched.
 */
export async function runRuntimeBin({
  runtimeRoot,
  repoRoot,
  bin,
  skuPath,
  extraArgs = [],
  env,
  onLine,
  signal,
}) {
  const binPath = `${runtimeRoot}/bin/${bin}.mjs`
  const args = [binPath, skuPath, ...extraArgs]
  return runPipeline({
    cmd: process.execPath,
    args,
    cwd: repoRoot,
    env,
    onLine,
    signal,
  })
}
