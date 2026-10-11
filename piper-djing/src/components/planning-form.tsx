import { useState } from 'react'
import { PLANNING_CHOICES } from '../lib/crm/planning.ts'
import type {
  AppearanceRow,
  Planning,
  TimelineRow,
} from '../lib/crm/planning.ts'

const SHEET_APPEARANCE_ROWS = 12

type TextKey = {
  [K in keyof Planning]: Planning[K] extends string ? K : never
}[keyof Planning]

type SheetCell =
  | { kind: 'label'; text: string; tone?: string }
  | { kind: 'text'; key: TextKey; long?: boolean; placeholder?: string }
  | { kind: 'choice'; key: TextKey }
  | { kind: 'blank' }

const DETAIL_ROWS: SheetCell[][] = [
  [
    { kind: 'label', text: 'Date of Wedding', tone: '#9FC5E8' },
    { kind: 'text', key: 'weddingDate' },
    { kind: 'label', text: 'How many Bridesmaids?' },
    { kind: 'text', key: 'bridesmaids' },
    { kind: 'label', text: 'Favourite Genres/Artists' },
    { kind: 'text', key: 'genres', long: true },
  ],
  [
    { kind: 'label', text: 'Wedding Ceremony Address', tone: '#F6F8F9' },
    { kind: 'text', key: 'ceremonyAddress', long: true },
    { kind: 'label', text: 'How many Groomsmen?', tone: '#F6F8F9' },
    { kind: 'text', key: 'groomsmen' },
    { kind: 'label', text: 'Dedications (If Needed)', tone: '#F6F8F9' },
    { kind: 'text', key: 'dedications', long: true },
  ],
  [
    { kind: 'label', text: 'Wedding Reception Address' },
    {
      kind: 'text',
      key: 'receptionAddress',
      long: true,
      placeholder: 'If Different From Ceremony',
    },
    { kind: 'label', text: 'Venue Phone Number' },
    { kind: 'text', key: 'venuePhone' },
    { kind: 'label', text: 'Mood/Vibe Preference' },
    { kind: 'text', key: 'mood', long: true },
  ],
  [
    { kind: 'label', text: 'Venue Name', tone: '#F6F8F9' },
    { kind: 'text', key: 'venueName' },
    { kind: 'label', text: 'Planner/Coordinator Email', tone: '#F6F8F9' },
    { kind: 'text', key: 'plannerEmail' },
    { kind: 'label', text: 'Guest Request Policy', tone: '#F6F8F9' },
    { kind: 'text', key: 'guestRequests', long: true },
  ],
  [
    { kind: 'label', text: "Couple's Names" },
    { kind: 'text', key: 'coupleNames' },
    { kind: 'label', text: 'Reserved a 6ft Table for DJ?' },
    { kind: 'choice', key: 'tableForDj' },
    { kind: 'blank' },
    { kind: 'blank' },
  ],
  [
    { kind: 'label', text: 'Last Name to be Taken', tone: '#EAD1DC' },
    { kind: 'text', key: 'lastName' },
    {
      kind: 'label',
      text: "Reserved a 10'x10' Space for DJ?",
      tone: '#F6F8F9',
    },
    { kind: 'choice', key: 'spaceForDj' },
    { kind: 'label', text: 'Must Play List', tone: '#93C47D' },
    { kind: 'text', key: 'mustPlay', long: true },
  ],
  [
    { kind: 'label', text: 'Email' },
    { kind: 'text', key: 'email' },
    { kind: 'label', text: 'Any portion of day outside?' },
    { kind: 'choice', key: 'outside' },
    { kind: 'label', text: 'Do Not Play List', tone: '#E06666' },
    { kind: 'text', key: 'doNotPlay', long: true },
  ],
  [
    { kind: 'label', text: 'Phone Number', tone: '#F6F8F9' },
    { kind: 'text', key: 'phone' },
    { kind: 'label', text: 'Does each space have power?', tone: '#F6F8F9' },
    { kind: 'choice', key: 'power' },
    { kind: 'label', text: 'Pre-Ceremony Playlist', tone: '#FF00FF' },
    { kind: 'text', key: 'preCeremony', long: true },
  ],
  [
    { kind: 'blank' },
    { kind: 'blank' },
    { kind: 'label', text: 'Who is your MC?' },
    { kind: 'text', key: 'mc' },
    { kind: 'label', text: 'Cocktail Playlist', tone: '#4A86E8' },
    { kind: 'text', key: 'cocktail', long: true },
  ],
  [
    { kind: 'label', text: 'Specific Requests/Notes', tone: '#F6F8F9' },
    { kind: 'text', key: 'requests', long: true },
    {
      kind: 'label',
      text: 'Uplight Colour(s)? (If Applicable)',
      tone: '#FFE599',
    },
    { kind: 'text', key: 'uplightColours' },
    { kind: 'label', text: 'Dinner Playlist', tone: '#34A853' },
    { kind: 'text', key: 'dinner', long: true },
  ],
  [
    { kind: 'label', text: 'Guest Count' },
    { kind: 'text', key: 'guestCount' },
    {
      kind: 'label',
      text: 'Photobooth Hours (If Applicable)',
      tone: '#F6B26B',
    },
    { kind: 'text', key: 'photobooth' },
    { kind: 'label', text: 'Dance Playlist', tone: '#00FF00' },
    { kind: 'text', key: 'dance', long: true },
  ],
]

const entry =
  'min-h-11 w-full bg-transparent px-2 py-1.5 text-sm text-[#202124] outline-none placeholder:text-[#434343] focus-visible:bg-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#1a73e8]'

export function PlanningForm({
  initial,
  saved,
  onSave,
}: {
  initial: Planning
  saved: boolean
  onSave: (
    planning: Planning,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
}) {
  const [planning, setPlanning] = useState(() => ({
    ...initial,
    appearances: padAppearances(initial.appearances),
  }))
  const [notice, setNotice] = useState<string | null>(
    saved ? 'Saved on your page.' : null,
  )
  const [pending, setPending] = useState(false)

  function set<TKey extends keyof Planning>(key: TKey, value: Planning[TKey]) {
    setPlanning((current) => ({ ...current, [key]: value }))
  }

  function setAppearance(index: number, patch: Partial<AppearanceRow>) {
    setPlanning((current) => ({
      ...current,
      appearances: current.appearances.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    }))
  }

  function setTimeline(index: number, patch: Partial<TimelineRow>) {
    setPlanning((current) => ({
      ...current,
      timeline: current.timeline.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    }))
  }

  return (
    <form
      className="mt-10 font-[Arial,Roboto,sans-serif] text-[#202124]"
      onSubmit={(event) => {
        event.preventDefault()
        setPending(true)
        void onSave(planning).then((result) => {
          setPending(false)
          setNotice(result.ok ? 'Saved.' : result.error)
        })
      }}
    >
      <p className="text-sm text-[#434343]">
        This copy is only for your wedding. Fill in what you know. You can come
        back and change it.
      </p>
      <div className="mt-4 overflow-x-auto bg-white shadow-sm ring-1 ring-[#dadce0]">
        <div className="min-w-[60rem]">
          <table className="w-[38%] min-w-[28rem] border-collapse">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[34%]" />
              <col className="w-[38%]" />
            </colgroup>
            <thead>
              <tr>
                <th className={head(true)}>Name</th>
                <th className={head(false)}>Email</th>
                <th className={head(false)}>Arrival Time to Venue</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={box}>
                  <input
                    aria-label="Name"
                    className={entry}
                    value={planning.coupleNames}
                    onChange={(event) => set('coupleNames', event.target.value)}
                  />
                </td>
                <td className={box}>
                  <input
                    aria-label="Email"
                    className={entry}
                    value={planning.email}
                    onChange={(event) => set('email', event.target.value)}
                  />
                </td>
                <td className={box}>
                  <input
                    aria-label="Arrival Time to Venue"
                    className={entry}
                    value={planning.arrivalTime}
                    onChange={(event) => set('arrivalTime', event.target.value)}
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <table className="mt-6 w-full border-collapse">
            <colgroup>
              <col className="w-[11%]" />
              <col className="w-[13%]" />
              <col className="w-[14.5%]" />
              <col className="w-[16.5%]" />
              <col className="w-[13%]" />
              <col className="w-[32%]" />
            </colgroup>
            <thead>
              <tr>
                <th className={head(true)}>Details</th>
                <th className={head(false)}>Information to Fill In</th>
                <th className={head(true)}>Details+</th>
                <th className={head(false)}>Information</th>
                <th className={head(true)}>Music Preferences</th>
                <th className={head(false)}>
                  Playlists, Links, Songs, Artists
                </th>
              </tr>
            </thead>
            <tbody>
              {DETAIL_ROWS.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, cellIndex) => (
                    <SheetCellView
                      key={cellIndex}
                      cell={cell}
                      planning={planning}
                      onText={(key, value) => set(key, value)}
                    />
                  ))}
                </tr>
              ))}
              <tr>
                <th className={`${labelCell} bg-white`}>Special Playlists</th>
                <td className={box} colSpan={5}>
                  <textarea
                    aria-label="Special Playlists"
                    rows={2}
                    className={entry}
                    value={planning.specialPlaylists}
                    onChange={(event) =>
                      set('specialPlaylists', event.target.value)
                    }
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <table className="mt-6 w-full border-collapse">
            <colgroup>
              <col className="w-[16%]" />
              <col className="w-[18%]" />
              <col className="w-[22%]" />
              <col className="w-[14%]" />
              <col className="w-[30%]" />
            </colgroup>
            <thead>
              <tr>
                <th className={head(false)}>Order of Appearance</th>
                <th className={head(false)}>Names or Group of People</th>
                <th className={head(false)}>
                  People Giving Speech or People Dancing
                </th>
                <th className={head(false)}>When is it Happening</th>
                <th className={`${head(false)} bg-[#6FA8DC] text-center`}>
                  Additonal Notes (MC Instructions, Games, Special Happenings,
                  Announcements)
                </th>
              </tr>
            </thead>
            <tbody>
              {planning.appearances.map((row, index) => (
                <tr key={index}>
                  <td
                    className={`${box} px-2 text-center text-sm text-[#434343]`}
                  >
                    {index + 1}
                  </td>
                  <td className={box}>
                    <input
                      aria-label={`Names or group ${index + 1}`}
                      className={entry}
                      value={row.names}
                      onChange={(event) =>
                        setAppearance(index, { names: event.target.value })
                      }
                    />
                  </td>
                  <td className={box}>
                    <input
                      aria-label={`Speech or dance ${index + 1}`}
                      className={entry}
                      value={row.people}
                      onChange={(event) =>
                        setAppearance(index, { people: event.target.value })
                      }
                    />
                  </td>
                  <td className={box}>
                    <input
                      aria-label={`When ${index + 1}`}
                      className={entry}
                      value={row.when}
                      onChange={(event) =>
                        setAppearance(index, { when: event.target.value })
                      }
                    />
                  </td>
                  <td className={box}>
                    <textarea
                      aria-label={`Notes ${index + 1}`}
                      rows={2}
                      className={entry}
                      value={row.notes}
                      onChange={(event) =>
                        setAppearance(index, { notes: event.target.value })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {planning.appearances.length < 24 ? (
            <button
              type="button"
              className="min-h-11 px-3 text-sm text-[#1a73e8]"
              onClick={() =>
                set('appearances', [
                  ...planning.appearances,
                  { names: '', people: '', when: '', notes: '' },
                ])
              }
            >
              Add a row
            </button>
          ) : null}

          <table className="mt-4 w-full border-collapse">
            <colgroup>
              <col className="w-[11%]" />
              <col className="w-[13%]" />
              <col className="w-[18%]" />
              <col className="w-[16%]" />
              <col className="w-[14%]" />
              <col className="w-[28%]" />
            </colgroup>
            <thead>
              <tr>
                <th className={head(true)}>Time</th>
                <th className={head(true)}>Section</th>
                <th className={head(true)}>Activity</th>
                <th className={head(true)}>Song Title</th>
                <th className={head(true)}>Artist</th>
                <th className={head(false)}>
                  Notes/Link to Song (Youtube, Spotify, Soundcloud)
                </th>
              </tr>
            </thead>
            <tbody>
              {planning.timeline.map((row, index) => (
                <tr key={index}>
                  <td className={box}>
                    <input
                      aria-label={`Time for ${row.activity}`}
                      className={entry}
                      value={row.time}
                      onChange={(event) =>
                        setTimeline(index, { time: event.target.value })
                      }
                    />
                  </td>
                  <td
                    className={`border border-[#bdc1c6] px-2 text-center text-xs font-semibold ${sectionTone(row.section)}`}
                  >
                    {row.section}
                  </td>
                  <td
                    className={`border border-[#bdc1c6] px-2 text-sm text-[#434343] ${index % 2 === 0 ? 'bg-white' : 'bg-[#F6F8F9]'}`}
                  >
                    {row.activity}
                  </td>
                  <td className={box}>
                    <input
                      aria-label={`Song for ${row.activity}`}
                      className={entry}
                      value={row.song}
                      onChange={(event) =>
                        setTimeline(index, { song: event.target.value })
                      }
                    />
                  </td>
                  <td className={box}>
                    <input
                      aria-label={`Artist for ${row.activity}`}
                      className={entry}
                      value={row.artist}
                      onChange={(event) =>
                        setTimeline(index, { artist: event.target.value })
                      }
                    />
                  </td>
                  <td className={box}>
                    <textarea
                      aria-label={`Notes for ${row.activity}`}
                      rows={2}
                      className={entry}
                      value={row.notes}
                      onChange={(event) =>
                        setTimeline(index, { notes: event.target.value })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6">
        <button
          type="submit"
          className="min-h-11 rounded-full bg-ink px-5 text-sm text-ivory"
          disabled={pending}
        >
          {pending ? 'Saving…' : 'Save planning form'}
        </button>
        {notice ? <p className="mt-3 text-sm">{notice}</p> : null}
      </div>
    </form>
  )
}

function SheetCellView({
  cell,
  planning,
  onText,
}: {
  cell: SheetCell
  planning: Planning
  onText: (key: TextKey, value: string) => void
}) {
  if (cell.kind === 'blank') return <td className={box} />
  if (cell.kind === 'label') {
    return (
      <th className={labelCell} style={{ background: cell.tone ?? '#ffffff' }}>
        {cell.text}
      </th>
    )
  }
  if (cell.kind === 'choice') {
    return (
      <td className={box}>
        <select
          aria-label={choiceLabel(cell.key)}
          className={entry}
          value={planning[cell.key]}
          onChange={(event) => onText(cell.key, event.target.value)}
        >
          <option value="">Choose</option>
          {PLANNING_CHOICES.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      </td>
    )
  }
  const value = planning[cell.key]
  return (
    <td className={box}>
      {cell.long ? (
        <textarea
          aria-label={choiceLabel(cell.key)}
          rows={2}
          className={entry}
          placeholder={cell.placeholder}
          value={value}
          onChange={(event) => onText(cell.key, event.target.value)}
        />
      ) : (
        <input
          aria-label={choiceLabel(cell.key)}
          className={entry}
          placeholder={cell.placeholder}
          value={value}
          onChange={(event) => onText(cell.key, event.target.value)}
        />
      )}
    </td>
  )
}

function choiceLabel(key: TextKey): string {
  const labels: Record<TextKey, string> = {
    coupleNames: "Couple's Names",
    email: 'Email',
    phone: 'Phone Number',
    weddingDate: 'Date of Wedding',
    venueName: 'Venue Name',
    arrivalTime: 'Arrival Time to Venue',
    ceremonyAddress: 'Wedding Ceremony Address',
    receptionAddress: 'Wedding Reception Address',
    venuePhone: 'Venue Phone Number',
    plannerEmail: 'Planner/Coordinator Email',
    lastName: 'Last Name to be Taken',
    bridesmaids: 'How many Bridesmaids?',
    groomsmen: 'How many Groomsmen?',
    tableForDj: 'Reserved a 6ft Table for DJ?',
    spaceForDj: "Reserved a 10'x10' Space for DJ?",
    outside: 'Any portion of day outside?',
    power: 'Does each space have power?',
    mc: 'Who is your MC?',
    requests: 'Specific Requests/Notes',
    guestCount: 'Guest Count',
    uplightColours: 'Uplight Colour(s)? (If Applicable)',
    photobooth: 'Photobooth Hours (If Applicable)',
    genres: 'Favourite Genres/Artists',
    dedications: 'Dedications (If Needed)',
    mood: 'Mood/Vibe Preference',
    guestRequests: 'Guest Request Policy',
    mustPlay: 'Must Play List',
    doNotPlay: 'Do Not Play List',
    preCeremony: 'Pre-Ceremony Playlist',
    cocktail: 'Cocktail Playlist',
    dinner: 'Dinner Playlist',
    dance: 'Dance Playlist',
    specialPlaylists: 'Special Playlists',
  }
  return labels[key]
}

function padAppearances(rows: AppearanceRow[]): AppearanceRow[] {
  const next = rows.slice(0, 24)
  while (next.length < SHEET_APPEARANCE_ROWS) {
    next.push({ names: '', people: '', when: '', notes: '' })
  }
  return next
}

function sectionTone(section: string): string {
  if (section === 'Ceremony') return 'bg-[#ff0076] text-[#d4edbc]'
  if (section === 'Cocktail Time') return 'bg-[#0a53a8] text-[#bfe0f6]'
  return 'bg-[#11734b] text-[#d4edbc]'
}

const box = 'border border-[#bdc1c6] bg-white p-0 align-top'
const labelCell =
  'border border-[#bdc1c6] px-2 py-1.5 text-left text-xs font-bold text-[#434343] align-middle'

function head(strong: boolean): string {
  return `border border-[#bdc1c6] bg-white px-2 py-2 text-left text-sm text-[#202124] ${strong ? 'font-bold' : 'font-normal'}`
}
