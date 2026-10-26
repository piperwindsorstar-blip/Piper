import { Children, useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

/**
 * Review cards as a carousel: 3 across on desktop, 2 on tablets, 1 on phones.
 * Built on CSS scroll-snap, so swiping works natively and every card is in the
 * server HTML. Arrows and dots move a page at a time and loop. It advances
 * every 6 seconds until a visitor hovers, focuses or touches it, and never
 * moves on its own (or slides) for visitors who ask for reduced motion.
 * Three reviews or fewer are a plain row.
 */

const AUTO_MS = 6000

const TONES = {
  dark: {
    arrow:
      'border-white/15 bg-white/[0.06] text-white hover:border-neon hover:text-hot focus-visible:outline-hot',
    dot: 'bg-white/30 hover:bg-white/60',
    focus: 'focus-visible:outline-hot',
  },
  light: {
    arrow:
      'border-line bg-paper text-ink hover:border-neon hover:text-neon focus-visible:outline-neon',
    dot: 'bg-line hover:bg-soft/50',
    focus: 'focus-visible:outline-neon',
  },
} as const

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function ReviewCarousel({
  children,
  tone,
  label = 'Reviews',
}: {
  children: ReactNode
  tone: 'dark' | 'light'
  label?: string
}) {
  const items = Children.toArray(children)
  const count = items.length
  const look = TONES[tone]
  const track = useRef<HTMLUListElement>(null)
  const [perView, setPerView] = useState(3)
  const [page, setPage] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [touched, setTouched] = useState(false)
  const [still, setStill] = useState(true)

  const pages = Math.max(1, Math.ceil(count / perView))

  const geometry = useCallback(() => {
    const list = track.current
    const cards = list ? (Array.from(list.children) as HTMLElement[]) : []
    const first = cards[0]
    const second = cards[1]
    if (!list || !first) return null
    const step = second ? second.offsetLeft - first.offsetLeft : first.offsetWidth
    const gap = step - first.offsetWidth
    const view = Math.max(1, Math.round((list.clientWidth + gap) / step))
    return { list, cards, first, step, view }
  }, [])

  const measure = useCallback(() => {
    const g = geometry()
    if (!g) return
    setPerView(g.view)
    const total = Math.max(1, Math.ceil(count / g.view))
    const atEnd = g.list.scrollLeft >= g.list.scrollWidth - g.list.clientWidth - 4
    const index = Math.round(g.list.scrollLeft / g.step)
    setPage(atEnd ? total - 1 : Math.min(total - 1, Math.round(index / g.view)))
  }, [count, geometry])

  const goTo = useCallback(
    (target: number) => {
      const g = geometry()
      if (!g) return
      const total = Math.max(1, Math.ceil(count / g.view))
      const next = ((target % total) + total) % total
      const index = Math.min(next * g.view, Math.max(0, count - g.view))
      const card = g.cards[index]
      if (!card) return
      g.list.scrollTo({
        left: card.offsetLeft - g.first.offsetLeft,
        behavior: reducedMotion() ? 'auto' : 'smooth',
      })
      setPage(next)
    },
    [count, geometry],
  )

  useEffect(() => {
    if (count <= 3) return
    setStill(reducedMotion())
    measure()
    const list = track.current
    if (!list) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    list.addEventListener('scroll', onScroll, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => {
      list.removeEventListener('scroll', onScroll)
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [count, measure])

  const paused = still || hovered || focused || touched
  useEffect(() => {
    if (count <= 3 || paused) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') goTo(page + 1)
    }, AUTO_MS)
    return () => window.clearInterval(timer)
  }, [count, paused, page, goTo])

  if (count <= 3) {
    const cols = count === 3 ? 'md:grid-cols-3' : count === 2 ? 'md:grid-cols-2' : ''
    return (
      <ul className={`grid gap-5 ${cols}`}>
        {items.map((item, index) => (
          <li key={index} className="flex">
            {item}
          </li>
        ))}
      </ul>
    )
  }

  const step = (direction: 1 | -1) => {
    setTouched(true)
    goTo(page + direction)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      step(1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      step(-1)
    }
  }
  const arrow = `grid h-11 w-11 shrink-0 place-items-center rounded-full border transition focus-visible:outline-2 focus-visible:outline-offset-2 ${look.arrow}`
  const prev = (
    <button type="button" className={arrow} aria-label="Previous reviews" onClick={() => step(-1)}>
      <Chevron flip />
    </button>
  )
  const next = (
    <button type="button" className={arrow} aria-label="Next reviews" onClick={() => step(1)}>
      <Chevron />
    </button>
  )

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className="review-carousel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
      }}
      onKeyDown={onKeyDown}
    >
      <div className="relative md:px-16">
        <div className="absolute top-1/2 left-0 hidden -translate-y-1/2 md:block">{prev}</div>
        <ul
          ref={track}
          className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain"
          aria-live={paused ? 'polite' : 'off'}
          onPointerDown={() => setTouched(true)}
          onTouchStart={() => setTouched(true)}
          onWheel={(event) => {
            if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) setTouched(true)
          }}
        >
          {items.map((item, index) => (
            <li
              key={index}
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${count}`}
              className="flex w-full shrink-0 snap-start sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-2.5rem)/3)]"
            >
              {item}
            </li>
          ))}
        </ul>
        <div className="absolute top-1/2 right-0 hidden -translate-y-1/2 md:block">{next}</div>
      </div>
      <div className="mt-6 flex items-center justify-center gap-4">
        <div className="md:hidden">{prev}</div>
        <div className="flex flex-wrap items-center justify-center">
          {Array.from({ length: pages }, (_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Go to slide ${index + 1} of ${pages}`}
              aria-current={index === page ? 'true' : undefined}
              onClick={() => {
                setTouched(true)
                goTo(index)
              }}
              className={`grid h-11 min-w-8 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 ${look.focus}`}
            >
              <span
                className={`block h-2.5 rounded-full transition-all motion-reduce:transition-none ${index === page ? 'w-6 bg-neon' : `w-2.5 ${look.dot}`}`}
              />
            </button>
          ))}
        </div>
        <div className="md:hidden">{next}</div>
      </div>
    </div>
  )
}

function Chevron({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${flip ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}
