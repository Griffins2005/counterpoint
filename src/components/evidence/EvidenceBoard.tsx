import type { ReactNode } from 'react'
import type { Stance } from '@/lib/evidence/constants'
import { STANCE_LABEL, STANCE_ORDER, type BoardSource } from './board-model'
import { SourceCard } from './SourceCard'
import { SynthesisPanel } from './SynthesisPanel'
import type { StoredSynthesis } from '@/lib/evidence/validate'

export function EvidenceBoard({
  claim,
  detail,
  sources,
  synthesis,
  sample,
  busy,
  error,
  actionLabel,
  disabled,
  toolbar,
  heading = 'h1',
  kicker,
  onStance,
  onExclude,
  onSynthesize,
}: {
  claim: string
  detail?: string
  sources: BoardSource[]
  synthesis: StoredSynthesis | null
  sample: boolean
  busy: boolean
  error: string | null
  actionLabel: string
  disabled: boolean
  toolbar?: ReactNode
  onStance: (id: string, stance: Stance) => void
  onExclude: (id: string, excluded: boolean) => void
  onSynthesize: () => void
  heading?: 'h1' | 'h2'
  kicker?: string
}) {
  const included = sources.filter((source) => !source.excluded)
  const excluded = sources.filter((source) => source.excluded)
  const Title = heading === 'h2' ? 'h2' : 'h1'
  const sourceCount = `${sources.length} source${sources.length === 1 ? '' : 's'}`
  const includedCount = `${included.length} included`

  return (
    <div data-testid="evidence-board">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {kicker ?? (sample ? 'Sample investigation' : 'Investigation')}
          </p>
          <Title className="mt-2 font-serif text-3xl leading-tight text-foreground sm:text-4xl">{claim}</Title>
          {detail && <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{detail}</p>}
          {sources.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {sourceCount} · {includedCount}
            </p>
          )}
        </div>
        {toolbar}
      </header>

      <div className="mt-8">
        <SynthesisPanel
          synthesis={synthesis}
          sources={sources}
          sample={sample}
          busy={busy}
          error={error}
          actionLabel={actionLabel}
          onSynthesize={onSynthesize}
        />
      </div>

      {sources.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No sources are on this board.</p>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {STANCE_ORDER.map((stance) => {
            const cards = included.filter((source) => source.stance === stance)
            return (
              <section key={stance} aria-label={STANCE_LABEL[stance]}>
                <h2 className="font-serif text-lg">{STANCE_LABEL[stance]}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{cards.length === 0 ? 'None included' : `${cards.length} included`}</p>
                <div className="mt-3 space-y-3">
                  {cards.map((source) => (
                    <SourceCard key={source.id} source={source} disabled={disabled} onStance={onStance} onExclude={onExclude} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {excluded.length > 0 && (
        <section className="mt-10" aria-label="Excluded sources">
          <h2 className="font-serif text-lg">Excluded</h2>
          <p className="mt-1 text-xs text-muted-foreground">Left out of the next synthesis.</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {excluded.map((source) => (
              <SourceCard key={source.id} source={source} disabled={disabled} onStance={onStance} onExclude={onExclude} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
