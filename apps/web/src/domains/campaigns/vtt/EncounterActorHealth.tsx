import { Badge, Progress, Text } from '@mantine/core'
import type { PlayerActorHealthDto } from '@artificer-toolkit/schema/api/healthDisplay'
import { healthDescriptiveStateLabels } from '../healthDisplay'
import * as styles from './CampaignTabletopEncounterDrawer.css'

/** One actor's health exactly as its display level allows a player to see it. */
export function EncounterActorHealth({
  health,
  label
}: {
  health: PlayerActorHealthDto
  label: string
}) {
  switch (health.level) {
    case 'DESCRIPTIVE':
      return (
        <Badge
          color={
            health.state === 'NEAR_DEATH' ? 'red' : health.state === 'BLOODIED' ? 'orange' : 'gray'
          }
          size='xs'
          variant='light'
        >
          {healthDescriptiveStateLabels[health.state]}
        </Badge>
      )
    case 'BAR':
      return (
        <Progress
          aria-label={`${label} health`}
          className={styles.healthBar}
          color={health.ratio <= 0.25 ? 'red' : health.ratio <= 0.5 ? 'orange' : 'teal'}
          size='sm'
          value={health.ratio * 100}
        />
      )
    case 'EXACT':
      return (
        <Text className={styles.healthExact} size='xs'>
          HP {health.current}/{health.maximum}
        </Text>
      )
  }
}
