import { Button, Text } from '@mantine/core'
import type { ConcealmentListingDto } from '@artificer-toolkit/schema/shared/activeGrantListing'
import * as styles from './CampaignTabletopConcealmentObservers.css'

/**
 * A hidden creature as the GM sees it (D116): the creatures it is hidden from and the ones that
 * noticed it, each a click from the other. Only the GM's projection carries the concealment.
 */
export function CampaignTabletopConcealmentObservers({
  actors,
  concealment,
  disabled,
  holder,
  onChange
}: {
  actors: readonly { id: string; label: string }[]
  concealment: ConcealmentListingDto
  disabled: boolean
  holder: { id: string; label: string }
  onChange: (change: { add: string[]; remove: string[] }) => void
}) {
  const others = actors.filter(({ id }) => id !== holder.id)
  return (
    <ul aria-label={`Hidden creature ${holder.label}`} className={styles.list}>
      {others.map((actor) => {
        const hiddenFrom = concealment.observerActorIds.includes(actor.id)
        return (
          <li className={styles.item} key={actor.id}>
            <Text size='xs'>
              {hiddenFrom ? 'Hidden from' : 'Noticed by'} {actor.label}
            </Text>
            <Button
              aria-label={
                hiddenFrom
                  ? `Stop hiding ${holder.label} from ${actor.label}`
                  : `Hide ${holder.label} from ${actor.label}`
              }
              disabled={disabled}
              size='compact-xs'
              variant='default'
              onClick={() =>
                onChange(
                  hiddenFrom ? { add: [], remove: [actor.id] } : { add: [actor.id], remove: [] }
                )
              }
            >
              {hiddenFrom ? 'Stop hiding' : 'Hide'}
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
