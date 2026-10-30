import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'
import { ActionButton } from './action-button.tsx'
import type { RunResult } from './action-button.tsx'
import { deskCard, deskPrimary } from './desk-ui.tsx'
import {
  findGooglePlace,
  getGoogleReviewSettings,
  refreshGoogle,
  saveReviewDisplay,
} from '../lib/crm/desk.functions.ts'
import { REVIEW_DISPLAY_LABELS } from '../lib/crm/google-reviews.ts'
import type {
  PlaceCandidate,
  ReviewDisplay,
  ReviewPage,
} from '../lib/crm/google-reviews.ts'

type Settings = Awaited<ReturnType<typeof getGoogleReviewSettings>>

const PAGES: [ReviewPage, string][] = [
  ['home', 'Home page'],
  ['weddings', 'Weddings page'],
]

function when(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

/**
 * The desk's Google reviews panel: whether the live reviews are coming
 * through, which reviews each page shows, a refresh, and a helper to find
 * the Place ID to put in the Worker's GOOGLE_PLACE_ID secret.
 */
export function DeskGoogleReviews() {
  const load = useServerFn(getGoogleReviewSettings)
  const save = useServerFn(saveReviewDisplay)
  const refresh = useServerFn(refreshGoogle)
  const find = useServerFn(findGooglePlace)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('DJ Piper P Brantford Ontario')
  const [places, setPlaces] = useState<PlaceCandidate[]>([])

  useEffect(() => {
    void load()
      .then(setSettings)
      .catch(() => setLoadError('The Google reviews settings did not load.'))
  }, [load])

  const status = settings?.status
  return (
    <section className={`${deskCard} grid gap-4`}>
      <h2 className="font-display text-xl font-bold">Google reviews</h2>
      {loadError ? <p className="text-sm text-rose-400">{loadError}</p> : null}
      {!settings ? (
        <p className="text-sm text-white/60">Checking Google…</p>
      ) : (
        <>
          <div className="text-sm">
            {status?.ok ? (
              <p className="text-emerald-400">
                {`Live: ${status.rating.toFixed(1)} ★ from ${status.count} Google reviews; ${status.shown} shown on the site. Last checked ${when(status.fetchedAt)}. `}
                {status.mapsUri ? (
                  <a
                    href={status.mapsUri}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Open on Google
                  </a>
                ) : null}
              </p>
            ) : (
              <p className="text-amber-300">{`Not showing on the site: ${status?.error || 'no reviews yet.'}`}
              </p>
            )}
            <p className="mt-1 text-white/50">
              Kept for a day so the site stays inside Google&apos;s free use.
              The API key stays on the Worker and never reaches a browser.
            </p>
          </div>
          <ActionButton
            className={`${deskPrimary} w-fit`}
            busy="Checking…"
            done="Checked"
            onRun={async (): Promise<RunResult> => {
              const next = await refresh()
              setSettings((current) =>
                current ? { ...current, status: next } : current,
              )
              return {
                ok: next.ok,
                message: next.ok
                  ? `${next.count} reviews, ${next.rating.toFixed(1)} ★.`
                  : next.error,
              }
            }}
          >
            Refresh from Google now
          </ActionButton>
          <fieldset className="grid gap-2">
            <legend className="text-sm text-white/65">
              Which reviews each page shows
            </legend>
            {PAGES.map(([page, label]) => (
              <label
                key={page}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                {label}
                <select
                  className="min-h-11 rounded-xl border border-white/15 bg-white/5 px-3 text-white"
                  value={settings.display[page]}
                  onChange={(event) => {
                    const mode = event.target.value as ReviewDisplay
                    setSettings({
                      ...settings,
                      display: { ...settings.display, [page]: mode },
                    })
                    void save({ data: { page, mode } })
                  }}
                >
                  {(Object.keys(REVIEW_DISPLAY_LABELS) as ReviewDisplay[]).map(
                    (mode) => (
                      <option key={mode} value={mode} className="text-black">
                        {REVIEW_DISPLAY_LABELS[mode]}
                      </option>
                    ),
                  )}
                </select>
              </label>
            ))}
            <p className="text-xs text-white/50">
              With &quot;Google reviews&quot; or &quot;Both&quot;, the Google
              section hides itself whenever Google has nothing to show.
            </p>
          </fieldset>
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-2 text-white/70">
              Find the Place ID
            </summary>
            <form
              className="mt-2 grid gap-2"
              onSubmit={(event) => event.preventDefault()}
            >
              <input
                className="min-h-11 rounded-xl border border-white/15 bg-white/5 px-3 text-white"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Business name and town"
              />
              <ActionButton
                className={`${deskPrimary} w-fit`}
                busy="Searching…"
                done="Found"
                onRun={async (): Promise<RunResult> => {
                  const result = await find({ data: { query } })
                  if (!result.ok) return { ok: false, message: result.error }
                  setPlaces(result.places)
                  return {
                    ok: true,
                    message: `${result.places.length} match${result.places.length === 1 ? '' : 'es'}.`,
                  }
                }}
              >
                Search Google
              </ActionButton>
              <ul className="grid gap-2">
                {places.map((place) => (
                  <li
                    key={place.id}
                    className="rounded-xl border border-white/10 p-3"
                  >
                    <p className="font-semibold">{place.name}</p>
                    <p className="text-white/60">{place.address}</p>
                    <p className="text-white/60">
                      {place.rating ? `${place.rating} ★ · ` : ''}
                      {`${place.count ?? ''} reviews`}</p>
                    <code className="mt-1 block break-all text-xs text-white/80">
                      {place.id}
                    </code>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-white/50">
                Copy the ID of your listing into the Worker secret
                GOOGLE_PLACE_ID, then press Refresh.
              </p>
            </form>
          </details>
        </>
      )}
    </section>
  )
}
