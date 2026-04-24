import { Link as LinkTanstack, LinkComponentProps, type NavigateOptions, type ToOptions } from '@tanstack/react-router'
import {
  Button,
  UnstyledButton,
  type ButtonProps,
  type UnstyledButtonProps,
  Anchor,
  type AnchorProps,
  Alert,
  type AlertProps
} from '@mantine/core'
import type { AnchorHTMLAttributes, Ref, ReactNode } from 'react'

type LinkBaseProps = {
  className?: string
  ref?: Ref<HTMLAnchorElement>
  children?: ReactNode
  type?: 'styled' | 'unstyled' | 'anchor' | 'alert'
  to: ToOptions['to']
  params?: NavigateOptions['params']
} & LinkComponentProps
& Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>

export type LinkProps = LinkBaseProps & (ButtonProps | UnstyledButtonProps | AnchorProps | AlertProps)

export function Link({ children, className, ref, type = 'styled', ...props }: LinkProps) {
  const sharedProps = {
    ...props,
    className,
    component: LinkTanstack,
    ref,
    activeProps: { ...props.activeProps, 'data-active': true },
    children
  }

  return (
    type === 'unstyled'
      ? <UnstyledButton {...(sharedProps as UnstyledButtonProps)} />
      : type === 'anchor'
        ? <Anchor {...(sharedProps as AnchorProps)} />
        : type === 'alert'
          ? <Alert {...(sharedProps as AlertProps)} />
          : <Button {...(sharedProps as ButtonProps)} />
  )
}
