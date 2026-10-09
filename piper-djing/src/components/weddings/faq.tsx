import { useState } from 'react'
import { FAQ } from './content.ts'
import { Icon } from './icon.tsx'
import { Eyebrow } from './ui.tsx'

export function Faq() {
  const [open, setOpen] = useState(0)
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-5 pb-24">
      <Eyebrow>Good to know</Eyebrow>
      <h2 className="mt-3 mb-8 font-display text-4xl font-bold text-balance">
        Questions couples ask.
      </h2>
      <div className="divide-y divide-line border-y border-line">
        {FAQ.map(([question, answer], index) => (
          <div key={question}>
            <button
              type="button"
              onClick={() => setOpen(open === index ? -1 : index)}
              aria-expanded={open === index}
              className="flex w-full items-center justify-between gap-6 py-5 text-left font-display text-lg font-semibold hover:text-violet"
            >
              {question}
              <Icon
                n="plus"
                className={`h-5 w-5 shrink-0 text-neon transition ${open === index ? 'rotate-45' : ''}`}
              />
            </button>
            {open === index ? (
              <p className="max-w-2xl pb-6 leading-relaxed text-soft">
                {answer}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
