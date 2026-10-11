import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { savePortal } from '../../lib/portal/portal.functions.ts'
import { TIMELINE } from '../../lib/crm/planning.ts'
import type {
  Planning,
  AppearanceRow,
  SongItem,
  TimelineRow,
} from '../../lib/crm/planning.ts'

export type PortalPage = {
  partnerOne: string
  partnerTwo: string
  eventDate: string
  packageName: string
  venueName: string
  invoiceSlug: string | null
  slug: string
  today: string
  locked: boolean
  planning: Planning
}

type PortalState = {
  page: PortalPage
  planning: Planning
  locked: boolean
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  savedLabel: string
  saveError: string
  editText: (id: string, value: string) => void
  editChips: (chips: string[]) => void
  editTimeline: (index: number, patch: Partial<TimelineRow>) => void
  editAppearances: (rows: AppearanceRow[]) => void
  editSongs: (id: 'mustPlay' | 'doNotPlay', items: SongItem[]) => void
  editSameReception: (same: boolean) => void
  markLocked: (planning: Planning) => void
}

const PortalContext = createContext<PortalState | null>(null)

export function PortalProvider({
  page,
  children,
}: {
  page: PortalPage
  children: ReactNode
}) {
  const save = useServerFn(savePortal)
  const [planning, setPlanning] = useState(page.planning)
  const [locked, setLocked] = useState(page.locked)
  const [saveState, setSaveState] = useState<PortalState['saveState']>('idle')
  const [savedLabel, setSavedLabel] = useState('')
  const [saveError, setSaveError] = useState('')
  const dirty = useRef(false)
  const echo = useRef(false)
  const latest = useRef(planning)
  latest.current = planning

  useEffect(() => {
    if (echo.current) {
      echo.current = false
      return
    }
    if (!dirty.current || locked) return
    const snapshot = planning
    const timer = window.setTimeout(() => {
      setSaveState('saving')
      void save({ data: { planning: snapshot } }).then(async (result) => {
        if (latest.current !== snapshot) return
        if (!result.ok) {
          setSaveState('error')
          setSaveError(result.error)
          if (/locked/i.test(result.error)) return
          await new Promise((resolve) => window.setTimeout(resolve, 2000))
          if (latest.current !== snapshot) return
          const again = await save({ data: { planning: snapshot } })
          if (latest.current !== snapshot || !again.ok) {
            if (latest.current === snapshot && !again.ok) {
              setSaveState('error')
              setSaveError(again.error)
            }
            return
          }
          keep(again.planning)
          return
        }
        keep(result.planning)
      })
    }, 600)
    return () => window.clearTimeout(timer)
  }, [planning, locked, save])

  function keep(next: Planning) {
    echo.current = true
    setPlanning(next)
    setSaveState('saved')
    setSaveError('')
    setSavedLabel(savedClock())
  }

  function touch(next: Planning) {
    if (locked) return
    dirty.current = true
    setPlanning(next)
  }

  const value: PortalState = {
    page,
    planning,
    locked,
    saveState,
    savedLabel,
    saveError,
    editText: (id, text) => {
      if (!(id in planning)) return
      const current = planning[id as keyof Planning]
      if (typeof current !== 'string') return
      touch({ ...planning, [id]: text })
    },
    editChips: (chips) => touch({ ...planning, genreChips: chips }),
    editTimeline: (index, patch) => {
      const timeline = planning.timeline.slice()
      if (index === timeline.length) {
        if (timeline.length >= TIMELINE.length + 12) return
        timeline.push({
          time: '',
          section: 'Reception',
          activity: 'Added moment',
          song: '',
          artist: '',
          notes: '',
          link: '',
          hidden: false,
          label: '',
          ...patch,
        })
      } else if (timeline[index]) {
        timeline[index] = { ...timeline[index], ...patch }
      } else {
        return
      }
      touch({ ...planning, timeline })
    },
    editAppearances: (rows) =>
      touch({ ...planning, appearances: rows.slice(0, 12) }),
    editSongs: (id, items) =>
      touch(
        id === 'mustPlay'
          ? {
              ...planning,
              mustPlayItems: items,
              mustPlay: items
                .map((item) => item.song)
                .filter(Boolean)
                .join(', '),
            }
          : {
              ...planning,
              doNotPlayItems: items,
              doNotPlay: items
                .map((item) => item.song)
                .filter(Boolean)
                .join(', '),
            },
      ),
    editSameReception: (same) =>
      touch({
        ...planning,
        receptionSame: same,
        receptionAddress: same
          ? planning.ceremonyAddress
          : planning.receptionAddress,
      }),
    markLocked: (next) => {
      echo.current = true
      dirty.current = false
      setPlanning(next)
      setLocked(true)
    },
  }

  return (
    <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
  )
}

export function usePortal(): PortalState {
  const value = useContext(PortalContext)
  if (!value) throw new Error('The portal is missing its page.')
  return value
}

function savedClock(): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date())
}
