import { createFileRoute } from '@tanstack/react-router'
import { SectionFlow } from '../../components/portal/section-flow.tsx'
import { questionSearch } from '../../lib/portal/questions.ts'

export const Route = createFileRoute('/portal/music')({
  validateSearch: questionSearch,
  component: MusicPage,
})

function MusicPage() {
  return <SectionFlow section="music" />
}
