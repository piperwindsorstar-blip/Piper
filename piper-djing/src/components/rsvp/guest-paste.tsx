import { ActionButton } from '../action-button.tsx'
import type { RunResult } from '../action-button.tsx'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useRef, useState } from 'react'
import { foldName } from '../../lib/rsvp/model.ts'
import { partyLabel, splitPartyPaste } from '../../lib/rsvp/guest-list.ts'
import { saveRsvpGuestList } from '../../lib/rsvp/rsvp.functions.ts'
import { rsvpButton, rsvpField, rsvpGhost, useRsvpTheme } from './shell.tsx'

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
  publicLink,
}: {
  parties: Party[]
  publicLink: string
}) {
  const save = useServerFn(saveRsvpGuestList)
  const router = useRouter()
  const surface = useRsvpTheme()
  const draft = useRef(0)
  const [rows, setRows] = useState<Row[]>(() => rowsFrom(parties))
  const [paste, setPaste] = useState('')
  // Parties already saved start folded, so a long list stays short. New ones open.
  const [closed, setClosed] = useState<string[]>(() =>
    parties.map((party) => party.id),
  )
  const [notice, setNotice] = useState('')

  function nextKey(prefix: string) {
    draft.current += 1
    return `${prefix}-${draft.current}`
  }

  function addParties(raw: string) {
    const lines = splitPartyPaste(raw)
    if (lines.length === 0) {
      setNotice(
        'Type one party per line. Put commas between people who share an RSVP.',
      )
      return
    }
    const seen = new Set(
      rows.map((row) => foldName(row.name)).filter((key) => key !== ''),
    )
    const added: Row[] = []
    let skipped = 0
    let partiesAdded = 0
    for (const names of lines) {
      const partyKey = nextKey('group')
      let inParty = 0
      for (const name of names) {
        const key = foldName(name)
        if (!key || seen.has(key)) {
          skipped += 1
          continue
        }
        if (rows.length + added.length >= 500) break
        seen.add(key)
        added.push({
          key: nextKey('new'),
          id: '',
          name,
          partyKey,
          plusOneAllowed: false,
        })
        inParty += 1
      }
      if (inParty > 0) partiesAdded += 1
    }
    setRows([...rows, ...added])
    setPaste('')
    setNotice(
      [
        partiesAdded
          ? `${partiesAdded} ${partiesAdded === 1 ? 'party' : 'parties'} added (${added.length} ${added.length === 1 ? 'guest' : 'guests'}). Save to keep them.`
          : 'Those names are already on the list.',
        skipped ? `${skipped} already listed, left out.` : '',
      ]
        .filter(Boolean)
        .join(' '),
    )
  }

  function addBlankParty() {
    const partyKey = nextKey('group')
    setRows((current) => [
      ...current,
      {
        key: nextKey('new'),
        id: '',
        name: '',
        partyKey,
        plusOneAllowed: false,
      },
    ])
  }

  function addNameTo(partyKey: string) {
    setRows((current) => [
      ...current,
      {
        key: nextKey('new'),
        id: '',
        name: '',
        partyKey,
        plusOneAllowed: false,
      },
    ])
  }

  function patchRow(key: string, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    )
  }

  const groups = new Map<string, Row[]>()
  for (const row of rows) {
    const list = groups.get(row.partyKey) ?? []
    list.push(row)
    groups.set(row.partyKey, list)
  }
  const tokens = new Map(parties.map((party) => [party.id, party.token]))

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="font-semibold">Add your guests</h2>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Type or paste one party per line. Put a comma between people who share
        an RSVP, like <em>Liz Miller, David Miller, Nora Miller</em>. Each party
        gets its own card and one link, and anyone in it can answer for the
        others.
      </p>
      <label className="mt-4 block text-sm" htmlFor="guest-paste">
        One party per line
        <textarea
          id="guest-paste"
          className={`${rsvpField} mt-1 min-h-28 py-3`}
          value={paste}
          placeholder={
            'Liz Miller, David Miller, Nora Miller\nChidi Okafor, Ada Okafor\nWilliam Thompson'
          }
          onChange={(event) => setPaste(event.target.value)}
          onPaste={(event) => {
            const raw = event.clipboardData.getData('text')
            if (!raw.trim()) return
            event.preventDefault()
            addParties(raw)
          }}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={`${rsvpButton} !w-auto`}
          onClick={() => addParties(paste)}
        >
          Add parties
        </button>
        <button
          type="button"
          className={`${rsvpGhost} !w-auto`}
          onClick={addBlankParty}
        >
          + Add a party by hand
        </button>
      </div>
      {notice ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]" role="status">
          {notice}
        </p>
      ) : null}
      <div className="mt-5 grid gap-3">
        {[...groups.entries()].map(([partyKey, members]) => {
          const open = !closed.includes(partyKey)
          const title =
            partyLabel(members.map((row) => row.name)) || 'New party'
          const count = members.filter((row) => row.name.trim()).length
          const token = members
            .map((row) => tokens.get(row.partyKey))
            .find((value) => Boolean(value))
          return (
            <article
              key={partyKey}
              className="rounded-2xl border border-[var(--border)]"
            >
              <button
                type="button"
                aria-expanded={open}
                className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left"
                onClick={() =>
                  setClosed((current) =>
                    open
                      ? [...current, partyKey]
                      : current.filter((key) => key !== partyKey),
                  )
                }
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{title}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {count} {count === 1 ? 'guest' : 'guests'}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`shrink-0 text-[var(--text-muted)] transition ${open ? 'rotate-180' : ''}`}
                >
                  ▾
                </span>
              </button>
              {open ? (
                <div className="border-t border-[var(--border)] px-4 pb-4 pt-3">
                  <ul className="grid gap-3">
                    {members.map((row, index) => (
                      <li key={row.key} className="grid gap-1">
                        <div className="flex items-center gap-2">
                          <input
                            className={rsvpField}
                            aria-label={`Guest ${index + 1} in ${title}`}
                            placeholder="First and last name"
                            value={row.name}
                            onChange={(event) =>
                              patchRow(row.key, { name: event.target.value })
                            }
                          />
                          <button
                            type="button"
                            aria-label={`Remove ${row.name || 'this name'}`}
                            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--text-muted)] hover:text-[var(--pink)]"
                            onClick={() =>
                              setRows((current) =>
                                current.filter((item) => item.key !== row.key),
                              )
                            }
                          >
                            ✕
                          </button>
                        </div>
                        <label className="flex min-h-9 items-center gap-2 pl-1 text-sm text-[var(--text-muted)]">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--pink)]"
                            checked={row.plusOneAllowed}
                            onChange={(event) =>
                              patchRow(row.key, {
                                plusOneAllowed: event.target.checked,
                              })
                            }
                          />
                          Allow a plus-one
                        </label>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
                    <button
                      type="button"
                      className="min-h-11 text-sm font-semibold text-[var(--pink-soft)]"
                      onClick={() => addNameTo(partyKey)}
                    >
                      + Add a name
                    </button>
                    {token ? (
                      <a
                        className="min-h-11 content-center text-sm text-[var(--text-muted)] underline"
                        href={`${publicLink}/p/${token}`}
                      >
                        This party&apos;s link
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className="min-h-11 text-sm text-[var(--text-muted)] underline"
                      onClick={() =>
                        setRows((current) =>
                          current.filter((item) => item.partyKey !== partyKey),
                        )
                      }
                    >
                      Remove party
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          )
        })}
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No guests yet.</p>
        ) : null}
      </div>
      <p className="mt-4 text-sm text-[var(--text-muted)]">
        Each guest who says yes picks their own meal. A party does not share one
        meal.
      </p>
      <ActionButton
        className={`${rsvpButton} mt-4 w-auto`}
        wrapperClassName="inline-grid w-auto"
        busy="Saving…"
        done="Saved"
        surface={surface}
        onRun={async (): Promise<RunResult> => {
          const result = await save({
            data: {
              guests: rows.map((row) => ({
                id: row.id,
                name: row.name,
                partyId: row.partyKey,
                plusOneAllowed: row.plusOneAllowed,
              })),
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
