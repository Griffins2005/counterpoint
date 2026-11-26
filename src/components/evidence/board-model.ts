import type { Stance } from '@/lib/evidence/constants'
import type { StoredSynthesis } from '@/lib/evidence/validate'

export interface BoardSource {
  id: string
  sourceKey: string
  title: string
  url: string
  excerpt: string
  author: string
  publishedDate: string
  stance: Stance
  modelStance: Stance
  reasoning: string
  excluded: boolean
  sample?: boolean
}

export const STANCE_ORDER: Stance[] = ['supporting', 'challenging', 'inconclusive']

export const STANCE_LABEL: Record<Stance, string> = {
  supporting: 'Supporting',
  challenging: 'Challenging',
  inconclusive: 'Inconclusive',
}

export const STANCE_RULE: Record<Stance, string> = {
  supporting: 'border-t-[#2f5d50]',
  challenging: 'border-t-[#8a3d32]',
  inconclusive: 'border-t-[#8a8175]',
}

export interface BoardModel {
  claim: string
  detail: string
  sources: BoardSource[]
  synthesis: StoredSynthesis | null
  sample: boolean
}
