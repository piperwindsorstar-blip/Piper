import { useRef, useState } from 'react'
import { PILLARS, SCENES } from './content.ts'

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
    <section id="promise" className="bp-full bp-full--dim bp-pad scroll-mt-24">
      <img src={SCENES.promise} alt="" className="bp-bg" loading="lazy" sizes="100vw" />
      <p className="bp-k bp-pink">The Piper P Promise</p>
      <h2 className="mt-3 max-w-2xl text-xl font-bold text-balance">
        Five things you get with every event, big or small.
      </h2>
      <div className="bp-promise">
        <div
          role="tablist"
          aria-label="The Piper P Promise"
          className="bp-words"
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
                className="bp-word"
              >
                {item.k}
              </button>
            )
          })}
        </div>
        <div
          id="pillar-panel"
          role="tabpanel"
          aria-labelledby={`pillar-tab-${active}`}
          className="bp-promise__panel"
        >
          <h3 className="bp-h3">{pillar.h}</h3>
          <p className="mt-4 text-lg leading-relaxed font-medium">{pillar.d}</p>
          <ul className="mt-5">
            {pillar.pts.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
