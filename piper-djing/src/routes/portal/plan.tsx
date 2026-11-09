import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { PlanSheet } from '../../components/portal/plan-sheet.tsx'
import { usePortal } from '../../components/portal/portal-state.tsx'
import {
  sharePortalPlan,
  stopPortalShare,
} from '../../lib/portal/portal.functions.ts'
import { overallProgress } from '../../lib/portal/progress.ts'

export const Route = createFileRoute('/portal/plan')({
  component: CouplePlanPage,
})

function CouplePlanPage() {
  const { page, planning, locked } = usePortal()
  const share = useServerFn(sharePortalPlan)
  const stop = useServerFn(stopPortalShare)
  const progress = overallProgress(planning, page.master)
  const [notice, setNotice] = useState('')
  const [on, setOn] = useState(page.shareOn === true)
  const quiet =
    'inline-flex min-h-11 items-center rounded-full border border-[#d8d8de] bg-white px-4 text-sm font-semibold text-[#161616]'
  const solid =
    'inline-flex min-h-11 items-center rounded-full bg-[#161616] px-4 text-sm font-semibold text-white'

  return (
    <PlanSheet
      partnerOne={page.partnerOne}
      partnerTwo={page.partnerTwo}
      eventDate={page.eventDate}
      packageName={page.packageName}
      venueName={page.venueName}
      planning={planning}
      percent={progress.percent}
      prepared={page.today}
      actions={
        <>
          {locked ? null : (
            <Link to="/portal" className={quiet}>
              Edit answers
            </Link>
          )}
          <button
            type="button"
            className={quiet}
            onClick={() => {
              void share().then(async (result) => {
                if (!result.ok) {
                  setNotice(result.error)
                  return
                }
                setOn(true)
                const url = `${window.location.origin}/share/${result.token}`
                try {
                  await navigator.clipboard.writeText(url)
                  setNotice('Link copied.')
                } catch {
                  setNotice(url)
                }
              })
            }}
          >
            Share with my planner
          </button>
          {on ? (
            <button
              type="button"
              className={quiet}
              onClick={() => {
                void stop().then((result) => {
                  if (!result.ok) {
                    setNotice(result.error)
                    return
                  }
                  setOn(false)
                  setNotice('The link is off.')
                })
              }}
            >
              Turn the link off
            </button>
          ) : null}
          <button
            type="button"
            className={solid}
            onClick={() => window.print()}
          >
            Print / Save as PDF
          </button>
          {notice ? (
            <p className="w-full text-right text-sm text-[#3a3a40]">{notice}</p>
          ) : null}
        </>
      }
    />
  )
}
