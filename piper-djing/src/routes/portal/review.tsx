import { createFileRoute } from '@tanstack/react-router'
import { ReviewScreen } from '../../components/portal/review-screen.tsx'

export const Route = createFileRoute('/portal/review')({
  component: ReviewScreen,
})
