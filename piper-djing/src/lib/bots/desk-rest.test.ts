import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { inviteBot, listPackageOffers } from '../crm/store.server.ts'
import { sampleWedding } from '../rsvp/demo.ts'
import { deleteRsvp, readRsvp, writeRsvp } from '../rsvp/store.server.ts'
import { deskBotResponse } from './desk-rest.server.ts'
import { deskBotTarget } from './desk-rest.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

describe('desk bot paths', () => {
  it('serves the desk resources and leaves join on the old book', () => {
    assert.deepEqual(deskBotTarget('/api/bots/v1/leads'), {
      resource: 'leads',
      id: null,
    })
    assert.deepEqual(deskBotTarget('/api/bots/v1/leads/'), {
      resource: 'leads',
      id: null,
    })
    assert.deepEqual(deskBotTarget('/api/bots/v1/packages/full'), {
      resource: 'packages',
      id: 'full',
    })
    assert.deepEqual(deskBotTarget('/api/bots/v1/rsvps/mark-and-mya'), {
      resource: 'rsvps',
      id: 'mark-and-mya',
    })
    assert.equal(deskBotTarget('/api/bots/v1'), null)
    assert.equal(deskBotTarget('/api/bots/v1/join'), null)
    assert.equal(deskBotTarget('/api/bots/v1/glance'), null)
    assert.equal(deskBotTarget('/api/bots/v1/landing'), null)
    assert.equal(deskBotTarget('/api/bots/v1/forms/4/responses'), null)
  })
})

describe('desk bot edits', { skip: liveBook }, () => {
  it('lets a writer change a package and keeps a reader from writing', async () => {
    const reader = await inviteBot('Rest Reader', 'reader')
    const writer = await inviteBot('Rest Writer', 'writer')
    const denied = await deskBotResponse(
      new Request('http://localhost/api/bots/v1/questions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${reader.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ prompt: 'Reader question' }),
      }),
      async () => 'no',
    )
    assert.equal(denied.status, 403)

    const current = (await listPackageOffers()).find(
      (item) => item.id === 'stag',
    )
    assert.ok(current)
    const saved = await deskBotResponse(
      new Request('http://localhost/api/bots/v1/packages/stag', {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${writer.token}`,
          'content-type': 'application/json',
          'idempotency-key': 'stag-price-once',
        },
        body: JSON.stringify({
          name: current.name,
          detail: current.detail,
          priceCents: 75000,
        }),
      }),
      async () => 'no',
    )
    assert.equal(saved.status, 200)
    const body = (await saved.json()) as { package: { cents: number } }
    assert.equal(body.package.cents, 75000)

    const repeat = await deskBotResponse(
      new Request('http://localhost/api/bots/v1/packages/stag', {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${writer.token}`,
          'content-type': 'application/json',
          'idempotency-key': 'stag-price-once',
        },
        body: JSON.stringify({ priceCents: 80000 }),
      }),
      async () => 'no',
    )
    assert.equal(repeat.status, 200)
    const repeated = (await repeat.json()) as { package: { cents: number } }
    assert.equal(repeated.package.cents, 75000)
    assert.equal(
      (await listPackageOffers()).find((item) => item.id === 'stag')?.cents,
      75000,
    )
  })

  it('keeps a writer from changing invites', async () => {
    const writer = await inviteBot('Rest Writer Two', 'writer')
    const ceo = await inviteBot('Rest Ceo', 'ceo')
    const denied = await deskBotResponse(
      new Request('http://localhost/api/bots/v1/bots', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${writer.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Extra', role: 'writer' }),
      }),
      async () => 'no',
    )
    assert.equal(denied.status, 403)
    const invited = await deskBotResponse(
      new Request('http://localhost/api/bots/v1/bots', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${ceo.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Extra', role: 'reader' }),
      }),
      async () => 'no',
    )
    assert.equal(invited.status, 200)
    const token = ((await invited.json()) as { token?: string }).token
    assert.equal(typeof token, 'string')
    assert.ok(token && token.length > 10)
  })

  it('lets a reader and a writer read an RSVP and only the CEO turn the guest link on', async () => {
    const wedding = sampleWedding()
    wedding.slug = 'bot-rsvp-check'
    wedding.email = 'bot-rsvp@example.com'
    wedding.paid = false
    await writeRsvp(wedding)
    try {
      const reader = await inviteBot('Rsvp Reader', 'reader')
      const writer = await inviteBot('Rsvp Writer', 'writer')
      const ceo = await inviteBot('Rsvp Ceo', 'ceo')
      const listed = await deskBotResponse(
        new Request('http://localhost/api/bots/v1/rsvps', {
          headers: { authorization: `Bearer ${reader.token}` },
        }),
        async () => 'no',
      )
      assert.equal(listed.status, 200)
      const list = (await listed.json()) as { rsvps: { id: string }[] }
      assert.equal(
        list.rsvps.some((item) => item.id === 'bot-rsvp-check'),
        true,
      )

      const one = await deskBotResponse(
        new Request('http://localhost/api/bots/v1/rsvps/bot-rsvp-check', {
          headers: { authorization: `Bearer ${writer.token}` },
        }),
        async () => 'no',
      )
      assert.equal(one.status, 200)
      const body = (await one.json()) as {
        rsvp: {
          partnerOne: string
          partnerTwo: string
          email: string
          eventDate: string
          venue: string
          price: number
          paid: string
          guestLink: string
          guests: number
          repliesIn: number
          meals: { label: string; count: number }[]
          dietaryNotes: { guest: string; note: string }[]
          songs: { title: string }[]
        }
      }
      assert.equal(body.rsvp.partnerOne, 'Sarah')
      assert.equal(body.rsvp.partnerTwo, 'Michael')
      assert.equal(body.rsvp.email, 'bot-rsvp@example.com')
      assert.equal(body.rsvp.eventDate, '2027-06-12')
      assert.match(body.rsvp.venue, /Glenhyrst/)
      assert.equal(body.rsvp.price, 20)
      assert.equal(body.rsvp.paid, 'no')
      assert.equal(body.rsvp.guestLink, 'off')
      assert.ok(body.rsvp.guests > 0)
      assert.ok(body.rsvp.repliesIn > 0)
      assert.ok(
        body.rsvp.meals.some(
          (meal) => meal.label === 'Wild salmon' && meal.count > 0,
        ),
      )
      assert.ok(
        body.rsvp.dietaryNotes.some((note) =>
          note.note.includes('Gluten-free'),
        ),
      )
      assert.ok(body.rsvp.songs.some((song) => song.title === 'September'))

      const writerDenied = await deskBotResponse(
        new Request('http://localhost/api/bots/v1/rsvps/bot-rsvp-check', {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${writer.token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ guestLink: 'on' }),
        }),
        async () => 'no',
      )
      assert.equal(writerDenied.status, 403)
      assert.equal((await readRsvp('bot-rsvp-check'))?.paid, false)

      const readerDenied = await deskBotResponse(
        new Request('http://localhost/api/bots/v1/rsvps/bot-rsvp-check', {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${reader.token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ guestLink: 'on' }),
        }),
        async () => 'no',
      )
      assert.equal(readerDenied.status, 403)

      const opened = await deskBotResponse(
        new Request('http://localhost/api/bots/v1/rsvps/bot-rsvp-check', {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${ceo.token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ guestLink: 'on' }),
        }),
        async () => 'no',
      )
      assert.equal(opened.status, 200)
      const openedBody = (await opened.json()) as {
        rsvp: { paid: string; guestLink: string }
      }
      assert.equal(openedBody.rsvp.paid, 'yes')
      assert.equal(openedBody.rsvp.guestLink, 'on')
      assert.equal((await readRsvp('bot-rsvp-check'))?.paid, true)
    } finally {
      await deleteRsvp('bot-rsvp-check')
    }
  })

  it('reads guest parties and lets a writer move, add, and remove a name', async () => {
    const wedding = sampleWedding()
    wedding.slug = 'bot-guest-list'
    wedding.email = 'bot-guests@example.com'
    await writeRsvp(wedding)
    try {
      const reader = await inviteBot('Guest Reader', 'reader')
      const writer = await inviteBot('Guest Writer', 'writer')
      const listed = await deskBotResponse(
        new Request(
          'http://localhost/api/bots/v1/rsvps/bot-guest-list/guests',
          {
            headers: { authorization: `Bearer ${reader.token}` },
          },
        ),
        async () => 'no',
      )
      assert.equal(listed.status, 200)
      const body = (await listed.json()) as {
        guests: {
          id: string
          name: string
          partyId: string
          attending: string
          meal: string
          dietaryNote: string
          isPlusOne: boolean
          plusOneOf: string | null
        }[]
      }
      const liz = body.guests.find((guest) => guest.id === 'liz')
      const jordan = body.guests.find((guest) => guest.id === 'jordan')
      if (!liz || !jordan) throw new Error('missing guest')
      assert.equal(liz.name, 'Elizabeth Miller')
      assert.equal(liz.partyId, 'miller')
      assert.equal(liz.attending, 'yes')
      assert.equal(liz.meal, 'Wild salmon')
      assert.match(liz.dietaryNote, /Gluten-free/)
      assert.equal(liz.isPlusOne, false)
      assert.equal(jordan.isPlusOne, true)
      assert.equal(jordan.plusOneOf, 'liz')

      const summary = await deskBotResponse(
        new Request('http://localhost/api/bots/v1/rsvps/bot-guest-list', {
          headers: { authorization: `Bearer ${reader.token}` },
        }),
        async () => 'no',
      )
      const summaryBody = (await summary.json()) as {
        rsvp: {
          totals: {
            yes: number
            no: number
            noReply: number
            plusOnes: number
            meals: { label: string; count: number }[]
          }
        }
      }
      assert.equal(summaryBody.rsvp.totals.yes, 6)
      assert.equal(summaryBody.rsvp.totals.no, 1)
      assert.equal(summaryBody.rsvp.totals.noReply, 1)
      assert.equal(summaryBody.rsvp.totals.plusOnes, 1)
      assert.ok(summaryBody.rsvp.totals.meals.some((meal) => meal.count > 0))

      const denied = await deskBotResponse(
        new Request(
          'http://localhost/api/bots/v1/rsvps/bot-guest-list/guests/ada',
          {
            method: 'PATCH',
            headers: {
              authorization: `Bearer ${reader.token}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ partyId: 'miller' }),
          },
        ),
        async () => 'no',
      )
      assert.equal(denied.status, 403)

      const moved = await deskBotResponse(
        new Request(
          'http://localhost/api/bots/v1/rsvps/bot-guest-list/guests/ada',
          {
            method: 'PATCH',
            headers: {
              authorization: `Bearer ${writer.token}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ partyId: 'miller' }),
          },
        ),
        async () => 'no',
      )
      assert.equal(moved.status, 200)
      const movedBody = (await moved.json()) as {
        guests: { id: string; partyId: string }[]
      }
      assert.equal(
        movedBody.guests.find((guest) => guest.id === 'ada')?.partyId,
        'miller',
      )

      const added = await deskBotResponse(
        new Request(
          'http://localhost/api/bots/v1/rsvps/bot-guest-list/guests',
          {
            method: 'POST',
            headers: {
              authorization: `Bearer ${writer.token}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ names: ['Zinnia Quill'] }),
          },
        ),
        async () => 'no',
      )
      assert.equal(added.status, 200)
      const addedBody = (await added.json()) as {
        guests: { id: string; name: string; partyId: string }[]
      }
      const zinnia = addedBody.guests.find(
        (guest) => guest.name === 'Zinnia Quill',
      )
      assert.ok(zinnia)
      assert.ok(zinnia.partyId)
      const quiet = await deskBotResponse(
        new Request('http://localhost/api/bots/v1/rsvps/bot-guest-list', {
          headers: { authorization: `Bearer ${reader.token}` },
        }),
        async () => 'no',
      )
      assert.equal(JSON.stringify(await quiet.json()).includes('Zinnia'), false)

      const removed = await deskBotResponse(
        new Request(
          `http://localhost/api/bots/v1/rsvps/bot-guest-list/guests/${zinnia.id}`,
          {
            method: 'DELETE',
            headers: { authorization: `Bearer ${writer.token}` },
          },
        ),
        async () => 'no',
      )
      assert.equal(removed.status, 200)
    } finally {
      await deleteRsvp('bot-guest-list')
    }
  })
})

describe('rsvp email log over the bot API', { skip: liveBook }, () => {
  it('lists the emails sent for one RSVP at /rsvps/{id}/emails', async () => {
    const ceo = await inviteBot('Email Log Ceo', 'ceo')
    const wedding = sampleWedding()
    wedding.slug = 'email-log-api'
    await writeRsvp(wedding)
    const party = wedding.parties[0]
    assert.ok(party)
    const { sendRsvpEmail } = await import('../rsvp/mailer.server.ts')
    const { invitationEmail } = await import('../rsvp/emails.ts')
    await sendRsvpEmail({
      slug: wedding.slug,
      kind: 'invitation',
      partyId: party.id,
      to: party.email,
      email: invitationEmail(wedding, party, 'https://x/y'),
    })
    const listed = await deskBotResponse(
      new Request(`http://localhost/api/bots/v1/rsvps/${wedding.slug}/emails`, {
        headers: { authorization: `Bearer ${ceo.token}` },
      }),
      async () => 'no',
    )
    assert.equal(listed.status, 200)
    const body = (await listed.json()) as {
      emails: { kind: string; to: string; partyId: string }[]
    }
    assert.equal(body.emails.length, 1)
    assert.equal(body.emails[0]?.kind, 'invitation')
    assert.equal(body.emails[0]?.to, party.email)
    assert.equal(body.emails[0]?.partyId, party.id)
    await deleteRsvp(wedding.slug)
  })

  it('refuses to write to the email record', async () => {
    const ceo = await inviteBot('Email Log Writer', 'ceo')
    const denied = await deskBotResponse(
      new Request('http://localhost/api/bots/v1/rsvps/anything/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${ceo.token}` },
      }),
      async () => 'no',
    )
    assert.equal(denied.status, 404)
  })
})
