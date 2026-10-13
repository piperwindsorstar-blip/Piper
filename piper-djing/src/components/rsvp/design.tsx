import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { longWeddingDate } from '../../lib/rsvp/model.ts'
import {
  PHOTO_WIDTH_MAX,
  compressSteps,
  cropFrame,
  frameStyle,
  isHeicFile,
  photoInputError,
  photoSizeLabel,
} from '../../lib/rsvp/photo.ts'
import {
  clearRsvpPhoto,
  saveRsvpPhoto,
  saveRsvpPhotoShape,
  saveRsvpTemplate,
} from '../../lib/rsvp/rsvp.functions.ts'
import {
  PHOTO_SHAPES,
  RSVP_TEMPLATES,
  shapeLabel,
  shapeSize,
  templateFor,
} from '../../lib/rsvp/templates.ts'
import type { PhotoShape, RsvpTemplateId } from '../../lib/rsvp/templates.ts'
import { ActionButton, Spinner } from '../action-button.tsx'
import type { RunResult } from '../action-button.tsx'
import { rsvpButton, rsvpGhost, useRsvpTheme } from './shell.tsx'
import type { ReadyManage } from './manage.tsx'

type Draft = {
  image: ImageBitmap | HTMLImageElement
  width: number
  height: number
  url: string
  name: string
}

/**
 * The couple's own invitation: pick one of the five templates, add a photo and
 * crop it. Every card shows their real names, date and photo, so what they see
 * is what guests get.
 */
export function Design({ data }: { data: ReadyManage }) {
  const surface = useRsvpTheme()
  const useTemplate = useServerFn(saveRsvpTemplate)
  const upload = useServerFn(saveRsvpPhoto)
  const setShapeOnServer = useServerFn(saveRsvpPhotoShape)
  const dropPhoto = useServerFn(clearRsvpPhoto)
  const router = useRouter()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [shape, setShape] = useState<PhotoShape>(
    data.photo?.shape ?? templateFor(data.wedding.template).skin.photoShape,
  )
  const [fileNote, setFileNote] = useState('')
  const [reading, setReading] = useState(false)
  const drag = useRef<{
    x: number
    y: number
    boxW: number
    boxH: number
  } | null>(null)

  const couple = `${data.wedding.partnerOne} & ${data.wedding.partnerTwo}`
  const dateLine = longWeddingDate(data.wedding.eventDate)
  const frame = draft
    ? cropFrame({
        imageWidth: draft.width,
        imageHeight: draft.height,
        shape,
        zoom,
        panX: pan.x,
        panY: pan.y,
      })
    : null

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
        name: file.name,
      })
      setZoom(1)
      setPan({ x: 0, y: 0 })
    } catch {
      setFileNote('That photo could not be opened. Try a JPG or PNG.')
    } finally {
      setReading(false)
    }
  }

  /** The trimmed JPEG: 1200px wide at most, under 300 KB, no EXIF left in it. */
  function trimmedPhoto(): { dataUrl: string; bytes: number } | null {
    if (!draft || !frame) return null
    const canvas = document.createElement('canvas')
    canvas.width = frame.width
    canvas.height = frame.height
    const context = canvas.getContext('2d')
    if (!context) return null
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(
      draft.image,
      frame.x,
      frame.y,
      frame.drawWidth,
      frame.drawHeight,
    )
    const attempts = new Map<string, { url: string; bytes: number }>()
    const step = compressStepsLocal(canvas, attempts)
    const chosen = attempts.get(`${step.width}:${step.quality}`)
    return chosen ? { dataUrl: chosen.url, bytes: chosen.bytes } : null
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!frame) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      boxW: event.currentTarget.clientWidth,
      boxH: event.currentTarget.clientHeight,
    }
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const start = drag.current
    if (!start || !frame) return
    const slackX =
      ((frame.drawWidth - frame.width) / 2 / frame.width) * start.boxW
    const slackY =
      ((frame.drawHeight - frame.height) / 2 / frame.height) * start.boxH
    setPan({
      x: slackX > 1 ? clamp(pan.x - (event.clientX - start.x) / slackX) : 0,
      y: slackY > 1 ? clamp(pan.y - (event.clientY - start.y) / slackY) : 0,
    })
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
          JPG, PNG or HEIC up to 10 MB. It is resized to 1200px and kept under
          300 KB, the rotation is fixed and the location data is stripped. The
          photo is stored on this site and served from piperpweddingdj.services.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-3">
            {draft && frame ? (
              <div
                className="relative w-full touch-none overflow-hidden border border-[var(--border-strong)] bg-black/40 select-none"
                style={{
                  aspectRatio: `${frame.width} / ${frame.height}`,
                  borderRadius: previewRadius(shape),
                  cursor: 'grab',
                }}
                onPointerDown={startDrag}
                onPointerMove={moveDrag}
                onPointerUp={() => {
                  drag.current = null
                }}
                onPointerCancel={() => {
                  drag.current = null
                }}
              >
                <img
                  src={draft.url}
                  alt="Your photo, as it will be cropped"
                  draggable={false}
                  className="absolute max-w-none"
                  style={frameStyle(frame)}
                />
              </div>
            ) : data.photo ? (
              <img
                src={data.photo.url}
                alt={data.photo.alt}
                className="mx-auto block h-auto w-full object-cover"
                style={{
                  maxWidth: shape === 'banner' ? '100%' : '76%',
                  borderRadius: previewRadius(shape),
                  aspectRatio: aspectFor(shape),
                }}
              />
            ) : (
              <div
                className="grid w-full place-items-center border border-dashed border-[var(--border-strong)] text-sm text-[var(--text-faint)]"
                style={{
                  aspectRatio: aspectFor(shape),
                  borderRadius: previewRadius(shape),
                }}
              >
                Your photo runs here
              </div>
            )}

            {draft ? (
              <>
                <label className="text-sm" htmlFor="photo-zoom">
                  Zoom
                  <input
                    id="photo-zoom"
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={zoom}
                    onChange={(event) => setZoom(Number(event.target.value))}
                    className="mt-1 w-full"
                  />
                </label>
                <p className="text-xs text-[var(--text-faint)]">
                  Drag the photo to line it up.
                </p>
              </>
            ) : null}

            <fieldset className="grid gap-2">
              <legend className="text-sm text-[var(--text-muted)]">
                Shape
              </legend>
              <div className="flex flex-wrap gap-2">
                {PHOTO_SHAPES.map((item) =>
                  draft || !data.photo ? (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={shape === item}
                      className={`min-h-11 rounded-full border px-3 text-sm ${shape === item ? 'border-[var(--pink)] text-[var(--pink-soft)]' : 'border-[var(--border-strong)] text-[var(--text-muted)]'}`}
                      onClick={() => setShape(item)}
                    >
                      {shapeLabel(item)}
                    </button>
                  ) : (
                    <ActionButton
                      key={item}
                      className={`min-h-11 rounded-full border px-3 text-sm ${data.photo.shape === item ? 'border-[var(--pink)] text-[var(--pink-soft)]' : 'border-[var(--border-strong)] text-[var(--text-muted)]'}`}
                      wrapperClassName="inline-grid"
                      busy="Saving…"
                      done="Saved"
                      surface={surface}
                      onRun={async (): Promise<RunResult> => {
                        const result = await setShapeOnServer({
                          data: { shape: item },
                        })
                        if (result.ok) {
                          setShape(item)
                          await router.invalidate()
                        }
                        return {
                          ok: result.ok,
                          message: result.ok
                            ? `Shape set to ${shapeLabel(item)}.`
                            : result.error,
                        }
                      }}
                    >
                      {shapeLabel(item)}
                    </ActionButton>
                  ),
                )}
              </div>
            </fieldset>

            <div className="flex flex-wrap items-center gap-3">
              <label
                className={`${rsvpGhost} w-auto cursor-pointer gap-2 px-4`}
                aria-disabled={reading}
              >
                {reading ? <Spinner label="Reading the photo" /> : null}
                {draft
                  ? 'Choose another photo'
                  : data.photo
                    ? 'Replace photo'
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
                    const trimmed = trimmedPhoto()
                    if (!trimmed) {
                      return {
                        ok: false,
                        message: 'That photo could not be read.',
                      }
                    }
                    const result = await upload({
                      data: {
                        dataUrl: trimmed.dataUrl,
                        shape,
                        width: frame?.width ?? 0,
                        height: frame?.height ?? 0,
                      },
                    })
                    if (!result.ok) return { ok: false, message: result.error }
                    URL.revokeObjectURL(draft.url)
                    setDraft(null)
                    await router.invalidate()
                    return {
                      ok: true,
                      message: `Saved · ${photoSizeLabel(trimmed.bytes)}`,
                    }
                  }}
                >
                  Save photo
                </ActionButton>
              ) : data.photo ? (
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
            {data.photo && !draft ? (
              <p className="text-xs text-[var(--text-faint)]">
                Saved photo · {photoSizeLabel(data.photo.bytes)} ·{' '}
                {data.photo.shape === 'circle'
                  ? 'circle'
                  : data.photo.shape === 'arch'
                    ? 'arch'
                    : 'full-width banner'}
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
              photoUrl={draft ? draft.url : (data.photo?.url ?? '')}
              shape={shape}
              frame={frame}
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
  shape,
  frame,
}: {
  templateId: RsvpTemplateId
  couple: string
  dateLine: string
  photoUrl: string
  shape: PhotoShape
  frame: ReturnType<typeof cropFrame> | null
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
          frame ? (
            <div
              className="relative overflow-hidden"
              style={{
                aspectRatio: `${frame.width} / ${frame.height}`,
                borderRadius: previewRadius(shape),
              }}
            >
              <img
                src={photoUrl}
                alt="Your photo in the invitation"
                className="absolute max-w-none"
                style={frameStyle(frame)}
              />
            </div>
          ) : (
            <img
              src={photoUrl}
              alt="Your photo in the invitation"
              className="mx-auto block h-auto w-full object-cover"
              style={{
                maxWidth: shape === 'banner' ? '100%' : '70%',
                borderRadius: previewRadius(shape),
              }}
            />
          )
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
  active,
  surface,
  onUse,
}: {
  templateId: RsvpTemplateId
  couple: string
  dateLine: string
  active: boolean
  surface: 'dark' | 'light'
  onUse: () => Promise<RunResult>
}) {
  const template = templateFor(templateId)
  return (
    <section className="grid gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <InvitationPreview
        templateId={templateId}
        couple={couple}
        dateLine={dateLine}
        photoUrl=""
        shape={template.skin.photoShape}
        frame={null}
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

function previewRadius(shape: PhotoShape): string {
  if (shape === 'circle') return '50%'
  if (shape === 'arch') return '999px 999px 0 0'
  return '12px'
}

function aspectFor(shape: PhotoShape): string {
  const size = shapeSize(shape)
  return `${size.width} / ${size.height}`
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(-1, value))
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
 * Resizes and re-encodes the cropped canvas as a JPEG, stepping down the width
 * and the quality until it lands under 300 KB. Re-encoding is also what drops
 * the camera's location metadata: only pixels survive.
 */
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
