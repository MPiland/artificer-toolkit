export const CHARACTER_BUILDER_TIMING_MARK = {
  ANCESTRY_INTENT: 'character-builder:ancestry-intent',
  ANCESTRY_PREVIEW: 'character-builder:ancestry-preview',
  BUILDER_RAIL_COMMITTED: 'character-builder:builder-rail-committed',
  BUILDER_SHELL_READY: 'character-builder:builder-shell-ready',
  FIRST_ACTIVE_PANEL_COMMITTED: 'character-builder:first-active-panel-committed',
  HYDRATION_COMPLETED: 'character-builder:hydration-completed',
  RESOLUTION_INTENT: 'character-builder:resolution-intent',
  RESOLUTION_RECONCILED: 'character-builder:resolution-reconciled',
  STEP_NAVIGATION_INTENT: 'character-builder:step-navigation-intent',
  STEP_PANEL_COMMITTED: 'character-builder:step-panel-committed'
} as const

export const CHARACTER_BUILDER_TIMING_MEASURE = {
  ANCESTRY_PREVIEW: 'character-builder:ancestry-preview-latency',
  RESOLUTION: 'character-builder:resolution-latency',
  STEP_NAVIGATION: 'character-builder:step-navigation-latency'
} as const

export function startCharacterBuilderTiming(mark: string): void {
  markCharacterBuilderTiming(mark)
}

export function markCharacterBuilderTiming(mark: string): void {
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
  return isDevelopmentBuild() && typeof performance !== 'undefined'
}

function isCharacterBuilderTimingDebugEnabled(): boolean {
  return (
    isDevelopmentBuild() &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('characterTiming')
  )
}

function isDevelopmentBuild(): boolean {
  return import.meta.env.DEV || import.meta.env.MODE === 'development'
}
