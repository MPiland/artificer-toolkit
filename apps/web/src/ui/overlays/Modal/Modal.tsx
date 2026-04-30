import { ReactNode, RefObject } from 'react'
import Footer, { type FooterProps } from './Footer'
import clsx from 'clsx'
import { dialogue, body } from './Modal.css'

type ModalProps = {
  children: ReactNode
  ref?: RefObject<HTMLDivElement>
  className?: string
  props?: {
    footer?: FooterProps
  }
}

const Modal = ({ children, ref, className, props }: ModalProps) => {
  return (
    <>
      <div
        className={clsx(dialogue, {
          [className || '']: className
        })}
        tabIndex={-1}
        role='dialog'
        id='modal'
        ref={ref}
      >
        <div className={body} ref={ref}>
          {children}
        </div>
      </div>
      {props?.footer && <Footer {...props.footer} />}
    </>
  )
}

export default Modal
