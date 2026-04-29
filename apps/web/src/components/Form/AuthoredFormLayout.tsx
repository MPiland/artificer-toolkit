import type { FormEventHandler, ReactNode } from 'react'
import { Text } from '@mantine/core'
import clsx from 'clsx'
import * as styles from './AuthoredFormLayout.css'

export function AuthoredFormRoot({
  children,
  className
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={clsx(styles.root, className)}>{children}</div>
}

export function AuthoredFormHeader({
  action,
  eyebrow,
  title
}: {
  action?: ReactNode
  eyebrow?: ReactNode
  title: ReactNode
}) {
  return (
    <div className={styles.header}>
      <div>
        <h1 className={styles.title}>{title}</h1>
        {eyebrow ? <Text className={styles.eyebrow}>{eyebrow}</Text> : null}
      </div>
      {action}
    </div>
  )
}

export function AuthoredFormShell({
  children,
  className,
  onSubmit
}: {
  children: ReactNode
  className?: string
  onSubmit: FormEventHandler<HTMLFormElement>
}) {
  return (
    <form className={clsx(styles.shell, className)} onSubmit={onSubmit}>
      {children}
    </form>
  )
}

export function AuthoredFormSectionStack({
  children,
  className
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={clsx(styles.sectionStack, className)}>{children}</div>
}

export function AuthoredFormSection({
  action,
  children,
  className,
  description,
  title,
  titleId
}: {
  action?: ReactNode
  children: ReactNode
  className?: string
  description?: ReactNode
  title: ReactNode
  titleId: string
}) {
  return (
    <section className={clsx(styles.section, className)} aria-labelledby={titleId}>
      <div className={styles.sectionHeader}>
        <h2 id={titleId} className={styles.sectionTitle}>{title}</h2>
        {action}
      </div>
      {description ? <Text className={styles.sectionCopy}>{description}</Text> : null}
      {children}
    </section>
  )
}

export function AuthoredFormFooter({
  children,
  className
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={clsx(styles.footer, className)}>{children}</div>
}
