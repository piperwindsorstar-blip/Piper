import { createFileRoute, redirect } from '@tanstack/react-router'
import { privateHead } from '../../lib/seo.ts'

/**
 * The link Piper sends a couple. It no longer opens the plan by itself: the
 * plan asks for the couple's passcode first.
 */
export const Route = createFileRoute('/c/$slug')({
  head: () => privateHead('Your date · DJ Piper P'),
  loader: () => {
    throw redirect({ to: '/portal' })
  },
})
