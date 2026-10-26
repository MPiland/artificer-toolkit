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
import { useMutation, useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { IconChevronDown, IconChevronUp, IconDotsVertical, IconTrash } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useMemo, useState } from 'react'
import {
  encounterGmProjectionDtoSchema,
  type EncounterCommandInputDto,
  type EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { healthDisplayLevelDtoSchema } from '@artificer-toolkit/schema/api/healthDisplay'
import { useSystemList } from '#app/data/systems/useSystemList'
import { AppSelect } from '#app/ui/primitives/Select'
import * as sharedStyles from '../campaigns.css'
import * as encounterStyles from './encounter.css'
import { EncounterActorCard } from './EncounterActorCard'
import { EncounterReinforcement } from './EncounterReinforcement'
import { CampaignEncounterDecision } from './CampaignEncounterDecision'
import { EncounterReminders } from './EncounterReminders'
import { EncounterClockAdvanceOffer } from './CampaignClock/EncounterClockAdvanceOffer'
import { readRoomEncounterRun } from '../vtt/roomEncounterRun'
import { useCampaignLiveSession } from '../vtt/useCampaignLiveSession'
import { useEncounterPendingDecision } from './useEncounterPendingDecision'
import { LiveSessionCommandRejectedError } from '../vtt/liveSessionClient'
import type { EncounterCommandPayload } from './encounterWorkspace.types'
import { healthDisplayLevelOptions } from '../healthDisplay'

export function CampaignEncounterWorkspace({
  campaign,
  currentUserId,
  encounter: storedEncounter,
  onUpdated
}: {
  campaign: CampaignDetailDto
  currentUserId: string
  /** The Run as Convex last stored it; the room's Run replaces it while the room holds it. */
  encounter: EncounterGmProjectionDto
  onUpdated: (encounter: EncounterGmProjectionDto) => void
}) {
  const canManage = campaign.capabilities.manageActiveCampaign
  const live = useCampaignLiveSession({
    campaignId: campaign.id,
    enabled: canManage && storedEncounter.status !== 'COMPLETED',
    encounterSession: { timeline: true }
  })
  const room = canManage ? readRoomEncounterRun(live.encounterSession, storedEncounter.id) : null
  const roomEncounter = room?.encounter
  const encounter = useMemo(
    () => (roomEncounter ? encounterGmProjectionDtoSchema.parse(roomEncounter) : storedEncounter),
    [roomEncounter, storedEncounter]
  )
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false)
  const [undoConfirmOpen, setUndoConfirmOpen] = useState(false)
  const [reinforceOpen, setReinforceOpen] = useState(false)
  const [removeActorId, setRemoveActorId] = useState<string | null>(null)
  const [rulesetSystemId, setRulesetSystemId] = useState<string | null>(null)
  const [round, setRound] = useState(encounter.round)
  const [completedRounds, setCompletedRounds] = useState<number | null>(null)
  const timeline =
    live.encounterSession?.state.encounter?.id === encounter.id
      ? live.encounterSession.timeline
      : null
  const needsExplicitSystem =
    encounter.status === 'PREPARED' && encounter.actors.every((actor) => actor.systemId === null)
  const systems = useSystemList(needsExplicitSystem && canManage)
  const [openedActorId, setOpenedActorId] = useState<string | null>(
    encounter.currentActorId ??
      encounter.actors.find((actor) => actor.initiative === null)?.id ??
      null
  )
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
      setCompleteConfirmOpen(false)
      setUndoConfirmOpen(false)
      setRemoveActorId(null)
      setReinforceOpen(false)
      if (updated.status === 'COMPLETED') setCompletedRounds(updated.round)
      onUpdated(updated)
    }
  })
  const readOnly = !canManage || encounter.status === 'COMPLETED'
  // Expected refusals (such as an undo that can't be exact) explain themselves; others stay generic.
  const commandError = command.error
    ? command.error instanceof LiveSessionCommandRejectedError && command.error.rejection.reason
      ? command.error.message
      : 'The Encounter couldn’t be updated. Try that action again.'
    : null
  const commandBlocked = command.isPending || !live.commandReady
  const pendingDecision = useEncounterPendingDecision(encounter.id, room, !readOnly)
  const needsSideOrder =
    !readOnly &&
    encounter.status === 'ACTIVE' &&
    encounter.initiativePolicy?.procedure === 'SIDE_ROLL'
  const roomActorSides = live.encounterSession?.actorSides ?? null
  const storedActorSides = useQuery(
    convexQuery(
      convexApi.encounters.projectionReads.actorSides,
      needsSideOrder && !roomActorSides
        ? { encounterId: encounter.id, expectedVersion: encounter.version }
        : 'skip'
    )
  )
  const actorSides = roomActorSides ? { data: roomActorSides, error: null } : storedActorSides
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

  const [openedActorSource, setOpenedActorSource] = useState({
    actors: encounter.actors,
    currentActorId: encounter.currentActorId,
    status: encounter.status
  })
  if (
    openedActorSource.actors !== encounter.actors ||
    openedActorSource.currentActorId !== encounter.currentActorId ||
    openedActorSource.status !== encounter.status
  ) {
    setOpenedActorSource({
      actors: encounter.actors,
      currentActorId: encounter.currentActorId,
      status: encounter.status
    })
    if (encounter.status === 'ACTIVE' && encounter.currentActorId) {
      setOpenedActorId(encounter.currentActorId)
    } else if (encounter.status === 'PREPARED') {
      const openedActor = encounter.actors.find((actor) => actor.id === openedActorId)
      if (openedActor?.initiative !== null) {
        setOpenedActorId(
          encounter.actors.find((actor) => actor.initiative === null)?.id ?? openedActorId
        )
      }
    }
  }
  const [syncedRound, setSyncedRound] = useState(encounter.round)
  if (syncedRound !== encounter.round) {
    setSyncedRound(encounter.round)
    setRound(encounter.round)
  }
  const [syncedEncounterId, setSyncedEncounterId] = useState(encounter.id)
  if (syncedEncounterId !== encounter.id) {
    setSyncedEncounterId(encounter.id)
    setRulesetSystemId(null)
  }

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
                <Menu.Item
                  onClick={() => {
                    command.reset()
                    setUndoConfirmOpen(true)
                  }}
                >
                  Undo last action
                </Menu.Item>
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
          canVoid={canManage}
          connected={live.commandReady}
          encounter={encounter}
          onResolved={(result) =>
            onUpdated(encounterGmProjectionDtoSchema.parse(result.projection))
          }
          pending={pendingDecision.data ?? null}
          readEncounter={live.readEncounter}
          room={live.encounterSession}
          sendCommand={live.sendEncounterCommand}
        />
      ) : null}
      {!readOnly && !live.commandReady ? (
        <Text c='dimmed' size='sm'>
          {live.error ?? 'Connecting to the table…'}
        </Text>
      ) : null}
      {commandError ? <Alert color='red'>{commandError}</Alert> : null}
      {completedRounds !== null ? (
        <EncounterClockAdvanceOffer
          campaignId={campaign.id}
          rounds={completedRounds}
          onClose={() => setCompletedRounds(null)}
        />
      ) : null}
      {!readOnly ? (
        <AppSelect
          allowDeselect={false}
          className={encounterStyles.encounterTurnSelect}
          data={healthDisplayLevelOptions}
          description='Players see enemies and NPCs at this level unless one is set below.'
          disabled={commandBlocked}
          label='Enemy health players see'
          searchable={false}
          value={encounter.healthDisplayDefault}
          onChange={(value) =>
            value &&
            commandWithVersion({
              type: 'SET_HEALTH_DISPLAY_DEFAULT',
              level: healthDisplayLevelDtoSchema.parse(value)
            })
          }
        />
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
                    {actor.defeated ? (
                      <Badge color='red' variant='light'>
                        {actor.kind === 'CHARACTER' ? 'Dead' : 'Defeated'}
                      </Badge>
                    ) : null}
                  </Group>
                  <Text c='dimmed' size='sm'>
                    {actor.absence === 'DEPARTED'
                      ? 'Departed'
                      : actor.absence === 'EFFECT' || actor.absence === 'EFFECT_KEEPS_TURN'
                        ? 'Out of play'
                        : actor.absence === 'GM_REMOVED'
                          ? 'Out of initiative'
                          : actor.initiative === null
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
              {actor.absence !== null && !readOnly ? (
                <Button
                  disabled={commandBlocked}
                  mr='sm'
                  size='compact-sm'
                  variant='default'
                  onClick={() =>
                    commandWithVersion({
                      type: 'UPDATE_ACTOR',
                      actorId: actor.id,
                      returnToInitiative: true
                    })
                  }
                >
                  Return to initiative
                </Button>
              ) : null}
            </Group>
            <Accordion.Panel>
              <EncounterActorCard
                actor={actor}
                campaign={campaign}
                currentUserId={currentUserId}
                disabled={readOnly || commandBlocked}
                encounterId={encounter.id}
                healthDisplayDefault={encounter.healthDisplayDefault}
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
            {timeline?.entries.some((entry) => entry.roll === null) ? (
              <Stack gap='xs'>
                {timeline.entries
                  .filter((entry) => entry.roll === null)
                  .slice(0, 12)
                  .map((entry) => (
                    <Group
                      className={encounterStyles.encounterTimelineRow}
                      justify='space-between'
                      key={entry.id}
                    >
                      <Stack gap={2}>
                        <Group gap='xs'>
                          <Text fw={600} size='sm'>
                            {entry.label ?? encounterCommandLabel(entry.commandType)}
                          </Text>
                          {entry.ruleOverrides.map((override) => (
                            <Badge color='orange' key={override.code} variant='light'>
                              Rule override: {override.message}
                            </Badge>
                          ))}
                        </Group>
                        {entry.issuerLines.map((line, index) => (
                          <Text key={`issuer-${index}`} size='sm'>
                            {line}
                          </Text>
                        ))}
                        {entry.gmLines.map((line, index) => (
                          <Group gap='xs' key={`gm-${index}`}>
                            <Badge color='gray' variant='light'>
                              GM only
                            </Badge>
                            <Text size='sm'>{line}</Text>
                          </Group>
                        ))}
                      </Stack>
                      <Text c='dimmed' size='xs'>
                        {new Date(entry.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Text>
                    </Group>
                  ))}
              </Stack>
            ) : (
              <Text c='dimmed'>No Encounter changes recorded yet.</Text>
            )}
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
        opened={undoConfirmOpen}
        title='Undo last action?'
        onClose={() => setUndoConfirmOpen(false)}
      >
        <Stack gap='md'>
          <Text>
            Restore everything the last action changed: hit points, conditions, resources, effects
            and its action. Undo can&apos;t be redone.
          </Text>
          {commandError ? <Alert color='red'>{commandError}</Alert> : null}
          <Group justify='flex-end'>
            <Button variant='default' onClick={() => setUndoConfirmOpen(false)}>
              Keep it
            </Button>
            <Button
              loading={command.isPending}
              onClick={() => commandWithVersion({ type: 'REVERT_LAST_ACTION' })}
            >
              Undo action
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
  if (commandType === 'UPDATE_ACTOR') return 'Combatant updated'
  if (commandType === 'SET_HEALTH_DISPLAY_DEFAULT') return 'Enemy health display changed'
  if (commandType === 'REMOVE_ACTOR') return 'Enemy removed'
  if (commandType === 'REORDER') return 'Turn order updated'
  if (commandType === 'REINFORCE') return 'Enemy added'
  if (commandType === 'ADJUST_FEATURE_RESOURCE') return 'Feature charge changed'
  if (commandType === 'CREATURE_REST') return 'Creatures rested'
  if (commandType === 'UPSERT_REMINDER') return 'Reminder updated'
  if (commandType === 'REMOVE_REMINDER') return 'Reminder removed'
  if (commandType === 'CREATE') return 'Encounter created'
  if (commandType === 'START') return 'Encounter started'
  if (commandType === 'COMPLETE') return 'Encounter completed'
  if (commandType === 'VOID_RULE_OCCURRENCE') return 'Voided by the GM'
  if (commandType === 'REVERT_LAST_ACTION') return 'Undone by the GM'
  if (commandType === 'SET_CONCEALMENT_OBSERVERS') return 'Concealment corrected by the GM'
  if (commandType === 'PLACE_ZONE') return 'Zone placed by the GM'
  if (commandType === 'MORALE_SAVE') return 'Morale checked'
  if (commandType === 'CONFIRM_MORALE') return 'Morale outcome confirmed'
  if (commandType === 'RESOLVE_CONSEQUENCE_ROLL_OFFER') return 'Table roll resolved'
  return commandType.toLowerCase().replaceAll('_', ' ')
}
