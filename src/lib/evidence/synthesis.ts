import type { Stance } from './constants'
import { synthesisUserMessage, type PromptSource } from './prompts'
import type { StoredSynthesis, SynthesisBody } from './validate'

export interface EvidenceRow {
  sourceKey: string
  title: string
  url: string
  excerpt: string
  stance: Stance
  excluded: boolean
}

export function evidenceFingerprint(sources: Array<Pick<EvidenceRow, 'sourceKey' | 'stance' | 'excluded'>>): string {
  return [...sources]
    .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey))
    .map((source) => `${source.sourceKey}:${source.stance}:${source.excluded ? 'out' : 'in'}`)
    .join('|')
}

export function includedSources(sources: EvidenceRow[]): EvidenceRow[] {
  return sources.filter((source) => !source.excluded)
}

/** Prompt payload for a synthesis. Excluded rows are omitted entirely. */
export function buildSynthesisInput(claim: string, sources: EvidenceRow[]): {
  included: PromptSource[]
  userMessage: string
  fingerprint: string
} {
  const included = includedSources(sources).map((source) => ({
    sourceKey: source.sourceKey,
    title: source.title,
    url: source.url,
    excerpt: source.excerpt,
    stance: source.stance,
  }))
  return {
    included,
    userMessage: synthesisUserMessage(claim, included),
    fingerprint: evidenceFingerprint(sources),
  }
}

export function withFingerprint(synthesis: SynthesisBody, fingerprint: string): StoredSynthesis {
  return { ...synthesis, fingerprint }
}

/**
 * Browser-only reading of the sample cards. It repeats titles and labels.
 * It does not add findings, links, or quotations.
 */
export function renderSampleSynthesis(claim: string, sources: EvidenceRow[]): StoredSynthesis {
  const included = includedSources(sources)
  const line = (stance: Stance, label: string) =>
    included.filter((source) => source.stance === stance).map((source) => `${label}: ${source.title}`)
  const summary =
    included.length === 0
      ? 'No sample sources are included, so there is nothing to read against the claim.'
      : `Sample reading of the claim “${claim}” from ${included.length} included card${included.length === 1 ? '' : 's'}. This note lists those cards. It was assembled in the browser. No search ran and no model was called.`
  return {
    summary,
    supporting: line('supporting', 'Marked supporting'),
    challenging: line('challenging', 'Marked challenging'),
    unresolved: line('inconclusive', 'Marked inconclusive'),
    fingerprint: evidenceFingerprint(sources),
  }
}
