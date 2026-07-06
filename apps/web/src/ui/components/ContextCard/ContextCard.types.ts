import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export type ContextCardProps = ComponentPropsWithoutRef<'section'> & {
  children: ReactNode
  title: string
  titleId: string
  className?: string
  header?: boolean
  classNames?: {
    root?: string
    header?: string
    title?: string
    body?: string
  }
  props?: ComponentProps
}

type ComponentProps = {
  header?: ComponentPropsWithoutRef<'header'>
  title?: ComponentPropsWithoutRef<'h2'>
  body?: ComponentPropsWithoutRef<'div'>
}
