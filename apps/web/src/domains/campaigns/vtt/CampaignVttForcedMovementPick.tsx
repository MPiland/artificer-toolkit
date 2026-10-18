import { Button, Text, VisuallyHidden } from '@mantine/core'
import { useEffect, useId, useRef, useState } from 'react'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import * as styles from './CampaignVttStage.css'
import {
  forcedMovementDestinationAfterKey,
  type VttForcedMovementPick
} from './vttForcedMovementPick.model'

/**
 * The board instruction while a forced movement waits for its source to pick where the creature
 * lands (D157). A press on a highlighted square picks it. For the keyboard, one picker control holds
 * a focused square: the arrow keys move it to the nearest legal square that way, Home returns to the
 * first, Enter or Space picks it, and the focused square is marked on the board and announced.
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
  const pickerRef = useRef<HTMLButtonElement>(null)
  const hintId = useId()
  const [focusedIndex, setFocusedIndex] = useState(0)
  const focused = pick.destinations[focusedIndex] ?? pick.destinations[0]!
  // The action waits on this pick, so keyboard focus starts on the picker.
  useEffect(() => pickerRef.current?.focus(), [])
  const focusSquare = (position: ScenePoint) => {
    const index = pick.destinations.findIndex(
      (destination) =>
        destination.position.x === position.x && destination.position.y === position.y
    )
    setFocusedIndex(index)
    onFocusSquare(position)
  }
  return (
    <section aria-label={`Where ${pick.creature} lands`} className={styles.boardChoice}>
      <Text fw={650} role='status' size='sm'>
        Pick where {pick.creature} lands.
      </Text>
      <Button
        aria-describedby={hintId}
        disabled={disabled}
        mt='xs'
        ref={pickerRef}
        size='xs'
        variant='default'
        onBlur={() => onFocusSquare(null)}
        onClick={() => onPick(focused.position)}
        onFocus={() => onFocusSquare(focused.position)}
        onKeyDown={(event) => {
          const next =
            event.key === 'Home'
              ? pick.destinations[0]!.position
              : forcedMovementDestinationAfterKey(
                  pick.destinations.map(({ position }) => position),
                  focused.position,
                  event.key
                )
          if (!next) return
          event.preventDefault()
          focusSquare(next)
        }}
      >
        {focused.label}
      </Button>
      <VisuallyHidden id={hintId}>
        Arrow keys move between the legal squares; Home returns to the first.
      </VisuallyHidden>
      <VisuallyHidden aria-live='polite'>{focused.label}</VisuallyHidden>
    </section>
  )
}
