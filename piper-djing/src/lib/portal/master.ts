import { blankPlanning } from '../crm/planning.ts'
import { allQuestions, itemAt, QUESTIONS } from './questions.ts'
import type {
  ChoiceOption,
  MasterMap,
  MasterPatch,
  Question,
  QuestionType,
  SectionId,
} from './questions.ts'

const KNOWN = new Set(QUESTIONS.map((question) => question.id))

export type MasterDraft = {
  id: string
  section: SectionId
  subsection: string
  type: QuestionType
  label: string
  helper: string
  rail: string
  djNote: string
  hidden: boolean
  chips: string
  options: ChoiceOption[]
  replies: { value: string; text: string }[]
  defaults: {
    label: string
    helper: string
    rail: string
    djNote: string
    chips: string
    options: ChoiceOption[]
    replies: { value: string; text: string }[]
  }
}

const EMPTY_SEED = {
  coupleNames: '',
  email: '',
  phone: '',
  weddingDate: '',
  venueName: '',
}

function clip(value: string, max: number): string {
  return value.trim().slice(0, max)
}

function defaultsOf(question: Question): MasterDraft['defaults'] {
  return {
    label: question.label,
    helper: question.helper ?? '',
    rail: question.rail,
    djNote: question.djNote ?? '',
    chips: (question.chips ?? []).join('\n'),
    options: (question.options ?? []).map((option) => ({ ...option })),
    replies: Object.entries(question.djReplies ?? {}).map(([value, text]) => ({
      value,
      text,
    })),
  }
}

export function masterDrafts(master: MasterMap): MasterDraft[] {
  const planning = blankPlanning(EMPTY_SEED)
  const base = allQuestions(planning)
  const current = new Map(
    allQuestions(planning, master).map((question) => [question.id, question]),
  )
  return base.map((question) => {
    const shown = current.get(question.id) ?? question
    return {
      id: question.id,
      section: question.section,
      subsection: question.subsection,
      type: question.type,
      label: shown.label,
      helper: shown.helper ?? '',
      rail: shown.rail,
      djNote: shown.djNote ?? '',
      hidden: shown.hiddenByMaster === true,
      chips: (shown.chips ?? []).join('\n'),
      options: (shown.options ?? []).map((option) => ({ ...option })),
      replies: Object.entries(shown.djReplies ?? {}).map(([value, text]) => ({
        value,
        text,
      })),
      defaults: defaultsOf(question),
    }
  })
}

export function masterFromDrafts(
  drafts: readonly {
    id: string
    label: string
    helper: string
    rail: string
    djNote: string
    hidden: boolean
    chips: string
    options: ChoiceOption[]
    replies: { value: string; text: string }[]
  }[],
): MasterMap {
  const planning = blankPlanning(EMPTY_SEED)
  const defaults = new Map(
    allQuestions(planning).map((question) => [question.id, question]),
  )
  const map: MasterMap = {}
  for (const draft of drafts) {
    const base = defaults.get(draft.id)
    if (!base || !KNOWN.has(draft.id)) continue
    const patch: MasterPatch = {}
    const label = clip(draft.label, 200)
    if (label && label !== base.label) patch.label = label
    const helper = clip(draft.helper, 500)
    if (helper !== (base.helper ?? '')) patch.helper = helper
    const rail = clip(draft.rail, 80)
    if (rail && rail !== base.rail) patch.rail = rail
    const djNote = clip(draft.djNote, 500)
    if (djNote !== (base.djNote ?? '')) patch.djNote = djNote
    if (draft.hidden) patch.hidden = true
    if (base.chips) {
      const chips = draft.chips
        .split('\n')
        .map((chip) => clip(chip, 40))
        .filter(Boolean)
        .slice(0, 24)
      if (chips.join('\n') !== base.chips.join('\n')) patch.chips = chips
    }
    if (base.options) {
      const options = base.options.map((option) => {
        const edited = draft.options.find((item) => item.value === option.value)
        return {
          value: option.value,
          hint: clip(edited?.hint ?? option.hint, 80),
        }
      })
      const changed = options.some((option, index) => {
        const original = itemAt(base.options ?? [], index)
        return option.hint !== (original?.hint ?? '')
      })
      if (changed) patch.options = options
    }
    if (base.djReplies) {
      const replies: Record<string, string> = {}
      for (const [value, text] of Object.entries(base.djReplies)) {
        const edited = draft.replies.find((item) => item.value === value)
        const next = clip(edited?.text ?? text, 500)
        if (next !== text) replies[value] = next
      }
      if (Object.keys(replies).length > 0) patch.replies = replies
    }
    if (Object.keys(patch).length > 0) map[draft.id] = patch
  }
  return map
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function parseMaster(value: unknown): MasterMap {
  let raw: unknown = value
  if (typeof value === 'string') {
    if (!value.trim()) return {}
    try {
      raw = JSON.parse(value) as unknown
    } catch {
      return {}
    }
  }
  const record = asRecord(raw)
  if (!record) return {}
  return masterFromDrafts(
    Object.entries(record).flatMap(([id, patch]) => {
      const body = asRecord(patch)
      if (!body || !KNOWN.has(id)) return []
      const base = QUESTIONS.find((question) => question.id === id)
      if (!base) return []
      return [
        {
          id,
          label: typeof body.label === 'string' ? body.label : base.label,
          helper:
            typeof body.helper === 'string' ? body.helper : (base.helper ?? ''),
          rail: typeof body.rail === 'string' ? body.rail : base.rail,
          djNote:
            typeof body.djNote === 'string' ? body.djNote : (base.djNote ?? ''),
          hidden: body.hidden === true,
          chips: Array.isArray(body.chips)
            ? body.chips.filter((chip) => typeof chip === 'string').join('\n')
            : (base.chips ?? []).join('\n'),
          options: base.options
            ? base.options.map((option) => {
                const stored = Array.isArray(body.options)
                  ? body.options.find((item) => {
                      const row = asRecord(item)
                      return row?.value === option.value
                    })
                  : null
                const row = asRecord(stored)
                return {
                  value: option.value,
                  hint: typeof row?.hint === 'string' ? row.hint : option.hint,
                }
              })
            : [],
          replies: Object.entries(base.djReplies ?? {}).map(
            ([replyValue, text]) => {
              const stored = asRecord(body.replies)
              const next = stored?.[replyValue]
              return {
                value: replyValue,
                text: typeof next === 'string' ? next : text,
              }
            },
          ),
        },
      ]
    }),
  )
}
