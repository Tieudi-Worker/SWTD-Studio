import { spawn } from 'node:child_process'

/**
 * Run a pipeline command. Streams logs and yields exit code.
 */
export async function runPipeline({ cmd, args, cwd, onLine, signal }) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, shell: true, signal })
    const outLines = []
    const errLines = []

    child.stdout.on('data', d => {
      const lines = d.toString().split('\n').filter(Boolean)
      for (const l of lines) {
        outLines.push(l)
        if (onLine) onLine({ stream: 'stdout', line: l, ts: Date.now() })
      }
    })

    child.stderr.on('data', d => {
      const lines = d.toString().split('\n').filter(Boolean)
      for (const l of lines) {
        errLines.push(l)
        if (onLine) onLine({ stream: 'stderr', line: l, ts: Date.now() })
      }
    })

    child.on('close', code => {
      resolve({
        code,
        stdout: outLines,
        stderr: errLines,
        ok: code === 0
      })
    })

    child.on('error', reject)
  })
}
