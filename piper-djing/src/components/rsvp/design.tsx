import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useMemo, useState } from 'react'
import { inviteView } from '../../lib/rsvp/invite.ts'
import {
  AFTER_CHOICES,
  BOX_MAX,
  BOX_PLACES,
  BOX_SIZES,
  BOX_TEXT_MAX,
  HOST_CHOICES,
  LINE_DEFAULTS,
  LINE_MAX,
  NOTE_MAX,
  REQUEST_CHOICES,
} from '../../lib/rsvp/invite-words.ts'
import type { InviteWording, LineKey, LineLook, TextBox } from '../../lib/rsvp/invite-words.ts'
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
  saveRsvpInvite,
  saveRsvpPhoto,
} from '../../lib/rsvp/rsvp.functions.ts'
import { RSVP_TEMPLATES, templateFor } from '../../lib/rsvp/templates.ts'
import type { RsvpTemplateId } from '../../lib/rsvp/templates.ts'
import { ActionButton, Spinner } from '../action-button.tsx'
import type { RunResult } from '../action-button.tsx'
import { SaveStatus, useAutosave } from './autosave.tsx'
import { EnvelopeInvitation, InvitationCard } from './invitation.tsx'
import {
  rsvpButtonFit,
  rsvpField,
  rsvpGhostFit,
  useRsvpTheme,
} from './shell.tsx'
import type { ReadyManage } from './manage.tsx'

type Draft = {
  image: ImageBitmap | HTMLImageElement
  width: number
  height: number
  url: string
}

type InviteDraft = {
  template: RsvpTemplateId
  tint: number
  wording: InviteWording
  monogram: boolean
  envelope: boolean
}

/**
 * The invitation studio: the couple picks a style and its colourway, sets the
 * wording, adds a photo, and watches the card and its envelope change as they
 * go. Every change saves itself; what they see is exactly what guests get.
 *
 * The photo is always the whole picture at its own proportions: no cropping,
 * no shape to choose and nothing to reposition.
 */
export function Design({ data }: { data: ReadyManage }) {
  const surface = useRsvpTheme()
  const saveInvite = useServerFn(saveRsvpInvite)
  const upload = useServerFn(saveRsvpPhoto)
  const dropPhoto = useServerFn(clearRsvpPhoto)
  const router = useRouter()
  const wedding = data.wedding
  const [invite, setInvite] = useState<InviteDraft>(() => ({
    template: wedding.template,
    tint: wedding.tint,
    wording: wedding.wording,
    monogram: wedding.monogram,
    envelope: wedding.envelope,
  }))
  const [draft, setDraft] = useState<Draft | null>(null)
  const [fileNote, setFileNote] = useState('')
  const [reading, setReading] = useState(false)
  const [previewMode, setPreviewMode] = useState<'card' | 'envelope'>('card')
  const [replay, setReplay] = useState(0)
  const autosave = useAutosave<InviteDraft>(async (next) => {
    const result = await saveInvite({ data: next })
    return result.ok ? { ok: true } : { ok: false, error: result.error }
  }, 600)

  function change(patch: Partial<InviteDraft>) {
    const next = { ...invite, ...patch }
    setInvite(next)
    autosave.schedule(next)
  }
  function word(patch: Partial<InviteWording>) {
    change({ wording: { ...invite.wording, ...patch } })
  }
  function lineLook(key: LineKey): LineLook {
    return invite.wording.lines?.[key] ?? LINE_DEFAULTS[key]
  }
  function setLine(key: LineKey, patch: Partial<LineLook>) {
    const lines = { ...LINE_DEFAULTS, ...invite.wording.lines }
    word({ lines: { ...lines, [key]: { ...lines[key], ...patch } } })
  }
  function setBox(id: string, patch: Partial<TextBox>) {
    word({ boxes: invite.wording.boxes.map((box) => (box.id === id ? { ...box, ...patch } : box)) })
  }
  function moveBox(index: number, step: -1 | 1) {
    const boxes = [...invite.wording.boxes]
    const target = index + step
    if (target < 0 || target >= boxes.length) return
    ;[boxes[index], boxes[target]] = [boxes[target], boxes[index]]
    word({ boxes })
  }
  function addBox() {
    if (invite.wording.boxes.length >= BOX_MAX) return
    const id = `box-${Date.now().toString(36)}`
    word({ boxes: [...invite.wording.boxes, { id, text: '', size: 'normal', place: 'details' }] })
  }

  const photoUrl = draft ? draft.url : (data.photo?.url ?? '')
  const naturalWidth = draft?.width ?? data.photo?.width ?? 0
  const naturalHeight = draft?.height ?? data.photo?.height ?? 0
  const photo = photoUrl
    ? { url: photoUrl, alt: 'Your photo on the invitation', width: naturalWidth, height: naturalHeight }
    : null
  const firstParty = wedding.parties.find((party) => party.name.trim())?.name ?? 'Your guests'
  const view = useMemo(
    () => inviteView({ ...wedding, ...invite }, { photo, addressee: firstParty }),
    // photo is rebuilt from these three
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wedding, invite, photoUrl, naturalWidth, naturalHeight, firstParty],
  )
  const chosen = templateFor(invite.template)

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
   * own shape, 1200px wide at most, under 300 KB, and re-encoded, which is
   * what drops the camera's location metadata.
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

  const section = 'rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5'
  const legend = 'text-base font-semibold'

  return (
    <div className="grid max-w-6xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs tracking-[0.16em] text-[var(--text-muted)]">
            INVITATIONS
          </p>
          <h1 className="portal-display text-4xl">Your invitation</h1>
          <p className="mt-2 max-w-2xl text-[var(--text-muted)]">
            Pick a style and colour, make the words yours, and add a photo.
            Guests open it from an envelope with their names on it. The emails
            and the RSVP pages wear the same style.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SaveStatus phase={autosave.phase} error={autosave.error} />
          <a
            href={`/rsvp/${wedding.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${rsvpGhostFit} px-4`}
          >
            See it as a guest
          </a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div className="grid min-w-0 gap-5">
          <fieldset className={section}>
            <legend className={`${legend} float-left w-full`}>Style</legend>
            <div className="clear-both grid grid-cols-2 gap-3 pt-3 sm:grid-cols-4">
              {RSVP_TEMPLATES.map((template) => {
                const on = template.id === invite.template
                return (
                  <button
                    key={template.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => change({ template: template.id, tint: 0 })}
                    className={`grid min-w-0 content-start gap-2 rounded-2xl border-2 p-2 text-left transition ${
                      on
                        ? 'border-[var(--pink)] bg-[var(--pink-tint)]'
                        : 'border-transparent hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <span className="pointer-events-none block h-44 overflow-hidden rounded-lg" aria-hidden="true">
                      <InvitationCard
                        view={{ ...view, template: template.id, tint: 0, photo: null, wording: { ...view.wording, note: '' } }}
                      />
                    </span>
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {template.name}
                      {template.fresh ? (
                        <span className="rounded-full bg-[var(--pink-tint)] px-2 py-0.5 text-[11px] font-semibold text-[var(--pink-soft)]">
                          New
                        </span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="clear-both mt-3 text-sm text-[var(--text-muted)]">{chosen.blurb}</p>
          </fieldset>

          <fieldset className={section}>
            <legend className={`${legend} float-left w-full`}>Accent colour</legend>
            <p className="clear-both pt-1 text-sm text-[var(--text-muted)]">
              {chosen.tints.some((tint) => tint.paper)
                ? 'Sets the paper, the gold or silver details, the wax seal and the buttons on your guest pages.'
                : 'Sets the colour of the ornaments, your initials, the wax seal and the buttons on your guest pages. The paper stays the same.'}
            </p>
            <div className="flex flex-wrap gap-3 pt-3">
              {chosen.tints.map((tint, index) => {
                const on = index === invite.tint
                return (
                  <button
                    key={tint.name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => change({ tint: index })}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-full border-2 py-1 pr-4 pl-1.5 text-sm font-semibold ${
                      on ? 'border-[var(--pink)]' : 'border-[var(--border)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <span
                      className="h-8 w-8 rounded-full border border-black/15"
                      style={{ background: tint.foil ?? tint.accent, boxShadow: tint.paper ? `inset 0 0 0 5px ${tint.paper}` : undefined }}
                      aria-hidden="true"
                    />
                    {tint.name}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset className={section}>
            <legend className={`${legend} float-left w-full`}>Wording</legend>
            <div className="clear-both grid gap-4 pt-3">
              <p className="text-sm text-[var(--text-muted)]">
                Each line comes filled in. Change the words, or move it and pick its style.
              </p>
              <div className="grid gap-3 rounded-2xl border border-[var(--border)] p-3">
                <LineChoice
                  id="invite-host"
                  label="Who is hosting"
                  value={invite.wording.host}
                  choices={HOST_CHOICES}
                  allowNone
                  onChange={(host) => word({ host })}
                />
                <LookPicker id="invite-host" look={lineLook('host')} onChange={(patch) => setLine('host', patch)} />
              </div>
              <div className="grid gap-3 rounded-2xl border border-[var(--border)] p-3">
                <LineChoice
                  id="invite-request"
                  label="The invitation"
                  value={invite.wording.request}
                  choices={REQUEST_CHOICES}
                  onChange={(request) => word({ request })}
                />
                <LookPicker id="invite-request" look={lineLook('request')} onChange={(patch) => setLine('request', patch)} />
              </div>
              <div className="grid gap-3 rounded-2xl border border-[var(--border)] p-3">
                <LineChoice
                  id="invite-after"
                  label="The party"
                  value={invite.wording.after}
                  choices={AFTER_CHOICES}
                  allowNone
                  onChange={(after) => word({ after })}
                />
                <LookPicker id="invite-after" look={lineLook('after')} onChange={(patch) => setLine('after', patch)} />
              </div>
              <div className="grid gap-3 rounded-2xl border border-[var(--border)] p-3">
                <div className="grid gap-2">
                  <label htmlFor="invite-note" className="text-sm text-[var(--text-muted)]">
                    A note from you two <span className="text-[var(--text-faint)]">(optional)</span>
                  </label>
                  <textarea
                    id="invite-note"
                    className={`${rsvpField} min-h-24 py-3`}
                    maxLength={NOTE_MAX}
                    value={invite.wording.note}
                    placeholder="We can't wait to celebrate with you. Bring your dancing shoes!"
                    onChange={(event) => word({ note: event.target.value })}
                  />
                  <p className="text-right text-xs text-[var(--text-faint)]">
                    {invite.wording.note.length} / {NOTE_MAX}
                  </p>
                </div>
                <LookPicker id="invite-note" look={lineLook('note')} onChange={(patch) => setLine('note', patch)} />
              </div>
              <p className="text-sm text-[var(--text-muted)]">
                Your names, date, time and place come from your RSVP details, so they always match.
              </p>
            </div>
          </fieldset>

          <fieldset className={section}>
            <legend className={`${legend} float-left w-full`}>Your own text</legend>
            <p className="clear-both pt-1 text-sm text-[var(--text-muted)]">
              Add up to {BOX_MAX} lines of your own, like a dress code, "Adults only",
              parking or a hashtag. They have the same Where and Style choices.
            </p>
            <div className="grid gap-3 pt-3">
              {invite.wording.boxes.map((box, index) => (
                <div key={box.id} className="grid gap-3 rounded-2xl border border-[var(--border)] p-3">
                  <label htmlFor={`box-${box.id}`} className="sr-only">
                    Text box {index + 1}
                  </label>
                  <textarea
                    id={`box-${box.id}`}
                    className={`${rsvpField} min-h-20 py-3`}
                    maxLength={BOX_TEXT_MAX}
                    value={box.text}
                    placeholder="Cocktail attire · Adults only, please"
                    onChange={(event) => setBox(box.id, { text: event.target.value })}
                  />
                  <div className="flex flex-wrap items-end gap-3">
                    <LookPicker id={`box-${box.id}`} look={box} onChange={(patch) => setBox(box.id, patch)} />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={`${rsvpGhostFit} px-3`}
                        disabled={index === 0}
                        aria-label={`Move text box ${index + 1} up`}
                        onClick={() => moveBox(index, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={`${rsvpGhostFit} px-3`}
                        disabled={index === invite.wording.boxes.length - 1}
                        aria-label={`Move text box ${index + 1} down`}
                        onClick={() => moveBox(index, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className={`${rsvpGhostFit} px-4`}
                        onClick={() => word({ boxes: invite.wording.boxes.filter((item) => item.id !== box.id) })}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {invite.wording.boxes.length < BOX_MAX ? (
                <button type="button" className={`${rsvpGhostFit} justify-self-start px-4`} onClick={addBox}>
                  + Add a text box
                </button>
              ) : (
                <p className="text-sm text-[var(--text-faint)]">That's the most text boxes a card can hold.</p>
              )}
            </div>
          </fieldset>

          <fieldset className={section}>
            <legend className={`${legend} float-left w-full`}>Finishing touches</legend>
            <div className="clear-both grid gap-3 pt-3">
              <Toggle
                id="invite-monogram"
                checked={invite.monogram}
                onChange={(monogram) => change({ monogram })}
                label={`Your initials as a monogram (${view.letters.join(' & ')})`}
                hint="On the card and pressed into the wax seal."
              />
              <Toggle
                id="invite-envelope"
                checked={invite.envelope}
                onChange={(envelope) => change({ envelope })}
                label="Guests open it from an envelope"
                hint="Addressed to each party by name. They tap the seal and the card slides out. Off shows the card straight away."
              />
            </div>
          </fieldset>

          <section className={section} aria-labelledby="photo-heading">
            <h2 id="photo-heading" className={legend}>Your photo</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              A JPG, PNG or iPhone photo up to 10 MB. It sits at the top of the
              card, the whole photo, never cropped, and we remove the location
              it was taken.
            </p>
            <div className="mt-4 grid gap-3">
              {draft ? (
                <p className="text-sm text-[var(--text-muted)]">
                  This is a preview on your card. Press Save photo to keep it.
                </p>
              ) : data.photo ? (
                <p className="text-xs text-[var(--text-faint)]">
                  Saved photo · {photoSizeLabel(data.photo.bytes)}
                  {data.photo.width > 0 && data.photo.height > 0
                    ? ` · ${data.photo.width}×${data.photo.height}`
                    : ''}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <label
                  className={`${rsvpGhostFit} cursor-pointer gap-2 px-4`}
                  aria-disabled={reading}
                >
                  {reading ? <Spinner label="Reading the photo" /> : null}
                  {draft || data.photo ? 'Choose another photo' : 'Add your photo'}
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
                    className={`${rsvpButtonFit} px-5`}
                    busy="Uploading…"
                    done="Saved"
                    surface={surface}
                    onRun={async (): Promise<RunResult> => {
                      const whole = trimmedPhoto()
                      if (!whole) {
                        return { ok: false, message: 'That photo could not be read.' }
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
                      return { ok: true, message: `Saved · ${photoSizeLabel(whole.bytes)}` }
                    }}
                  >
                    Save photo
                  </ActionButton>
                ) : null}
                {!draft && data.photo ? (
                  <ActionButton
                    className={`${rsvpGhostFit} px-4`}
                    busy="Removing…"
                    done="Removed"
                    surface={surface}
                    onRun={async (): Promise<RunResult> => {
                      const result = await dropPhoto()
                      if (result.ok) await router.invalidate()
                      return {
                        ok: result.ok,
                        message: result.ok
                          ? 'Your invitation runs without a photo again.'
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
          </section>
        </div>

        <aside className="grid min-w-0 gap-3 lg:sticky lg:top-4" aria-label="Preview">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-full border border-[var(--border)] p-1" role="group" aria-label="Preview">
              {(['card', 'envelope'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={previewMode === mode}
                  onClick={() => {
                    setPreviewMode(mode)
                    if (mode === 'envelope') setReplay((count) => count + 1)
                  }}
                  className={`min-h-10 rounded-full px-4 text-sm font-semibold ${
                    previewMode === mode ? 'bg-[var(--pink)] text-[var(--on-accent,#0D0D0D)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {mode === 'card' ? 'The card' : 'The envelope'}
                </button>
              ))}
            </div>
            {previewMode === 'envelope' && invite.envelope ? (
              <button type="button" className="text-sm font-semibold text-[var(--pink-soft)] underline" onClick={() => setReplay((count) => count + 1)}>
                Play it again
              </button>
            ) : null}
          </div>
          <div
            className="rounded-3xl p-4 sm:p-6"
            style={{ background: templateFor(invite.template).skin.web?.backdrop ?? templateFor(invite.template).skin.backdrop }}
          >
            {previewMode === 'card' ? (
              <InvitationCard view={view} />
            ) : invite.envelope ? (
              <div className="pt-6">
                <EnvelopeInvitation key={replay} view={view} replay={replay} />
              </div>
            ) : (
              <p className="rounded-2xl bg-white/80 p-4 text-sm text-[#333]">
                The envelope is off, so guests see the card straight away. Turn it on under Finishing touches.
              </p>
            )}
          </div>
          <p className="text-xs text-[var(--text-faint)]">
            The envelope here is addressed to {firstParty}. Each guest sees their own party's name.
          </p>
        </aside>
      </div>
    </div>
  )
}

/** A wording line: one of the suggestions, your own words, or (where allowed) left off. */
function LineChoice({
  id,
  label,
  value,
  choices,
  allowNone = false,
  onChange,
}: {
  id: string
  label: string
  value: string
  choices: string[]
  allowNone?: boolean
  onChange: (value: string) => void
}) {
  const known = choices.includes(value)
  const [custom, setCustom] = useState(!known && value !== '')
  const selectValue = custom ? '__own' : value === '' && allowNone ? '__none' : known ? value : '__own'
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm text-[var(--text-muted)]">
        {label}
      </label>
      <select
        id={id}
        className={rsvpField}
        value={selectValue}
        onChange={(event) => {
          const next = event.target.value
          if (next === '__own') {
            setCustom(true)
            if (!value) onChange(choices[0])
            return
          }
          setCustom(false)
          onChange(next === '__none' ? '' : next)
        }}
      >
        {choices.map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
        <option value="__own">Write my own…</option>
        {allowNone ? <option value="__none">Leave it off</option> : null}
      </select>
      {selectValue === '__own' ? (
        <input
          id={`${id}-own`}
          aria-label={`${label}, in your own words`}
          className={rsvpField}
          maxLength={LINE_MAX}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
    </div>
  )
}

/** Where a line sits on the card, and how it is set. */
function LookPicker({
  id,
  look,
  onChange,
}: {
  id: string
  look: LineLook
  onChange: (patch: Partial<LineLook>) => void
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
      <label htmlFor={`${id}-where`} className="grid min-w-[10rem] flex-1 gap-1 text-sm text-[var(--text-muted)]">
        Where
        <select
          id={`${id}-where`}
          className={rsvpField}
          value={look.place}
          onChange={(event) => onChange({ place: event.target.value as LineLook['place'] })}
        >
          {BOX_PLACES.map((place) => (
            <option key={place.value} value={place.value}>
              {place.label}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor={`${id}-style`} className="grid min-w-[10rem] flex-1 gap-1 text-sm text-[var(--text-muted)]">
        Style
        <select
          id={`${id}-style`}
          className={rsvpField}
          value={look.size}
          onChange={(event) => onChange({ size: event.target.value as LineLook['size'] })}
        >
          {BOX_SIZES.map((size) => (
            <option key={size.value} value={size.value}>
              {size.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

function Toggle({
  id,
  checked,
  onChange,
  label,
  hint,
}: {
  id: string
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint: string
}) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3">
      <input
        id={id}
        type="checkbox"
        className="mt-1 h-5 w-5 shrink-0 accent-[var(--pink)]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-[var(--text-muted)]">{hint}</span>
      </span>
    </label>
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
