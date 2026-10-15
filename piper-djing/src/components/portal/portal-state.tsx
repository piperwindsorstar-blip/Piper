import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { savePortal } from '../../lib/portal/portal.functions.ts'
import { withSkipped } from '../../lib/portal/progress.ts'
import type { MasterMap } from '../../lib/portal/questions.ts'
import {
  addCustomMoment,
  reorderMoments,
  syncAppearanceSongs,
  TIMELINE,
} from '../../lib/crm/planning.ts'
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
  master: MasterMap
  shareToken?: string
  shareOn?: boolean
}

type PlanSave = (
  planning: Planning,
) => Promise<{ ok: true; planning: Planning } | { ok: false; error: string }>

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
  reorderTimeline: (section: string, fromId: string, toId: string) => void
  addMoment: (section: string, name: string) => void
  removeMoment: (id: string) => void
  setEntranceSong: (mode: 'one' | 'each', song: SongItem) => void
  editAppearances: (rows: AppearanceRow[]) => void
  editSongs: (id: 'mustPlay' | 'doNotPlay', items: SongItem[]) => void
  editSameReception: (same: boolean) => void
  markLocked: (planning: Planning) => void
  /** Marks a question as skipped for now. */
  skip: (id: string) => void
}

const PortalContext = createContext<PortalState | null>(null)

export function PortalProvider({
  page,
  children,
  saver,
}: {
  page: PortalPage
  children: ReactNode
  saver?: PlanSave
}) {
  const save = useServerFn(savePortal)
  const saverRef = useRef(saver)
  saverRef.current = saver
  const [planning, setPlanning] = useState(page.planning)
  const [locked, setLocked] = useState(page.locked)
  const [saveState, setSaveState] = useState<PortalState['saveState']>('idle')
  const [savedLabel, setSavedLabel] = useState('')
  const [saveError, setSaveError] = useState('')
  const dirty = useRef(false)
  const echo = useRef(false)
  /** True from an edit until the server has it, so leaving can warn. */
  const pending = useRef(false)

  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (!pending.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])
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
      const persist = saverRef.current
      const run = persist
        ? persist(snapshot)
        : save({ data: { planning: snapshot } })
      void run.then(async (result) => {
        if (latest.current !== snapshot) return
        if (!result.ok) {
          setSaveState('error')
          setSaveError(result.error)
          if (/locked/i.test(result.error)) {
            pending.current = false
            return
          }
          await new Promise((resolve) => window.setTimeout(resolve, 2000))
          if (latest.current !== snapshot) return
          const again = persist
            ? await persist(snapshot)
            : await save({ data: { planning: snapshot } })
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
    pending.current = false
    echo.current = true
    setPlanning(next)
    setSaveState('saved')
    setSaveError('')
    setSavedLabel(savedClock())
  }

  function touch(next: Planning) {
    if (locked) return
    dirty.current = true
    pending.current = true
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
      touch({
        ...planning,
        [id]: text,
        fromInquiry: planning.fromInquiry.filter((field) => field !== id),
      })
    },
    editChips: (chips) => touch({ ...planning, genreChips: chips }),
    editTimeline: (index, patch) => {
      const timeline = planning.timeline.slice()
      if (index < 0 || index > timeline.length) return
      if (index === timeline.length) {
        if (timeline.length >= TIMELINE.length + 12) return
        timeline.push({
          id: `custom-${timeline.length + 1}`,
          presetKey: '',
          time: '',
          section: 'Reception',
          activity: 'Added moment',
          song: '',
          artist: '',
          notes: '',
          link: '',
          hidden: false,
          label: '',
          people: '',
          songFrom: '',
          ...patch,
        })
      } else {
        const current = timeline[index]
        const linked =
          patch.song !== undefined ||
          patch.artist !== undefined ||
          patch.link !== undefined
        timeline[index] = {
          ...current,
          ...patch,
          songFrom: linked ? '' : current.songFrom,
        }
      }
      touch({ ...planning, timeline })
    },
    reorderTimeline: (section, fromId, toId) =>
      touch({
        ...planning,
        timeline: reorderMoments(planning.timeline, section, fromId, toId),
      }),
    addMoment: (section, name) =>
      touch({
        ...planning,
        timeline: addCustomMoment(planning.timeline, section, name),
      }),
    removeMoment: (id) =>
      touch({
        ...planning,
        timeline: planning.timeline.filter(
          (row) => row.id !== id || row.presetKey !== '',
        ),
      }),
    setEntranceSong: (mode, song) =>
      touch(
        syncAppearanceSongs({
          ...planning,
          entranceSongMode: mode,
          entranceSong: song,
        }),
      ),
    editAppearances: (rows) =>
      touch(
        syncAppearanceSongs({
          ...planning,
          appearances: rows.slice(0, 12),
        }),
      ),
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
        fromInquiry: planning.fromInquiry.filter(
          (field) => field !== 'receptionAddress',
        ),
      }),
    skip: (id) => {
      const next = withSkipped(planning, id)
      if (next !== planning) touch(next)
    },
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
