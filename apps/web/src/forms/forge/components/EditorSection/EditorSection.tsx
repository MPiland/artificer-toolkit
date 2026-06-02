import { Text } from '@mantine/core'
import type { EditorSectionProps } from './EditorSection.types'
import * as styles from './EditorSection.css'

export function EditorSection({
  accessory,
  children,
  description,
  headingId,
  icon,
  title
}: EditorSectionProps) {
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <header className={styles.sectionHeader}>
        <div className={styles.sectionTitleGroup}>
          <Text component='h2' className={styles.sectionTitle} id={headingId}>
            {icon}
            <span>{title}</span>
          </Text>
          {description ? (
            <Text component='p' className={styles.sectionDescription}>
              {description}
            </Text>
          ) : null}
        </div>
        {accessory}
      </header>
      {children}
    </section>
  )
}
