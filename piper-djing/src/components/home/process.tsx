import { STEPS } from './content.ts'
import { Eyebrow } from './ui.tsx'

export function Process() {
  return (
    <section
      id="process"
      className="scroll-mt-24 border-y border-white/10 bg-ink-900"
    >
      <div className="mx-auto grid max-w-7xl gap-14 px-5 py-24 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Eyebrow>How I work</Eyebrow>
          <h2 className="mt-4 font-display text-4xl leading-tight font-bold text-balance md:text-5xl">
            Planning is where the magic starts.
          </h2>
          <p className="mt-5 max-w-sm text-white/65">
            Same clear process every time, adapted to you. You always know what
            happens next.
          </p>
        </div>
        <ol className="relative border-l border-neon/40">
          {STEPS.map(([title, detail], index) => (
            <li key={title} className="group relative pb-10 pl-10 last:pb-0">
              <span className="absolute top-2 -left-[7px] h-3.5 w-3.5 rounded-full border border-neon bg-ink-900 transition group-hover:bg-neon group-hover:shadow-[0_0_16px_#FF007F]" />
              <p className="font-mono text-xs tracking-[0.2em] text-hot uppercase">
                Step {index + 1}
              </p>
              <h3 className="mt-1 font-display text-2xl font-bold">{title}</h3>
              <p className="mt-2 max-w-lg text-white/65">{detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
