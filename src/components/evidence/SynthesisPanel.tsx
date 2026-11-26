import { evidenceFingerprint } from '@/lib/evidence/synthesis'
import type { StoredSynthesis } from '@/lib/evidence/validate'
import type { BoardSource } from './board-model'

export function SynthesisPanel({
  synthesis,
  sources,
  sample,
  busy,
  error,
  actionLabel,
  onSynthesize,
}: {
  synthesis: StoredSynthesis | null
  sources: BoardSource[]
  sample: boolean
  busy: boolean
  error: string | null
  actionLabel: string
  onSynthesize: () => void
}) {
  const included = sources.filter((source) => !source.excluded).length
  const stale = synthesis !== null && synthesis.fingerprint !== evidenceFingerprint(sources)

  return (
    <section data-testid="synthesis-panel" className="border border-border bg-card px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-serif text-xl">Synthesis</h2>
        <p className="text-xs text-muted-foreground">
          {included} included · {sources.length - included} excluded
        </p>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {sample
          ? 'This reading is assembled in the browser from the cards you leave included. It does not call a model.'
          : 'Written from the included sources only, using their current labels and retrieved excerpts.'}
      </p>
      <button
        type="button"
        className="mt-3 border border-foreground bg-foreground px-3 py-2 text-sm text-background disabled:opacity-50"
        disabled={busy || included === 0}
        onClick={onSynthesize}
      >
        {busy ? 'Working…' : actionLabel}
      </button>
      {included === 0 && <p className="mt-2 text-sm text-muted-foreground">Include at least one source.</p>}
      {error && <p className="mt-3 text-sm text-[#8a3d32]">{error}</p>}
      {stale && synthesis && (
        <p className="mt-3 border-l-2 border-foreground pl-3 text-sm text-foreground" role="status">
          Out of date. The included sources or labels have changed since this synthesis.
        </p>
      )}
      {synthesis ? (
        <div className="mt-4 space-y-4">
          <p className="font-serif text-[16px] leading-7 text-foreground">{synthesis.summary}</p>
          <SynthesisList title="Supporting" lines={synthesis.supporting} />
          <SynthesisList title="Challenging" lines={synthesis.challenging} />
          <SynthesisList title="Open questions" lines={synthesis.unresolved} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No synthesis yet.</p>
      )}
    </section>
  )
}

function SynthesisList({ title, lines }: { title: string; lines: string[] }) {
  if (lines.length === 0) return null
  return (
    <div>
      <h3 className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
      <ul className="mt-2 space-y-1.5 text-sm leading-6 text-foreground">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}
