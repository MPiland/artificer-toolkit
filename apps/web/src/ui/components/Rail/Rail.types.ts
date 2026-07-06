import { ComponentPropsWithoutRef } from 'react'

export type RailProps = {
  onClose?: () => void
} & ComponentPropsWithoutRef<'aside'>

export type HeaderProps = ComponentPropsWithoutRef<'header'>
export type FooterProps = ComponentPropsWithoutRef<'footer'>
export type ContentProps = ComponentPropsWithoutRef<'div'>
export type ItemProps = ComponentPropsWithoutRef<'div'>
