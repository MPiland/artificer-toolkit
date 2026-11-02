import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { D20WindowReactionDieDto } from '@artificer-toolkit/schema/shared/ruleExecutionD20WindowOffer'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import {
  deadCharacterIdsOfTargets,
  isEncounterActorDefeated
} from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import {
  planNativeEncounterAreaSourceSpend,
  type NativeEncounterActionMechanicsInput
} from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { buildEncounterWindowReactionReceipt } from '@artificer-toolkit/rules-runtime/encounterActionReceipt'
import { evaluateEncounterActionTargetPolicy } from '@artificer-toolkit/rules-runtime/encounterActionTargetPolicy'
import { windowSpentReactions } from '@artificer-toolkit/rules-runtime/encounterD20Window'
import {
  EncounterValidationError,
  StaleCharacterActionError
} from '@artificer-toolkit/rules-runtime/encounterErrors'
import { encounterFacingRule } from '@artificer-toolkit/rules-runtime/encounterFacing'
import {
  encounterReactionPin,
  type EncounterReactionCandidate
} from '@artificer-toolkit/rules-runtime/encounterReactionChoice'
import { characterReactionCandidates } from '@artificer-toolkit/rules-runtime/encounterReactors'
import { encounterWindowReactionDie } from '@artificer-toolkit/rules-runtime/encounterWindowReactionDie'
import { discoverEncounterEventHooks } from '@artificer-toolkit/rules-runtime/events/encounterEventHooks'
import { resolveEncounterSceneGrid } from '@artificer-toolkit/rules-runtime/sceneGridPolicy'

import type { readNativeActionAreaScene } from './nativeAttackSceneLoaders.js'
import { evaluateNativeLiveActionEconomy } from './nativeEncounterActionEconomy.js'
import { nativeReactionCandidate, type NativeReaction } from './nativeEncounterReactionCandidate.js'
import type { prepareNativeLiveMovementTarget } from './nativeEncounterTargets.js'

type Prepared = NativeEncounterActionMechanicsInput['prepared']
type ReactorTarget = Awaited<ReturnType<typeof prepareNativeLiveMovementTarget>>['target']
type NativeActionScene = Awaited<ReturnType<typeof readNativeActionAreaScene>>
type PreparationInput = Parameters<typeof prepareEncounterActionMechanics>[0]

/** A reaction its holder could roll against another creature's attack roll now, with its die (D207). */
export type NativeRollReaction = NativeReaction<
  EncounterReactionCandidate<'ATTACK_ROLL_BY_OTHER'>,
  Prepared
> & { die: D20WindowReactionDieDto }

/**
 * Every reaction, by reactor actor id, that a Character other than the roller could roll against its
 * attack roll now (D207). A reaction is offered when its holder can afford it and is not suppressed
 * (D99), the roller meets its target requirements (seen, able to hear, not immune) and is within its
 * range on the Scene, and it authors a die to take from the roll. A defeated Character (D63) and one
 * with no token on the Scene offer nothing. The Scene is read only when some Character holds such a
 * reaction.
 */
export async function discoverNativeRollReactions(input: {
  state: EncounterRunState
  actors: readonly EncounterRunActorState[]
  system: SystemAuthoredDto
  roller: EncounterRunActorState
  movementTargets: ReadonlyMap<string, ReactorTarget>
  loadTarget(actor: EncounterRunActorState): Promise<ReactorTarget>
  /** The attack's Scene as the roll is made: its tokens measure each reaction's range. */
  loadScene(): Promise<Pick<NativeActionScene, 'sceneGrid' | 'tokens'>>
  /** The Scene's sight, which judges whether the reactor perceives the roller. */
  loadAttackPerception: NonNullable<PreparationInput['loadAttackPerception']>
  /** The action sources a reaction is prepared from, as the attack's own are. */
  actionSources: Pick<PreparationInput, 'loadSource' | 'loadRelationshipFacts'>
  capture: Parameters<typeof evaluateNativeLiveActionEconomy>[0]['capture']
}): Promise<NativeRollReaction[]> {
  const { state, roller, movementTargets, capture } = input
  const loadTarget = async (actor: EncounterRunActorState) =>
    movementTargets.get(actor.id) ?? (await input.loadTarget(actor))
  const holders = []
  for (const reactor of input.actors
    .filter((actor) => actor.kind === 'CHARACTER' && actor.id !== roller.id)
    .sort((left, right) => left.id.localeCompare(right.id))) {
    const reactorTarget = await loadTarget(reactor)
    if (isEncounterActorDefeated(reactor, deadCharacterIdsOfTargets([reactorTarget]))) continue
    const { reactions: hooks } = discoverEncounterEventHooks({
      reactions: characterReactionCandidates(reactorTarget),
      events: [{ kind: 'ATTACK_ROLLED_BY_OTHER' }]
    })
    if (hooks.length > 0) holders.push({ reactor, reactorTarget, hooks })
  }
  if (holders.length === 0) return []
  const scene = await input.loadScene()
  const rollerToken = scene.tokens.find((token) => token.actorId === roller.id)
  if (!rollerToken) return []
  const grid = resolveEncounterSceneGrid({ encounter: state, sceneGrid: scene.sceneGrid })
  const reactions: NativeRollReaction[] = []
  for (const { reactor, reactorTarget, hooks } of holders) {
    const reactorToken = scene.tokens.find((token) => token.actorId === reactor.id)
    if (!reactorToken) continue
    for (const {
      reaction: { actionId }
    } of hooks) {
      const prepared = await prepareEncounterActionMechanics({
        state,
        actor: reactor,
        target: roller,
        actors: input.actors,
        actionId,
        wieldConflictAcceptance: { kind: 'UNPROMPTED' },
        overridable: false,
        movementTargets: new Map(movementTargets).set(reactor.id, reactorTarget),
        sceneContext: null,
        loadAttackPerception: input.loadAttackPerception,
        ...input.actionSources
      }).catch((error: unknown) => {
        // A reaction its holder cannot pay for, or whose requirements the roller fails, is not offered.
        if (error instanceof StaleCharacterActionError || error instanceof EncounterValidationError)
          return null
        throw error
      })
      if (!prepared || prepared.source.kind !== 'CHARACTER_ACTION') continue
      const die = encounterWindowReactionDie(prepared)
      if (!die) continue
      const warnings = evaluateEncounterActionTargetPolicy({
        actor: prepared.actor,
        target: prepared.target,
        targetPolicy: prepared.targetPolicy,
        sceneContext: { grid, sourceToken: reactorToken, targetToken: rollerToken },
        makesAttackRoll: prepared.makesAttackRoll,
        facing: encounterFacingRule(state)
      })
      if (!warnings || warnings.some(({ code }) => code === 'TARGET_OUT_OF_RANGE')) continue
      const { economy, suppressed } = await evaluateNativeLiveActionEconomy({
        prepared,
        state,
        actionId,
        sourceTarget: reactorTarget,
        targetIds: [roller.id],
        capture
      })
      if (!economy?.available || suppressed) continue
      const candidate = nativeReactionCandidate({
        trigger: 'ATTACK_ROLL_BY_OTHER' as const,
        reactorActorId: reactor.id,
        source: prepared.source,
        actionId,
        consumption: economy.consumption,
        gameSystemId: state.gameSystemId
      })
      reactions.push({
        candidate,
        prepared,
        economy,
        die: { reaction: encounterReactionPin(candidate), ...die }
      })
    }
  }
  return reactions
}

/**
 * The dice the next reactor still to answer the roll's window offers: the first, by actor id, neither
 * answered nor already spent its reaction on this action. None once every reactor has answered.
 */
export function nextNativeRollReactionDice(
  reactions: readonly NativeRollReaction[],
  skippedActorIds: readonly string[]
) {
  const next = reactions.find(
    ({ candidate }) => !skippedActorIds.includes(candidate.reactorActorId)
  )?.candidate.reactorActorId
  return reactions
    .filter(({ candidate }) => candidate.reactorActorId === next)
    .map(({ die }) => die)
}

/**
 * What each reaction the settled rolls spent costs its reactor at the action's terminal commit: its
 * reaction and the charge it costs, planned against the reactor as it stands now.
 */
export function planNativeWindowReactions(input: {
  reactions: readonly NativeRollReaction[]
  execution: Parameters<typeof windowSpentReactions>[0]
  state: EncounterRunState
  occurrenceId: string
  commandId: string
  occurredAt: string
  userId: string
}) {
  return windowSpentReactions(input.execution).map((spent) => {
    const found = input.reactions.find(
      ({ die: { reaction } }) =>
        reaction.reactorActorId === spent.reactorActorId &&
        reaction.selectionChecksum === spent.selectionChecksum
    )
    if (!found) throw new Error('Reaction evidence is stale.')
    const spend = planNativeEncounterAreaSourceSpend(
      {
        prepared: found.prepared,
        encounterId: input.state.id,
        expectedEncounterVersion: input.state.version,
        occurrenceId: input.occurrenceId,
        sourceCommandId: input.commandId,
        commandId: input.commandId,
        occurredAt: input.occurredAt
      },
      input.userId
    )
    return {
      receipt: buildEncounterWindowReactionReceipt({
        reaction: found.die.reaction,
        spend,
        economy: found.economy.consumption
      }),
      resourceConsumption: found.prepared.characterActionState?.resourceConsumption ?? null,
      economy: found.economy.consumption
    }
  })
}
