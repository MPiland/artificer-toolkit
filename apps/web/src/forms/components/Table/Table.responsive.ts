import { useMediaQuery } from '@mantine/hooks'
import type { ResponsiveMode } from './Table.types'

const mobilePortraitQuery = '(max-width: 640px) and (orientation: portrait)'
const mobileLandscapeQuery =
  '(max-width: 900px) and (max-height: 520px) and (orientation: landscape)'
const tabletPortraitQuery = '(min-width: 641px) and (max-width: 1024px) and (orientation: portrait)'

export function useResponsiveMode(forceMode?: ResponsiveMode): ResponsiveMode {
  const isMobilePortrait = useMediaQuery(mobilePortraitQuery, false)
  const isMobileLandscape = useMediaQuery(mobileLandscapeQuery, false)
  const isTabletPortrait = useMediaQuery(tabletPortraitQuery, false)

  if (forceMode) return forceMode
  if (isMobilePortrait) return 'mobilePortrait'
  if (isMobileLandscape) return 'mobileLandscape'
  if (isTabletPortrait) return 'tablet'

  return 'desktop'
}

export function shouldUseSummary(mode: ResponsiveMode) {
  return mode === 'mobilePortrait' || mode === 'mobileLandscape' || mode === 'tablet'
}
