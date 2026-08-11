import { Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'
import * as styles from './SocialHubViews.css'

export function SocialEmptyState({
  title,
  body,
  action
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className={styles.empty}>
      <Title order={2} size='h3'>
        {title}
      </Title>
      <Text>{body}</Text>
      {action ? <div>{action}</div> : null}
    </div>
  )
}
