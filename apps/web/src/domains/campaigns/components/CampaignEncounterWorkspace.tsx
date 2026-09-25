import {
  Accordion,
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Menu,
  Modal,
  NumberInput,
  Select,
  Stack,
  Text,
  Tooltip
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { IconChevronDown, IconChevronUp, IconDotsVertical, IconTrash } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useConvex } from 'convex/react'
import { useEffect, useState } from 'react'
import {
  encounterGmProjectionDtoSchema,
  type EncounterCommandInputDto,
  type EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { getEncounterTimeline } from '#app/data/encounters/queries'
import { useSystemList } from '#app/data/systems/useSystemList'
import { queryKeys } from '#app/lib/queryKeys'
import * as sharedStyles from '../campaigns.css'
import * as encounterStyles from './encounter.css'
import { EncounterActorCard } from './EncounterActorCard'
import { EncounterReinforcement } from './EncounterReinforcement'
import { CampaignEncounterDecision } from './CampaignEncounterDecision'
import { EncounterReminders } from './EncounterReminders'
import { useCampaignLiveSession } from '../vtt/useCampaignLiveSession'
import type { EncounterCommandPayload } from './encounterWorkspace.types'

export function CampaignEncounterWorkspace({
  campaign,
  currentUserId,
  encounter,
  onUpdated
}: {
  campaign: CampaignDetailDto
  currentUserId: string
  encounter: EncounterGmProjectionDto
  onUpdated: (encounter: EncounterGmProjectionDto) => void
}) {
  const queryClient = useQueryClient()
  const convex = useConvex()
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false)
  const [reinforceOpen, setReinforceOpen] = useState(false)
  const [removeActorId, setRemoveActorId] = useState<string | null>(null)
  const [rulesetSystemId, setRulesetSystemId] = useState<string | null>(null)
  const [round, setRound] = useState(encounter.round)
  const timeline = useQuery(getEncounterTimeline(encounter.id, convex))
  const needsExplicitSystem =
    encounter.status === 'PREPARED' &&
    encounter.rulePackRevisionId === null &&
    encounter.actors.every((actor) => actor.systemId === null)
  const canManage = campaign.role === 'OWNER' && campaign.status === 'ACTIVE'
  const systems = useSystemList(needsExplicitSystem && canManage)
  const [openedActorId, setOpenedActorId] = useState<string | null>(
    encounter.currentActorId ??
      encounter.actors.find((actor) => actor.initiative === null)?.id ??
      null
  )
  const live = useCampaignLiveSession({
    campaignId: campaign.id,
    enabled: canManage && encounter.status !== 'COMPLETED'
  })
  const command = useMutation({
    mutationFn: live.sendEncounterCommand,
    onSuccess: (result) => {
      const updated = encounterGmProjectionDtoSchema.parse(result.projection)
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
      setReinforceOpen(false)
      onUpdated(updated)
    }
  })
  const readOnly = !canManage || encounter.status === 'COMPLETED'
  const commandBlocked = command.isPending || !live.commandReady
  const pendingDecision = useQuery({
    ...convexQuery(convexApi.encounters.pendingReads.pendingRuleOccurrence, {
      encounterId: encounter.id
    }),
    enabled: !readOnly
  })
  const needsSideOrder =
    !readOnly &&
    encounter.status === 'ACTIVE' &&
    encounter.initiativePolicy?.procedure === 'SIDE_ROLL'
  const actorSides = useQuery({
    ...convexQuery(convexApi.encounters.projectionReads.actorSides, {
      encounterId: encounter.id,
      expectedVersion: encounter.version
    }),
    enabled: needsSideOrder
  })
  const sideByActor = new Map(
    actorSides.data?.actors.map((actor) => [actor.id, actor.sideId]) ?? []
  )
  const structureDisabled =
    commandBlocked ||
    pendingDecision.isPending ||
    Boolean(pendingDecision.error) ||
    pendingDecision.data !== null ||
    (needsSideOrder &&
      (Boolean(actorSides.error) || actorSides.data?.version !== encounter.version))
  const currentActorIndex = encounter.actors.findIndex(
    (actor) => actor.id === encounter.currentActorId
  )
  const actorToRemove = encounter.actors.find((actor) => actor.id === removeActorId) ?? null
  const commandWithVersion = (payload: EncounterCommandPayload) =>
    command.mutate({
      ...payload,
      encounterId: encounter.id,
      commandId: crypto.randomUUID(),
      expectedVersion: encounter.version
    } as EncounterCommandInputDto)
  const missingInitiative = encounter.actors.some((actor) => actor.initiative === null)
  const requiresManualInitiative = encounter.automationMode === 'MANUAL'

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
  useEffect(() => setRulesetSystemId(null), [encounter.id])

  return (
    <section className={encounterStyles.encounterManager} aria-labelledby='encounter-manager-title'>
      <Group align='flex-start' justify='space-between' wrap='wrap'>
        <div id='encounter-manager-title'>
          <Group align='end' gap='xs'>
            {encounter.status === 'ACTIVE' && canManage ? (
              <NumberInput
                className={encounterStyles.encounterRoundField}
                classNames={{ input: sharedStyles.input }}
                disabled={commandBlocked}
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
        {canManage && encounter.status === 'PREPARED' && needsExplicitSystem ? (
          <Group align='end' gap='xs' wrap='wrap'>
            <Select
              className={encounterStyles.encounterTurnSelect}
              classNames={{ input: sharedStyles.input }}
              data={(systems.data ?? []).map((system) => ({
                label: `${system.label} · ${system.rulesetCode} ${system.rulesetVersion}`,
                value: system.id
              }))}
              disabled={systems.isPending || !systems.data?.length || commandBlocked}
              label='Game system'
              placeholder={systems.isPending ? 'Loading systems…' : 'Choose a system'}
              searchable
              value={rulesetSystemId}
              onChange={setRulesetSystemId}
            />
            <Button
              disabled={
                readOnly ||
                (requiresManualInitiative && missingInitiative) ||
                encounter.actors.length === 0 ||
                !rulesetSystemId ||
                commandBlocked
              }
              onClick={() =>
                rulesetSystemId && commandWithVersion({ type: 'START', systemId: rulesetSystemId })
              }
            >
              Start encounter
            </Button>
          </Group>
        ) : canManage && encounter.status === 'PREPARED' ? (
          <Button
            disabled={
              readOnly ||
              (requiresManualInitiative && missingInitiative) ||
              encounter.actors.length === 0 ||
              commandBlocked
            }
            onClick={() => commandWithVersion({ type: 'START' })}
          >
            Start encounter
          </Button>
        ) : canManage && encounter.status === 'ACTIVE' ? (
          <Group align='flex-end' gap='xs'>
            <Select
              className={encounterStyles.encounterTurnSelect}
              classNames={{ input: sharedStyles.input }}
              data={encounter.actors.map((actor) => ({ label: actor.label, value: actor.id }))}
              disabled={commandBlocked}
              label='Current turn'
              value={encounter.currentActorId}
              onChange={(actorId) => commandWithVersion({ type: 'SET_CURRENT_ACTOR', actorId })}
            />
            <Button
              className={encounterStyles.encounterTurnButton}
              disabled={commandBlocked}
              variant='default'
              onClick={() => commandWithVersion({ type: 'PREVIOUS_TURN' })}
            >
              Previous turn
            </Button>
            <Button
              className={encounterStyles.encounterTurnButton}
              disabled={commandBlocked}
              onClick={() => commandWithVersion({ type: 'ADVANCE_TURN' })}
            >
              Next turn
            </Button>
            <Menu position='bottom-end' withinPortal>
              <Menu.Target>
                <ActionIcon
                  aria-label='Encounter actions'
                  disabled={commandBlocked}
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
      {encounter.status === 'PREPARED' && requiresManualInitiative && missingInitiative ? (
        <Text c='dimmed' size='sm'>
          Roll or enter initiative for each combatant to start.
        </Text>
      ) : null}
      {encounter.status === 'PREPARED' ? (
        <CampaignEncounterDecision
          campaignId={campaign.id}
          canVoid={canManage}
          connected={live.commandReady}
          encounter={encounter}
          onResolved={(result) =>
            onUpdated(encounterGmProjectionDtoSchema.parse(result.projection))
          }
          sendCommand={live.sendEncounterCommand}
        />
      ) : null}
      {!readOnly && !live.commandReady ? (
        <Text c='dimmed' size='sm'>
          {live.error ?? 'Connecting to the table…'}
        </Text>
      ) : null}
      {command.error ? (
        <Alert color='red'>The Encounter couldn’t be updated. Try that action again.</Alert>
      ) : null}
      <Accordion value={openedActorId} variant='separated' onChange={setOpenedActorId}>
        {encounter.actors.map((actor, actorIndex) => (
          <Accordion.Item
            className={encounterStyles.encounterActorItem}
            data-current={encounter.currentActorId === actor.id || undefined}
            key={actor.id}
            value={actor.id}
          >
            <Group className={encounterStyles.encounterActorHeader} gap={0} wrap='nowrap'>
              <Accordion.Control className={encounterStyles.encounterActorControl}>
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
              {!readOnly && actorIndex > currentActorIndex ? (
                <Group gap={0} mr='xs' wrap='nowrap'>
                  <ActionIcon
                    aria-label={'Move ' + actor.label + ' earlier'}
                    disabled={
                      structureDisabled ||
                      actorIndex <= currentActorIndex + 1 ||
                      (needsSideOrder &&
                        sideByActor.get(actor.id) !==
                          sideByActor.get(encounter.actors[actorIndex - 1]?.id ?? ''))
                    }
                    variant='subtle'
                    onClick={() => {
                      const actorIds = encounter.actors.map((candidate) => candidate.id)
                      actorIds.splice(
                        actorIndex - 1,
                        2,
                        actorIds[actorIndex]!,
                        actorIds[actorIndex - 1]!
                      )
                      commandWithVersion({ type: 'REORDER', actorIds })
                    }}
                  >
                    <IconChevronUp aria-hidden size={17} />
                  </ActionIcon>
                  <ActionIcon
                    aria-label={'Move ' + actor.label + ' later'}
                    disabled={
                      structureDisabled ||
                      actorIndex === encounter.actors.length - 1 ||
                      (needsSideOrder &&
                        sideByActor.get(actor.id) !==
                          sideByActor.get(encounter.actors[actorIndex + 1]?.id ?? ''))
                    }
                    variant='subtle'
                    onClick={() => {
                      const actorIds = encounter.actors.map((candidate) => candidate.id)
                      actorIds.splice(
                        actorIndex,
                        2,
                        actorIds[actorIndex + 1]!,
                        actorIds[actorIndex]!
                      )
                      commandWithVersion({ type: 'REORDER', actorIds })
                    }}
                  >
                    <IconChevronDown aria-hidden size={17} />
                  </ActionIcon>
                </Group>
              ) : null}
              {actor.kind !== 'CHARACTER' && !readOnly ? (
                <Tooltip label={`Remove ${actor.label}`}>
                  <ActionIcon
                    aria-label={`Remove ${actor.label}`}
                    color='red'
                    disabled={commandBlocked}
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
                disabled={readOnly || commandBlocked}
                onCommand={commandWithVersion}
              />
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
      {!readOnly ? (
        <Button
          disabled={structureDisabled}
          variant='default'
          onClick={() => setReinforceOpen(true)}
        >
          Add enemy
        </Button>
      ) : null}
      <EncounterReinforcement
        disabled={readOnly || structureDisabled}
        opened={reinforceOpen}
        sideRoll={encounter.initiativePolicy?.procedure === 'SIDE_ROLL'}
        submitting={command.isPending}
        onClose={() => setReinforceOpen(false)}
        onCommand={commandWithVersion}
      />
      <EncounterReminders
        disabled={readOnly || commandBlocked}
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
                      className={encounterStyles.encounterTimelineRow}
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

function encounterCommandLabel(commandType: string): string {
  if (commandType === 'ROLL_ACTOR_INITIATIVE') return 'Initiative rolled'
  if (commandType === 'SET_INITIATIVE') return 'Initiative updated'
  if (commandType === 'ADVANCE_TURN') return 'Turn advanced'
  if (commandType === 'PREVIOUS_TURN') return 'Turn moved back'
  if (commandType === 'SET_CURRENT_ACTOR') return 'Current turn corrected'
  if (commandType === 'SET_ROUND') return 'Round corrected'
  if (commandType === 'UPDATE_ACTOR') return 'Enemy updated'
  if (commandType === 'REMOVE_ACTOR') return 'Enemy removed'
  if (commandType === 'REORDER') return 'Turn order updated'
  if (commandType === 'REINFORCE') return 'Enemy added'
  if (commandType === 'ADJUST_FEATURE_RESOURCE') return 'Feature charge changed'
  if (commandType === 'UPSERT_REMINDER') return 'Reminder updated'
  if (commandType === 'REMOVE_REMINDER') return 'Reminder removed'
  if (commandType === 'CREATE') return 'Encounter created'
  if (commandType === 'START') return 'Encounter started'
  if (commandType === 'COMPLETE') return 'Encounter completed'
  if (commandType === 'VOID_RULE_OCCURRENCE') return 'Voided by the GM'
  return commandType.toLowerCase().replaceAll('_', ' ')
}
