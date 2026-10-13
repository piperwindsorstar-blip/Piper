import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useRef, useState } from 'react'
import { ActionButton } from '../action-button.tsx'
import type { RunResult } from '../action-button.tsx'
import {
  MAX_MEALS,
  MEAL_MAX_LENGTH,
  cleanMealList,
} from '../../lib/rsvp/guest-list.ts'
import { saveRsvpMeals } from '../../lib/rsvp/rsvp.functions.ts'
import { rsvpButton, rsvpField, rsvpGhost, useRsvpTheme } from './shell.tsx'

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
  const router = useRouter()
  const surface = useRsvpTheme()
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
      {repeated.size > 0 ? (
        <p className="mt-2 text-sm text-[var(--pink-soft)]" role="alert">
          {[...repeated][0]} is listed twice. Remove one before saving.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-start gap-3">
        <button
          type="button"
          className={`${rsvpGhost} w-auto`}
          disabled={boxes.length >= MAX_MEALS}
          onClick={() => {
            const key = next()
            setFocusKey(key)
            setBoxes((current) => [...current, { key, value: '' }])
          }}
        >
          + Add meal
        </button>
        <ActionButton
          className={`${rsvpButton} w-auto`}
          wrapperClassName="inline-grid w-auto"
          busy="Saving…"
          done="Saved"
          surface={surface}
          onRun={async (): Promise<RunResult> => {
            const cleaned = cleanMealList(boxes.map((box) => box.value))
            if (!cleaned.ok) return { ok: false, message: cleaned.error }
            try {
              const result = await save({ data: { meals: cleaned.meals } })
              if (!result.ok) return { ok: false, message: result.error }
              setBoxes(
                (result.meals.length > 0 ? result.meals : ['']).map(
                  (value) => ({ key: next(), value }),
                ),
              )
              await router.invalidate()
              return {
                ok: true,
                message:
                  result.meals.length === 0
                    ? 'Saved. Guests are not asked for a meal.'
                    : `Saved. Guests choose from ${result.meals.length} meal${result.meals.length === 1 ? '' : 's'}.`,
              }
            } catch {
              return { ok: false, message: 'The meals did not save.' }
            }
          }}
        >
          Save meals
        </ActionButton>
      </div>
      <p className="mt-2 text-xs text-[var(--text-faint)]">
        {filled} of {MAX_MEALS} meals · empty boxes are left out
      </p>
    </section>
  )
}
