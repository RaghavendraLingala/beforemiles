/**
 * Settings — account, trip defaults, report style, privacy explainer, and app info.
 * Trip defaults and report style are saved to the user's own `user_preferences`
 * row (readable only by them) via the `saveUserPreferences` action.
 */

import { useState, type FormEvent, type ReactNode } from 'react'
import { signOut, useUser } from 'deepspace'
import { ExternalLink, Lock, LogOut } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage, Button, Input, Label, useToast } from '@/components/ui'
import { callAction } from '@/lib/actions'
import { useUserPreferences } from '@/lib/use-user-preferences'
import { cn } from '@/lib/utils'
import { TRAVEL_MODES, TRIP_PREFERENCES } from '../../../schemas/trips-schema'
import { AI_STYLES, type AiStyle, type UserPreferences } from '../../../schemas/user-preferences-schema'

const LIVE_URL = 'https://beforemiles.app.space'

export default function SettingsPage() {
  return (
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-muted-foreground">Your account, trip defaults, and how BeforeMiles handles your data.</p>
        </header>
        <AccountSection />
        <PreferencesSection />
        <PrivacySection />
        <AboutSection />
      </div>
    </div>
  )
}

function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function AccountSection() {
  const { user } = useUser()
  return (
    <Card title="Account">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarImage src={user?.imageUrl ?? undefined} referrerPolicy="no-referrer" />
            <AvatarFallback>{(user?.name?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium" data-testid="settings-name">{user?.name || 'Signed in'}</p>
            <p className="text-sm text-muted-foreground">{user?.email ?? '—'}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => signOut()}>
          <LogOut /> Sign out
        </Button>
      </div>
    </Card>
  )
}

const pill =
  'cursor-pointer rounded-full border border-border px-3 py-1.5 text-sm capitalize transition-colors hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:text-accent-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50'

const AI_STYLE_HELP: Record<AiStyle, string> = {
  concise: 'Short, scannable bullets.',
  detailed: 'Fuller explanations with a reason behind each suggestion.',
  'safety-focused': 'Safety and emergency preparedness first, with what to verify.',
}

function PreferencesSection() {
  const { loading, saved, prefs } = useUserPreferences()
  if (loading) {
    return (
      <Card title="Trip defaults & report style">
        <p className="text-sm text-muted-foreground">Loading your preferences…</p>
      </Card>
    )
  }
  // Remount when the saved row first arrives so the form starts from it.
  return <PreferencesForm key={saved ? 'saved' : 'defaults'} initial={prefs} />
}

function PreferencesForm({ initial }: { initial: Omit<UserPreferences, 'userId'> }) {
  const { success, error } = useToast()
  const [mode, setMode] = useState<string>(initial.defaultTravelMode)
  const [travelers, setTravelers] = useState(String(initial.defaultTravelers))
  const [preferences, setPreferences] = useState<string[]>([...initial.defaultPreferences])
  const [aiStyle, setAiStyle] = useState<AiStyle>(initial.aiStyle)
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const result = await callAction('saveUserPreferences', {
      defaultTravelMode: mode,
      defaultTravelers: Number(travelers),
      defaultPreferences: preferences,
      aiStyle,
    })
    setSaving(false)
    if (result.success) success('Preferences saved')
    else error('Could not save preferences', result.error)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card title="Trip defaults" description="Prefill every New trip form. You can still change anything per trip, and templates override these.">
        <div className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Default travel mode</legend>
            <div className="flex flex-wrap gap-2">
              {TRAVEL_MODES.map((m) => (
                <label key={m} className={pill}>
                  <input type="radio" name="defaultTravelMode" value={m} checked={mode === m}
                    onChange={() => setMode(m)} className="sr-only" />
                  {m === 'ev' ? 'EV' : m}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="max-w-40 space-y-2">
            <Label htmlFor="default-travelers">Default travelers</Label>
            <Input id="default-travelers" type="number" min={1} max={50} required value={travelers}
              onChange={(e) => setTravelers(e.target.value)} />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Default preferences</legend>
            <div className="flex flex-wrap gap-2">
              {TRIP_PREFERENCES.map((p) => (
                <label key={p} className={pill}>
                  <input type="checkbox" className="sr-only" checked={preferences.includes(p)}
                    onChange={() => setPreferences((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))} />
                  {p}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Card>

      <Card
        title="Report style"
        description="How the AI-generated Readiness Reports and “What am I missing?” reviews you create are written. Other members’ runs use their own setting."
      >
        <fieldset className="grid gap-3 sm:grid-cols-3">
          <legend className="sr-only">Report style</legend>
          {AI_STYLES.map((s) => (
            <label
              key={s}
              className={cn(
                'cursor-pointer rounded-lg border p-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50',
                aiStyle === s ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50',
              )}
            >
              <input type="radio" name="aiStyle" value={s} checked={aiStyle === s} onChange={() => setAiStyle(s)} className="sr-only" />
              <span className="block font-medium capitalize">{s}</span>
              <span className="text-muted-foreground">{AI_STYLE_HELP[s]}</span>
            </label>
          ))}
        </fieldset>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <p className="text-xs text-muted-foreground">Saved to your account — private to you, on every device.</p>
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save preferences'}</Button>
      </div>
    </form>
  )
}

function PrivacySection() {
  const points = [
    ['Trips are private by default.', 'Only you can see a trip you create until you share it.'],
    ['Owners choose who joins.', 'Share by email as an editor (can plan and change things) or a viewer (read-only).'],
    ['Roles are enforced on the server.', 'Viewers can’t edit even by calling the app directly.'],
    ['Documents stay private to the trip.', 'Only the trip’s members can open them — nothing is ever made public.'],
    ['AI is planning guidance.', 'Reports and reviews use general knowledge, not live weather, traffic, or emergency data.'],
  ] as const
  const controls = [
    'Owners can delete a trip (Overview → Danger zone) — it’s removed for every member, with its documents. If a file can’t be removed, nothing else is deleted and you can try again.',
    'Owners can remove members; removed members lose access right away.',
    'Owners and editors can delete documents and checklist items the group added.',
    'Deletes are permanent — there’s no undo. Account deletion isn’t available in the app.',
  ]
  return (
    <Card title="Privacy & sharing">
      <ul className="space-y-3 text-sm">
        {points.map(([title, body]) => (
          <li key={title} className="flex gap-2">
            <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              <span className="font-medium">{title}</span> <span className="text-muted-foreground">{body}</span>
            </span>
          </li>
        ))}
      </ul>
      <h3 className="mt-5 text-sm font-semibold">Data controls</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {controls.map((c) => <li key={c}>{c}</li>)}
      </ul>
    </Card>
  )
}

function AboutSection() {
  return (
    <Card title="About BeforeMiles">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">App</dt>
          <dd>BeforeMiles — Your trip, prepared. Keep your trip plans, checklists, and documents together, and prepare with your travel companions.</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Live app</dt>
          <dd>
            <a href={LIVE_URL} className="inline-flex items-center gap-1 text-primary hover:underline">
              beforemiles.app.space <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </dd>
        </div>
      </dl>
      <div className="mt-4 rounded-lg bg-secondary p-4 text-sm">
        <p className="font-medium">Not included yet</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
          <li>Live weather, maps, and verified place data — BeforeMiles helps you prepare; it isn’t navigation.</li>
          <li>Account deletion, bulk delete, and undo.</li>
          <li>Editing a trip’s details after it’s created, and deleting individual AI-suggested checklist items.</li>
          <li>Email invitations — people need to sign in once before they can be added.</li>
          <li>Export and sharing links outside the app.</li>
          <li>Payments.</li>
        </ul>
      </div>
    </Card>
  )
}
