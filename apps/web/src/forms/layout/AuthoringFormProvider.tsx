import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useConvex } from 'convex/react'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useBlocker, useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { useSelector } from '@tanstack/react-form'
import { useAuthoredDeleteAction } from '#components/AuthoredDelete'
import {
  AuthoringActionsContext,
  AuthoringFormStoreContext,
  AuthoringNavigationContext,
  AuthoringResolutionContext,
  AuthoringSessionContext,
  AuthoringStagedEditorContext,
  type AuthoringActionsContextValue,
  type AuthoringDomainRegistration,
  type AuthoringFormActionHandlers,
  type AuthoringFormNavigationState,
  type AuthoringFormStatePatch,
  type AuthoringFormStoreContextValue,
  type AuthoringFormSessionState,
  type AuthoringNavigationContextValue,
  type AuthoringResolution,
  type AuthoringSessionContextValue,
  type AuthoringStagedEditorContextValue
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
import type {
  AuthoredFormDomain,
  AuthoredFormSession
} from '../factories/authoredFormFactories.types'
import { areAuthoringFieldPathsRelated, toAuthoringFieldName } from '../utils/pathUtils'
import type { GroupEditorTransaction } from '../rendering/FormRenderer.context'
import { resetVisibleStepFields } from '../rendering/FormRenderer.utils'
import { useAuthoredFormInstance } from './useAuthoredFormInstance'
import { useAuthoredFormDerivedState } from './useAuthoredFormDerivedState'
import {
  CHARACTER_BUILDER_TIMING_MARK,
  startCharacterBuilderTiming
} from '#domains/characters/builder/core/characterBuilder.performance'
import {
  areAuthoringStepIdsEqual,
  isAuthoringStepNavigationState,
  isAuthoringStepOnlyNavigation,
  markAuthoringStepNavigationState,
  readAuthoringStep,
  toAuthoringStepSearchValue
} from './authoringSearch'
import { useShellReturnHref } from '#app/shell/returnLocation'
import { AuthoringLeaveConfirmation } from './AuthoringLeaveConfirmation'
import {
  addVisitedStep,
  applyCharacterBuilderRegistration,
  applyDomainRegistration,
  createCharacterBuilderRegistration,
  createInitialSession,
  getCharacterBuilderSessionSignature,
  isSameSession,
  resolveRequestedNavigation
} from './authoringSessionState'

const EMPTY_NAVIGATION_TARGETS: AuthoringFormNavigationState['navigationTargets'] = []
const EMPTY_OPERATION_CONFIG: AuthoredFormSession['operations'] = {
  activate: async () => undefined,
  saveDraft: async () => {
    throw new Error('No authored form session is registered.')
  }
}
const EMPTY_DELETE_CONFIG = {
  deleteActive: async () => undefined,
  deleteDraft: async () => undefined,
  detailSubjectQueryKey: ['authoring', 'empty-detail'] as const,
  domainQueryKey: ['authoring', 'empty-domain'] as const,
  draftQueryKey: ['authoring', 'empty-draft'] as const
}

type AuthoringFormProviderProps = {
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
  const convexClient = useConvex()
  const requestedStepId = useRouterState({
    select: (state) => readAuthoringStep(state.location.search)
  })
  const isCurrentNavigationEntryMarked = useRouterState({
    select: (state) => isAuthoringStepNavigationState(state.location.state)
  })
  const [session, setSession] = useState<AuthoringFormSessionState>(() =>
    createInitialSession({ data, domain, kind, mode, requestedStepId }, convexClient)
  )
  const [cancelConfirmationOpened, setCancelConfirmationOpened] = useState(false)
  const [groupEditor, setGroupEditor] = useState<GroupEditorTransaction>()
  const sessionRef = useRef(session)
  useEffect(() => {
    sessionRef.current = session
  }, [session])
  const actionsRef = useRef<AuthoringFormActionHandlers>({})
  const intentionalNavigationRef = useRef(false)
  const pendingStepIdRef = useRef<string | undefined>(undefined)
  const requestedStepIdRef = useRef(requestedStepId)
  const authoredSession = session.authoredSession
  const isCharacterBuilder = session.authoringKind === 'character-builder'
  const shellReturnHref = useShellReturnHref()
  const cancelHref =
    shellReturnHref ??
    (isCharacterBuilder ? '/characters' : authoredSession?.actionFactory.listPath)
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const navigateWithoutBlock = useCallback<typeof navigate>(
    async (options) => {
      intentionalNavigationRef.current = true
      try {
        await navigate({ ...options, ignoreBlocker: true })
      } finally {
        intentionalNavigationRef.current = false
      }
    },
    [navigate]
  )
  const navigateToAuthoringStep = useCallback(
    (stepId: string, replace = false) => {
      const searchStepId = toAuthoringStepSearchValue(stepId)
      pendingStepIdRef.current = searchStepId
      requestedStepIdRef.current = searchStepId
      void navigate({
        to: '.',
        search: (current: Record<string, unknown>) => ({ ...current, step: searchStepId }),
        state: markAuthoringStepNavigationState,
        replace,
        resetScroll: false
      })
    },
    [navigate]
  )

  useEffect(() => {
    if (isCurrentNavigationEntryMarked) return

    void navigate({
      to: '.',
      search: true,
      state: markAuthoringStepNavigationState,
      replace: true,
      resetScroll: false
    })
  }, [isCurrentNavigationEntryMarked, navigate])
  const operations = authoredSession?.operations ?? EMPTY_OPERATION_CONFIG
  const { mutateAsync: activateAsync, isPending: isActivating } = useMutation({
    mutationFn: (payload: object) => operations.activate(payload),
    onSuccess: async (response: ActivatedAuthoringResponse) => {
      setSession((current) => ({ ...current, validationIssues: [] }))
      await operations.onActivateSuccess?.(queryClient, response)
    }
  })
  const { mutateAsync: saveDraftAsync, isPending: isSavingDraft } = useMutation({
    mutationFn: (payload: object) => operations.saveDraft(payload),
    onSuccess: async (draft: DraftAuthoringResponse) => {
      setSession((current) => ({ ...current, validationIssues: [] }))
      await operations.onSaveDraftSuccess?.(queryClient, draft)
    }
  })
  const { mutateAsync: discardDraftAsync, isPending: isDiscardingDraft } = useMutation({
    mutationFn: () => operations.discardDraft?.() ?? Promise.resolve(),
    onSuccess: async () => {
      await operations.onDiscardDraftSuccess?.(queryClient)
    }
  })
  const { mutateAsync: duplicateAsync } = useMutation({
    mutationFn: (subjectId: string) => operations.duplicate?.(subjectId) ?? Promise.resolve(null),
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
    onDeleted: async () =>
      navigateWithoutBlock({ to: authoredSession?.actionFactory.listPath ?? '/' })
  })
  const getActivateAction = useCallback(() => {
    if (!authoredSession) return undefined

    return createActivateAction({
      activateMutation: { mutateAsync: activateAsync },
      buildRouteParams: authoredSession.actionFactory.buildRouteParams,
      detailPath: authoredSession.actionFactory.activatePath,
      messages: authoredSession.actionFactory.messages,
      navigate: navigateWithoutBlock,
      notifier: notifications,
      readOnly: authoredSession.readOnly,
      router,
      subjectId: authoredSession.subjectId
    })
  }, [activateAsync, authoredSession, navigateWithoutBlock, router])
  const getCancelAction = useCallback(
    () =>
      cancelHref
        ? createCancelAction({ listPath: cancelHref, navigate: navigateWithoutBlock })
        : undefined,
    [cancelHref, navigateWithoutBlock]
  )
  const getCopyAction = useCallback(() => {
    if (!authoredSession?.subjectId) return undefined

    return createCopyAction({
      buildRouteParams: authoredSession.actionFactory.buildRouteParams,
      duplicateMutation: { mutateAsync: duplicateAsync },
      editPath: authoredSession.actionFactory.editPath,
      messages: authoredSession.actionFactory.messages,
      navigate: navigateWithoutBlock,
      notifier: notifications,
      subjectId: authoredSession.subjectId
    })
  }, [authoredSession, duplicateAsync, navigateWithoutBlock])
  const deleteAction = useMemo(() => {
    if (!authoredSession?.subjectId) return undefined

    return createDeleteRequestAction({
      draft: Boolean(authoredSession.draft),
      label:
        typeof authoredSession.subjectLabel === 'string' ? authoredSession.subjectLabel : undefined,
      requestDelete,
      subjectId: authoredSession.subjectId,
      subjectKindLabel: authoredSession.subjectKindLabel
    })
  }, [authoredSession, requestDelete])
  const getDiscardDraftAction = useCallback(() => {
    if (!authoredSession) return undefined

    return createDiscardDraftAction({
      activeRecord: authoredSession.activeRecord,
      discardDraftMutation: { mutateAsync: discardDraftAsync },
      listPath: authoredSession.actionFactory.listPath,
      messages: authoredSession.actionFactory.messages,
      navigate: navigateWithoutBlock,
      notifier: notifications,
      router
    })
  }, [authoredSession, discardDraftAsync, navigateWithoutBlock, router])
  const getSaveDraftAction = useCallback(() => {
    if (!authoredSession) return undefined

    if (authoredSession.mode === 'create') {
      return createCreateDraftAction({
        buildRouteParams: authoredSession.actionFactory.buildRouteParams,
        draftMutation: { mutateAsync: saveDraftAsync },
        editPath: authoredSession.actionFactory.editPath,
        messages: authoredSession.actionFactory.messages,
        navigate: navigateWithoutBlock,
        notifier: notifications
      })
    }

    return createUpdateDraftAction({
      draftMutation: { mutateAsync: saveDraftAsync },
      messages: authoredSession.actionFactory.messages,
      notifier: notifications,
      readOnly: authoredSession.readOnly
    })
  }, [authoredSession, navigateWithoutBlock, saveDraftAsync])
  const registerDomain = useCallback(
    (registration: AuthoredFormDomain | AuthoringDomainRegistration) => {
      setSession((current) => {
        const registered =
          typeof registration === 'string'
            ? applyDomainRegistration(current, { domain: registration }, convexClient)
            : applyDomainRegistration(current, registration, convexClient)
        const next = resolveRequestedNavigation(registered, requestedStepIdRef.current)

        return isSameSession(current, next) ? current : next
      })
    },
    [convexClient]
  )
  useEffect(() => {
    if (kind === 'character-builder') {
      const nextMode: AuthoringFormStatePatch['mode'] = mode === 'edit' ? 'edit' : 'create'
      const nextCharacterRegistration = createCharacterBuilderRegistration(nextMode, data)
      const nextCharacterSession = nextCharacterRegistration.characterSession

      setSession((current) => {
        if (
          current.authoringKind === 'character-builder' &&
          current.characterSession &&
          getCharacterBuilderSessionSignature(current.characterSession) ===
            getCharacterBuilderSessionSignature(nextCharacterSession)
        ) {
          return current
        }

        const next = resolveRequestedNavigation(
          applyCharacterBuilderRegistration(current, {
            data,
            mode: nextMode,
            characterSession: nextCharacterSession
          }),
          requestedStepIdRef.current
        )

        return isSameSession(current, next) ? current : next
      })
      return
    }

    if (!domain) return

    setSession((current) => {
      const next = resolveRequestedNavigation(
        applyDomainRegistration(
          current,
          {
            data,
            domain,
            mode
          },
          convexClient
        ),
        requestedStepIdRef.current
      )

      return isSameSession(current, next) ? current : next
    })
  }, [data, domain, kind, mode, convexClient])

  useEffect(() => {
    if (!session.domain) return

    setSession((current) => {
      if (!current.domain) return current

      const next = resolveRequestedNavigation(
        applyDomainRegistration(
          current,
          {
            data: current.domainData,
            domain: current.domain,
            mode: current.mode
          },
          convexClient
        ),
        requestedStepIdRef.current
      )

      return isSameSession(current, next) ? current : next
    })
  }, [session.domain, session.domainData, session.mode, convexClient])

  const updateAuthoringFormState = useCallback((patch: AuthoringFormStatePatch) => {
    setSession((current) => {
      const next = resolveRequestedNavigation(
        {
          ...current,
          ...patch
        },
        requestedStepIdRef.current
      )

      return isSameSession(current, next) ? current : next
    })
  }, [])

  const updateAuthoringFormActions = useCallback((actions: AuthoringFormActionHandlers) => {
    actionsRef.current = {
      ...actionsRef.current,
      ...actions
    }
  }, [])
  const activateValues = useCallback(
    async (values: object) => {
      const activateAction = getActivateAction()
      if (!authoredSession || !activateAction) return
      await activateAction(authoredSession.normalizeForSubmit(values))
    },
    [getActivateAction, authoredSession]
  )
  const saveDraftValues = useCallback(
    async (values: object) => {
      const saveDraftAction = getSaveDraftAction()
      if (!authoredSession || !saveDraftAction) return
      return saveDraftAction(authoredSession.normalizeForSubmit(values))
    },
    [authoredSession, getSaveDraftAction]
  )
  const clearValidationIssues = useCallback((fieldName: string) => {
    setSession((current) => {
      const validationIssues = current.validationIssues.filter(
        (issue) =>
          !areAuthoringFieldPathsRelated(toAuthoringFieldName(undefined, issue.path), fieldName)
      )
      if (validationIssues.length === current.validationIssues.length) return current

      return {
        ...current,
        validationIssues
      }
    })
  }, [])
  const authoredForm = useAuthoredFormInstance({
    activateValues,
    clearValidationIssues,
    saveDraftValues,
    session: authoredSession
  })
  const { form } = authoredForm
  const { navigation: authoredNavigation, resolution } = useAuthoredFormDerivedState({
    enabled: Boolean(authoredSession) && session.resolveModel,
    form,
    mapId: session.mapId,
    stepWarnings: session.stepWarnings,
    systemId: session.systemId,
    validationIssues: session.validationIssues
  })
  const builderNavigation = useMemo<AuthoringFormNavigationState | undefined>(
    () =>
      isCharacterBuilder
        ? {
            isComplete: session.canFinalize,
            navigationTargets: EMPTY_NAVIGATION_TARGETS,
            navigationTree: undefined,
            progressSummary: session.progressSummary,
            stepStatuses: session.stepStatuses,
            visibleSteps: session.visibleSteps ?? []
          }
        : undefined,
    [
      isCharacterBuilder,
      session.canFinalize,
      session.progressSummary,
      session.stepStatuses,
      session.visibleSteps
    ]
  )
  const navigationState = builderNavigation ?? authoredNavigation
  const { navigationTargets, visibleSteps } = navigationState
  const activeNavigationTarget =
    navigationTargets.find((target) =>
      areAuthoringStepIdsEqual(target.id, session.activeNavigationTargetId)
    ) ?? navigationTargets[0]
  const activeStep =
    visibleSteps.find(
      (step) => step.id === (activeNavigationTarget?.stepId ?? session.activeStepId)
    ) ?? visibleSteps[0]
  const activeStepIndex = activeStep
    ? visibleSteps.findIndex((step) => step.id === activeStep.id)
    : -1
  const activeNavigationTargetIndex = activeNavigationTarget
    ? navigationTargets.findIndex((target) => target.id === activeNavigationTarget.id)
    : -1
  const visitedStepIds = useMemo(
    () =>
      activeNavigationTarget
        ? addVisitedStep(session.visitedStepIds, activeNavigationTarget.id)
        : session.visitedStepIds,
    [activeNavigationTarget, session.visitedStepIds]
  )
  const formHasChanges = useSelector(form.store, (state) => state.isDirty)
  const hasUnsavedAuthoredChanges = !isCharacterBuilder && formHasChanges
  const shouldBlockNavigation = useCallback(
    ({
      current,
      next
    }: {
      current: { pathname: string; search: unknown }
      next: { pathname: string; search: unknown }
    }) =>
      hasUnsavedAuthoredChanges &&
      !intentionalNavigationRef.current &&
      !isAuthoringStepOnlyNavigation(current, next),
    [hasUnsavedAuthoredChanges]
  )
  const navigationBlocker = useBlocker({
    disabled: !hasUnsavedAuthoredChanges,
    enableBeforeUnload: () => hasUnsavedAuthoredChanges,
    shouldBlockFn: shouldBlockNavigation,
    withResolver: true
  })
  const activate = useCallback(() => {
    if (isCharacterBuilder) {
      void actionsRef.current.onActivate?.()
      return
    }
    void form.handleSubmit()
  }, [form, isCharacterBuilder])
  const performCancel = useCallback(async () => {
    setCancelConfirmationOpened(false)
    intentionalNavigationRef.current = true
    try {
      await (getCancelAction() ?? actionsRef.current.onCancel)?.()
    } finally {
      intentionalNavigationRef.current = false
    }
  }, [getCancelAction])
  const cancel = useCallback(() => {
    if (groupEditor) return
    const hasChanges = isCharacterBuilder ? sessionRef.current.hasChanges : form.state.isDirty
    if (hasChanges) {
      setCancelConfirmationOpened(true)
      return
    }

    void performCancel()
  }, [form, groupEditor, isCharacterBuilder, performCancel])
  const copy = useCallback(() => {
    void getCopyAction()?.()
  }, [getCopyAction])
  const copySource = useCallback(
    async (subjectId: string) => {
      if (!authoredSession) return

      await createCopyAction({
        buildRouteParams: authoredSession.actionFactory.buildRouteParams,
        duplicateMutation: { mutateAsync: duplicateAsync },
        editPath: authoredSession.actionFactory.editPath,
        messages: authoredSession.actionFactory.messages,
        navigate: navigateWithoutBlock,
        notifier: notifications,
        subjectId
      })()
    },
    [authoredSession, duplicateAsync, navigateWithoutBlock]
  )
  const deleteRecord = useCallback(() => {
    void (deleteAction ?? actionsRef.current.onDelete)?.()
  }, [deleteAction])

  const discardDraft = useCallback(() => {
    void (getDiscardDraftAction() ?? actionsRef.current.onDiscardDraft)?.()
  }, [getDiscardDraftAction])
  const setActiveProviderStep = useCallback(
    (stepId: string) => {
      const step = visibleSteps.find((visibleStep) => visibleStep.id === stepId)
      if (!step) return false

      setSession((current) => {
        const next = {
          ...current,
          activeStepId: step.id,
          activeStepLabel: step.label,
          visitedStepIds: addVisitedStep(current.visitedStepIds, step.id)
        }

        return isSameSession(current, next) ? current : next
      })

      return true
    },
    [visibleSteps]
  )
  const setActiveNavigationTarget = useCallback(
    (targetId: string) => {
      const target = navigationTargets.find((navigationTarget) => navigationTarget.id === targetId)
      if (!target) return false

      setSession((current) => {
        const next = {
          ...current,
          activeNavigationTargetId: target.id,
          visitedStepIds: addVisitedStep(visitedStepIds, target.id)
        }

        return isSameSession(current, next) ? current : next
      })

      return true
    },
    [navigationTargets, visitedStepIds]
  )
  const goToNextStep = useCallback(() => {
    if (isCharacterBuilder) {
      const nextStep = visibleSteps[Math.min(activeStepIndex + 1, visibleSteps.length - 1)]
      if (!nextStep || nextStep.id === activeStep?.id) return

      startCharacterBuilderTiming(CHARACTER_BUILDER_TIMING_MARK.STEP_NAVIGATION_INTENT)
      setActiveProviderStep(nextStep.id)
      navigateToAuthoringStep(nextStep.id)
      return
    }

    if (navigationTargets.length > 0 && activeNavigationTargetIndex >= 0) {
      const nextTarget =
        navigationTargets[Math.min(activeNavigationTargetIndex + 1, navigationTargets.length - 1)]
      if (nextTarget) {
        setActiveNavigationTarget(nextTarget.id)
        navigateToAuthoringStep(nextTarget.id)
        return
      }
    }

    if (visibleSteps.length > 0 && activeStepIndex >= 0) {
      const nextStep = visibleSteps[Math.min(activeStepIndex + 1, visibleSteps.length - 1)]
      if (nextStep) {
        setActiveProviderStep(nextStep.id)
        navigateToAuthoringStep(nextStep.id)
      }
    }
  }, [
    activeNavigationTargetIndex,
    activeStepIndex,
    isCharacterBuilder,
    navigationTargets,
    navigateToAuthoringStep,
    setActiveNavigationTarget,
    setActiveProviderStep,
    activeStep?.id,
    visibleSteps
  ])
  const goToPreviousStep = useCallback(() => {
    if (isCharacterBuilder) {
      const previousStep = visibleSteps[Math.max(activeStepIndex - 1, 0)]
      if (!previousStep || previousStep.id === activeStep?.id) return

      startCharacterBuilderTiming(CHARACTER_BUILDER_TIMING_MARK.STEP_NAVIGATION_INTENT)
      setActiveProviderStep(previousStep.id)
      navigateToAuthoringStep(previousStep.id)
      return
    }

    if (navigationTargets.length > 0 && activeNavigationTargetIndex >= 0) {
      const previousTarget = navigationTargets[Math.max(activeNavigationTargetIndex - 1, 0)]
      if (previousTarget) {
        setActiveNavigationTarget(previousTarget.id)
        navigateToAuthoringStep(previousTarget.id)
        return
      }
    }

    if (visibleSteps.length > 0 && activeStepIndex >= 0) {
      const previousStep = visibleSteps[Math.max(activeStepIndex - 1, 0)]
      if (previousStep) {
        setActiveProviderStep(previousStep.id)
        navigateToAuthoringStep(previousStep.id)
      }
    }
  }, [
    activeNavigationTargetIndex,
    activeStepIndex,
    isCharacterBuilder,
    navigationTargets,
    navigateToAuthoringStep,
    setActiveNavigationTarget,
    setActiveProviderStep,
    activeStep?.id,
    visibleSteps
  ])
  const resetStep = useCallback(() => {
    if (!isCharacterBuilder) resetVisibleStepFields(form, activeStep?.sections ?? [])
  }, [activeStep, form, isCharacterBuilder])
  const resetForm = useCallback(() => {
    if (isCharacterBuilder) {
      void actionsRef.current.onResetForm?.()
      return
    }
    authoredForm.resetForm()
  }, [authoredForm, isCharacterBuilder])
  const goToNavigationTarget = useCallback(
    (targetId: string) => {
      if (setActiveNavigationTarget(targetId)) {
        navigateToAuthoringStep(targetId)
        return
      }

      setSession((current) => {
        const next = {
          ...current,
          activeNavigationTargetId: targetId,
          visitedStepIds: addVisitedStep(current.visitedStepIds, targetId)
        }

        return isSameSession(current, next) ? current : next
      })
      navigateToAuthoringStep(targetId)
    },
    [navigateToAuthoringStep, setActiveNavigationTarget]
  )
  const goToStep = useCallback(
    (stepId: string) => {
      if (isCharacterBuilder) {
        if (!visibleSteps.some((step) => step.id === stepId)) return

        startCharacterBuilderTiming(CHARACTER_BUILDER_TIMING_MARK.STEP_NAVIGATION_INTENT)
        setActiveProviderStep(stepId)
        navigateToAuthoringStep(stepId)
        return
      }

      const target = navigationTargets.find(
        (navigationTarget) => navigationTarget.id === stepId || navigationTarget.stepId === stepId
      )
      if (target && setActiveNavigationTarget(target.id)) {
        navigateToAuthoringStep(target.id)
        return
      }
      setActiveProviderStep(stepId)
      navigateToAuthoringStep(stepId)
    },
    [
      isCharacterBuilder,
      navigateToAuthoringStep,
      navigationTargets,
      setActiveNavigationTarget,
      setActiveProviderStep,
      visibleSteps
    ]
  )
  const commitRequestedNavigation = useCallback(
    (stepId: string | undefined) => {
      requestedStepIdRef.current = stepId

      if (isCharacterBuilder) {
        const fallbackStepId = session.activeStepId
        const targetStep =
          visibleSteps.find((step) => areAuthoringStepIdsEqual(step.id, stepId)) ??
          visibleSteps.find((step) => step.id === fallbackStepId) ??
          visibleSteps[0]
        if (targetStep) setActiveProviderStep(targetStep.id)
        return
      }

      if (navigationTargets.length === 0) return
      const target =
        navigationTargets.find((entry) => areAuthoringStepIdsEqual(entry.id, stepId)) ??
        navigationTargets[0]
      if (target) setActiveNavigationTarget(target.id)
    },
    [
      isCharacterBuilder,
      navigationTargets,
      setActiveNavigationTarget,
      setActiveProviderStep,
      visibleSteps
    ]
  )

  useEffect(
    () =>
      router.subscribe('onBeforeNavigate', (event) => {
        if (event.pathChanged) return
        if (pendingStepIdRef.current) return
        commitRequestedNavigation(readAuthoringStep(event.toLocation.search))
      }),
    [commitRequestedNavigation, router]
  )

  useEffect(() => {
    const pendingStepId = pendingStepIdRef.current
    if (pendingStepId && !areAuthoringStepIdsEqual(pendingStepId, requestedStepId)) return
    if (pendingStepId && areAuthoringStepIdsEqual(pendingStepId, requestedStepId)) {
      const targetIsPublished = isCharacterBuilder
        ? visibleSteps.some((step) => areAuthoringStepIdsEqual(step.id, pendingStepId))
        : navigationTargets.some((target) => areAuthoringStepIdsEqual(target.id, pendingStepId))
      if (!targetIsPublished) return
      pendingStepIdRef.current = undefined
      return
    }
    commitRequestedNavigation(requestedStepId)
  }, [
    commitRequestedNavigation,
    isCharacterBuilder,
    navigationTargets,
    requestedStepId,
    visibleSteps
  ])

  useEffect(() => {
    if (!requestedStepId) return
    if (areAuthoringStepIdsEqual(pendingStepIdRef.current, requestedStepId)) return

    const isValid = isCharacterBuilder
      ? visibleSteps.some((step) => areAuthoringStepIdsEqual(step.id, requestedStepId))
      : navigationTargets.length === 0 ||
        navigationTargets.some((target) => areAuthoringStepIdsEqual(target.id, requestedStepId))
    if (isValid) return

    const fallbackStepId = isCharacterBuilder ? activeStep?.id : activeNavigationTarget?.id
    if (fallbackStepId) navigateToAuthoringStep(fallbackStepId, true)
  }, [
    activeNavigationTarget?.id,
    activeStep?.id,
    isCharacterBuilder,
    navigateToAuthoringStep,
    navigationTargets,
    requestedStepId,
    visibleSteps
  ])
  const saveDraft = useCallback(() => {
    if (isCharacterBuilder) return actionsRef.current.onSaveDraft?.()
    return authoredForm.saveDraft()
  }, [authoredForm, isCharacterBuilder])
  const isMutating = isActivating || isSavingDraft || isDiscardingDraft
  const sessionValue = useMemo<AuthoringSessionContextValue>(
    () => ({
      ...session,
      cancelHref,
      isDeleting: session.isDeleting || isDeleting,
      isDiscardingDraft
    }),
    [cancelHref, isDiscardingDraft, isDeleting, session]
  )
  const actionsValue = useMemo<AuthoringActionsContextValue>(
    () => ({
      activate,
      activateValues,
      cancel,
      clearValidationIssues,
      copy,
      copySource,
      deleteRecord,
      discardDraft,
      registerDomain,
      resetForm,
      resetStep,
      saveDraft,
      saveDraftValues,
      updateAuthoringFormActions,
      updateAuthoringFormState
    }),
    [
      activate,
      activateValues,
      cancel,
      clearValidationIssues,
      copy,
      copySource,
      deleteRecord,
      discardDraft,
      registerDomain,
      resetForm,
      resetStep,
      saveDraft,
      saveDraftValues,
      updateAuthoringFormActions,
      updateAuthoringFormState
    ]
  )
  const navigationValue = useMemo<AuthoringNavigationContextValue>(
    () => ({
      ...navigationState,
      activeNavigationTarget,
      activeStep,
      ...(activeNavigationTarget
        ? {
            activeStepId: activeNavigationTarget.stepId ?? activeNavigationTarget.canvasStepId,
            activeStepLabel: activeNavigationTarget.canvasLabel ?? activeNavigationTarget.label,
            fieldPathPrefix: activeNavigationTarget.fieldPathPrefix,
            isFirstStep: activeNavigationTargetIndex <= 0,
            isLastStep: activeNavigationTargetIndex === Math.max(navigationTargets.length - 1, 0)
          }
        : {
            activeStepId: activeStep?.id ?? session.activeStepId,
            activeStepLabel: activeStep?.label ?? session.activeStepLabel,
            isFirstStep: activeStepIndex <= 0,
            isLastStep: activeStepIndex === Math.max(visibleSteps.length - 1, 0)
          }),
      goToNavigationTarget,
      goToNextStep,
      goToPreviousStep,
      goToStep,
      visitedStepIds
    }),
    [
      activeNavigationTarget,
      activeNavigationTargetIndex,
      activeStep,
      activeStepIndex,
      goToNavigationTarget,
      goToNextStep,
      goToPreviousStep,
      goToStep,
      navigationState,
      navigationTargets.length,
      session.activeStepId,
      session.activeStepLabel,
      visibleSteps.length,
      visitedStepIds
    ]
  )
  const builderStatus = useMemo(
    () =>
      isCharacterBuilder
        ? {
            canFinalize: session.canFinalize,
            canResetForm: session.canResetForm,
            canResetStep: session.canResetStep,
            canSubmit: session.canSubmit,
            hasChanges: session.hasChanges,
            hasStepChanges: session.hasStepChanges,
            isSubmitting: session.isSubmitting || isMutating
          }
        : undefined,
    [
      isCharacterBuilder,
      isMutating,
      session.canFinalize,
      session.canResetForm,
      session.canResetStep,
      session.canSubmit,
      session.hasChanges,
      session.hasStepChanges,
      session.isSubmitting
    ]
  )
  const formStoreValue = useMemo<AuthoringFormStoreContextValue>(
    () => ({ builderStatus, form, isMutating }),
    [builderStatus, form, isMutating]
  )
  const resolutionValue = useMemo<AuthoringResolution>(
    () => ({
      error: resolution.error,
      isRetrying: resolution.isRetrying,
      model: resolution.model,
      refetch: resolution.refetch
    }),
    [resolution.error, resolution.isRetrying, resolution.model, resolution.refetch]
  )
  const stagedEditorValue = useMemo<AuthoringStagedEditorContextValue>(
    () => ({ groupEditor, setGroupEditor }),
    [groupEditor]
  )

  return (
    <AuthoringSessionContext value={sessionValue}>
      <AuthoringActionsContext value={actionsValue}>
        <AuthoringFormStoreContext value={formStoreValue}>
          <AuthoringNavigationContext value={navigationValue}>
            <AuthoringResolutionContext value={resolutionValue}>
              <AuthoringStagedEditorContext value={stagedEditorValue}>
                {children}
              </AuthoringStagedEditorContext>
            </AuthoringResolutionContext>
          </AuthoringNavigationContext>
        </AuthoringFormStoreContext>
      </AuthoringActionsContext>
      {deleteConfirmation}
      <AuthoringLeaveConfirmation
        opened={cancelConfirmationOpened || navigationBlocker.status === 'blocked'}
        onStay={() => {
          setCancelConfirmationOpened(false)
          if (navigationBlocker.status === 'blocked') navigationBlocker.reset()
        }}
        onLeave={() => {
          if (cancelConfirmationOpened) {
            void performCancel()
            return
          }
          if (navigationBlocker.status === 'blocked') navigationBlocker.proceed()
        }}
      />
    </AuthoringSessionContext>
  )
}
