import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'

type AuthoringEditorHeaderContextValue = {
  setFooterState: (state: AuthoringEditorFooterState | null) => void
  setStepNav: (content: ReactNode | null) => void
}

export type AuthoringEditorFooterState = {
  canGoBack: boolean
  canGoNext: boolean
  onNext: () => void
  onPrevious: () => void
  onResetStep: () => void
  readOnly?: boolean
}

const AuthoringEditorHeaderContext = createContext<AuthoringEditorHeaderContextValue | null>(null)

export function AuthoringEditorHeaderProvider({
  children,
  setFooterState,
  setStepNav
}: {
  children: ReactNode
  setFooterState: (state: AuthoringEditorFooterState | null) => void
  setStepNav: (content: ReactNode | null) => void
}) {
  const value = useMemo(() => ({ setFooterState, setStepNav }), [setFooterState, setStepNav])

  return (
    <AuthoringEditorHeaderContext value={value}>
      {children}
    </AuthoringEditorHeaderContext>
  )
}

export function useAuthoringEditorStepNav(content: ReactNode | null) {
  const context = useContext(AuthoringEditorHeaderContext)

  useEffect(() => {
    if (!context) return

    context.setStepNav(content)

    return () => context.setStepNav(null)
  }, [content, context])
}

export function useAuthoringEditorFooterState(state: AuthoringEditorFooterState | null) {
  const context = useContext(AuthoringEditorHeaderContext)

  useEffect(() => {
    if (!context) return

    context.setFooterState(state)

    return () => context.setFooterState(null)
  }, [context, state])
}
