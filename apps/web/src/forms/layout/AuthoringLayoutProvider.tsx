import { useEffect, useMemo, useState } from 'react'
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

export function AuthoringLayoutProvider({ children }: { children: ReactNode }) {
  const {
    subjectKindLabel,
    subjectLabel,
    hasActiveDraft,
    activeNavigationTarget,
    activeStep,
    activeStepId,
    activeStepLabel,
    visibleSteps,
    mode,
    isDraft
  } = useAuthoringForm()
  const { isMobile, isTablet } = useBreakpoints()
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
  const [visitedStepIds, setVisitedStepIds] = useState<ReadonlySet<string>>(() => new Set())
  const activeSections = useMemo(
    () =>
      activeStep?.sections.filter((section) => section.nodes.some((node) => node.visible)) ?? [],
    [activeStep]
  )

  useEffect(() => {
    if (isMobile) {
      closeStepsNavigation()
      return
    }

    openStepsNavigation()
  }, [closeStepsNavigation, isMobile, openStepsNavigation])

  useEffect(() => {
    if (isMobile || isTablet) {
      closePreview()
      return
    }

    openPreview()
  }, [closePreview, isMobile, isTablet, openPreview])

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
      visitedStepIds,
      setVisitedStepIds,
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
      visitedStepIds,
      setVisitedStepIds,
      activeSections,
      activeStep,
      activeNavigationTarget,
      stepId,
      visibleSteps
    ]
  )

  return <AuthoringLayoutContext value={value}>{children}</AuthoringLayoutContext>
}
