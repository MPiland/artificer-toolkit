import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterActorEffectiveSize } from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import type { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { characterReactionCandidates } from '@artificer-toolkit/rules-runtime/encounterReactors'
import { discoverEncounterEventHooks } from '@artificer-toolkit/rules-runtime/events/encounterEventHooks'
import { REACTION_TRIGGERS } from '@artificer-toolkit/rules-runtime/events/reactionTriggers'
import { resolveEncounterSceneGrid } from '@artificer-toolkit/rules-runtime/sceneGridPolicy'

import {
  firstNativeReactorOffered,
  type CastReactionDiscovery,
  type CastScene,
  type NativeCastResponse,
  type ReactorTarget
} from './nativeEncounterCastReaction.js'
import { offerNativeReactions } from './nativeEncounterReactionCandidate.js'

type OfferInput = Parameters<typeof offerNativeReactions>[0]

/**
 * The roll mode a reaction authors to impose on the roll it answers, if it authors one. The roll takes
 * it once the reaction's own action committed that outcome (D219).
 */
export const authoredImposedRollMode = ({ mechanicFacts }: OfferInput['held'][number]) =>
  mechanicFacts.outcomes.flatMap((outcome) =>
    'imposedRollMode' in outcome && outcome.imposedRollMode ? [outcome.imposedRollMode] : []
  )[0]

/**
 * The first Character, by actor id, beside an attack aimed at another creature that holds a reaction to
 * it (Protection, D217), with its menu, before the attack's d20 is rolled. The event table decides
 * whether the attack meets a reaction's trigger: its holder sees the attacker, the attack's target is
 * within the trigger's distance of the holder, the holder has the equipment it names equipped. The
 * reaction is prepared against the attacker, which its own range and target requirements are held to,
 * and is offered when it authors a roll mode to impose on the attack's roll; the roll takes that mode
 * only from the reaction's own committed action (D219). The attacker, the attack's
 * target, a defeated Character (D63) and one with no token on the Scene offer nothing. The Scene is
 * read only for a holder of such a reaction, and sight only when the attack would otherwise meet it.
 */
export function discoverNativeAimedReactions(input: {
  state: EncounterRunState
  actors: readonly EncounterRunActorState[]
  attacker: EncounterRunActorState
  attackerTarget: ReactorTarget
  /** The creature the attack is aimed at. */
  attacked: EncounterRunActorState
  /** The Scene the attack is made in, read from the attacker only when a Character holds such a reaction. */
  loadScene(): Promise<CastScene>
  loadTarget(actor: EncounterRunActorState): Promise<ReactorTarget>
  /** The Scene's sight, which judges whether a holder sees the attacker. */
  loadAttackPerception: NonNullable<
    Parameters<typeof prepareEncounterActionMechanics>[0]['loadAttackPerception']
  >
  /** The reaction prepared against the attacker. */
  prepareReaction(
    reactor: EncounterRunActorState,
    reactorTarget: ReactorTarget,
    actionId: string
  ): ReturnType<OfferInput['prepare']>
  capture: OfferInput['capture']
}): CastReactionDiscovery<NativeCastResponse> {
  const { state, attacker, attackerTarget } = input
  return (filter) =>
    firstNativeReactorOffered({
      actors: input.actors,
      filter,
      concerns: (actor) => actor.id !== attacker.id && actor.id !== input.attacked.id,
      loadTarget: input.loadTarget,
      offer: async (reactor, reactorTarget) => {
        const held = characterReactionCandidates(reactorTarget).filter(({ mechanicFacts }) => {
          const trigger = mechanicFacts.invocation.reactionTrigger
          return trigger && REACTION_TRIGGERS[trigger.kind].moment === 'ATTACK_AIMED_AT_OTHER'
        })
        if (held.length === 0) return []
        const scene = await input.loadScene()
        const grid = resolveEncounterSceneGrid({ encounter: state, sceneGrid: scene.sceneGrid })
        const tokenOf = (actorId: string) =>
          actorId === attacker.id
            ? scene.sourceToken
            : scene.tokens.find((token) => token.actorId === actorId)
        const attackedToken = tokenOf(input.attacked.id)
        const reactorToken = tokenOf(reactor.id)
        if (!attackedToken || !reactorToken) return []
        const rules = reactorTarget.characterFacts?.ruleEvaluation
        const equipped = new Set(rules?.output.grantFold.activeEquipmentInstanceIds)
        const aimed = (attackerSeen: boolean) =>
          ({
            kind: 'ATTACK_AIMED_AT_OTHER',
            gameSystemId: state.gameSystemId,
            attackerSeen,
            attackerSizeCode: encounterActorEffectiveSize(attackerTarget),
            targetScene: { grid, sourceToken: reactorToken, targetToken: attackedToken },
            holderEquippedCategories: (rules?.facts.armorClassFacts?.equipment ?? []).flatMap(
              ({ itemInstanceId, category }) => (equipped.has(itemInstanceId) ? [category] : [])
            )
          }) as const
        if (
          discoverEncounterEventHooks({ reactions: held, events: [aimed(true)] }).reactions
            .length === 0
        )
          return []
        const { actual } = await input.loadAttackPerception({
          sourceFacts: reactorTarget,
          targetFacts: attackerTarget,
          roller: 'ATTACKER'
        })
        return offerNativeReactions({
          state,
          reactorActorId: reactor.id,
          reactorTarget,
          held,
          events: [aimed(actual.attackerSeesTarget !== 'UNSEEN')],
          answering: filter.answering?.actionId,
          prepare: (actionId) => input.prepareReaction(reactor, reactorTarget, actionId),
          // A reaction's receipt carries no pool spend, so one paid from a pool would never use it up.
          admit: ({ source, characterActionState }) =>
            source.kind === 'CHARACTER_ACTION' &&
            !characterActionState?.resourceConsumption &&
            authoredImposedRollMode(source.candidate)
              ? {}
              : null,
          range: { grid, sourceToken: reactorToken, targetToken: scene.sourceToken },
          targetIds: [attacker.id],
          capture: input.capture
        })
      }
    })
}
