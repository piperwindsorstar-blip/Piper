import { useServerFn } from '@tanstack/react-start'
import { useEffect, useRef, useState } from 'react'
import { linkPlatform } from '../../lib/portal/questions.ts'
import { searchSongs, suggestSongs } from '../../lib/portal/portal.functions.ts'
import { isSongLink } from '../../lib/portal/song-search.ts'
import { suggestionHeading } from '../../lib/portal/song-suggestions.ts'
import type { SongHit } from '../../lib/portal/song-search.ts'

export function CouplePicks({
  slug,
  presetKey,
  disabled,
  onPick,
}: {
  slug: string
  presetKey: string
  disabled: boolean
  onPick: (hit: SongHit) => void
}) {
  const heading = suggestionHeading(presetKey)
  const load = useServerFn(suggestSongs)
  const loadRef = useRef(load)
  loadRef.current = load
  const [hits, setHits] = useState<SongHit[]>([])

  useEffect(() => {
    if (!heading) {
      setHits([])
      return
    }
    let live = true
    void loadRef.current({ data: { slug, presetKey } }).then((rows) => {
      if (live) setHits(rows)
    })
    return () => {
      live = false
    }
  }, [heading, presetKey, slug])

  if (!heading || hits.length === 0) return null
  return (
    <div className="mt-4">
      <p className="text-sm text-[var(--text-muted)]">{heading}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {hits.map((hit) => (
          <button
            key={`${hit.title}-${hit.artist}`}
            type="button"
            className="min-h-11 rounded-full border border-[var(--border-strong)] px-4 text-left text-sm"
            disabled={disabled}
            onClick={() => onPick(hit)}
          >
            <span className="font-bold">{hit.title}</span>
            {hit.artist ? (
              <span className="text-[var(--pink-soft)]">{` · ${hit.artist ?? ''}`}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SongSearch({
  disabled,
  label,
  onLink,
  onPick,
}: {
  disabled: boolean
  label: string
  onLink: (link: string) => void
  onPick: (hit: SongHit) => void
}) {
  const search = useServerFn(searchSongs)
  const searchRef = useRef(search)
  searchRef.current = search
  const request = useRef(0)
  const [draft, setDraft] = useState('')
  const [hits, setHits] = useState<SongHit[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'empty'>('idle')

  useEffect(() => {
    const query = draft.trim()
    if (disabled || query.length < 2 || isSongLink(query)) {
      setHits([])
      setStatus('idle')
      return
    }
    const id = request.current + 1
    request.current = id
    setStatus('loading')
    let live = true
    const timer = window.setTimeout(() => {
      void searchRef.current({ data: { query } }).then((rows) => {
        if (!live || request.current !== id) return
        setHits(rows)
        setStatus(rows.length === 0 ? 'empty' : 'idle')
      })
    }, 350)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [disabled, draft])

  return (
    <div className="min-w-0">
      <label className="block">
        <span className="sr-only">{label}</span>
        <input
          className="portal-input"
          placeholder="Search a song or paste a link"
          value={draft}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value
            setDraft(next)
            if (isSongLink(next)) onLink(next.trim())
          }}
        />
      </label>
      {status === 'loading' ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">Searching…</p>
      ) : null}
      {status === 'empty' ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Nothing came up for that. Type the song and artist below, or paste a
          link.
        </p>
      ) : null}
      {hits.length > 0 ? (
        <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-2">
          {hits.map((hit, index) => (
            <li key={`${hit.link}-${index}`}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[18px] border border-[var(--border-strong)] bg-[var(--field)] px-4 py-3 text-left"
                onClick={() => {
                  onPick(hit)
                  setDraft('')
                  setHits([])
                  setStatus('idle')
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{hit.title}</span>
                  <span className="block truncate text-sm text-[var(--pink-soft)]">
                    {hit.artist}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-[var(--text-muted)]">
                  Use this
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function Platform({ value }: { value: string }) {
  const name = linkPlatform(value)
  if (!value.trim()) return null
  return (
    <p className="mt-2 text-sm text-[var(--pink-soft)]">
      {name || 'Paste a Spotify, YouTube, Apple Music, or SoundCloud link.'}
    </p>
  )
}

export function MusicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 18a3 3 0 1 1-2-2.83V6.5l10-2v9.67A3 3 0 1 1 15 16.5V8.2l-6 1.2V18Z"
        fill="currentColor"
      />
    </svg>
  )
}
