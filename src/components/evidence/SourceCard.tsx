import { siteLabel } from '@/lib/evidence/text'
import { cn } from '@/lib/utils'
import { STANCE_LABEL, STANCE_ORDER, STANCE_RULE, type BoardSource } from './board-model'
import type { Stance } from '@/lib/evidence/constants'

export function SourceCard({
  source,
  disabled,
  onStance,
  onExclude,
}: {
  source: BoardSource
  disabled: boolean
  onStance: (id: string, stance: Stance) => void
  onExclude: (id: string, excluded: boolean) => void
}) {
  const meta = [source.sample ? 'Sample source' : '', source.author, source.publishedDate.slice(0, 10), siteLabel(source.url)]
    .filter(Boolean)
    .join(' · ')
  const changed = source.stance !== source.modelStance

  return (
    <article data-testid="source-card" className={cn('border border-border border-t-2 bg-card px-4 py-4', STANCE_RULE[source.stance])}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{STANCE_LABEL[source.stance]}</p>
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
          disabled={disabled}
          aria-pressed={source.excluded}
          onClick={() => onExclude(source.id, !source.excluded)}
        >
          {source.excluded ? 'Include' : 'Exclude'}
        </button>
      </div>
      <h3 className="mt-2 font-serif text-lg leading-snug">
        <a href={source.url} target="_blank" rel="noreferrer" className="text-foreground underline decoration-border underline-offset-4">
          {source.title}
        </a>
      </h3>
      <p className="mt-1 break-all text-xs leading-5 text-muted-foreground">{source.url}</p>
      <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
      <p className="mt-3 font-serif text-[15.5px] leading-7 text-foreground">{source.excerpt}</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        <span className="text-foreground">Classification note. </span>
        {source.reasoning || 'No classification note yet.'}
      </p>
      {changed && (
        <p className="mt-2 text-xs text-muted-foreground">
          You changed this from {STANCE_LABEL[source.modelStance].toLowerCase()}.{' '}
          <button
            type="button"
            className="underline decoration-border underline-offset-4 hover:text-foreground disabled:opacity-50"
            disabled={disabled}
            onClick={() => onStance(source.id, source.modelStance)}
          >
            Restore
          </button>
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Classification for ${source.title}`}>
        {STANCE_ORDER.map((stance) => (
          <button
            key={stance}
            type="button"
            disabled={disabled}
            aria-pressed={source.stance === stance}
            onClick={() => onStance(source.id, stance)}
            className={cn(
              'border px-2 py-1 text-xs focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50',
              source.stance === stance ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground hover:bg-secondary',
            )}
          >
            {STANCE_LABEL[stance]}
          </button>
        ))}
      </div>
    </article>
  )
}
