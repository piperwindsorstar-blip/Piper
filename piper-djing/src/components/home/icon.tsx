import {
  ArrowRight,
  Check,
  Heart,
  List,
  Mail,
  MapPin,
  Mic,
  SlidersHorizontal,
  Smile,
  Star,
  User,
} from 'lucide-react'

const icons = {
  star: Star,
  arrow: ArrowRight,
  check: Check,
  heart: Heart,
  mail: Mail,
  pin: MapPin,
  mic: Mic,
  list: List,
  sliders: SlidersHorizontal,
  smile: Smile,
  user: User,
}

export function Icon({
  n,
  className = 'h-5 w-5',
  fill = 'none',
}: {
  n: keyof typeof icons | 'insta'
  className?: string
  fill?: string
}) {
  if (n === 'insta') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <rect width="20" height="20" x="2" y="2" rx="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
      </svg>
    )
  }
  const Glyph = icons[n]
  return <Glyph className={className} fill={fill} aria-hidden="true" />
}
