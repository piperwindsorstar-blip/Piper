import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { PlanSheet } from '../../../../components/portal/plan-sheet.tsx'
import { deskGhost } from '../../../../components/desk-ui.tsx'
import { getCouplePortalDesk } from '../../../../lib/crm/desk.functions.ts'
import { deskHead } from '../../../../lib/desk-head.ts'
import { overallProgress } from '../../../../lib/portal/progress.ts'

const FONTS =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Display:wght@800;900&display=swap'

export const Route = createFileRoute('/desk/portals/$slug/plan')({
  // Private page: its data loading rides in the same lazy chunk as its
  // screen, so the server calls it imports stay off the public pages.
  codeSplitGroupings: [['loader', 'component']],
  head: () => {
    const head = deskHead('Wedding plan · DJ Piper P')
    return {
      ...head,
      links: [{ rel: 'stylesheet', href: FONTS }],
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
