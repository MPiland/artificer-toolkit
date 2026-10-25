import { Button, Group, Text } from '@mantine/core'
import { useEffect, useRef } from 'react'
import { facingDirections, facingLabel } from './vttFacing.model'
import * as styles from './CampaignVttStage.css'

/**
 * The facing a token turns to under the Encounter's Facing rule (ATTACK-12): at the end of a move,
 * where the direction of travel is offered first, or as a reaction. Nothing is sent until the
 * member picks a facing; Cancel sends nothing.
 */
export function CampaignVttFacingChoice({
  description,
  initialDegrees,
  label,
  stepDegrees,
  onChoose,
  onCancel
}: {
  description: string
  initialDegrees: number | null
  label: string
  stepDegrees: number
  onChoose: (degrees: number) => void
  onCancel: () => void
}) {
  const initialRef = useRef<HTMLButtonElement>(null)
  // The choice holds the command, so keyboard focus starts inside it and Escape reaches it.
  useEffect(() => initialRef.current?.focus(), [])
  return (
    <section
      aria-label={label}
      className={styles.boardChoice}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
    >
      <Text fw={650} size='sm'>
        {label}
      </Text>
      <Text c='dimmed' size='xs'>
        {description}
      </Text>
      <Group gap='xs' mt='xs'>
        {facingDirections(stepDegrees).map((degrees) => (
          <Button
            key={degrees}
            ref={degrees === initialDegrees ? initialRef : undefined}
            size='xs'
            variant={degrees === initialDegrees ? 'filled' : 'default'}
            onClick={() => onChoose(degrees)}
          >
            {facingLabel(degrees)}
          </Button>
        ))}
        <Button size='xs' variant='subtle' onClick={() => onCancel()}>
          Cancel
        </Button>
      </Group>
    </section>
  )
}
