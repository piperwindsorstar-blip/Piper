/**
 * The five invitation templates a couple picks from. One definition drives the
 * emails and the guest RSVP page, so the card, the letter and the page can
 * never drift apart.
 *
 * Everything here is pure: colours, type stacks, dividers and the photo box.
 * No web font is ever required — the display faces are stacks that fall back to
 * Georgia or the system sans-serif, and every rule is inline CSS.
 */

export type RsvpTemplateId =
  'ivory' | 'minimal' | 'blush' | 'kraft' | 'black-tie'

export const TEMPLATE_IDS: RsvpTemplateId[] = [
  'ivory',
  'minimal',
  'blush',
  'kraft',
  'black-tie',
]

export const DEFAULT_TEMPLATE: RsvpTemplateId = 'ivory'

export function parseTemplateId(value: unknown): RsvpTemplateId {
  return typeof value === 'string' && (TEMPLATE_IDS as string[]).includes(value)
    ? (value as RsvpTemplateId)
    : DEFAULT_TEMPLATE
}

export type RsvpButton = {
  bg: string
  fg: string
  radius: string
  border: string
}

export type RsvpWeb = {
  /** Whether the guest page reads as a light page. */
  light: boolean
  /** Inline CSS custom properties the guest portal already understands. */
  vars: Record<string, string>
  /** Page backdrop, as a CSS background value. */
  backdrop: string
  /** Ink for the logo mark: the light-page logo or the white mark. */
  logoDark: boolean
}

export type RsvpSkin = {
  /** The paper. */
  card: string
  cardBorder: string
  cardRadius: string
  /** A rule printed around the letter, for the kraft card's deckled look. */
  innerRule: string
  backdrop: string
  texture: string
  /** Type. */
  ink: string
  body: string
  quiet: string
  accent: string
  hairline: string
  displayFont: string
  bodyFont: string
  labelLetter: string
  labelTransform: 'uppercase' | 'none'
  labelStyle: 'normal' | 'italic'
  /** Names set like handwriting where the device has a script face. */
  scriptNames: boolean
  nameSize: string
  nameWeight: string
  headingWeight: string
  /** The quiet line under the card, on the backdrop. */
  footerInk: string
  button: RsvpButton
  divider: 'flourish' | 'hairline' | 'floral' | 'deckle' | 'gold-rule'
  web?: RsvpWeb
}

export type RsvpTemplate = {
  id: RsvpTemplateId
  name: string
  blurb: string
  /** Three swatches for the picker chip. */
  swatch: [string, string, string]
  /** Short label for the card in the picker. */
  label: string
  skin: RsvpSkin
}

const SERIF = "Georgia,'Times New Roman',serif"
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif"
const SCRIPT = `'Snell Roundhand','Apple Chancery','Lucida Handwriting',${SERIF}`

export const RSVP_TEMPLATES: RsvpTemplate[] = [
  {
    id: 'ivory',
    name: 'Classic Ivory',
    blurb: 'Cream paper, serif names, a gold flourish.',
    label: 'Classic Ivory',
    swatch: ['#FBF7F0', '#B08D57', '#2B2B2B'],
    skin: {
      card: '#FBF7F0',
      cardBorder: '1px solid #E3D5BB',
      cardRadius: '2px',
      innerRule: '',
      backdrop: '#EFEAE2',
      texture: '',
      ink: '#2B2B2B',
      body: '#4A4744',
      quiet: '#6B6661',
      accent: '#B08D57',
      hairline: '#E9DFCB',
      displayFont: SERIF,
      bodyFont: SERIF,
      labelLetter: '0.24em',
      labelTransform: 'uppercase',
      labelStyle: 'normal',
      scriptNames: false,
      nameSize: '34px',
      nameWeight: 'normal',
      headingWeight: 'normal',
      footerInk: '#9A938A',
      button: { bg: '#B08D57', fg: '#FFFFFF', radius: '999px', border: '0' },
      divider: 'flourish',
    },
  },
  {
    id: 'minimal',
    name: 'Modern Minimal',
    blurb: 'White card, clean sans-serif, thin black lines.',
    label: 'Modern Minimal',
    swatch: ['#FFFFFF', '#111111', '#DDDDDD'],
    skin: {
      card: '#FFFFFF',
      cardBorder: '1px solid #111111',
      cardRadius: '0px',
      innerRule: '',
      backdrop: '#F4F4F4',
      texture: '',
      ink: '#111111',
      body: '#333333',
      quiet: '#6E6E6E',
      accent: '#111111',
      hairline: '#DDDDDD',
      displayFont: SANS,
      bodyFont: SANS,
      labelLetter: '0.3em',
      labelTransform: 'uppercase',
      labelStyle: 'normal',
      scriptNames: false,
      nameSize: '30px',
      nameWeight: '500',
      headingWeight: '600',
      footerInk: '#8A8A8A',
      button: { bg: '#111111', fg: '#FFFFFF', radius: '0px', border: '0' },
      divider: 'hairline',
      web: {
        light: true,
        backdrop: '#F4F4F4',
        logoDark: true,
        vars: {
          '--bg': '#F4F4F4',
          '--surface': '#FFFFFF',
          '--field': '#FFFFFF',
          '--field-2': '#F2F2F2',
          '--border': '#E3E3E3',
          '--border-strong': '#111111',
          '--line': '#E3E3E3',
          '--text': '#111111',
          '--text-muted': '#555555',
          '--text-faint': '#767676',
          '--pink': '#111111',
          '--pink-soft': '#333333',
          '--pink-tint': '#EFEFEF',
        },
      },
    },
  },
  {
    id: 'blush',
    name: 'Romantic Blush',
    blurb: 'Soft pink, script names, a floral divider.',
    label: 'Romantic Blush',
    swatch: ['#FFF7F5', '#C9788F', '#4B3138'],
    skin: {
      card: '#FFF7F5',
      cardBorder: '1px solid #F0D6DB',
      cardRadius: '3px',
      innerRule: '',
      backdrop: '#F6E9E7',
      texture: '',
      ink: '#4B3138',
      body: '#5C444B',
      quiet: '#8A7278',
      accent: '#C9788F',
      hairline: '#F2E0E2',
      displayFont: SCRIPT,
      bodyFont: SERIF,
      labelLetter: '0.22em',
      labelTransform: 'uppercase',
      labelStyle: 'normal',
      scriptNames: true,
      nameSize: '42px',
      nameWeight: 'normal',
      headingWeight: 'normal',
      footerInk: '#A98E93',
      button: { bg: '#C9788F', fg: '#FFFFFF', radius: '999px', border: '0' },
      divider: 'floral',
      web: {
        light: true,
        backdrop: '#F6E9E7',
        logoDark: true,
        vars: {
          '--bg': '#F6E9E7',
          '--surface': '#FFF7F5',
          '--field': '#FFFFFF',
          '--field-2': '#F7E7E9',
          '--border': '#F0D6DB',
          '--border-strong': '#E0B9C2',
          '--line': '#F0D6DB',
          '--text': '#4B3138',
          '--text-muted': '#7A5F66',
          '--text-faint': '#9C8489',
          '--pink': '#C9788F',
          '--pink-soft': '#A75D74',
          '--pink-tint': '#FBE7EC',
        },
      },
    },
  },
  {
    id: 'kraft',
    name: 'Rustic Kraft',
    blurb: 'Warm kraft paper, deckled edge, dark green accents.',
    label: 'Rustic Kraft',
    swatch: ['#EADFC6', '#2F4739', '#BFAE8A'],
    skin: {
      card: '#EADFC6',
      cardBorder: '2px dashed #BFAE8A',
      cardRadius: '4px',
      innerRule: '1px solid #D3C4A2',
      backdrop: '#D9CDB2',
      texture: '',
      ink: '#3B3125',
      body: '#4E4433',
      quiet: '#6E6350',
      accent: '#2F4739',
      hairline: '#CDBF9F',
      displayFont: SERIF,
      bodyFont: SERIF,
      labelLetter: '0.2em',
      labelTransform: 'uppercase',
      labelStyle: 'normal',
      scriptNames: false,
      nameSize: '32px',
      nameWeight: 'normal',
      headingWeight: 'normal',
      footerInk: '#7A6E57',
      button: { bg: '#2F4739', fg: '#F6EFDD', radius: '4px', border: '0' },
      divider: 'deckle',
      web: {
        light: true,
        backdrop: '#D9CDB2',
        logoDark: true,
        vars: {
          '--bg': '#D9CDB2',
          '--surface': '#EADFC6',
          '--field': '#F3EAD8',
          '--field-2': '#E2D6BB',
          '--border': '#CDBF9F',
          '--border-strong': '#BFAE8A',
          '--line': '#CDBF9F',
          '--text': '#3B3125',
          '--text-muted': '#5E5340',
          '--text-faint': '#7C7057',
          '--pink': '#2F4739',
          '--pink-soft': '#3E5C4B',
          '--pink-tint': '#DCE4DA',
        },
      },
    },
  },
  {
    id: 'black-tie',
    name: 'Black Tie',
    blurb: 'Black card, gold rules, white and gold type.',
    label: 'Black Tie',
    swatch: ['#111111', '#C9A227', '#F7F2E4'],
    skin: {
      card: '#111111',
      cardBorder: '1px solid #C9A227',
      cardRadius: '0px',
      innerRule: '1px solid #3A3527',
      backdrop: '#1C1C1C',
      texture: '',
      ink: '#F7F2E4',
      body: '#E0D8C4',
      quiet: '#A99F87',
      accent: '#C9A227',
      hairline: '#3A3527',
      displayFont: SERIF,
      bodyFont: SERIF,
      labelLetter: '0.3em',
      labelTransform: 'uppercase',
      labelStyle: 'normal',
      scriptNames: false,
      nameSize: '34px',
      nameWeight: 'normal',
      headingWeight: 'normal',
      footerInk: '#A99F87',
      button: { bg: '#C9A227', fg: '#111111', radius: '0px', border: '0' },
      divider: 'gold-rule',
      web: {
        light: false,
        backdrop: 'radial-gradient(ellipse at top, #1F1C14 0%, #0D0D0D 55%)',
        logoDark: false,
        vars: {
          '--bg': '#111111',
          '--surface': '#181818',
          '--field': '#1E1E1E',
          '--field-2': '#232323',
          '--border': '#333333',
          '--border-strong': '#C9A227',
          '--line': '#333333',
          '--text': '#F7F2E4',
          '--text-muted': '#C9C0A8',
          '--text-faint': '#9A9179',
          '--pink': '#C9A227',
          '--pink-soft': '#E0BE4A',
          '--pink-tint': '#3A3527',
        },
      },
    },
  },
]

export function templateFor(id: unknown): RsvpTemplate {
  const wanted = parseTemplateId(id)
  return (
    RSVP_TEMPLATES.find((template) => template.id === wanted) ??
    RSVP_TEMPLATES[0]
  )
}

export function templateName(id: unknown): string {
  return templateFor(id).name
}

/** A couple's photo: the whole picture they uploaded, and nothing else. */
export type RsvpPhoto = {
  /** Changes on every upload, so the served image is never stale. */
  version: string
  width: number
  height: number
  /** Bytes of the stored JPEG, for the desk and the couple to see. */
  bytes: number
}

/**
 * Reads a photo back out of a stored record. Records written while the crop
 * tool existed may still carry `shape` and `crop` keys; they are ignored here,
 * because a photo is always the whole picture at its own proportions.
 */
export function parsePhoto(raw: unknown): RsvpPhoto | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  const version = typeof record.version === 'string' ? record.version : ''
  if (!version) return null
  return {
    version: version.slice(0, 40),
    width: wholeNumber(record.width),
    height: wholeNumber(record.height),
    bytes: wholeNumber(record.bytes),
  }
}

function wholeNumber(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number) || number < 0) return 0
  return Math.round(number)
}

/** Where the stored photo is served from, on the site's own domain. */
export function photoPath(slug: string, photo: RsvpPhoto | null): string {
  if (!photo) return ''
  const clean = slug.trim().toLowerCase()
  return `/api/rsvp/${clean}/photo?v=${encodeURIComponent(photo.version)}`
}

/**
 * The most a photo may take in an email: the card is 600px wide, and a tall
 * portrait is capped at 800px high so it can never run off the screen. It
 * scales down to fit; it is never trimmed.
 */
export const EMAIL_PHOTO_WIDTH = 600
export const EMAIL_PHOTO_MAX_HEIGHT = 800

/** The width and height the photo is drawn at in the letter. */
export function emailPhotoBox(
  width: number,
  height: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: EMAIL_PHOTO_WIDTH, height: EMAIL_PHOTO_MAX_HEIGHT }
  }
  const scale = Math.min(
    EMAIL_PHOTO_WIDTH / width,
    EMAIL_PHOTO_MAX_HEIGHT / height,
  )
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}
