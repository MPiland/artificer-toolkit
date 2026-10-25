import { Button, Checkbox, Group, Select, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import type { RollVisibilityDto } from '@artificer-toolkit/schema/api/rolls'
import {
  MORALE_TRIGGER_SCOPE,
  type EncounterActorMoraleDto,
  type EncounterMoraleOfferDto
} from '@artificer-toolkit/schema/shared/encounterMorale'
import type {
  MoraleDispositionDto,
  MoraleTriggerKindDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { useGmRollVisibilityPreference } from '#app/settings/useGmRollVisibilityPreference'

const TRIGGER_LABELS: Readonly<Record<MoraleTriggerKindDto, string>> = {
  INDIVIDUAL_SURPRISED: 'Surprised',
  INDIVIDUAL_REDUCED_TO_HALF: 'Reduced to half hit points',
  INDIVIDUAL_CANNOT_HARM_OPPOSITION: 'Cannot harm the opposition',
  GROUP_SURPRISED: 'Group surprised',
  GROUP_HALF_REMOVED: 'Half the group removed',
  GROUP_LEADER_REMOVED: 'Leader removed',
  GROUP_LEADER_INCAPACITATED: 'Leader incapacitated',
  GROUP_LEADER_TAKEN_PRISONER: 'Leader taken prisoner'
}

const DISPOSITIONS: readonly { value: MoraleDispositionDto; label: string }[] = [
  { value: 'CONTINUE', label: 'Fight on' },
  { value: 'FLEE', label: 'Flee' },
  { value: 'SURRENDER', label: 'Surrender' }
]

/**
 * A creature's morale as the GM sees it (ENCOUNTER-6.1, 6.2): the triggers to check, which the Run
 * shows or the GM declares, and the latest check's outcome for the GM to confirm or change. Only the
 * GM's projection carries morale.
 */
export function CampaignTabletopMorale({
  actor,
  disabled,
  leaders,
  onCheck,
  onConfirm
}: {
  actor: {
    id: string
    label: string
    morale: EncounterActorMoraleDto | null
    moraleOffers: readonly EncounterMoraleOfferDto[]
  }
  disabled: boolean
  /** The creatures the GM may name as the group's leader; the server checks they share its side. */
  leaders: readonly { id: string; label: string }[]
  onCheck: (check: {
    triggerKind: MoraleTriggerKindDto
    leaderActorId: string | null
    overwhelmingOpposition: boolean
    escapePossible: boolean
    visibility: RollVisibilityDto
  }) => void
  onConfirm: (disposition: MoraleDispositionDto) => void
}) {
  const { gmRollVisibility } = useGmRollVisibilityPreference()
  const [pickedTrigger, setPickedTrigger] = useState<string | null>(null)
  const [leaderActorId, setLeaderActorId] = useState(actor.morale?.groupLeaderActorId ?? null)
  const [overwhelmingOpposition, setOverwhelmingOpposition] = useState(false)
  const [escapePossible, setEscapePossible] = useState(true)
  const offer =
    actor.moraleOffers.find((candidate) => candidate.triggerKind === pickedTrigger) ??
    actor.moraleOffers[0]
  const { morale } = actor
  if (!offer && !morale) return null
  const offerGroup = (origin: EncounterMoraleOfferDto['origin'], group: string) => ({
    group,
    items: actor.moraleOffers
      .filter((candidate) => candidate.origin === origin)
      .map(({ triggerKind }) => ({ label: TRIGGER_LABELS[triggerKind], value: triggerKind }))
  })
  return (
    <Stack aria-label={`Morale for ${actor.label}`} gap={4} role='group'>
      {morale ? (
        <>
          <Text size='xs'>
            Morale ({TRIGGER_LABELS[morale.triggerKind]}):{' '}
            {morale.save
              ? `save ${morale.save.total} against DC ${morale.save.dc}`
              : 'failed against overwhelming opposition'}
            {morale.disposition
              ? ` · ${DISPOSITIONS.find(({ value }) => value === morale.disposition)?.label}`
              : ` · proposes ${DISPOSITIONS.find(({ value }) => value === morale.proposed)?.label}`}
          </Text>
          <Group gap={4}>
            {DISPOSITIONS.map(({ value, label }) => (
              <Button
                aria-label={`${label}: confirm morale for ${actor.label}`}
                aria-pressed={morale.disposition === value}
                disabled={disabled || morale.disposition === value}
                key={value}
                size='compact-xs'
                variant={(morale.disposition ?? morale.proposed) === value ? 'filled' : 'default'}
                onClick={() => onConfirm(value)}
              >
                {label}
              </Button>
            ))}
          </Group>
        </>
      ) : null}
      {offer ? (
        <>
          <Select
            allowDeselect={false}
            aria-label={`Morale trigger for ${actor.label}`}
            comboboxProps={{ withinPortal: false }}
            data={[
              offerGroup('RUN_STATE', 'The Encounter shows'),
              offerGroup('GM_DECLARED', 'You declare')
            ].filter(({ items }) => items.length > 0)}
            disabled={disabled}
            size='xs'
            value={offer.triggerKind}
            onChange={setPickedTrigger}
          />
          {MORALE_TRIGGER_SCOPE[offer.triggerKind] === 'GROUP' ? (
            <Select
              aria-label={`Group leader for ${actor.label}`}
              clearable
              comboboxProps={{ withinPortal: false }}
              data={leaders.map(({ id, label }) => ({ label, value: id }))}
              disabled={disabled}
              placeholder='No leader: the best save rolls'
              size='xs'
              value={leaderActorId}
              onChange={setLeaderActorId}
            />
          ) : null}
          <Checkbox
            checked={overwhelmingOpposition}
            disabled={disabled}
            label='Overwhelming opposition'
            size='xs'
            onChange={(event) => setOverwhelmingOpposition(event.currentTarget.checked)}
          />
          <Checkbox
            checked={escapePossible}
            disabled={disabled}
            label='It can escape'
            size='xs'
            onChange={(event) => setEscapePossible(event.currentTarget.checked)}
          />
          <Button
            aria-label={`Check morale for ${actor.label}`}
            disabled={disabled}
            size='compact-xs'
            variant='default'
            onClick={() =>
              onCheck({
                triggerKind: offer.triggerKind,
                leaderActorId:
                  MORALE_TRIGGER_SCOPE[offer.triggerKind] === 'GROUP' ? leaderActorId : null,
                overwhelmingOpposition,
                escapePossible,
                visibility: gmRollVisibility
              })
            }
          >
            Check morale
          </Button>
        </>
      ) : null}
    </Stack>
  )
}
