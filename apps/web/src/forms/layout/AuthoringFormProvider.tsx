import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import type {
  NodeRuntimePathDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import {
  AuthoringFormContext,
  type AuthoringDomainRegistration,
  type AuthoringFormActionHandlers,
  type AuthoringFormContextValue,
  type AuthoringFormStatePatch,
  type AuthoringFormSessionState
} from './AuthoringFormContext'
import {
  createActivateAction,
  createCancelAction,
  createCopyAction,
  createCreateDraftAction,
  createDeleteRequestAction,
  createDiscardDraftAction,
  createUpdateDraftAction
} from '../actions'
import type {
  ActivatedAuthoringResponse,
  DraftAuthoringResponse,
  DuplicateAuthoringResponse
} from '../actions'
import { authoredFormFactories } from '../factories/authoredFormFactories'
import type {
  AuthoredFormDomain,
  AuthoredFormSession
} from '../factories/authoredFormFactories.types'
import { getVisibleAuthoringSteps } from '../hooks/useAuthoringResolvedModel'
import { createCharacterBuilderAuthoringSession } from '#domains/characters/characterBuilderAuthoringSession'
import type { CharacterBuilderRouteMode } from './authoredFormRouteContext'

const EMPTY_CLEAR_PATHS: readonly NodeRuntimePathDto[] = []
const EMPTY_STEP_DIRTY = {}
const EMPTY_STEP_STATUSES = {}
const EMPTY_STEP_WARNINGS = {}
const EMPTY_OPERATION_CONFIG: AuthoredFormSession['operations'] = {
  activate: async () => undefined,
  saveDraft: async () => ({ publicId: '' })
}
const EMPTY_DELETE_CONFIG = {
  deleteActive: async () => undefined,
  deleteDraft: async () => undefined,
  detailSubjectQueryKey: ['authoring', 'empty-detail'] as const,
  domainQueryKey: ['authoring', 'empty-domain'] as const,
  draftQueryKey: ['authoring', 'empty-draft'] as const
}

export type AuthoringFormProviderProps = {
  children: ReactNode
  data?: unknown
  domain?: AuthoredFormDomain
  kind?: 'authored-form' | 'character-builder'
  mode?: AuthoringFormSessionState['mode']
}

export function AuthoringFormProvider({
  children,
  data,
  domain,
  kind,
  mode
}: AuthoringFormProviderProps) {
  const [session, setSession] = useState<AuthoringFormSessionState>(() =>
    createInitialSession({ data, domain, kind, mode })
  )
  const actionsRef = useRef<AuthoringFormActionHandlers>({})
  const authoredSession = session.authoredSession
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const operations = authoredSession?.operations ?? EMPTY_OPERATION_CONFIG
  const resolvedModel = session.resolvedModel
  const visibleSteps = useMemo(() => getVisibleAuthoringSteps(resolvedModel), [resolvedModel])
  const activeStep =
    visibleSteps.find((step) => step.id === session.activeStepId) ?? visibleSteps[0]
  const activeStepIndex = activeStep
    ? visibleSteps.findIndex((step) => step.id === activeStep.id)
    : -1
  const activateMutation = useMutation({
    mutationFn: (payload: object) => operations.activate(payload),
    onSuccess: async (response: ActivatedAuthoringResponse) => {
      await operations.onActivateSuccess?.(queryClient, response)
    }
  })
  const saveDraftMutation = useMutation({
    mutationFn: (payload: object) => operations.saveDraft(payload),
    onSuccess: async (draft: DraftAuthoringResponse) => {
      await operations.onSaveDraftSuccess?.(queryClient, draft)
    }
  })
  const discardDraftMutation = useMutation({
    mutationFn: () => operations.discardDraft?.() ?? Promise.resolve(),
    onSuccess: async () => {
      await operations.onDiscardDraftSuccess?.(queryClient)
    }
  })
  const duplicateMutation = useMutation({
    mutationFn: (subjectId: string) =>
      operations.duplicate?.(subjectId) ?? Promise.resolve(null),
    onSuccess: async (_response: DuplicateAuthoringResponse | null | undefined) => {
      await operations.onDuplicateSuccess?.(queryClient)
    }
  })
  const {
    confirmation: deleteConfirmation,
    isDeleting,
    requestDelete
  } = useAuthoredDeleteAction({
    ...(authoredSession?.deleteConfig ?? EMPTY_DELETE_CONFIG),
    domainLabel: authoredSession?.subjectKindLabel ?? 'Item',
    onDeleted: async () => navigate({ to: authoredSession?.actionFactory.listPath ?? '/' })
  })
  const activateAction = useMemo(() => {
    if (!authoredSession) return undefined

    return createActivateAction({
      activateMutation,
      buildRouteParams: authoredSession.actionFactory.buildRouteParams,
      detailPath: authoredSession.actionFactory.activatePath,
      messages: authoredSession.actionFactory.messages,
      navigate,
      notifier: notifications,
      readOnly: authoredSession.readOnly,
      router,
      subjectId: authoredSession.subjectId
    })
  }, [activateMutation, authoredSession, navigate, router])
  const cancelAction = useMemo(
    () =>
      authoredSession
        ? createCancelAction({ listPath: authoredSession.actionFactory.listPath, navigate })
        : undefined,
    [authoredSession, navigate]
  )
  const copyAction = useMemo(() => {
    if (!authoredSession?.subjectId) return undefined

    return createCopyAction({
      buildRouteParams: authoredSession.actionFactory.buildRouteParams,
      duplicateMutation,
      editPath: authoredSession.actionFactory.editPath,
      messages: authoredSession.actionFactory.messages,
      navigate,
      notifier: notifications,
      subjectId: authoredSession.subjectId
    })
  }, [authoredSession, duplicateMutation, navigate])
  const deleteAction = useMemo(() => {
    if (!authoredSession?.subjectId) return undefined

    return createDeleteRequestAction({
      draft: Boolean(authoredSession.draft),
      label:
        typeof authoredSession.subjectLabel === 'string'
          ? authoredSession.subjectLabel
          : undefined,
      requestDelete,
      subjectId: authoredSession.subjectId,
      subjectKindLabel: authoredSession.subjectKindLabel
    })
  }, [authoredSession, requestDelete])
  const discardDraftAction = useMemo(() => {
    if (!authoredSession) return undefined

    return createDiscardDraftAction({
      activeRecord: authoredSession.activeRecord,
      discardDraftMutation,
      listPath: authoredSession.actionFactory.listPath,
      messages: authoredSession.actionFactory.messages,
      navigate,
      notifier: notifications,
      router
    })
  }, [authoredSession, discardDraftMutation, navigate, router])
  const saveDraftAction = useMemo(() => {
    if (!authoredSession) return undefined

    if (authoredSession.mode === 'create') {
      return createCreateDraftAction({
        buildRouteParams: authoredSession.actionFactory.buildRouteParams,
        draftMutation: saveDraftMutation,
        editPath: authoredSession.actionFactory.editPath,
        messages: authoredSession.actionFactory.messages,
        navigate,
        notifier: notifications
      })
    }

    return createUpdateDraftAction({
      draftMutation: saveDraftMutation,
      messages: authoredSession.actionFactory.messages,
      notifier: notifications,
      readOnly: authoredSession.readOnly,
      router
    })
  }, [authoredSession, navigate, router, saveDraftMutation])
  const registerDomain = useCallback((registration: AuthoredFormDomain | AuthoringDomainRegistration) => {
    setSession((current) => {
      const next =
        typeof registration === 'string'
          ? applyDomainRegistration(current, { domain: registration })
          : applyDomainRegistration(current, registration)

      return isSameSession(current, next) ? current : next
    })
  }, [])
  const clearPaths = resolvedModel?.clearPaths ?? EMPTY_CLEAR_PATHS
  const clearPathKey = clearPaths.map((path) => path.join('.')).join('|')

  useEffect(() => {
    if (clearPaths.length === 0) return
    actionsRef.current.onClearPaths?.(clearPaths)
  }, [clearPathKey, clearPaths])

  useEffect(() => {
    if (kind === 'character-builder') {
      setSession((current) => {
        const next = applyCharacterBuilderRegistration(current, {
          data,
          mode: mode === 'edit' ? 'edit' : 'create'
        })

        return isSameSession(current, next) ? current : next
      })
      return
    }

    if (!domain) return

    setSession((current) => {
      const next = applyDomainRegistration(current, {
        data,
        domain,
        mode
      })

      return isSameSession(current, next) ? current : next
    })
  }, [data, domain, kind, mode])

  useEffect(() => {
    if (!session.domain) return

    setSession((current) => {
      if (!current.domain) return current

      const next = {
        ...current,
        ...getDomainRegistration(current.domain, current.mode, current.domainData)
      }

      return isSameSession(current, next) ? current : next
    })
  }, [session.domain, session.domainData, session.mode])

  const updateAuthoringFormState = useCallback(
    (patch: AuthoringFormStatePatch) => {
      setSession((current) => {
        const next = {
          ...current,
          ...patch
        }

        return isSameSession(current, next) ? current : next
      })
    },
    []
  )

  const updateAuthoringFormActions = useCallback((actions: AuthoringFormActionHandlers) => {
    actionsRef.current = {
      ...actionsRef.current,
      ...actions
    }
  }, [])
  const activateValues = useCallback(
    async (values: object) => {
      if (!authoredSession || !activateAction) return
      await activateAction(authoredSession.normalizeForSubmit(values))
    },
    [activateAction, authoredSession]
  )
  const saveDraftValues = useCallback(
    async (values: object) => {
      if (!authoredSession || !saveDraftAction) return
      await saveDraftAction(authoredSession.normalizeForSubmit(values))
    },
    [authoredSession, saveDraftAction]
  )
  const activate = useCallback(() => {
    void actionsRef.current.onActivate?.()
  }, [])
  const cancel = useCallback(() => {
    void (cancelAction ?? actionsRef.current.onCancel)?.()
  }, [cancelAction])
  const clearRegisteredPaths = useCallback((paths: readonly NodeRuntimePathDto[]) => {
    actionsRef.current.onClearPaths?.(paths)
  }, [])
  const copy = useCallback(() => {
    void (copyAction ?? actionsRef.current.onCopy)?.()
  }, [copyAction])
  const deleteRecord = useCallback(() => {
    void (deleteAction ?? actionsRef.current.onDelete)?.()
  }, [deleteAction])
  const discardDraft = useCallback(() => {
    void (discardDraftAction ?? actionsRef.current.onDiscardDraft)?.()
  }, [discardDraftAction])
  const setActiveProviderStep = useCallback(
    (stepId: string) => {
      const step = visibleSteps.find((visibleStep) => visibleStep.id === stepId)
      if (!step) return false

      setSession((current) => {
        const next = {
          ...current,
          activeStepId: step.id,
          activeStepLabel: step.label
        }

        return isSameSession(current, next) ? current : next
      })

      return true
    },
    [visibleSteps]
  )
  const goToNextStep = useCallback(() => {
    if (visibleSteps.length > 0 && activeStepIndex >= 0) {
      const nextStep = visibleSteps[Math.min(activeStepIndex + 1, visibleSteps.length - 1)]
      if (nextStep) {
        setActiveProviderStep(nextStep.id)
        return
      }
    }

    void actionsRef.current.onNextStep?.()
  }, [activeStepIndex, setActiveProviderStep, visibleSteps])
  const goToPreviousStep = useCallback(() => {
    if (visibleSteps.length > 0 && activeStepIndex >= 0) {
      const previousStep = visibleSteps[Math.max(activeStepIndex - 1, 0)]
      if (previousStep) {
        setActiveProviderStep(previousStep.id)
        return
      }
    }

    void actionsRef.current.onPreviousStep?.()
  }, [activeStepIndex, setActiveProviderStep, visibleSteps])
  const resetStep = useCallback(() => {
    void actionsRef.current.onResetStep?.()
  }, [])
  const resetForm = useCallback(() => {
    void actionsRef.current.onResetForm?.()
  }, [])
  const goToStep = useCallback((stepId: string) => {
    if (setActiveProviderStep(stepId)) return

    actionsRef.current.onStepChange?.(stepId)
  }, [setActiveProviderStep])
  const saveDraft = useCallback(() => {
    void actionsRef.current.onSaveDraft?.()
  }, [])
  const contextSession = useMemo<AuthoringFormSessionState>(
    () => ({
      ...session,
      ...(activeStep
        ? {
            activeStepId: activeStep.id,
            activeStepLabel: activeStep.label,
            isFirstStep: activeStepIndex <= 0,
            isLastStep: activeStepIndex === Math.max(visibleSteps.length - 1, 0)
          }
        : {}),
      isDeleting: session.isDeleting || isDeleting,
      isSubmitting:
        session.isSubmitting ||
        activateMutation.isPending ||
        saveDraftMutation.isPending ||
        discardDraftMutation.isPending
    }),
    [
      activateMutation.isPending,
      activeStep,
      activeStepIndex,
      discardDraftMutation.isPending,
      isDeleting,
      saveDraftMutation.isPending,
      session,
      visibleSteps.length
    ]
  )

  const value = useMemo<AuthoringFormContextValue>(
    () => ({
      ...contextSession,
      activate,
      activateValues,
      activeStep,
      cancel,
      clearPaths: clearRegisteredPaths,
      copy,
      deleteRecord,
      discardDraft,
      goToStep,
      goToNextStep,
      goToPreviousStep,
      isDiscardingDraft: discardDraftMutation.isPending,
      registerDomain,
      resetForm,
      resetStep,
      saveDraft,
      saveDraftValues,
      updateAuthoringFormActions,
      updateAuthoringFormState,
      visibleSteps
    }),
    [
      activate,
      activateValues,
      activeStep,
      cancel,
      clearRegisteredPaths,
      copy,
      contextSession,
      deleteRecord,
      discardDraft,
      discardDraftMutation.isPending,
      goToStep,
      goToNextStep,
      goToPreviousStep,
      registerDomain,
      resetForm,
      resetStep,
      saveDraft,
      saveDraftValues,
      updateAuthoringFormActions,
      updateAuthoringFormState,
      visibleSteps
    ]
  )

  return (
    <AuthoringFormContext value={value}>
      {children}
      {deleteConfirmation}
    </AuthoringFormContext>
  )
}

function isSameSession(left: AuthoringFormSessionState, right: AuthoringFormSessionState) {
  return (
    left.activeSectionId === right.activeSectionId &&
    left.activeStepId === right.activeStepId &&
    left.activeStepLabel === right.activeStepLabel &&
    left.authoredSession === right.authoredSession &&
    left.authoringKind === right.authoringKind &&
    left.activateLabel === right.activateLabel &&
    left.canCopy === right.canCopy &&
    left.canDelete === right.canDelete &&
    left.canFinalize === right.canFinalize &&
    left.canResetStep === right.canResetStep &&
    left.canResetForm === right.canResetForm &&
    left.canSaveDraft === right.canSaveDraft &&
    left.canSubmit === right.canSubmit &&
    left.copyLabel === right.copyLabel &&
    left.cancelLabel === right.cancelLabel &&
    left.characterData === right.characterData &&
    left.characterSession === right.characterSession &&
    left.deleteLabel === right.deleteLabel &&
    left.domain === right.domain &&
    left.domainData === right.domainData &&
    left.fallbackLabel === right.fallbackLabel &&
    left.fieldPathPrefix === right.fieldPathPrefix &&
    left.hasChanges === right.hasChanges &&
    left.hasStepChanges === right.hasStepChanges &&
    left.hasActiveDraft === right.hasActiveDraft &&
    left.firstBlockingStepId === right.firstBlockingStepId &&
    left.firstBlockingStatus === right.firstBlockingStatus &&
    left.isDraft === right.isDraft &&
    left.isFirstStep === right.isFirstStep &&
    left.isLastStep === right.isLastStep &&
    left.isDeleting === right.isDeleting &&
    left.isSubmitting === right.isSubmitting &&
    left.mapId === right.mapId &&
    left.mode === right.mode &&
    left.providedModel === right.providedModel &&
    left.readOnly === right.readOnly &&
    left.resolveModel === right.resolveModel &&
    left.resolvedModel === right.resolvedModel &&
    left.resetFormLabel === right.resetFormLabel &&
    left.resetStepLabel === right.resetStepLabel &&
    left.saveDraftLabel === right.saveDraftLabel &&
    isSameRecord(left.stepDirty, right.stepDirty) &&
    isSameRecord(left.stepStatuses, right.stepStatuses) &&
    isSameRecord(left.stepWarnings, right.stepWarnings) &&
    isSameProgressSummary(left.progressSummary, right.progressSummary) &&
    left.subjectKindLabel === right.subjectKindLabel &&
    left.subjectLabel === right.subjectLabel &&
    left.systemId === right.systemId
  )
}

function getDomainRegistration(
  domain: AuthoredFormDomain,
  mode: AuthoringFormSessionState['mode'],
  data: unknown
): AuthoringFormStatePatch {
  const factory = authoredFormFactories[domain]
  const authoredSession =
    data === undefined ? undefined : factory.createSession?.({ data, mode })

  return {
    activeSectionId: undefined,
    activeStepId: undefined,
    activeStepLabel: undefined,
    authoredSession,
    authoringKind: 'authored-form',
    characterData: undefined,
    characterSession: undefined,
    domain,
    fallbackLabel: factory.fallbackLabel,
    mapId: factory.mapId,
    providedModel: undefined,
    resolvedModel: undefined,
    subjectKindLabel: factory.subjectKindLabel,
    ...(authoredSession
      ? {
          fallbackLabel: authoredSession.fallbackLabel,
          mapId: authoredSession.mapId,
          mode: authoredSession.mode,
          subjectKindLabel: authoredSession.subjectKindLabel,
          subjectLabel: authoredSession.subjectLabel,
          systemId: authoredSession.systemId
        }
      : {})
  }
}

function applyDomainRegistration(
  current: AuthoringFormSessionState,
  registration: AuthoringDomainRegistration
): AuthoringFormSessionState {
  const nextMode = registration.mode ?? current.mode

  return {
    ...current,
    domain: registration.domain,
    domainData: registration.data,
    mode: nextMode,
    ...getDomainRegistration(registration.domain, nextMode, registration.data)
  }
}

function getCharacterBuilderRegistration(
  mode: CharacterBuilderRouteMode,
  data: unknown
): AuthoringFormStatePatch {
  const characterSession =
    data === undefined
      ? undefined
      : createCharacterBuilderAuthoringSession({
          data,
          mode
        })

  return {
    activeSectionId: undefined,
    activeStepId: undefined,
    activeStepLabel: undefined,
    activateLabel: 'Finalize Character',
    authoredSession: undefined,
    authoringKind: 'character-builder',
    canCopy: false,
    canDelete: false,
    canResetForm: false,
    canResetStep: false,
    canSaveDraft: Boolean(
      characterSession && !characterSession.systemRequired && !characterSession.notFound
    ),
    canSubmit: false,
    characterData: data,
    characterSession,
    domain: undefined,
    domainData: undefined,
    fallbackLabel: 'Untitled Character',
    fieldPathPrefix: undefined,
    firstBlockingStatus: undefined,
    firstBlockingStepId: undefined,
    hasChanges: false,
    hasActiveDraft: characterSession?.hasActiveDraft ?? false,
    hasStepChanges: false,
    isDraft: characterSession?.isDraft ?? false,
    isFirstStep: true,
    isLastStep: true,
    mapId: undefined,
    mode,
    progressSummary: undefined,
    providedModel: undefined,
    readOnly: characterSession?.readOnly ?? false,
    resolveModel: false,
    resolvedModel: undefined,
    saveDraftLabel: 'Save Draft',
    stepDirty: EMPTY_STEP_DIRTY,
    stepStatuses: EMPTY_STEP_STATUSES,
    stepWarnings: EMPTY_STEP_WARNINGS,
    subjectKindLabel: 'Character',
    subjectLabel: characterSession?.subjectLabel,
    systemId: characterSession?.systemId
  }
}

function applyCharacterBuilderRegistration(
  current: AuthoringFormSessionState,
  registration: {
    data?: unknown
    mode: CharacterBuilderRouteMode
  }
): AuthoringFormSessionState {
  return {
    ...current,
    ...getCharacterBuilderRegistration(registration.mode, registration.data)
  }
}

function createInitialSession(registration: {
  data?: unknown
  domain?: AuthoredFormDomain
  kind?: 'authored-form' | 'character-builder'
  mode?: AuthoringFormSessionState['mode']
}): AuthoringFormSessionState {
  const session = createDefaultSession()
  if (registration.kind === 'character-builder') {
    return applyCharacterBuilderRegistration(session, {
      data: registration.data,
      mode: registration.mode === 'edit' ? 'edit' : 'create'
    })
  }
  if (!registration.domain) return session

  return applyDomainRegistration(session, {
    data: registration.data,
    domain: registration.domain,
    mode: registration.mode
  })
}

function createDefaultSession(): AuthoringFormSessionState {
  return {
    activateLabel: 'Activate',
    canCopy: false,
    canDelete: false,
    canFinalize: false,
    canResetForm: false,
    canResetStep: false,
    canSaveDraft: false,
    canSubmit: false,
    copyLabel: 'Duplicate to edit',
    cancelLabel: 'Cancel',
    deleteLabel: 'Delete',
    fallbackLabel: 'Untitled Item',
    hasChanges: false,
    hasStepChanges: false,
    hasActiveDraft: false,
    isDraft: false,
    isFirstStep: true,
    isLastStep: true,
    isDeleting: false,
    isSubmitting: false,
    mode: 'create',
    readOnly: false,
    resolveModel: true,
    resetFormLabel: 'Reset Form',
    resetStepLabel: 'Reset Step',
    saveDraftLabel: 'Save Draft',
    stepDirty: EMPTY_STEP_DIRTY,
    stepStatuses: EMPTY_STEP_STATUSES,
    stepWarnings: EMPTY_STEP_WARNINGS,
    subjectKindLabel: 'Item'
  }
}

function isSameRecord<TValue>(
  left: Partial<Record<string, TValue>>,
  right: Partial<Record<string, TValue>>
) {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false

  return leftKeys.every((key) => left[key] === right[key])
}

function isSameProgressSummary(
  left: AuthoringFormSessionState['progressSummary'],
  right: AuthoringFormSessionState['progressSummary']
) {
  if (left === right) return true
  if (!left || !right) return false

  return (
    left.completeCount === right.completeCount &&
    left.errorCount === right.errorCount &&
    left.incompleteCount === right.incompleteCount &&
    left.stepCount === right.stepCount &&
    left.warningCount === right.warningCount
  )
}
