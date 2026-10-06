import { createFileRoute } from '@tanstack/react-router'
import { Landing } from '../components/landing.tsx'
import { publicHead } from '../lib/seo.ts'

export const Route = createFileRoute('/')({
  head: () => publicHead({ path: '/', title: 'Wedding DJ in Brantford, Ontario | Piper DJing' }),
  component: Landing,
})
