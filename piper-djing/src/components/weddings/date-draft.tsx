import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type Draft = {
  date: string
  setDate: (date: string) => void
}

const DateDraftContext = createContext<Draft | null>(null)

export function DateDraftProvider({ children }: { children: ReactNode }) {
  const [date, setDate] = useState('')
  const value = useMemo(() => ({ date, setDate }), [date])
  return (
    <DateDraftContext.Provider value={value}>
      {children}
    </DateDraftContext.Provider>
  )
}

export function useDateDraft(): Draft {
  return useContext(DateDraftContext) ?? { date: '', setDate: () => undefined }
}
