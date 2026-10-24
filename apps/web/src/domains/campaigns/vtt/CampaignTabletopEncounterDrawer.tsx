import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Drawer,
  Group,
  Select,
  Text,
  Tooltip
} from '@mantine/core'
import { useDisclosure, useWindowEvent } from '@mantine/hooks'
import { ListOrdered } from 'lucide-react'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { EncounterHeldRelationshipDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import type {
  EncounterCommandInputDto,
  EncounterCommandResultDto,
  EncounterGmProjectionDto,
  EncounterPlayerProjectionDto,
  ReleaseRelationshipInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  CampaignSceneStateDto,
  EncounterActorTokenBindingCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { ActiveGrantList } from '../../../components/activeGrants/ActiveGrantList'
import { CampaignTabletopConcealmentObservers } from './CampaignTabletopConcealmentObservers'
import { CampaignTabletopMorale } from './CampaignTabletopMorale'
import { CampaignTabletopReleases } from './CampaignTabletopReleases'
import { EncounterActorControlFields } from '../components/EncounterActorControlFields'
import { EncounterActorHealth } from './EncounterActorHealth'
import * as styles from './CampaignTabletopEncounterDrawer.css'
import {
  describeTargetEntry,
  orderActorsForTargeting,
  type VttTargetEntry
} from './vttTargeting.model'

/** A creature the map hides stays unlisted for players until the GM reveals it (ATTACK-17.3). */
const REVEAL_OPTIONS = [
  { label: 'Seen by the map', value: 'HIDDEN' },
  { label: 'Reveal unnamed', value: 'UNNAMED' },
  { label: 'Reveal named', value: 'NAMED' }
]

type LiveEncounterCommand = EncounterCommandInputDto | EncounterActorTokenBindingCommandInputDto

export function CampaignTabletopEncounterDrawer({
  actorIdByTokenId,
  connected,
  currentActorMine,
  encounter,
  holds,
  memberships,
  pending,
  role,
  scene,
  targeting = null,
  onCommand,
  onEndCharacterConcentration,
  onRelease
}: {
  actorIdByTokenId: ReadonlyMap<string, string>
  connected: boolean
  /** The viewer controls the actor whose turn it is (always true for the GM). */
  currentActorMine: boolean
  encounter: EncounterGmProjectionDto | EncounterPlayerProjectionDto
  /** The holds the viewer's creatures source, which each may release on any turn (D152). */
  holds: EncounterHeldRelationshipDto[]
  memberships: CampaignDetailDto['memberships']
  pending: boolean
  role: 'OWNER' | 'PLAYER'
  scene: CampaignSceneStateDto | null
  /**
   * While the caster picks a target, this list is the target list (ATTACK-17.2): nearest first,
   * open beside the map, and each listed creature is a button that picks it.
   */
  targeting?: {
    entries: readonly VttTargetEntry[]
    pickedActorId: string | null
    onCancel: () => void
    onPick: (actorId: string) => void
  } | null
  onCommand: (command: LiveEncounterCommand) => void
  /** A Character ends its Concentration with its Sheet command, not an Encounter command. */
  onEndCharacterConcentration: (characterId: string) => void
  onRelease: (command: ReleaseRelationshipInputDto) => Promise<EncounterCommandResultDto>
}) {
  const [opened, { close, open }] = useDisclosure(false)
  // Escape ends targeting only once every drawer's capture-phase Escape listener has seen the key:
  // ending it reopens the action drawer, which would otherwise close on that same key. An open
  // dropdown keeps its Escape, as it does from a Mantine drawer.
  useWindowEvent('keydown', (event) => {
    const fromOpenDropdown =
      event.target instanceof Element &&
      event.target.getAttribute('data-mantine-stop-propagation') === 'true'
    if (targeting && event.key === 'Escape' && !fromOpenDropdown) targeting.onCancel()
  })
  const controlsDisabled = !connected || pending
  const listedActors = targeting
    ? orderActorsForTargeting(encounter.actors, targeting.entries)
    : encounter.actors
  const targetEntries = new Map(targeting?.entries.map((entry) => [entry.actorId, entry]))

  function command(
    input:
      | { type: 'ADVANCE_TURN' }
      | { type: 'PREVIOUS_TURN' }
      | { actorId: string | null; type: 'SET_CURRENT_ACTOR' }
  ): void {
    onCommand({
      ...input,
      commandId: crypto.randomUUID(),
      encounterId: encounter.id,
      expectedVersion: encounter.version
    })
  }

  function bindActorToToken(actorId: string, tokenId: string | null): void {
    if (!scene) return
    onCommand(
      tokenId
        ? {
            actorId,
            commandId: crypto.randomUUID(),
            encounterId: encounter.id,
            expectedEncounterVersion: encounter.version,
            sceneId: scene.id,
            tokenId,
            type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING'
          }
        : {
            actorId,
            commandId: crypto.randomUUID(),
            encounterId: encounter.id,
            expectedEncounterVersion: encounter.version,
            sceneId: scene.id,
            type: 'REMOVE_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING'
          }
    )
  }

  return (
    <>
      <Tooltip label='Turn order'>
        <ActionIcon aria-label='Open turn order' size='lg' variant='default' onClick={open}>
          <ListOrdered aria-hidden size={18} />
        </ActionIcon>
      </Tooltip>
      <Drawer
        // The map stays clickable beside the list while targeting.
        closeButtonProps={{ 'aria-label': targeting ? 'Cancel targeting' : 'Close turn order' }}
        closeOnClickOutside={!targeting}
        closeOnEscape={!targeting}
        lockScroll={!targeting}
        opened={opened || targeting !== null}
        position='right'
        size='min(28rem, 100vw)'
        title={targeting ? 'Pick a target' : 'Turn order'}
        trapFocus={!targeting}
        withOverlay={!targeting}
        zIndex={400}
        onClose={targeting ? targeting.onCancel : close}
      >
        <div aria-busy={pending || undefined}>
          <div className={styles.summary}>
            <Group gap='xs' justify='space-between' wrap='nowrap'>
              <Text fw={650}>{encounter.name}</Text>
              <Badge variant='light'>Round {encounter.round}</Badge>
            </Group>
            <Text c='dimmed' size='sm'>
              {encounter.actors.length} {encounter.actors.length === 1 ? 'combatant' : 'combatants'}
            </Text>
          </div>

          {!connected ? (
            <Alert color='yellow' mb='md'>
              Turn controls will return when live play reconnects.
            </Alert>
          ) : null}

          {holds.length && !targeting ? (
            <CampaignTabletopReleases
              disabled={controlsDisabled}
              encounterId={encounter.id}
              encounterVersion={encounter.version}
              releases={holds}
              onRelease={onRelease}
            />
          ) : null}

          <div className={styles.actorList} aria-label='Encounter turn order'>
            {listedActors.map((actor) => {
              const current = encounter.currentActorId === actor.id
              const targetEntry = targetEntries.get(actor.id)
              return (
                <div
                  aria-current={current ? 'true' : undefined}
                  className={styles.actor}
                  data-current={current || undefined}
                  data-defeated={actor.defeated || undefined}
                  key={actor.id}
                >
                  <span className={styles.initiative} title='Initiative'>
                    {actor.initiative ?? '—'}
                  </span>
                  <div>
                    <Text
                      className={actor.defeated ? styles.defeatedName : undefined}
                      fw={current ? 700 : 600}
                      lineClamp={1}
                    >
                      {actor.label}
                    </Text>
                    <Text
                      className={
                        actor.defeated
                          ? styles.defeatedState
                          : current
                            ? styles.currentTurn
                            : undefined
                      }
                      c={current || actor.defeated ? undefined : 'dimmed'}
                      size='xs'
                    >
                      {actor.defeated
                        ? actor.kind === 'CHARACTER'
                          ? 'Dead'
                          : 'Defeated'
                        : current
                          ? 'Current turn'
                          : actor.kind.toLowerCase()}
                    </Text>
                    {targetEntry ? <Text size='xs'>{describeTargetEntry(targetEntry)}</Text> : null}
                    {targetEntry && targeting ? (
                      <Button
                        aria-label={`Target ${actor.label}`}
                        aria-pressed={targeting.pickedActorId === actor.id}
                        size='compact-xs'
                        variant={targeting.pickedActorId === actor.id ? 'filled' : 'default'}
                        onClick={() => targeting.onPick(actor.id)}
                      >
                        Target
                      </Button>
                    ) : null}
                    <ActiveGrantList
                      disabled={controlsDisabled}
                      grants={actor.activeGrants}
                      label={`Active grants on ${actor.label}`}
                      onEnd={
                        role === 'OWNER' && actor.kind !== 'CHARACTER'
                          ? (effectId) =>
                              onCommand({
                                actorId: actor.id,
                                commandId: crypto.randomUUID(),
                                encounterId: encounter.id,
                                endActiveEffectId: effectId,
                                expectedVersion: encounter.version,
                                type: 'UPDATE_ACTOR'
                              })
                          : undefined
                      }
                    />
                    {actor.concentration && (actor.kind === 'CHARACTER' || role === 'OWNER') ? (
                      <Group gap='xs'>
                        <Text size='xs'>
                          {actor.concentration.label
                            ? `Concentrating on ${actor.concentration.label}`
                            : 'Concentrating'}
                        </Text>
                        <Button
                          aria-label={`End Concentration for ${actor.label}`}
                          disabled={controlsDisabled}
                          size='compact-xs'
                          variant='default'
                          onClick={() =>
                            actor.kind === 'CHARACTER' && actor.sourceId
                              ? onEndCharacterConcentration(actor.sourceId)
                              : onCommand({
                                  actorId: actor.id,
                                  commandId: crypto.randomUUID(),
                                  encounterId: encounter.id,
                                  endConcentration: true,
                                  expectedVersion: encounter.version,
                                  type: 'UPDATE_ACTOR'
                                })
                          }
                        >
                          End Concentration
                        </Button>
                      </Group>
                    ) : null}
                    {role === 'OWNER' && 'reveal' in actor && actor.public ? (
                      <Select
                        allowDeselect={false}
                        aria-label={`Reveal ${actor.label} to players`}
                        comboboxProps={{ withinPortal: false }}
                        data={REVEAL_OPTIONS}
                        disabled={controlsDisabled}
                        size='xs'
                        value={actor.reveal ?? 'HIDDEN'}
                        onChange={(level) =>
                          onCommand({
                            actorId: actor.id,
                            commandId: crypto.randomUUID(),
                            encounterId: encounter.id,
                            expectedVersion: encounter.version,
                            reveal: level === 'UNNAMED' || level === 'NAMED' ? level : null,
                            type: 'UPDATE_ACTOR'
                          })
                        }
                      />
                    ) : null}
                    {'concealment' in actor && actor.concealment ? (
                      <CampaignTabletopConcealmentObservers
                        actors={encounter.actors}
                        concealment={actor.concealment}
                        disabled={controlsDisabled}
                        holder={actor}
                        onChange={(change) =>
                          actor.concealment &&
                          onCommand({
                            ...change,
                            activeEffectId: actor.concealment.effectId,
                            commandId: crypto.randomUUID(),
                            encounterId: encounter.id,
                            expectedVersion: encounter.version,
                            type: 'SET_CONCEALMENT_OBSERVERS'
                          })
                        }
                      />
                    ) : null}
                    {'moraleOffers' in actor ? (
                      <CampaignTabletopMorale
                        actor={actor}
                        disabled={controlsDisabled}
                        leaders={encounter.actors.filter(
                          (leader) => leader.kind !== 'CHARACTER' && !leader.defeated
                        )}
                        onCheck={(check) =>
                          onCommand({
                            ...check,
                            actorId: actor.id,
                            commandId: crypto.randomUUID(),
                            encounterId: encounter.id,
                            expectedVersion: encounter.version,
                            roll: { kind: 'AUTO_ROLL' },
                            type: 'MORALE_SAVE'
                          })
                        }
                        onConfirm={(disposition) =>
                          onCommand({
                            actorId: actor.id,
                            commandId: crypto.randomUUID(),
                            disposition,
                            encounterId: encounter.id,
                            expectedVersion: encounter.version,
                            type: 'CONFIRM_MORALE'
                          })
                        }
                      />
                    ) : null}
                  </div>
                  {/* Players see health only at each actor's display level; the GM always sees exact. */}
                  {'health' in actor ? (
                    actor.health ? (
                      <EncounterActorHealth health={actor.health} label={actor.label} />
                    ) : null
                  ) : (
                    <EncounterActorHealth
                      health={{
                        level: 'EXACT',
                        current: actor.currentHitPoints,
                        maximum: actor.maxHitPoints
                      }}
                      label={actor.label}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {role === 'OWNER' ? (
            <div className={styles.controls}>
              <Select
                data={encounter.actors.map((actor) => ({ label: actor.label, value: actor.id }))}
                disabled={controlsDisabled}
                label='Current turn'
                value={encounter.currentActorId}
                onChange={(actorId) => command({ actorId, type: 'SET_CURRENT_ACTOR' })}
              />
              <div className={styles.controlButtons}>
                <Button
                  disabled={controlsDisabled}
                  variant='default'
                  onClick={() => command({ type: 'PREVIOUS_TURN' })}
                >
                  Previous turn
                </Button>
                <Button
                  disabled={controlsDisabled}
                  onClick={() => command({ type: 'ADVANCE_TURN' })}
                >
                  Next turn
                </Button>
              </div>
              <div className={styles.bindingControls}>
                <div>
                  <Text fw={650} size='sm'>
                    Scene tokens
                  </Text>
                  <Text c='dimmed' size='xs'>
                    Connect combatants to tokens only while this Encounter uses the presented Scene.
                  </Text>
                </div>
                {scene ? (
                  encounter.actors.map((actor) => {
                    const selectedTokenId =
                      scene.tokens.find((token) => actorIdByTokenId.get(token.id) === actor.id)
                        ?.id ?? null
                    return (
                      <Select
                        aria-label={`Scene token for ${actor.label}`}
                        clearable
                        data={scene.tokens
                          .filter((token) => {
                            const boundActorId = actorIdByTokenId.get(token.id)
                            return !boundActorId || boundActorId === actor.id
                          })
                          .map((token) => ({ label: token.label, value: token.id }))}
                        disabled={controlsDisabled}
                        key={actor.id}
                        label={actor.label}
                        placeholder='Not on this scene'
                        value={selectedTokenId}
                        onChange={(tokenId) => bindActorToToken(actor.id, tokenId)}
                      />
                    )
                  })
                ) : (
                  <Text c='dimmed' size='xs'>
                    Bind and present the Encounter&apos;s Scene before assigning tokens.
                  </Text>
                )}
              </div>
              <div className={styles.bindingControls}>
                <Text fw={650} size='sm'>
                  Player control
                </Text>
                {encounter.actors.map((actor) => (
                  <div key={actor.id}>
                    <Text size='sm'>{actor.label}</Text>
                    <EncounterActorControlFields
                      actor={actor}
                      disabled={controlsDisabled}
                      memberships={memberships}
                      onChange={(update) =>
                        onCommand({
                          ...update,
                          actorId: actor.id,
                          commandId: crypto.randomUUID(),
                          encounterId: encounter.id,
                          expectedVersion: encounter.version,
                          type: 'UPDATE_ACTOR'
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              {pending ? (
                <Text aria-live='polite' c='dimmed' size='xs'>
                  Applying the turn update…
                </Text>
              ) : null}
            </div>
          ) : currentActorMine ? (
            <div className={styles.controls}>
              <Button disabled={controlsDisabled} onClick={() => command({ type: 'ADVANCE_TURN' })}>
                End turn
              </Button>
            </div>
          ) : null}
        </div>
      </Drawer>
    </>
  )
}
