import clsx from 'clsx'
import type { ContentProps, FooterProps, HeaderProps, ItemProps, RailProps } from './Rail.types'
import * as styles from './Rail.css'

export function Rail(props: RailProps) {
  const { children, className, ...rest } = props

  return (
    <aside {...rest} className={clsx(styles.shell, className)}>
      {children}
    </aside>
  )
}

function Header(props: HeaderProps) {
  const { children, className, ...rest } = props

  return (
    <header {...rest} className={clsx(styles.header, className)}>
      {children}
    </header>
  )
}

function Content(props: ContentProps) {
  const { children, className, ...rest } = props

  return (
    <div {...rest} className={clsx(styles.content, className)}>
      {children}
    </div>
  )
}

function Item(props: ItemProps) {
  const { children, className, ...rest } = props

  return (
    <div {...rest} className={clsx(styles.item, className)}>
      {children}
    </div>
  )
}

function Footer(props: FooterProps) {
  const { children, className, ...rest } = props

  return (
    <footer {...rest} className={clsx(styles.footer, className)}>
      {children}
    </footer>
  )
}

Rail.Content = Content
Rail.Footer = Footer
Rail.Header = Header
Rail.Item = Item
