import { Button, Group, Text } from '@mantine/core'
import { useEffect, useRef } from 'react'
import type { HalfSpeedField } from './CampaignVttCarefulMove.model'
import * as styles from './CampaignVttStage.css'

/**
 * The choice a dragged path offers when it enters a field that allows passage at half speed
 * (SPELLS-17): move carefully for double movement and no save, or move normally and save on
 * entering. The path waits unsent until the mover picks one or cancels.
 */
export function CampaignVttCarefulMoveChoice({
  fields,
  onChoose,
  onCancel
}: {
  fields: readonly HalfSpeedField[]
  onChoose: (carefully: boolean) => void
  onCancel: () => void
}) {
  const names = fields.map(({ label }) => (label ? `the ${label}` : 'a field')).join(' and ')
  const carefullyRef = useRef<HTMLButtonElement>(null)
  // The path waits on this choice, so keyboard focus starts inside it and Escape reaches it.
  useEffect(() => carefullyRef.current?.focus(), [])
  return (
    <section
      aria-label='Cross field'
      className={styles.carefulMoveChoice}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
    >
      <Text fw={650} size='sm'>
        This path enters {names}.
      </Text>
      <Text c='dimmed' size='xs'>
        Moving carefully costs double movement in the field and skips its save. Moving normally
        makes the save on entering.
      </Text>
      <Group gap='xs' mt='xs'>
        <Button ref={carefullyRef} size='xs' onClick={() => onChoose(true)}>
          Move carefully
        </Button>
        <Button size='xs' variant='default' onClick={() => onChoose(false)}>
          Move normally
        </Button>
        <Button size='xs' variant='subtle' onClick={onCancel}>
          Cancel
        </Button>
      </Group>
    </section>
  )
}
