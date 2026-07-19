import type { PresentationContext } from '@artificer-toolkit/design-system'
import { useBreakpoints } from '../../ui/hooks/useBreakpoints'

export function useAuthoringPresentationContext(): PresentationContext {
  const { isDesktop, isMobile } = useBreakpoints()
  return isMobile ? 'compact' : isDesktop ? 'wide' : 'regular'
}
