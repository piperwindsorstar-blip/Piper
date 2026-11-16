import { CHECKLIST, RINGS_LOGO_ALT, RINGS_LOGO_SRC } from './content.ts'
import { DateCheckForm } from './date-check-form.tsx'
import { ButtonOutline, ButtonPrimary, Eyebrow } from './ui.tsx'

export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-10 pb-16 lg:grid-cols-2 lg:gap-16 lg:pt-14 lg:pb-24">
      <div className="min-w-0">
        <img
          src={RINGS_LOGO_SRC}
          alt={RINGS_LOGO_ALT}
          width={1137}
          height={1088}
          className="mb-7 block h-28 w-auto sm:h-32"
        />
        <Eyebrow>Brantford wedding DJ</Eyebrow>
        <h1 className="mt-4 font-display text-[clamp(2.4rem,5vw,3.9rem)] leading-[1.06] text-balance">
          {'Your wedding date is only available '}
          <em className="text-neon">once.</em>
          {' Lock in your Brantford wedding DJ.'}
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-soft">
          Exciting dance floors, seamless track selection, and zero stress
          for Brantford and area couples. Check your date in 30 seconds and hear
          back within one business day.
        </p>
        <ul className="wed-checks mt-6 grid gap-2.5 sm:grid-cols-2">
          {CHECKLIST.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonPrimary>Check Wedding Dates</ButtonPrimary>
          <ButtonOutline>Explore Wedding Packages</ButtonOutline>
        </div>
      </div>
      <div className="min-w-0">
        <div className="wed-arch">
          <img
            src="/photos/wedding-first-dance.jpg"
            alt="A couple sharing their first dance"
            width={1024}
            height={1024}
            fetchPriority="high"
            sizes="(min-width: 1024px) 34rem, 100vw"
          />
        </div>
        <div className="relative mx-4 -mt-32 sm:mx-10">
          <DateCheckForm />
        </div>
      </div>
    </section>
  )
}
