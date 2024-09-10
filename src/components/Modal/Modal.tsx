import { useEffect, useCallback, ReactNode, forwardRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  modal,
  modal_dialogue,
  modal_content,
  modal_header,
  modal_title,
  modal_body,
  modal_footer,
  modal_divider,
} from './Modal.css'
import { TbX } from 'react-icons/tb'
import Button from '../Button/Button'
import clsx from 'clsx'
import { sprinkles } from '../../css/sprinkles.css'
import Group from '../Group/Group'
import { ButtonColor } from '../../css/theme.css'

export const Header = ({ title, children }: { title: string; children?: ReactNode; buttonColor?: ButtonColor }) => {
  const navigate = useNavigate()

  const handleClose = () => {
    navigate(-1)
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

export const Content = forwardRef<HTMLDivElement, { children: ReactNode }>(({ children }, ref) => {
  return (
    <div className={modal_body} ref={ref}>
      {children}
    </div>
  )
})

export const Footer = ({ children }: { children: ReactNode }) => {
  return (
    <>
      <hr className={modal_divider} />
      <div className={modal_footer}>{children}</div>
    </>
  )
}

const Dialogue = forwardRef<HTMLDivElement, { children: ReactNode; size?: 'xs' | 'sm' | 'md' | 'lg' }>(
  ({ children, size = 'md' }, ref) => {
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
        <div className={modal_content} onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    )
  }
)

const Modal = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate()

  const handleClose = useCallback(() => {
    navigate(-1)
  }, [navigate])

  // Closes modal when Escape is pressed
  const handleEscKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose()
      }
    },
    [handleClose]
  )

  // Listens for Key to close modal
  useEffect(() => {
    document.addEventListener('keyup', handleEscKey)

    return () => document.removeEventListener('keyup', handleEscKey)
  }, [handleEscKey])

  return (
    <>
      <div className={modal} onClick={handleClose}>
        {children}
      </div>
    </>
  )
}

Content.displayName = 'Content'
Dialogue.displayName = 'Dialogue'

Modal.Content = Content
Modal.Dialogue = Dialogue
Modal.Footer = Footer
Modal.Header = Header

export default Modal
