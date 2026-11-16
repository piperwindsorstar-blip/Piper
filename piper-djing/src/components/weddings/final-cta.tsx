import { ButtonOutline, ButtonPrimary } from './ui.tsx'

export function FinalCta() {
  return (
    <section className="mx-5 mb-20 overflow-hidden rounded-3xl border border-ink bg-linear-to-br from-blush via-lilac to-ice px-5 py-20 text-center shadow-[8px_8px_0_0_#1C1533] md:mx-auto md:max-w-6xl">
      <h2 className="mx-auto max-w-2xl font-display text-4xl font-extrabold text-balance md:text-6xl">
        Don’t leave your dance floor to chance.
      </h2>
      <p className="mx-auto mt-4 max-w-md text-soft">
        Tell Piper your date and get a reply within one business day.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <ButtonPrimary>Check Wedding Dates</ButtonPrimary>
        <ButtonOutline className="bg-paper">
          Explore Wedding Packages
        </ButtonOutline>
      </div>
    </section>
  )
}
