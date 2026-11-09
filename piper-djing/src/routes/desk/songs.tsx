import { createFileRoute } from '@tanstack/react-router'
import { Download } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  DeskTitle,
  deskCard,
  deskGhost,
  deskH2,
} from '../../components/desk-ui.tsx'
import { getSongInsights } from '../../lib/crm/desk.functions.ts'
import { longDate } from '../../lib/crm/dates.ts'
import { deskHead } from '../../lib/desk-head.ts'
import { songsCsv } from '../../lib/portal/song-insights.ts'
import type {
  SongCount,
  SongInsights,
  SongPick,
} from '../../lib/portal/song-insights.ts'

export const Route = createFileRoute('/desk/songs')({
  // Private page: its data loading rides in the same lazy chunk as its
  // screen, so the server calls it imports stay off the public pages.
  codeSplitGroupings: [['loader', 'component']],
  head: () => deskHead('Songs · DJ Piper P'),
  loader: () => getSongInsights(),
  component: SongsPage,
})

const TOP = 20

function SongsPage() {
  const data = Route.useLoaderData()
  const picked = data.picks.length
  return (
    <div className="grid gap-5">
      <DeskTitle kicker="Couples" title="Songs">
        Every song and music choice couples have made in their plans.
      </DeskTitle>
      <section className={`${deskCard} flex flex-wrap items-center justify-between gap-4`}>
        <div className="flex flex-wrap gap-6">
          <Stat value={picked} label={picked === 1 ? 'song picked' : 'songs picked'} />
          <Stat
            value={data.couplesWithMusic}
            label={`of ${data.couples} couples started their music`}
          />
          <Stat value={data.doNotPlay.length} label="on do-not-play lists" />
        </div>
        <button
          type="button"
          className={deskGhost}
          disabled={picked + data.doNotPlay.length === 0}
          onClick={() => download(data)}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Download spreadsheet
        </button>
      </section>

      {picked + data.doNotPlay.length === 0 ? (
        <section className={deskCard}>
          <p className="text-[#4a4262]">
            No songs yet. They show here as couples fill in their plans.
          </p>
        </section>
      ) : null}

      {data.top.length ? (
        <Section title="Most picked">
          <ol className="grid gap-2">
            {data.top.slice(0, TOP).map((row) => (
              <CountRow key={`${row.song}|${row.artist}`} row={row} />
            ))}
          </ol>
        </Section>
      ) : null}

      {data.moments.length ? (
        <Section title="By moment">
          <div className="grid gap-4 md:grid-cols-2">
            {data.moments.map((moment) => (
              <div key={moment.name} className="min-w-0">
                <h3 className="font-bold">{moment.name}</h3>
                <ul className="mt-2 grid gap-1.5">
                  {moment.picks.map((row, index) => (
                    <PickRow key={`${row.bookingId}-${index}`} row={row} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {data.topDoNotPlay.length ? (
        <Section title="Do not play">
          <ol className="grid gap-2">
            {data.topDoNotPlay.map((row) => (
              <CountRow key={`${row.song}|${row.artist}`} row={row} />
            ))}
          </ol>
        </Section>
      ) : null}

      {data.genres.length || data.guestRequests.length ? (
        <Section title="Genres and requests">
          <div className="flex flex-wrap gap-2">
            {data.genres.map((row) => (
              <span
                key={row.name}
                className="rounded-full border border-[#e2dbf5] bg-[#faf8fe] px-3 py-1 text-sm font-semibold"
              >
                {`${row.name ?? ''} · ${row.count ?? ''}`}
              </span>
            ))}
          </div>
          {data.guestRequests.length ? (
            <ul className="mt-4 grid gap-1 text-sm text-[#4a4262]">
              {data.guestRequests.map((row) => (
                <li key={row.choice}>
                  {`${row.choice ?? ''} · ${row.count ?? ''}`}
                </li>
              ))}
            </ul>
          ) : null}
        </Section>
      ) : null}

      {data.perCouple.some(hasMusic) ? (
        <Section title="Each couple">
          <div className="grid gap-4 md:grid-cols-2">
            {data.perCouple.filter(hasMusic).map((row) => (
              <article
                key={row.bookingId}
                className="min-w-0 rounded-[16px] border border-[#eee8f8] p-4"
              >
                <h3 className="font-bold">{row.couple}</h3>
                <p className="text-sm text-[#6b6385]">{longDate(row.eventDate)}</p>
                {row.genres.length ? (
                  <p className="mt-2 text-sm">{row.genres.join(' · ')}</p>
                ) : null}
                {row.vibe ? (
                  <p className="mt-2 text-sm whitespace-pre-line text-[#3b3352]">
                    {row.vibe}
                  </p>
                ) : null}
                {row.guestRequests ? (
                  <p className="mt-2 text-sm text-[#4a4262]">{`Guest requests: ${row.guestRequests ?? ''}`}
                  </p>
                ) : null}
                {row.dedications ? (
                  <p className="mt-2 text-sm whitespace-pre-line text-[#4a4262]">{`Dedications: ${row.dedications ?? ''}`}
                  </p>
                ) : null}
                {row.playlists.length ? (
                  <p className="mt-2 flex flex-wrap gap-x-3 text-sm">
                    {row.playlists.map((list) => (
                      <SafeLink key={list.name} href={list.link}>
                        {`${list.name ?? ''} playlist`}</SafeLink>
                    ))}
                  </p>
                ) : null}
                {row.specialPlaylists ? (
                  <p className="mt-2 text-sm whitespace-pre-line text-[#4a4262]">
                    {row.specialPlaylists}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  )
}

function hasMusic(row: SongInsights['perCouple'][number]): boolean {
  return Boolean(
    row.genres.length ||
      row.vibe ||
      row.guestRequests ||
      row.dedications ||
      row.playlists.length ||
      row.specialPlaylists,
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <p className="min-w-0">
      <span className="block font-display text-3xl font-extrabold">{value}</span>
      <span className="text-sm text-[#4a4262]">{label}</span>
    </p>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={deskCard}>
      <h2 className={deskH2}>{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function SongTitle({ song, artist, link }: { song: string; artist: string; link: string }) {
  const name = (
    <>
      <span className="font-semibold">{song}</span>
      {artist ? <span className="text-[#6b6385]">{` · ${artist ?? ''}`}</span> : null}
    </>
  )
  return link ? <SafeLink href={link}>{name}</SafeLink> : name
}

function CountRow({ row }: { row: SongCount }) {
  return (
    <li className="flex min-w-0 items-start gap-3">
      <span className="grid h-7 min-w-7 place-items-center rounded-full bg-[#ffe3f0] px-2 text-sm font-bold text-[#a3004f]">
        {row.count}
      </span>
      <span className="min-w-0">
        <SongTitle song={row.song} artist={row.artist} link={row.link} />
        <span className="block text-sm text-[#6b6385]">
          {`${row.couples.join(', ') ?? ''} · ${row.where.join(', ') ?? ''}`}
        </span>
      </span>
    </li>
  )
}

function PickRow({ row }: { row: SongPick }) {
  return (
    <li className="min-w-0 text-sm">
      <SongTitle song={row.song} artist={row.artist} link={row.link} />
      <span className="block text-[#6b6385]">
        {row.couple}
        {row.forWho ? ` · ${row.forWho}` : ''}
      </span>
    </li>
  )
}

/** Couples paste these links, so only web links open, in a new tab. */
function SafeLink({ href, children }: { href: string; children: ReactNode }) {
  if (!/^https?:\/\//i.test(href)) return <>{children}</>
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="text-[#d1006b] underline-offset-2 hover:underline"
    >
      {children}
    </a>
  )
}

function download(data: SongInsights) {
  // A byte-order mark so Excel reads accents (Beyoncé) correctly.
  const blob = new Blob(['﻿', songsCsv(data)], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `piper-couple-songs-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
