import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type {
  NodeRuntimePathDto,
  NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import type { AuthoredValidationIssueDto } from '@artificer-toolkit/schema/api/content'
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
import type { CharacterBuilderAuthoringSession } from '#domains/characters/builder/state/characterBuilderAuthoringSession'
import type {
  VisibleAuthoringStep,
  VisibleAuthoringSteps
} from '../hooks/useAuthoringResolvedModel'
import type { AuthoringNavigationNode, AuthoringNavigationTarget } from './authoringNavigation'

export type AuthoringFormMode = 'create' | 'view' | 'edit'

/**
 * A draft that saves itself: unsaved edits, a save in flight, saved, a failed save retrying, or
 * replaced (finalized, discarded or reopened elsewhere), after which it no longer saves.
 */
export type AuthoringDraftSaveStatus = 'pending' | 'saving' | 'saved' | 'retrying' | 'replaced'

type AuthoringFormAction = () => Promise<void> | void
type AuthoringFormValuesAction = (values: object) => Promise<boolean | void> | void

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
  activeNavigationTargetId?: string
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
  /** Set by autosaving forms; the header shows it in place of the unsaved-changes state. */
  draftSaveStatus?: AuthoringDraftSaveStatus
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
  navigationTargets?: readonly AuthoringNavigationTarget[]
  navigationTree?: readonly AuthoringNavigationNode[]
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
  validationIssues?: readonly AuthoredValidationIssueDto[]
  visitedStepIds?: ReadonlySet<string>
  isSubmitting?: boolean
  isDeleting?: boolean
  stagedEditorOpen?: boolean
}

export type AuthoringFormSessionState = Pick<
  AuthoringFormStatePatch,
  | 'activeSectionId'
  | 'activeNavigationTargetId'
  | 'activeStepId'
  | 'activeStepLabel'
  | 'authoredSession'
  | 'authoringKind'
  | 'characterData'
  | 'characterSession'
  | 'domain'
  | 'draftSaveStatus'
  | 'domainData'
  | 'fallbackLabel'
  | 'fieldPathPrefix'
  | 'firstBlockingStatus'
  | 'firstBlockingStepId'
  | 'mapId'
  | 'navigationTargets'
  | 'navigationTree'
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
      | 'validationIssues'
      | 'visitedStepIds'
      | 'isSubmitting'
      | 'isDeleting'
      | 'stagedEditorOpen'
    >
  >

export type AuthoringFormContextValue = AuthoringFormSessionState & {
  activate: AuthoringFormAction
  activateValues: AuthoringFormValuesAction
  activeNavigationTarget: AuthoringNavigationTarget | undefined
  activeStep: VisibleAuthoringStep | undefined
  cancel: AuthoringFormAction
  cancelHref?: string
  clearValidationIssues: (fieldName: string) => void
  clearPaths: (paths: readonly NodeRuntimePathDto[]) => void
  copy: AuthoringFormAction
  copySource: (subjectId: string) => Promise<void>
  deleteRecord: AuthoringFormAction
  discardDraft: AuthoringFormAction
  goToNavigationTarget: (targetId: string) => void
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
