import { useEffect, useCallback, FC, ReactNode } from 'react'
import { useNavigate, Outlet, useLocation } from 'react-router-dom'
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
import { light } from '../../css/global.css'
import { TbX } from 'react-icons/tb'
import Button from '../Button/Button'
import clsx from 'clsx'
import { sprinkles } from '../../css/sprinkles.css'
import Group from '../Group/Group'
import { ButtonVariants } from '../Button/Button'

interface DialogueProps {
  children: ReactNode
  size: string
}

interface HeaderProps {
  title: string
  children?: ReactNode
  buttonVariant?: ButtonVariants
}

interface FooterProps {
  children: ReactNode
}

interface BodyProps {
  children: ReactNode
}

export const Header: FC<HeaderProps> = ({ title, children, buttonVariant }) => {
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
            <h1 className={modal_title}>{title}</h1>
          </Group>
          {handleClose && (
            <Button
              type='button'
              variant={buttonVariant ?? 'unstyled'}
              className={sprinkles({ w: 'size-3' })}
              aria-label='Close'
              onClick={handleClose}
            >
              <TbX className={sprinkles({ w: 'full', h: 'auto' })} />
            </Button>
          )}
        </Group>
      </div>
      <hr className={modal_divider} />
    </>
  )
}

export const Body: FC<BodyProps> = ({ children }) => {
  return <div className={modal_body}>{children}</div>
}

export const Footer: FC<FooterProps> = ({ children }) => {
  return (
    <>
      <hr className={modal_divider} />
      <div className={modal_footer}>{children}</div>
    </>
  )
}

const Dialogue: FC<DialogueProps> = ({ children, size }) => {
  return (
    <div
      className={clsx(modal_dialogue, {
        [size]: size,
      })}
      tabIndex={-1}
      role='dialog'
      id='modal'
    >
      {children}
    </div>
  )
}

const Modal: FC & {
  Header: FC<HeaderProps>
  Footer: FC<FooterProps>
  Body: FC<BodyProps>
} = () => {
  const location = useLocation()
  const navigate = useNavigate()

  // Closes modal when Escape is pressed
  const handleEscKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        navigate(-1)
      }
    },
    [navigate]
  )

  const handleClose = () => {
    navigate(-1)
  }

  // Listens for Key to close modal
  useEffect(() => {
    document.addEventListener('keyup', handleEscKey)

    return () => document.removeEventListener('keyup', handleEscKey)
  }, [handleEscKey])

  return (
    <>
      <div className={clsx(modal, light)} onClick={handleClose}>
        <Dialogue size={location.state.size}>
          <div
            className={modal_content}
            role='document'
            onClick={(e) => e.stopPropagation()}
          >
            <Outlet />
          </div>
        </Dialogue>
      </div>
    </>
  )
}

Modal.Body = Body
Modal.Footer = Footer
Modal.Header = Header

export default Modal
