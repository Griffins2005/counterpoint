import type { InvestigationStatus, Stance } from './constants'
import type { StoredSynthesis } from './validate'

export interface InvestigateResult {
  investigationId: string
  status: InvestigationStatus
  sourceCount: number
  detail: string
}

export interface ClassifyResult {
  status: InvestigationStatus
  detail: string
  discarded: number
}

export interface SynthesisResult {
  synthesis: StoredSynthesis
}

export interface DeleteResult {
  deleted: true
}

export interface InvestigationData {
  claim: string
  status: string
  statusDetail: string
  synthesis: string
}

export interface SourceData {
  investigationId: string
  position: number
  sourceKey: string
  title: string
  url: string
  excerpt: string
  author: string
  publishedDate: string
  providerId: string
  stance: string
  modelStance: string
  reasoning: string
  excluded: string
}

export function asStance(value: unknown): Stance {
  if (value === 'supporting' || value === 'challenging' || value === 'inconclusive') return value
  return 'inconclusive'
}

export function isExcluded(value: unknown): boolean {
  return value === 'yes' || value === true || value === 1
}

export function asStatus(value: unknown): InvestigationStatus {
  if (value === 'ready' || value === 'empty' || value === 'partial' || value === 'error') return value
  return 'error'
}

export const STATUS_LABEL: Record<InvestigationStatus, string> = {
  ready: 'Ready',
  empty: 'No sources',
  partial: 'Needs classification',
  error: 'Stopped',
}
