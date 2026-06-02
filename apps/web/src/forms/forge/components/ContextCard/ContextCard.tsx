import { Text } from '@mantine/core'
import type { ContextCardProps } from './ContextCard.types'
import * as styles from './ContextCard.css'

export function ContextCard({ children, title, titleId, header }: ContextCardProps) {
  return (
    <section className={styles.previewCard} aria-labelledby={titleId}>
      <header
        className={styles.moduleHeader}
        data-divider={header?.divider ? 'true' : undefined}
        data-emphasized={header?.emphasized ? 'true' : undefined}
      >
        <Text component='h2' className={styles.previewTitle} id={titleId}>
          {title}
        </Text>
        {header?.divider && <hr aria-hidden='true' className={styles.moduleHeaderDivider} />}
      </header>
      <div className={styles.moduleBody}>{children}</div>
    </section>
  )
}
