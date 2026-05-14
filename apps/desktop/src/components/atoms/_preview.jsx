import React, { useState } from 'react'
import Button from './Button.jsx'
import IconButton from './IconButton.jsx'
import StatusDot from './StatusDot.jsx'
import StatusChip from './StatusChip.jsx'
import Input from './Input.jsx'
import EmptyState from './EmptyState.jsx'
import './_preview.css'

const BTN_VARIANTS = ['primary', 'secondary', 'ghost', 'danger']
const BTN_SIZES = ['sm', 'md', 'lg']
const ICON_SIZES = ['sm', 'md', 'lg']
const DOT_STATUSES = ['idle', 'running', 'done', 'error', 'locked', 'warning']
const CHIP_STATUSES = ['ready', 'idle', 'locked', 'running', 'needs-fix', 'error', 'complete']

/**
 * Dev-only catalog of every atom variant. Not wired into the app.
 * Render via a local route or by temporarily mounting from main.jsx
 * to eyeball styles against the design tokens.
 */
export default function AtomsPreview() {
  const [text, setText] = useState('')
  const [search, setSearch] = useState('amazon')
  const [num, setNum] = useState(8)

  return (
    <div className="atoms-preview">
      <Header title="Atoms · preview" subtitle="apps/desktop/src/components/atoms" />

      <Section title="Button — variants × sizes">
        <div className="atoms-grid">
          {BTN_VARIANTS.map((v) => (
            <div key={v} className="atoms-row">
              <span className="atoms-row__label">{v}</span>
              {BTN_SIZES.map((s) => (
                <Button key={s} variant={v} size={s} leftIcon={<span>▶</span>}>
                  Run {s}
                </Button>
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Button — states">
        <div className="atoms-flex">
          <Button variant="primary" leftIcon={<span>▶</span>}>Default</Button>
          <Button variant="primary" leftIcon={<span>▶</span>} shortcut="⌘↵">With shortcut</Button>
          <Button variant="primary" rightIcon={<span>→</span>}>Right icon</Button>
          <Button variant="primary" loading>Loading…</Button>
          <Button variant="primary" disabled>Disabled</Button>
          <Button
            variant="primary"
            disabled
            disabledReason="Select a SKU first"
          >
            Disabled w/ tooltip
          </Button>
          <Button variant="danger" leftIcon={<span>■</span>}>Cancel</Button>
          <Button variant="ghost" leftIcon={<span>↻</span>}>Refresh</Button>
        </div>
      </Section>

      <Section title="Button — fullWidth">
        <Button variant="primary" fullWidth leftIcon={<span>▶</span>} shortcut="⌘↵">
          Run listing
        </Button>
      </Section>

      <Section title="IconButton — variants × sizes">
        <div className="atoms-grid">
          {BTN_VARIANTS.map((v) => (
            <div key={v} className="atoms-row">
              <span className="atoms-row__label">{v}</span>
              {ICON_SIZES.map((s) => (
                <IconButton key={s} variant={v} size={s} icon="↻" label={`Refresh ${s}`} />
              ))}
              <IconButton variant={v} icon="✓" label="Active" active />
              <IconButton variant={v} icon="✕" label="Disabled" disabled disabledReason="Nothing to clear" />
            </div>
          ))}
        </div>
      </Section>

      <Section title="StatusDot">
        <div className="atoms-flex">
          {DOT_STATUSES.map((s) => (
            <span key={s} className="atoms-inline">
              <StatusDot status={s} label={s} />
              <span className="atoms-inline__label">{s}</span>
            </span>
          ))}
        </div>
      </Section>

      <Section title="StatusChip — sm + md">
        <div className="atoms-flex">
          {CHIP_STATUSES.map((s) => (
            <StatusChip key={s + '-sm'} status={s} size="sm" />
          ))}
        </div>
        <div className="atoms-flex">
          {CHIP_STATUSES.map((s) => (
            <StatusChip key={s + '-md'} status={s} size="md" />
          ))}
        </div>
        <div className="atoms-flex">
          <StatusChip status="running" icon={<span>◐</span>}>Live</StatusChip>
          <StatusChip status="complete" icon={<span>✓</span>}>Done</StatusChip>
        </div>
      </Section>

      <Section title="Input">
        <div className="atoms-stack">
          <Input
            placeholder="Plain text input"
            value={text}
            onChange={setText}
            ariaLabel="text"
          />
          <Input
            size="sm"
            placeholder="Small input"
            value={text}
            onChange={setText}
            leftIcon={<span>›</span>}
            ariaLabel="small text"
          />
          <Input
            type="search"
            placeholder="Search SKUs"
            value={search}
            onChange={setSearch}
            leftIcon={<span>⌕</span>}
            shortcut="⌘K"
            ariaLabel="search"
          />
          <Input
            type="number"
            value={num}
            onChange={(v) => setNum(v)}
            rightSlot={<span>units</span>}
            ariaLabel="quantity"
          />
          <Input
            placeholder="Disabled"
            value=""
            onChange={() => {}}
            disabled
            ariaLabel="disabled"
          />
          <Input
            placeholder="With error"
            value="bad"
            onChange={() => {}}
            error="Must be a valid SKU folder name"
            ariaLabel="errored"
          />
        </div>
      </Section>

      <Section title="EmptyState — sizes">
        <div className="atoms-stack">
          <EmptyState
            size="sm"
            title="No SKUs"
            description="Pick a workspace folder to begin."
            primaryAction={{ label: 'Open folder', shortcut: '⌘O' }}
          />
          <EmptyState
            title="Select a SKU"
            description="Click any row in the left rail to load its brief.json."
            primaryAction={{ label: 'Pick workspace', shortcut: '⌘O' }}
            secondaryAction={{ label: 'View docs' }}
          />
          <EmptyState
            size="lg"
            icon={<span>◐</span>}
            title="Pipeline not yet wired"
            description="Phase 1 only ships the LISTING stage. A+, Video, and QC arrive in subsequent phases."
            primaryAction={{
              label: 'Run listing',
              shortcut: '⌘↵',
              disabled: true,
              disabledReason: 'Select & validate a SKU first'
            }}
            secondaryAction={{ label: 'Re-validate' }}
          />
        </div>
      </Section>
    </div>
  )
}

function Header({ title, subtitle }) {
  return (
    <header className="atoms-preview__head">
      <h1 className="atoms-preview__title">{title}</h1>
      <p className="atoms-preview__sub">{subtitle}</p>
    </header>
  )
}

function Section({ title, children }) {
  return (
    <section className="atoms-section">
      <h2 className="atoms-section__title">{title}</h2>
      <div className="atoms-section__body">{children}</div>
    </section>
  )
}
