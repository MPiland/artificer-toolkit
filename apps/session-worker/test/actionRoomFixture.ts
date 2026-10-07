import { runInDurableObject } from 'cloudflare:test'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import type { EncounterActionChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import type {
  EncounterReadDto,
  EncounterReadResultDto
} from '@artificer-toolkit/schema/api/encounterRead'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { movementRoom, type MovementRoomConfig } from './movementRoomFixture.js'
import { readPendingActionDecision } from './roomHistoryReads.js'

/** Which roll a Bite resolves with: the target's Dexterity save (DC 10) or the source's attack d20. */
export type BiteKind = 'SAVE' | 'ATTACK'

/**
 * The SRD Wolf with its Bite rewritten to `damage` (one point) that needs a roll: on a failed save
 * (DC 10 Dexterity) or on a hit (attack d20 + 4), within `reachFeet` or at any range. The rest of the stat block stays the SRD's.
 */
export function biteWolf(
  bite: BiteKind,
  { damage = 1, reachFeet }: { damage?: number; reachFeet?: number } = {}
): CreatureAuthored {
  const dexterityId = srdSystemRecord.abilities?.find((ability) => ability.code === 'DEXTERITY')?.id
  if (!dexterityId) throw new Error('Missing Dexterity ability fixture.')
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
                        abilityDefinitionId: dexterityId,
                        baseDc: 10
                      }
                    }
                  : { triggerCode: 'MELEE_WEAPON_ATTACK' as const })
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
                        damageTypeId: outcome.damageTypeId,
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

export interface ActionRoomConfig extends Pick<
  MovementRoomConfig,
  | 'automationMode'
  | 'autoRoll'
  | 'optionalCombatKinds'
  | 'rolls'
  | 'fallbackRoll'
  | 'concentration'
  | 'concentrationOwnerActorId'
  | 'concentrationDependentActorIds'
  | 'characterClassFeatures'
  | 'characterPlay'
  | 'definitions'
  | 'seed'
> {
  /** The Run's actors, side by side 100 px apart from the first, which is the acting (current) actor. */
  actors: readonly EncounterRunActorState[]
  /** The Creature feature the acting actor's action comes from. */
  ownerFeatureId?: string
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
  const capability = config.ownerFeatureId
    ? discoverEncounterFeatureActionCapabilities({
        actor: source,
        conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
        abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
      }).find(
        (candidate) =>
          candidate.ownerFeatureId === config.ownerFeatureId &&
          candidate.grip === (config.grip ?? null)
      )
    : null
  if (config.ownerFeatureId && !capability) throw new Error('The feature has no discovered action.')
  const room = await movementRoom({
    ...config,
    moverActorId: source.id,
    positions: Object.fromEntries(
      config.actors.map((actor, index) => [actor.id, { x: 150 + index * 100, y: 150 }])
    )
  })

  /** A version-keyed read the room answers on the GM's socket. */
  async function readRoom<Kind extends EncounterReadDto['kind']>(
    read: Extract<EncounterReadDto, { kind: Kind }>
  ) {
    const requestId = crypto.randomUUID()
    const first = room.base.messages.length
    room.base.socket.send(JSON.stringify({ type: 'ENCOUNTER_READ', requestId, read }))
    const answer = await vi.waitFor(() => {
      const found = room.base.messages
        .slice(first)
        .find(
          (message) => message.type === 'ENCOUNTER_READ_RESULT' && message.requestId === requestId
        )
      if (found?.type !== 'ENCOUNTER_READ_RESULT')
        throw new Error('The room has not answered the read.')
      return found
    })
    if (answer.result.kind !== read.kind) throw new Error(`Expected the ${read.kind} answer.`)
    return answer.result.result as Extract<EncounterReadResultDto, { kind: Kind }>['result']
  }
  /** The actions the room offers the acting actor. */
  async function actionChoices() {
    const choices = await readRoom({
      kind: 'ACTION_CHOICES',
      input: { encounterId: room.encounterId, actorId: source.id }
    })
    if (!choices) throw new Error('The room offers no action choices.')
    return choices
  }
  const actionId = await (async () => {
    if (capability) return capability.actionId
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
    /** The acting actor's discovered action. */
    actionId,
    actionChoices,
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
    /** The acting actor's action at `targetActorId`; the room's answer, not yet checked. */
    async startAction(
      targetActorId: string,
      acknowledgedWarnings: ResolveEncounterActionInputDto['acknowledgedWarnings'] = [],
      sceneContext: ResolveEncounterActionInputDto['sceneContext'] = null,
      optionalCombatIntent: ResolveEncounterActionInputDto['optionalCombatIntent'] = null,
      chosenActionId = actionId
    ) {
      const command: ResolveEncounterActionInputDto = {
        type: 'RESOLVE_ACTION',
        acceptedWieldConflict: null,
        acknowledgedWarnings,
        encounterId: room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: await version(),
        actorId: source.id,
        targetActorId,
        actionId: chosenActionId,
        optionalCombatIntent,
        sceneContext
      }
      return { command, answer: await send(command) }
    },
    /** The room's own Optional Rule choice for the acting actor's action at `targetActorId`. */
    async optionalActionChoices(
      targetActorId: string,
      definitionId: string,
      sceneContext: ResolveEncounterActionInputDto['sceneContext'] = null
    ) {
      return readRoom({
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
      if (!('request' in decision.pending)) throw new Error('The decision holds no roll request.')
      return send({
        type: 'ROLL_RULE_EVIDENCE',
        encounterId: room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: decision.encounterVersion,
        occurrenceId: decision.occurrence.id,
        expectedOccurrenceVersion: decision.occurrence.version,
        requestId: decision.pending.request.requestId,
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
