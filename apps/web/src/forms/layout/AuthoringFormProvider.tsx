import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useBlocker, useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import type { NodeRuntimePathDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { ApiError } from '#lib/api'
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
import { areAuthoringFieldPathsRelated, toAuthoringFieldName } from '../utils/pathUtils'
import { findAuthoringValidationTarget } from './authoringNavigation'
import { createCharacterBuilderAuthoringSession } from '#domains/characters/builder/state/characterBuilderAuthoringSession'
import type { CharacterBuilderAuthoringSession } from '#domains/characters/builder/state/characterBuilderAuthoringSession'
import {
  CHARACTER_BUILDER_TIMING_MARK,
  startCharacterBuilderTiming
} from '#domains/characters/builder/core/characterBuilder.performance'
import type { CharacterBuilderRouteMode } from './authoredFormRouteContext'
import {
  areAuthoringStepIdsEqual,
  isAuthoringStepNavigationState,
  isAuthoringStepOnlyNavigation,
  markAuthoringStepNavigationState,
  readAuthoringStep,
  toAuthoringStepSearchValue
} from './authoringSearch'
import { useShellReturnHref } from '#app/shell/returnLocation'

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
  const requestedStepId = useRouterState({
    select: (state) => readAuthoringStep(state.location.search)
  })
  const isCurrentNavigationEntryMarked = useRouterState({
    select: (state) => isAuthoringStepNavigationState(state.location.state)
  })
  const [session, setSession] = useState<AuthoringFormSessionState>(() =>
    createInitialSession({ data, domain, kind, mode, requestedStepId })
  )
  const [cancelConfirmationOpened, setCancelConfirmationOpened] = useState(false)
  const sessionRef = useRef(session)
  sessionRef.current = session
  const actionsRef = useRef<AuthoringFormActionHandlers>({})
  const intentionalNavigationRef = useRef(false)
  const pendingStepIdRef = useRef<string | undefined>(undefined)
  const requestedStepIdRef = useRef(requestedStepId)
  const authoredSession = session.authoredSession
  const shellReturnHref = useShellReturnHref()
  const cancelHref =
    shellReturnHref ??
    (session.authoringKind === 'character-builder'
      ? '/characters'
      : authoredSession?.actionFactory.listPath)
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const hasUnsavedAuthoredChanges = session.authoringKind === 'authored-form' && session.hasChanges
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
  const recordValidationIssues = useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiError) || error.validationIssues.length === 0) return

      const current = sessionRef.current
      const target = error.validationIssues
        .map((issue) => findAuthoringValidationTarget(issue.path, current.navigationTargets ?? []))
        .find((candidate) => candidate !== undefined)
      const fallbackStepId =
        current.activeStepId || current.navigationTargets?.find((entry) => entry.stepId)?.stepId

      setSession((latest) => ({
        ...latest,
        ...(target
          ? {
              activeNavigationTargetId: target.id,
              activeStepId: target.stepId ?? target.canvasStepId ?? fallbackStepId,
              activeStepLabel: target.canvasLabel ?? target.label,
              fieldPathPrefix: target.fieldPathPrefix,
              visitedStepIds: addVisitedStep(latest.visitedStepIds, target.id)
            }
          : {}),
        validationIssues: error.validationIssues
      }))
      if (target) navigateToAuthoringStep(target.id)
    },
    [navigateToAuthoringStep]
  )
  const resolvedModel = session.resolvedModel
  const modelVisibleSteps = useMemo(() => getVisibleAuthoringSteps(resolvedModel), [resolvedModel])
  const visibleSteps = session.visibleSteps ?? modelVisibleSteps
  const navigationTargets = session.navigationTargets ?? []
  const activeNavigationTarget =
    navigationTargets.find((target) => target.id === session.activeNavigationTargetId) ??
    navigationTargets[0]
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
  const activateMutation = useMutation({
    mutationFn: (payload: object) => operations.activate(payload),
    onError: recordValidationIssues,
    onSuccess: async (response: ActivatedAuthoringResponse) => {
      setSession((current) => ({ ...current, validationIssues: [] }))
      await operations.onActivateSuccess?.(queryClient, response)
    }
  })
  const saveDraftMutation = useMutation({
    mutationFn: (payload: object) => operations.saveDraft(payload),
    onError: recordValidationIssues,
    onSuccess: async (draft: DraftAuthoringResponse) => {
      setSession((current) => ({ ...current, validationIssues: [] }))
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
  const activateAction = useMemo(() => {
    if (!authoredSession) return undefined

    return createActivateAction({
      activateMutation,
      buildRouteParams: authoredSession.actionFactory.buildRouteParams,
      detailPath: authoredSession.actionFactory.activatePath,
      messages: authoredSession.actionFactory.messages,
      navigate: navigateWithoutBlock,
      notifier: notifications,
      readOnly: authoredSession.readOnly,
      router,
      subjectId: authoredSession.subjectId
    })
  }, [activateMutation, authoredSession, navigateWithoutBlock, router])
  const cancelAction = useMemo(
    () =>
      cancelHref
        ? createCancelAction({ listPath: cancelHref, navigate: navigateWithoutBlock })
        : undefined,
    [cancelHref, navigateWithoutBlock]
  )
  const copyAction = useMemo(() => {
    if (!authoredSession?.subjectId) return undefined

    return createCopyAction({
      buildRouteParams: authoredSession.actionFactory.buildRouteParams,
      duplicateMutation,
      editPath: authoredSession.actionFactory.editPath,
      messages: authoredSession.actionFactory.messages,
      navigate: navigateWithoutBlock,
      notifier: notifications,
      subjectId: authoredSession.subjectId
    })
  }, [authoredSession, duplicateMutation, navigateWithoutBlock])
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
  const discardDraftAction = useMemo(() => {
    if (!authoredSession) return undefined

    return createDiscardDraftAction({
      activeRecord: authoredSession.activeRecord,
      discardDraftMutation,
      listPath: authoredSession.actionFactory.listPath,
      messages: authoredSession.actionFactory.messages,
      navigate: navigateWithoutBlock,
      notifier: notifications,
      router
    })
  }, [authoredSession, discardDraftMutation, navigateWithoutBlock, router])
  const saveDraftAction = useMemo(() => {
    if (!authoredSession) return undefined

    if (authoredSession.mode === 'create') {
      return createCreateDraftAction({
        buildRouteParams: authoredSession.actionFactory.buildRouteParams,
        draftMutation: saveDraftMutation,
        editPath: authoredSession.actionFactory.editPath,
        messages: authoredSession.actionFactory.messages,
        navigate: navigateWithoutBlock,
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
  }, [authoredSession, navigateWithoutBlock, router, saveDraftMutation])
  const registerDomain = useCallback(
    (registration: AuthoredFormDomain | AuthoringDomainRegistration) => {
      setSession((current) => {
        const registered =
          typeof registration === 'string'
            ? applyDomainRegistration(current, { domain: registration })
            : applyDomainRegistration(current, registration)
        const next = resolveRequestedNavigation(registered, requestedStepIdRef.current)

        return isSameSession(current, next) ? current : next
      })
    },
    []
  )
  useEffect(() => {
    if (kind === 'character-builder') {
      const nextMode: AuthoringFormStatePatch['mode'] = mode === 'edit' ? 'edit' : 'create'
      const nextCharacterSession = createCharacterBuilderAuthoringSession({
        data,
        mode: nextMode
      })

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
        applyDomainRegistration(current, {
          data,
          domain,
          mode
        }),
        requestedStepIdRef.current
      )

      return isSameSession(current, next) ? current : next
    })
  }, [data, domain, kind, mode])

  useEffect(() => {
    if (!session.domain) return

    setSession((current) => {
      if (!current.domain) return current

      const next = resolveRequestedNavigation(
        applyDomainRegistration(current, {
          data: current.domainData,
          domain: current.domain,
          mode: current.mode
        }),
        requestedStepIdRef.current
      )

      return isSameSession(current, next) ? current : next
    })
  }, [session.domain, session.domainData, session.mode])

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
  const performCancel = useCallback(async () => {
    setCancelConfirmationOpened(false)
    intentionalNavigationRef.current = true
    try {
      await (cancelAction ?? actionsRef.current.onCancel)?.()
    } finally {
      intentionalNavigationRef.current = false
    }
  }, [cancelAction])
  const cancel = useCallback(() => {
    const current = sessionRef.current
    if (current.stagedEditorOpen) return
    if (current.hasChanges) {
      setCancelConfirmationOpened(true)
      return
    }

    void performCancel()
  }, [performCancel])
  const clearRegisteredPaths = useCallback((paths: readonly NodeRuntimePathDto[]) => {
    actionsRef.current.onClearPaths?.(paths)
  }, [])
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
          activeStepId: target.stepId,
          activeStepLabel: target.canvasLabel ?? target.label,
          fieldPathPrefix: target.fieldPathPrefix,
          visitedStepIds: addVisitedStep(current.visitedStepIds, target.id)
        }

        return isSameSession(current, next) ? current : next
      })

      return true
    },
    [navigationTargets]
  )
  const goToNextStep = useCallback(() => {
    if (session.authoringKind === 'character-builder') {
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
        return
      }
    }

    void actionsRef.current.onNextStep?.()
  }, [
    activeNavigationTargetIndex,
    activeStepIndex,
    navigationTargets,
    navigateToAuthoringStep,
    setActiveNavigationTarget,
    setActiveProviderStep,
    session.authoringKind,
    activeStep?.id,
    visibleSteps
  ])
  const goToPreviousStep = useCallback(() => {
    if (session.authoringKind === 'character-builder') {
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
        return
      }
    }

    void actionsRef.current.onPreviousStep?.()
  }, [
    activeNavigationTargetIndex,
    activeStepIndex,
    navigationTargets,
    navigateToAuthoringStep,
    setActiveNavigationTarget,
    setActiveProviderStep,
    session.authoringKind,
    activeStep?.id,
    visibleSteps
  ])
  const resetStep = useCallback(() => {
    void actionsRef.current.onResetStep?.()
  }, [])
  const resetForm = useCallback(() => {
    void actionsRef.current.onResetForm?.()
  }, [])
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
      actionsRef.current.onStepChange?.(targetId)
    },
    [navigateToAuthoringStep, setActiveNavigationTarget]
  )
  const goToStep = useCallback(
    (stepId: string) => {
      if (session.authoringKind === 'character-builder') {
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
      if (setActiveProviderStep(stepId)) {
        navigateToAuthoringStep(stepId)
        return
      }

      navigateToAuthoringStep(stepId)
      actionsRef.current.onStepChange?.(stepId)
    },
    [
      navigateToAuthoringStep,
      navigationTargets,
      session.authoringKind,
      setActiveNavigationTarget,
      setActiveProviderStep,
      visibleSteps
    ]
  )
  const commitRequestedNavigation = useCallback(
    (stepId: string | undefined) => {
      requestedStepIdRef.current = stepId

      if (session.authoringKind === 'character-builder') {
        const fallbackStepId =
          session.characterSession?.initialAuthoringState?.activeStepId ?? session.activeStepId
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
      navigationTargets,
      session.authoringKind,
      session.characterSession,
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
      const targetIsPublished =
        session.authoringKind === 'character-builder'
          ? visibleSteps.some((step) => areAuthoringStepIdsEqual(step.id, pendingStepId))
          : navigationTargets.some((target) => areAuthoringStepIdsEqual(target.id, pendingStepId))
      if (!targetIsPublished) return
      pendingStepIdRef.current = undefined
      return
    }
    commitRequestedNavigation(requestedStepId)
  }, [commitRequestedNavigation, requestedStepId])

  useEffect(() => {
    if (!requestedStepId) return
    if (areAuthoringStepIdsEqual(pendingStepIdRef.current, requestedStepId)) return

    const isValid =
      session.authoringKind === 'character-builder'
        ? visibleSteps.some((step) => areAuthoringStepIdsEqual(step.id, requestedStepId))
        : navigationTargets.length === 0 ||
          navigationTargets.some((target) => areAuthoringStepIdsEqual(target.id, requestedStepId))
    if (isValid) return

    const fallbackStepId =
      session.authoringKind === 'character-builder' ? activeStep?.id : activeNavigationTarget?.id
    if (fallbackStepId) navigateToAuthoringStep(fallbackStepId, true)
  }, [
    activeNavigationTarget?.id,
    activeStep?.id,
    navigateToAuthoringStep,
    navigationTargets,
    requestedStepId,
    session.authoringKind,
    visibleSteps
  ])
  const saveDraft = useCallback(() => {
    void actionsRef.current.onSaveDraft?.()
  }, [])
  const contextSession = useMemo<AuthoringFormSessionState>(
    () => ({
      ...session,
      ...(activeNavigationTarget
        ? {
            activeNavigationTargetId: activeNavigationTarget.id,
            activeStepId: activeNavigationTarget.stepId ?? activeNavigationTarget.canvasStepId,
            activeStepLabel: activeNavigationTarget.canvasLabel ?? activeNavigationTarget.label,
            fieldPathPrefix: activeNavigationTarget.fieldPathPrefix,
            isFirstStep: activeNavigationTargetIndex <= 0,
            isLastStep: activeNavigationTargetIndex === Math.max(navigationTargets.length - 1, 0)
          }
        : activeStep
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
      activeNavigationTarget,
      activeNavigationTargetIndex,
      activeStep,
      activeStepIndex,
      discardDraftMutation.isPending,
      isDeleting,
      saveDraftMutation.isPending,
      session,
      navigationTargets.length,
      visibleSteps.length
    ]
  )

  const value = useMemo<AuthoringFormContextValue>(
    () => ({
      ...contextSession,
      activate,
      activateValues,
      activeNavigationTarget,
      activeStep,
      cancel,
      cancelHref,
      clearValidationIssues,
      clearPaths: clearRegisteredPaths,
      copy,
      deleteRecord,
      discardDraft,
      goToNavigationTarget,
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
      activeNavigationTarget,
      activeStep,
      cancel,
      cancelHref,
      clearValidationIssues,
      clearRegisteredPaths,
      copy,
      contextSession,
      deleteRecord,
      discardDraft,
      discardDraftMutation.isPending,
      goToNavigationTarget,
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
      <Modal
        centered
        closeOnClickOutside={false}
        onClose={() => {
          setCancelConfirmationOpened(false)
          if (navigationBlocker.status === 'blocked') navigationBlocker.reset()
        }}
        opened={cancelConfirmationOpened || navigationBlocker.status === 'blocked'}
        title='Leave without saving?'
      >
        <Stack gap='md'>
          <Text size='sm'>
            Your unsaved changes will be discarded if you leave this authoring workspace.
          </Text>
          <Group justify='flex-end'>
            <Button
              type='button'
              variant='default'
              onClick={() => {
                setCancelConfirmationOpened(false)
                if (navigationBlocker.status === 'blocked') navigationBlocker.reset()
              }}
            >
              Stay
            </Button>
            <Button
              color='red'
              type='button'
              onClick={() => {
                if (cancelConfirmationOpened) {
                  void performCancel()
                  return
                }
                if (navigationBlocker.status === 'blocked') navigationBlocker.proceed()
              }}
            >
              Leave without saving
            </Button>
          </Group>
        </Stack>
      </Modal>
    </AuthoringFormContext>
  )
}

function isSameSession(left: AuthoringFormSessionState, right: AuthoringFormSessionState) {
  return (
    left.activeNavigationTargetId === right.activeNavigationTargetId &&
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
    left.navigationTargets === right.navigationTargets &&
    left.navigationTree === right.navigationTree &&
    left.providedModel === right.providedModel &&
    left.readOnly === right.readOnly &&
    left.resolveModel === right.resolveModel &&
    left.resolvedModel === right.resolvedModel &&
    left.resetFormLabel === right.resetFormLabel &&
    left.resetStepLabel === right.resetStepLabel &&
    left.saveDraftLabel === right.saveDraftLabel &&
    left.stagedEditorOpen === right.stagedEditorOpen &&
    isSameRecord(left.stepDirty, right.stepDirty) &&
    isSameRecord(left.stepStatuses, right.stepStatuses) &&
    isSameRecord(left.stepWarnings, right.stepWarnings) &&
    isSameProgressSummary(left.progressSummary, right.progressSummary) &&
    left.subjectKindLabel === right.subjectKindLabel &&
    left.subjectLabel === right.subjectLabel &&
    left.systemId === right.systemId &&
    left.validationIssues === right.validationIssues &&
    left.visibleSteps === right.visibleSteps &&
    isSameSet(left.visitedStepIds, right.visitedStepIds)
  )
}

function getDomainRegistration(
  domain: AuthoredFormDomain,
  mode: AuthoringFormSessionState['mode'],
  data: unknown
): AuthoringFormStatePatch {
  const factory = authoredFormFactories[domain]
  const authoredSession = data === undefined ? undefined : factory.createSession?.({ data, mode })

  return {
    activeSectionId: undefined,
    activeNavigationTargetId: undefined,
    activeStepId: undefined,
    activeStepLabel: undefined,
    authoredSession,
    authoringKind: 'authored-form',
    characterData: undefined,
    characterSession: undefined,
    domain,
    fallbackLabel: factory.fallbackLabel,
    mapId: factory.mapId,
    navigationTargets: undefined,
    navigationTree: undefined,
    providedModel: undefined,
    resolvedModel: undefined,
    subjectKindLabel: factory.subjectKindLabel,
    validationIssues: [],
    ...(authoredSession
      ? {
          canCopy: authoredSession.canCopy,
          canDelete: authoredSession.canDelete,
          canSaveDraft: authoredSession.canSaveDraft,
          fallbackLabel: authoredSession.fallbackLabel,
          hasActiveDraft: authoredSession.hasActiveDraft,
          isDraft: authoredSession.isDraft,
          mapId: authoredSession.mapId,
          mode: authoredSession.mode,
          readOnly: authoredSession.readOnly,
          resolveModel:
            !authoredSession.systemRequired &&
            !authoredSession.notFound &&
            !authoredSession.invalidDraftOnly,
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
  const domainRegistration = getDomainRegistration(registration.domain, nextMode, registration.data)
  const subjectChanged =
    current.authoredSession?.key !== domainRegistration.authoredSession?.key ||
    current.domain !== registration.domain
  const authoredSession = subjectChanged
    ? domainRegistration.authoredSession
    : (current.authoredSession ?? domainRegistration.authoredSession)

  return {
    ...current,
    domain: registration.domain,
    domainData: registration.data,
    mode: nextMode,
    ...domainRegistration,
    authoredSession,
    visitedStepIds: subjectChanged ? new Set() : current.visitedStepIds
  }
}

function getCharacterBuilderRegistration(
  mode: CharacterBuilderRouteMode,
  data: unknown,
  characterSession?: CharacterBuilderAuthoringSession
): AuthoringFormStatePatch {
  const nextCharacterSession =
    characterSession ??
    (data === undefined
      ? undefined
      : createCharacterBuilderAuthoringSession({
          data,
          mode
        }))
  const initialAuthoringState = nextCharacterSession?.initialAuthoringState
  const initialStepId = initialAuthoringState?.activeStepId

  return {
    activeSectionId: undefined,
    activeNavigationTargetId: undefined,
    activeStepId: initialAuthoringState?.activeStepId,
    activeStepLabel: initialAuthoringState?.activeStepLabel,
    activateLabel: 'Finalize Character',
    authoredSession: undefined,
    authoringKind: 'character-builder',
    canCopy: false,
    canDelete: false,
    canFinalize: false,
    canResetForm: false,
    canResetStep: false,
    canSaveDraft: Boolean(
      nextCharacterSession && !nextCharacterSession.systemRequired && !nextCharacterSession.notFound
    ),
    canSubmit: false,
    characterData: data,
    characterSession: nextCharacterSession,
    domain: undefined,
    domainData: undefined,
    fallbackLabel: 'Untitled Character',
    fieldPathPrefix: undefined,
    firstBlockingStatus: initialAuthoringState?.firstBlockingStatus,
    firstBlockingStepId: initialAuthoringState?.firstBlockingStepId,
    hasChanges: false,
    hasActiveDraft: nextCharacterSession?.hasActiveDraft ?? false,
    hasStepChanges: false,
    isDraft: nextCharacterSession?.isDraft ?? false,
    isFirstStep: initialAuthoringState?.isFirstStep ?? true,
    isLastStep: initialAuthoringState?.isLastStep ?? true,
    mapId: undefined,
    mode,
    navigationTargets: undefined,
    navigationTree: undefined,
    progressSummary: initialAuthoringState?.progressSummary,
    providedModel: undefined,
    readOnly: nextCharacterSession?.readOnly ?? false,
    resolveModel: false,
    resolvedModel: undefined,
    saveDraftLabel: 'Save Draft',
    stepDirty: EMPTY_STEP_DIRTY,
    stepStatuses: initialAuthoringState?.stepStatuses ?? EMPTY_STEP_STATUSES,
    stepWarnings: EMPTY_STEP_WARNINGS,
    subjectKindLabel: 'Character',
    subjectLabel: nextCharacterSession?.subjectLabel,
    systemId: nextCharacterSession?.systemId,
    validationIssues: [],
    visibleSteps: initialAuthoringState?.visibleSteps,
    visitedStepIds: initialStepId ? new Set([initialStepId]) : new Set()
  }
}

function applyCharacterBuilderRegistration(
  current: AuthoringFormSessionState,
  registration: {
    data?: unknown
    mode: CharacterBuilderRouteMode
    characterSession?: CharacterBuilderAuthoringSession
  }
): AuthoringFormSessionState {
  return {
    ...current,
    ...getCharacterBuilderRegistration(
      registration.mode,
      registration.data,
      registration.characterSession
    )
  }
}

function getCharacterBuilderSessionSignature(session?: CharacterBuilderAuthoringSession): string {
  if (!session) return ''

  return [
    session.mode,
    session.characterId ?? '',
    session.payload?.character.id ?? '',
    session.payload?.character.label ?? '',
    session.systemId ?? '',
    session.formKey ?? '',
    session.baseActiveUpdatedAt ?? '',
    String(session.hasActiveDraft),
    String(session.hasInvalidDraft),
    String(session.isDraft),
    String(session.systemRequired),
    String(session.notFound),
    String(session.invalidDraftOnly),
    String(session.readOnly)
  ].join('|')
}

function createInitialSession(registration: {
  data?: unknown
  domain?: AuthoredFormDomain
  kind?: 'authored-form' | 'character-builder'
  mode?: AuthoringFormSessionState['mode']
  requestedStepId?: string
}): AuthoringFormSessionState {
  const session = createDefaultSession()
  if (registration.kind === 'character-builder') {
    return resolveRequestedNavigation(
      applyCharacterBuilderRegistration(session, {
        data: registration.data,
        mode: registration.mode === 'edit' ? 'edit' : 'create'
      }),
      registration.requestedStepId
    )
  }
  if (!registration.domain) return session

  return resolveRequestedNavigation(
    applyDomainRegistration(session, {
      data: registration.data,
      domain: registration.domain,
      mode: registration.mode
    }),
    registration.requestedStepId
  )
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
    stagedEditorOpen: false,
    mode: 'create',
    readOnly: false,
    resolveModel: true,
    resetFormLabel: 'Reset Form',
    resetStepLabel: 'Reset Step',
    saveDraftLabel: 'Save Draft',
    stepDirty: EMPTY_STEP_DIRTY,
    stepStatuses: EMPTY_STEP_STATUSES,
    stepWarnings: EMPTY_STEP_WARNINGS,
    subjectKindLabel: 'Item',
    validationIssues: [],
    visitedStepIds: new Set()
  }
}

function resolveRequestedNavigation(
  session: AuthoringFormSessionState,
  requestedStepId: string | undefined
): AuthoringFormSessionState {
  if (session.authoringKind === 'character-builder') {
    const fallbackStepId =
      session.activeStepId ?? session.characterSession?.initialAuthoringState?.activeStepId
    const activeStep =
      session.visibleSteps?.find((step) => areAuthoringStepIdsEqual(step.id, requestedStepId)) ??
      session.visibleSteps?.find((step) => step.id === fallbackStepId) ??
      session.visibleSteps?.[0]
    if (!activeStep) return session

    return {
      ...session,
      activeStepId: activeStep.id,
      activeStepLabel: activeStep.label,
      visitedStepIds: addVisitedStep(session.visitedStepIds, activeStep.id)
    }
  }

  const targets = session.navigationTargets ?? []
  if (targets.length === 0) {
    return requestedStepId ? { ...session, activeNavigationTargetId: requestedStepId } : session
  }

  const target =
    targets.find((entry) => areAuthoringStepIdsEqual(entry.id, requestedStepId)) ?? targets[0]
  if (!target) return session

  return {
    ...session,
    activeNavigationTargetId: target.id,
    activeStepId: target.stepId ?? target.canvasStepId,
    activeStepLabel: target.canvasLabel ?? target.label,
    fieldPathPrefix: target.fieldPathPrefix,
    visitedStepIds: addVisitedStep(session.visitedStepIds, target.id)
  }
}

function addVisitedStep(current: ReadonlySet<string>, stepId: string): ReadonlySet<string> {
  if (current.has(stepId)) return current
  const next = new Set(current)
  next.add(stepId)
  return next
}

function isSameSet(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  if (left === right) return true
  return left.size === right.size && [...left].every((value) => right.has(value))
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
