/**
 * The invitation styles a couple picks from. One definition drives the guest
 * invitation card, the opening envelope, the emails and the guest RSVP pages,
 * so the card, the letter and the page can never drift apart.
 *
 * Everything here is pure: colours, type stacks, ornaments and frames. Every
 * typeface is a Google Fonts family with a system fallback after it, so an
 * email client without the web font still sets something close.
 */

export type RsvpTemplateId =
  | 'ivory'
  | 'minimal'
  | 'blush'
  | 'kraft'
  | 'black-tie'
  | 'deco'
  | 'garden'
  | 'after-dark'

export const TEMPLATE_IDS: RsvpTemplateId[] = [
  'ivory',
  'minimal',
  'blush',
  'kraft',
  'black-tie',
  'deco',
  'garden',
  'after-dark',
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
  /** A rule printed around the letter, inside the card's edge. */
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
  /** Names set in a script or an italic. */
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

export type OrnamentId =
  | 'flourish'
  | 'rule'
  | 'florals'
  | 'sprig'
  | 'diamond'
  | 'fan'
  | 'wreath'
  | 'eq'

/** One of the three colourways a style comes in. */
export type RsvpTint = {
  name: string
  accent: string
  /** Deeper accent for small text on the paper, where the accent is too light. */
  accentInk: string
  /** A paper and page change, for the dark styles' colourways. */
  paper?: string
  backdrop?: string
  /** A metallic gradient for foil names (Black Tie, Art Deco). */
  foil?: string
}

/** How the invitation card itself is set. */
export type RsvpLook = {
  names: {
    font: string
    weight: number
    style: 'normal' | 'italic'
    transform: 'none' | 'uppercase'
    tracking: string
    /** Size on a 380px-wide card, in px; it scales with the card. */
    size: number
    lineHeight: number
  }
  amp: { font: string; style: 'normal' | 'italic'; weight: number }
  label: {
    font: string
    weight: number
    size: number
    tracking: string
    transform: 'none' | 'uppercase'
    style: 'normal' | 'italic'
  }
  text: { font: string; size: number; weight: number; style: 'normal' | 'italic' }
  /** words: "the twelfth of June"; block: big day number; numeric: 06 · 12 · 2027 */
  dateStyle: 'words' | 'block' | 'numeric'
  ornament: OrnamentId
  frame: 'double' | 'single' | 'none' | 'stitch' | 'gold' | 'deco' | 'neon'
  photoFrame: 'mat' | 'plain' | 'soft' | 'polaroid' | 'gold' | 'deco' | 'neon'
  texture: 'paper' | 'smooth' | 'kraft' | 'linen' | 'velvet'
  foil: boolean
  glow: boolean
  /** The envelope the card arrives in. */
  envelope: { body: string; flap: string; ink: string; liner: 'stripes' | 'dots' | 'solid' | 'deco' | 'leaves' }
}

export type RsvpTemplate = {
  id: RsvpTemplateId
  name: string
  blurb: string
  /** Three swatches for the picker chip. */
  swatch: [string, string, string]
  /** Short label for the card in the picker. */
  label: string
  /** True for the styles added with the invitation studio. */
  fresh?: boolean
  skin: RsvpSkin
  look: RsvpLook
  tints: [RsvpTint, RsvpTint, RsvpTint]
}

const CORMORANT = "'Cormorant Garamond',Garamond,Georgia,'Times New Roman',serif"
const JOST = "'Jost','Futura','Helvetica Neue',Helvetica,Arial,sans-serif"
const BODONI = "'Bodoni Moda','Bodoni 72',Didot,Georgia,serif"
const PINYON = "'Pinyon Script','Snell Roundhand','Apple Chancery','Lucida Handwriting',cursive"
const FRAUNCES = "'Fraunces',Georgia,'Times New Roman',serif"
const COURIER = "'Courier Prime','Courier New',Courier,monospace"
const CINZEL = "'Cinzel','Trajan Pro',Georgia,serif"
const POIRET = "'Poiret One','Futura','Century Gothic',sans-serif"
const JOSEFIN = "'Josefin Sans','Futura','Century Gothic',sans-serif"
const PLAYFAIR = "'Playfair Display',Georgia,serif"
const LORA = "'Lora',Georgia,serif"
const BRICOLAGE = "'Bricolage Grotesque','Arial Black',Arial,sans-serif"
const DMSANS = "'DM Sans','Helvetica Neue',Arial,sans-serif"

/** Every Google Fonts family the invitations use. It lives in invite-fonts.ts so a page's head can name it without loading the templates. */
export { INVITE_FONTS_URL } from './invite-fonts.ts'

function light(vars: {
  bg: string
  surface: string
  field: string
  field2: string
  border: string
  strong: string
  text: string
  muted: string
  faint: string
}): Record<string, string> {
  return {
    '--bg': vars.bg,
    '--surface': vars.surface,
    '--field': vars.field,
    '--field-2': vars.field2,
    '--border': vars.border,
    '--border-strong': vars.strong,
    '--line': vars.border,
    '--text': vars.text,
    '--text-muted': vars.muted,
    '--text-faint': vars.faint,
  }
}

export const RSVP_TEMPLATES: RsvpTemplate[] = [
  {
    id: 'ivory',
    name: 'Classic Ivory',
    blurb: 'Cream paper, engraved serif, a gold flourish and a double rule.',
    label: 'Classic Ivory',
    swatch: ['#FBF6EC', '#A8844A', '#2E2A25'],
    tints: [
      { name: 'Antique gold', accent: '#A8844A', accentInk: '#7E6131' },
      { name: 'Sage', accent: '#7D8C6A', accentInk: '#56633F' },
      { name: 'Dusty blue', accent: '#6F86A0', accentInk: '#4B6079' },
    ],
    look: {
      names: { font: CORMORANT, weight: 500, style: 'italic', transform: 'none', tracking: '0', size: 44, lineHeight: 1.02 },
      amp: { font: CORMORANT, style: 'italic', weight: 400 },
      label: { font: CORMORANT, weight: 500, size: 11, tracking: '0.28em', transform: 'uppercase', style: 'normal' },
      text: { font: CORMORANT, size: 17, weight: 400, style: 'normal' },
      dateStyle: 'words',
      ornament: 'flourish',
      frame: 'double',
      photoFrame: 'mat',
      texture: 'paper',
      foil: false,
      glow: false,
      envelope: { body: '#EFE5D2', flap: '#E6DAC3', ink: '#4F4840', liner: 'stripes' },
    },
    skin: {
      card: '#FBF6EC',
      cardBorder: '1px solid #E3D5BB',
      cardRadius: '2px',
      innerRule: '1px solid #E3D5BB',
      backdrop: '#EEE6D6',
      texture: '',
      ink: '#2E2A25',
      body: '#4F4840',
      quiet: '#6F665B',
      accent: '#A8844A',
      hairline: '#E9DFCB',
      displayFont: CORMORANT,
      bodyFont: CORMORANT,
      labelLetter: '0.26em',
      labelTransform: 'uppercase',
      labelStyle: 'normal',
      scriptNames: true,
      nameSize: '42px',
      nameWeight: '500',
      headingWeight: '500',
      footerInk: '#958C80',
      button: { bg: '#A8844A', fg: '#FFFFFF', radius: '999px', border: '0' },
      divider: 'flourish',
    },
  },
  {
    id: 'minimal',
    name: 'Modern Minimal',
    blurb: 'Bright white, wide-spaced capitals, one fine line.',
    label: 'Modern Minimal',
    swatch: ['#FFFFFF', '#111111', '#DDDDDD'],
    tints: [
      { name: 'Ink black', accent: '#111111', accentInk: '#111111' },
      { name: 'Rust', accent: '#A4482F', accentInk: '#8A3A24' },
      { name: 'Navy', accent: '#1F3A5F', accentInk: '#1F3A5F' },
    ],
    look: {
      names: { font: JOST, weight: 300, style: 'normal', transform: 'uppercase', tracking: '0.16em', size: 30, lineHeight: 1.18 },
      amp: { font: BODONI, style: 'italic', weight: 400 },
      label: { font: JOST, weight: 500, size: 10, tracking: '0.34em', transform: 'uppercase', style: 'normal' },
      text: { font: JOST, size: 14, weight: 400, style: 'normal' },
      dateStyle: 'block',
      ornament: 'rule',
      frame: 'single',
      photoFrame: 'plain',
      texture: 'smooth',
      foil: false,
      glow: false,
      envelope: { body: '#F2F2F2', flap: '#E9E9E9', ink: '#111111', liner: 'solid' },
    },
    skin: {
      card: '#FFFFFF',
      cardBorder: '1px solid #111111',
      cardRadius: '0px',
      innerRule: '',
      backdrop: '#EDEDED',
      texture: '',
      ink: '#111111',
      body: '#333333',
      quiet: '#6E6E6E',
      accent: '#111111',
      hairline: '#DDDDDD',
      displayFont: JOST,
      bodyFont: JOST,
      labelLetter: '0.32em',
      labelTransform: 'uppercase',
      labelStyle: 'normal',
      scriptNames: false,
      nameSize: '28px',
      nameWeight: '300',
      headingWeight: '500',
      footerInk: '#8A8A8A',
      button: { bg: '#111111', fg: '#FFFFFF', radius: '0px', border: '0' },
      divider: 'hairline',
      web: {
        light: true,
        backdrop: '#EDEDED',
        logoDark: true,
        vars: light({ bg: '#EDEDED', surface: '#FFFFFF', field: '#FFFFFF', field2: '#F2F2F2', border: '#E3E3E3', strong: '#111111', text: '#111111', muted: '#555555', faint: '#707070' }),
      },
    },
  },
  {
    id: 'blush',
    name: 'Romantic Blush',
    blurb: 'Soft blush paper, flowing script names, hand-drawn peonies.',
    label: 'Romantic Blush',
    swatch: ['#FFF6F3', '#C46F88', '#4B3138'],
    tints: [
      { name: 'Rose', accent: '#C46F88', accentInk: '#9C4D66' },
      { name: 'Mauve', accent: '#9A6B8F', accentInk: '#78506F' },
      { name: 'Peach', accent: '#D4886A', accentInk: '#A9603F' },
    ],
    look: {
      names: { font: PINYON, weight: 400, style: 'normal', transform: 'none', tracking: '0', size: 50, lineHeight: 1.12 },
      amp: { font: PINYON, style: 'normal', weight: 400 },
      label: { font: CORMORANT, weight: 500, size: 11, tracking: '0.24em', transform: 'uppercase', style: 'normal' },
      text: { font: CORMORANT, size: 17, weight: 400, style: 'normal' },
      dateStyle: 'words',
      ornament: 'florals',
      frame: 'none',
      photoFrame: 'soft',
      texture: 'paper',
      foil: false,
      glow: false,
      envelope: { body: '#F3DCD8', flap: '#EDD0CB', ink: '#5C444B', liner: 'dots' },
    },
    skin: {
      card: '#FFF6F3',
      cardBorder: '1px solid #F0D6DB',
      cardRadius: '3px',
      innerRule: '',
      backdrop: '#F4E3E0',
      texture: '',
      ink: '#4B3138',
      body: '#5C444B',
      quiet: '#7F676D',
      accent: '#C46F88',
      hairline: '#F2E0E2',
      displayFont: PINYON,
      bodyFont: CORMORANT,
      labelLetter: '0.22em',
      labelTransform: 'uppercase',
      labelStyle: 'normal',
      scriptNames: true,
      nameSize: '46px',
      nameWeight: 'normal',
      headingWeight: '500',
      footerInk: '#A98E93',
      button: { bg: '#C46F88', fg: '#FFFFFF', radius: '999px', border: '0' },
      divider: 'floral',
      web: {
        light: true,
        backdrop: '#F4E3E0',
        logoDark: true,
        vars: light({ bg: '#F4E3E0', surface: '#FFF6F3', field: '#FFFFFF', field2: '#F7E7E9', border: '#F0D6DB', strong: '#E0B9C2', text: '#4B3138', muted: '#6F555C', faint: '#8C7378' }),
      },
    },
  },
  {
    id: 'kraft',
    name: 'Rustic Kraft',
    blurb: 'Kraft paper, warm italic names, typewriter details, a eucalyptus sprig.',
    label: 'Rustic Kraft',
    swatch: ['#E6D7BA', '#2F4739', '#3A2F22'],
    tints: [
      { name: 'Forest', accent: '#2F4739', accentInk: '#2F4739' },
      { name: 'Rust', accent: '#8A4B2A', accentInk: '#7A3F22' },
      { name: 'Ink blue', accent: '#2C3E57', accentInk: '#2C3E57' },
    ],
    look: {
      names: { font: FRAUNCES, weight: 500, style: 'italic', transform: 'none', tracking: '-0.01em', size: 40, lineHeight: 1.05 },
      amp: { font: FRAUNCES, style: 'italic', weight: 400 },
      label: { font: COURIER, weight: 400, size: 11, tracking: '0.18em', transform: 'uppercase', style: 'normal' },
      text: { font: FRAUNCES, size: 16, weight: 400, style: 'normal' },
      dateStyle: 'words',
      ornament: 'sprig',
      frame: 'stitch',
      photoFrame: 'polaroid',
      texture: 'kraft',
      foil: false,
      glow: false,
      envelope: { body: '#D8C6A3', flap: '#CDB993', ink: '#3A2F22', liner: 'leaves' },
    },
    skin: {
      card: '#E6D7BA',
      cardBorder: '2px dashed #BFAE8A',
      cardRadius: '4px',
      innerRule: '1px solid #D3C4A2',
      backdrop: '#CDBB98',
      texture: '',
      ink: '#3A2F22',
      body: '#4E4433',
      quiet: '#62584A',
      accent: '#2F4739',
      hairline: '#CDBF9F',
      displayFont: FRAUNCES,
      bodyFont: FRAUNCES,
      labelLetter: '0.18em',
      labelTransform: 'uppercase',
      labelStyle: 'normal',
      scriptNames: true,
      nameSize: '38px',
      nameWeight: '500',
      headingWeight: '500',
      footerInk: '#6E624C',
      button: { bg: '#2F4739', fg: '#F6EFDD', radius: '4px', border: '0' },
      divider: 'deckle',
      web: {
        light: true,
        backdrop: '#CDBB98',
        logoDark: true,
        vars: light({ bg: '#CDBB98', surface: '#E6D7BA', field: '#F3EAD8', field2: '#E2D6BB', border: '#CDBF9F', strong: '#A99670', text: '#3A2F22', muted: '#544A39', faint: '#6B604B' }),
      },
    },
  },
  {
    id: 'black-tie',
    name: 'Black Tie',
    blurb: 'Black card, gold foil capitals, a fine gold frame.',
    label: 'Black Tie',
    swatch: ['#0F0F10', '#C9A227', '#F5EEDC'],
    tints: [
      { name: 'Gold', accent: '#C9A227', accentInk: '#D9B54A', foil: 'linear-gradient(100deg,#8C6B1F 0%,#E9C96B 28%,#F7E3A1 46%,#B8892A 68%,#E2C063 100%)' },
      { name: 'Silver', accent: '#B9BEC6', accentInk: '#C9CDD3', foil: 'linear-gradient(100deg,#7D838C 0%,#D7DBE0 30%,#FFFFFF 46%,#9EA4AC 70%,#D2D6DB 100%)' },
      { name: 'Rose gold', accent: '#C99178', accentInk: '#D9A58C', foil: 'linear-gradient(100deg,#8E5A45 0%,#E2AE95 30%,#F6D3C2 46%,#B07A62 70%,#DDA88F 100%)' },
    ],
    look: {
      names: { font: CINZEL, weight: 400, style: 'normal', transform: 'uppercase', tracking: '0.08em', size: 32, lineHeight: 1.15 },
      amp: { font: CORMORANT, style: 'italic', weight: 400 },
      label: { font: CINZEL, weight: 400, size: 10, tracking: '0.32em', transform: 'uppercase', style: 'normal' },
      text: { font: CORMORANT, size: 17, weight: 400, style: 'normal' },
      dateStyle: 'words',
      ornament: 'diamond',
      frame: 'gold',
      photoFrame: 'gold',
      texture: 'velvet',
      foil: true,
      glow: false,
      envelope: { body: '#1B1B1D', flap: '#151517', ink: '#E9DFC6', liner: 'stripes' },
    },
    skin: {
      card: '#0F0F10',
      cardBorder: '1px solid #C9A227',
      cardRadius: '0px',
      innerRule: '1px solid #3A3527',
      backdrop: '#1A1A1B',
      texture: '',
      ink: '#F5EEDC',
      body: '#E0D8C4',
      quiet: '#B3A98F',
      accent: '#C9A227',
      hairline: '#3A3527',
      displayFont: CINZEL,
      bodyFont: CORMORANT,
      labelLetter: '0.3em',
      labelTransform: 'uppercase',
      labelStyle: 'normal',
      scriptNames: false,
      nameSize: '30px',
      nameWeight: '400',
      headingWeight: '400',
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
          '--border-strong': '#5A5236',
          '--line': '#333333',
          '--text': '#F5EEDC',
          '--text-muted': '#C9C0A8',
          '--text-faint': '#A0977E',
        },
      },
    },
  },
  {
    id: 'deco',
    name: 'Art Deco',
    blurb: 'Deep emerald, a gold sunburst fan, 1920s lettering.',
    label: 'Art Deco',
    fresh: true,
    swatch: ['#10231F', '#D4AF5A', '#F3E9D2'],
    tints: [
      { name: 'Emerald', accent: '#D4AF5A', accentInk: '#E0BF72', paper: '#10231F', backdrop: '#0A1714', foil: 'linear-gradient(100deg,#9C7A2E 0%,#EBCB7A 30%,#FBE7AE 46%,#B88F37 70%,#E6C46E 100%)' },
      { name: 'Midnight', accent: '#D4AF5A', accentInk: '#E0BF72', paper: '#121A33', backdrop: '#0B1022', foil: 'linear-gradient(100deg,#9C7A2E 0%,#EBCB7A 30%,#FBE7AE 46%,#B88F37 70%,#E6C46E 100%)' },
      { name: 'Onyx silver', accent: '#C3C8CF', accentInk: '#D3D7DC', paper: '#141414', backdrop: '#0C0C0C', foil: 'linear-gradient(100deg,#7D838C 0%,#D7DBE0 30%,#FFFFFF 46%,#9EA4AC 70%,#D2D6DB 100%)' },
    ],
    look: {
      names: { font: POIRET, weight: 400, style: 'normal', transform: 'uppercase', tracking: '0.1em', size: 36, lineHeight: 1.1 },
      amp: { font: POIRET, style: 'normal', weight: 400 },
      label: { font: JOSEFIN, weight: 600, size: 10, tracking: '0.36em', transform: 'uppercase', style: 'normal' },
      text: { font: JOSEFIN, size: 14, weight: 300, style: 'normal' },
      dateStyle: 'block',
      ornament: 'fan',
      frame: 'deco',
      photoFrame: 'deco',
      texture: 'velvet',
      foil: true,
      glow: false,
      envelope: { body: '#16302A', flap: '#122822', ink: '#E8DCBC', liner: 'deco' },
    },
    skin: {
      card: '#10231F',
      cardBorder: '1px solid #D4AF5A',
      cardRadius: '0px',
      innerRule: '1px solid #3B4A35',
      backdrop: '#0A1714',
      texture: '',
      ink: '#F3E9D2',
      body: '#DCD2BA',
      quiet: '#B2A889',
      accent: '#D4AF5A',
      hairline: '#33463E',
      displayFont: POIRET,
      bodyFont: JOSEFIN,
      labelLetter: '0.34em',
      labelTransform: 'uppercase',
      labelStyle: 'normal',
      scriptNames: false,
      nameSize: '32px',
      nameWeight: '400',
      headingWeight: '600',
      footerInk: '#9A9077',
      button: { bg: '#D4AF5A', fg: '#10231F', radius: '0px', border: '0' },
      divider: 'gold-rule',
      web: {
        light: false,
        backdrop: 'radial-gradient(ellipse at top, #17332C 0%, #081310 60%)',
        logoDark: false,
        vars: {
          '--bg': '#0A1714',
          '--surface': '#10231F',
          '--field': '#142C27',
          '--field-2': '#18342E',
          '--border': '#2C4A41',
          '--border-strong': '#6E6233',
          '--line': '#2C4A41',
          '--text': '#F3E9D2',
          '--text-muted': '#CFC5AC',
          '--text-faint': '#A89E84',
        },
      },
    },
  },
  {
    id: 'garden',
    name: 'Garden Party',
    blurb: 'Fresh white paper, a leafy wreath around your initials, italic names.',
    label: 'Garden Party',
    fresh: true,
    swatch: ['#FBFBF6', '#6E8B63', '#2E3A2C'],
    tints: [
      { name: 'Sage', accent: '#6E8B63', accentInk: '#4C6544' },
      { name: 'Olive', accent: '#7C7A3A', accentInk: '#5C5A26' },
      { name: 'Lavender', accent: '#8A7BAE', accentInk: '#655689' },
    ],
    look: {
      names: { font: PLAYFAIR, weight: 400, style: 'italic', transform: 'none', tracking: '0', size: 38, lineHeight: 1.1 },
      amp: { font: PLAYFAIR, style: 'italic', weight: 400 },
      label: { font: LORA, weight: 400, size: 11, tracking: '0.22em', transform: 'uppercase', style: 'normal' },
      text: { font: LORA, size: 15, weight: 400, style: 'normal' },
      dateStyle: 'words',
      ornament: 'wreath',
      frame: 'single',
      photoFrame: 'soft',
      texture: 'linen',
      foil: false,
      glow: false,
      envelope: { body: '#E6ECDD', flap: '#DCE4D1', ink: '#2E3A2C', liner: 'leaves' },
    },
    skin: {
      card: '#FBFBF6',
      cardBorder: '1px solid #DCE3D3',
      cardRadius: '2px',
      innerRule: '',
      backdrop: '#E8EDE2',
      texture: '',
      ink: '#2E3A2C',
      body: '#46523F',
      quiet: '#626C5B',
      accent: '#6E8B63',
      hairline: '#E1E7D9',
      displayFont: PLAYFAIR,
      bodyFont: LORA,
      labelLetter: '0.22em',
      labelTransform: 'uppercase',
      labelStyle: 'normal',
      scriptNames: true,
      nameSize: '36px',
      nameWeight: '400',
      headingWeight: '400',
      footerInk: '#879180',
      button: { bg: '#6E8B63', fg: '#FFFFFF', radius: '999px', border: '0' },
      divider: 'hairline',
      web: {
        light: true,
        backdrop: '#E8EDE2',
        logoDark: true,
        vars: light({ bg: '#E8EDE2', surface: '#FBFBF6', field: '#FFFFFF', field2: '#F0F3EB', border: '#DCE3D3', strong: '#B7C4AB', text: '#2E3A2C', muted: '#4F5A48', faint: '#69735F' }),
      },
    },
  },
  {
    id: 'after-dark',
    name: 'After Dark',
    blurb: 'Midnight card, neon names and an equalizer, for a couple who came to dance.',
    label: 'After Dark',
    fresh: true,
    swatch: ['#120B1E', '#FF30E5', '#FFFFFF'],
    tints: [
      { name: 'Neon pink', accent: '#FF30E5', accentInk: '#FF6BEC' },
      { name: 'Electric blue', accent: '#3DA5FF', accentInk: '#72BEFF' },
      { name: 'Laser lime', accent: '#B6FF3B', accentInk: '#C8FF70' },
    ],
    look: {
      names: { font: BRICOLAGE, weight: 800, style: 'normal', transform: 'none', tracking: '-0.02em', size: 40, lineHeight: 1.0 },
      amp: { font: BRICOLAGE, style: 'normal', weight: 600 },
      label: { font: DMSANS, weight: 700, size: 10, tracking: '0.3em', transform: 'uppercase', style: 'normal' },
      text: { font: DMSANS, size: 15, weight: 400, style: 'normal' },
      dateStyle: 'block',
      ornament: 'eq',
      frame: 'neon',
      photoFrame: 'neon',
      texture: 'smooth',
      foil: false,
      glow: true,
      envelope: { body: '#1E1330', flap: '#170E26', ink: '#FFFFFF', liner: 'solid' },
    },
    skin: {
      card: '#120B1E',
      cardBorder: '1px solid #FF30E5',
      cardRadius: '18px',
      innerRule: '',
      backdrop: '#07040C',
      texture: '',
      ink: '#FFFFFF',
      body: '#E6DDF2',
      quiet: '#B8ABCB',
      accent: '#FF30E5',
      hairline: '#2E2342',
      displayFont: BRICOLAGE,
      bodyFont: DMSANS,
      labelLetter: '0.3em',
      labelTransform: 'uppercase',
      labelStyle: 'normal',
      scriptNames: false,
      nameSize: '36px',
      nameWeight: '800',
      headingWeight: '700',
      footerInk: '#9E92B3',
      button: { bg: '#FF30E5', fg: '#120B1E', radius: '999px', border: '0' },
      divider: 'hairline',
      web: {
        light: false,
        backdrop: 'radial-gradient(ellipse at top, #2A1240 0%, #07040C 60%)',
        logoDark: false,
        vars: {
          '--bg': '#07040C',
          '--surface': '#120B1E',
          '--field': '#1A1129',
          '--field-2': '#211633',
          '--border': '#2E2342',
          '--border-strong': '#4A3A66',
          '--line': '#2E2342',
          '--text': '#FFFFFF',
          '--text-muted': '#CFC3E0',
          '--text-faint': '#A497B8',
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

/** A colourway index the couple picked: 0, 1 or 2. Anything else is 0. */
export function parseTint(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value)
  return number === 1 || number === 2 ? number : 0
}

function hexMix(a: string, b: string, amount: number): string {
  const parse = (hex: string) => {
    const match = /^#([0-9a-f]{6})$/i.exec(hex)
    const value = match ? parseInt(match[1], 16) : 0
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
  }
  const x = parse(a)
  const y = parse(b)
  const out = x.map((channel, index) =>
    Math.round(channel + (y[index] - channel) * amount),
  )
  return `#${out.map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

/** Text on a filled accent: white on a dark accent, near-black on a light one. */
export function inkOn(hex: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) return '#111111'
  const value = parseInt(match[1], 16)
  const channel = (shift: number) => {
    const part = ((value >> shift) & 255) / 255
    return part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0)
  // 0.18 is where white and near-black give equal contrast.
  return luminance < 0.18 ? '#FFFFFF' : '#111111'
}

/**
 * The style with the couple's colourway applied: the accent, the button, the
 * guest page's accent variables and, for the dark styles, the paper. Emails,
 * the card and the guest pages all read this one skin.
 */
export function skinFor(id: unknown, tintIndex: unknown = 0): {
  template: RsvpTemplate
  tint: RsvpTint
  skin: RsvpSkin
} {
  const template = templateFor(id)
  const tint = template.tints[parseTint(tintIndex)]
  const base = template.skin
  const card = tint.paper ?? base.card
  const backdrop = tint.backdrop ?? base.backdrop
  const dark = base.web ? !base.web.light : false
  const skin: RsvpSkin = {
    ...base,
    card,
    backdrop,
    accent: tint.accent,
    cardBorder: base.cardBorder.replace(/#[0-9A-Fa-f]{6}$/, (current) =>
      current.toUpperCase() === base.accent.toUpperCase() ? tint.accent : current,
    ),
    button: { ...base.button, bg: tint.accent, fg: inkOn(tint.accent) },
  }
  if (base.web) {
    skin.web = {
      ...base.web,
      backdrop: tint.backdrop && dark
        ? `radial-gradient(ellipse at top, ${hexMix(card, '#FFFFFF', 0.08)} 0%, ${backdrop} 60%)`
        : base.web.backdrop,
      vars: {
        ...base.web.vars,
        ...(tint.paper ? { '--surface': card, '--bg': backdrop } : {}),
        '--pink': tint.accent,
        '--pink-soft': dark ? hexMix(tint.accent, '#FFFFFF', 0.25) : tint.accentInk,
        '--pink-tint': hexMix(card, tint.accent, dark ? 0.22 : 0.12),
      },
    }
  }
  return { template, tint, skin }
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
