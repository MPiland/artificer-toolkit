import { useRef, useEffect } from 'react'

function useAutosave(callback, delay = 1000, dep) {
  const savedCallback = useRef() // to save the current "fresh" callback

  // keep callback ref up to date
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  // create the interval
  useEffect(() => {
    // function to call the callback
    function runCallback() {
      savedCallback.current()
    }
    if (typeof delay === 'number') {
      // run the interval
      let interval = setInterval(runCallback, delay)
      // clean up on unmount or dependency change
      return () => clearInterval(interval)
    }
  }, [delay, dep])
}

export default useAutosave
