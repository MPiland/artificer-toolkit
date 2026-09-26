import { Badge } from '@mantine/core'
import type { EncounterGmProjectionDto } from '@artificer-toolkit/schema/api/encounterData'

/**
 * "Movement 15 / 30 ft" for the active actor the member controls (V07.5). Movement is shown, never
 * enforced: past the budget Assisted uses the soft-warning style, and Manual shows the number only.
 */
export function CampaignTabletopMovementReadout({
  automationMode,
  budget,
  used
}: {
  automationMode: EncounterGmProjectionDto['automationMode']
  budget: number | null
  used: number
}) {
  const overBy = budget !== null && automationMode !== 'MANUAL' ? Math.round(used - budget) : 0
  return (
    <Badge
      aria-live='polite'
      color={overBy > 0 ? 'yellow' : 'gray'}
      size='lg'
      tt='none'
      variant={overBy > 0 ? 'light' : 'default'}
    >
      Movement {Math.round(used)}
      {budget === null ? '' : ` / ${Math.round(budget)}`} ft
      {overBy > 0 ? ` · ${overBy} ft over` : ''}
    </Badge>
  )
}
