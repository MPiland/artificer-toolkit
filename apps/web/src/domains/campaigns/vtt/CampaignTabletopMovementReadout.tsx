import { Badge, Group, SegmentedControl } from '@mantine/core'
import type { EncounterGmProjectionDto } from '@artificer-toolkit/schema/api/encounterData'
import {
  selectMovementAllowance,
  type TurnMovementEntry
} from './CampaignTabletopMovementReadout.model'

/**
 * "Movement 15 / 30 ft" for the active actor the member controls (V07.5), measured against one
 * speed type's allowance (SPELLS-5.6); an actor with several speed types also names the type and
 * offers a choice between them. Movement is shown, never enforced: past the allowance Assisted uses
 * the soft-warning style, and Manual shows the number only.
 */
export function CampaignTabletopMovementReadout({
  automationMode,
  chosenSpeedId,
  movement,
  onChooseSpeed
}: {
  automationMode: EncounterGmProjectionDto['automationMode']
  chosenSpeedId: string | null
  movement: TurnMovementEntry
  onChooseSpeed: (speedId: string) => void
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
