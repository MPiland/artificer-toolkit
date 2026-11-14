import type { LiveSessionReactionAncestor } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import {
  deadCharacterIdsOfTargets,
  isEncounterActorDefeated
} from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import type { NativeEncounterActionMechanicsInput } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import type { EncounterActionRollReaction } from '@artificer-toolkit/rules-runtime/encounterActionRollReaction'
import type { EncounterReactionCandidate } from '@artificer-toolkit/rules-runtime/encounterReactionChoice'
import { characterReactionCandidates } from '@artificer-toolkit/rules-runtime/encounterReactors'
import { discoverEncounterEventHooks } from '@artificer-toolkit/rules-runtime/events/encounterEventHooks'
import { resolveEncounterSceneGrid } from '@artificer-toolkit/rules-runtime/sceneGridPolicy'

import type { readNativeActionAreaScene } from './nativeAttackSceneLoaders.js'
import type { evaluateNativeLiveActionEconomy } from './nativeEncounterActionEconomy.js'
import { offerNativeReactions, type NativeReaction } from './nativeEncounterReactionCandidate.js'
import type { prepareNativeLiveMovementTarget } from './nativeEncounterTargets.js'

type Prepared = NativeEncounterActionMechanicsInput['prepared']
type ReactorTarget = Awaited<ReturnType<typeof prepareNativeLiveMovementTarget>>['target']
type NativeActionScene = Awaited<ReturnType<typeof readNativeActionAreaScene>>
type PreparationInput = Parameters<typeof prepareEncounterActionMechanics>[0]

/** A reaction its holder could use against another creature's attack roll now, to roll a die from it (D219). */
export type NativeRollReaction = NativeReaction<EncounterReactionCandidate, Prepared>

/**
 * The turns `reactions` take at a rolled attack d20 (D219): the roll is held for each reactor in turn,
 * by actor id. A creature whose reaction a held action above this one spent (`ancestors`) has been
 * heard, like one that declined.
 */
export const nativeRollReactionTurns = (
  reactions: readonly NativeRollReaction[],
  ancestors: readonly Pick<LiveSessionReactionAncestor, 'actorId' | 'reaction'>[]
): EncounterActionRollReaction => ({
  discover: async (heardReactorActorIds) => {
    const heard = [
      ...heardReactorActorIds,
      ...ancestors.flatMap(({ actorId, reaction }) => (reaction ? [actorId] : []))
    ]
    const next = reactions.find(({ candidate }) => !heard.includes(candidate.reactorActorId))
      ?.candidate.reactorActorId
    return reactions
      .filter(({ candidate }) => candidate.reactorActorId === next)
      .map(({ candidate }) => candidate)
  }
})

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
  /**
   * The attack's Scene as the roll is made: its tokens measure each reaction's range from the roller's
   * own token, which each caller has already required of the attack.
   */
  loadScene(): Promise<
    Pick<NativeActionScene, 'sceneGrid' | 'tokens'> & {
      rollerToken: NativeActionScene['sourceToken']
    }
  >
  /** The Scene's sight, which judges whether the reactor perceives the roller. */
  loadAttackPerception: NonNullable<PreparationInput['loadAttackPerception']>
  /** The action sources a reaction is prepared from, as the attack's own are. */
  actionSources: Pick<PreparationInput, 'loadSource' | 'loadRelationshipFacts'>
  capture: Parameters<typeof evaluateNativeLiveActionEconomy>[0]['capture']
}): Promise<NativeRollReaction[]> {
  const { state, roller, movementTargets, capture } = input
  const loadTarget = async (actor: EncounterRunActorState) =>
    movementTargets.get(actor.id) ?? (await input.loadTarget(actor))
  const events = [{ kind: 'ATTACK_ROLLED_BY_OTHER' }] as const
  const holders = []
  for (const reactor of input.actors
    .filter((actor) => actor.kind === 'CHARACTER' && actor.id !== roller.id)
    .sort((left, right) => left.id.localeCompare(right.id))) {
    const reactorTarget = await loadTarget(reactor)
    if (isEncounterActorDefeated(reactor, deadCharacterIdsOfTargets([reactorTarget]))) continue
    const held = characterReactionCandidates(reactorTarget)
    if (discoverEncounterEventHooks({ reactions: held, events }).reactions.length > 0)
      holders.push({ reactor, reactorTarget, held })
  }
  if (holders.length === 0) return []
  const scene = await input.loadScene()
  const { rollerToken } = scene
  const grid = resolveEncounterSceneGrid({ encounter: state, sceneGrid: scene.sceneGrid })
  const reactions: NativeRollReaction[] = []
  for (const { reactor, reactorTarget, held } of holders) {
    const reactorToken = scene.tokens.find((token) => token.actorId === reactor.id)
    if (!reactorToken) continue
    const offered = await offerNativeReactions({
      state,
      reactorActorId: reactor.id,
      reactorTarget,
      held,
      events,
      answering: undefined,
      prepare: (actionId) =>
        prepareEncounterActionMechanics({
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
        }),
      admit: ({ source }) =>
        source.kind === 'CHARACTER_ACTION' &&
        source.candidate.mechanicFacts.outcomes.some(
          (outcome) => 'rolledDie' in outcome && outcome.rolledDie
        )
          ? {}
          : null,
      range: { grid, sourceToken: reactorToken, targetToken: rollerToken },
      targetIds: [roller.id],
      capture
    })
    reactions.push(...offered)
  }
  return reactions
}
