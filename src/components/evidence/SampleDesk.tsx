import { useState } from 'react'
import { SAMPLE_CLAIM, SAMPLE_SOURCES, initialSampleSynthesis } from '@/lib/evidence/sample'
import { renderSampleSynthesis } from '@/lib/evidence/synthesis'
import type { Stance } from '@/lib/evidence/constants'
import { EvidenceBoard } from './EvidenceBoard'
import type { BoardSource } from './board-model'

const SAMPLE_DETAIL =
  'These six cards are written for review. Nothing on this page searches the web or calls a model. Change a label, exclude a card, and update the reading to see the board respond.'

function toBoard(source: (typeof SAMPLE_SOURCES)[number]): BoardSource {
  return {
    id: source.sourceKey,
    sourceKey: source.sourceKey,
    title: source.title,
    url: source.url,
    excerpt: source.excerpt,
    author: '',
    publishedDate: '',
    stance: source.stance,
    modelStance: source.stance,
    reasoning: 'Sample note written for review. This is not a model classification and not a retrieved quotation.',
    excluded: source.excluded,
    sample: true,
  }
}

export function SampleDesk({ heading = 'h1' }: { heading?: 'h1' | 'h2' }) {
  const [sources, setSources] = useState<BoardSource[]>(() => SAMPLE_SOURCES.map(toBoard))
  const [synthesis, setSynthesis] = useState(initialSampleSynthesis)

  function onStance(id: string, stance: Stance) {
    setSources((current) => current.map((source) => (source.id === id ? { ...source, stance } : source)))
  }

  function onExclude(id: string, excluded: boolean) {
    setSources((current) => current.map((source) => (source.id === id ? { ...source, excluded } : source)))
  }

  return (
    <div data-testid="sample-investigation">
      <EvidenceBoard
        claim={SAMPLE_CLAIM}
        detail={SAMPLE_DETAIL}
        sources={sources}
        synthesis={synthesis}
        sample
        busy={false}
        error={null}
        actionLabel="Update sample reading"
        disabled={false}
        heading={heading}
        onStance={onStance}
        onExclude={onExclude}
        onSynthesize={() =>
          setSynthesis(
            renderSampleSynthesis(
              SAMPLE_CLAIM,
              sources.map((source) => ({
                sourceKey: source.sourceKey,
                title: source.title,
                url: source.url,
                excerpt: source.excerpt,
                stance: source.stance,
                excluded: source.excluded,
              })),
            ),
          )
        }
      />
    </div>
  )
}
