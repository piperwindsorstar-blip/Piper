import type { ReactNode } from 'react'
import { entryName, momentKind, PARTY_OPTIONS } from '../../lib/crm/planning.ts'
import type { Planning, TimelineRow } from '../../lib/crm/planning.ts'
import { linkPlatform, songsOf } from '../../lib/portal/questions.ts'

export function PlanSheet({
  partnerOne,
  partnerTwo,
  eventDate,
  packageName,
  venueName,
  planning,
  percent,
  prepared,
  actions,
}: {
  partnerOne: string
  partnerTwo: string
  eventDate: string
  packageName: string
  venueName: string
  planning: Planning
  percent: number
  prepared: string
  actions?: ReactNode
}) {
  const venue = planning.venueName.trim() || venueName.trim()
  const guests = planning.guestCount.trim()
  const hidden = planning.timeline
    .filter((row) => row.hidden)
    .map((row) => row.label.trim() || row.activity)
  const phases = ['Ceremony', 'Cocktail time', 'Reception']
  return (
    <div className="plan-page px-4 py-8">
      {actions ? (
        <div className="no-print mx-auto mb-4 flex max-w-[820px] flex-wrap justify-end gap-2">
          {actions}
        </div>
      ) : null}
      <article className="plan-sheet mx-auto max-w-[820px] bg-white px-6 py-8 text-[#161616] shadow-sm min-[720px]:px-10 min-[720px]:py-10">
        <p className="text-[11px] font-bold tracking-[0.16em] text-[#C2185B] uppercase">
          DJ Piper P · Wedding plan
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="plan-display text-[32px] leading-[1.05] min-[720px]:text-[40px]">
              {partnerOne} & {partnerTwo}
            </h1>
            <p className="mt-2 text-sm text-[#3a3a40]">
              {planDate(eventDate)} · {venue || '—'} ·{' '}
              {guests ? `${guests} guests` : '— guests'}
            </p>
          </div>
          <p className="text-right text-sm text-[#3a3a40]">
            Prepared {preparedOn(prepared)}
            <span className="mt-1 block font-bold text-[#C2185B]">
              {percent}% complete
            </span>
          </p>
        </div>

        <Section title="Key details">
          <dl className="grid gap-x-8 gap-y-3 min-[720px]:grid-cols-2">
            <Pair label="Date" value={planDate(eventDate)} />
            <Pair label="Venue" value={venue} />
            <Pair label="Ceremony" value={planning.ceremonyAddress} />
            <Pair
              label="Reception"
              value={
                planning.receptionSame
                  ? 'Same as ceremony'
                  : planning.receptionAddress
              }
            />
            <Pair
              label="Email · Phone"
              value={joinPair(planning.email, planning.phone)}
            />
            <Pair label="Planner" value={planning.plannerEmail} />
            <Pair label="MC" value={planning.mc} />
            <Pair
              label="Told to find DJ at cocktail hour"
              value={toldLabel(planning.mcToldFindDj)}
            />
            <Pair
              label="Bridesmaids · Groomsmen"
              value={joinPair(planning.bridesmaids, planning.groomsmen)}
            />
            <Pair label="Last name to be taken" value={planning.lastName} />
            <Pair label="Guest count" value={planning.guestCount} />
            <Pair label="DJ arrival" value={planning.arrivalTime} />
            <Pair label="Package" value={packageName} />
          </dl>
        </Section>

        <Section title="DJ setup">
          <div className="flex flex-wrap gap-2">
            <Pill label="6 ft table" value={planning.tableForDj} />
            <Pill label="10' × 10' space" value={planning.spaceForDj} />
            <Pill label="Power" value={planning.power} />
            <Pill label="Outdoors" value={planning.outside} />
          </div>
          <p className="mt-3 text-sm">
            Uplights · {shown(planning.uplightColours)}
          </p>
        </Section>

        <Section title="Run of show">
          {phases.map((phase) => {
            const rows = planning.timeline.filter(
              (row) => row.section === phase && !row.hidden,
            )
            return (
              <div key={phase} className="plan-phase mt-5">
                <h3 className="plan-keep text-base font-bold">{phase}</h3>
                <table className="plan-table mt-2 w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="text-[11px] tracking-[0.12em] text-[#6b6b73] uppercase">
                      <th className="w-[18%] py-2 font-semibold">Time</th>
                      <th className="w-[32%] py-2 font-semibold">Moment</th>
                      <th className="w-[28%] py-2 font-semibold">
                        Song — Artist
                      </th>
                      <th className="py-2 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr className="plan-row border-t border-[#ececf0]">
                        <td className="py-2" colSpan={4}>
                          —
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => <MomentRow key={row.id} row={row} />)
                    )}
                  </tbody>
                </table>
                <div className="plan-cards mt-2 grid gap-3">
                  {rows.length === 0 ? (
                    <p>—</p>
                  ) : (
                    rows.map((row) => <MomentCard key={row.id} row={row} />)
                  )}
                </div>
              </div>
            )
          })}
          {hidden.length > 0 ? (
            <p className="mt-3 text-sm text-[#6b6b73]">
              Not part of our day: {hidden.join(', ')}
            </p>
          ) : null}
        </Section>

        <Section title="Music">
          <div className="flex flex-wrap gap-2">
            {planning.genreChips.length === 0 ? (
              <span className="text-sm">—</span>
            ) : (
              planning.genreChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-[#C2185B] px-3 py-1 text-sm text-[#C2185B]"
                >
                  {chip}
                </span>
              ))
            )}
          </div>
          <p className="mt-3 text-sm">Vibe: {shown(planning.genres)}</p>
          <p className="mt-1 text-sm text-[#C2185B]">
            Requests: {shown(planning.guestRequests)}
          </p>
          <div className="plan-lists mt-4 grid gap-6 min-[720px]:grid-cols-2">
            <SongColumn
              title="Must play"
              items={songsOf(planning.mustPlayItems, planning.mustPlay)}
            />
            <SongColumn
              title="Do not play"
              items={songsOf(planning.doNotPlayItems, planning.doNotPlay)}
            />
          </div>
          <p className="mt-4 text-sm">
            Playlists:{' '}
            <Playlist label="Pre-ceremony" href={planning.preCeremony} />
            {' · '}
            <Playlist label="Cocktail" href={planning.cocktail} />
            {' · '}
            <Playlist label="Dinner" href={planning.dinner} />
            {' · '}
            <Playlist label="Dance" href={planning.dance} />
          </p>
          {planning.specialPlaylists.trim() ? (
            <p className="mt-2 text-sm">{planning.specialPlaylists}</p>
          ) : null}
        </Section>

        <Section title="Notes">
          <p className="text-sm">{noteCopy(planning)}</p>
        </Section>

        <footer className="plan-screen-footer mt-10 flex justify-between border-t border-[#ececf0] pt-4 text-xs text-[#6b6b73]">
          <span>DJ Piper P · piperpweddingdj.services</span>
          <span>Page 1 of 1</span>
        </footer>
      </article>
      <p className="plan-print-footer hidden">
        DJ Piper P · piperpweddingdj.services
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[11px] font-bold tracking-[0.16em] text-[#C2185B] uppercase">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[#f0f0f3] pb-2">
      <dt className="text-xs text-[#6b6b73]">{label}</dt>
      <dd className="mt-0.5 text-sm">{shown(value)}</dd>
    </div>
  )
}

function Pill({ label, value }: { label: string; value: string }) {
  const tone = value === 'Yes' ? 'yes' : value === 'Not sure' ? 'unsure' : 'no'
  const text = value.trim() || '—'
  return (
    <span className={`plan-pill plan-pill-${tone}`}>
      {label} · {text}
    </span>
  )
}

type SheetLine = { text: string; choice: boolean }

/** What the DJ reads in the song column, whatever kind of moment it is. */
function momentLines(row: TimelineRow): SheetLine[] {
  const kind = momentKind(row.presetKey)
  if (kind === 'time') return []
  if (kind === 'playlist') {
    const platform = linkPlatform(row.link)
    if (platform) return [{ text: `${platform} playlist`, choice: false }]
    return [
      row.link.trim()
        ? { text: 'Playlist link', choice: false }
        : { text: "DJ's choice", choice: true },
    ]
  }
  if (kind === 'speakers') {
    const named = row.entries.filter((entry) => entry.name.trim())
    if (named.length === 0) return [{ text: '—', choice: false }]
    return named.map((entry) => ({
      text: entry.time.trim()
        ? `${entry.name.trim()} · ${entry.time.trim()}`
        : entry.name.trim(),
      choice: false,
    }))
  }
  if (kind === 'party' || kind === 'entrance-party') {
    if (row.entries.length === 0) return [{ text: "DJ's choice", choice: true }]
    const prefix =
      kind === 'entrance-party' && row.mode === 'pairs' ? 'Pairs' : ''
    return row.entries.map((entry, index) => {
      const fallback =
        PARTY_OPTIONS.find((option) => option.id === entry.id)?.name ??
        (entry.id.startsWith('pair-') ? `Pair ${index + 1}` : 'Added')
      const song = songText(entry.song, entry.artist, entry.link)
      return {
        text: `${prefix && index === 0 ? `${prefix}: ` : ''}${entryName(entry, fallback)} — ${song.text}`,
        choice: song.choice,
      }
    })
  }
  const song = songText(row.song, row.artist, row.link)
  if (kind === 'entrance-couple' && row.direct) {
    return [song, { text: 'Straight into the first dance', choice: false }]
  }
  return [song]
}

function MomentLines({ row }: { row: TimelineRow }) {
  const lines = momentLines(row)
  if (lines.length === 0) return <>—</>
  return (
    <>
      {lines.map((line, index) => (
        <span
          key={index}
          className={`block ${line.choice ? 'plan-choice' : ''}`}
        >
          {line.text}
        </span>
      ))}
    </>
  )
}

function MomentRow({ row }: { row: TimelineRow }) {
  return (
    <tr className="plan-row border-t border-[#ececf0]">
      <td className="py-2 font-bold text-[#C2185B]">{timeLabel(row.time)}</td>
      <td className="py-2">
        {row.label.trim() || row.activity}
        {row.presetKey === '' ? <Added /> : null}
      </td>
      <td className="py-2">
        <MomentLines row={row} />
      </td>
      <td className="py-2">{shown(row.notes)}</td>
    </tr>
  )
}

function MomentCard({ row }: { row: TimelineRow }) {
  return (
    <article className="plan-card rounded-xl border border-[#ececf0] p-3 text-sm">
      <p>
        <span className="font-bold text-[#C2185B]">{timeLabel(row.time)}</span>{' '}
        {row.label.trim() || row.activity}
        {row.presetKey === '' ? <Added /> : null}
      </p>
      <p className="mt-1">
        <MomentLines row={row} />
      </p>
      <p className="mt-1 text-[#3a3a40]">{shown(row.notes)}</p>
    </article>
  )
}

function SongColumn({
  title,
  items,
}: {
  title: string
  items: Array<{ song: string; artist: string; link: string }>
}) {
  const filled = items.filter((item) => item.song.trim() || item.artist.trim())
  return (
    <div>
      <h3 className="font-bold">{title}</h3>
      {filled.length === 0 ? (
        <p className="mt-2 text-sm">—</p>
      ) : (
        <ol className="mt-2 grid gap-1 text-sm">
          {filled.map((item, index) => (
            <li key={`${item.song}-${index}`}>
              {index + 1}. {songText(item.song, item.artist, item.link).text}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function Playlist({ label, href }: { label: string; href: string }) {
  const link = href.trim()
  if (!link) return <span>{label} —</span>
  const platform = linkPlatform(link)
  const safe = /^https?:\/\//i.test(link) ? link : ''
  const text = platform ? `${label} (${platform})` : label
  if (!safe) return <span>{text}</span>
  return (
    <a href={safe} className="text-[#C2185B] underline">
      {text}
    </a>
  )
}

function Added() {
  return (
    <span className="ml-2 text-[10px] font-bold tracking-[0.08em] text-[#C2185B] uppercase">
      Added
    </span>
  )
}

function toldLabel(value: string): string {
  if (value === 'Yes' || value === 'No') return value
  if (value === 'Yes, they know') return 'Yes'
  if (value === "Not yet, I'll tell them") return 'Not yet'
  return ''
}

function joinPair(left: string, right: string): string {
  return `${shown(left)} · ${shown(right)}`
}

function shown(value: string): string {
  const next = value.trim()
  return next || '—'
}

function timeLabel(value: string): string {
  const next = value.trim()
  if (!next) return '—'
  if (next.startsWith('[')) return next
  return `[${next}]`
}

function songText(
  song: string,
  artist: string,
  link: string,
): { text: string; choice: boolean } {
  const title = song.trim()
  const name = artist.trim()
  if (title && name) return { text: `${title} — ${name}`, choice: false }
  if (title || name) return { text: title || name, choice: false }
  const platform = linkPlatform(link)
  if (platform) return { text: platform, choice: false }
  if (link.trim()) return { text: 'Link', choice: false }
  return { text: "DJ's choice", choice: true }
}

function noteCopy(planning: Planning): string {
  const parts = [planning.requests.trim(), planning.dedications.trim()].filter(
    Boolean,
  )
  if (parts.length === 0) return '—'
  return parts.join(' ')
}

function planDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return '—'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function preparedOn(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return '—'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}
