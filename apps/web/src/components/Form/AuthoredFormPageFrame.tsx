import type { ReactNode } from 'react'
import clsx from 'clsx'
import * as styles from './AuthoredFormPageFrame.css'

export type AuthoredFormPageFrameProps = {
  children: ReactNode
  className?: string
  contentClassName?: string
}

export function AuthoredFormPageFrame({
  children,
  className,
  contentClassName
}: AuthoredFormPageFrameProps) {
  return (
    <div className={clsx(styles.root, className)}>
      <div className={clsx(styles.content, contentClassName)}>
        {children}
      </div>
    </div>
  )
}

export { storyCanvas as authoredFormStoryCanvas } from './AuthoredFormPageFrame.css'
