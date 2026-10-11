import { createFileRoute } from '@tanstack/react-router'
import { SectionFlow } from '../../components/portal/section-flow.tsx'
import { questionSearch } from '../../lib/portal/questions.ts'

export const Route = createFileRoute('/portal/details')({
  validateSearch: questionSearch,
  component: DetailsPage,
})

function DetailsPage() {
  return <SectionFlow section="details" />
}
