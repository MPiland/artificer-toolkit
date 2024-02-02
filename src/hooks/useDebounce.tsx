import { useCallback, useEffect } from 'react'

export type DebounceFunction = { (...args: any[]): void; cancel: () => void }

const debounce = (
  func: DebounceFunction,
  wait: number = 200
): DebounceFunction => {
  let timeout: NodeJS.Timeout | undefined

  const executedFunction: DebounceFunction = (...args: any[]) => {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }

    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }

  executedFunction.cancel = () => {
    clearTimeout(timeout)
  }

  return executedFunction
}

export type UseDebounceCallback = { (...args: any[]): void; cancel: () => void }

const useDebounce = (
  callback: UseDebounceCallback,
  delay: number = 1000,
  dep?: any
): DebounceFunction => {
  const debouncedCallback = useCallback(debounce(callback, delay), [delay, dep])

  useEffect(() => {
    return () => {
      debouncedCallback.cancel()
    }
  }, [delay, dep])

  return debouncedCallback
}

export default useDebounce
