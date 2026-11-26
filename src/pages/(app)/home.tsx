import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthOverlay, useAuth, useQuery } from 'deepspace'
import { ClaimForm } from '@/components/evidence/ClaimForm'
import { callAction } from '@/lib/call-action'
import type { InvestigateResult, InvestigationData } from '@/lib/evidence/types'
import { asStatus, STATUS_LABEL } from '@/lib/evidence/types'

export default function HomePage() {
  const { isSignedIn } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const investigations = useQuery<InvestigationData>('investigations', {
    orderBy: 'createdAt',
    orderDir: 'desc',
    limit: 40,
  })

  async function investigate(claim: string) {
    setBusy(true)
    setError(null)
    try {
      const result = await callAction<InvestigateResult>('investigateClaim', { claim })
      if (!result.success) {
        setError(result.error)
        return
      }
      navigate(`/investigations/${result.data.investigationId}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Desk</p>
      <h1 className="mt-2 font-serif text-4xl text-foreground">Investigations</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Signed-in investigations are saved to your account. A reviewer can use the{' '}
        <Link to="/sample" className="text-foreground underline decoration-border underline-offset-4">
          sample investigation
        </Link>{' '}
        without signing in.
      </p>
      <div className="mt-8">
        <ClaimForm
          signedIn={isSignedIn}
          busy={busy}
          error={error}
          onSignIn={() => setShowAuth(true)}
          onSubmit={investigate}
        />
      </div>
      <section className="mt-10">
        <h2 className="font-serif text-2xl">Saved</h2>
        {!isSignedIn ? (
          <p className="mt-3 text-sm text-muted-foreground">Sign in to see investigations saved on this account.</p>
        ) : investigations.status === 'loading' ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading your investigations…</p>
        ) : investigations.status === 'error' ? (
          <p className="mt-3 text-sm text-[#8a3d32]">{investigations.error || 'The list could not be loaded.'}</p>
        ) : investigations.records.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No investigations yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {investigations.records.map((record) => {
              const status = asStatus(record.data.status)
              return (
                <li key={record.recordId}>
                  <Link to={`/investigations/${record.recordId}`} className="flex items-baseline justify-between gap-4 py-3">
                    <span className="min-w-0">
                      <span className="block font-serif text-lg leading-snug text-foreground">{record.data.claim}</span>
                      {record.data.statusDetail && (
                        <span className="mt-1 block text-sm leading-6 text-muted-foreground">{record.data.statusDetail}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-xs uppercase tracking-[0.12em] text-muted-foreground">{STATUS_LABEL[status]}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{formatDay(record.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {showAuth && <AuthOverlay onClose={() => setShowAuth(false)} />}
    </div>
  )
}

function formatDay(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
