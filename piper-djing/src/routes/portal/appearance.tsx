import { createFileRoute, redirect } from '@tanstack/react-router'

// Order of appearance was folded into the timeline. Old links land there.
export const Route = createFileRoute('/portal/appearance')({
  beforeLoad: () => {
    throw redirect({ to: '/portal/timeline' })
  },
})
