import { Link } from '@tanstack/react-router'
import { TIERS } from '../weddings/content.ts'
import { LINKS } from './content.ts'

/** The wedding packages as four big rows, priced from the weddings page. */
export function Packages() {
  return (
    <section id="packages" aria-labelledby="home-packages-title" className="scroll-mt-24">
      <div className="bp-pad pb-8">
        <p className="bp-k bp-pink">Weddings</p>
        <h2 id="home-packages-title" className="bp-h2 mt-3">
          Pick your <br />
          <span className="bp-pink">package.</span>
        </h2>
      </div>
      <ul>
        {TIERS.map((tier, index) => {
          // "$350 paid in full" shows as the price, with the rest beside the name.
          const [price = tier.price, ...rest] = tier.price.split(' ')
          const note = rest.join(' ')
          return (
            <li key={tier.n} className={`bp-row ${tier.hl ? 'bp-row--on' : ''}`}>
              <span className="bp-row__n" aria-hidden="true">
                {`0${index + 1}`}
              </span>
              <div>
                <h3 className="bp-row__name">{tier.n}</h3>
                <p className="bp-row__plain">
                  {note ? `${tier.plain} · ${note}` : tier.plain}
                </p>
              </div>
              <p className="bp-row__price">{price}</p>
              <a
                href="#check-a-date"
                aria-label={`Check a date for ${tier.n}`}
                className={`bp-btn bp-btn--small bp-row__cta ${tier.hl ? 'bp-btn--white' : 'bp-btn--line'}`}
              >
                Check a date
              </a>
            </li>
          )
        })}
      </ul>
      <div className="bp-pad flex flex-wrap gap-3 pt-8">
        <Link to={LINKS.weddings} hash="packages" className="bp-btn">
          See what’s included
        </Link>
        <a href="#check-a-date" className="bp-btn bp-btn--line md:hidden">
          Check a date
        </a>
      </div>
    </section>
  )
}
