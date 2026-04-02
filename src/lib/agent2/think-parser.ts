type ParsedSegment =
  | { type: "reasoning"; text: string }
  | { type: "text"; text: string }

const THINK_TAG_PATTERN = /<think>([\s\S]*?)<\/think>/gi

export function parseThinkTaggedText(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = []
  let lastIndex = 0

  for (const match of text.matchAll(THINK_TAG_PATTERN)) {
    const matchIndex = match.index ?? 0
    const before = text.slice(lastIndex, matchIndex)
    if (before.trim()) {
      segments.push({ type: "text", text: before.trim() })
    }

    const reasoning = match[1]?.trim()
    if (reasoning) {
      segments.push({ type: "reasoning", text: reasoning })
    }

    lastIndex = matchIndex + match[0].length
  }

  const after = text.slice(lastIndex)
  if (after.trim()) {
    segments.push({ type: "text", text: after.trim() })
  }

  return segments
}
