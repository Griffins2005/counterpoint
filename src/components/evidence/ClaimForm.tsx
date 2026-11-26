import { useRef, useState, type FormEvent } from 'react'
import { MIN_CLAIM_CHARS, MAX_CLAIM_CHARS } from '@/lib/evidence/constants'
import { parseClaim } from '@/lib/evidence/text'

export function ClaimForm({
  signedIn,
  busy,
  error,
  onSignIn,
  onSubmit,
}: {
  signedIn: boolean
  busy: boolean
  error: string | null
  onSignIn: () => void
  onSubmit: (claim: string) => void | Promise<void>
}) {
  const [claim, setClaim] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const pending = useRef(false)
  const parsed = parseClaim(claim)
  const shown = localError || error

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending.current || busy) return
    if (!signedIn) {
      onSignIn()
      return
    }
    if (!parsed.ok) {
      setLocalError(parsed.error)
      return
    }
    pending.current = true
    setLocalError(null)
    try {
      await onSubmit(parsed.claim)
    } finally {
      pending.current = false
    }
  }

  return (
    <form onSubmit={submit} className="border border-border bg-card px-4 py-4">
      <label htmlFor="claim" className="font-serif text-xl">
        Claim
      </label>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        A live run makes three searches, keeps at most eight sources, and classifies each excerpt. Eight investigations per UTC day.
        The sample on the front page does not spend a search.
      </p>
      <textarea
        id="claim"
        data-testid="claim-input"
        value={claim}
        maxLength={MAX_CLAIM_CHARS}
        disabled={busy}
        aria-invalid={shown ? true : undefined}
        aria-describedby={shown ? 'claim-error' : undefined}
        onChange={(event) => {
          setClaim(event.target.value)
          setLocalError(null)
        }}
        placeholder="State the claim in a sentence."
        className="mt-3 min-h-28 w-full border border-input bg-background px-3 py-2 font-serif text-base leading-7 text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          data-testid="investigate-button"
          disabled={busy || (signedIn && claim.trim().length > 0 && claim.trim().length < MIN_CLAIM_CHARS)}
          className="border border-foreground bg-foreground px-3 py-2 text-sm text-background disabled:opacity-50"
        >
          {busy ? 'Searching and reading…' : signedIn ? 'Investigate' : 'Sign in to investigate'}
        </button>
        <p className="text-xs text-muted-foreground">
          {claim.trim().length}/{MAX_CLAIM_CHARS}
        </p>
      </div>
      {shown && (
        <p id="claim-error" role="alert" className="mt-3 text-sm text-[#8a3d32]">
          {shown}
        </p>
      )}
    </form>
  )
}
