import { createFileRoute } from '@tanstack/react-router'
import { BrandHome } from '../components/brand.tsx'
import { BRAND_DESCRIPTION, publicHead } from '../lib/seo.ts'

export const Route = createFileRoute('/')({
  head: () =>
    publicHead({
      path: '/',
      title: 'DJ Piper P | Piper DJing',
      description: BRAND_DESCRIPTION,
    }),
  component: Home,
})

function Home() {
  return <BrandHome />
}
