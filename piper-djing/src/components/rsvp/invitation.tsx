import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { boxesAt } from '../../lib/rsvp/invite-words.ts'
import type { TextBox } from '../../lib/rsvp/invite-words.ts'
import { mapLink } from '../../lib/rsvp/invite.ts'
import type { InviteView } from '../../lib/rsvp/invite.ts'
import { rsvpButtonFit, rsvpGhostFit } from './shell.tsx'
import { skinFor } from '../../lib/rsvp/templates.ts'
import type { RsvpLook, RsvpTemplateId } from '../../lib/rsvp/templates.ts'

/**
 * The invitation card, as guests see it and as the couple designs it.
 *
 * Every size is in container units, so one card scales cleanly from a 160px
 * thumbnail in the studio to the full card on a guest's phone. The words come
 * from the couple's wording; the look comes from their style and colourway.
 */

/** px on a 380px-wide card, as a container-relative length. */
function cq(px: number): string {
  return `${(px / 3.8).toFixed(3)}cqw`
}

const NOISE = (alpha: number, freq: number) =>
  `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${alpha} 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`

const TEXTURE: Record<RsvpLook['texture'], string> = {
  paper: `${NOISE(0.07, 0.85)}, radial-gradient(ellipse at 50% 35%, rgba(255,255,255,0.55), rgba(255,255,255,0) 70%)`,
  smooth: 'none',
  kraft: `${NOISE(0.16, 0.7)}, ${NOISE(0.08, 0.08)}`,
  linen: `repeating-linear-gradient(0deg, rgba(0,0,0,0.018) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(0,0,0,0.018) 0 1px, transparent 1px 3px)`,
  velvet: `${NOISE(0.1, 0.9)}, radial-gradient(ellipse at 50% 20%, rgba(255,255,255,0.07), rgba(255,255,255,0) 65%)`,
}

const CSS = `
.inv-card{container-type:inline-size;position:relative;width:100%;box-sizing:border-box;text-align:center;overflow:hidden;color:var(--inv-body);background-color:var(--inv-paper);box-shadow:0 1px 2px rgba(0,0,0,.12),0 18px 40px -18px rgba(0,0,0,.45)}
.inv-inner{position:relative;padding:${cq(46)} ${cq(36)} ${cq(42)};display:flex;flex-direction:column;align-items:center}
.inv-frame{position:absolute;pointer-events:none;inset:${cq(13)}}
.inv-frame-double{border:1px solid color-mix(in srgb,var(--inv-accent) 75%,transparent);box-shadow:inset 0 0 0 ${cq(3)} var(--inv-paper),inset 0 0 0 calc(${cq(3)} + 1px) color-mix(in srgb,var(--inv-accent) 55%,transparent)}
.inv-frame-single{border:1px solid color-mix(in srgb,var(--inv-accent) 45%,transparent);inset:${cq(15)}}
.inv-frame-stitch{border:${cq(1.6)} dashed color-mix(in srgb,var(--inv-accent) 55%,transparent);inset:${cq(11)};border-radius:${cq(4)}}
.inv-frame-gold{border:1px solid var(--inv-accent);inset:${cq(12)}}
.inv-frame-gold::after{content:"";position:absolute;inset:${cq(5)};border:1px solid color-mix(in srgb,var(--inv-accent) 40%,transparent)}
.inv-frame-deco{border:1px solid var(--inv-accent);inset:${cq(12)}}
.inv-frame-deco::after{content:"";position:absolute;inset:${cq(6)};border:1px solid color-mix(in srgb,var(--inv-accent) 45%,transparent)}
.inv-frame-neon{border:${cq(1.5)} solid var(--inv-accent);border-radius:${cq(16)};inset:${cq(12)};box-shadow:0 0 ${cq(10)} color-mix(in srgb,var(--inv-accent) 65%,transparent),inset 0 0 ${cq(10)} color-mix(in srgb,var(--inv-accent) 45%,transparent)}
.inv-corner{position:absolute;width:${cq(26)};height:${cq(26)};color:var(--inv-accent)}
.inv-label{margin:0;color:var(--inv-accent-ink)}
.inv-names{margin:0;color:var(--inv-ink);display:flex;flex-direction:column;align-items:center}
.inv-names span{display:block}
.inv-foil{background:var(--inv-foil);-webkit-background-clip:text;background-clip:text;color:transparent!important}
.inv-glow{color:#fff;text-shadow:0 0 ${cq(2)} #fff,0 0 ${cq(9)} var(--inv-accent),0 0 ${cq(22)} var(--inv-accent)}
.inv-amp{color:var(--inv-accent-ink)}
.inv-text{margin:0;color:var(--inv-body)}
.inv-ink{color:var(--inv-ink)}
.inv-quiet{color:var(--inv-quiet)}
.inv-photo{display:block;width:100%;height:auto;max-width:100%}
.inv-block{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:${cq(12)};width:86%}
.inv-block span{display:block}
.inv-block .side{border-top:1px solid color-mix(in srgb,var(--inv-accent) 55%,transparent);border-bottom:1px solid color-mix(in srgb,var(--inv-accent) 55%,transparent);padding:${cq(7)} 0}
.inv-env-stage{position:relative;width:100%;max-width:440px;margin:0 auto}
.inv-env{position:relative;width:100%;aspect-ratio:7/5;perspective:1400px}
.inv-env-back{position:absolute;inset:0;border-radius:6px;background:var(--env-body);box-shadow:0 2px 3px rgba(0,0,0,.12),0 24px 40px -22px rgba(0,0,0,.55)}
.inv-env-slot{position:absolute;left:7%;right:7%;bottom:4%;top:-180%;overflow:hidden;pointer-events:none;z-index:2}
.inv-env-card{position:absolute;left:0;right:0;top:68.3%;transition:transform 1.05s cubic-bezier(.22,.8,.24,1)}
.inv-env-pocket{position:absolute;inset:0;z-index:3;border-radius:6px;background:var(--env-body);clip-path:polygon(0 0,50% 54%,100% 0,100% 100%,0 100%);box-shadow:inset 0 -1px 0 rgba(0,0,0,.08)}
.inv-env-pocket::before{content:"";position:absolute;inset:0;background:linear-gradient(to top right,rgba(0,0,0,.05) 0 50%,transparent 50%),linear-gradient(to top left,rgba(0,0,0,.05) 0 50%,transparent 50%);clip-path:polygon(0 0,50% 54%,100% 0,100% 100%,0 100%)}
.inv-env-flap{position:absolute;left:0;right:0;top:0;height:60%;transform-origin:50% 0;transform-style:preserve-3d;transition:transform .7s cubic-bezier(.45,.05,.3,1),z-index 0s .35s;z-index:4}
.inv-env-flap > div{position:absolute;inset:0;clip-path:polygon(0 0,100% 0,50% 100%);backface-visibility:hidden;-webkit-backface-visibility:hidden}
.inv-env-flap .out{background:linear-gradient(to bottom,var(--env-flap),color-mix(in srgb,var(--env-flap) 88%,#000))}
.inv-env-flap .in{transform:rotateX(180deg);background:var(--env-liner)}
.inv-env-addr{position:absolute;left:8%;right:8%;bottom:9%;text-align:center;color:var(--env-ink);margin:0;z-index:3;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.inv-seal{position:absolute;left:50%;top:54%;width:16%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;border:0;padding:0;cursor:pointer;z-index:5;display:grid;place-items:center;color:var(--seal-ink);background:radial-gradient(circle at 34% 30%,var(--seal-hi) 0%,var(--seal) 46%,var(--seal-lo) 100%);box-shadow:0 2px 3px rgba(0,0,0,.3),inset 0 -2px 4px rgba(0,0,0,.25),inset 0 2px 3px rgba(255,255,255,.25);transition:transform .35s ease,opacity .35s ease}
.inv-seal::before{content:"";position:absolute;inset:9%;border-radius:50%;border:1.5px solid color-mix(in srgb,var(--seal-ink) 45%,transparent)}
.inv-seal:hover{transform:translate(-50%,-50%) scale(1.06)}
.inv-seal:focus-visible{outline:3px solid var(--env-ink);outline-offset:4px}
.inv-env[data-phase="opening"] .inv-seal,.inv-env[data-phase="rising"] .inv-seal{opacity:0;transform:translate(-50%,-30%) scale(.8)}
.inv-env[data-phase="opening"] .inv-env-flap,.inv-env[data-phase="rising"] .inv-env-flap{transform:rotateX(180deg);z-index:1}
.inv-env[data-phase="rising"] .inv-env-card{transform:translateY(-36%)}
.inv-env[data-phase="opening"] .inv-env-addr,.inv-env[data-phase="rising"] .inv-env-addr{opacity:0;transition:opacity .3s}
.inv-hint{margin:14px 0 0;text-align:center}
.inv-open-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 22px;border-radius:999px;border:1.5px solid currentColor;background:transparent;color:inherit;font:inherit;font-weight:600;cursor:pointer}
.inv-open-btn:focus-visible{outline:3px solid currentColor;outline-offset:3px}
.inv-reveal{animation:inv-reveal .7s cubic-bezier(.2,.8,.2,1) both}
@keyframes inv-reveal{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}
.inv-spin{animation:inv-spin 9s linear infinite}
@keyframes inv-spin{to{transform:rotate(360deg)}}
.inv-bars rect{transform-box:fill-box;transform-origin:50% 100%;animation:inv-bar 1.4s ease-in-out infinite alternate}
@keyframes inv-bar{from{transform:scaleY(.45)}to{transform:scaleY(1)}}
@media (prefers-reduced-motion: reduce){.inv-env-flap,.inv-env-card,.inv-seal{transition:none}.inv-reveal,.inv-spin,.inv-bars rect{animation:none}}
`

export function InvitationStyles() {
  return (
    <style href="rsvp-invitation-styles" precedence="medium">
      {CSS}
    </style>
  )
}

function useLook(view: Pick<InviteView, 'template' | 'tint'>) {
  const { template, tint, skin } = skinFor(view.template, view.tint)
  const look = template.look
  const vars = {
    '--inv-paper': skin.card,
    '--inv-ink': skin.ink,
    '--inv-body': skin.body,
    '--inv-quiet': skin.quiet,
    '--inv-accent': tint.accent,
    '--inv-accent-ink': tint.accentInk,
    '--inv-foil': tint.foil ?? tint.accent,
  } as CSSProperties
  return { template, tint, skin, look, vars }
}

/** Names that run long are set smaller so they never wrap mid-name. */
function nameScale(a: string, b: string, uppercase: boolean): number {
  const longest = Math.max(a.length, b.length, 1)
  const fits = uppercase ? 8 : 10
  return longest <= fits ? 1 : Math.max(0.55, (fits / longest) ** 0.85)
}

export function InvitationCard({ view }: { view: InviteView }) {
  const { look, vars, template } = useLook(view)
  const n = look.names
  const scale = nameScale(view.partnerOne, view.partnerTwo, n.transform === 'uppercase')
  const label: CSSProperties = {
    fontFamily: look.label.font,
    fontWeight: look.label.weight,
    fontSize: cq(look.label.size),
    letterSpacing: look.label.tracking,
    textTransform: look.label.transform,
    fontStyle: look.label.style,
  }
  const text = (size = look.text.size, extra: CSSProperties = {}): CSSProperties => ({
    fontFamily: look.text.font,
    fontWeight: look.text.weight,
    fontSize: cq(size),
    fontStyle: look.text.style,
    lineHeight: 1.45,
    ...extra,
  })
  const nameClass = look.foil ? 'inv-foil' : look.glow ? 'inv-glow' : ''
  const nameStyle: CSSProperties = {
    fontFamily: n.font,
    fontWeight: n.weight,
    fontStyle: n.style,
    textTransform: n.transform,
    letterSpacing: n.tracking,
    fontSize: cq(n.size * scale),
    lineHeight: n.lineHeight,
  }
  const gap = (px: number) => <span aria-hidden="true" style={{ display: 'block', height: cq(px) }} />
  const date = view.date
  const w = view.wording
  return (
    <article
      className="inv-card"
      aria-label={`Wedding invitation for ${view.partnerOne} and ${view.partnerTwo}`}
      style={{
        ...vars,
        backgroundImage: TEXTURE[look.texture],
        borderRadius: look.frame === 'neon' ? cq(22) : look.texture === 'kraft' ? cq(4) : cq(2),
      }}
    >
      <InvitationStyles />
      {look.frame !== 'none' ? <div className={`inv-frame inv-frame-${look.frame}`} aria-hidden="true" /> : null}
      {look.frame === 'gold' || look.frame === 'deco' ? <Corners kind={look.frame} /> : null}
      {template.id === 'blush' ? <BlushCorners /> : null}
      <div className="inv-inner">
        {view.photo ? (
          <>
            <Photo photo={view.photo} frame={look.photoFrame} />
            {gap(24)}
          </>
        ) : null}
        <TopMark view={view} look={look} />
        {gap(18)}
        {w.host ? (
          <>
            <p className="inv-label" style={label}>{w.host}</p>
            {gap(16)}
          </>
        ) : null}
        <Boxes boxes={boxesAt(w, 'top')} look={look} after />
        <h2 className="inv-names" style={nameStyle}>
          <span className={nameClass}>{view.partnerOne || 'Partner one'}</span>
          <span
            className={look.glow ? 'inv-glow' : look.foil ? 'inv-foil' : 'inv-amp'}
            style={{
              fontFamily: look.amp.font,
              fontStyle: look.amp.style,
              fontWeight: look.amp.weight,
              fontSize: '0.62em',
              letterSpacing: 0,
              textTransform: 'none',
              margin: `${n.transform === 'uppercase' ? '0.12em' : '0.02em'} 0`,
            }}
          >
            &amp;
          </span>
          <span className={nameClass}>{view.partnerTwo || 'Partner two'}</span>
        </h2>
        {gap(16)}
        <p className="inv-text" style={text(look.text.size, { fontStyle: 'italic', maxWidth: '88%' })}>
          {w.request}
        </p>
        {gap(20)}
        {date ? (
          look.dateStyle === 'block' ? (
            <BlockDate view={view} look={look} label={label} />
          ) : (
            <>
              <p className="inv-text inv-ink" style={text(look.text.size + 1.5)}>
                {date.full}
              </p>
              {view.timeWords ? (
                <p className="inv-text" style={text(look.text.size)}>
                  at {view.timeWords}
                </p>
              ) : null}
            </>
          )
        ) : null}
        {view.venue ? (
          <>
            {gap(16)}
            <p className="inv-text inv-ink" style={text(look.text.size + 1, { fontWeight: Math.max(look.text.weight, 500) })}>
              {view.venue}
            </p>
            {view.address ? (
              <p className="inv-text inv-quiet" style={text(look.text.size - 2.5)}>
                {view.address}
              </p>
            ) : null}
          </>
        ) : null}
        {w.after ? (
          <>
            {gap(14)}
            <p className="inv-text" style={text(look.text.size - 0.5, { fontStyle: 'italic' })}>{w.after}</p>
          </>
        ) : null}
        <Boxes boxes={boxesAt(w, 'details')} look={look} />
        {gap(20)}
        <Divider id={template.id} look={look} />
        {w.note ? (
          <>
            {gap(16)}
            <p className="inv-text inv-quiet" style={text(look.text.size - 1, { fontStyle: 'italic', whiteSpace: 'pre-line', maxWidth: '86%' })}>
              {w.note}
            </p>
          </>
        ) : null}
        <Boxes boxes={boxesAt(w, 'bottom')} look={look} />
        {view.replyBy ? (
          <>
            {gap(16)}
            <p className="inv-label" style={{ ...label, fontSize: cq(look.label.size - 0.5) }}>
              Kindly reply by {view.replyBy}
            </p>
          </>
        ) : null}
      </div>
    </article>
  )
}

/** The couple's own text boxes, set in the style's type at the size they chose. */
function Boxes({ boxes, look, after = false }: { boxes: TextBox[]; look: RsvpLook; after?: boolean }) {
  if (boxes.length === 0) return null
  return (
    <>
      {boxes.map((box) => {
        const style: CSSProperties =
          box.size === 'large'
            ? { fontFamily: look.names.font, fontWeight: look.names.weight, fontStyle: look.names.style, fontSize: cq(Math.min(26, look.names.size * 0.58)), lineHeight: 1.2, color: 'var(--inv-ink)' }
            : box.size === 'small'
              ? { fontFamily: look.text.font, fontWeight: look.text.weight, fontSize: cq(look.text.size - 3), lineHeight: 1.45, color: 'var(--inv-quiet)' }
              : { fontFamily: look.text.font, fontWeight: look.text.weight, fontSize: cq(look.text.size), lineHeight: 1.45 }
        return (
          <div key={box.id} style={{ display: 'contents' }}>
            {after ? null : <span aria-hidden="true" style={{ display: 'block', height: cq(14) }} />}
            <p className="inv-text" style={{ ...style, whiteSpace: 'pre-line', maxWidth: '88%', overflowWrap: 'anywhere' }}>
              {box.text}
            </p>
            {after ? <span aria-hidden="true" style={{ display: 'block', height: cq(16) }} /> : null}
          </div>
        )
      })}
    </>
  )
}

function BlockDate({ view, look, label }: { view: InviteView; look: RsvpLook; label: CSSProperties }) {
  const date = view.date
  if (!date) return null
  const big: CSSProperties = {
    fontFamily: look.names.font,
    fontWeight: look.names.weight,
    fontSize: cq(46),
    lineHeight: 1,
    color: 'var(--inv-ink)',
  }
  return (
    <>
      <p className="inv-label" style={label}>{date.parts.month}</p>
      <span aria-hidden="true" style={{ display: 'block', height: cq(8) }} />
      <div className="inv-block" aria-label={`${date.weekday}, ${date.plain}`}>
        <span className="side inv-label" style={label}>{date.parts.weekdayShort}</span>
        <span className={look.glow ? 'inv-glow' : look.foil ? 'inv-foil' : ''} style={big}>{date.parts.day}</span>
        <span className="side inv-label" style={label}>{date.parts.year}</span>
      </div>
      {view.timeShort ? (
        <>
          <span aria-hidden="true" style={{ display: 'block', height: cq(10) }} />
          <p className="inv-label" style={label}>at {view.timeShort}</p>
        </>
      ) : null}
    </>
  )
}

function Photo({ photo, frame }: { photo: NonNullable<InviteView['photo']>; frame: RsvpLook['photoFrame'] }) {
  const ratio = photo.width > 0 && photo.height > 0 ? `${photo.width} / ${photo.height}` : undefined
  const img = (style: CSSProperties = {}) => (
    <img className="inv-photo" src={photo.url} alt={photo.alt} style={{ aspectRatio: ratio, ...style }} />
  )
  if (frame === 'polaroid') {
    return (
      <div style={{ position: 'relative', width: '88%', background: '#FBF8F1', padding: `${cq(8)} ${cq(8)} ${cq(30)}`, boxShadow: '0 6px 14px -6px rgba(0,0,0,.45)', transform: 'rotate(-1.6deg)', boxSizing: 'border-box' }}>
        <span aria-hidden="true" style={{ position: 'absolute', top: cq(-9), left: '50%', width: '34%', height: cq(18), transform: 'translateX(-50%) rotate(2deg)', background: 'rgba(255,255,255,.55)', boxShadow: '0 1px 2px rgba(0,0,0,.1)' }} />
        {img()}
      </div>
    )
  }
  if (frame === 'mat') {
    return (
      <div style={{ width: '90%', padding: cq(7), border: '1px solid color-mix(in srgb, var(--inv-accent) 60%, transparent)', boxSizing: 'border-box' }}>
        {img()}
      </div>
    )
  }
  if (frame === 'gold' || frame === 'deco') {
    return (
      <div style={{ width: '90%', padding: cq(5), border: '1px solid var(--inv-accent)', outline: '1px solid color-mix(in srgb, var(--inv-accent) 40%, transparent)', outlineOffset: cq(4), boxSizing: 'border-box' }}>
        {img()}
      </div>
    )
  }
  if (frame === 'neon') {
    return (
      <div style={{ width: '90%', borderRadius: cq(14), overflow: 'hidden', border: `${cq(1.5)} solid var(--inv-accent)`, boxShadow: `0 0 ${cq(14)} color-mix(in srgb, var(--inv-accent) 60%, transparent)` }}>
        {img()}
      </div>
    )
  }
  return <div style={{ width: '100%' }}>{img(frame === 'soft' ? { borderRadius: cq(12) } : {})}</div>
}

/** The mark at the top of the card: the monogram in the style's own setting, or its ornament. */
function TopMark({ view, look }: { view: InviteView; look: RsvpLook }) {
  const [a, b] = view.letters
  const letters = view.monogram && a && b
  const font: CSSProperties = { fontFamily: look.names.font, fontWeight: look.names.weight, fontStyle: look.names.style }
  const width = (px: number): CSSProperties => ({ width: cq(px), height: 'auto', display: 'block', color: 'var(--inv-accent)' })
  switch (look.ornament) {
    case 'wreath':
      return (
        <div style={{ position: 'relative', width: cq(118) }}>
          <Wreath style={width(118)} />
          {letters ? (
            <span className="inv-ink" style={{ ...font, position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: cq(30), lineHeight: 1 }}>
              <span>{a}<span className="inv-amp" style={{ fontSize: '0.55em', margin: '0 0.08em' }}>&amp;</span>{b}</span>
            </span>
          ) : null}
        </div>
      )
    case 'fan':
      return (
        <div style={{ display: 'grid', justifyItems: 'center', gap: cq(6) }}>
          <Fan style={width(130)} />
          {letters ? (
            <span className="inv-foil" style={{ ...font, fontSize: cq(24), letterSpacing: '0.24em', textTransform: 'uppercase', paddingLeft: '0.24em' }}>{a}◆{b}</span>
          ) : null}
        </div>
      )
    case 'eq':
      return letters ? (
        <Vinyl a={a} b={b} font={font} />
      ) : (
        <Bars style={width(150)} />
      )
    case 'diamond':
      return letters ? (
        <div style={{ position: 'relative', width: cq(64), height: cq(64), display: 'grid', placeItems: 'center' }}>
          <span aria-hidden="true" style={{ position: 'absolute', inset: cq(9), border: '1px solid var(--inv-accent)', transform: 'rotate(45deg)' }} />
          <span aria-hidden="true" style={{ position: 'absolute', inset: cq(14), border: '1px solid color-mix(in srgb, var(--inv-accent) 45%, transparent)', transform: 'rotate(45deg)' }} />
          <span className="inv-foil" style={{ ...font, fontFamily: look.amp.font, fontStyle: 'italic', fontSize: cq(19), letterSpacing: '0.04em', position: 'relative' }}>{a}{b}</span>
        </div>
      ) : (
        <Diamond style={width(150)} />
      )
    case 'florals':
      return (
        <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
          <Florals style={width(170)} />
          {letters ? (
            <span className="inv-ink" style={{ ...font, position: 'absolute', top: '46%', left: 0, right: 0, transform: 'translateY(-50%)', fontSize: cq(30), lineHeight: 1, textShadow: '0 0 6px var(--inv-paper), 0 0 12px var(--inv-paper)' }}>{a}<span className="inv-amp" style={{ fontSize: '0.7em' }}> &amp; </span>{b}</span>
          ) : null}
        </div>
      )
    case 'sprig':
      return (
        <div style={{ display: 'grid', justifyItems: 'center', gap: cq(4) }}>
          {letters ? (
            <span style={{ position: 'relative', width: cq(64), height: cq(64), display: 'grid', placeItems: 'center', borderRadius: '50%', border: `${cq(1.4)} dashed color-mix(in srgb, var(--inv-accent) 70%, transparent)` }}>
              <span className="inv-ink" style={{ ...font, fontSize: cq(24), lineHeight: 1 }}>{a}<span className="inv-amp" style={{ fontSize: '0.6em' }}>&amp;</span>{b}</span>
            </span>
          ) : null}
          <Sprig style={width(140)} />
        </div>
      )
    case 'rule':
      return letters ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: cq(10), color: 'var(--inv-ink)' }}>
          <span style={{ fontFamily: look.names.font, fontWeight: 300, fontSize: cq(22), letterSpacing: '0.2em' }}>{a}</span>
          <span aria-hidden="true" style={{ width: cq(26), borderTop: '1px solid var(--inv-accent)' }} />
          <span style={{ fontFamily: look.names.font, fontWeight: 300, fontSize: cq(22), letterSpacing: '0.2em', paddingRight: '0' }}>{b}</span>
        </div>
      ) : (
        <Rule style={width(120)} />
      )
    default:
      return (
        <div style={{ display: 'grid', justifyItems: 'center', gap: cq(2) }}>
          {letters ? (
            <span className="inv-ink" style={{ ...font, fontSize: cq(32), lineHeight: 1 }}>{a}<span className="inv-amp" style={{ fontSize: '0.6em', margin: '0 0.12em' }}>&amp;</span>{b}</span>
          ) : null}
          <Flourish style={width(150)} />
        </div>
      )
  }
}

function Divider({ id, look }: { id: RsvpTemplateId; look: RsvpLook }) {
  const style: CSSProperties = { width: cq(110), height: 'auto', display: 'block', color: 'var(--inv-accent)' }
  if (id === 'garden') return <Sprig style={{ ...style, width: cq(96) }} />
  if (id === 'blush') return <Sprig style={{ ...style, width: cq(96) }} petals />
  if (id === 'deco') return <DecoRule style={style} />
  if (id === 'kraft') return <Rule style={style} dashed />
  if (id === 'after-dark') return <Bars style={{ ...style, width: cq(90) }} />
  if (look.ornament === 'diamond') return <Diamond style={style} />
  if (look.ornament === 'rule') return <Rule style={{ ...style, width: cq(60) }} />
  return <Flourish style={{ ...style, width: cq(96) }} small />
}

/* ---------- ornaments (all drawn in the accent, via currentColor) ---------- */

type Art = { style?: CSSProperties }

function Flourish({ style, small }: Art & { small?: boolean }) {
  const half = 'M96 14 C88 14 84 6 74 6 C64 6 62 17 52 17 C42 17 40 8 31 9 C23 10 20 16 8 13 M74 6 C69 10 72 15 77 12 M31 9 C34 12 31 15 28 13 M52 17 C50 21 54 23 57 21'
  return (
    <svg viewBox="0 0 200 28" style={style} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={small ? 1.1 : 1.3} strokeLinecap="round">
      <path d={half} />
      <path d={half} transform="translate(200 0) scale(-1 1)" />
      <path d="M100 7 L106 14 L100 21 L94 14 Z" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="196" cy="12.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

function Rule({ style, dashed }: Art & { dashed?: boolean }) {
  return (
    <svg viewBox="0 0 200 12" style={style} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1">
      <path d="M0 6 H86 M114 6 H200" strokeDasharray={dashed ? '5 4' : undefined} />
      <circle cx="100" cy="6" r="3" fill="currentColor" stroke="none" />
    </svg>
  )
}

function Diamond({ style }: Art) {
  return (
    <svg viewBox="0 0 200 20" style={style} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1">
      <path d="M0 10 H82 M118 10 H200 M40 6 H82 M118 14 H160" />
      <path d="M100 2 L108 10 L100 18 L92 10 Z" fill="currentColor" stroke="none" />
      <path d="M86 10 L89 7 L92 10 L89 13 Z M108 10 L111 7 L114 10 L111 13 Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

function DecoRule({ style }: Art) {
  return (
    <svg viewBox="0 0 200 22" style={style} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1">
      <path d="M0 11 H70 L76 5 H124 L130 11 H200 M76 17 H124 M86 11 H114" />
      <path d="M100 6 L105 11 L100 16 L95 11 Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

function Fan({ style }: Art) {
  const rays = Array.from({ length: 13 }, (_, index) => {
    const angle = Math.PI - (index * Math.PI) / 12
    return `M100 80 L${(100 + 72 * Math.cos(angle)).toFixed(1)} ${(80 - 72 * Math.sin(angle)).toFixed(1)}`
  }).join(' ')
  return (
    <svg viewBox="0 0 200 92" style={style} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1">
      <path d="M28 80 A72 72 0 0 1 172 80" />
      <path d="M44 80 A56 56 0 0 1 156 80" opacity="0.7" />
      <path d="M62 80 A38 38 0 0 1 138 80" />
      <path d={rays} opacity="0.75" />
      <path d="M80 80 A20 20 0 0 1 120 80 Z" fill="currentColor" stroke="none" />
      <path d="M10 80 H190 M24 86 H176 M40 91 H160" />
    </svg>
  )
}

function Bars({ style }: Art) {
  const heights = [6, 10, 16, 11, 22, 30, 18, 26, 34, 26, 18, 30, 22, 11, 16, 10, 6]
  return (
    <svg viewBox="0 0 170 36" style={{ ...style, filter: 'drop-shadow(0 0 3px currentColor)' }} aria-hidden="true" className="inv-bars">
      {heights.map((height, index) => (
        <rect key={index} x={index * 10 + 1} y={36 - height} width="6" height={height} rx="3" fill="currentColor" style={{ animationDelay: `${(index % 5) * -0.28}s` }} />
      ))}
    </svg>
  )
}

function Vinyl({ a, b, font }: { a: string; b: string; font: CSSProperties }) {
  return (
    <div style={{ position: 'relative', width: cq(96), aspectRatio: '1' }}>
      <svg viewBox="0 0 100 100" className="inv-spin" style={{ width: '100%', height: '100%', display: 'block', filter: 'drop-shadow(0 0 6px color-mix(in srgb, var(--inv-accent) 70%, transparent))' }} aria-hidden="true">
        <circle cx="50" cy="50" r="49" fill="#050308" stroke="var(--inv-accent)" strokeWidth="1.2" />
        {[44, 39, 34, 29].map((r) => (
          <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="0.8" />
        ))}
        <path d="M22 30 A34 34 0 0 1 40 17" stroke="rgba(255,255,255,.22)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="50" cy="50" r="19" fill="var(--inv-accent)" />
        <circle cx="50" cy="50" r="2.2" fill="#050308" />
      </svg>
      <span style={{ ...font, position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--inv-paper)', letterSpacing: '0.02em' }}>
        <span style={{ fontSize: cq(13) }}>{a}&amp;{b}</span>
      </span>
    </div>
  )
}

function Wreath({ style }: Art) {
  const leaves: ReactNode[] = []
  const cx = 60
  const cy = 60
  const r = 46
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 11; i += 1) {
      // from the bottom (90°) up each side, stopping short of the top
      const t = 90 + side * (i * 13 + 8)
      const rad = (t * Math.PI) / 180
      const x = cx + r * Math.cos(rad)
      const y = cy + r * Math.sin(rad)
      const tangent = t + side * 90
      const out = i % 2 === 0 ? 1 : -1
      // each leaf grows from the stem, angled toward the top of the wreath
      const lx = x + out * 3.2 * Math.cos(rad)
      const ly = y + out * 3.2 * Math.sin(rad)
      leaves.push(
        <ellipse key={`${side}-${i}`} cx={lx} cy={ly} rx="5.8" ry="2.5" transform={`rotate(${tangent - out * side * 28} ${lx} ${ly})`} fill="currentColor" fillOpacity={i % 3 === 0 ? 0.9 : 0.6} />,
      )
    }
  }
  return (
    <svg viewBox="0 0 120 120" style={style} aria-hidden="true">
      <path d="M60 106 A46 46 0 0 1 19 37 M60 106 A46 46 0 0 0 101 37" fill="none" stroke="currentColor" strokeWidth="1.1" />
      {leaves}
      <circle cx="60" cy="106" r="2.4" fill="currentColor" />
    </svg>
  )
}

function Sprig({ style, petals }: Art & { petals?: boolean }) {
  const leaves: ReactNode[] = []
  for (let i = 0; i < 7; i += 1) {
    const x = 18 + i * 13
    const y = 20 - Math.sin((i / 6) * Math.PI) * 6
    const up = i % 2 === 0
    leaves.push(
      <ellipse key={`l${i}`} cx={x} cy={y + (up ? -5 : 5)} rx={petals ? 4.2 : 5} ry={petals ? 4.2 : 3.6} fill="currentColor" fillOpacity={petals ? 0.35 : 0.5} stroke="currentColor" strokeWidth="0.8" />,
      <ellipse key={`r${i}`} cx={200 - x} cy={y + (up ? -5 : 5)} rx={petals ? 4.2 : 5} ry={petals ? 4.2 : 3.6} fill="currentColor" fillOpacity={petals ? 0.35 : 0.5} stroke="currentColor" strokeWidth="0.8" />,
    )
  }
  return (
    <svg viewBox="0 0 200 40" style={style} aria-hidden="true">
      <path d="M8 22 C50 8 80 26 100 20 C120 26 150 8 192 22" fill="none" stroke="currentColor" strokeWidth="1" />
      {leaves}
      <circle cx="100" cy="20" r="3" fill="currentColor" />
    </svg>
  )
}

function Flower({ x, y, r, turn = 0 }: { x: number; y: number; r: number; turn?: number }) {
  const petals = Array.from({ length: 6 }, (_, index) => {
    const angle = turn + index * 60
    return (
      <ellipse key={index} cx={x} cy={y - r * 0.55} rx={r * 0.42} ry={r * 0.62} transform={`rotate(${angle} ${x} ${y})`} fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="0.9" />
    )
  })
  return (
    <g>
      {petals}
      <circle cx={x} cy={y} r={r * 0.28} fill="currentColor" fillOpacity="0.55" />
      <circle cx={x} cy={y} r={r * 0.12} fill="currentColor" />
    </g>
  )
}

function Florals({ style }: Art) {
  return (
    <svg viewBox="0 0 220 90" style={style} aria-hidden="true">
      <g fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="0.8">
        <path d="M46 60 C30 54 18 58 6 68 C22 72 36 70 46 60 Z" />
        <path d="M174 60 C190 54 202 58 214 68 C198 72 184 70 174 60 Z" />
        <path d="M66 66 C76 76 88 80 100 78 C92 68 80 64 66 66 Z" />
        <path d="M154 66 C144 76 132 80 120 78 C128 68 140 64 154 66 Z" />
      </g>
      <Flower x={46} y={46} r={17} turn={10} />
      <Flower x={174} y={46} r={17} turn={-10} />
      <Flower x={18} y={36} r={8} turn={20} />
      <Flower x={202} y={36} r={8} turn={-20} />
    </svg>
  )
}

function BlushCorners() {
  const art = (transform: string, pos: CSSProperties) => (
    <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: 'absolute', width: cq(104), color: 'var(--inv-accent)', opacity: 0.8, ...pos }}>
      <g transform={transform}>
        <path d="M0 40 C20 30 30 18 34 0 M0 70 C28 58 50 40 60 0" fill="none" stroke="currentColor" strokeWidth="0.9" />
        <path d="M20 34 C10 26 8 16 12 8 C22 14 24 24 20 34 Z M44 30 C38 18 40 8 46 2 C52 12 50 22 44 30 Z" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="0.7" />
        <Flower x={22} y={22} r={13} />
        <Flower x={46} y={14} r={6} turn={30} />
        <Flower x={13} y={46} r={5} turn={10} />
      </g>
    </svg>
  )
  return (
    <>
      {art('', { top: 0, left: 0 })}
      {art('translate(100 100) rotate(180)', { bottom: 0, right: 0 })}
    </>
  )
}

function Corners({ kind }: { kind: 'gold' | 'deco' }) {
  const draw =
    kind === 'deco'
      ? 'M2 30 V2 H30 M8 30 V8 H30 M14 30 V14 H30'
      : 'M2 22 V2 H22 M6 2 L2 6'
  const at = (pos: CSSProperties, rotate: number) => (
    <svg className="inv-corner" viewBox="0 0 32 32" aria-hidden="true" style={{ ...pos, transform: `rotate(${rotate}deg)` }}>
      <path d={draw} fill="none" stroke="currentColor" strokeWidth="1.2" />
      {kind === 'gold' ? <path d="M8 8 L12 12 L8 16 L4 12 Z" fill="currentColor" transform="translate(4 -4)" /> : null}
    </svg>
  )
  const edge = cq(6)
  return (
    <>
      {at({ top: edge, left: edge }, 0)}
      {at({ top: edge, right: edge }, 90)}
      {at({ bottom: edge, right: edge }, 180)}
      {at({ bottom: edge, left: edge }, 270)}
    </>
  )
}

/* ---------- the envelope ---------- */

/** The name on the envelope shrinks to fit on one line, however long the family name. */
function addressSize(text: string, uppercase: boolean): string {
  const fits = uppercase ? 18 : 24
  const factor = Math.min(1, fits / Math.max(text.length, 1))
  const px = (uppercase ? 18 : 24) * factor
  return `clamp(11px, ${(px / 4.2).toFixed(2)}vw, ${px.toFixed(1)}px)`
}

type Phase = 'closed' | 'opening' | 'rising' | 'open'

function shade(hex: string, amount: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) return hex
  const value = parseInt(match[1], 16)
  const parts = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) =>
    Math.max(0, Math.min(255, Math.round(amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount)))),
  )
  return `#${parts.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function linerFor(look: RsvpLook, accent: string): string {
  const soft = `color-mix(in srgb, ${accent} 30%, ${look.envelope.flap})`
  switch (look.envelope.liner) {
    case 'stripes':
      return `repeating-linear-gradient(45deg, ${accent} 0 6px, ${look.envelope.flap} 6px 14px)`
    case 'dots':
      return `radial-gradient(circle, ${accent} 2.2px, transparent 2.6px) 0 0 / 14px 14px, ${soft}`
    case 'deco':
      return `repeating-linear-gradient(90deg, ${accent} 0 1px, transparent 1px 10px), repeating-linear-gradient(0deg, ${accent} 0 1px, transparent 1px 10px), ${look.envelope.flap}`
    case 'leaves':
      return `radial-gradient(ellipse 5px 9px at 50% 50%, ${accent} 70%, transparent 74%) 0 0 / 18px 18px, radial-gradient(ellipse 9px 5px at 50% 50%, color-mix(in srgb, ${accent} 60%, transparent) 70%, transparent 74%) 9px 9px / 18px 18px, ${soft}`
    default:
      return accent
  }
}

/**
 * The invitation in its envelope. A tap on the wax seal opens the flap, the
 * card rises out, and the card settles in place. It plays once per guest on
 * a device (remembered in the browser); with reduced motion it simply opens.
 */
export function EnvelopeInvitation({
  view,
  rememberAs,
  replay = 0,
  children,
}: {
  view: InviteView
  /** A key to remember that this guest already opened it; empty never remembers. */
  rememberAs?: string
  /** Bump to play the envelope again (the studio's "Play the envelope"). */
  replay?: number
  /** Shown under the card once it is open (the RSVP button and details). */
  children?: ReactNode
}) {
  const [phase, setPhase] = useState<Phase>(view.envelope ? 'closed' : 'open')
  const timers = useRef<number[]>([])
  const { look, tint, vars } = useLook(view)

  useEffect(() => {
    if (!view.envelope) {
      setPhase('open')
      return
    }
    if (rememberAs) {
      try {
        if (window.localStorage.getItem(`invite-opened:${rememberAs}`) === '1') setPhase('open')
      } catch {
        // Storage can be blocked; the envelope just shows again.
      }
    }
  }, [rememberAs, view.envelope])

  useEffect(() => {
    if (replay > 0 && view.envelope) setPhase('closed')
  }, [replay, view.envelope])

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])

  function open() {
    if (rememberAs) {
      try {
        window.localStorage.setItem(`invite-opened:${rememberAs}`, '1')
      } catch {
        // Not remembered; nothing else changes.
      }
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setPhase('open')
      return
    }
    setPhase('opening')
    timers.current.push(window.setTimeout(() => setPhase('rising'), 620))
    timers.current.push(window.setTimeout(() => setPhase('open'), 620 + 1150))
  }

  if (phase === 'open') {
    return (
      <div className="inv-reveal" style={{ width: '100%' }}>
        <InvitationStyles />
        <div style={{ maxWidth: 440, margin: '0 auto' }}>
          <InvitationCard view={view} />
        </div>
        {children}
      </div>
    )
  }

  const seal = tint.accent
  const env = {
    ...vars,
    // a colourway with its own paper (Art Deco's Midnight) dresses the envelope to match
    '--env-body': tint.paper ? shade(tint.paper, 0.07) : look.envelope.body,
    '--env-flap': tint.paper ? shade(tint.paper, 0.03) : look.envelope.flap,
    '--env-ink': look.envelope.ink,
    '--env-liner': linerFor(look, tint.accent),
    '--seal': seal,
    '--seal-hi': shade(seal, 0.35),
    '--seal-lo': shade(seal, -0.35),
    '--seal-ink': shade(seal, -0.55),
  } as CSSProperties
  const [a, b] = view.letters
  return (
    <div className="inv-env-stage">
      <InvitationStyles />
      <div className="inv-env" data-phase={phase} style={env}>
        <div className="inv-env-back" />
        <div className="inv-env-slot" aria-hidden="true">
          <div className="inv-env-card">
            <InvitationCard view={view} />
          </div>
        </div>
        <div className="inv-env-pocket" />
        <p className="inv-env-addr" style={{ fontFamily: look.names.font, fontStyle: look.names.style, fontWeight: look.names.weight, fontSize: addressSize(view.addressee || 'You’re invited', look.names.transform === 'uppercase'), textTransform: look.names.transform, letterSpacing: look.names.transform === 'uppercase' ? '0.1em' : 0 }}>
          {view.addressee || 'You’re invited'}
        </p>
        <div className="inv-env-flap" aria-hidden="true">
          <div className="out" />
          <div className="in" />
        </div>
        <button type="button" className="inv-seal" onClick={open} aria-label="Open your invitation" disabled={phase !== 'closed'}>
          <span style={{ position: 'relative', fontFamily: look.names.font, fontStyle: look.names.style, fontWeight: 600, fontSize: 'clamp(13px, 4.4vw, 19px)', lineHeight: 1, textShadow: '0 1px 0 rgba(255,255,255,.25)' }}>
            {view.monogram && a && b ? `${a}${b}` : '♥'}
          </span>
        </button>
      </div>
      <p className="inv-hint">
        <button type="button" className="inv-open-btn" onClick={open} disabled={phase !== 'closed'}>
          Open your invitation
        </button>
      </p>
    </div>
  )
}

/**
 * The buttons under the card: the main step (reply, or find your invitation)
 * and directions to the venue.
 */
export function InviteActions({
  view,
  primary,
}: {
  view: InviteView
  primary?: ReactNode
}) {
  const map = mapLink(view)
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
      {primary ?? (
        <a href="#reply" className={`${rsvpButtonFit} px-6`}>
          Reply below
        </a>
      )}
      {map ? (
        <a href={map} target="_blank" rel="noopener noreferrer" className={`${rsvpGhostFit} px-5`}>
          Map &amp; directions
        </a>
      ) : null}
    </div>
  )
}

/** A style's top ornament alone, in its colourway: the source for the email artwork. */
export function InviteOrnament({ view }: { view: InviteView }) {
  const { look, vars } = useLook(view)
  return (
    <div className="inv-card" style={{ ...vars, background: 'transparent', boxShadow: 'none', width: 380 }}>
      <InvitationStyles />
      <div style={{ display: 'grid', justifyItems: 'center' }}>
        <TopMark view={{ ...view, monogram: false }} look={look} />
      </div>
    </div>
  )
}
