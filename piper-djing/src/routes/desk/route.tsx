import { Outlet, createFileRoute } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { DeskShell } from '../../components/desk-shell.tsx'
import { requireDeskPage } from '../../lib/auth/server.ts'
import { getDesk } from '../../lib/crm/desk.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'

export const Route = createFileRoute('/desk')({
  head: () => deskHead('Desk · DJ Piper P'),
  beforeLoad: () => requireDeskPage(),
  loader: () => getDesk(),
  staleTime: 15_000,
  preload: false,
  errorComponent: DeskError,
  component: DeskLayout,
})

function DeskLayout() {
  const data = Route.useLoaderData()
  return (
    <DeskShell data={data}>
      <Outlet />
    </DeskShell>
  )
}

function DeskError({ error, reset }: ErrorComponentProps) {
  const dropped = error instanceof Error && error.message === 'Failed to fetch'
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5">
      <h1 className="font-display text-4xl tracking-tight">
        The desk did not load.
      </h1>
      <p className="mt-3 text-sm text-muted">
        {dropped
          ? 'The connection dropped.'
          : error instanceof Error
            ? error.message
            : 'The connection dropped.'}
      </p>
      <button
        type="button"
        className="mt-6 inline-flex w-fit rounded-full bg-ink px-5 py-3 text-sm font-semibold text-ivory"
        onClick={() => reset()}
      >
        Try again
      </button>
    </main>
  )
}
