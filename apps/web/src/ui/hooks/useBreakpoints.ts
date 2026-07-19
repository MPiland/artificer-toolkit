import { useMediaQuery } from '@mantine/hooks'

import { media } from '#app/css/foundations.css'

export function useBreakpoints() {
  const isMobile = useMediaQuery(media.mobile, false)
  const isTablet = useMediaQuery(media.tablet, false)
  const isTabletPortrait = useMediaQuery(media.tabletPortrait, false)

  return {
    isDesktop: !isTablet,
    isMobile,
    isTablet,
    isTabletPortrait
  }
}
