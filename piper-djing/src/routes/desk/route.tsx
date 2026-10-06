import { Outlet, createFileRoute } from '@tanstack/react-router'
import { DeskShell } from '../../components/desk-shell.tsx'
import { requireDeskPage } from '../../lib/auth/server.ts'
import { privateHead } from '../../lib/seo.ts'

export const Route = createFileRoute('/desk')({
  head: () => privateHead('Desk · Piper DJing'),
  beforeLoad: () => requireDeskPage(),
  component: DeskLayout,
})

function DeskLayout() {
  return (
    <DeskShell>
      <Outlet />
    </DeskShell>
  )
}
