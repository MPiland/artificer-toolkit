import { ReactNode, RefObject } from 'react'
import { body } from './Modal.css'

export interface ContentProps {
  children: ReactNode
  ref?: RefObject<HTMLDivElement>
}

const Content = ({ children, ref }: ContentProps) => {
  return (
    <div className={body} ref={ref}>
      {children}
    </div>
  )
}

export default Content
