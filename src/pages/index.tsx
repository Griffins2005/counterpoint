import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { SampleDesk } from '../components/evidence/SampleDesk'
import { seo } from '../seo'

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-border pb-4">
          <p className="font-serif text-lg text-foreground">Counterpoint</p>
          <Link to="/home" className="text-sm text-foreground underline decoration-border underline-offset-4">
            Open the desk
          </Link>
        </header>
        <div className="mt-8 max-w-2xl">
          <h1 className="font-serif text-4xl leading-tight text-foreground sm:text-5xl">Read a claim against the record.</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Counterpoint keeps a claim next to a small set of sources: the title, the original link, the retrieved excerpt, and a
            label for whether that excerpt supports the claim, challenges it, or leaves it open. The investigation below is a sample
            you can edit without signing in.
          </p>
        </div>
        <div className="mt-10">
          <SampleDesk heading="h2" />
        </div>
      </div>
    </>
  )
}
