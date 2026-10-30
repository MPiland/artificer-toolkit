import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import {
  AuthoringPanelsContext,
  AuthoringPreviewContext,
  type AuthoringPanelsContextValue,
  type AuthoringPreviewContent,
  type AuthoringPreviewContextValue
} from './AuthoringLayoutContext'
import { AUTHORING_COMPACT_WORKSPACE_QUERY } from './authoringWorkspace.constants'

/** Opens the structure and preview panels on a wide desktop and closes them on a compact one. */
export function AuthoringPanelsProvider({ children }: { children: ReactNode }) {
  const isWideDesktop = !useMediaQuery(AUTHORING_COMPACT_WORKSPACE_QUERY, false)
  const [
    stepsNavigationOpen,
    { close: closeStepsNavigation, open: openStepsNavigation, toggle: toggleStepsNavigation }
  ] = useDisclosure(true)
  const [previewOpen, { close: closePreview, open: openPreview, toggle: togglePreview }] =
    useDisclosure(false)
  const [resetFormConfirmOpen, { toggle: toggleResetFormConfirm }] = useDisclosure(false)

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

  const value = useMemo<AuthoringPanelsContextValue>(
    () => ({
      isWideDesktop,
      stepsNavigationOpen,
      toggleStepsNavigation,
      previewOpen,
      togglePreview,
      resetFormConfirmOpen,
      toggleResetFormConfirm
    }),
    [
      isWideDesktop,
      stepsNavigationOpen,
      toggleStepsNavigation,
      previewOpen,
      togglePreview,
      resetFormConfirmOpen,
      toggleResetFormConfirm
    ]
  )

  return <AuthoringPanelsContext value={value}>{children}</AuthoringPanelsContext>
}

/** Holds the live preview the editor publishes for the preview rail. */
export function AuthoringPreviewProvider({ children }: { children: ReactNode }) {
  const [previewContent, setPreviewContent] = useState<AuthoringPreviewContent>()
  const value = useMemo<AuthoringPreviewContextValue>(
    () => ({ previewContent, setPreviewContent }),
    [previewContent]
  )

  return <AuthoringPreviewContext value={value}>{children}</AuthoringPreviewContext>
}
