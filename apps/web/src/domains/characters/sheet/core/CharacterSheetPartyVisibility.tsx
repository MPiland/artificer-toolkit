import { ActionIcon, Popover, SegmentedControl, Stack, Switch, Text } from '@mantine/core'
import { Users } from 'lucide-react'
import {
  healthDisplayLevelDtoSchema,
  type CharacterPartyVisibilityDto
} from '@artificer-toolkit/schema/api/healthDisplay'
import { healthDisplayLevelOptions } from '#domains/campaigns/healthDisplay'
import type { SubmitSheetCommand } from './CharacterSheet.types'

/** What the Character's own player shares with the party; changes persist immediately. */
export function CharacterSheetPartyVisibility({
  expectedVersion,
  pending,
  submitCommand,
  visibility
}: {
  expectedVersion: number
  pending: boolean
  submitCommand: SubmitSheetCommand
  visibility: CharacterPartyVisibilityDto
}) {
  function update(next: Partial<CharacterPartyVisibilityDto>) {
    void submitCommand({
      type: 'SET_PARTY_VISIBILITY',
      expectedVersion,
      visibility: { ...visibility, ...next }
    })
  }

  return (
    <Popover position='bottom-end' shadow='none' width={320} withinPortal>
      <Popover.Target>
        <ActionIcon aria-label='What the party sees' size='lg' variant='default'>
          <Users aria-hidden size={18} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap='md'>
          <Switch
            checked={visibility.sheet}
            description='Other players can read your Sheet. Personality and background stay private.'
            disabled={pending}
            label='Party can view'
            onChange={(event) => update({ sheet: event.currentTarget.checked })}
          />
          <Stack gap={4}>
            <Text fw={600} id='party-health-display-label' size='sm'>
              Show my health to the party
            </Text>
            <SegmentedControl
              aria-labelledby='party-health-display-label'
              data={healthDisplayLevelOptions}
              disabled={pending}
              fullWidth
              size='xs'
              value={visibility.health}
              onChange={(value) => update({ health: healthDisplayLevelDtoSchema.parse(value) })}
            />
            <Text c='dimmed' size='xs'>
              The GM always sees your exact hit points.
            </Text>
          </Stack>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}
