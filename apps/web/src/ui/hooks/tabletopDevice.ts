/** D237: the live tabletop needs a screen and a window at least this wide, in CSS px. */
export const tabletopMinimumSize = 1024

/**
 * `unsupported`: the screen is a phone or small tablet, so the tabletop never opens.
 * `too-narrow`: the screen is large enough but the window is not, so the tabletop is covered.
 * `ready`: the tabletop can show.
 */
export type TabletopDeviceFit = 'unsupported' | 'too-narrow' | 'ready'

/** The screen's longer side decides capability, so orientation and window size never revoke it. */
export function classifyTabletopDevice({
  screenHeight,
  screenWidth,
  viewportWidth
}: {
  screenHeight: number
  screenWidth: number
  viewportWidth: number
}): TabletopDeviceFit {
  if (Math.max(screenWidth, screenHeight) < tabletopMinimumSize) return 'unsupported'
  return viewportWidth < tabletopMinimumSize ? 'too-narrow' : 'ready'
}
