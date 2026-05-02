import { createContext, useContext, useEffect } from 'react'
import type { ReactNode } from 'react'
import type {
  NodeRuntimeNodeDto,
  NodeRuntimePathDto,
  NodeRuntimeResolveResponseDto,
  NodeRuntimeSectionDto,
  NodeRuntimeStepDto
} from '@artificer-toolkit/schema'

export type AuthoringFormMode = 'create' | 'view' | 'edit'

export type AuthoringFormAction = () => Promise<void> | void

export type AuthoringFormActionHandlers = {
  onActivate?: AuthoringFormAction
  onCancel?: AuthoringFormAction
  onClearPaths?: (paths: readonly NodeRuntimePathDto[]) => void
  onCopy?: AuthoringFormAction
  onNextStep?: AuthoringFormAction
  onPreviousStep?: AuthoringFormAction
  onSaveDraft?: AuthoringFormAction
}

export type AuthoringFormRegistration = {
  activeSectionId?: string
  activeStepId?: string
  activeStepLabel?: string
  activateLabel?: string
  canCopy?: boolean
  canGoBack?: boolean
  canGoNext?: boolean
  canSaveDraft?: boolean
  canSubmit?: boolean
  copyLabel?: string
  cancelLabel?: string
  fieldPathPrefix?: string
  hasActiveDraft?: boolean
  isLastStep?: boolean
  mapId?: string
  mode?: AuthoringFormMode
  providedModel?: NodeRuntimeResolveResponseDto
  readOnly?: boolean
  resolveModel?: boolean
  resolvedModel?: NodeRuntimeResolveResponseDto
  saveDraftLabel?: string
  subjectKindLabel?: string
  subjectLabel?: ReactNode
  systemId?: string
  isSubmitting?: boolean
}

export type AuthoringFormSessionState = {
  activeSectionId?: string
  activeStepId?: string
  activeStepLabel?: string
  activateLabel: string
  canCopy: boolean
  canGoBack: boolean
  canGoNext: boolean
  canSaveDraft: boolean
  canSubmit: boolean
  copyLabel: string
  cancelLabel: string
  fieldPathPrefix?: string
  hasActiveDraft: boolean
  isLastStep: boolean
  isSubmitting: boolean
  mapId?: string
  mode: AuthoringFormMode
  providedModel?: NodeRuntimeResolveResponseDto
  readOnly: boolean
  resolveModel: boolean
  resolvedModel?: NodeRuntimeResolveResponseDto
  saveDraftLabel: string
  subjectKindLabel: string
  subjectLabel?: ReactNode
  systemId?: string
}

export type AuthoringFormContextValue = AuthoringFormSessionState & {
  activate: AuthoringFormAction
  cancel: AuthoringFormAction
  clearPaths: (paths: readonly NodeRuntimePathDto[]) => void
  copy: AuthoringFormAction
  getField: (fieldId: string) => NodeRuntimeNodeDto | undefined
  getSection: (sectionId: string) => NodeRuntimeSectionDto | undefined
  getStep: (stepId: string) => NodeRuntimeStepDto | undefined
  goToNextStep: AuthoringFormAction
  goToPreviousStep: AuthoringFormAction
  registerAuthoringForm: (
    registration: AuthoringFormRegistration,
    actions?: AuthoringFormActionHandlers
  ) => void
  saveDraft: AuthoringFormAction
}

export const AuthoringFormContext = createContext<AuthoringFormContextValue | null>(null)

export function useAuthoringForm() {
  const value = useContext(AuthoringFormContext)
  if (!value) {
    throw new Error('useAuthoringForm must be used inside AuthoringFormProvider.')
  }
  return value
}

export function useAuthoringSection(sectionId: string) {
  return useAuthoringForm().getSection(sectionId)
}

export function useAuthoringField(fieldId: string) {
  return useAuthoringForm().getField(fieldId)
}

export function useAuthoringStep(stepId: string) {
  return useAuthoringForm().getStep(stepId)
}

export function useAuthoringFormRegistration(
  registration: AuthoringFormRegistration,
  actions?: AuthoringFormActionHandlers,
  enabled = true
) {
  const { registerAuthoringForm } = useAuthoringForm()

  useEffect(() => {
    if (!enabled) return
    registerAuthoringForm(registration, actions)
  }, [
    actions,
    enabled,
    registerAuthoringForm,
    registration
  ])

  return enabled
}
