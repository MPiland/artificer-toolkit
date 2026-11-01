import { Group, NumberInput } from '@mantine/core'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { MAX_GROUP_COUNT } from '@artificer-toolkit/schema/shared/authoredLimits'
import {
  encounterActorDispositionDtoSchema,
  MAX_ENCOUNTER_ACTOR_CONTROLLERS,
  type EncounterActorDispositionDto,
  type EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { AppMultiSelect, AppSelect } from '#app/ui/primitives/Select'

const dispositionOptions = [
  { label: 'Friendly', value: 'FRIENDLY' },
  { label: 'Neutral', value: 'NEUTRAL' },
  { label: 'Hostile', value: 'HOSTILE' }
] satisfies { label: string; value: EncounterActorDispositionDto }[]

/** GM-only control grants and disposition for one Run actor, shared by the workspace and tabletop. */
export function EncounterActorControlFields({
  actor,
  disabled,
  memberships,
  onChange
}: {
  actor: Pick<
    EncounterPlayerProjectionDto['actors'][number],
    'controllerUserIds' | 'disposition' | 'kind' | 'label' | 'owner' | 'sourceId'
  >
  disabled: boolean
  memberships: CampaignDetailDto['memberships']
  onChange: (
    update:
      | { controllerUserIds: string[] }
      | { disposition: EncounterActorDispositionDto }
      | { groupCount: number }
  ) => void
}) {
  const players = memberships.filter((membership) => membership.role === 'PLAYER')
  // The assigned player always controls their Character; that control is derived, not granted.
  const assignedPlayer =
    actor.kind === 'CHARACTER' && actor.sourceId
      ? players.find((membership) => membership.assignedCharacter?.id === actor.sourceId)
      : undefined

  return (
    <Group align='start' gap='xs' grow wrap='wrap'>
      <AppMultiSelect
        clearable
        comboboxProps={{ withinPortal: false }}
        data={players
          .filter((membership) => membership.userId !== assignedPlayer?.userId)
          .map((membership) => ({ label: membership.username, value: membership.userId }))}
        description={
          assignedPlayer ? `${assignedPlayer.username} always controls this Character.` : undefined
        }
        disabled={disabled}
        aria-label={`Who controls ${actor.label}`}
        label='Controlled by'
        maxValues={MAX_ENCOUNTER_ACTOR_CONTROLLERS}
        placeholder={actor.controllerUserIds.length ? undefined : 'GM only'}
        value={actor.controllerUserIds}
        onChange={(userIds) => onChange({ controllerUserIds: [...new Set(userIds)].sort() })}
      />
      <AppSelect
        allowDeselect={false}
        comboboxProps={{ withinPortal: false }}
        data={dispositionOptions}
        disabled={disabled}
        aria-label={`${actor.label} disposition`}
        label='Disposition'
        value={actor.disposition}
        onChange={(value) =>
          value && onChange({ disposition: encounterActorDispositionDtoSchema.parse(value) })
        }
      />
      {actor.owner?.count === undefined ? null : (
        <NumberInput
          key={actor.owner.count}
          aria-label={`${actor.label} creatures in the group`}
          allowDecimal={false}
          clampBehavior='strict'
          defaultValue={actor.owner.count}
          disabled={disabled}
          label='Creatures in the group'
          max={MAX_GROUP_COUNT}
          min={1}
          onBlur={(event) => {
            const count = Number(event.currentTarget.value)
            if (Number.isInteger(count) && count >= 1 && count !== actor.owner?.count)
              onChange({ groupCount: count })
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
      )}
    </Group>
  )
}
