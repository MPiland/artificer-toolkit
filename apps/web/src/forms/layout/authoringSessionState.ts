import { authoredFormFactories } from '../factories/authoredFormFactories'
import type { ConvexReactClient } from 'convex/react'
import type { AuthoredFormDomain } from '../factories/authoredFormFactories.types'
import type {
  AuthoringDomainRegistration,
  AuthoringFormSessionState,
  AuthoringFormStatePatch
} from './AuthoringFormContext'

const EMPTY_STEP_WARNINGS = {}

export function isSameSession(left: AuthoringFormSessionState, right: AuthoringFormSessionState) {
  return (
    left.activeNavigationTargetId === right.activeNavigationTargetId &&
    left.activeSectionId === right.activeSectionId &&
    left.activeStepId === right.activeStepId &&
    left.activeStepLabel === right.activeStepLabel &&
    left.authoredSession === right.authoredSession &&
    left.activateLabel === right.activateLabel &&
    left.canCopy === right.canCopy &&
    left.canDelete === right.canDelete &&
    left.canSaveDraft === right.canSaveDraft &&
    left.copyLabel === right.copyLabel &&
    left.cancelLabel === right.cancelLabel &&
    left.deleteLabel === right.deleteLabel &&
    left.draftSaveStatus === right.draftSaveStatus &&
    left.domain === right.domain &&
    left.domainData === right.domainData &&
    left.fallbackLabel === right.fallbackLabel &&
    left.fieldPathPrefix === right.fieldPathPrefix &&
    left.hasActiveDraft === right.hasActiveDraft &&
    left.isDraft === right.isDraft &&
    left.isDeleting === right.isDeleting &&
    left.mapId === right.mapId &&
    left.mode === right.mode &&
    left.readOnly === right.readOnly &&
    left.resolveModel === right.resolveModel &&
    left.resetFormLabel === right.resetFormLabel &&
    left.resetStepLabel === right.resetStepLabel &&
    left.saveDraftLabel === right.saveDraftLabel &&
    isSameRecord(left.stepWarnings, right.stepWarnings) &&
    left.subjectKindLabel === right.subjectKindLabel &&
    left.subjectLabel === right.subjectLabel &&
    left.systemId === right.systemId &&
    left.validationIssues === right.validationIssues &&
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

export function createInitialSession(
  registration: {
    data?: unknown
    domain?: AuthoredFormDomain
    mode?: AuthoringFormSessionState['mode']
    requestedStepId?: string
  },
  convexClient?: ConvexReactClient
): AuthoringFormSessionState {
  const session = createDefaultSession()
  // A hosted form's steps arrive as props; the requested step is its first active step.
  if (!registration.domain) return { ...session, activeStepId: registration.requestedStepId }

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
    canSaveDraft: false,
    copyLabel: 'Duplicate to edit',
    cancelLabel: 'Cancel',
    deleteLabel: 'Delete',
    fallbackLabel: 'Untitled Item',
    hasActiveDraft: false,
    isDraft: false,
    isDeleting: false,
    mode: 'create',
    readOnly: false,
    resolveModel: true,
    resetFormLabel: 'Reset Form',
    resetStepLabel: 'Reset Step',
    saveDraftLabel: 'Save Draft',
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
