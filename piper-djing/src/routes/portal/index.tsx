import { createFileRoute } from '@tanstack/react-router'
import { OverviewScreen } from '../../components/portal/overview-screen.tsx'

export const Route = createFileRoute('/portal/')({
  component: OverviewScreen,
})
