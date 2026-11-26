import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutations, useQuery } from 'deepspace'
import { EvidenceBoard } from '@/components/evidence/EvidenceBoard'
import type { BoardSource } from '@/components/evidence/board-model'
import { callAction } from '@/lib/call-action'
import type { Stance } from '@/lib/evidence/constants'
import { asStance, asStatus, isExcluded, STATUS_LABEL, type ClassifyResult, type DeleteResult, type InvestigationData, type SourceData, type SynthesisResult } from '@/lib/evidence/types'
import { storedSynthesisSchema } from '@/lib/evidence/validate'

export default function InvestigationPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const investigations = useQuery<InvestigationData>('investigations', {
    orderBy: 'createdAt',
    orderDir: 'desc',
    limit: 100,
  })
  const sources = useQuery<SourceData>('sources', {
    where: { investigationId: id },
    orderBy: 'position',
    orderDir: 'asc',
    limit: 20,
  })
  const sourceWrites = useMutations<SourceData>('sources')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const investigation = investigations.records.find((record) => record.recordId === id)
  const boardSources: BoardSource[] = [...sources.records]
    .sort((a, b) => Number(a.data.position) - Number(b.data.position))
    .map((record) => ({
      id: record.recordId,
      sourceKey: String(record.data.sourceKey ?? ''),
      title: String(record.data.title ?? ''),
      url: String(record.data.url ?? ''),
      excerpt: String(record.data.excerpt ?? ''),
      author: String(record.data.author ?? ''),
      publishedDate: String(record.data.publishedDate ?? ''),
      stance: asStance(record.data.stance),
      modelStance: asStance(record.data.modelStance),
      reasoning: String(record.data.reasoning ?? ''),
      excluded: isExcluded(record.data.excluded),
    }))
  const parsed = storedSynthesisSchema.safeParse(parseJson(investigation?.data.synthesis))
  const synthesis = parsed.success ? parsed.data : null
  const synthesisError = investigation?.data.synthesis && !parsed.success ? 'The saved synthesis could not be read.' : null

  async function onStance(sourceId: string, stance: Stance) {
    setError(null)
    try {
      await sourceWrites.putConfirmed(sourceId, { stance })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The label could not be saved.')
    }
  }

  async function onExclude(sourceId: string, excluded: boolean) {
    setError(null)
    try {
      await sourceWrites.putConfirmed(sourceId, { excluded: excluded ? 'yes' : 'no' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The source could not be updated.')
    }
  }

  async function onSynthesize() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await callAction<SynthesisResult>('synthesizeInvestigation', { investigationId: id })
      if (!result.success) setError(result.error)
    } finally {
      setBusy(false)
    }
  }

  async function onClassify() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await callAction<ClassifyResult>('classifyInvestigation', { investigationId: id })
      if (!result.success) setError(result.error)
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await callAction<DeleteResult>('deleteInvestigation', { investigationId: id })
      if (!result.success) {
        setError(result.error)
        setConfirmDelete(false)
        return
      }
      navigate('/home')
    } finally {
      setBusy(false)
    }
  }

  if (investigations.status === 'loading' || sources.status === 'loading') {
    return <p className="px-5 py-10 text-sm text-muted-foreground">Loading the investigation…</p>
  }
  if (investigations.status === 'error' || sources.status === 'error') {
    return <p className="px-5 py-10 text-sm text-[#8a3d32]">{investigations.error || sources.error || 'The investigation could not be loaded.'}</p>
  }
  if (!investigation) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-serif text-3xl">That investigation is not on this desk.</h1>
        <Link to="/home" className="mt-4 inline-block text-sm underline decoration-border underline-offset-4">
          Back to investigations
        </Link>
      </div>
    )
  }

  const status = asStatus(investigation.data.status)

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <EvidenceBoard
        claim={String(investigation.data.claim ?? '')}
        detail={String(investigation.data.statusDetail ?? '')}
        sources={boardSources}
        synthesis={synthesis}
        sample={false}
        busy={busy}
        error={error || synthesisError}
        actionLabel="Write synthesis from included sources"
        disabled={!sourceWrites.ready || busy}
        onStance={onStance}
        onExclude={onExclude}
        onSynthesize={onSynthesize}
        kicker={`Investigation · ${STATUS_LABEL[status]}`}
        toolbar={
          <div className="flex flex-wrap gap-2">
            {(status === 'partial' || status === 'error') && boardSources.length > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={onClassify}
                className="border border-border px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50"
              >
                Classify again
              </button>
            )}
            {confirmDelete && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
                className="border border-border px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className="border border-border px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50"
            >
              {confirmDelete ? 'Confirm delete' : 'Delete'}
            </button>
          </div>
        }
      />
      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Labels you change stay on this investigation. Classify again replaces them with a new model pass.
      </p>
    </div>
  )
}

function parseJson(value: string | undefined): unknown {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
