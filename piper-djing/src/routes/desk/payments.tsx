import { createFileRoute, redirect } from '@tanstack/react-router'

/** Payments now live on the Money page, under Payments in. */
export const Route = createFileRoute('/desk/payments')({
  beforeLoad: () => {
    throw redirect({ to: '/desk/money', search: { tab: 'paid' } })
  },
})
