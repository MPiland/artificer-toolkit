import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { useAuthoringNavigation, useAuthoringSession } from './AuthoringFormContext'
import {
  AuthoringLayoutContext,
  type AuthoringLayoutContextValue,
  type AuthoringPreviewContent
} from './AuthoringLayoutContext'
import { getAuthoringStatus, readReactNodeText } from './AuthoringLayout.utils'
import {
  CHARACTER_BUILDER_TIMING_MARK,
  markCharacterBuilderTiming
} from '#domains/characters/builder/core/characterBuilder.performance'
import { AUTHORING_COMPACT_WORKSPACE_QUERY } from './authoringWorkspace.constants'

export function AuthoringLayoutProvider({ children }: { children: ReactNode }) {
  const { characterSession, hasActiveDraft, isDraft, mode, subjectKindLabel, subjectLabel } =
    useAuthoringSession()
  const { activeNavigationTarget, activeStep, activeStepId, activeStepLabel, visibleSteps } =
    useAuthoringNavigation()
  const isWideDesktop = !useMediaQuery(AUTHORING_COMPACT_WORKSPACE_QUERY, false)
  const [
    stepsNavigationOpen,
    { close: closeStepsNavigation, open: openStepsNavigation, toggle: toggleStepsNavigation }
  ] = useDisclosure(true)
  const [previewOpen, { close: closePreview, open: openPreview, toggle: togglePreview }] =
    useDisclosure(false)
  const [resetFormConfirmOpen, { toggle: toggleResetFormConfirm }] = useDisclosure(false)
  const title = activeStepLabel ?? subjectKindLabel
  const label = readReactNodeText(subjectLabel) ?? subjectKindLabel
  const status = getAuthoringStatus(mode, isDraft || hasActiveDraft)
  const stepId = activeNavigationTarget?.id ?? activeStepId
  const [previewContent, setPreviewContent] = useState<AuthoringPreviewContent>()
  const markedCharacterRailSubjectRef = useRef<string | undefined>(undefined)
  const activeSections = useMemo(
    () =>
      activeStep?.sections.filter((section) => section.nodes.some((node) => node.visible)) ?? [],
    [activeStep]
  )

  const [syncedWideDesktop, setSyncedWideDesktop] = useState<boolean>()
  if (syncedWideDesktop !== isWideDesktop) {
    setSyncedWideDesktop(isWideDesktop)
    if (isWideDesktop) {
      openStepsNavigation()
      openPreview()
    } else {
      closeStepsNavigation()
      closePreview()
    }
  }

  useEffect(() => {
    if (!characterSession || visibleSteps.length === 0) return
    if (markedCharacterRailSubjectRef.current === characterSession.formKey) return

    markCharacterBuilderTiming(CHARACTER_BUILDER_TIMING_MARK.HYDRATION_COMPLETED)
    markCharacterBuilderTiming(CHARACTER_BUILDER_TIMING_MARK.BUILDER_RAIL_COMMITTED)
    markedCharacterRailSubjectRef.current = characterSession.formKey
  }, [characterSession, visibleSteps.length])

  const value = useMemo<AuthoringLayoutContextValue>(
    () => ({
      isWideDesktop,
      stepsNavigationOpen,
      toggleStepsNavigation,
      previewOpen,
      togglePreview,
      previewContent,
      setPreviewContent,
      resetFormConfirmOpen,
      toggleResetFormConfirm,
      title,
      label,
      status,
      activeSections,
      visibleSteps,
      activeStep,
      activeTarget: activeNavigationTarget,
      stepId
    }),
    [
      stepsNavigationOpen,
      isWideDesktop,
      toggleStepsNavigation,
      previewOpen,
      togglePreview,
      previewContent,
      setPreviewContent,
      resetFormConfirmOpen,
      toggleResetFormConfirm,
      title,
      label,
      status,
      activeSections,
      activeStep,
      activeNavigationTarget,
      stepId,
      visibleSteps
    ]
  )

  return <AuthoringLayoutContext value={value}>{children}</AuthoringLayoutContext>
}
