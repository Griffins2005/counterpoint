import type { EvidenceRow } from './synthesis'
import { renderSampleSynthesis } from './synthesis'
import type { StoredSynthesis } from './validate'

export const SAMPLE_CLAIM = 'A four-day workweek keeps weekly output steady while reducing burnout.'

export const SAMPLE_SOURCES: EvidenceRow[] = [
  {
    sourceKey: 's1',
    title: 'Sample: Harbor Office Pilot',
    url: 'https://example.com/counterpoint/sample/harbor-office',
    excerpt:
      'Sample note. In this fictional municipal pilot, teams that dropped one workday kept the same closed-case count over two quarters, and the staff survey showed lower exhaustion scores. The note does not claim the result holds for jobs that require on-site coverage.',
    stance: 'supporting',
    excluded: false,
  },
  {
    sourceKey: 's2',
    title: 'Sample: Regional Hospital Roster',
    url: 'https://example.com/counterpoint/sample/hospital-roster',
    excerpt:
      'Sample note. The fictional hospital roster study found attending physicians on a four-day clinical week completed the same number of billed encounters, with fewer self-reported burnout flags. Elective procedures were the setting; emergency coverage was excluded from the count.',
    stance: 'supporting',
    excluded: false,
  },
  {
    sourceKey: 's3',
    title: 'Sample: Manufacturers Council Brief',
    url: 'https://example.com/counterpoint/sample/manufacturers-council',
    excerpt:
      'Sample note. The fictional manufacturers council argues that plants running continuous shifts lost throughput when crews moved to four days, because handoffs and overtime replaced the fifth shift rather than being removed.',
    stance: 'challenging',
    excluded: false,
  },
  {
    sourceKey: 's4',
    title: 'Sample: Retail Scheduling Audit',
    url: 'https://example.com/counterpoint/sample/retail-audit',
    excerpt:
      'Sample note. The fictional retail audit found stores that shortened the week without hiring additional staff had longer customer waits on peak days, and managers reported that the work was concentrated rather than preserved.',
    stance: 'challenging',
    excluded: false,
  },
  {
    sourceKey: 's5',
    title: 'Sample: National Statistics Note',
    url: 'https://example.com/counterpoint/sample/statistics-note',
    excerpt:
      'Sample note. The fictional statistics office says published labor tables do not yet separate four-day schedules from other hour reductions, so a national output effect cannot be read from those tables.',
    stance: 'inconclusive',
    excluded: false,
  },
  {
    sourceKey: 's6',
    title: 'Sample: University Methods Comment',
    url: 'https://example.com/counterpoint/sample/methods-comment',
    excerpt:
      'Sample note. The fictional methods comment says most four-day studies follow volunteers for less than a year and rarely include a comparison site, so the current evidence does not decide the claim either way.',
    stance: 'inconclusive',
    excluded: false,
  },
]

export function initialSampleSynthesis(): StoredSynthesis {
  return renderSampleSynthesis(SAMPLE_CLAIM, SAMPLE_SOURCES)
}
