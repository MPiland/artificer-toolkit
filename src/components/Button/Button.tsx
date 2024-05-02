import { FC, ReactNode } from 'react'
import { button, button_content } from './Button.css'
import clsx from 'clsx'

export type ButtonVariants =
  | 'primary'
  | 'warning'
  | 'default'
  | 'danger'
  | 'update'
  | 'update_outline'
  | 'danger_outline'
  | 'primary_outline'
  | 'warning_outline'
  | 'default_outline'
  | 'unstyled'

interface ButtonProps {
  children: ReactNode
  variant?: ButtonVariants
  type?: 'button' | 'submit'
  onClick?: ((arg: any) => void) | (() => void) | (() => Promise<void>)
  disabled?: boolean
  className?: string | number | symbol | any
  name?: string
}

const Button: FC<ButtonProps> = ({ variant, type, children, onClick, disabled, className, name }) => {
  const variantType = disabled || !variant ? 'default' : variant
  return (
    <button
      className={clsx({ [className]: className }, button[variantType])}
      type={type ?? 'button'}
      onClick={onClick}
      disabled={disabled}
      name={name}
    >
      <span className={button_content}>{children}</span>
    </button>
  )
}

export default Button
