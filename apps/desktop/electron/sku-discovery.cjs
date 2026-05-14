// SKU discovery helper — pure logic, no Electron deps.
//
// A workspace is either:
//   - 'single'  : the folder itself is a SKU (has brief.json or input/product/)
//   - 'parent'  : a folder containing SKU subfolders
//   - 'empty'   : a folder that contains neither
//
// Helper folders (research/, tmp/, hidden dotfiles, etc.) are filtered out so
// they don't appear in the SKU rail as "no brief" noise.

const fs = require('node:fs')
const path = require('node:path')

function isDirSafe(p) {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

function hasBriefJson(dir) {
  try {
    return fs.statSync(path.join(dir, 'brief.json')).isFile()
  } catch {
    return false
  }
}

function looksLikeSkuDir(dir) {
  if (hasBriefJson(dir)) return true
  if (isDirSafe(path.join(dir, 'input', 'product'))) return true
  return false
}

async function discoverSkus(workspacePath) {
  if (!workspacePath || !fs.existsSync(workspacePath)) {
    return { ok: false, error: 'Workspace path missing.', mode: null, items: [] }
  }

  if (!isDirSafe(workspacePath)) {
    return { ok: false, error: 'Workspace path is not a directory.', mode: null, items: [] }
  }

  if (looksLikeSkuDir(workspacePath)) {
    return {
      ok: true,
      mode: 'single',
      items: [{
        name: path.basename(workspacePath),
        path: workspacePath,
        hasBrief: hasBriefJson(workspacePath)
      }]
    }
  }

  let entries
  try {
    entries = await fs.promises.readdir(workspacePath, { withFileTypes: true })
  } catch (err) {
    return { ok: false, error: `Cannot read workspace: ${err.message}`, mode: null, items: [] }
  }

  const items = []
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const child = path.join(workspacePath, e.name)
    // Honor symlinked SKU folders too: isDirectory() is false for symlinks
    // when withFileTypes is used, so fall back to a stat-based check.
    if (!(e.isDirectory() || (e.isSymbolicLink() && isDirSafe(child)))) continue
    if (!looksLikeSkuDir(child)) continue
    items.push({ name: e.name, path: child, hasBrief: hasBriefJson(child) })
  }
  items.sort((a, b) => a.name.localeCompare(b.name))
  return { ok: true, mode: items.length ? 'parent' : 'empty', items }
}

module.exports = { discoverSkus, looksLikeSkuDir, hasBriefJson }
