import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { EventType } from '../../lib/crm/date-request.ts'

type Draft = {
  date: string
  setDate: (date: string) => void
  eventType: EventType
  setEventType: (eventType: EventType) => void
  company: string
  setCompany: (company: string) => void
  calendarOpen: boolean
  openCalendar: () => void
  closeCalendar: () => void
}

const DateDraftContext = createContext<Draft | null>(null)

export function DateDraftProvider({ children }: { children: ReactNode }) {
  const [date, setDate] = useState('')
  const [eventType, setEventType] = useState<EventType>('Wedding')
  const [company, setCompany] = useState('')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const value = useMemo(
    () => ({
      date,
      setDate,
      eventType,
      setEventType,
      company,
      setCompany,
      calendarOpen,
      openCalendar: () => setCalendarOpen(true),
      closeCalendar: () => setCalendarOpen(false),
    }),
    [calendarOpen, company, date, eventType],
  )
  return (
    <DateDraftContext.Provider value={value}>
      {children}
    </DateDraftContext.Provider>
  )
}

export function useDateDraft(): Draft {
  return (
    useContext(DateDraftContext) ?? {
      date: '',
      setDate: () => undefined,
      eventType: 'Wedding',
      setEventType: () => undefined,
      company: '',
      setCompany: () => undefined,
      calendarOpen: false,
      openCalendar: () => undefined,
      closeCalendar: () => undefined,
    }
  )
}
