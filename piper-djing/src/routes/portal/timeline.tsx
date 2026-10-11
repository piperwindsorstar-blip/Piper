import { createFileRoute } from '@tanstack/react-router'
import { SectionFlow } from '../../components/portal/section-flow.tsx'
import { questionSearch } from '../../lib/portal/questions.ts'

export const Route = createFileRoute('/portal/timeline')({
  validateSearch: questionSearch,
  component: TimelinePage,
})

function TimelinePage() {
  return <SectionFlow section="timeline" />
}
