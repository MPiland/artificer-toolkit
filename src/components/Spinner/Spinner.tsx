import { useEffect, useState, useRef } from 'react'
import { spinner_container, spinner } from './Spinner.css'
import clsx from 'clsx'

interface SpinnerProps {
  className?: any
}

const Spinner = ({ className }: SpinnerProps) => {
  const [isSmall, setIsSmall] = useState<boolean>(false)

  const spinnerContainer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (spinnerContainer.current) {
      const parentContainer = spinnerContainer.current.parentElement
      if (parentContainer) {
        const parentContainerHeight = parentContainer.clientHeight
        if (parentContainerHeight && parentContainerHeight < 48) {
          setIsSmall(true)
        }
      }
    }
  }, [spinnerContainer])

  const content = (
    <div
      className={clsx(
        spinner_container,
        {
          ['small']: isSmall,
        },
        { [className]: className }
      )}
      ref={spinnerContainer}
    >
      <div className={spinner} role='status' />
    </div>
  )
  return content
}

export default Spinner
