import { Link } from '@tanstack/react-router'
import { LINKS, LOGO_SRC } from './content.ts'
import { CpdjaBadge } from '../cpdja-badge.tsx'
import { TOWN_LIST } from '../weddings/towns.ts'

export function SiteFooter() {
  return (
    <footer className="border-t border-white/15 bg-black">
      <div className="bp-pad bp-footer">
        <div>
          <img src={LOGO_SRC} alt="" className="h-16 w-auto" loading="lazy" />
          <p className="mt-3 font-bold text-white">DJ Piper P</p>
          <p>Wedding & event DJ · Brantford, Ontario</p>
          <div className="mt-3">
            <CpdjaBadge />
          </div>
        </div>
        <nav aria-labelledby="footer-site" className="flex flex-col items-start">
          <h2 id="footer-site">Site</h2>
          <Link to="/weddings">Weddings</Link>
          <Link to="/faq">FAQ</Link>
          <Link to="/wedding-vendors">Vendors</Link>
          <Link to="/contact">Contact</Link>
          <a href={LINKS.review} target="_blank" rel="noreferrer">
            Google reviews
          </a>
        </nav>
        <nav aria-labelledby="footer-couples" className="flex flex-col items-start">
          <h2 id="footer-couples">Couples</h2>
          <Link to="/portal">Couples sign in</Link>
          <Link to="/rsvp">RSVP</Link>
          <h2 id="footer-contact" className="mt-4">
            Contact
          </h2>
          <a
            href={`mailto:${LINKS.email}`}
            className="inline-flex min-h-11 items-center break-all text-white normal-case underline underline-offset-4"
          >{`Email Piper: ${LINKS.email ?? ''}`}</a>
          <a href={LINKS.insta} target="_blank" rel="noreferrer">
            @DJ_PIPERP
          </a>
          {LINKS.facebook ? (
            <a href={LINKS.facebook} target="_blank" rel="noreferrer">
              Facebook
            </a>
          ) : null}
        </nav>
        <nav aria-labelledby="footer-towns" className="flex flex-col items-start">
          <h2 id="footer-towns">Wedding DJ in</h2>
          {TOWN_LIST.map((town) => (
            <a key={town.path} href={town.path}>
              {town.name}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}
