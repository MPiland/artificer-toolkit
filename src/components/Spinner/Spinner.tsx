import { spinner_container, spinner } from './Spinner.css'
import clsx from 'clsx'
import { Loader } from '@mantine/core'

interface SpinnerProps {
  className?: any
}

const Spinner = ({ className }: SpinnerProps) => {
  const content = (
    <div className={clsx(spinner_container, className)}>
      <Loader className={spinner} />
    </div>
  )
  return content
}

export default Spinner
