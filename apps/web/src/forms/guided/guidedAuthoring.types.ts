import type { SystemResponseDto } from '@artificer-toolkit/schema/api/systems'
import type { AuthoredFormSession } from '../factories/authoredFormFactories.types'

export type GuidedAuthoringState = {
  isReview: boolean
  showPreview: boolean
}

export type GuidedAuthoringStateHandler = (state: GuidedAuthoringState) => void

/** Props every Guided domain screen receives; Guided only mounts once the session has a System. */
export type GuidedDomainAuthoringProps = {
  onAdvanced: (() => void) | undefined
  onStateChange: GuidedAuthoringStateHandler
  session: AuthoredFormSession
  system: SystemResponseDto
}
