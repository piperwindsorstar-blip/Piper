/**
 * The Terms document as blocks to draw: "## " lines are headings, "- " lines
 * are list items, every other line is a paragraph. Only those two markers are
 * read; the words of each line are passed through untouched.
 */
export type TermsBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }

export function termsBlocks(body: string): TermsBlock[] {
  const blocks: TermsBlock[] = []
  for (const line of body.split(/\r?\n/)) {
    if (line.trim() === '') continue
    if (line.startsWith('## ')) {
      blocks.push({ kind: 'heading', text: line.slice(3) })
      continue
    }
    if (line.startsWith('- ')) {
      const last = blocks.at(-1)
      if (last?.kind === 'list') last.items.push(line.slice(2))
      else blocks.push({ kind: 'list', items: [line.slice(2)] })
      continue
    }
    blocks.push({ kind: 'paragraph', text: line })
  }
  return blocks
}

/** Every line of text the blocks hold, in order. */
export function termsBlockLines(blocks: TermsBlock[]): string[] {
  return blocks.flatMap((block) =>
    block.kind === 'list' ? block.items : [block.text],
  )
}
