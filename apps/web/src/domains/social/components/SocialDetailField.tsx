import { Text, Title } from '@mantine/core'
import * as styles from './SocialDetailField.css'

export function SocialDetailField({ label, value }: { label: string; value: string }) {
  return (
    <section>
      <Title order={3} size='h4'>
        {label}
      </Title>
      <Text className={styles.prose}>{value}</Text>
    </section>
  )
}
