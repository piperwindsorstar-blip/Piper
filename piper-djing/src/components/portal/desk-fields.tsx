import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'
import { getCouple, savePortalDesk } from '../../lib/crm/desk.functions.ts'
import { todayInToronto } from '../../lib/crm/date-request.ts'
import { isPlanLocked } from '../../lib/crm/planning.ts'

export function PortalDeskFields({ slug }: { slug: string }) {
  const load = useServerFn(getCouple)
  const save = useServerFn(savePortalDesk)
  const [arrival, setArrival] = useState('')
  const [due, setDue] = useState('')
  const [locked, setLocked] = useState(false)
  const [unlock, setUnlock] = useState(false)
  const [ready, setReady] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    let cancel = false
    void load({ data: { slug } }).then((page) => {
      if (cancel || !page) return
      setArrival(page.planning.arrivalTime)
      setDue(page.planning.dueDate)
      setLocked(isPlanLocked(page.planning, todayInToronto()))
      setReady(true)
    })
    return () => {
      cancel = true
    }
  }, [load, slug])

  if (!ready) return null

  return (
    <form
      className="grid gap-3 rounded-2xl border border-white/10 p-4"
      onSubmit={(event) => {
        event.preventDefault()
        setNote('')
        void save({
          data: { slug, arrivalTime: arrival, dueDate: due, unlock },
        }).then((result) => {
          if (!result.ok) {
            setNote(result.error)
            return
          }
          setArrival(result.planning.arrivalTime)
          setDue(result.planning.dueDate)
          setLocked(isPlanLocked(result.planning, todayInToronto()))
          setUnlock(false)
          setNote('Portal fields saved.')
        })
      }}
    >
      <p className="text-sm font-semibold">Couple portal</p>
      <label className="grid gap-1 text-sm">
        Arrival time
        <input
          className="rounded-xl border border-white/15 bg-black/30 px-3 py-2"
          value={arrival}
          onChange={(event) => setArrival(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Finish-by date
        <input
          type="date"
          className="rounded-xl border border-white/15 bg-black/30 px-3 py-2"
          value={due}
          onChange={(event) => setDue(event.target.value)}
        />
      </label>
      {locked ? (
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={unlock}
            onChange={(event) => setUnlock(event.target.checked)}
          />
          Unlock the plan
        </label>
      ) : null}
      <button
        type="submit"
        className="min-h-11 w-fit rounded-full bg-white px-4 text-sm font-semibold text-black"
      >
        Save portal fields
      </button>
      {note ? <p className="text-sm text-white/70">{note}</p> : null}
    </form>
  )
}
