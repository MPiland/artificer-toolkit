import { createContext, useContext } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type {
  VisibleAuthoringStep,
  VisibleAuthoringSteps
} from '../hooks/useAuthoringResolvedModel'
import type { AuthoringNavigationTarget } from './authoringNavigation'

export type AuthoringPreviewContent = ReactNode | undefined

type AuthoringLayoutToggles = {
  stepsNavigationOpen: boolean
  toggleStepsNavigation: () => void
  previewOpen: boolean
  togglePreview: () => void
  resetFormConfirmOpen: boolean
  toggleResetFormConfirm: () => void
}

type AuthoringLayoutState = {
  previewContent: AuthoringPreviewContent
  setPreviewContent: Dispatch<SetStateAction<AuthoringPreviewContent>>
}

type AuthoringLayoutConstants = {
  isWideDesktop: boolean
  title: string
  label: string
  status: { label: string }
  visibleSteps: VisibleAuthoringSteps
  activeStep: VisibleAuthoringStep | undefined
  activeTarget: AuthoringNavigationTarget | undefined
  stepId: string | undefined
  activeSections: VisibleAuthoringStep['sections']
}

export type AuthoringLayoutContextValue = AuthoringLayoutToggles &
  AuthoringLayoutState &
  AuthoringLayoutConstants

export const AuthoringLayoutContext = createContext<AuthoringLayoutContextValue | undefined>(
  undefined
)

export function useAuthoringLayout() {
  const value = useContext(AuthoringLayoutContext)
  if (!value) {
    throw new Error('useAuthoringLayout must be used inside AuthoringLayoutProvider.')
  }
  return value
}
