import { Button, Group, Paper, Text } from '@mantine/core'
import type { RollAfterRollOfferDto } from '@artificer-toolkit/schema/api/rolls'
import * as styles from './dice.css'

/** D168: the dice the Character holds for after this roll, offered once its d20 is seen. */
export function CharacterSheetRollAfterRoll({
  offers,
  pending,
  onAdd,
  onKeep
}: {
  offers: readonly RollAfterRollOfferDto[]
  pending: boolean
  onAdd: (offer: RollAfterRollOfferDto) => void
  onKeep: () => void
}) {
  return (
    <Paper className={styles.afterRollOffers} data-roll-offer withBorder p='xs'>
      <Text size='xs' c='dimmed'>
        Add a held die to this roll?
      </Text>
      <Group gap='xs'>
        {offers.map((offer) => (
          <Button
            disabled={pending}
            key={`${offer.effectId}:${offer.grantId}`}
            size='compact-sm'
            onClick={() => onAdd(offer)}
          >
            {offer.label} {offer.sign === 'SUBTRACT' ? '-' : '+'}
            {offer.count}d{offer.faces}
          </Button>
        ))}
        <Button disabled={pending} size='compact-sm' variant='subtle' onClick={onKeep}>
          Keep roll
        </Button>
      </Group>
    </Paper>
  )
}
