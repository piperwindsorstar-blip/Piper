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
  sourceRect,
  uploadFrames,
} from '../../lib/rsvp/photo.ts'
import {
  clearRsvpPhoto,
  saveRsvpPhoto,
  saveRsvpPhotoCrop,
  saveRsvpTemplate,
} from '../../lib/rsvp/rsvp.functions.ts'
import {
  CENTRE_CROP,
  PHOTO_SHAPES,
  RSVP_TEMPLATES,
  shapeLabel,
  shapeSize,
  templateFor,
} from '../../lib/rsvp/templates.ts'
import type {
  PhotoCrop,
  PhotoShape,
  RsvpTemplateId,
} from '../../lib/rsvp/templates.ts'
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
  /** A new upload stores the whole photo; opening a saved one only moves the crop. */
  fresh: boolean
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
  const saveCrop = useServerFn(saveRsvpPhotoCrop)
  const dropPhoto = useServerFn(clearRsvpPhoto)
  const router = useRouter()
  const [draft, setDraft] = useState<Draft | null>(null)
  // Starts centred on the middle of the photo and zoomed all the way out, so
  // the whole picture is visible before the couple moves anything.
  const [crop, setCrop] = useState<PhotoCrop>(data.photo?.crop ?? CENTRE_CROP)
  const [shape, setShape] = useState<PhotoShape>(
    data.photo?.shape ?? templateFor(data.wedding.template).skin.photoShape,
  )
  const [fileNote, setFileNote] = useState('')
  const [reading, setReading] = useState(false)
  const drag = useRef<{
    x: number
    y: number
    rectWidth: number
    rectHeight: number
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
        zoom: crop.zoom,
        panX: crop.panX,
        panY: crop.panY,
      })
    : null
  const rect = draft
    ? sourceRect({
        imageWidth: draft.width,
        imageHeight: draft.height,
        shape,
        zoom: crop.zoom,
        panX: crop.panX,
        panY: crop.panY,
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
        fresh: true,
      })
      setCrop(CENTRE_CROP)
    } catch {
      setFileNote('That photo could not be opened. Try a JPG or PNG.')
    } finally {
      setReading(false)
    }
  }

  /** The frames an upload stores: the whole photo, and the crop when shaped. */
  function draftFrames() {
    if (!draft) return null
    return uploadFrames({
      imageWidth: draft.width,
      imageHeight: draft.height,
      shape,
      zoom: crop.zoom,
      panX: crop.panX,
      panY: crop.panY,
    })
  }

  /**
   * The JPEG the site stores: the couple's whole photo, always, drawn at the
   * photo's own shape so nothing is trimmed here. A shape adds a second,
   * shaped rendition beside it, which is why switching back to Full photo can
   * show the picture the couple uploaded rather than a crop of it. Either way
   * it is 1200px wide at most, under 300 KB, and re-encoded, which is what
   * drops the camera's location metadata.
   */
  function trimmedPhoto(): {
    dataUrl: string
    bytes: number
    width: number
    height: number
  } | null {
    const frames = draftFrames()
    if (!draft || !frames) return null
    const encoded = encodeFrame(draft.image, frames.whole)
    return encoded
      ? {
          ...encoded,
          width: frames.whole.width,
          height: frames.whole.height,
        }
      : null
  }

  /** The shaped rendition: the same photo drawn through the couple's crop. */
  function trimmedCrop(): { dataUrl: string; bytes: number } | null {
    const frames = draftFrames()
    if (!draft || !frames?.crop) return null
    return encodeFrame(draft.image, frames.crop)
  }

  /** Opens the couple's saved photo in the editor, so they can move its crop. */
  async function openSaved(): Promise<Draft | null> {
    if (!data.photo) return null
    setReading(true)
    try {
      const response = await fetch(data.photo.wholeUrl)
      const blob = await response.blob()
      let image: ImageBitmap | HTMLImageElement
      try {
        image = await createImageBitmap(blob, {
          imageOrientation: 'from-image',
        })
      } catch {
        image = await loadImage(blob)
      }
      const url = URL.createObjectURL(blob)
      if (draft) URL.revokeObjectURL(draft.url)
      const opened: Draft = {
        image,
        width: image.width,
        height: image.height,
        url,
        name: 'your photo',
        fresh: false,
      }
      setDraft(opened)
      return opened
    } catch {
      setFileNote('That photo could not be opened. Try uploading it again.')
      return null
    } finally {
      setReading(false)
    }
  }

  /**
   * Picking a shape opens the crop tool on the whole photo, centred and zoomed
   * out. Nothing is saved until the couple presses Save photo, so they always
   * see the crop before it reaches a guest.
   */
  async function chooseShape(item: PhotoShape) {
    setFileNote('')
    setShape(item)
    setCrop(CENTRE_CROP)
    if (!draft && data.photo) await openSaved()
  }

  /** Saves only the crop: the whole photo already stored is left untouched. */
  async function saveCropOnly(): Promise<RunResult> {
    if (!frame) return { ok: false, message: 'That photo could not be read.' }
    const shaped = trimmedCrop()
    if (shape !== 'full' && !shaped) {
      return { ok: false, message: 'That crop could not be read.' }
    }
    const result = await saveCrop({
      data: {
        shape,
        cropUrl: shaped?.dataUrl ?? '',
        zoom: crop.zoom,
        panX: crop.panX,
        panY: crop.panY,
      },
    })
    if (!result.ok) return { ok: false, message: result.error }
    if (draft) URL.revokeObjectURL(draft.url)
    setDraft(null)
    await router.invalidate()
    return { ok: true, message: `Saved · ${shapeLabel(shape)}` }
  }

  function nudge(step: { panX?: number; panY?: number }) {
    setCrop((current) => ({
      zoom: current.zoom,
      panX: clampPan(current.panX + (step.panX ?? 0)),
      panY: clampPan(current.panY + (step.panY ?? 0)),
    }))
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draft || !rect || shape === 'full') return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      rectWidth: rect.width,
      rectHeight: rect.height,
      boxW: event.currentTarget.parentElement?.clientWidth ?? 1,
      boxH: event.currentTarget.parentElement?.clientHeight ?? 1,
    }
  }

  /**
   * Dragging the rectangle moves what the shape keeps. Moving it right shows
   * more of the photo's right-hand side, which is what a couple expects when
   * they push a frame around a picture.
   */
  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const start = drag.current
    if (!start || !draft) return
    const perX = draft.width / Math.max(1, start.boxW)
    const perY = draft.height / Math.max(1, start.boxH)
    const slackX = (draft.width - start.rectWidth) / 2
    const slackY = (draft.height - start.rectHeight) / 2
    setCrop((current) => ({
      zoom: current.zoom,
      panX:
        slackX > 1
          ? clampPan(current.panX + ((event.clientX - start.x) * perX) / slackX)
          : 0,
      panY:
        slackY > 1
          ? clampPan(current.panY + ((event.clientY - start.y) * perY) / slackY)
          : 0,
    }))
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
              photoUrl={draft ? draft.url : (data.photo?.url ?? '')}
              shape={shape}
              frame={frame}
              naturalWidth={draft?.width ?? data.photo?.width ?? 0}
              naturalHeight={draft?.height ?? data.photo?.height ?? 0}
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
              <div className="grid gap-2">
                {/* The whole photo, with the frame drawn over it. Nothing is
                    hidden, so a couple can see exactly what a shape keeps. */}
                <div
                  className="relative w-full touch-none overflow-hidden border border-[var(--border-strong)] bg-black/40 select-none"
                  style={{ cursor: shape === 'full' ? 'default' : 'grab' }}
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
                    alt="Your whole photo"
                    draggable={false}
                    className="block h-auto w-full"
                  />
                  {rect && shape !== 'full' ? (
                    <div
                      role="slider"
                      tabIndex={0}
                      aria-label={`${shapeLabel(shape)} frame`}
                      aria-valuetext="Drag to reposition, or use the arrow keys"
                      onPointerDown={startDrag}
                      onKeyDown={(event) => {
                        const step = event.shiftKey ? 0.2 : 0.05
                        if (event.key === 'ArrowLeft') nudge({ panX: -step })
                        else if (event.key === 'ArrowRight')
                          nudge({ panX: step })
                        else if (event.key === 'ArrowUp') nudge({ panY: -step })
                        else if (event.key === 'ArrowDown')
                          nudge({ panY: step })
                        else return
                        event.preventDefault()
                      }}
                      className="absolute cursor-grab border-2 border-white/90 outline-none focus-visible:border-[var(--pink)]"
                      style={{
                        left: `${((rect.x / draft.width) * 100).toFixed(4)}%`,
                        top: `${((rect.y / draft.height) * 100).toFixed(4)}%`,
                        width: `${((rect.width / draft.width) * 100).toFixed(4)}%`,
                        height: `${((rect.height / draft.height) * 100).toFixed(4)}%`,
                        borderRadius: previewRadius(shape),
                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                      }}
                    />
                  ) : null}
                </div>

                {shape === 'full' ? (
                  <p className="text-xs text-[var(--text-faint)]">
                    Your whole photo, nothing cropped. It keeps its own shape.
                  </p>
                ) : (
                  <>
                    <label className="text-sm" htmlFor="photo-zoom">
                      Zoom
                      <input
                        id="photo-zoom"
                        type="range"
                        min="1"
                        max="3"
                        step="0.05"
                        value={crop.zoom}
                        onChange={(event) =>
                          setCrop((current) => ({
                            ...current,
                            zoom: Number(event.target.value),
                          }))
                        }
                        className="mt-1 w-full"
                      />
                    </label>
                    <p className="text-xs text-[var(--text-faint)]">
                      Drag the frame to the part you want, or use the arrow
                      keys. It starts on the middle of your photo.
                    </p>
                  </>
                )}
              </div>
            ) : data.photo ? (
              <img
                src={data.photo.url}
                alt={data.photo.alt}
                className="mx-auto block h-auto w-full"
                style={{
                  maxWidth:
                    shape === 'full' || shape === 'banner' ? '100%' : '76%',
                  borderRadius: previewRadius(shape),
                  aspectRatio:
                    shape === 'full' && data.photo.width > 0
                      ? `${data.photo.width} / ${data.photo.height}`
                      : aspectFor(shape),
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

            <fieldset className="grid gap-2">
              <legend className="text-sm text-[var(--text-muted)]">
                Shape
              </legend>
              <div className="flex flex-wrap gap-2">
                {PHOTO_SHAPES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={shape === item}
                    className={`min-h-11 rounded-full border px-3 text-sm ${shape === item ? 'border-[var(--pink)] text-[var(--pink-soft)]' : 'border-[var(--border-strong)] text-[var(--text-muted)]'}`}
                    onClick={() => void chooseShape(item)}
                  >
                    {shapeLabel(item)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-[var(--text-faint)]">
                Full photo shows the whole picture, exactly as you took it.
                Banner, circle and arch crop to a shape you position yourself.
              </p>
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
                  busy={draft.fresh ? 'Uploading…' : 'Saving…'}
                  done="Saved"
                  surface={surface}
                  onRun={async (): Promise<RunResult> => {
                    if (!draft.fresh) return saveCropOnly()
                    const whole = trimmedPhoto()
                    if (!whole || !frame) {
                      return {
                        ok: false,
                        message: 'That photo could not be read.',
                      }
                    }
                    // The whole photo is always stored; a shape adds a second,
                    // shaped rendition, so switching back to Full photo never
                    // has to re-crop anything.
                    const shaped = trimmedCrop()
                    const result = await upload({
                      data: {
                        dataUrl: whole.dataUrl,
                        cropUrl: shaped?.dataUrl ?? '',
                        shape,
                        // The whole photo's own size: a portrait and a
                        // landscape both keep their proportions.
                        width: whole.width,
                        height: whole.height,
                        zoom: crop.zoom,
                        panX: crop.panX,
                        panY: crop.panY,
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
                  {draft.fresh ? 'Save photo' : 'Save crop'}
                </ActionButton>
              ) : data.photo ? (
                <button
                  type="button"
                  className={`${rsvpGhost} w-auto px-4`}
                  disabled={reading}
                  onClick={() => void openSaved()}
                >
                  Adjust photo
                </button>
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
            {data.photo && !draft ? (
              <p className="text-xs text-[var(--text-faint)]">
                Saved photo · {photoSizeLabel(data.photo.bytes)} ·{' '}
                {shapeLabel(data.photo.shape).toLowerCase()}
                {data.photo.width > 0 && data.photo.height > 0
                  ? ` · ${data.photo.width}×${data.photo.height}`
                  : ''}
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
              naturalWidth={draft?.width ?? data.photo?.width ?? 0}
              naturalHeight={draft?.height ?? data.photo?.height ?? 0}
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
  naturalWidth = 0,
  naturalHeight = 0,
}: {
  templateId: RsvpTemplateId
  couple: string
  dateLine: string
  photoUrl: string
  shape: PhotoShape
  frame: ReturnType<typeof cropFrame> | null
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
          shape === 'full' ? (
            <img
              src={photoUrl}
              alt="Your photo in the invitation"
              className="mx-auto block h-auto w-full"
              style={{
                borderRadius: previewRadius(shape),
                ...(naturalWidth > 0 && naturalHeight > 0
                  ? { aspectRatio: `${naturalWidth} / ${naturalHeight}` }
                  : {}),
              }}
            />
          ) : frame ? (
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
              className="mx-auto block h-auto object-cover"
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
  photoUrl,
  shape,
  frame,
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
  shape: PhotoShape
  frame: ReturnType<typeof cropFrame> | null
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
        shape={shape}
        frame={frame}
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

function previewRadius(shape: PhotoShape): string {
  if (shape === 'circle') return '50%'
  if (shape === 'arch') return '999px 999px 0 0'
  return '12px'
}

function aspectFor(shape: PhotoShape): string {
  const size = shapeSize(shape)
  if (size.width === 0 || size.height === 0) return '4 / 3'
  return `${size.width} / ${size.height}`
}

function clampPan(value: number): number {
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
 * Draws one frame of the photo — the whole picture, or the couple's crop — and
 * re-encodes it as a JPEG, stepping down the width and the quality until it
 * lands under 300 KB. Re-encoding is also what drops the camera's location
 * metadata: only pixels survive.
 */
function encodeFrame(
  image: ImageBitmap | HTMLImageElement,
  frame: ReturnType<typeof cropFrame>,
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
