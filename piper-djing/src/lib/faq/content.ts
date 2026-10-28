/**
 * The /faq page, word for word from Piper's FAQ draft. The draft's
 * "ADD WHEN INSURED" section is left out on purpose: Piper is not insured
 * yet, so the site must not say so anywhere.
 *
 * In answers, **text** is bold, and the email address and "date checker"
 * become links when shown.
 */

export type FaqItem = { q: string; a: string | string[] }
export type FaqSection = { title: string; items: FaqItem[] }

export const FAQ_INTRO =
  'Everything couples usually ask before booking. Something else on your mind? Email PiperPWeddingDJ@gmail.com — I reply personally within one business day.'

export const FAQ_SECTIONS: FaqSection[] = [
  {
    title: 'Booking & Dates',
    items: [
      {
        q: 'How do we check if our date is available?',
        a: 'Use the date checker on this site — it takes about 30 seconds. An open date continues straight to an inquiry, and you’ll hear back within one business day. You can also email PiperPWeddingDJ@gmail.com directly.',
      },
      {
        q: 'How far in advance should we book?',
        a: 'As soon as your venue is confirmed. Popular Saturdays in summer and early fall go first, and a date is only available once.',
      },
      {
        q: 'Can you hold our date while we decide?',
        a: 'Yes. I can hold your date for 30 days while you finalize things. Once the deposit is in, the date is booked.',
      },
      {
        q: 'How do we book?',
        a: 'Four steps: check your date, have one planning meeting, build the night together (music brief, timeline, mic cues, lighting — all confirmed in writing), then celebrate. A 30% deposit secures your date.',
      },
      {
        q: 'What is the deposit?',
        a: '30% of your package, rounded to the nearest $25. Your booking confirmation lays out the balance timing.',
      },
    ],
  },
  {
    title: 'Packages & Pricing',
    items: [
      {
        q: 'What packages do you offer?',
        a: [
          '**The Main Event — $1,650.** Full wedding day, ceremony audio through the reception, up to 1:00 a.m.',
          '**The After Party — $1,550.** Reception only, up to 1:00 a.m.',
          '**The Pre-Party — $700.** Stag and doe, up to 1:00 a.m.',
          '**The Aisle — $350, paid in full.** Ceremony only.',
          'Book The Main Event and The Pre-Party together and save $250.',
        ],
      },
      {
        q: 'What’s included?',
        a: 'The Main Event and The After Party include wireless microphones, two speakers, dancefloor lighting, backup equipment, one planning meeting, and light MC duties. The Pre-Party includes two speakers, one wireless microphone, dancefloor lighting, backup equipment, and DJ and MC duties. The Aisle includes ceremony audio with one speaker and one wireless microphone for the officiant, backup equipment, and one planning meeting — no dancefloor lighting or MC.',
      },
      {
        q: 'What costs extra?',
        a: 'Wired uplights are $15 each. A separate ceremony venue is $75 (a third venue is not offered). Parking is $25 if I have to pay for it. Overtime after 1:00 a.m. is $250 an hour.',
      },
      {
        q: 'Do you charge for travel?',
        a: 'Travel is the one-way driving distance from Brantford. Under 50 km is included. From 50 to 100 km is $110. Over 100 km, up to 200 km, is $250. Over 200 km is $250 plus a hotel. The Aisle, ceremony only, includes travel.',
      },
    ],
  },
  {
    title: 'Music & Planning',
    items: [
      {
        q: 'Can we choose the music?',
        a: 'Absolutely — it’s your night. After booking you get access to a planning portal where you set your must-play songs, your do-not-play list, and your requested songs, and we build custom playlists around your crowd.',
      },
      {
        q: 'Do you take requests on the night?',
        a: 'Yes. Guest requests are welcome, and your do-not-play list is always respected.',
      },
      {
        q: 'What kind of music do you play?',
        a: 'Whatever your crowd loves — pop and dance, throwbacks, rock, country, Persian, Turkish, and more. I DJ multicultural celebrations and build the music around every part of the night, from the ceremony to the last song.',
      },
      {
        q: 'Do you MC?',
        a: 'Light MC duties are included with The Main Event, The After Party, and The Pre-Party — introductions, announcements, and keeping the timeline moving. The Aisle (ceremony only) does not include MC services.',
      },
      {
        q: 'Do we meet before the wedding?',
        a: 'Yes. Every booking includes one planning meeting about your people, your vibe, and what a perfect night looks like to you. Music, timeline, mic cues, and lighting are all confirmed in writing before the day.',
      },
    ],
  },
  {
    title: 'The Night & Setup',
    items: [
      {
        q: 'What time do you play until?',
        a: 'Up to 1:00 a.m. is included in every package. Overtime after 1:00 a.m. is $250 an hour.',
      },
      {
        q: 'What do you need from the venue?',
        a: 'Roughly a 10×10 ft area for the booth, plus access to power. I arrive early, set up, and run a sound check before guests arrive.',
      },
      {
        q: 'Do you bring backup equipment?',
        a: 'Yes. Backup equipment is included in every package. I treat every event like a production — the gear, the timing, the people, and the backup plan are all handled before the first song, so you never see the work behind it.',
      },
      {
        q: 'Do you do ceremony audio too?',
        a: 'Yes. The Main Event covers ceremony audio through the reception. If you only need the ceremony, The Aisle covers it on its own.',
      },
    ],
  },
  {
    title: 'Where & What Else',
    items: [
      {
        q: 'Where do you perform?',
        a: 'Brantford, Hamilton, Cambridge, Paris, Woodstock, Burlington, Guelph, Oakville, and surrounding areas. Getting married somewhere else? I’ll scout the room and plan with your venue ahead of time.',
      },
      {
        q: 'What other events do you DJ?',
        a: 'Private events (milestone birthdays, anniversaries, retirement parties, backyard bashes), stag and does, charity and community fundraisers, club nights, and corporate parties. Every kind of night, one standard.',
      },
    ],
  },
]

export const FAQ_CLOSING = {
  title: 'Ready to check your date?',
  text: 'Use the date checker on this site or email PiperPWeddingDJ@gmail.com. No pressure, no pushy sales talk — just a real conversation with a DJ who cares.',
}

/** Plain text, for the structured data. */
export function faqPlain(answer: string | string[]): string {
  const lines = Array.isArray(answer) ? answer : [answer]
  return lines.map((line) => line.replace(/\*\*/g, '')).join(' ')
}

export function faqJsonLd(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_SECTIONS.flatMap((section) =>
      section.items.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: faqPlain(item.a) },
      })),
    ),
  })
}
