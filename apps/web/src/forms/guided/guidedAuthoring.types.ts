export type GuidedAuthoringState = {
  isReview: boolean
  showPreview: boolean
}

export type GuidedAuthoringStateHandler = (state: GuidedAuthoringState) => void
