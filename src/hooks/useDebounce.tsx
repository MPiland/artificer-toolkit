import { useCallback, useEffect } from 'react'

export type DebounceFunction = { (...args: any[]): void; cancel: () => void }

const debounce = (
  func: DebounceFunction,
  delay: number = 200
): DebounceFunction => {
  let timeout: NodeJS.Timeout | undefined

  const executedFunction: DebounceFunction = (...args: any[]) => {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }

    clearTimeout(timeout)
    timeout = setTimeout(later, delay)
  }

  executedFunction.cancel = () => {
    clearTimeout(timeout)
  }

  return executedFunction
}

const useDebounce = (
  func: DebounceFunction,
  delay: number = 200,
  deps: any[] = []
): DebounceFunction => {
  const debouncedCallback = useCallback(debounce(func, delay), [delay, ...deps])

  useEffect(() => {
    return () => {
      debouncedCallback.cancel()
    }
  }, [delay, ...deps])

  return debouncedCallback
}

export default useDebounce
