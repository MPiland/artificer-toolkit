import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { NodeRuntimeNodeDto, NodeRuntimePathDto, NodeRuntimeSectionDto, NodeRuntimeStepDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  AuthoringFormContext,
  type AuthoringFormActionHandlers,
  type AuthoringFormContextValue,
  type AuthoringFormRegistration,
  type AuthoringFormSessionState
} from './AuthoringFormContext'

const EMPTY_CLEAR_PATHS: readonly NodeRuntimePathDto[] = []

const DEFAULT_SESSION: AuthoringFormSessionState = {
  activateLabel: 'Activate',
  canCopy: false,
  canGoBack: false,
  canGoNext: false,
  canSaveDraft: false,
  canSubmit: false,
  copyLabel: 'Duplicate to edit',
  cancelLabel: 'Cancel',
  hasActiveDraft: false,
  isLastStep: true,
  isSubmitting: false,
  mode: 'create',
  readOnly: false,
  resolveModel: true,
  saveDraftLabel: 'Save Draft',
  subjectKindLabel: 'Item'
}

export function AuthoringFormProvider({
  children
}: {
  children: ReactNode
}) {
  const [session, setSession] = useState<AuthoringFormSessionState>(DEFAULT_SESSION)
  const actionsRef = useRef<AuthoringFormActionHandlers>({})
  const resolvedModel = session.resolvedModel
  const fieldById = useMemo(() => {
    const fields = new Map<string, NodeRuntimeNodeDto>()
    for (const step of resolvedModel?.steps ?? []) {
      for (const section of step.sections) {
        for (const field of section.nodes) fields.set(field.id, field)
      }
    }
    return fields
  }, [resolvedModel])
  const sectionById = useMemo(() => {
    const sections = new Map<string, NodeRuntimeSectionDto>()
    for (const step of resolvedModel?.steps ?? []) {
      for (const section of step.sections) sections.set(section.id, section)
    }
    return sections
  }, [resolvedModel])
  const stepById = useMemo(() => {
    const steps = new Map<string, NodeRuntimeStepDto>()
    for (const step of resolvedModel?.steps ?? []) steps.set(step.id, step)
    return steps
  }, [resolvedModel])
  const clearPaths = resolvedModel?.clearPaths ?? EMPTY_CLEAR_PATHS
  const clearPathKey = clearPaths.map((path) => path.join('.')).join('|')

  useEffect(() => {
    if (clearPaths.length === 0) return
    actionsRef.current.onClearPaths?.(clearPaths)
  }, [clearPathKey, clearPaths])

  const registerAuthoringForm = useCallback((
    registration: AuthoringFormRegistration,
    actions?: AuthoringFormActionHandlers
  ) => {
    if (actions) {
      actionsRef.current = {
        ...actionsRef.current,
        ...actions
      }
    }

    setSession((current) => {
      const next = {
        ...current,
        ...registration
      }

      return isSameSession(current, next) ? current : next
    })
  }, [])

  const activate = useCallback(() => {
    void actionsRef.current.onActivate?.()
  }, [])
  const cancel = useCallback(() => {
    void actionsRef.current.onCancel?.()
  }, [])
  const clearRegisteredPaths = useCallback((paths: readonly NodeRuntimePathDto[]) => {
    actionsRef.current.onClearPaths?.(paths)
  }, [])
  const copy = useCallback(() => {
    void actionsRef.current.onCopy?.()
  }, [])
  const goToNextStep = useCallback(() => {
    void actionsRef.current.onNextStep?.()
  }, [])
  const goToPreviousStep = useCallback(() => {
    void actionsRef.current.onPreviousStep?.()
  }, [])
  const saveDraft = useCallback(() => {
    void actionsRef.current.onSaveDraft?.()
  }, [])

  const value = useMemo<AuthoringFormContextValue>(() => ({
    ...session,
    activate,
    cancel,
    clearPaths: clearRegisteredPaths,
    copy,
    getField: (fieldId) => fieldById.get(fieldId),
    getSection: (sectionId) => sectionById.get(sectionId),
    getStep: (stepId) => stepById.get(stepId),
    goToNextStep,
    goToPreviousStep,
    registerAuthoringForm,
    saveDraft
  }), [
    activate,
    cancel,
    clearRegisteredPaths,
    copy,
    fieldById,
    goToNextStep,
    goToPreviousStep,
    registerAuthoringForm,
    saveDraft,
    sectionById,
    session,
    stepById
  ])

  return (
    <AuthoringFormContext value={value}>
      {children}
    </AuthoringFormContext>
  )
}

function isSameSession(left: AuthoringFormSessionState, right: AuthoringFormSessionState) {
  return left.activeSectionId === right.activeSectionId
    && left.activeStepId === right.activeStepId
    && left.activeStepLabel === right.activeStepLabel
    && left.activateLabel === right.activateLabel
    && left.canCopy === right.canCopy
    && left.canGoBack === right.canGoBack
    && left.canGoNext === right.canGoNext
    && left.canSaveDraft === right.canSaveDraft
    && left.canSubmit === right.canSubmit
    && left.copyLabel === right.copyLabel
    && left.cancelLabel === right.cancelLabel
    && left.fieldPathPrefix === right.fieldPathPrefix
    && left.hasActiveDraft === right.hasActiveDraft
    && left.isLastStep === right.isLastStep
    && left.isSubmitting === right.isSubmitting
    && left.mapId === right.mapId
    && left.mode === right.mode
    && left.providedModel === right.providedModel
    && left.readOnly === right.readOnly
    && left.resolveModel === right.resolveModel
    && left.resolvedModel === right.resolvedModel
    && left.saveDraftLabel === right.saveDraftLabel
    && left.subjectKindLabel === right.subjectKindLabel
    && left.subjectLabel === right.subjectLabel
    && left.systemId === right.systemId
}
