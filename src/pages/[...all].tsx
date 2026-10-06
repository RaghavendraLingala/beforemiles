import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { BrandMark } from '../components/BrandMark'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <BrandMark className="mb-8" />
      <Compass className="mb-3 size-10 text-muted-foreground" aria-hidden />
      <h1 className="mb-2 text-4xl font-bold text-foreground">404</h1>
      <p className="mb-6 max-w-sm text-muted-foreground">
        This page doesn&apos;t exist. It may have moved, or the link may be mistyped.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          to="/trips"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go to your trips
        </Link>
        <Link to="/" className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent">
          BeforeMiles home
        </Link>
      </div>
    </div>
  )
}
