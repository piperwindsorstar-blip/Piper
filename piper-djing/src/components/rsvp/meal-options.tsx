import { useServerFn } from '@tanstack/react-start'
import { useEffect, useRef, useState } from 'react'
import { SaveStatus, useAutosave } from './autosave.tsx'
import {
  MAX_MEALS,
  MEAL_MAX_LENGTH,
  cleanMealList,
} from '../../lib/rsvp/guest-list.ts'
import { saveRsvpMeals } from '../../lib/rsvp/rsvp.functions.ts'
import {
  rsvpField,
  rsvpGhostFit,
} from './shell.tsx'

type Box = { key: string; value: string }

/**
 * The dinner choices, one meal per box. A comma inside a box is part of that
 * meal's name. Saved to the same list the guest dinner dropdown reads.
 */
export function MealOptions({
  meals,
  title = 'Meal options',
}: {
  meals: string[]
  title?: string
}) {
  const save = useServerFn(saveRsvpMeals)
  const counter = useRef(0)
  const next = () => {
    counter.current += 1
    return `meal-${counter.current}`
  }
  const [boxes, setBoxes] = useState<Box[]>(() =>
    (meals.length > 0 ? meals : ['']).map((value) => ({ key: next(), value })),
  )
  const [focusKey, setFocusKey] = useState('')

  const filled = boxes.filter((box) => box.value.trim() !== '').length
  const keys = boxes.map((box) => box.value.trim().replace(/\s+/g, ' '))
  const repeated = new Set(
    keys.filter(
      (key, index) =>
        key !== '' &&
        keys.findIndex((other) => other.toLowerCase() === key.toLowerCase()) !==
          index,
    ),
  )

  // Saves a moment after typing stops. The page is not reloaded after a
  // save, so the box being typed in keeps its place.
  const autosave = useAutosave<string[]>(async (values) => {
    const cleaned = cleanMealList(values)
    if (!cleaned.ok) return { ok: false, error: cleaned.error }
    try {
      const result = await save({ data: { meals: cleaned.meals } })
      return result.ok ? { ok: true } : { ok: false, error: result.error }
    } catch {
      return { ok: false, error: 'The meals did not save.' }
    }
  }, 1000)
  const first = useRef(true)
  const listKey = keys.join('\u0000')
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (repeated.size > 0) {
      autosave.hold(`${[...repeated][0]} is listed twice. Remove one to save.`)
      return
    }
    autosave.schedule(boxes.map((box) => box.value))
    // Saves when the list of meals changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey])
  useEffect(() => () => autosave.flush(), [autosave.flush])

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        One meal per box. Guests who say yes pick from exactly these, and each
        guest can add a dietary or allergy note.
      </p>
      <ul className="mt-3 grid gap-2" aria-label="Meal options">
        {boxes.map((box, index) => {
          const twice = repeated.has(
            box.value.trim().replace(/\s+/g, ' '),
          )
          return (
            <li key={box.key} className="flex items-center gap-2">
              <input
                className={`${rsvpField} min-w-0 flex-1 ${twice ? 'border-[var(--pink)]' : ''}`}
                aria-label={`Meal ${index + 1}`}
                aria-invalid={twice ? true : undefined}
                maxLength={MEAL_MAX_LENGTH}
                placeholder={index === 0 ? 'Prime rib' : 'Another meal'}
                value={box.value}
                autoFocus={box.key === focusKey}
                onChange={(event) => {
                  const value = event.target.value
                  setBoxes((current) =>
                    current.map((item) =>
                      item.key === box.key ? { ...item, value } : item,
                    ),
                  )
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  if (boxes.length >= MAX_MEALS) return
                  const key = next()
                  setFocusKey(key)
                  setBoxes((current) => {
                    const at = current.findIndex((item) => item.key === box.key)
                    const copy = current.slice()
                    copy.splice(at + 1, 0, { key, value: '' })
                    return copy
                  })
                }}
              />
              <button
                type="button"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--border-strong)] text-lg text-[var(--text-muted)] hover:border-[var(--pink)] hover:text-[var(--text)]"
                aria-label={`Remove ${box.value.trim() || `meal ${index + 1}`}`}
                onClick={() =>
                  setBoxes((current) => {
                    const left = current.filter((item) => item.key !== box.key)
                    return left.length > 0 ? left : [{ key: next(), value: '' }]
                  })
                }
              >
                ×
              </button>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-start gap-3">
        <button
          type="button"
          className={`${rsvpGhostFit}`}
          disabled={boxes.length >= MAX_MEALS}
          onClick={() => {
            const key = next()
            setFocusKey(key)
            setBoxes((current) => [...current, { key, value: '' }])
          }}
        >
          + Add meal
        </button>
        <SaveStatus phase={autosave.phase} error={autosave.error} />
      </div>
      <p className="mt-2 text-xs text-[var(--text-faint)]">
        {filled} of {MAX_MEALS} meals · empty boxes are left out · changes save on their own
      </p>
    </section>
  )
}
