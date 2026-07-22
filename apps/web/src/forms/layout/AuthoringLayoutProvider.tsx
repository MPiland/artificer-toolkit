import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { useAuthoringForm } from './AuthoringFormContext'
import { useBreakpoints } from '#ui'
import {
  AuthoringLayoutContext,
  type AuthoringLayoutContextValue,
  type AuthoringPreviewContent
} from './AuthoringLayoutContext'
import { getAuthoringStatus, readReactNodeText } from './AuthoringLayout.utils'
import {
  CHARACTER_BUILDER_TIMING_MARK,
  markCharacterBuilderTiming
} from '#domains/characters/characterBuilder.performance'

export function AuthoringLayoutProvider({ children }: { children: ReactNode }) {
  const {
    subjectKindLabel,
    subjectLabel,
    hasActiveDraft,
    activeNavigationTarget,
    activeStep,
    activeStepId,
    activeStepLabel,
    characterSession,
    visibleSteps,
    mode,
    isDraft
  } = useAuthoringForm()
  const { isMobile, isTablet, isTabletPortrait } = useBreakpoints()
  const usesOverlayNavigation = isMobile || isTabletPortrait
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

  useEffect(() => {
    if (usesOverlayNavigation) {
      closeStepsNavigation()
      return
    }

    openStepsNavigation()
  }, [closeStepsNavigation, openStepsNavigation, usesOverlayNavigation])

  useEffect(() => {
    if (isMobile || isTablet) {
      closePreview()
      return
    }

    openPreview()
  }, [closePreview, isMobile, isTablet, openPreview])

  useEffect(() => {
    if (!characterSession || visibleSteps.length === 0) return
    if (markedCharacterRailSubjectRef.current === characterSession.formKey) return

    markCharacterBuilderTiming(CHARACTER_BUILDER_TIMING_MARK.HYDRATION_COMPLETED)
    markCharacterBuilderTiming(CHARACTER_BUILDER_TIMING_MARK.BUILDER_RAIL_COMMITTED)
    markedCharacterRailSubjectRef.current = characterSession.formKey
  }, [characterSession, visibleSteps.length])

  const value = useMemo<AuthoringLayoutContextValue>(
    () => ({
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
