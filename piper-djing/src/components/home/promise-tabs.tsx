import { useRef, useState } from 'react'
import { PILLARS } from './content.ts'
import { Icon } from './icon.tsx'
import { Eyebrow } from './ui.tsx'

export function PromiseTabs() {
  const [active, setActive] = useState(0)
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const pillar = PILLARS[active]

  function move(next: number) {
    const index = (next + PILLARS.length) % PILLARS.length
    setActive(index)
    buttons.current[index]?.focus()
  }

  return (
    <section
      id="promise"
      className="scroll-mt-24 border-y border-white/10 bg-ink-900"
    >
      <div className="mx-auto max-w-7xl px-5 py-24">
        <Eyebrow>The Piper P Promise</Eyebrow>
        <h2 className="mt-4 max-w-4xl font-display text-4xl leading-tight font-bold text-balance md:text-6xl">
          Five things you get with <span className="text-neon">every</span>{' '}
          event, big or small.
        </h2>
        <div className="mt-12 grid gap-6 lg:grid-cols-[320px_1fr]">
          <div
            role="tablist"
            aria-label="The Piper P Promise"
            className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible"
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault()
                move(active + 1)
              }
              if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault()
                move(active - 1)
              }
              if (event.key === 'Home') {
                event.preventDefault()
                move(0)
              }
              if (event.key === 'End') {
                event.preventDefault()
                move(PILLARS.length - 1)
              }
            }}
          >
            {PILLARS.map((item, index) => {
              const selected = active === index
              return (
                <button
                  key={item.k}
                  ref={(node) => {
                    buttons.current[index] = node
                  }}
                  id={`pillar-tab-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="pillar-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(index)}
                  className={`group flex shrink-0 items-center gap-3 rounded-2xl border px-5 py-4 text-left transition ${
                    selected
                      ? 'border-neon bg-neon/10 shadow-[0_0_32px_rgba(255,0,127,0.25)]'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/30'
                  }`}
                >
                  <span
                    className={`grid h-10 w-10 place-items-center rounded-full transition ${
                      selected ? 'bg-neon text-white' : 'bg-white/5 text-hot'
                    }`}
                  >
                    <Icon n={item.i} />
                  </span>
                  <span className="font-display text-lg font-bold">
                    {item.k}
                  </span>
                </button>
              )
            })}
          </div>
          <div
            id="pillar-panel"
            role="tabpanel"
            aria-labelledby={`pillar-tab-${active}`}
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-white/[0.06] to-transparent p-8 backdrop-blur-xl md:p-12"
          >
            <div className="pulse-glow pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-neon/25 blur-3xl" />
            <p className="relative font-mono text-xs tracking-[0.22em] text-hot uppercase">
              {pillar.k}
            </p>
            <h3 className="relative mt-3 font-display text-4xl leading-tight font-extrabold text-balance md:text-5xl">
              {pillar.h}
            </h3>
            <p className="relative mt-5 max-w-xl text-lg leading-relaxed text-white/75">
              {pillar.d}
            </p>
            <ul className="relative mt-8 space-y-3 border-t border-white/10 pt-6">
              {pillar.pts.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 text-white/85"
                >
                  <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-neon/15 text-neon">
                    <Icon n="check" className="h-3 w-3" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
