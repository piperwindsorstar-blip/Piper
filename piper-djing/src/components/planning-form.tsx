import { useState } from 'react'
import {
  PLANNING_CHOICES,
  type AppearanceRow,
  type Planning,
  type TimelineRow,
} from '../lib/crm/planning.ts'

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
  const [planning, setPlanning] = useState(initial)
  const [notice, setNotice] = useState<string | null>(
    saved ? 'Saved on your page.' : null,
  )
  const [pending, setPending] = useState(false)

  function set<K extends keyof Planning>(key: K, value: Planning[K]) {
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
      className="mt-16 grid gap-10"
      onSubmit={(event) => {
        event.preventDefault()
        setPending(true)
        void onSave(planning).then((result) => {
          setPending(false)
          setNotice(result.ok ? 'Saved.' : result.error)
        })
      }}
    >
      <div>
        <h2 className="font-display text-3xl tracking-tight">Planning form</h2>
        <p className="mt-3 text-sm text-ink-soft">
          This copy is only for your wedding. Fill in what you know. You can
          come back and change it.
        </p>
      </div>

      <fieldset className="grid gap-4">
        <legend className="font-display text-2xl">The day</legend>
        <Field
          label="Couple's names"
          value={planning.coupleNames}
          onChange={(value) => set('coupleNames', value)}
        />
        <Field
          label="Date of wedding"
          value={planning.weddingDate}
          onChange={(value) => set('weddingDate', value)}
        />
        <Field
          label="Venue name"
          value={planning.venueName}
          onChange={(value) => set('venueName', value)}
        />
        <Field
          label="Arrival time to the venue"
          value={planning.arrivalTime}
          onChange={(value) => set('arrivalTime', value)}
        />
        <Field
          label="Wedding ceremony address"
          value={planning.ceremonyAddress}
          onChange={(value) => set('ceremonyAddress', value)}
          long
        />
        <Field
          label="Wedding reception address, if it is different"
          value={planning.receptionAddress}
          onChange={(value) => set('receptionAddress', value)}
          long
        />
        <Field
          label="Venue phone number"
          value={planning.venuePhone}
          onChange={(value) => set('venuePhone', value)}
        />
        <Field
          label="Planner or coordinator email"
          value={planning.plannerEmail}
          onChange={(value) => set('plannerEmail', value)}
        />
        <Field
          label="Last name to be taken"
          value={planning.lastName}
          onChange={(value) => set('lastName', value)}
        />
        <Field
          label="Email"
          value={planning.email}
          onChange={(value) => set('email', value)}
        />
        <Field
          label="Phone number"
          value={planning.phone}
          onChange={(value) => set('phone', value)}
        />
        <Field
          label="Guest count"
          value={planning.guestCount}
          onChange={(value) => set('guestCount', value)}
        />
        <Field
          label="How many bridesmaids?"
          value={planning.bridesmaids}
          onChange={(value) => set('bridesmaids', value)}
        />
        <Field
          label="How many groomsmen?"
          value={planning.groomsmen}
          onChange={(value) => set('groomsmen', value)}
        />
        <Choice
          label="Reserved a 6ft table for the DJ?"
          value={planning.tableForDj}
          onChange={(value) => set('tableForDj', value)}
        />
        <Choice
          label="Reserved a 10 by 10 space for the DJ?"
          value={planning.spaceForDj}
          onChange={(value) => set('spaceForDj', value)}
        />
        <Choice
          label="Any portion of the day outside?"
          value={planning.outside}
          onChange={(value) => set('outside', value)}
        />
        <Choice
          label="Does each space have power?"
          value={planning.power}
          onChange={(value) => set('power', value)}
        />
        <Field
          label="Who is your MC?"
          value={planning.mc}
          onChange={(value) => set('mc', value)}
        />
        <Field
          label="Uplight colours, if you would like them"
          value={planning.uplightColours}
          onChange={(value) => set('uplightColours', value)}
        />
        <Field
          label="Photobooth hours, if you have one"
          value={planning.photobooth}
          onChange={(value) => set('photobooth', value)}
        />
        <Field
          label="Specific requests or notes"
          value={planning.requests}
          onChange={(value) => set('requests', value)}
          long
        />
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="font-display text-2xl">Music</legend>
        <Field
          label="Favourite genres and artists"
          value={planning.genres}
          onChange={(value) => set('genres', value)}
          long
        />
        <Field
          label="Mood or vibe"
          value={planning.mood}
          onChange={(value) => set('mood', value)}
          long
        />
        <Field
          label="Dedications, if you want any"
          value={planning.dedications}
          onChange={(value) => set('dedications', value)}
          long
        />
        <Field
          label="Guest request policy"
          value={planning.guestRequests}
          onChange={(value) => set('guestRequests', value)}
          long
        />
        <Field
          label="Must play"
          value={planning.mustPlay}
          onChange={(value) => set('mustPlay', value)}
          long
        />
        <Field
          label="Do not play"
          value={planning.doNotPlay}
          onChange={(value) => set('doNotPlay', value)}
          long
        />
        <Field
          label="Pre-ceremony playlist"
          value={planning.preCeremony}
          onChange={(value) => set('preCeremony', value)}
          long
        />
        <Field
          label="Cocktail playlist"
          value={planning.cocktail}
          onChange={(value) => set('cocktail', value)}
          long
        />
        <Field
          label="Dinner playlist"
          value={planning.dinner}
          onChange={(value) => set('dinner', value)}
          long
        />
        <Field
          label="Dance playlist"
          value={planning.dance}
          onChange={(value) => set('dance', value)}
          long
        />
        <Field
          label="Special playlists"
          value={planning.specialPlaylists}
          onChange={(value) => set('specialPlaylists', value)}
          long
        />
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="font-display text-2xl">Order of appearance</legend>
        <p className="text-sm text-ink-soft">
          Names, who is speaking or dancing, when it happens, and any note for
          the MC.
        </p>
        {planning.appearances.map((row, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-card border border-line bg-ivory px-4 py-4"
          >
            <Field
              label="Names or group"
              value={row.names}
              onChange={(value) => setAppearance(index, { names: value })}
            />
            <Field
              label="Speech or dance"
              value={row.people}
              onChange={(value) => setAppearance(index, { people: value })}
            />
            <Field
              label="When"
              value={row.when}
              onChange={(value) => setAppearance(index, { when: value })}
            />
            <Field
              label="Notes"
              value={row.notes}
              onChange={(value) => setAppearance(index, { notes: value })}
              long
            />
            {planning.appearances.length > 1 ? (
              <button
                type="button"
                className="min-h-11 w-fit text-sm text-danger"
                onClick={() =>
                  set(
                    'appearances',
                    planning.appearances.filter(
                      (_, rowIndex) => rowIndex !== index,
                    ),
                  )
                }
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
        {planning.appearances.length < 24 ? (
          <button
            type="button"
            className="min-h-11 w-fit rounded-full border border-ink px-4 text-sm"
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
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="font-display text-2xl">Songs for the day</legend>
        {planning.timeline.map((row, index) => (
          <div
            key={`${row.section}-${row.activity}`}
            className="grid gap-3 rounded-card border border-line bg-ivory px-4 py-4"
          >
            <p className="text-sm uppercase tracking-wide text-muted">
              {row.section}
            </p>
            <p className="font-display text-xl">{row.activity}</p>
            <Field
              label="Time"
              value={row.time}
              onChange={(value) => setTimeline(index, { time: value })}
            />
            <Field
              label="Song"
              value={row.song}
              onChange={(value) => setTimeline(index, { song: value })}
            />
            <Field
              label="Artist"
              value={row.artist}
              onChange={(value) => setTimeline(index, { artist: value })}
            />
            <Field
              label="Notes or a link"
              value={row.notes}
              onChange={(value) => setTimeline(index, { notes: value })}
              long
            />
          </div>
        ))}
      </fieldset>

      <div className="sticky bottom-0 -mx-5 border-t border-line bg-paper px-5 py-4">
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

function Field({
  label,
  value,
  onChange,
  long = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  long?: boolean
}) {
  return (
    <label className="field">
      {label}
      {long ? (
        <textarea
          rows={3}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  )
}

function Choice({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="field">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose</option>
        {PLANNING_CHOICES.map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </select>
    </label>
  )
}
