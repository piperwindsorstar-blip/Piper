import { useEffect, useRef, useState } from 'react'

/**
 * A review quote that stays fully readable: long ones are clamped to a few
 * lines with "Read more" to open them in place. The whole text is always in
 * the page, so search engines and screen readers get all of it.
 */
export function ReviewQuote({
  text,
  className,
  buttonClassName,
  lines = 6,
}: {
  text: string
  className: string
  buttonClassName: string
  lines?: 5 | 6
}) {
  const ref = useRef<HTMLQuoteElement>(null)
  const [open, setOpen] = useState(false)
  const [long, setLong] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => {
      if (open) return
      setLong(element.scrollHeight > element.clientHeight + 1)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [open, text])

  const clamp = lines === 5 ? 'line-clamp-5' : 'line-clamp-6'
  return (
    <div className="flex-1">
      <blockquote ref={ref} className={`${className} ${open ? '' : clamp}`}>
        {text}
      </blockquote>
      {long || open ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className={`mt-2 min-h-11 font-semibold hover:underline ${buttonClassName}`}
        >
          {open ? 'Show less' : 'Read more'}
        </button>
      ) : null}
    </div>
  )
}
