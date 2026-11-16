import { VENUES_PLAYED } from './content.ts'

/** The pink band under the hero: venues Piper has played. */
export function VenueBand() {
  return (
    <section aria-label="Venues I’ve played" className="bp-band">
      <ul>
        <li>
          <strong>Venues I’ve played</strong>
        </li>
        {VENUES_PLAYED.map((venue) => (
          <li key={venue}>{venue}</li>
        ))}
      </ul>
    </section>
  )
}
