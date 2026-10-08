import { createFileRoute } from '@tanstack/react-router'
import { Landing } from '../components/landing.tsx'
import { publicHead } from '../lib/seo.ts'

export const Route = createFileRoute('/')({
  head: () =>
    publicHead({
      path: '/',
      title:
        'Brantford Wedding DJ & The Ultimate Dance Floor Experience | Piper DJing',
    }),
  component: Landing,
})
