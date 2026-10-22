import {
  ActionIcon,
  Badge,
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip
} from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import type { EncounterGmProjectionDto } from '@artificer-toolkit/schema/api/encounters'
import { findOption } from '../../../forms/utils/valueGuards'
import * as sharedStyles from '../campaigns.css'
import * as encounterStyles from './encounter.css'
import type { EncounterCommandPayload } from './encounterWorkspace.types'

const reminderTimings = [
  'ROUND_START',
  'ROUND_END',
  'ROUND_NUMBER',
  'TURN_START',
  'TURN_END'
] as const

export function EncounterReminders({
  disabled,
  encounter,
  onCommand
}: {
  disabled: boolean
  encounter: EncounterGmProjectionDto
  onCommand: (payload: EncounterCommandPayload) => void
}) {
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [timing, setTiming] = useState<
    'ROUND_START' | 'ROUND_END' | 'ROUND_NUMBER' | 'TURN_START' | 'TURN_END'
  >('ROUND_START')
  const [reminderRound, setReminderRound] = useState(encounter.round || 1)
  const [actorId, setActorId] = useState<string | null>(encounter.currentActorId)
  const [notes, setNotes] = useState('')

  function addReminder() {
    if (!label.trim()) return
    onCommand({
      type: 'UPSERT_REMINDER',
      reminder: {
        label: label.trim(),
        timing,
        round: timing === 'ROUND_NUMBER' ? reminderRound : null,
        actorId: timing === 'TURN_START' || timing === 'TURN_END' ? actorId : null,
        public: false,
        notes: notes.trim() || null,
        order: encounter.reminders.length
      }
    })
    setLabel('')
    setNotes('')
    setAdding(false)
  }

  return (
    <section
      className={encounterStyles.encounterReminders}
      aria-labelledby='encounter-reminders-title'
    >
      <Group align='flex-start' justify='space-between'>
        <div>
          <Text fw={700} id='encounter-reminders-title'>
            Reminders
          </Text>
          <Text c='dimmed' size='sm'>
            Passive cues for rounds, turns, hazards, lair actions, and chase beats.
          </Text>
        </div>
        {!disabled && !adding ? (
          <Button size='compact-sm' variant='subtle' onClick={() => setAdding(true)}>
            Add reminder
          </Button>
        ) : null}
      </Group>
      {encounter.reminders.length ? (
        <Stack gap='xs'>
          {encounter.reminders.map((reminder) => (
            <Group
              className={encounterStyles.encounterReminderRow}
              justify='space-between'
              key={reminder.id}
            >
              <div>
                <Group gap='xs'>
                  <Text fw={600}>{reminder.label}</Text>
                  {isReminderDue(reminder, encounter) ? (
                    <Badge color='orange' size='xs'>
                      Due
                    </Badge>
                  ) : null}
                </Group>
                <Text c='dimmed' size='xs'>
                  {reminderTimingLabel(reminder, encounter)}
                </Text>
              </div>
              {!disabled ? (
                <Tooltip label={`Remove ${reminder.label}`}>
                  <ActionIcon
                    aria-label={`Remove ${reminder.label}`}
                    color='red'
                    variant='subtle'
                    onClick={() => onCommand({ type: 'REMOVE_REMINDER', reminderId: reminder.id })}
                  >
                    <IconTrash aria-hidden size={16} />
                  </ActionIcon>
                </Tooltip>
              ) : null}
            </Group>
          ))}
        </Stack>
      ) : (
        <Text c='dimmed' size='sm'>
          No reminders for this Encounter.
        </Text>
      )}
      {adding ? (
        <Stack className={encounterStyles.encounterReminderEditor} gap='sm'>
          <TextInput
            classNames={{ input: sharedStyles.input }}
            label='Reminder'
            value={label}
            onChange={(event) => setLabel(event.currentTarget.value)}
          />
          <Group align='end' grow wrap='wrap'>
            <Select
              classNames={{ input: sharedStyles.input }}
              data={[
                { label: 'Start of round', value: 'ROUND_START' },
                { label: 'End of round', value: 'ROUND_END' },
                { label: 'Specific round', value: 'ROUND_NUMBER' },
                { label: 'Start of turn', value: 'TURN_START' },
                { label: 'End of turn', value: 'TURN_END' }
              ]}
              label='When'
              value={timing}
              onChange={(value) => setTiming(findOption(reminderTimings, value) ?? timing)}
            />
            {timing === 'ROUND_NUMBER' ? (
              <NumberInput
                classNames={{ input: sharedStyles.input }}
                label='Round'
                min={1}
                value={reminderRound}
                onChange={(value) => setReminderRound(Math.max(1, Number(value) || 1))}
              />
            ) : null}
            {timing === 'TURN_START' || timing === 'TURN_END' ? (
              <Select
                classNames={{ input: sharedStyles.input }}
                data={encounter.actors.map((actor) => ({ label: actor.label, value: actor.id }))}
                label='Combatant'
                value={actorId}
                onChange={setActorId}
              />
            ) : null}
          </Group>
          <Textarea
            classNames={{ input: sharedStyles.input }}
            label='Notes (optional)'
            value={notes}
            onChange={(event) => setNotes(event.currentTarget.value)}
          />
          <Group justify='flex-end'>
            <Button variant='subtle' onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !label.trim() || ((timing === 'TURN_START' || timing === 'TURN_END') && !actorId)
              }
              onClick={addReminder}
            >
              Add reminder
            </Button>
          </Group>
        </Stack>
      ) : null}
    </section>
  )
}

function isReminderDue(
  reminder: EncounterGmProjectionDto['reminders'][number],
  encounter: EncounterGmProjectionDto
): boolean {
  if (encounter.status !== 'ACTIVE') return false
  if (reminder.timing === 'ROUND_NUMBER') return reminder.round === encounter.round
  if (reminder.timing === 'TURN_START' || reminder.timing === 'TURN_END') {
    return reminder.actorId === encounter.currentActorId
  }
  const currentIndex = encounter.actors.findIndex((actor) => actor.id === encounter.currentActorId)
  if (reminder.timing === 'ROUND_START') return currentIndex === 0
  return currentIndex === encounter.actors.length - 1
}

function reminderTimingLabel(
  reminder: EncounterGmProjectionDto['reminders'][number],
  encounter: EncounterGmProjectionDto
): string {
  if (reminder.timing === 'ROUND_START') return 'Start of each round'
  if (reminder.timing === 'ROUND_END') return 'End of each round'
  if (reminder.timing === 'ROUND_NUMBER') return `Round ${reminder.round}`
  const actor = encounter.actors.find((candidate) => candidate.id === reminder.actorId)
  return `${reminder.timing === 'TURN_START' ? 'Start' : 'End'} of ${actor?.label ?? 'combatant'}’s turn`
}
