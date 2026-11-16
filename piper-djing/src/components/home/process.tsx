import { STEPS } from './content.ts'

export function Process() {
  return (
    <section id="process" className="bp-pinkbg scroll-mt-24">
      <div className="bp-pad pb-8">
        <p className="bp-k">How I work</p>
        <h2 className="bp-h2 mt-3 text-white">
          Planning is where the magic starts.
        </h2>
        <p className="mt-4 max-w-md font-semibold">
          Same clear process every time, adapted to you. You always know what
          happens next.
        </p>
      </div>
      <ol className="bp-steps">
        {STEPS.map(([title, detail], index) => (
          <li key={title} className="bp-step">
            <span className="bp-step__n" aria-hidden="true">
              {index + 1}
            </span>
            <h3 className="bp-step__t">{title}</h3>
            <p>{detail}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
