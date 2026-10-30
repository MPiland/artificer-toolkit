import { createContext, useContext } from 'react'
import type { Context, Dispatch, ReactNode, SetStateAction } from 'react'
import type { AuthoredValidationIssueDto } from '@artificer-toolkit/schema/api/content'
import type {
  AuthoringProgressSummary,
  AuthoringStepStatusMap,
  AuthoringStepWarningMap
} from '../validation/authoringProgress'
import type {
  AuthoredFormDomain,
  AuthoredFormSession
} from '../factories/authoredFormFactories.types'
import type { CharacterBuilderAuthoringSession } from '#domains/characters/builder/state/characterBuilderAuthoringSession'
import type {
  useAuthoringResolvedModel,
  VisibleAuthoringStep,
  VisibleAuthoringSteps
} from '../hooks/useAuthoringResolvedModel'
import type { GroupEditorTransaction } from '../rendering/FormRenderer.context'
import type { AuthoringNavigationState } from './authoringNavigation'
import type { AuthoredForm } from './useAuthoredFormInstance'

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
  onDelete?: AuthoringFormAction
  onDiscardDraft?: AuthoringFormAction
  onResetForm?: AuthoringFormAction
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
  isDraft?: boolean
  mapId?: string
  mode?: AuthoringFormMode
  readOnly?: boolean
  resolveModel?: boolean
  resetStepLabel?: string
  resetFormLabel?: string
  saveDraftLabel?: string
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
  | 'mapId'
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
      | 'mode'
      | 'readOnly'
      | 'resolveModel'
      | 'resetStepLabel'
      | 'resetFormLabel'
      | 'saveDraftLabel'
      | 'stepStatuses'
      | 'stepWarnings'
      | 'subjectKindLabel'
      | 'validationIssues'
      | 'visitedStepIds'
      | 'isSubmitting'
      | 'isDeleting'
    >
  >

/** Step navigation derived from the resolved model and the form's debounced state. */
export type AuthoringFormNavigationState = Omit<
  AuthoringNavigationState,
  'navigationTree' | 'progressSummary'
> & {
  /** Every step is complete and the model resolved. */
  isComplete: boolean
  navigationTree: AuthoringNavigationState['navigationTree'] | undefined
  progressSummary: AuthoringProgressSummary | undefined
  visibleSteps: VisibleAuthoringSteps
}

/** The submit, finalize, reset and saving flags, read from the form store. */
export type AuthoringFormStatus = {
  canFinalize: boolean
  canResetForm: boolean
  canResetStep: boolean
  canSubmit: boolean
  hasChanges: boolean
  hasStepChanges: boolean
  isSubmitting: boolean
}

type AuthoringNavigationFields =
  | 'activeNavigationTargetId'
  | 'activeSectionId'
  | 'activeStepId'
  | 'activeStepLabel'
  | 'fieldPathPrefix'
  | 'progressSummary'
  | 'stepStatuses'
  | 'visibleSteps'
  | 'visitedStepIds'

/** Labels, permissions and records of the registered session. */
export type AuthoringSessionContextValue = Omit<
  AuthoringFormSessionState,
  AuthoringNavigationFields | keyof AuthoringFormStatus
> & {
  cancelHref?: string
  isDiscardingDraft: boolean
}

export type AuthoringActionsContextValue = {
  activate: AuthoringFormAction
  activateValues: AuthoringFormValuesAction
  cancel: AuthoringFormAction
  clearValidationIssues: (fieldName: string) => void
  copy: AuthoringFormAction
  copySource: (subjectId: string) => Promise<void>
  deleteRecord: AuthoringFormAction
  discardDraft: AuthoringFormAction
  registerDomain: (registration: AuthoredFormDomain | AuthoringDomainRegistration) => void
  resetForm: AuthoringFormAction
  resetStep: AuthoringFormAction
  saveDraft: AuthoringFormAction
  saveDraftValues: AuthoringFormValuesAction
  updateAuthoringFormActions: (actions: AuthoringFormActionHandlers) => void
  updateAuthoringFormState: (patch: AuthoringFormStatePatch) => void
}

export type AuthoringNavigationContextValue = AuthoringFormNavigationState & {
  activeNavigationTarget: AuthoringFormNavigationState['navigationTargets'][number] | undefined
  activeStep: VisibleAuthoringStep | undefined
  activeStepId?: string
  activeStepLabel?: string
  fieldPathPrefix?: string
  goToNavigationTarget: (targetId: string) => void
  goToNextStep: AuthoringFormAction
  goToPreviousStep: AuthoringFormAction
  goToStep: (stepId: string) => void
  isFirstStep: boolean
  isLastStep: boolean
  visitedStepIds: ReadonlySet<string>
}

export type AuthoringFormStoreContextValue = {
  /** Flags the character builder still pushes into the session (RELIABILITY-10.T1c). */
  builderStatus?: AuthoringFormStatus
  form: AuthoredForm
  /** An activate, save or discard request is in flight. */
  isMutating: boolean
}

export type AuthoringResolution = Pick<
  ReturnType<typeof useAuthoringResolvedModel>,
  'error' | 'isRetrying' | 'model' | 'refetch'
>

export type AuthoringStagedEditorContextValue = {
  groupEditor: GroupEditorTransaction | undefined
  setGroupEditor: Dispatch<SetStateAction<GroupEditorTransaction | undefined>>
}

export const AuthoringSessionContext = createContext<AuthoringSessionContextValue | null>(null)
export const AuthoringActionsContext = createContext<AuthoringActionsContextValue | null>(null)
export const AuthoringNavigationContext = createContext<AuthoringNavigationContextValue | null>(
  null
)
export const AuthoringFormStoreContext = createContext<AuthoringFormStoreContextValue | null>(null)
export const AuthoringResolutionContext = createContext<AuthoringResolution | null>(null)
export const AuthoringStagedEditorContext = createContext<AuthoringStagedEditorContextValue | null>(
  null
)

function useProvidedContext<TValue>(context: Context<TValue | null>, hookName: string) {
  const value = useContext(context)
  if (!value) throw new Error(`${hookName} must be used inside AuthoringFormProvider.`)
  return value
}

export function useAuthoringSession() {
  return useProvidedContext(AuthoringSessionContext, 'useAuthoringSession')
}

export function useAuthoringActions() {
  return useProvidedContext(AuthoringActionsContext, 'useAuthoringActions')
}

export function useAuthoringNavigation() {
  return useProvidedContext(AuthoringNavigationContext, 'useAuthoringNavigation')
}

export function useAuthoringFormStore() {
  return useProvidedContext(AuthoringFormStoreContext, 'useAuthoringFormStore')
}

export function useAuthoringResolution() {
  return useProvidedContext(AuthoringResolutionContext, 'useAuthoringResolution')
}

export function useAuthoringStagedEditor() {
  return useProvidedContext(AuthoringStagedEditorContext, 'useAuthoringStagedEditor')
}
