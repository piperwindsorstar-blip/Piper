export function SpinningBadge() {
  return (
    <div
      className="relative grid h-32 w-32 place-items-center"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 120 120"
        className="spin-slow absolute inset-0 h-full w-full"
      >
        <defs>
          <path
            id="circ"
            d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0"
          />
        </defs>
        <text
          fill="#FF1493"
          fontSize="10.5"
          letterSpacing="3.2"
          fontFamily="JetBrains Mono, monospace"
        >
          <textPath href="#circ">
            NOW BOOKING · BRANTFORD, ON · NOW BOOKING ·
          </textPath>
        </text>
      </svg>
      <span className="grid h-16 w-16 place-items-center rounded-full bg-neon font-display text-xl font-extrabold shadow-[0_0_30px_rgba(255,0,127,0.6)]">
        P
      </span>
    </div>
  )
}
