import { ReactNode } from 'react'
import * as styles from './Content.css'
import { Rail } from '#ui'

export function Content({ children }: { children: ReactNode }) {
  return (
    <Rail.Content>
      <nav className={styles.tree} aria-label='Authoring steps'>
        {children}
      </nav>
    </Rail.Content>
  )
}
