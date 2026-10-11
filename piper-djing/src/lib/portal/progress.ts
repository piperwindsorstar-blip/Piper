import type { Planning } from '../crm/planning.ts'
import {
  SECTION_ORDER,
  allQuestions,
  isVisible,
  itemAt,
  momentLabel,
  sectionQuestions,
  songsOf,
  textValue,
} from './questions.ts'
import type { Question, SectionId } from './questions.ts'

export type SectionProgress = {
  id: SectionId
  answered: number
  total: number
}

export function questionAnswered(
  planning: Planning,
  question: Question,
): boolean {
  if (!isVisible(planning, question)) return false
  if (question.type === 'song' && question.timelineIndex !== undefined) {
    const row = itemAt(planning.timeline, question.timelineIndex)
    if (!row || row.hidden) return false
    return Boolean(row.song.trim() || row.artist.trim() || row.link.trim())
  }
  if (question.type === 'chips') {
    return planning.genreChips.length > 0 || planning.genres.trim() !== ''
  }
  if (question.type === 'list' && question.id === 'mustPlay') {
    return songsOf(planning.mustPlayItems, planning.mustPlay).length > 0
  }
  if (question.type === 'list' && question.id === 'doNotPlay') {
    return songsOf(planning.doNotPlayItems, planning.doNotPlay).length > 0
  }
  if (question.type === 'list' && question.id === 'appearances') {
    return planning.appearances.some(
      (row) => row.names.trim() || row.people.trim(),
    )
  }
  return textValue(planning, question.id).trim() !== ''
}

export function visibleQuestions(
  planning: Planning,
  section?: SectionId,
): Question[] {
  const source = section
    ? sectionQuestions(planning, section)
    : allQuestions(planning)
  return source.filter((question) => isVisible(planning, question))
}

export function sectionProgress(
  planning: Planning,
  section: SectionId,
): SectionProgress {
  const questions = visibleQuestions(planning, section)
  return {
    id: section,
    answered: questions.filter((question) =>
      questionAnswered(planning, question),
    ).length,
    total: questions.length,
  }
}

export function overallProgress(planning: Planning): {
  answered: number
  total: number
  percent: number
} {
  const questions = visibleQuestions(planning)
  const answered = questions.filter((question) =>
    questionAnswered(planning, question),
  ).length
  const total = questions.length
  return {
    answered,
    total,
    percent: total === 0 ? 0 : Math.round((answered / total) * 100),
  }
}

export function sectionPercent(planning: Planning, section: SectionId): number {
  const progress = sectionProgress(planning, section)
  if (progress.total === 0) return 0
  return Math.round((progress.answered / progress.total) * 100)
}

export function firstUnanswered(planning: Planning): Question | null {
  for (const section of SECTION_ORDER) {
    const next = visibleQuestions(planning, section).find(
      (question) => !questionAnswered(planning, question),
    )
    if (next) return next
  }
  return null
}

export function stepFrom(
  planning: Planning,
  question: Question,
  direction: 1 | -1,
): Question | null {
  const visible = visibleQuestions(planning)
  const index = visible.findIndex((item) => item.id === question.id)
  if (index < 0) return visible[0] ?? null
  return visible[index + direction] ?? null
}

export function railSummary(planning: Planning, question: Question): string {
  if (!questionAnswered(planning, question)) {
    if (question.type === 'song') return 'Pick a song'
    return ''
  }
  if (question.type === 'song' && question.timelineIndex !== undefined) {
    const row = itemAt(planning.timeline, question.timelineIndex)
    if (!row) return ''
    const title = row.song.trim()
    const artist = row.artist.trim()
    if (title && artist) return `${title} · ${artist}`
    return title || artist || 'Pick a song'
  }
  if (question.type === 'chips') {
    const chips = planning.genreChips
    if (chips.length) return chips.slice(0, 3).join(', ')
    return planning.genres.trim()
  }
  if (question.id === 'mustPlay') {
    const songs = songsOf(planning.mustPlayItems, planning.mustPlay)
    return songs
      .map((item) => item.song)
      .filter(Boolean)
      .slice(0, 2)
      .join(', ')
  }
  if (question.id === 'doNotPlay') {
    const songs = songsOf(planning.doNotPlayItems, planning.doNotPlay)
    return songs
      .map((item) => item.song)
      .filter(Boolean)
      .slice(0, 2)
      .join(', ')
  }
  if (question.id === 'appearances') {
    const count = planning.appearances.filter((row) => row.names.trim()).length
    return count === 1 ? '1 name' : `${count} names`
  }
  if (question.timelineIndex !== undefined)
    return momentLabel(planning, question.timelineIndex)
  return textValue(planning, question.id).trim()
}

export function djLine(planning: Planning, question: Question): string {
  const value = textValue(planning, question.id)
  if (question.djReplies && question.djReplies[value])
    return question.djReplies[value]
  if (question.id === 'genres' && planning.genreChips.length > 0) {
    return `Love it. ${planning.genreChips.join(', ')} can shape the night.`
  }
  return question.djNote ?? ''
}

export function shiftIso(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return ''
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function daysUntil(today: string, eventDate: string): number {
  const start = Date.parse(`${today}T00:00:00Z`)
  const end = Date.parse(`${eventDate}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.max(0, Math.round((end - start) / 86400000))
}
