import { createContext, useContext } from 'react'
import type { Context, Dispatch, ReactNode, SetStateAction } from 'react'

export type AuthoringPreviewContent = ReactNode | undefined

/** The workspace's structure, preview and reset-confirmation panels, synced to the viewport. */
export type AuthoringPanelsContextValue = {
  isWideDesktop: boolean
  stepsNavigationOpen: boolean
  toggleStepsNavigation: () => void
  previewOpen: boolean
  togglePreview: () => void
  resetFormConfirmOpen: boolean
  toggleResetFormConfirm: () => void
}

/** The live preview the editor publishes for the preview rail. */
export type AuthoringPreviewContextValue = {
  previewContent: AuthoringPreviewContent
  setPreviewContent: Dispatch<SetStateAction<AuthoringPreviewContent>>
}

export const AuthoringPanelsContext = createContext<AuthoringPanelsContextValue | null>(null)
export const AuthoringPreviewContext = createContext<AuthoringPreviewContextValue | null>(null)

function useProvidedContext<TValue>(context: Context<TValue | null>, hookName: string) {
  const value = useContext(context)
  if (!value) throw new Error(`${hookName} must be used inside AuthoringLayoutContent.`)
  return value
}

export function useAuthoringPanels() {
  return useProvidedContext(AuthoringPanelsContext, 'useAuthoringPanels')
}

export function useAuthoringPreview() {
  return useProvidedContext(AuthoringPreviewContext, 'useAuthoringPreview')
}
