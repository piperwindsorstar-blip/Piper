import { createFileRoute } from '@tanstack/react-router'
import { PlanSheet } from '../../components/portal/plan-sheet.tsx'
import { getSharedPlan } from '../../lib/portal/portal.functions.ts'
import { overallProgress } from '../../lib/portal/progress.ts'
import { privateHead } from '../../lib/seo.ts'

const FONTS =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Display:wght@800;900&display=swap'

export const Route = createFileRoute('/share/$token')({
  head: () => {
    const head = privateHead('Wedding plan · DJ Piper P')
    return {
      ...head,
      links: [{ rel: 'stylesheet', href: FONTS }],
    }
  },
  loader: ({ params }) => getSharedPlan({ data: { token: params.token } }),
  component: SharePage,
})

function SharePage() {
  const page = Route.useLoaderData()
  if (!page) {
    return (
      <main className="plan-page px-6 py-24 text-[#161616]">
        <h1 className="plan-display text-3xl">This link is off.</h1>
      </main>
    )
  }
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
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-full bg-[#161616] px-4 text-sm font-semibold text-white"
          onClick={() => window.print()}
        >
          Print / Save as PDF
        </button>
      }
    />
  )
}
