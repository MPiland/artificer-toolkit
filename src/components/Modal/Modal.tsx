import { useCallback, ReactNode, RefObject, useRef, MouseEvent as ReactMouseEvent, use } from 'react'
import {
  modal,
  modal_dialogue,
  modal_content,
  modal_header,
  modal_title,
  modal_body,
  modal_footer,
  modal_divider,
  modal_background,
} from './Modal.css'
import { TbX } from 'react-icons/tb'
import Button from '../Button/Button'
import clsx from 'clsx'
import { sprinkles } from '../../css/sprinkles.css'
import Group from '../Group/Group'
import { useEventListener } from 'usehooks-ts'
import { ModalContext } from './ModalContext'

export const Header = ({
  title,
  children,
  onClose,
}: {
  title?: string
  children?: ReactNode
  onClose?: () => void
}) => {
  const { hideModal } = use(ModalContext)
  const handleClose = () => {
    if (onClose) {
      onClose()
    } else {
      hideModal()
    }
  }

  return (
    <>
      <div className={modal_header}>
        <Group justifyContentVariant='spaceBetween'>
          <Group>
            {children && <div>{children}</div>}
            <h2 className={modal_title}>{title}</h2>
          </Group>
          {handleClose && (
            <Button
              type='button'
              style='unstyled'
              className={sprinkles({ w: 'size-7' })}
              aria-label='Close'
              onClick={handleClose}
            >
              <TbX className={sprinkles({ w: 'size-full', h: 'size-auto' })} />
            </Button>
          )}
        </Group>
      </div>
      <hr className={modal_divider} />
    </>
  )
}

export const Content = ({ children, ref }: { children: ReactNode; ref?: RefObject<HTMLDivElement> }) => {
  return (
    <div className={modal_body} ref={ref}>
      {children}
    </div>
  )
}

export const Footer = ({ children }: { children: ReactNode }) => {
  return (
    <>
      <hr className={modal_divider} />
      <div className={modal_footer}>{children}</div>
    </>
  )
}

const Dialogue = ({
  children,
  size = 'md',
  ref,
}: {
  children: ReactNode
  size?: 'xs' | 'sm' | 'md' | 'lg'
  ref?: RefObject<HTMLDivElement>
}) => {
  return (
    <div
      className={clsx(modal_dialogue, {
        [size]: size,
      })}
      tabIndex={-1}
      role='dialog'
      id='modal'
      ref={ref}
    >
      <div className={modal_content} id='modal-content'>
        {children}
      </div>
    </div>
  )
}

const Modal = ({ children, onClose }: { children: ReactNode; onClose?: () => void }) => {
  const { hideModal } = use(ModalContext)
  const documentRef = useRef<Document>(document)

  const handleClose = useCallback(
    (e?: ReactMouseEvent<HTMLDivElement, MouseEvent>) => {
      if (e) {
        const modalContent = document.getElementById('modal-content')
        if (modalContent && modalContent.contains(e.target as Node)) {
          return
        }
      }
      if (onClose) {
        onClose()
      } else {
        hideModal()
      }
    },
    [onClose, hideModal]
  )

  // Closes modal when Escape is pressed
  const handleEscKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleClose()
    }
  }

  const handleModalClick = (e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => {
    const modalContent = document.getElementById('modal-content')
    if (modalContent && !modalContent.contains(e.target as Node)) {
      return handleClose()
    }
  }

  useEventListener('keydown', handleEscKey, documentRef)

  return (
    <>
      <div className={modal}>{children}</div>
      <div className={modal_background} onClick={handleModalClick} />
    </>
  )
}

Modal.Content = Content
Modal.Dialogue = Dialogue
Modal.Footer = Footer
Modal.Header = Header

export default Modal
