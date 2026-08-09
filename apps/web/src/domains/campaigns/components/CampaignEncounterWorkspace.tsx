import {
  Accordion,
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Menu,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Tooltip
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconDotsVertical, IconTrash } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useEffect, useState } from 'react'
import type {
  EncounterCommandInputDto,
  EncounterGmActorDto,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import type { CampaignDetailDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { getCharacterSheet } from '#app/data/characters/queries'
import { getEncounterTimeline } from '#app/data/encounters/queries'
import { queryKeys } from '#app/lib/queryKeys'
import { AuthoredDetailProse } from '#components/AuthoredDetail'
import { CharacterSheetView } from '#domains/characters/sheet/core/CharacterSheetView'
import { CharacterSheetResourceStepper } from '#domains/characters/sheet/shared/CharacterSheetResourceStepper'
import * as styles from '../campaigns.css'

type EncounterCommandPayload = EncounterCommandInputDto extends infer Command
  ? Command extends EncounterCommandInputDto
    ? Omit<Command, 'encounterId' | 'commandId' | 'expectedVersion'>
    : never
  : never

export function CampaignEncounterWorkspace({
  campaign,
  currentUserId,
  encounter,
  sessionOpen,
  onUpdated
}: {
  campaign: CampaignDetailDto
  currentUserId: string
  encounter: EncounterGmProjectionDto
  sessionOpen: boolean
  onUpdated: (encounter: EncounterGmProjectionDto) => void
}) {
  const queryClient = useQueryClient()
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false)
  const [removeActorId, setRemoveActorId] = useState<string | null>(null)
  const [round, setRound] = useState(encounter.round)
  const timeline = useQuery(getEncounterTimeline(encounter.id))
  const [openedActorId, setOpenedActorId] = useState<string | null>(
    encounter.currentActorId ??
      encounter.actors.find((actor) => actor.initiative === null)?.id ??
      null
  )
  const command = useMutation({
    mutationFn: (input: EncounterCommandInputDto) => api.encounters.command(input),
    onSuccess: (result) => {
      const updated = result.projection
      if (result.roll) {
        notifications.show({
          color: 'orange',
          title: `${result.roll.characterLabel ?? 'Enemy'} · ${result.roll.source.label}`,
          message: `Rolled ${result.roll.evidence.total}`
        })
      }
      queryClient.setQueryData(
        queryKeys.encounters.list(campaign.id),
        (current: Array<EncounterGmProjectionDto> | undefined) =>
          current?.map((candidate) =>
            candidate.id === updated.id && candidate.version <= updated.version
              ? updated
              : candidate
          )
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.encounters.timeline(encounter.id) })
      setCompleteConfirmOpen(false)
      setRemoveActorId(null)
      onUpdated(updated)
    }
  })
  const canManage = campaign.role === 'OWNER' && campaign.status === 'ACTIVE' && sessionOpen
  const readOnly = !canManage || encounter.status === 'COMPLETED'
  const actorToRemove = encounter.actors.find((actor) => actor.id === removeActorId) ?? null
  const commandWithVersion = (payload: EncounterCommandPayload) =>
    command.mutate({
      ...payload,
      encounterId: encounter.id,
      commandId: crypto.randomUUID(),
      expectedVersion: encounter.version
    } as EncounterCommandInputDto)
  const missingInitiative = encounter.actors.some((actor) => actor.initiative === null)

  function commitRound() {
    if (readOnly || encounter.status !== 'ACTIVE' || round === encounter.round) return
    commandWithVersion({ type: 'SET_ROUND', round })
  }

  useEffect(() => {
    if (encounter.status === 'ACTIVE' && encounter.currentActorId) {
      setOpenedActorId(encounter.currentActorId)
      return
    }
    if (encounter.status !== 'PREPARED') return

    setOpenedActorId((current) => {
      const openedActor = encounter.actors.find((actor) => actor.id === current)
      if (openedActor?.initiative === null) return current
      return encounter.actors.find((actor) => actor.initiative === null)?.id ?? current
    })
  }, [encounter.actors, encounter.currentActorId, encounter.status])

  useEffect(() => setRound(encounter.round), [encounter.round])

  return (
    <section className={styles.encounterManager} aria-labelledby='encounter-manager-title'>
      <Group align='flex-start' justify='space-between' wrap='wrap'>
        <div id='encounter-manager-title'>
          <Group align='end' gap='xs'>
            {encounter.status === 'ACTIVE' && canManage ? (
              <NumberInput
                className={styles.encounterRoundField}
                classNames={{ input: styles.input }}
                disabled={command.isPending}
                label='Round'
                min={1}
                value={round}
                onChange={(value) => setRound(Math.max(1, Number(value) || 1))}
                onBlur={commitRound}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                }}
              />
            ) : (
              <Text c='dimmed' size='sm'>
                Round {encounter.round}
              </Text>
            )}
            <Text c='dimmed' pb={encounter.status === 'ACTIVE' && canManage ? 7 : 0} size='sm'>
              · {encounter.actors.length}{' '}
              {encounter.actors.length === 1 ? 'combatant' : 'combatants'}
            </Text>
          </Group>
        </div>
        {canManage && encounter.status === 'PREPARED' ? (
          <Button
            disabled={
              readOnly || missingInitiative || encounter.actors.length === 0 || command.isPending
            }
            onClick={() => commandWithVersion({ type: 'START' })}
          >
            Start encounter
          </Button>
        ) : canManage && encounter.status === 'ACTIVE' ? (
          <Group align='flex-end' gap='xs'>
            <Select
              className={styles.encounterTurnSelect}
              classNames={{ input: styles.input }}
              data={encounter.actors.map((actor) => ({ label: actor.label, value: actor.id }))}
              disabled={command.isPending}
              label='Current turn'
              value={encounter.currentActorId}
              onChange={(actorId) => commandWithVersion({ type: 'SET_CURRENT_ACTOR', actorId })}
            />
            <Button
              className={styles.encounterTurnButton}
              disabled={command.isPending}
              variant='default'
              onClick={() => commandWithVersion({ type: 'PREVIOUS_TURN' })}
            >
              Previous turn
            </Button>
            <Button
              className={styles.encounterTurnButton}
              disabled={command.isPending}
              onClick={() => commandWithVersion({ type: 'ADVANCE_TURN' })}
            >
              Next turn
            </Button>
            <Menu position='bottom-end' withinPortal>
              <Menu.Target>
                <ActionIcon
                  aria-label='Encounter actions'
                  disabled={command.isPending}
                  size='lg'
                  variant='subtle'
                >
                  <IconDotsVertical aria-hidden size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item color='red' onClick={() => setCompleteConfirmOpen(true)}>
                  Complete encounter
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        ) : null}
      </Group>
      {encounter.status === 'PREPARED' && missingInitiative ? (
        <Text c='dimmed' size='sm'>
          Roll or enter initiative for each combatant to start.
        </Text>
      ) : null}
      {command.error ? (
        <Alert color='red'>The Encounter couldn’t be updated. Try that action again.</Alert>
      ) : null}
      <Accordion value={openedActorId} variant='separated' onChange={setOpenedActorId}>
        {encounter.actors.map((actor) => (
          <Accordion.Item
            className={styles.encounterActorItem}
            data-current={encounter.currentActorId === actor.id || undefined}
            key={actor.id}
            value={actor.id}
          >
            <Group className={styles.encounterActorHeader} gap={0} wrap='nowrap'>
              <Accordion.Control className={styles.encounterActorControl}>
                <Group justify='space-between' pr='sm'>
                  <Group gap='xs'>
                    <Text fw={encounter.currentActorId === actor.id ? 700 : 600}>
                      {actor.label}
                    </Text>
                    {encounter.currentActorId === actor.id ? (
                      <Badge color='orange' variant='light'>
                        Current turn
                      </Badge>
                    ) : null}
                  </Group>
                  <Text c='dimmed' size='sm'>
                    {actor.initiative === null
                      ? 'Initiative not set'
                      : `Initiative ${actor.initiative}`}{' '}
                    · {actor.kind === 'CHARACTER' ? 'Character' : 'Enemy'}
                  </Text>
                </Group>
              </Accordion.Control>
              {actor.kind !== 'CHARACTER' && !readOnly ? (
                <Tooltip label={`Remove ${actor.label}`}>
                  <ActionIcon
                    aria-label={`Remove ${actor.label}`}
                    color='red'
                    disabled={command.isPending}
                    mr='sm'
                    variant='subtle'
                    onClick={() => setRemoveActorId(actor.id)}
                  >
                    <IconTrash aria-hidden size={17} />
                  </ActionIcon>
                </Tooltip>
              ) : null}
            </Group>
            <Accordion.Panel>
              <EncounterActorCard
                actor={actor}
                campaign={campaign}
                currentUserId={currentUserId}
                disabled={readOnly || command.isPending}
                onCommand={commandWithVersion}
              />
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
      <EncounterReminders
        disabled={readOnly || command.isPending}
        encounter={encounter}
        onCommand={commandWithVersion}
      />
      <Accordion variant='contained'>
        <Accordion.Item value='history'>
          <Accordion.Control>Encounter history</Accordion.Control>
          <Accordion.Panel>
            {timeline.isPending ? <Text c='dimmed'>Loading history…</Text> : null}
            {timeline.error ? <Alert color='red'>History couldn’t be loaded.</Alert> : null}
            {timeline.data?.entries.some((entry) => entry.roll === null) ? (
              <Stack gap='xs'>
                {timeline.data.entries
                  .filter((entry) => entry.roll === null)
                  .slice(0, 12)
                  .map((entry) => (
                    <Group
                      className={styles.encounterTimelineRow}
                      justify='space-between'
                      key={entry.id}
                    >
                      <Text fw={600} size='sm'>
                        {encounterCommandLabel(entry.commandType)}
                      </Text>
                      <Text c='dimmed' size='xs'>
                        {new Date(entry.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Text>
                    </Group>
                  ))}
              </Stack>
            ) : !timeline.isPending && !timeline.error ? (
              <Text c='dimmed'>No Encounter changes recorded yet.</Text>
            ) : null}
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
      <Modal
        centered
        opened={actorToRemove !== null}
        title='Remove enemy?'
        onClose={() => setRemoveActorId(null)}
      >
        <Stack gap='md'>
          <Text>
            Remove {actorToRemove?.label} from this Encounter? Its prior actions remain in the
            Encounter timeline.
          </Text>
          <Group justify='flex-end'>
            <Button variant='default' onClick={() => setRemoveActorId(null)}>
              Keep enemy
            </Button>
            <Button
              color='red'
              loading={command.isPending}
              onClick={() => {
                if (actorToRemove) {
                  commandWithVersion({ type: 'REMOVE_ACTOR', actorId: actorToRemove.id })
                }
              }}
            >
              Remove enemy
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        centered
        opened={completeConfirmOpen}
        title='Complete encounter?'
        onClose={() => setCompleteConfirmOpen(false)}
      >
        <Stack gap='md'>
          <Text>
            Complete {encounter.name} when combat is over. Its combatants and turn history will
            become read-only.
          </Text>
          <Group justify='flex-end'>
            <Button variant='default' onClick={() => setCompleteConfirmOpen(false)}>
              Keep running
            </Button>
            <Button
              color='red'
              loading={command.isPending}
              onClick={() => commandWithVersion({ type: 'COMPLETE' })}
            >
              Complete encounter
            </Button>
          </Group>
        </Stack>
      </Modal>
    </section>
  )
}

function EncounterReminders({
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
    <section className={styles.encounterReminders} aria-labelledby='encounter-reminders-title'>
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
              className={styles.encounterReminderRow}
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
        <Stack className={styles.encounterReminderEditor} gap='sm'>
          <TextInput
            classNames={{ input: styles.input }}
            label='Reminder'
            value={label}
            onChange={(event) => setLabel(event.currentTarget.value)}
          />
          <Group align='end' grow wrap='wrap'>
            <Select
              classNames={{ input: styles.input }}
              data={[
                { label: 'Start of round', value: 'ROUND_START' },
                { label: 'End of round', value: 'ROUND_END' },
                { label: 'Specific round', value: 'ROUND_NUMBER' },
                { label: 'Start of turn', value: 'TURN_START' },
                { label: 'End of turn', value: 'TURN_END' }
              ]}
              label='When'
              value={timing}
              onChange={(value) => value && setTiming(value as typeof timing)}
            />
            {timing === 'ROUND_NUMBER' ? (
              <NumberInput
                classNames={{ input: styles.input }}
                label='Round'
                min={1}
                value={reminderRound}
                onChange={(value) => setReminderRound(Math.max(1, Number(value) || 1))}
              />
            ) : null}
            {timing === 'TURN_START' || timing === 'TURN_END' ? (
              <Select
                classNames={{ input: styles.input }}
                data={encounter.actors.map((actor) => ({ label: actor.label, value: actor.id }))}
                label='Combatant'
                value={actorId}
                onChange={setActorId}
              />
            ) : null}
          </Group>
          <Textarea
            classNames={{ input: styles.input }}
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

function EncounterActorCard({
  actor,
  campaign,
  currentUserId,
  disabled,
  onCommand
}: {
  actor: EncounterGmActorDto
  campaign: CampaignDetailDto
  currentUserId: string
  disabled: boolean
  onCommand: (payload: EncounterCommandPayload) => void
}) {
  const [initiative, setInitiative] = useState(actor.initiative ?? 0)
  const [currentHitPoints, setCurrentHitPoints] = useState(actor.currentHitPoints)
  const [tempHitPoints, setTempHitPoints] = useState(actor.tempHitPoints)
  const [isPublic, setIsPublic] = useState(actor.public)
  const [notes, setNotes] = useState(actor.gmNotes ?? '')
  const [rollVisibility, setRollVisibility] = useState<'PRIVATE' | 'TABLE'>('PRIVATE')
  const [sheetOpened, setSheetOpened] = useState(false)
  const sheet = useQuery({
    ...getCharacterSheet(actor.sourceId ?? ''),
    enabled: actor.kind === 'CHARACTER' && sheetOpened && Boolean(actor.sourceId)
  })

  useEffect(() => {
    setInitiative(actor.initiative ?? 0)
    setCurrentHitPoints(actor.currentHitPoints)
    setTempHitPoints(actor.tempHitPoints)
    setIsPublic(actor.public)
    setNotes(actor.gmNotes ?? '')
  }, [actor])

  function commitInitiative() {
    if (disabled || initiative === actor.initiative) return
    onCommand({ type: 'SET_INITIATIVE', actorId: actor.id, initiative })
  }

  function commitEnemyState(
    next: Partial<{
      currentHitPoints: number
      tempHitPoints: number
      isPublic: boolean
      notes: string
    }> = {}
  ) {
    if (disabled || actor.kind === 'CHARACTER') return

    const updated = {
      currentHitPoints: next.currentHitPoints ?? currentHitPoints,
      tempHitPoints: next.tempHitPoints ?? tempHitPoints,
      isPublic: next.isPublic ?? isPublic,
      notes: next.notes ?? notes
    }
    if (
      updated.currentHitPoints === actor.currentHitPoints &&
      updated.tempHitPoints === actor.tempHitPoints &&
      updated.isPublic === actor.public &&
      updated.notes === (actor.gmNotes ?? '')
    ) {
      return
    }

    onCommand({
      type: 'UPDATE_ACTOR',
      actorId: actor.id,
      currentHitPoints: updated.currentHitPoints,
      tempHitPoints: updated.tempHitPoints,
      gmNotes: updated.notes || null,
      public: updated.isPublic
    })
  }

  return (
    <Stack gap='sm'>
      <Group className={styles.encounterActorControls} align='end' wrap='wrap'>
        {actor.kind !== 'CHARACTER' ? (
          <Button
            disabled={disabled}
            onClick={() => onCommand({ type: 'ROLL_ACTOR_INITIATIVE', actorId: actor.id })}
          >
            Roll initiative
          </Button>
        ) : null}
        <NumberInput
          className={styles.encounterNumericField}
          classNames={{ input: styles.input }}
          disabled={disabled}
          label='Initiative'
          value={initiative}
          onChange={(value) => setInitiative(Number(value) || 0)}
          onBlur={commitInitiative}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
        {actor.kind !== 'CHARACTER' ? (
          <>
            <NumberInput
              className={styles.encounterNumericField}
              classNames={{ input: styles.input }}
              disabled={disabled}
              label='Current HP'
              min={0}
              value={currentHitPoints}
              onChange={(value) => setCurrentHitPoints(Number(value) || 0)}
              onBlur={() => commitEnemyState()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
            />
            <NumberInput
              className={styles.encounterNumericField}
              classNames={{ input: styles.input }}
              disabled={disabled}
              label='Temp HP'
              min={0}
              value={tempHitPoints}
              onChange={(value) => setTempHitPoints(Number(value) || 0)}
              onBlur={() => commitEnemyState()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
            />
            <Switch
              className={styles.encounterVisibility}
              checked={!isPublic}
              disabled={disabled}
              label='Hidden'
              onChange={(event) => {
                const nextIsPublic = !event.currentTarget.checked
                setIsPublic(nextIsPublic)
                commitEnemyState({ isPublic: nextIsPublic })
              }}
            />
          </>
        ) : null}
        {actor.kind === 'CHARACTER' ? (
          <Button disabled={!actor.sourceId} variant='default' onClick={() => setSheetOpened(true)}>
            View Sheet
          </Button>
        ) : null}
      </Group>
      {actor.kind !== 'CHARACTER' ? (
        <>
          {actor.statBlock ? <EncounterEnemyStatBlock actor={actor} /> : null}
          {actor.features.length ? (
            <Stack gap='xs'>
              <Group align='center' justify='space-between' wrap='wrap'>
                <Text fw={700} size='sm'>
                  Actions & traits
                </Text>
                <SegmentedControl
                  aria-label='Enemy roll destination'
                  data={[
                    { label: 'Private', value: 'PRIVATE' },
                    { label: 'Table', value: 'TABLE' }
                  ]}
                  size='xs'
                  value={rollVisibility}
                  onChange={(value) => setRollVisibility(value as typeof rollVisibility)}
                />
              </Group>
              <Accordion multiple variant='contained'>
                {actor.features.map((feature) => (
                  <Accordion.Item key={feature.id} value={feature.id}>
                    <Accordion.Control>
                      <Group gap='xs'>
                        <Text fw={600}>{feature.label}</Text>
                        <Badge color='gray' size='xs' variant='light'>
                          {encounterFeatureSectionLabel(feature)}
                        </Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap='sm'>
                        {feature.resource ? (
                          <div>
                            <CharacterSheetResourceStepper
                              decreaseDisabled={disabled || feature.resource.remaining <= 0}
                              decreaseLabel={`Use one ${feature.label} charge`}
                              increaseDisabled={disabled || feature.resource.used <= 0}
                              increaseLabel={`Restore one ${feature.label} charge`}
                              label={`${feature.label} charges`}
                              maximum={feature.resource.maximum}
                              remaining={feature.resource.remaining}
                              onDecrease={() =>
                                onCommand({
                                  type: 'ADJUST_FEATURE_RESOURCE',
                                  actorId: actor.id,
                                  featureId: feature.id,
                                  direction: 'USE',
                                  amount: 1
                                })
                              }
                              onIncrease={() =>
                                onCommand({
                                  type: 'ADJUST_FEATURE_RESOURCE',
                                  actorId: actor.id,
                                  featureId: feature.id,
                                  direction: 'RESTORE',
                                  amount: 1
                                })
                              }
                            />
                            <Text c='dimmed' mt={4} size='xs'>
                              Resets {feature.resource.resetKind.toLowerCase().replace('_', ' ')}
                            </Text>
                          </div>
                        ) : null}
                        {feature.rollDefinitions?.length ? (
                          <Group gap='xs'>
                            {feature.rollDefinitions.map((definition) => {
                              const lacksCharge =
                                Boolean(definition.chargeCost) &&
                                (!feature.resource ||
                                  feature.resource.remaining < (definition.chargeCost ?? 0))
                              return (
                                <Button
                                  disabled={disabled || lacksCharge}
                                  key={definition.id}
                                  size='compact-sm'
                                  variant='default'
                                  onClick={() =>
                                    onCommand({
                                      type: 'ROLL_ENEMY_ACTION',
                                      actorId: actor.id,
                                      featureId: feature.id,
                                      rollDefinitionId: definition.id,
                                      visibility: rollVisibility
                                    })
                                  }
                                >
                                  Roll {definition.label}
                                </Button>
                              )
                            })}
                          </Group>
                        ) : null}
                        <AuthoredDetailProse html={feature.description} fallback='' />
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            </Stack>
          ) : null}
          <Textarea
            classNames={{ input: styles.input }}
            disabled={disabled}
            label='GM notes'
            value={notes}
            onChange={(event) => setNotes(event.currentTarget.value)}
            onBlur={() => commitEnemyState()}
          />
        </>
      ) : null}
      <Modal
        fullScreen
        closeButtonProps={{ 'aria-label': 'Close Character Sheet' }}
        opened={sheetOpened}
        title={actor.label}
        onClose={() => setSheetOpened(false)}
      >
        {sheet.isPending ? <Loader size='sm' /> : null}
        {sheet.error ? (
          <Alert color='red'>The Character Sheet couldn’t be loaded. Close and try again.</Alert>
        ) : null}
        {sheet.data ? (
          <CharacterSheetView
            characterPublicId={
              campaign.memberships.find(
                (membership) => membership.assignedCharacter?.id === actor.sourceId
              )?.assignedCharacter?.publicId ??
              sheet.data.publicId ??
              actor.sourceId ??
              ''
            }
            currentUserId={currentUserId}
            hasDraft={Boolean(sheet.data.meta.hasBuilderDraft)}
            rollerName={sheet.data.identity.label}
            sheet={sheet.data}
          />
        ) : null}
      </Modal>
      {actor.kind === 'CHARACTER' ? (
        <Text c='dimmed' size='sm'>
          Character HP and conditions stay owned by the Character Sheet.
        </Text>
      ) : null}
      {campaign.role !== 'OWNER' ? (
        <Text c='dimmed' size='sm'>
          Encounter controls are available to the Campaign GM.
        </Text>
      ) : null}
    </Stack>
  )
}

function EncounterEnemyStatBlock({ actor }: { actor: EncounterGmActorDto }) {
  const statBlock = actor.statBlock
  if (!statBlock) return null
  const abilityScores = Object.entries(statBlock.abilityScores ?? {}).sort(
    ([left], [right]) => abilitySortIndex(left) - abilitySortIndex(right)
  )
  const defenses = [
    ['Vulnerable', statBlock.damageVulnerabilities],
    ['Resistant', statBlock.damageResistances],
    ['Immune', statBlock.damageImmunities],
    ['Condition immune', statBlock.conditionImmunities]
  ] as const

  return (
    <section className={styles.encounterStatBlock} aria-label={`${actor.label} statistics`}>
      <dl className={styles.encounterStatSummary}>
        <div>
          <dt>Armor Class</dt>
          <dd>{statBlock.armorClass ?? '—'}</dd>
        </div>
        <div>
          <dt>Hit Points</dt>
          <dd>
            {actor.currentHitPoints} / {actor.maxHitPoints}
          </dd>
        </div>
        <div>
          <dt>Speed</dt>
          <dd>{formatSpeedList(statBlock.speeds)}</dd>
        </div>
        <div>
          <dt>Senses</dt>
          <dd>{formatTextList(statBlock.senses)}</dd>
        </div>
      </dl>
      {abilityScores.length ? (
        <dl className={styles.encounterAbilities}>
          {abilityScores.map(([ability, score]) => (
            <div key={ability}>
              <dt>{ability.slice(0, 3).toUpperCase()}</dt>
              <dd>
                <strong>{score}</strong>
                <span>{formatAbilityModifier(score)}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {defenses.some(([, values]) => values.length > 0) ? (
        <dl className={styles.encounterDefenseList}>
          {defenses.flatMap(([label, values]) =>
            values.length
              ? [
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{values.join(', ')}</dd>
                  </div>
                ]
              : []
          )}
        </dl>
      ) : null}
    </section>
  )
}

const abilityOrder = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']

function abilitySortIndex(ability: string): number {
  const index = abilityOrder.indexOf(ability.slice(0, 3).toUpperCase())
  return index === -1 ? abilityOrder.length : index
}

function formatAbilityModifier(score: number): string {
  const modifier = Math.floor((score - 10) / 2)
  return `(${modifier >= 0 ? '+' : ''}${modifier})`
}

function formatTextList(values: unknown[]): string {
  if (!values.length) return '—'
  return values.map(String).join(', ')
}

function formatSpeedList(values: unknown[]): string {
  if (!values.length) return '—'
  const speeds = values.flatMap((value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return []
    const speed = value as Record<string, unknown>
    const amount = speed.amount
    if (typeof amount !== 'number' && typeof amount !== 'string') return []
    const unit = speed.unit === 'FEET' ? 'ft.' : String(speed.unit ?? '').toLowerCase()
    return `${amount}${unit ? ` ${unit}` : ''}`
  })
  return speeds.length ? speeds.join(', ') : '—'
}

function encounterCommandLabel(commandType: string): string {
  if (commandType === 'ROLL_ACTOR_INITIATIVE') return 'Initiative rolled'
  if (commandType === 'SET_INITIATIVE') return 'Initiative updated'
  if (commandType === 'ADVANCE_TURN') return 'Turn advanced'
  if (commandType === 'PREVIOUS_TURN') return 'Turn moved back'
  if (commandType === 'SET_CURRENT_ACTOR') return 'Current turn corrected'
  if (commandType === 'SET_ROUND') return 'Round corrected'
  if (commandType === 'UPDATE_ACTOR') return 'Enemy updated'
  if (commandType === 'REMOVE_ACTOR') return 'Enemy removed'
  if (commandType === 'ADJUST_FEATURE_RESOURCE') return 'Feature charge changed'
  if (commandType === 'UPSERT_REMINDER') return 'Reminder updated'
  if (commandType === 'REMOVE_REMINDER') return 'Reminder removed'
  if (commandType === 'CREATE') return 'Encounter created'
  if (commandType === 'START') return 'Encounter started'
  if (commandType === 'COMPLETE') return 'Encounter completed'
  return commandType.toLowerCase().replaceAll('_', ' ')
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

function encounterFeatureSectionLabel(feature: EncounterGmActorDto['features'][number]) {
  const section = feature.section
  if (section === 'BONUS_ACTION') return 'Bonus action'
  if (section === 'LEGENDARY_ACTION') return 'Legendary action'
  if (section === 'LAIR_ACTION') return 'Lair action'
  if (section === 'REGIONAL_EFFECT') return 'Regional effect'
  if (section === 'REACTION') return 'Reaction'
  if (section === 'ACTION') return 'Action'
  if (feature.rollDefinitions?.length) return 'Action'
  return 'Feature'
}
