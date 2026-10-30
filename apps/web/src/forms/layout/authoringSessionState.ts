import { authoredFormFactories } from '../factories/authoredFormFactories'
import type { ConvexReactClient } from 'convex/react'
import type { AuthoredFormDomain } from '../factories/authoredFormFactories.types'
import { createCharacterBuilderAuthoringSession } from '#domains/characters/builder/state/characterBuilderAuthoringSession'
import type { CharacterBuilderAuthoringSession } from '#domains/characters/builder/state/characterBuilderAuthoringSession'
import { characterBuilderVisibleSteps } from '#domains/characters/builder/state/characterBuilderAuthoringState'
import type {
  AuthoringDomainRegistration,
  AuthoringFormSessionState,
  AuthoringFormStatePatch
} from './AuthoringFormContext'
import type { CharacterBuilderRouteMode } from './authoredFormRouteContext'
import { areAuthoringStepIdsEqual } from './authoringSearch'

const EMPTY_STEP_STATUSES = {}
const EMPTY_STEP_WARNINGS = {}

export function isSameSession(left: AuthoringFormSessionState, right: AuthoringFormSessionState) {
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
    left.draftSaveStatus === right.draftSaveStatus &&
    left.domain === right.domain &&
    left.domainData === right.domainData &&
    left.fallbackLabel === right.fallbackLabel &&
    left.fieldPathPrefix === right.fieldPathPrefix &&
    left.hasChanges === right.hasChanges &&
    left.hasStepChanges === right.hasStepChanges &&
    left.hasActiveDraft === right.hasActiveDraft &&
    left.isDraft === right.isDraft &&
    left.isDeleting === right.isDeleting &&
    left.isSubmitting === right.isSubmitting &&
    left.mapId === right.mapId &&
    left.mode === right.mode &&
    left.readOnly === right.readOnly &&
    left.resolveModel === right.resolveModel &&
    left.resetFormLabel === right.resetFormLabel &&
    left.resetStepLabel === right.resetStepLabel &&
    left.saveDraftLabel === right.saveDraftLabel &&
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
  data: unknown,
  convexClient?: ConvexReactClient
): AuthoringFormStatePatch {
  const factory = authoredFormFactories[domain]
  const authoredSession =
    data === undefined ? undefined : factory.createSession?.({ data, mode, convexClient })

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
    draftSaveStatus: undefined,
    fallbackLabel: factory.fallbackLabel,
    mapId: factory.mapId,
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

export function applyDomainRegistration(
  current: AuthoringFormSessionState,
  registration: AuthoringDomainRegistration,
  convexClient?: ConvexReactClient
): AuthoringFormSessionState {
  const nextMode = registration.mode ?? current.mode
  const domainRegistration = getDomainRegistration(
    registration.domain,
    nextMode,
    registration.data,
    convexClient
  )
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

export function createCharacterBuilderRegistration(
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

  return {
    activeSectionId: undefined,
    activeNavigationTargetId: undefined,
    activeStepId: undefined,
    activeStepLabel: undefined,
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
    draftSaveStatus: undefined,
    domain: undefined,
    domainData: undefined,
    fallbackLabel: 'Untitled Character',
    fieldPathPrefix: undefined,
    hasChanges: false,
    hasActiveDraft: nextCharacterSession?.hasActiveDraft ?? false,
    hasStepChanges: false,
    isDraft: nextCharacterSession?.isDraft ?? false,
    mapId: undefined,
    mode,
    progressSummary: undefined,
    readOnly: nextCharacterSession?.readOnly ?? false,
    resolveModel: false,
    saveDraftLabel: 'Save Draft',
    stepStatuses: EMPTY_STEP_STATUSES,
    stepWarnings: EMPTY_STEP_WARNINGS,
    subjectKindLabel: 'Character',
    subjectLabel: nextCharacterSession?.subjectLabel,
    systemId: nextCharacterSession?.systemId,
    validationIssues: [],
    // Progress arrives with the first browser evaluation (ADR 0036 S6).
    visibleSteps: nextCharacterSession ? characterBuilderVisibleSteps : undefined,
    visitedStepIds: new Set()
  }
}

export function applyCharacterBuilderRegistration(
  current: AuthoringFormSessionState,
  registration: {
    data?: unknown
    mode: CharacterBuilderRouteMode
    characterSession?: CharacterBuilderAuthoringSession
  }
): AuthoringFormSessionState {
  return {
    ...current,
    ...createCharacterBuilderRegistration(
      registration.mode,
      registration.data,
      registration.characterSession
    )
  }
}

export function getCharacterBuilderSessionSignature(
  session?: CharacterBuilderAuthoringSession
): string {
  if (!session) return ''

  return [
    session.mode,
    session.characterId ?? '',
    session.initialValues?.id ?? '',
    session.subjectLabel,
    session.systemId ?? '',
    session.formKey ?? '',
    String(session.hasActiveDraft),
    String(session.isDraft),
    String(session.systemRequired),
    String(session.notFound),
    String(session.readOnly)
  ].join('|')
}

export function createInitialSession(
  registration: {
    data?: unknown
    domain?: AuthoredFormDomain
    kind?: 'authored-form' | 'character-builder'
    mode?: AuthoringFormSessionState['mode']
    requestedStepId?: string
  },
  convexClient?: ConvexReactClient
): AuthoringFormSessionState {
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
    applyDomainRegistration(
      session,
      {
        data: registration.data,
        domain: registration.domain,
        mode: registration.mode
      },
      convexClient
    ),
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
    isDeleting: false,
    isSubmitting: false,
    mode: 'create',
    readOnly: false,
    resolveModel: true,
    resetFormLabel: 'Reset Form',
    resetStepLabel: 'Reset Step',
    saveDraftLabel: 'Save Draft',
    stepStatuses: EMPTY_STEP_STATUSES,
    stepWarnings: EMPTY_STEP_WARNINGS,
    subjectKindLabel: 'Item',
    validationIssues: [],
    visitedStepIds: new Set()
  }
}

export function resolveRequestedNavigation(
  session: AuthoringFormSessionState,
  requestedStepId: string | undefined
): AuthoringFormSessionState {
  if (session.authoringKind === 'character-builder') {
    const fallbackStepId = session.activeStepId
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

  return requestedStepId ? { ...session, activeNavigationTargetId: requestedStepId } : session
}

export function addVisitedStep(current: ReadonlySet<string>, stepId: string): ReadonlySet<string> {
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
