import { Badge, Group, SegmentedControl, Switch } from '@mantine/core'
import type { EncounterGmProjectionDto } from '@artificer-toolkit/schema/api/encounterData'
import {
  selectMovementAllowance,
  type TurnMovementEntry
} from './CampaignTabletopMovementReadout.model'

/**
 * "Movement 15 / 30 ft" for the active actor the member controls (V07.5), measured against one
 * speed type's allowance (SPELLS-5.6); an actor with several speed types also names the type and
 * offers a choice between them. Movement is shown, never enforced: past the allowance Assisted uses
 * the soft-warning style, and Manual shows the number only. An actor holding a cast's teleport
 * (Misty Step, SPELLS-28.2) also gets a switch that sends its next drag as that teleport.
 */
export function CampaignTabletopMovementReadout({
  automationMode,
  chosenSpeedId,
  movement,
  teleportOn,
  onChooseSpeed,
  onTeleportChange
}: {
  automationMode: EncounterGmProjectionDto['automationMode']
  chosenSpeedId: string | null
  movement: TurnMovementEntry
  /** Whether the next drag teleports; null when the actor holds no teleport allowance. */
  teleportOn: boolean | null
  onChooseSpeed: (speedId: string) => void
  onTeleportChange: (on: boolean) => void
}) {
  const allowance = selectMovementAllowance(movement, chosenSpeedId)
  const several = movement.allowances.length > 1
  const overBy =
    allowance && automationMode !== 'MANUAL' ? Math.round(movement.used - allowance.budget) : 0
  return (
    <Group gap='xs' wrap='nowrap'>
      {several && allowance ? (
        <SegmentedControl
          aria-label='Movement speed type'
          data={movement.allowances.map(({ label, speedId }) => ({ label, value: speedId }))}
          size='xs'
          value={allowance.speedId}
          onChange={onChooseSpeed}
        />
      ) : null}
      {teleportOn !== null ? (
        <Switch
          checked={teleportOn}
          label='Teleport'
          size='xs'
          onChange={(event) => onTeleportChange(event.currentTarget.checked)}
        />
      ) : null}
      <Badge
        aria-live='polite'
        color={overBy > 0 ? 'yellow' : 'gray'}
        size='lg'
        tt='none'
        variant={overBy > 0 ? 'light' : 'default'}
      >
        Movement {Math.round(movement.used)}
        {allowance ? ` / ${Math.round(allowance.budget)}` : ''} ft
        {several && allowance ? ` · ${allowance.label}` : ''}
        {overBy > 0 ? ` · ${overBy} ft over` : ''}
      </Badge>
    </Group>
  )
}
