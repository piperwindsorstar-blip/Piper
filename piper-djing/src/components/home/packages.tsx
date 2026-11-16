import { Link } from '@tanstack/react-router'
import type { PackageId } from '../../lib/crm/defaults.ts'
import { publicPackagePrice } from '../../lib/crm/packages.ts'
import type { PackageOffer } from '../../lib/crm/packages.ts'
import { PACKAGE_CENTS } from '../../lib/piper/rules.ts'
import { TIERS } from '../weddings/content.ts'
import { LINKS } from './content.ts'

const TIER_IDS = ['full', 'reception', 'stag', 'ceremony'] as const

/**
 * The wedding packages as four big rows. Names come from the weddings page
 * and prices from the Desk, the same way the weddings page prices them.
 */
export function Packages({ packages }: { packages: PackageOffer[] }) {
  const centsFor = (id: PackageId) =>
    packages.find((item) => item.id === id)?.cents ?? PACKAGE_CENTS[id]
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
          const id = TIER_IDS[index] ?? 'full'
          const full = publicPackagePrice(id, centsFor(id))
          // "$350 paid in full" shows as the price, with the rest beside the name.
          const [price = full, ...rest] = full.split(' ')
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
