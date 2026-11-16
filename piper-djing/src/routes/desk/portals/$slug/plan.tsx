import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { PlanSheet } from '../../../../components/portal/plan-sheet.tsx'
import { deskGhost } from '../../../../components/desk-ui.tsx'
import { getCouplePortalDesk } from '../../../../lib/crm/desk.functions.ts'
import { deskHead } from '../../../../lib/desk-head.ts'
import { overallProgress } from '../../../../lib/portal/progress.ts'

export const Route = createFileRoute('/desk/portals/$slug/plan')({
  // Private page: its data loading rides in the same lazy chunk as its
  // screen, so the server calls it imports stay off the public pages.
  codeSplitGroupings: [['loader', 'component']],
  head: () => {
    const head = deskHead('Wedding plan · DJ Piper P')
    return {
      ...head,
    }
  },
  loader: async ({ params }) => {
    const page = await getCouplePortalDesk({ data: { slug: params.slug } })
    if (!page) throw notFound()
    return page
  },
  component: DeskPlanPage,
})

function DeskPlanPage() {
  const page = Route.useLoaderData()
  const progress = overallProgress(page.planning, page.master)
  return (
    <PlanSheet
      partnerOne={page.partnerOne}
      partnerTwo={page.partnerTwo}
      eventDate={page.eventDate}
      packageName={page.packageName}
      venueName={page.venueName}
      planning={page.planning}
      percent={progress.percent}
      prepared={page.today}
      actions={
        <>
          <Link
            to="/desk/portals/$slug"
            params={{ slug: page.slug }}
            className={deskGhost}
          >
            Edit answers
          </Link>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#161616]"
            onClick={() => window.print()}
          >
            Download PDF
          </button>
        </>
      }
    />
  )
}
