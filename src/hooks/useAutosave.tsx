import { useRef, useEffect } from 'react'

type Callback = (arg: any) => void

function useAutosave(
  callback: Callback,
  delay: number = 1000,
  dep?: any
): void {
  const savedCallback = useRef<Callback | undefined>()

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    function runCallback(arg: any) {
      savedCallback.current!(arg)
    }
    if (typeof delay === 'number') {
      let interval = setInterval(runCallback, delay)
      return () => clearInterval(interval)
    }
  }, [delay, dep])
}

export default useAutosave
