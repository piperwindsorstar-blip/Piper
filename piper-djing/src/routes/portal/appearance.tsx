import { createFileRoute } from '@tanstack/react-router'
import { SectionFlow } from '../../components/portal/section-flow.tsx'
import { questionSearch } from '../../lib/portal/questions.ts'

export const Route = createFileRoute('/portal/appearance')({
  validateSearch: questionSearch,
  component: AppearancePage,
})

function AppearancePage() {
  return <SectionFlow section="appearance" />
}
