import { runInDurableObject } from 'cloudflare:test'
import { discoverEncounterFeatureActions } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import type { EncounterActionChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import type {
  EncounterReadDto,
  EncounterReadResultDto
} from '@artificer-toolkit/schema/api/encounterRead'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import type { ForcedMovementCollisionAuthored } from '@artificer-toolkit/shared/authored'
import type { ForcedMovementDirection } from '@artificer-toolkit/shared/core'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { connectPlayer, ROOM_REPLY_WAIT } from './liveRoomFixture.js'
import { movementRoom, type MovementRoomConfig } from './movementRoomFixture.js'
import { readPendingActionDecision } from './roomHistoryReads.js'

/** Which roll a Bite resolves with: the target's Dexterity save (DC 10) or the source's attack d20. */
export type BiteKind = 'SAVE' | 'ATTACK'

/** A version-keyed read the room answers on `reader`'s socket. */
export async function readRoomEncounter<Kind extends EncounterReadDto['kind']>(
  reader: Pick<Awaited<ReturnType<typeof connectPlayer>>, 'messages' | 'socket'>,
  read: Extract<EncounterReadDto, { kind: Kind }>
) {
  const requestId = crypto.randomUUID()
  const first = reader.messages.length
  reader.socket.send(JSON.stringify({ type: 'ENCOUNTER_READ', requestId, read }))
  const answer = await vi.waitFor(() => {
    const found = reader.messages
      .slice(first)
      .find(
        (message) => message.type === 'ENCOUNTER_READ_RESULT' && message.requestId === requestId
      )
    if (found?.type !== 'ENCOUNTER_READ_RESULT')
      throw new Error('The room has not answered the read.')
    return found
  }, ROOM_REPLY_WAIT)
  if (answer.result.kind !== read.kind) throw new Error(`Expected the ${read.kind} answer.`)
  return answer.result.result as Extract<EncounterReadResultDto, { kind: Kind }>['result']
}

/**
 * The SRD Wolf with its Bite rewritten to `damage` (one point) that needs a roll: on a failed save
 * (DC 10, Dexterity unless `save` says otherwise) or on a hit (attack d20 + 4), within `reachFeet` or at any range. The rest of the stat block stays the SRD's.
 */
export function biteWolf(
  bite: BiteKind,
  {
    damage = 1,
    reachFeet,
    ranged = false,
    save = { ability: 'DEXTERITY' },
    spellCast
  }: {
    damage?: number
    reachFeet?: number
    /** The ATTACK Bite is a ranged weapon attack instead of a melee one. */
    ranged?: boolean
    /** The ability the SAVE Bite rolls and, when set, the damage type it deals instead of the SRD's. */
    save?: {
      ability: 'DEXTERITY' | 'CONSTITUTION'
      damageTypeCode?: 'POISON' | 'FIRE' | 'COLD' | 'PSYCHIC' | 'RADIANT' | 'ACID'
    }
    /** The Bite casts a spell: the System spell it references, or the level it is cast at. */
    spellCast?: { castLevel: number }
  } = {}
): CreatureAuthored {
  const saveAbilityId = srdSystemRecord.abilities?.find(
    (ability) => ability.code === save.ability
  )?.id
  if (!saveAbilityId) throw new Error(`Missing ${save.ability} ability fixture.`)
  const damageTypeId = save.damageTypeCode
    ? srdSystemRecord.damageTypes?.find((type) => type.code === save.damageTypeCode)?.id
    : undefined
  if (save.damageTypeCode && !damageTypeId) throw new Error('Missing damage type fixture.')
  // The real Creature schema checks the rewritten stat block.
  return creatureAuthoredDtoSchema.parse({
    ...plainWolf,
    features: plainWolf.features?.map((feature) =>
      feature.label !== 'Bite'
        ? feature
        : {
            ...feature,
            ...(bite === 'ATTACK'
              ? {
                  rollDefinitions: [
                    {
                      id: '00000000-0000-4000-8000-000000000c95',
                      label: 'Bite attack',
                      kind: 'ATTACK' as const,
                      expression: { count: 1, die: 20, modifier: 4 },
                      rollMode: 'NORMAL' as const,
                      chargeCost: null,
                      order: 1
                    }
                  ]
                }
              : {}),
            effects: feature.effects?.map((effect) => ({
              ...effect,
              ...(spellCast && { spellCast }),
              invocation: {
                ...effect.invocation,
                range:
                  reachFeet === undefined
                    ? { id: effect.invocation.range.id, rangeKind: 'UNLIMITED' as const }
                    : {
                        id: effect.invocation.range.id,
                        rangeKind: 'DISTANCE' as const,
                        amount: reachFeet,
                        unit: 'FEET' as const
                      },
                targeting: {
                  selectionKind: 'SINGLE_TARGET' as const,
                  dispositionKind: 'ANY' as const
                },
                ...(bite === 'SAVE'
                  ? {
                      triggerCode: 'SAVING_THROW' as const,
                      savingThrow: {
                        id: '00000000-0000-4000-8000-000000000c60',
                        dcMethod: 'FIXED_DC' as const,
                        abilityDefinitionId: saveAbilityId,
                        baseDc: 10
                      }
                    }
                  : {
                      triggerCode: ranged
                        ? ('RANGED_WEAPON_ATTACK' as const)
                        : ('MELEE_WEAPON_ATTACK' as const)
                    })
              },
              paths: effect.paths.slice(0, 1).map((path) => {
                if (!('resultBlock' in path)) return path
                return {
                  ...path,
                  pathCode: bite === 'ATTACK' ? ('ON_HIT' as const) : ('ON_SAVE_FAIL' as const),
                  resultBlock: {
                    ...path.resultBlock,
                    outcomes: path.resultBlock.outcomes.map((outcome) => {
                      if (outcome.effectKind !== 'DAMAGE') throw new Error('Expected Bite damage.')
                      return {
                        id: outcome.id,
                        effectKind: 'DAMAGE' as const,
                        damageTypeId: damageTypeId ?? outcome.damageTypeId,
                        valueKind: 'FIXED' as const,
                        scalingKind: 'NONE' as const,
                        amount: damage
                      }
                    })
                  }
                }
              })
            }))
          }
    )
  })
}

/**
 * The SRD Wolf with its Bite made a point-area save: every creature in a 20-foot sphere within 150
 * feet makes a Dexterity save (DC 10) against 1 damage. It is the shape of Fireball, authored as a
 * Creature so a room can run it without a Character's spell slots.
 */
export function fireballWolf(
  damageTypeCode?: 'FIRE' | 'COLD' | 'RADIANT' | 'ACID',
  ability: 'DEXTERITY' | 'CONSTITUTION' = 'DEXTERITY'
): CreatureAuthored {
  const bite = biteWolf('SAVE', {
    reachFeet: 150,
    save: { ability, damageTypeCode }
  })
  return creatureAuthoredDtoSchema.parse({
    ...bite,
    features: bite.features?.map((feature) =>
      feature.label !== 'Bite'
        ? feature
        : {
            ...feature,
            effects: feature.effects?.map((effect) => ({
              ...effect,
              invocation: {
                ...effect.invocation,
                targeting: {
                  selectionKind: 'AREA_CONTENTS' as const,
                  dispositionKind: 'ANY' as const
                },
                shape: {
                  id: '00000000-0000-4000-8000-000000000c96',
                  shapeKind: 'SPHERE' as const,
                  radius: { amount: 20, unit: 'FEET' as const }
                }
              }
            }))
          }
    )
  })
}

/**
 * The SRD Wolf with its Bite made a save over an area that extends from the Wolf (a Self range): a
 * cone, a line, or a cube from the Wolf's side (as Thunderwave's). Every creature in it makes a
 * Dexterity save (DC 10) against 1 damage, as the point-area Wolf of `fireballWolf` does.
 */
export function directedAreaWolf(
  shape:
    | { shapeKind: 'CONE'; length: { amount: number; unit: 'FEET' } }
    | {
        shapeKind: 'LINE'
        length: { amount: number; unit: 'FEET' }
        width: { amount: number; unit: 'FEET' }
      }
    | { shapeKind: 'CUBE'; edgeLength: { amount: number; unit: 'FEET' } }
): CreatureAuthored {
  return selfAreaWolf(shape)
}

/**
 * `directedAreaWolf` with a sphere, cylinder or circle: a Self range makes it a radius centered on
 * the Wolf, reaching from the edge of its space (a death burst, Destructive Wave).
 */
export function casterCenteredAreaWolf(
  shape:
    | { shapeKind: 'SPHERE'; radius: { amount: number; unit: 'FEET' } }
    | {
        shapeKind: 'CYLINDER'
        radius: { amount: number; unit: 'FEET' }
        height: { amount: number; unit: 'FEET' }
      }
    | { shapeKind: 'CIRCLE'; radius: { amount: number; unit: 'FEET' } },
  /** The damage a failed save takes; a success takes none. */
  damage = 1
): CreatureAuthored {
  return selfAreaWolf(shape, damage)
}

/**
 * `casterCenteredAreaWolf` whose burst is a passive effect that fires when the Wolf reaches 0 hit
 * points (a death burst) rather than an action it takes.
 */
export function deathBurstWolf(radiusFeet: number, damage = 1): CreatureAuthored {
  const burst = casterCenteredAreaWolf(
    { shapeKind: 'SPHERE', radius: { amount: radiusFeet, unit: 'FEET' } },
    damage
  )
  return creatureAuthoredDtoSchema.parse({
    ...burst,
    features: burst.features?.map((feature) =>
      feature.label !== 'Bite'
        ? feature
        : {
            ...feature,
            effects: feature.effects?.map(({ invocation, ...effect }) => {
              const { activation: _activation, ...passive } = invocation as typeof invocation & {
                activation?: unknown
              }
              return {
                ...effect,
                invocation: { ...passive, kind: 'PASSIVE', triggerCode: 'HP_ZERO' }
              }
            })
          }
    )
  })
}

function selfAreaWolf(
  shape: Record<string, unknown> & { shapeKind: string },
  damage = 1
): CreatureAuthored {
  const bite = biteWolf('SAVE', { reachFeet: 150, damage })
  return creatureAuthoredDtoSchema.parse({
    ...bite,
    features: bite.features?.map((feature) =>
      feature.label !== 'Bite'
        ? feature
        : {
            ...feature,
            effects: feature.effects?.map((effect) => ({
              ...effect,
              invocation: {
                ...effect.invocation,
                range: { id: effect.invocation.range.id, rangeKind: 'SELF' as const },
                targeting: {
                  selectionKind: 'AREA_CONTENTS' as const,
                  dispositionKind: 'ANY' as const
                },
                shape: { id: '00000000-0000-4000-8000-000000000c97', ...shape }
              }
            }))
          }
    )
  })
}

/** `base` with its Bite's failed save leaving a Frightened Condition for two rounds instead of damage. */
export function frightenOnFailedSave(base: CreatureAuthored): CreatureAuthored {
  const frightened = srdSystemRecord.conditionTypes.find(({ code }) => code === 'FRIGHTENED')
  const dexterityId = srdSystemRecord.abilities?.find(({ code }) => code === 'DEXTERITY')?.id
  if (!frightened || !dexterityId) throw new Error('Missing frightened condition fixture.')
  return creatureAuthoredDtoSchema.parse({
    ...base,
    features: base.features?.map((feature) =>
      feature.label !== 'Bite'
        ? feature
        : {
            ...feature,
            effects: feature.effects?.map((effect) => ({
              ...effect,
              paths: effect.paths.slice(0, 1).map((path) => {
                if (!('resultBlock' in path)) return path
                return {
                  id: path.id,
                  order: path.order,
                  pathCode: 'ON_SAVE_FAIL' as const,
                  groupType: 'SEQUENTIAL' as const,
                  originKind: 'SOURCE' as const,
                  selectionKind: 'FIXED' as const,
                  resultBlock: {
                    id: '00000000-0000-4000-8000-000000000099',
                    resultKind: 'SEQUENCE' as const,
                    duration: {
                      id: '00000000-0000-4000-8000-000000000098',
                      durationKind: 'ROUND' as const,
                      amount: 2
                    },
                    outcomes: [
                      {
                        id: '00000000-0000-4000-8000-0000000000ab',
                        effectKind: 'CONDITION' as const,
                        conditionId: frightened.id
                      },
                      {
                        id: '00000000-0000-4000-8000-0000000000ac',
                        effectKind: 'FOLLOW_UP_SAVE' as const,
                        timing: 'TARGET_TURN_END' as const,
                        savingThrow: {
                          id: '00000000-0000-4000-8000-0000000000ad',
                          dcMethod: 'FIXED_DC' as const,
                          abilityDefinitionId: dexterityId,
                          baseDc: 10
                        },
                        attempts: {
                          kind: 'ONCE' as const,
                          repeatOnFailure: true
                        },
                        onSuccess: { kind: 'END' as const },
                        onFailure: { kind: 'CONTINUE' as const },
                        onDurationComplete: { kind: 'END' as const }
                      }
                    ]
                  }
                }
              })
            }))
          }
    )
  })
}

/**
 * `base` with its Bite's failed save moving the target `feet` (exactly, or up to) in `direction`
 * instead of damage, and `collision` when it strikes something (D159).
 */
export function forceOnFailedSave(
  base: CreatureAuthored,
  direction: ForcedMovementDirection,
  feet: number,
  distanceMode: 'EXACT' | 'UP_TO' = 'EXACT',
  collision?: ForcedMovementCollisionAuthored
): CreatureAuthored {
  return creatureAuthoredDtoSchema.parse({
    ...base,
    features: base.features?.map((feature) =>
      feature.label !== 'Bite'
        ? feature
        : {
            ...feature,
            effects: feature.effects?.map((effect) => ({
              ...effect,
              paths: effect.paths.slice(0, 1).map((path) => {
                if (!('resultBlock' in path)) return path
                return {
                  id: path.id,
                  order: path.order,
                  pathCode: 'ON_SAVE_FAIL' as const,
                  groupType: 'SINGLE' as const,
                  originKind: 'SOURCE' as const,
                  selectionKind: 'FIXED' as const,
                  resultBlock: {
                    id: '00000000-0000-4000-8000-0000000000ae',
                    resultKind: 'SINGLE' as const,
                    outcomes: [
                      {
                        id: '00000000-0000-4000-8000-0000000000af',
                        effectKind: 'FORCED_MOVEMENT' as const,
                        direction,
                        actionEconomy: 'NONE' as const,
                        distanceMode,
                        amount: feet,
                        unit: 'FEET' as const,
                        ...(collision ? { collision } : {})
                      }
                    ]
                  }
                }
              })
            }))
          }
    )
  })
}

/** `actor` with its frozen check totals replaced (a skill or ability definition ID to its total). */
export function withCheckTotals(
  actor: EncounterRunActorState,
  checkTotals: Readonly<Record<string, number>>
): EncounterRunActorState {
  const { snapshot } = actor
  if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot))
    throw new Error('The fixture Creature snapshot must be an object.')
  const { ruleFacts } = snapshot
  if (typeof ruleFacts !== 'object' || ruleFacts === null || Array.isArray(ruleFacts))
    throw new Error('The fixture Creature carries rule facts.')
  return { ...actor, snapshot: { ...snapshot, ruleFacts: { ...ruleFacts, checkTotals } } }
}

export interface ActionRoomConfig extends Pick<
  MovementRoomConfig,
  | 'automationMode'
  | 'trackAmmunition'
  | 'autoRoll'
  | 'playerControlledActorIds'
  | 'otherPlayerControlledActorIds'
  | 'sceneOverrides'
  | 'spatialEffects'
  | 'sceneGrid'
  | 'optionalCombatKinds'
  | 'sides'
  | 'rolls'
  | 'fallbackRoll'
  | 'concentration'
  | 'concentrationOwnerActorId'
  | 'concentrationDependentActorIds'
  | 'characterClassFeatures'
  | 'characterEquipment'
  | 'characterPlay'
  | 'characterSpellcasting'
  | 'formCreatures'
  | 'secondCharacter'
  | 'thirdCharacter'
  | 'hiddenActorIds'
  | 'definitions'
  | 'seed'
  | 'pinSpells'
  | 'status'
  | 'initiativePolicy'
  | 'campaignClockMinute'
> {
  /** The Run's actors, side by side 100 px apart from the first, which is the acting (current) actor. */
  actors: readonly EncounterRunActorState[]
  /** The Creature feature the acting actor's action comes from. */
  ownerFeatureId?: string
  /** The one Effect of that feature to act with, when it holds several actions (a breath weapon's two breaths). */
  effectId?: string
  /** Scene positions that replace an actor's default (150 + 100 x its index, 150). */
  positions?: Readonly<Record<string, { x: number; y: number }>>
  /** For a Character actor, the one of its offered actions the room acts with. */
  characterAction?: (action: EncounterActionChoiceDto) => boolean
  /** The grip of a versatile weapon attack, which is its own action. */
  grip?: 'ONE_HANDED' | 'TWO_HANDED'
}

/**
 * A native room whose first actor acts. The GM's socket sends every command and, as the Campaign
 * owner, may answer every roll.
 */
export async function actionRoom(config: ActionRoomConfig) {
  const [source] = config.actors
  if (!source) throw new Error('The room needs an acting actor.')
  /** The action `actor`'s Creature feature offers, or the one it lists unavailable. */
  const featureActionId = (
    actor: EncounterRunActorState,
    ownerFeatureId: string,
    grip: ActionRoomConfig['grip'] | null = null,
    effectId: string | undefined = undefined
  ) => {
    const discovery = discoverEncounterFeatureActions({
      spells: new Map(),
      actor,
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
      abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
    })
    const found =
      discovery.available.find(
        (candidate) =>
          candidate.ownerFeatureId === ownerFeatureId &&
          candidate.grip === grip &&
          (effectId === undefined || candidate.effectId === effectId)
      ) ?? discovery.unavailable.find((candidate) => candidate.ownerFeatureId === ownerFeatureId)
    if (!found) throw new Error('The feature has no discovered action.')
    return found.actionId
  }
  const room = await movementRoom({
    ...config,
    moverActorId: source.id,
    positions: Object.fromEntries(
      config.actors.map((actor, index) => [
        actor.id,
        config.positions?.[actor.id] ?? { x: 150 + index * 100, y: 150 }
      ])
    )
  })

  /** The actions the room offers the acting actor, or `actorId` on its own turn, as the GM reads them. */
  async function actionChoices(actorId = source.id) {
    const choices = await readRoomEncounter(room.base, {
      kind: 'ACTION_CHOICES',
      input: { encounterId: room.encounterId, actorId }
    })
    if (!choices) throw new Error('The room offers no action choices.')
    return choices
  }
  const actionId = await (async () => {
    if (config.ownerFeatureId)
      return featureActionId(source, config.ownerFeatureId, config.grip ?? null, config.effectId)
    // A Run that has not started has no acting actor to read choices for; its tests pick an id from
    // `actionChoices` on the actor's own turn.
    if (config.status === 'PREPARED' && !config.characterAction) return ''
    if (!config.characterAction) throw new Error('The room needs an action source.')
    const choices = await actionChoices()
    const action = choices.actions.find(config.characterAction)
    if (!action)
      throw new Error(
        `The Character offers no such action: ${JSON.stringify(choices.actions.map(({ label }) => label))}.`
      )
    return action.id
  })()
  const version = () =>
    runInDurableObject(room.base.stub, async (_instance, context) => {
      const [run] = new RoomEncounterStore(context.storage).documents('encounterRuns')
      if (!run) throw new Error('The room holds no Run.')
      return run.version
    })

  /** Sends one encounter command on the GM's socket and returns the room's answer. */
  function send(command: Record<string, unknown> & { commandId: string }) {
    return room.send(command.commandId, { scope: 'ENCOUNTER', command })
  }
  async function commit(command: Record<string, unknown> & { commandId: string }) {
    const answer = await send(command)
    if (answer.type !== 'COMMAND_COMMITTED')
      throw new Error(`The room rejected the command: ${JSON.stringify(answer)}`)
  }

  function resolveCommand(
    decision: NonNullable<Awaited<ReturnType<typeof readPendingActionDecision>>>,
    resolution: Record<string, unknown>
  ) {
    return {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: decision.encounterVersion,
      correlationId: null,
      occurrenceId: decision.occurrence.id,
      expectedOccurrenceVersion: decision.occurrence.version,
      resolution
    }
  }

  return {
    room,
    version,
    send,
    commit,
    /** Ends the current turn. */
    async advanceTurn() {
      await commit({
        type: 'ADVANCE_TURN',
        encounterId: room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: await version()
      })
    },
    /** The acting actor's discovered action. */
    actionId,
    /** The action of the Creature feature `ownerFeatureId` on the Run's `actor`, for its own turn. */
    featureActionId,
    actionChoices,
    /** The actions the room offers `actorId`, as a player's socket reads them. */
    async actionChoicesAsPlayer(actorId: string) {
      const choices = await readRoomEncounter(await connectPlayer(room.base), {
        kind: 'ACTION_CHOICES',
        input: { encounterId: room.encounterId, actorId }
      })
      if (!choices) throw new Error('The room offers the player no action choices.')
      return choices
    },
    /** The holds the room offers to release on any turn, as the GM or, with `asPlayer`, a player reads them. */
    async heldRelationships(asPlayer = false) {
      return readRoomEncounter(asPlayer ? await connectPlayer(room.base) : room.base, {
        kind: 'HELD_RELATIONSHIPS',
        input: { encounterId: room.encounterId }
      })
    },
    /** The Scene context of the acting actor's token and the token of the actor at `targetIndex`. */
    sceneContext(targetIndex = 1) {
      const { scene } = room
      const [sourceToken, targetToken] = [0, targetIndex].map((index) => scene.tokens[index])
      if (!sourceToken || !targetToken) throw new Error('The Scene holds no token for the actor.')
      return {
        sceneId: scene.id,
        expectedSceneVersion: scene.version,
        sourceTokenId: sourceToken.id,
        targetTokenId: targetToken.id
      }
    },
    /** The items of `targetActorId` the acting actor's action may be used on, as the GM reads them. */
    async actionItemChoices(targetActorId: string, chosenActionId = actionId, actorId = source.id) {
      const choices = await readRoomEncounter(room.base, {
        kind: 'ACTION_ITEM_CHOICES',
        input: { encounterId: room.encounterId, actorId, actionId: chosenActionId, targetActorId }
      })
      if (!choices) throw new Error('The room offers no item choices.')
      return choices.items
    },
    /**
     * The acting actor's action at `targetActorId`, with `choiceOptionId` the option a cast-time pick
     * names (D148) and `boundItemInstanceId` the item it is used on; the room's answer, not yet checked.
     */
    async startAction(
      targetActorId: string,
      acknowledgedWarnings: ResolveEncounterActionInputDto['acknowledgedWarnings'] = [],
      sceneContext: ResolveEncounterActionInputDto['sceneContext'] = null,
      optionalCombatIntent: ResolveEncounterActionInputDto['optionalCombatIntent'] = null,
      chosenActionId = actionId,
      actorId = source.id,
      choiceOptionId?: string,
      boundItemInstanceId?: string,
      ammunitionItemInstanceId?: string
    ) {
      const command: ResolveEncounterActionInputDto = {
        type: 'RESOLVE_ACTION',
        acceptedWieldConflict: null,
        acknowledgedWarnings,
        encounterId: room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: await version(),
        actorId,
        target: {
          kind: 'ACTOR',
          actorId: targetActorId,
          ...(choiceOptionId && { choiceOptionId }),
          ...(boundItemInstanceId && { boundItemInstanceId }),
          ...(ammunitionItemInstanceId && { ammunitionItemInstanceId })
        },
        actionId: chosenActionId,
        optionalCombatIntent,
        sceneContext
      }
      return { command, answer: await send(command) }
    },
    /** The acting actor's area action at the Scene `point`; the room's answer, not yet checked. */
    startAreaAction(
      point: { x: number; y: number },
      acknowledgedWarnings: ResolveEncounterActionInputDto['acknowledgedWarnings'] = [],
      /** Whose socket sends it: the GM's, or the player who controls the acting actor. */
      sender: 'GM' | 'PLAYER' = 'GM',
      unaffectedActorIds?: string[]
    ) {
      return this.startAreaCommand(
        { kind: 'POINT', point, ...(unaffectedActorIds ? { unaffectedActorIds } : {}) },
        acknowledgedWarnings,
        sender
      )
    },
    /** The acting actor's directed area action from `origin` toward `toward`; not yet checked. */
    startDirectedAreaAction(
      origin: { x: number; y: number },
      toward: { x: number; y: number },
      acknowledgedWarnings: ResolveEncounterActionInputDto['acknowledgedWarnings'] = [],
      sender: 'GM' | 'PLAYER' = 'GM'
    ) {
      return this.startAreaCommand(
        { kind: 'DIRECTED', origin, toward },
        acknowledgedWarnings,
        sender
      )
    },
    /**
     * The acting actor's area action centered on its own token; not yet checked. `choices` are the
     * creatures its zone spares and the zone a cast-time pick places.
     */
    startCasterCenteredAreaAction(
      acknowledgedWarnings: ResolveEncounterActionInputDto['acknowledgedWarnings'] = [],
      sender: 'GM' | 'PLAYER' = 'GM',
      choices: { unaffectedActorIds?: string[]; choiceOptionId?: string } = {}
    ) {
      return this.startAreaCommand(
        { kind: 'CASTER_CENTERED', ...choices },
        acknowledgedWarnings,
        sender
      )
    },
    /** The acting actor's area action on the Scene as the room holds it now. */
    async startAreaCommand(
      target:
        | { kind: 'POINT'; point: { x: number; y: number }; unaffectedActorIds?: string[] }
        | { kind: 'DIRECTED'; origin: { x: number; y: number }; toward: { x: number; y: number } }
        | { kind: 'CASTER_CENTERED'; unaffectedActorIds?: string[]; choiceOptionId?: string }
        | {
            kind: 'WALL'
            from: { x: number; y: number }
            to: { x: number; y: number }
            side?: 'LEFT' | 'RIGHT'
            choiceOptionId?: string
          }
        | {
            kind: 'RING'
            center: { x: number; y: number }
            outerRadius: number
            side?: 'INSIDE' | 'OUTSIDE'
            choiceOptionId?: string
          },
      acknowledgedWarnings: ResolveEncounterActionInputDto['acknowledgedWarnings'] = [],
      sender: 'GM' | 'PLAYER' = 'GM'
    ) {
      const command: ResolveEncounterActionInputDto = {
        type: 'RESOLVE_ACTION',
        acceptedWieldConflict: null,
        acknowledgedWarnings,
        encounterId: room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: await version(),
        actorId: source.id,
        target: {
          ...target,
          sceneId: room.scene.id,
          expectedSceneVersion: room.scene.version
        },
        actionId,
        optionalCombatIntent: null,
        sceneContext: null
      }
      return {
        command,
        answer: sender === 'PLAYER' ? await this.sendAsPlayer(command) : await send(command)
      }
    },
    /**
     * The acting actor's action on the chosen creatures `actorIds`, read against the Scene or not;
     * `point` is the Scene point an action that names an area is aimed at; `formId` is the
     * creature form the cast takes, or `creatureId` the Creature a filtered form is; `choiceOptionId`
     * is the option a cast-time pick names (D148).
     */
    async startActorsAction(
      actorIds: readonly string[],
      acknowledgedWarnings: ResolveEncounterActionInputDto['acknowledgedWarnings'] = [],
      withScene = true,
      point: { x: number; y: number } | null = null,
      formId?: string,
      creatureId?: string,
      choiceOptionId?: string
    ) {
      const command: ResolveEncounterActionInputDto = {
        type: 'RESOLVE_ACTION',
        acceptedWieldConflict: null,
        acknowledgedWarnings,
        encounterId: room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: await version(),
        actorId: source.id,
        target: {
          kind: 'ACTORS',
          actorIds: [...actorIds],
          ...(formId && { formId }),
          ...(creatureId && { creatureId }),
          ...(choiceOptionId && { choiceOptionId }),
          scene: withScene
            ? { sceneId: room.scene.id, expectedSceneVersion: room.scene.version, point }
            : null
        },
        actionId,
        optionalCombatIntent: null,
        sceneContext: null
      }
      return { command, answer: await send(command) }
    },
    /** The GM's command taking `actorId` out of the pending area `decision` shows. */
    removeAreaTargetCommand(
      decision: NonNullable<Awaited<ReturnType<typeof readPendingActionDecision>>>,
      actorId: string,
      overrides: Record<string, unknown> = {}
    ) {
      if (decision.pending.kind !== 'AREA_SAVES') throw new Error('The decision is not an area.')
      if (decision.pending.caughtChecksum === null)
        throw new Error('Only the GM reads the caught-set seal.')
      return {
        type: 'REMOVE_AREA_TARGET',
        encounterId: room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: decision.encounterVersion,
        occurrenceId: decision.occurrence.id,
        expectedOccurrenceVersion: decision.occurrence.version,
        expectedCaughtChecksum: decision.pending.caughtChecksum,
        actorId,
        ...overrides
      }
    },
    /**
     * Sends `command` on a player's socket instead of the GM's; the room's answer. `who` is the
     * room's player, or its second player when the room was built with one.
     */
    async sendAsPlayer(
      command: Record<string, unknown> & { commandId: string },
      who: 'PLAYER' | 'OTHER_PLAYER' = 'PLAYER'
    ) {
      const player = await room.asPlayer(who)
      return player.send(command.commandId, { scope: 'ENCOUNTER', command })
    },
    /** The room's own Optional Rule choice for the acting actor's action at `targetActorId`. */
    async optionalActionChoices(
      targetActorId: string,
      definitionId: string,
      sceneContext: ResolveEncounterActionInputDto['sceneContext'] = null
    ) {
      return readRoomEncounter(room.base, {
        kind: 'OPTIONAL_ACTION_CHOICES',
        input: {
          encounterId: room.encounterId,
          actorId: source.id,
          actionId,
          targetActorId,
          definitionId,
          sceneContext
        }
      })
    },
    /** What each creature would add to the acting actor's attack with its action, off the Scene. */
    async actionTargetModifiers() {
      return readRoomEncounter(room.base, {
        kind: 'ACTION_TARGET_MODIFIERS',
        input: { encounterId: room.encounterId, actorId: source.id, actionId, scene: null }
      })
    },
    /** The PENDING decision, as the room shows it to the GM; throws when none waits. */
    async pendingDecision() {
      const decision = await readPendingActionDecision(room.base.stub)
      if (!decision) throw new Error('No action decision is pending.')
      return decision
    },
    /** "Roll dice" for the pending request; the room's answer, not yet checked. */
    rollDice(
      decision: NonNullable<Awaited<ReturnType<typeof readPendingActionDecision>>>,
      rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE' | null = null
    ) {
      const { pending } = decision
      // A contest check is one d20 request whichever check the roller picks.
      const requestId =
        pending.kind === 'CONTEST_CHECK'
          ? pending.requestId
          : 'request' in pending
            ? pending.request.requestId
            : null
      if (requestId === null) throw new Error('The decision holds no roll request.')
      return send({
        type: 'ROLL_RULE_EVIDENCE',
        encounterId: room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: decision.encounterVersion,
        occurrenceId: decision.occurrence.id,
        expectedOccurrenceVersion: decision.occurrence.version,
        requestId,
        rollMode
      })
    },
    /** The command that answers the pending decision with `resolution`. */
    resolveCommand,
    /** Answers the pending decision with `resolution`; the room's answer, not yet checked. */
    resolve(
      decision: NonNullable<Awaited<ReturnType<typeof readPendingActionDecision>>>,
      resolution: Record<string, unknown>
    ) {
      return send(resolveCommand(decision, resolution))
    }
  }
}
