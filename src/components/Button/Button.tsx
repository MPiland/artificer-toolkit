import { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import {
  button,
  button_color,
  button_content,
  button_height,
  button_radius,
  button_style,
  button_width,
} from './Button.css'
import clsx from 'clsx'
import { ButtonColor } from '../../css/theme.css'
import { Height, Size } from '../../css/size.css'
import { BorderRadius } from '../../css/border.css'
import { assignInlineVars } from '@vanilla-extract/dynamic'

const Button = ({
  type,
  children,
  onClick,
  disabled,
  className,
  name,
  height = 'default',
  borderRadius = 'default',
  style = 'filled',
  color = 'primary',
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
  color?: ButtonColor
  type?: 'button' | 'submit' | 'reset'
  width?: Size
}) => {
  return (
    <button
      type={type || 'button'}
      className={clsx(
        button,
        button_height[height],
        button_radius[borderRadius],
        button_color[color],
        button_style[style],
        assignInlineVars({
          [button_width]: width,
        }),
        className
      )}
      disabled={disabled}
      onClick={(e) => onClick(e)}
      name={name}
      {...props}
    >
      <span className={button_content}>{children}</span>
    </button>
  )
}

export default Button
