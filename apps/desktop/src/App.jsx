import React, { useState } from 'react'

const tabs = [
  { id: 'project', label: 'Project' },
  { id: 'listing', label: 'Listing (8)' },
  { id: 'aplus',   label: 'A+ (5)' },
  { id: 'video',   label: 'Video 12-15s' },
  { id: 'qc',      label: 'QC / Export' },
  { id: 'settings',label: 'Settings' }
]

export default function App() {
  const [tab, setTab] = useState('project')
  return (
    <div style={styles.root}>
      <aside style={styles.side}>
        <div style={styles.brand}>SWTD Studio</div>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ ...styles.tab, ...(tab === t.id ? styles.tabActive : {}) }}
          >
            {t.label}
          </button>
        ))}
        <div style={styles.footer}>v0.1.0 · skeleton</div>
      </aside>
      <main style={styles.main}>
        <Panel id={tab} />
      </main>
    </div>
  )
}

function Panel({ id }) {
  const content = {
    project:  'Open or create a project workspace. Add SKUs and brief.json.',
    listing:  'Run/regenerate listing slots (8 × 2000×2000).',
    aplus:    'Run/regenerate A+ Premium modules (5 × 1464×600).',
    video:    'Compose video prompt and generate 12–15s video (1080p).',
    qc:       'Validate output bundle. Export ready-to-upload package.',
    settings: 'API keys, model routing, output paths.'
  }
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>{tabLabel(id)}</h2>
      <p style={styles.placeholder}>{content[id]}</p>
      <p style={styles.note}>Pipeline runner wiring will land in Phase 1+.</p>
    </div>
  )
}

function tabLabel(id) {
  return (tabs.find(t => t.id === id) || {}).label || id
}

const styles = {
  root:   { display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif', color: '#222' },
  side:   { width: 220, background: '#0e1116', color: '#eee', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 6 },
  brand:  { fontWeight: 700, fontSize: 16, marginBottom: 12 },
  tab:    { textAlign: 'left', padding: '8px 10px', background: 'transparent', color: '#ccc', border: '1px solid transparent', borderRadius: 6, cursor: 'pointer' },
  tabActive: { background: '#1f2937', color: '#fff', borderColor: '#374151' },
  footer: { marginTop: 'auto', fontSize: 12, opacity: .6 },
  main:   { flex: 1, padding: '24px 28px', overflow: 'auto', background: '#fafafa' },
  placeholder: { color: '#444' },
  note:   { color: '#888', fontSize: 13 }
}
