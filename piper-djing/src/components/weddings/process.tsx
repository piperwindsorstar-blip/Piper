import { STEPS } from './content.ts'
import { Eyebrow } from './ui.tsx'

export function Process() {
  return (
    <section id="process" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-24">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-3 font-display text-4xl font-bold text-balance md:text-5xl">
            Four steps to a stress-free night.
          </h2>
          <p className="mt-5 max-w-sm text-soft">
            Custom playlists, no awkward transitions, and clear coordination
            with your planner, venue and photographer.
          </p>
        </div>
        <ol className="border-l border-ink">
          {STEPS.map((step, index) => (
            <li
              key={step.t}
              className="relative border-b border-line py-7 pl-10 last:border-b-0"
            >
              <span className="absolute top-9 -left-[7px] h-3.5 w-3.5 rounded-full border border-ink bg-sky" />
              <p className="font-mono text-xs tracking-[0.2em] text-violet uppercase">
                Step {index + 1}
              </p>
              <h3 className="mt-1 font-display text-2xl font-semibold text-balance">
                {step.t}
              </h3>
              <p className="mt-2 max-w-lg text-soft">{step.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
