import { FC, ReactNode } from 'react'
import { container } from './Container.css'
import clsx from 'clsx'

interface ContainerProps {
  children: ReactNode
  className?: string | number | symbol | any
}

const Container: FC<ContainerProps> = ({ children, className }) => {
  return (
    <div className={clsx(container, { [className]: className })}>
      {children}
    </div>
  )
}

export default Container
