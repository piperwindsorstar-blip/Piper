import { CHECKLIST } from './content.ts'
import { DateCheckForm } from './date-check-form.tsx'
import { Icon, Stars } from './icon.tsx'
import { ButtonOutline, ButtonPrimary } from './ui.tsx'

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-linear-to-b from-ice/70 via-paper to-paper">
      <div className="grid-lines grid-fade absolute inset-0 -z-10 opacity-60" />
      <div className="absolute -top-32 -right-32 -z-10 h-96 w-96 rounded-full bg-lilac blur-3xl" />
      <div className="absolute top-48 -left-24 -z-10 h-72 w-72 rounded-full bg-blush blur-3xl" />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-14 pb-20 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-3 rounded-full border border-line bg-paper px-4 py-2">
            <Stars />
            <span className="text-sm font-medium text-soft">
              5-star Google reviews
            </span>
          </div>
          <h1 className="mt-6 font-display text-[clamp(2.5rem,6vw,4.9rem)] leading-[0.98] font-extrabold tracking-tight text-balance">
            Your wedding date is only available{' '}
            <span className="font-serif font-normal text-neon italic">
              once.
            </span>{' '}
            Lock in the DJ.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-soft">
            Packed dance floors, flawless transitions and zero stress for
            Brantford and area couples. Check your date in 30 seconds and hear
            back within one business day.
          </p>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex items-center gap-2 font-medium">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-blush text-neon">
                  <Icon n="check" className="h-3 w-3" />
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
