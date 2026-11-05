import { createFileRoute, redirect } from '@tanstack/react-router'

/** Invoices now live on the Money page, under Invoices. */
export const Route = createFileRoute('/desk/invoices')({
  beforeLoad: () => {
    throw redirect({ to: '/desk/money', search: { tab: 'invoices' } })
  },
})
