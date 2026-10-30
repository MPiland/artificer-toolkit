import { useEffect, useState } from 'react'

/** How long authored-form readers wait after the last change before resolving again. */
export const RESOLUTION_DEBOUNCE_MS = 150

type FormStateSource<TState> = {
  state: TState
  store: { subscribe: (listener: () => void) => { unsubscribe: () => void } }
}

/**
 * The form's state, updated once changes pause for `debounceMs`. The store subscription lives
 * outside render, so a keystroke re-renders only its field; readers of this state render once per
 * pause. Disabled readers subscribe to nothing and keep the state they mounted with.
 */
export function useDebouncedFormState<TState>(
  form: FormStateSource<TState>,
  debounceMs: number,
  enabled = true
): TState {
  const [state, setState] = useState(() => form.state)

  useEffect(() => {
    if (!enabled) return undefined
    setState(form.state)
    let timeout: number | undefined
    const subscription = form.store.subscribe(() => {
      window.clearTimeout(timeout)
      timeout = window.setTimeout(() => setState(form.state), debounceMs)
    })

    return () => {
      window.clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [debounceMs, enabled, form])

  return state
}
