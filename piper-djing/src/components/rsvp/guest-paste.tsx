import { ActionButton } from '../action-button.tsx'
import type { RunResult } from '../action-button.tsx'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useRef, useState } from 'react'
import { foldName } from '../../lib/rsvp/model.ts'
import { partyLabel, splitGuestPaste } from '../../lib/rsvp/guest-list.ts'
import { saveRsvpGuestList } from '../../lib/rsvp/rsvp.functions.ts'
import { rsvpButton, rsvpField, rsvpGhost } from './shell.tsx'

type Row = {
  key: string
  id: string
  name: string
  partyKey: string
  plusOneAllowed: boolean
}

type PartyGuest = {
  id: string
  firstName: string
  lastName: string
  isPlusOne: boolean
  plusOneAllowed: boolean
}

type Party = {
  id: string
  name: string
  token: string
  guests: PartyGuest[]
}

export function GuestPaste({
  parties,
  meals,
  publicLink,
}: {
  parties: Party[]
  meals: string[]
  publicLink: string
}) {
  const save = useServerFn(saveRsvpGuestList)
  const router = useRouter()
  const draft = useRef(0)
  const [rows, setRows] = useState<Row[]>(() => rowsFrom(parties))
  const [paste, setPaste] = useState('')
  const [mealText, setMealText] = useState(meals.join(', '))
  const [picked, setPicked] = useState<string[]>([])
  const [notice, setNotice] = useState('')

  function addNames(raw: string) {
    const parsed = splitGuestPaste(raw)
    if (parsed.length === 0) {
      setNotice('Paste one guest per line, or separate names with commas.')
      return
    }
    const seen = new Set(
      rows.map((row) => foldName(row.name)).filter((key) => key !== ''),
    )
    const next = rows.slice()
    let added = 0
    let skipped = 0
    for (const name of parsed) {
      const key = foldName(name)
      if (!key || seen.has(key)) {
        skipped += 1
        continue
      }
      if (next.length >= 500) break
      seen.add(key)
      draft.current += 1
      const rowKey = `new-${draft.current}`
      next.push({
        key: rowKey,
        id: '',
        name,
        partyKey: `solo-${rowKey}`,
        plusOneAllowed: false,
      })
      added += 1
    }
    setRows(next)
    setPaste('')
    setNotice(
      [
        added
          ? `${added} names ready to group.`
          : 'Those names are already on the list.',
        skipped ? `${skipped} duplicates left out.` : '',
        'Group people who share an RSVP, then save.',
      ]
        .filter(Boolean)
        .join(' '),
    )
  }

  function share() {
    if (picked.length < 2) {
      setNotice('Tick at least two guests who will share one RSVP.')
      return
    }
    draft.current += 1
    const partyKey = `group-${draft.current}`
    const chosen = new Set(picked)
    setRows((current) =>
      current.map((row) => (chosen.has(row.key) ? { ...row, partyKey } : row)),
    )
    setPicked([])
    setNotice(
      'Those guests share one RSVP link. Save when the groups look right.',
    )
  }

  function alone() {
    if (picked.length === 0) {
      setNotice('Tick the guests who should reply on their own.')
      return
    }
    const chosen = new Set(picked)
    setRows((current) =>
      current.map((row) =>
        chosen.has(row.key) ? { ...row, partyKey: `solo-${row.key}` } : row,
      ),
    )
    setPicked([])
    setNotice('Each ticked guest is on their own.')
  }

  const groups = new Map<string, Row[]>()
  for (const row of rows) {
    const list = groups.get(row.partyKey) ?? []
    list.push(row)
    groups.set(row.partyKey, list)
  }

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="font-semibold">Paste your guest list</h2>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        One name per line. Commas work too. Blanks and duplicates are dropped.
        Group people who share one RSVP, or leave a guest on their own. Each
        party gets one link, and anyone in it can answer for the others. These
        names stay with you and Piper.
      </p>
      <label className="mt-4 block text-sm" htmlFor="guest-paste">
        Guest names
        <textarea
          id="guest-paste"
          className={`${rsvpField} mt-1 min-h-28 py-3`}
          value={paste}
          placeholder={'Elizabeth Miller\nDavid Miller, Nora Miller'}
          onChange={(event) => setPaste(event.target.value)}
          onPaste={(event) => {
            const raw = event.clipboardData.getData('text')
            if (!raw.trim()) return
            event.preventDefault()
            addNames(raw)
          }}
        />
      </label>
      <button
        type="button"
        className={`${rsvpGhost} mt-3`}
        onClick={() => addNames(paste)}
      >
        Add these names
      </button>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={`${rsvpGhost} w-auto`} onClick={share}>
          They share an RSVP
        </button>
        <button type="button" className={`${rsvpGhost} w-auto`} onClick={alone}>
          On their own
        </button>
        <button
          type="button"
          className={`${rsvpGhost} w-auto`}
          onClick={() => {
            draft.current += 1
            const rowKey = `new-${draft.current}`
            setRows((current) => [
              ...current,
              {
                key: rowKey,
                id: '',
                name: '',
                partyKey: `solo-${rowKey}`,
                plusOneAllowed: false,
              },
            ])
          }}
        >
          Add a name
        </button>
      </div>
      <div className="mt-4 grid gap-3">
        {[...groups.entries()].map(([partyKey, members]) => (
          <article
            key={partyKey}
            className="rounded-2xl border border-[var(--border)] p-3"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const key = event.dataTransfer.getData('text/plain')
              if (!key) return
              setRows((current) =>
                current.map((row) =>
                  row.key === key ? { ...row, partyKey } : row,
                ),
              )
            }}
          >
            <h3 className="text-sm font-semibold">
              {partyLabel(members.map((row) => row.name)) || 'Party'}
            </h3>
            <ul className="mt-2 grid gap-2">
              {members.map((row) => (
                <li
                  key={row.key}
                  className="grid gap-2 sm:grid-cols-[auto_1fr]"
                >
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={picked.includes(row.key)}
                      aria-label={`Select ${row.name || 'guest'}`}
                      onChange={(event) =>
                        setPicked((current) =>
                          event.target.checked
                            ? [...current, row.key]
                            : current.filter((key) => key !== row.key),
                        )
                      }
                    />
                  </label>
                  <div
                    className="grid gap-2"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', row.key)
                      event.dataTransfer.effectAllowed = 'move'
                    }}
                  >
                    <input
                      className={rsvpField}
                      aria-label="Guest name"
                      value={row.name}
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((item) =>
                            item.key === row.key
                              ? { ...item, name: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={row.plusOneAllowed}
                          onChange={(event) =>
                            setRows((current) =>
                              current.map((item) =>
                                item.key === row.key
                                  ? {
                                      ...item,
                                      plusOneAllowed: event.target.checked,
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                        Allow a plus-one
                      </label>
                      <button
                        type="button"
                        className="min-h-11 text-sm text-[var(--pink-soft)]"
                        onClick={() =>
                          setRows((current) =>
                            current.filter((item) => item.key !== row.key),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        ))}
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No guests yet.</p>
        ) : null}
      </div>
      <label className="mt-4 block text-sm" htmlFor="meal-options">
        Meal options
        <input
          id="meal-options"
          className={`${rsvpField} mt-1`}
          value={mealText}
          onChange={(event) => setMealText(event.target.value)}
        />
      </label>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Each guest who says yes picks their own meal and can add a dietary or
        allergy note. A party does not share one meal.
      </p>
      {parties.length > 0 ? (
        <ul className="mt-4 grid gap-2 text-sm">
          {parties.map((party) => (
            <li key={party.id}>
              <a
                className="text-[var(--pink-soft)]"
                href={`${publicLink}/p/${party.token}`}
              >
                {party.name}
              </a>
              <span className="text-[var(--text-muted)]">
                {' '}
                · one link for this party
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <ActionButton
        className={`${rsvpButton} mt-4 w-auto`}
        wrapperClassName="inline-grid w-auto"
        busy="Saving…"
        done="Saved"
        surface="dark"
        onRun={async (): Promise<RunResult> => {
          const result = await save({
            data: {
              guests: rows.map((row) => ({
                id: row.id,
                name: row.name,
                partyId: row.partyKey,
                plusOneAllowed: row.plusOneAllowed,
              })),
              meals: mealText,
            },
          })
          if (!result.ok) {
            const message =
              'error' in result ? result.error : 'Could not save the list.'
            return { ok: false, message }
          }
          await router.invalidate()
          return { ok: true, message: 'Saved.' }
        }}
      >
        Save guest list
      </ActionButton>
      {notice ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">{notice}</p>
      ) : null}
    </section>
  )
}

function rowsFrom(parties: Party[]): Row[] {
  const rows: Row[] = []
  for (const party of parties) {
    for (const guest of party.guests) {
      if (guest.isPlusOne) continue
      rows.push({
        key: guest.id,
        id: guest.id,
        name: `${guest.firstName} ${guest.lastName}`.trim(),
        partyKey: party.id,
        plusOneAllowed: guest.plusOneAllowed,
      })
    }
  }
  return rows
}
