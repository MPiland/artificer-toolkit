import { createContext, useContext } from 'react'
import type { Context, Dispatch, ReactNode, SetStateAction } from 'react'
import type { AuthoredValidationIssueDto } from '@artificer-toolkit/schema/api/content'
import type {
  AuthoringProgressSummary,
  AuthoringStepWarningMap
} from '../validation/authoringProgress'
import type {
  AuthoredFormDomain,
  AuthoredFormSession
} from '../factories/authoredFormFactories.types'
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

type AuthoringFormActionHandlers = {
  onActivate?: AuthoringFormAction
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
  activateLabel?: string
  canCopy?: boolean
  canDelete?: boolean
  canSaveDraft?: boolean
  copyLabel?: string
  cancelLabel?: string
  deleteLabel?: string
  /** Set by autosaving forms; the header shows it in place of the unsaved-changes state. */
  draftSaveStatus?: AuthoringDraftSaveStatus
  domain?: AuthoredFormDomain
  domainData?: unknown
  fallbackLabel?: string
  fieldPathPrefix?: string
  hasActiveDraft?: boolean
  isDraft?: boolean
  mapId?: string
  mode?: AuthoringFormMode
  readOnly?: boolean
  resolveModel?: boolean
  resetStepLabel?: string
  resetFormLabel?: string
  saveDraftLabel?: string
  stepWarnings?: AuthoringStepWarningMap
  subjectKindLabel?: string
  subjectLabel?: ReactNode
  systemId?: string
  validationIssues?: readonly AuthoredValidationIssueDto[]
  visitedStepIds?: ReadonlySet<string>
  isDeleting?: boolean
}

export type AuthoringFormSessionState = Pick<
  AuthoringFormStatePatch,
  | 'activeSectionId'
  | 'activeNavigationTargetId'
  | 'activeStepId'
  | 'activeStepLabel'
  | 'authoredSession'
  | 'domain'
  | 'draftSaveStatus'
  | 'domainData'
  | 'fallbackLabel'
  | 'fieldPathPrefix'
  | 'mapId'
  | 'subjectLabel'
  | 'systemId'
> &
  Required<
    Pick<
      AuthoringFormStatePatch,
      | 'activateLabel'
      | 'canCopy'
      | 'canDelete'
      | 'canSaveDraft'
      | 'copyLabel'
      | 'cancelLabel'
      | 'deleteLabel'
      | 'hasActiveDraft'
      | 'isDraft'
      | 'mode'
      | 'readOnly'
      | 'resolveModel'
      | 'resetStepLabel'
      | 'resetFormLabel'
      | 'saveDraftLabel'
      | 'stepWarnings'
      | 'subjectKindLabel'
      | 'validationIssues'
      | 'visitedStepIds'
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

/**
 * A form a domain owns above the provider, with step-only navigation. The domain reads its own
 * form store and passes the chrome's labels, flags, steps and handlers down as props.
 */
export type AuthoringHostedForm = {
  actions: AuthoringFormActionHandlers
  cancelHref: string
  labels: Pick<AuthoringFormStatePatch, 'draftSaveStatus' | 'subjectLabel' | 'systemId'> &
    Required<
      Pick<
        AuthoringFormStatePatch,
        | 'activateLabel'
        | 'canDelete'
        | 'canSaveDraft'
        | 'deleteLabel'
        | 'hasActiveDraft'
        | 'isDraft'
        | 'mode'
        | 'readOnly'
        | 'saveDraftLabel'
        | 'subjectKindLabel'
      >
    >
  navigation: Pick<
    AuthoringFormNavigationState,
    'isComplete' | 'progressSummary' | 'stepStatuses' | 'visibleSteps'
  >
  /** Called when the user asks for another step, before it renders. */
  onStepIntent?: () => void
  status: AuthoringFormStatus
}

type AuthoringNavigationFields =
  | 'activeNavigationTargetId'
  | 'activeSectionId'
  | 'activeStepId'
  | 'activeStepLabel'
  | 'fieldPathPrefix'
  | 'visitedStepIds'

/** Labels, permissions and records of the registered session. */
export type AuthoringSessionContextValue = Omit<
  AuthoringFormSessionState,
  AuthoringNavigationFields
> & {
  cancelHref?: string
  isDiscardingDraft: boolean
  /** The domain owns the form above the provider (see `AuthoringHostedForm`). */
  isHostedForm: boolean
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
  form: AuthoredForm
  /** A hosted form's flags; authored forms read theirs from the form store. */
  hostedStatus?: AuthoringFormStatus
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
