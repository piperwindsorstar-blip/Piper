import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { longWeddingDate } from '../../lib/rsvp/model.ts'
import {
  PHOTO_WIDTH_MAX,
  compressSteps,
  fullFrame,
  isHeicFile,
  photoInputError,
  photoSizeLabel,
} from '../../lib/rsvp/photo.ts'
import {
  clearRsvpPhoto,
  saveRsvpPhoto,
  saveRsvpTemplate,
} from '../../lib/rsvp/rsvp.functions.ts'
import { RSVP_TEMPLATES, templateFor } from '../../lib/rsvp/templates.ts'
import type { RsvpTemplateId } from '../../lib/rsvp/templates.ts'
import { ActionButton, Spinner } from '../action-button.tsx'
import type { RunResult } from '../action-button.tsx'
import { rsvpButton, rsvpGhost, useRsvpTheme } from './shell.tsx'
import type { ReadyManage } from './manage.tsx'

type Draft = {
  image: ImageBitmap | HTMLImageElement
  width: number
  height: number
  url: string
}

/**
 * The couple's own invitation: pick one of the five templates and add a photo.
 * Every card shows their real names, date and photo, so what they see is what
 * guests get.
 *
 * The photo is always the whole picture at its own proportions — there is no
 * cropping step, no shape to choose and nothing to reposition. The couple
 * uploads, sees the result on their own card, and can replace or remove it.
 */
export function Design({ data }: { data: ReadyManage }) {
  const surface = useRsvpTheme()
  const useTemplate = useServerFn(saveRsvpTemplate)
  const upload = useServerFn(saveRsvpPhoto)
  const dropPhoto = useServerFn(clearRsvpPhoto)
  const router = useRouter()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [fileNote, setFileNote] = useState('')
  const [reading, setReading] = useState(false)

  const couple = `${data.wedding.partnerOne} & ${data.wedding.partnerTwo}`
  const dateLine = longWeddingDate(data.wedding.eventDate)
  const photoUrl = draft ? draft.url : (data.photo?.url ?? '')
  const naturalWidth = draft?.width ?? data.photo?.width ?? 0
  const naturalHeight = draft?.height ?? data.photo?.height ?? 0

  async function readFile(file: File) {
    const problem = photoInputError({
      name: file.name,
      size: file.size,
      type: file.type,
    })
    if (problem) {
      setFileNote(problem)
      return
    }
    setFileNote('')
    setReading(true)
    try {
      let blob: Blob = file
      if (isHeicFile({ name: file.name, size: file.size, type: file.type })) {
        const { heicTo } = await import('heic-to')
        blob = await heicTo({
          blob: file,
          type: 'image/jpeg',
          quality: 0.92,
        })
      }
      let image: ImageBitmap | HTMLImageElement
      try {
        // "from-image" applies the camera's rotation, so nothing arrives sideways.
        image = await createImageBitmap(blob, {
          imageOrientation: 'from-image',
        })
      } catch {
        image = await loadImage(blob)
      }
      const url = URL.createObjectURL(blob)
      if (draft) URL.revokeObjectURL(draft.url)
      setDraft({
        image,
        width: image.width,
        height: image.height,
        url,
      })
    } catch {
      setFileNote('That photo could not be opened. Try a JPG or PNG.')
    } finally {
      setReading(false)
    }
  }

  /**
   * The JPEG the site stores: the couple's whole photo, drawn at the photo's
   * own shape, so a portrait stays a portrait and a landscape stays a
   * landscape and nothing is trimmed. It is 1200px wide at most, under 300 KB,
   * and re-encoded, which is what drops the camera's location metadata.
   */
  function trimmedPhoto(): {
    dataUrl: string
    bytes: number
    width: number
    height: number
  } | null {
    if (!draft) return null
    const frame = fullFrame(draft.width, draft.height)
    const encoded = encodeFrame(draft.image, frame)
    return encoded
      ? { ...encoded, width: frame.width, height: frame.height }
      : null
  }

  return (
    <div className="grid max-w-4xl gap-6">
      <div>
        <p className="text-xs tracking-[0.16em] text-[var(--text-muted)]">
          INVITATIONS
        </p>
        <h1 className="portal-display text-4xl">Pick your invitation</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          One choice dresses the invitation, the reminder, the confirmation and
          the thank-you letters, and your guest page matches it. Classic Ivory
          is the default.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {RSVP_TEMPLATES.map((template) => {
          const active = template.id === data.wedding.template
          return (
            <TemplateCard
              key={template.id}
              templateId={template.id}
              couple={couple}
              dateLine={dateLine}
              photoUrl={photoUrl}
              naturalWidth={naturalWidth}
              naturalHeight={naturalHeight}
              active={active}
              surface={surface}
              onUse={async (): Promise<RunResult> => {
                const result = await useTemplate({
                  data: { template: template.id },
                })
                if (result.ok) await router.invalidate()
                return {
                  ok: result.ok,
                  message: result.ok
                    ? `${template.name} is in use.`
                    : result.error,
                }
              }}
            />
          )
        })}
      </div>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="font-semibold">Your photo</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          JPG, PNG or HEIC up to 10 MB. Your whole photo is used, at its own
          shape — nothing is cropped. It is resized to 1200px and kept under 300
          KB, the rotation is fixed and the location data is stripped. The photo
          is stored on this site and served from piperpweddingdj.services.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-3">
            {draft ? (
              <div className="grid gap-2">
                <img
                  src={draft.url}
                  alt="The photo you picked"
                  className="mx-auto block h-auto w-full rounded-[14px] border border-[var(--border-strong)]"
                />
                <p className="text-xs text-[var(--text-faint)]">
                  Your whole photo, nothing cropped. It keeps its own shape.
                  Press Save photo to use it.
                </p>
              </div>
            ) : data.photo ? (
              <div className="grid gap-2">
                <img
                  src={data.photo.url}
                  alt={data.photo.alt}
                  className="mx-auto block h-auto w-full rounded-[14px]"
                  style={
                    data.photo.width > 0 && data.photo.height > 0
                      ? {
                          aspectRatio: `${data.photo.width} / ${data.photo.height}`,
                        }
                      : undefined
                  }
                />
                <p className="text-xs text-[var(--text-faint)]">
                  Saved photo · {photoSizeLabel(data.photo.bytes)}
                  {data.photo.width > 0 && data.photo.height > 0
                    ? ` · ${data.photo.width}×${data.photo.height}`
                    : ''}
                </p>
              </div>
            ) : (
              <div
                className="grid w-full place-items-center rounded-[14px] border border-dashed border-[var(--border-strong)] text-sm text-[var(--text-faint)]"
                style={{ aspectRatio: '4 / 3' }}
              >
                Your photo runs here
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <label
                className={`${rsvpGhost} w-auto cursor-pointer gap-2 px-4`}
                aria-disabled={reading}
              >
                {reading ? <Spinner label="Reading the photo" /> : null}
                {draft || data.photo
                  ? 'Choose another photo'
                  : 'Add your photo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/heic,image/heif"
                  className="sr-only"
                  disabled={reading}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) void readFile(file)
                  }}
                />
              </label>
              {draft ? (
                <ActionButton
                  className={`${rsvpButton} w-auto px-5`}
                  busy="Uploading…"
                  done="Saved"
                  surface={surface}
                  onRun={async (): Promise<RunResult> => {
                    const whole = trimmedPhoto()
                    if (!whole) {
                      return {
                        ok: false,
                        message: 'That photo could not be read.',
                      }
                    }
                    const result = await upload({
                      data: {
                        dataUrl: whole.dataUrl,
                        // The whole photo's own size: a portrait and a
                        // landscape both keep their proportions.
                        width: whole.width,
                        height: whole.height,
                      },
                    })
                    if (!result.ok) return { ok: false, message: result.error }
                    URL.revokeObjectURL(draft.url)
                    setDraft(null)
                    await router.invalidate()
                    return {
                      ok: true,
                      message: `Saved · ${photoSizeLabel(whole.bytes)}`,
                    }
                  }}
                >
                  Save photo
                </ActionButton>
              ) : null}
              {!draft && data.photo ? (
                <ActionButton
                  className={`${rsvpGhost} w-auto px-4`}
                  busy="Removing…"
                  done="Removed"
                  surface={surface}
                  onRun={async (): Promise<RunResult> => {
                    const result = await dropPhoto()
                    if (result.ok) await router.invalidate()
                    return {
                      ok: result.ok,
                      message: result.ok
                        ? 'Your invitations run without a photo again.'
                        : result.error,
                    }
                  }}
                >
                  Remove photo
                </ActionButton>
              ) : null}
            </div>

            {fileNote ? (
              <p role="alert" className="text-sm text-rose-400">
                {fileNote}
              </p>
            ) : null}
          </div>

          <div className="grid content-start gap-2">
            <p className="text-sm text-[var(--text-muted)]">
              Live preview of the invitation card your guests open:
            </p>
            <InvitationPreview
              templateId={data.wedding.template}
              couple={couple}
              dateLine={dateLine}
              photoUrl={photoUrl}
              naturalWidth={naturalWidth}
              naturalHeight={naturalHeight}
            />
          </div>
        </div>
      </section>
    </div>
  )
}

/** The card as the guest opens it: photo, names, date, one RSVP button. */
function InvitationPreview({
  templateId,
  couple,
  dateLine,
  photoUrl,
  naturalWidth = 0,
  naturalHeight = 0,
}: {
  templateId: RsvpTemplateId
  couple: string
  dateLine: string
  photoUrl: string
  naturalWidth?: number
  naturalHeight?: number
}) {
  const { skin } = templateFor(templateId)
  return (
    <div
      className="mx-auto w-full max-w-[380px] p-4"
      style={{ background: skin.backdrop }}
    >
      <div
        style={{
          background: skin.card,
          border: skin.cardBorder,
          borderRadius: skin.cardRadius,
          padding: '22px 18px',
          textAlign: 'center',
        }}
      >
        {photoUrl ? (
          // The whole photo, full width, in the card's own paper. It keeps the
          // couple's proportions, so a portrait stays tall and a landscape
          // stays wide.
          <img
            src={photoUrl}
            alt="Your photo in the invitation"
            className="mx-auto block h-auto w-full"
            style={{
              borderRadius: '12px',
              ...(naturalWidth > 0 && naturalHeight > 0
                ? { aspectRatio: `${naturalWidth} / ${naturalHeight}` }
                : {}),
            }}
          />
        ) : null}
        <p
          style={{
            fontFamily: skin.displayFont,
            fontSize: 9,
            letterSpacing: skin.labelLetter,
            textTransform: skin.labelTransform,
            color: skin.accent,
            margin: photoUrl ? '16px 0 0' : 0,
          }}
        >
          Together with their families
        </p>
        <p
          style={{
            fontFamily: skin.displayFont,
            fontStyle: skin.scriptNames ? 'italic' : 'normal',
            fontWeight: skin.nameWeight,
            fontSize: skin.scriptNames ? 30 : 24,
            color: skin.ink,
            margin: '10px 0 0',
            lineHeight: 1.3,
          }}
        >
          {couple}
        </p>
        <p
          style={{
            fontFamily: skin.bodyFont,
            fontSize: 12,
            color: skin.body,
            margin: '10px 0 0',
          }}
        >
          {dateLine}
        </p>
        <div style={{ margin: '16px 0' }}>
          {skin.divider === 'hairline' ? (
            <span
              style={{
                display: 'block',
                borderTop: `1px solid ${skin.accent}`,
                fontSize: 0,
              }}
            />
          ) : (
            <span
              style={{
                color: skin.accent,
                letterSpacing: '0.4em',
                fontSize: 12,
              }}
            >
              ❖
            </span>
          )}
        </div>
        <span
          style={{
            display: 'inline-block',
            background: skin.button.bg,
            color: skin.button.fg,
            borderRadius: skin.button.radius,
            padding: '8px 22px',
            fontFamily: skin.displayFont,
            fontSize: 12,
          }}
        >
          RSVP
        </span>
      </div>
    </div>
  )
}

function TemplateCard({
  templateId,
  couple,
  dateLine,
  photoUrl,
  naturalWidth,
  naturalHeight,
  active,
  surface,
  onUse,
}: {
  templateId: RsvpTemplateId
  couple: string
  dateLine: string
  photoUrl: string
  naturalWidth: number
  naturalHeight: number
  active: boolean
  surface: 'dark' | 'light'
  onUse: () => Promise<RunResult>
}) {
  const template = templateFor(templateId)
  return (
    <section className="grid gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
      {/* Each card previews the couple's own names, date and photo in that
          template's paper, so the choice is made against their real card. */}
      <InvitationPreview
        templateId={templateId}
        couple={couple}
        dateLine={dateLine}
        photoUrl={photoUrl}
        naturalWidth={naturalWidth}
        naturalHeight={naturalHeight}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{template.name}</h2>
          <p className="text-sm text-[var(--text-muted)]">{template.blurb}</p>
        </div>
        <span className="flex shrink-0 gap-1" aria-hidden="true">
          {template.swatch.map((colour) => (
            <span
              key={colour}
              className="h-5 w-5 rounded-full border border-black/20"
              style={{ background: colour }}
            />
          ))}
        </span>
      </div>
      {active ? (
        <p className="text-sm font-semibold text-[var(--pink-soft)]">
          In use ✓
        </p>
      ) : (
        <ActionButton
          className={`${rsvpGhost} w-auto justify-self-start px-4`}
          busy="Applying…"
          done="In use"
          surface={surface}
          onRun={onUse}
        >
          Use this template
        </ActionButton>
      )}
    </section>
  )
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('decode'))
    }
    image.src = url
  })
}

/**
 * Draws the whole photo onto a canvas at its own size and re-encodes it as a
 * JPEG, stepping down the width and the quality until it lands under 300 KB.
 * Re-encoding is also what drops the camera's location metadata: only pixels
 * survive.
 */
function encodeFrame(
  image: ImageBitmap | HTMLImageElement,
  frame: ReturnType<typeof fullFrame>,
): { dataUrl: string; bytes: number } | null {
  const canvas = document.createElement('canvas')
  canvas.width = frame.width
  canvas.height = frame.height
  const context = canvas.getContext('2d')
  if (!context) return null
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, frame.x, frame.y, frame.drawWidth, frame.drawHeight)
  const attempts = new Map<string, { url: string; bytes: number }>()
  const step = compressStepsLocal(canvas, attempts)
  const chosen = attempts.get(`${step.width}:${step.quality}`)
  return chosen ? { dataUrl: chosen.url, bytes: chosen.bytes } : null
}

function compressStepsLocal(
  canvas: HTMLCanvasElement,
  attempts: Map<string, { url: string; bytes: number }>,
): { width: number; quality: number; bytes: number } {
  const encode = (width: number, quality: number): number => {
    const scaled = document.createElement('canvas')
    const ratio = Math.min(1, width / canvas.width)
    scaled.width = Math.max(1, Math.round(canvas.width * ratio))
    scaled.height = Math.max(1, Math.round(canvas.height * ratio))
    const context = scaled.getContext('2d')
    if (!context) return Number.MAX_SAFE_INTEGER
    context.drawImage(canvas, 0, 0, scaled.width, scaled.height)
    const url = scaled.toDataURL('image/jpeg', quality)
    const base64 = url.slice(url.indexOf(',') + 1)
    const bytes = Math.round((base64.length * 3) / 4)
    attempts.set(`${width}:${quality}`, { url, bytes })
    return bytes
  }
  return compressSteps(PHOTO_WIDTH_MAX, encode)
}
