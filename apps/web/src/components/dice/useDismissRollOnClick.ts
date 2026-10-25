import { useEffect } from 'react'

/** While a roll is presented, the next click anywhere (captured before its target) dismisses it. */
export function useDismissRollOnClick(presenting: boolean, dismiss: () => void) {
  useEffect(() => {
    if (!presenting) return

    document.addEventListener('click', dismiss, { capture: true })
    return () => document.removeEventListener('click', dismiss, { capture: true })
  }, [presenting, dismiss])
}
