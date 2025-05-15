import { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { button, button_content, button_style, button_width } from './Button.css'
import clsx from 'clsx'
import { Height, Size } from '@/css/size.css'
import { BorderRadius } from '@/css/border.css'

const Button = ({
  type,
  children,
  onClick,
  disabled,
  className,
  name,
  style = 'filled',
  width = 'size-auto',
  ...props
}: {
  children: ReactNode
  onClick?: ((arg: ReactMouseEvent<HTMLButtonElement, MouseEvent>) => void) | (() => void) | (() => Promise<void>)
  disabled?: boolean
  className?: string | number | symbol | any
  name?: string
  height?: Height | 'default'
  borderRadius?: BorderRadius | 'default'
  style?: 'filled' | 'outline' | 'unstyled'
  type?: 'button' | 'submit' | 'reset'
  width?: Size
}) => {
  return (
    <button
      type={type || 'button'}
      className={clsx(button, button_style[style], button_width[width], className)}
      disabled={disabled}
      onClick={(e) => onClick && onClick(e)}
      name={name}
      {...props}
    >
      <span className={button_content}>{children}</span>
    </button>
  )
}

export default Button
