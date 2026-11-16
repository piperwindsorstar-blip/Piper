import { PUBLIC_EMAIL } from '../crm/defaults.ts'
import { publicUrl } from '../crm/safe-origin.ts'
import { piperPaymentEmail, piperSignupEmail, welcomeEmail } from './emails.ts'
import { coupleReplyAddress, priceLabel, rsvpPath } from './model.ts'
import type { RsvpWedding } from './model.ts'
import { sendRsvpEmail } from './mailer.server.ts'
import { coupleBookings } from './store.server.ts'

/**
 * When a couple's RSVP page is paid and the guest link goes live: a receipt to
 * the couple and a heads-up to Piper. Called from the desk and from the bot API.
 */
export async function notifyCouplePaid(wedding: RsvpWedding): Promise<void> {
  const amountLabel = priceLabel(wedding.priceCents)
  const to = coupleReplyAddress(wedding, await coupleBookings())
  if (to.includes('@')) {
    await sendRsvpEmail({
      slug: wedding.slug,
      kind: 'welcome',
      to,
      email: welcomeEmail(wedding, {
        amountLabel,
        dashboardUrl: publicUrl('/rsvp/manage'),
        guestUrl: publicUrl(rsvpPath(wedding.slug)),
      }),
    })
  }
  await sendRsvpEmail({
    slug: wedding.slug,
    kind: 'piper-payment',
    to: PUBLIC_EMAIL,
    email: piperPaymentEmail(wedding, amountLabel),
  })
}

/** When a couple starts an RSVP page: tell Piper. */
export async function notifyPiperSignup(wedding: RsvpWedding): Promise<void> {
  await sendRsvpEmail({
    slug: wedding.slug,
    kind: 'piper-signup',
    to: PUBLIC_EMAIL,
    email: piperSignupEmail(wedding),
  })
}
