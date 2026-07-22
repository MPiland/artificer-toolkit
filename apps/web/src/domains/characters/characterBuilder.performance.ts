export const CHARACTER_BUILDER_TIMING_MARK = {
  ANCESTRY_INTENT: 'character-builder:ancestry-intent',
  ANCESTRY_PREVIEW: 'character-builder:ancestry-preview',
  RESOLUTION_INTENT: 'character-builder:resolution-intent',
  RESOLUTION_RECONCILED: 'character-builder:resolution-reconciled'
} as const

export const CHARACTER_BUILDER_TIMING_MEASURE = {
  ANCESTRY_PREVIEW: 'character-builder:ancestry-preview-latency',
  RESOLUTION: 'character-builder:resolution-latency'
} as const

export function startCharacterBuilderTiming(mark: string): void {
  if (!canMeasureCharacterBuilderTiming()) return

  performance.clearMarks(mark)
  performance.mark(mark)
}

export function completeCharacterBuilderTiming({
  endMark,
  measure,
  startMark
}: {
  endMark: string
  measure: string
  startMark: string
}): void {
  if (!canMeasureCharacterBuilderTiming()) return
  if (performance.getEntriesByName(startMark, 'mark').length === 0) return

  performance.clearMarks(endMark)
  performance.mark(endMark)
  performance.measure(measure, startMark, endMark)

  const duration = performance.getEntriesByName(measure, 'measure').at(-1)?.duration
  if (duration !== undefined && isCharacterBuilderTimingDebugEnabled()) {
    console.debug(`[character-builder-timing] ${measure} ${duration.toFixed(3)}ms`)
  }
}

function canMeasureCharacterBuilderTiming(): boolean {
  return import.meta.env.DEV && typeof performance !== 'undefined'
}

function isCharacterBuilderTimingDebugEnabled(): boolean {
  return import.meta.env.DEV
    && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('characterTiming')
}
