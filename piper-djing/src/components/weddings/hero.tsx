import { CHECKLIST, RINGS_LOGO_ALT, RINGS_LOGO_SRC } from './content.ts'
import { DateCheckForm } from './date-check-form.tsx'
import { ButtonOutline, ButtonPrimary } from './ui.tsx'

export function Hero() {
  return (
    <section className="bp-pad">
      <div className="bp-hero min-h-0!">
        <div className="min-w-0">
          <img
            src={RINGS_LOGO_SRC}
            alt={RINGS_LOGO_ALT}
            width={1137}
            height={1088}
            className="mb-6 block h-36 w-auto sm:h-44"
            fetchPriority="high"
          />
          <p className="bp-k bp-town__accent">Brantford wedding DJ</p>
          <h1 className="bp-h1 mt-4 text-[clamp(2.3rem,5.4vw,4.4rem)]">
            {'Your wedding date is only available '}
            <span className="bp-pink">once.</span>
            {' Lock in your Brantford wedding DJ.'}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed font-medium">
            Exciting dance floors, seamless track selection, and zero stress
            for Brantford and area couples. Check your date in 30 seconds and hear
            back within one business day.
          </p>
          <ul className="mt-6 grid gap-2 font-semibold sm:grid-cols-2">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="bp-town__accent" aria-hidden="true">
                  ✦
                </span>
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonPrimary>Check Wedding Dates</ButtonPrimary>
            <ButtonOutline>Explore Wedding Packages</ButtonOutline>
          </div>
        </div>
        <div className="relative min-w-0">
          <DateCheckForm />
        </div>
      </div>
    </section>
  )
}
