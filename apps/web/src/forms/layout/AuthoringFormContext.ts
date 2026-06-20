import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type {
  NodeRuntimePathDto,
  NodeRuntimeResolveResponseDto,
} from '@artificer-toolkit/schema/api/nodeRuntime'
import type {
  AuthoringProgressSummary,
  AuthoringStepDirtyMap,
  AuthoringStepProgressStatus,
  AuthoringStepStatusMap,
  AuthoringStepWarningMap
} from '../validation/authoringProgress'
import type {
  AuthoredFormDomain,
  AuthoredFormSession
} from '../factories/authoredFormFactories.types'
import type { CharacterBuilderAuthoringSession } from '#domains/characters/characterBuilderAuthoringSession'
import type { VisibleAuthoringStep, VisibleAuthoringSteps } from '../hooks/useAuthoringResolvedModel'

export type AuthoringFormMode = 'create' | 'view' | 'edit'

export type AuthoringFormAction = () => Promise<void> | void
export type AuthoringFormValuesAction = (values: object) => Promise<void> | void

export type AuthoringFormActionHandlers = {
  onActivate?: AuthoringFormAction
  onCancel?: AuthoringFormAction
  onClearPaths?: (paths: readonly NodeRuntimePathDto[]) => void
  onCopy?: AuthoringFormAction
  onDelete?: AuthoringFormAction
  onDiscardDraft?: AuthoringFormAction
  onNextStep?: AuthoringFormAction
  onPreviousStep?: AuthoringFormAction
  onResetForm?: AuthoringFormAction
  onResetStep?: AuthoringFormAction
  onStepChange?: (stepId: string) => void
  onSaveDraft?: AuthoringFormAction
}

export type AuthoringDomainRegistration = {
  data?: unknown
  domain: AuthoredFormDomain
  mode?: AuthoringFormMode
}

export type AuthoringFormStatePatch = {
  activeSectionId?: string
  activeStepId?: string
  activeStepLabel?: string
  authoredSession?: AuthoredFormSession
  authoringKind?: 'authored-form' | 'character-builder'
  activateLabel?: string
  canCopy?: boolean
  canDelete?: boolean
  canFinalize?: boolean
  canResetStep?: boolean
  canResetForm?: boolean
  canSaveDraft?: boolean
  canSubmit?: boolean
  copyLabel?: string
  cancelLabel?: string
  characterData?: unknown
  characterSession?: CharacterBuilderAuthoringSession
  deleteLabel?: string
  domain?: AuthoredFormDomain
  domainData?: unknown
  fallbackLabel?: string
  fieldPathPrefix?: string
  hasChanges?: boolean
  hasStepChanges?: boolean
  hasActiveDraft?: boolean
  firstBlockingStepId?: string
  firstBlockingStatus?: Exclude<AuthoringStepProgressStatus, 'complete'>
  isDraft?: boolean
  isFirstStep?: boolean
  isLastStep?: boolean
  mapId?: string
  mode?: AuthoringFormMode
  providedModel?: NodeRuntimeResolveResponseDto
  readOnly?: boolean
  resolveModel?: boolean
  resolvedModel?: NodeRuntimeResolveResponseDto
  resetStepLabel?: string
  resetFormLabel?: string
  saveDraftLabel?: string
  stepDirty?: AuthoringStepDirtyMap
  stepStatuses?: AuthoringStepStatusMap
  stepWarnings?: AuthoringStepWarningMap
  progressSummary?: AuthoringProgressSummary
  subjectKindLabel?: string
  subjectLabel?: ReactNode
  systemId?: string
  visibleSteps?: VisibleAuthoringSteps
  isSubmitting?: boolean
  isDeleting?: boolean
}

export type AuthoringFormSessionState = Pick<
  AuthoringFormStatePatch,
  | 'activeSectionId'
      | 'activeStepId'
      | 'activeStepLabel'
      | 'authoredSession'
      | 'authoringKind'
      | 'characterData'
      | 'characterSession'
      | 'domain'
  | 'domainData'
  | 'fallbackLabel'
  | 'fieldPathPrefix'
  | 'firstBlockingStatus'
  | 'firstBlockingStepId'
  | 'mapId'
  | 'providedModel'
  | 'resolvedModel'
  | 'progressSummary'
  | 'subjectLabel'
      | 'systemId'
      | 'visibleSteps'
> &
  Required<
    Pick<
      AuthoringFormStatePatch,
      | 'activateLabel'
      | 'canCopy'
      | 'canDelete'
      | 'canFinalize'
      | 'canResetStep'
      | 'canResetForm'
      | 'canSaveDraft'
      | 'canSubmit'
      | 'copyLabel'
      | 'cancelLabel'
      | 'deleteLabel'
      | 'hasChanges'
      | 'hasStepChanges'
      | 'hasActiveDraft'
      | 'isDraft'
      | 'isFirstStep'
      | 'isLastStep'
      | 'mode'
      | 'readOnly'
      | 'resolveModel'
      | 'resetStepLabel'
      | 'resetFormLabel'
      | 'saveDraftLabel'
      | 'stepDirty'
      | 'stepStatuses'
      | 'stepWarnings'
      | 'subjectKindLabel'
      | 'isSubmitting'
      | 'isDeleting'
    >
  >

export type AuthoringFormContextValue = AuthoringFormSessionState & {
  activate: AuthoringFormAction
  activateValues: AuthoringFormValuesAction
  activeStep: VisibleAuthoringStep | undefined
  cancel: AuthoringFormAction
  clearPaths: (paths: readonly NodeRuntimePathDto[]) => void
  copy: AuthoringFormAction
  deleteRecord: AuthoringFormAction
  discardDraft: AuthoringFormAction
  goToStep: (stepId: string) => void
  goToNextStep: AuthoringFormAction
  goToPreviousStep: AuthoringFormAction
  isDiscardingDraft: boolean
  registerDomain: (registration: AuthoredFormDomain | AuthoringDomainRegistration) => void
  resetForm: AuthoringFormAction
  resetStep: AuthoringFormAction
  saveDraft: AuthoringFormAction
  saveDraftValues: AuthoringFormValuesAction
  updateAuthoringFormActions: (actions: AuthoringFormActionHandlers) => void
  updateAuthoringFormState: (patch: AuthoringFormStatePatch) => void
  visibleSteps: VisibleAuthoringSteps
}

export const AuthoringFormContext = createContext<AuthoringFormContextValue | null>(null)

export function useAuthoringForm() {
  const value = useContext(AuthoringFormContext)
  if (!value) {
    throw new Error('useAuthoringForm must be used inside AuthoringFormProvider.')
  }
  return value
}
