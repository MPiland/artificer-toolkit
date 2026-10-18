import { Button, Group, Text } from '@mantine/core'
import { useEffect, useRef } from 'react'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import * as styles from './CampaignVttStage.css'
import type { VttForcedMovementPick } from './vttForcedMovementPick.model'

/**
 * The board instruction while a forced movement waits for its source to pick where the creature
 * lands (D157). A press on a highlighted square picks it; each square is also a focusable button
 * named by the direction and distance it moves the creature, and focusing one marks it on the board.
 */
export function CampaignVttForcedMovementPick({
  disabled,
  pick,
  onFocusSquare,
  onPick
}: {
  disabled: boolean
  pick: VttForcedMovementPick
  onFocusSquare: (position: ScenePoint | null) => void
  onPick: (position: ScenePoint) => void
}) {
  const firstRef = useRef<HTMLButtonElement>(null)
  // The action waits on this pick, so keyboard focus starts on its first square.
  useEffect(() => firstRef.current?.focus(), [])
  return (
    <section aria-label={`Where ${pick.creature} lands`} className={styles.boardChoice}>
      <Text fw={650} role='status' size='sm'>
        Pick where {pick.creature} lands.
      </Text>
      <Group gap='xs' mt='xs'>
        {pick.destinations.map(({ position, label }, index) => (
          <Button
            disabled={disabled}
            key={`${position.x},${position.y}`}
            ref={index === 0 ? firstRef : undefined}
            size='xs'
            variant='default'
            onBlur={() => onFocusSquare(null)}
            onClick={() => onPick(position)}
            onFocus={() => onFocusSquare(position)}
          >
            {label}
          </Button>
        ))}
      </Group>
    </section>
  )
}
