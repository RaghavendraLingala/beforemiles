import { Route } from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_NAME } from '../constants'

/** Logo + name. Hook-free, so the static landing page can use it too. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold text-foreground', className)}>
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Route className="size-4" aria-hidden />
      </span>
      {APP_NAME}
    </span>
  )
}
