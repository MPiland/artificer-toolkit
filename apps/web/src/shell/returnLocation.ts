import { createContext, useContext } from 'react'

export const ShellReturnHrefContext = createContext<string | undefined>(undefined)

export function useShellReturnHref() {
  return useContext(ShellReturnHrefContext)
}
