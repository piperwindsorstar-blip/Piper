export function DjBubble({
  text,
  reserve = false,
}: {
  text: string
  reserve?: boolean
}) {
  if (!text && !reserve) return null
  return (
    <div
      className={`portal-motion mt-6 flex min-h-16 items-end gap-3 transition-opacity duration-200 ${text ? 'opacity-100' : 'opacity-0'}`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--pink)] text-sm font-bold text-[#0d0d0d]">
        PP
      </span>
      <p className="rounded-[22px] rounded-bl-[6px] bg-[var(--field-2)] px-4 py-3 text-[15px] leading-relaxed">
        {text || ' '}
      </p>
    </div>
  )
}
