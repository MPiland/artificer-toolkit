import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { serverAggregateChoicePendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { reactionOfferOptionId } from '@artificer-toolkit/schema/shared/ruleExecutionReactionOffer'
import { encounterActorEffectiveSize } from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import type { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { encounterActionSourceLabel } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { characterReactionCandidates } from '@artificer-toolkit/rules-runtime/encounterReactors'
import { reactionOfferOccurrenceId } from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import { discoverEncounterEventHooks } from '@artificer-toolkit/rules-runtime/events/encounterEventHooks'
import { REACTION_TRIGGERS } from '@artificer-toolkit/rules-runtime/events/reactionTriggers'
import { resolveEncounterSceneGrid } from '@artificer-toolkit/rules-runtime/sceneGridPolicy'

import {
  firstNativeReactorOffered,
  type CastScene,
  type ReactorTarget
} from './nativeEncounterCastReaction.js'
import { offerNativeReactions } from './nativeEncounterReactionCandidate.js'

type OfferInput = Parameters<typeof offerNativeReactions>[0]

/**
 * The reaction offers an attack that hit or missed leaves for its commit to queue (D219): one for the
 * attacked Character when it holds a reaction to the attack, with its menu. The event table decides
 * whether the attack meets a reaction's trigger: the outcome it names, a holder that sees the
 * attacker, an attacker of the size and within the distance it names. The reaction is prepared
 * against the attacker, which its own range and target requirements are held to. The offer keeps the
 * reactor's reaction allowance as read here; the room raises it later against committed state alone.
 * A defeated Character (D63) and one with no token on the Scene are offered nothing. The Scene is
 * read only for a holder of such a reaction, and sight only when the attack would otherwise meet it.
 */
export async function planNativeResolvedAttackOffers(input: {
  state: EncounterRunState
  attacker: EncounterRunActorState
  attackerTarget: ReactorTarget
  /** The creature the attack was made against. */
  attacked: EncounterRunActorState
  hit: boolean
  /** The attack's own command and the occurrence it settles, which the offer answers. */
  parentCommandId: string
  parentOccurrenceId: string
  /** The Scene the attack is made in, read from the attacker. */
  loadScene(): Promise<CastScene>
  loadTarget(actor: EncounterRunActorState): Promise<ReactorTarget>
  /** The Scene's sight, which judges whether the holder sees the attacker. */
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
}) {
  const { state, attacker, attackerTarget, parentCommandId } = input
  const found = await firstNativeReactorOffered({
    actors: [input.attacked],
    filter: { declinedReactorActorIds: [] },
    concerns: (actor) => actor.id !== attacker.id,
    loadTarget: input.loadTarget,
    offer: async (reactor, reactorTarget) => {
      const held = characterReactionCandidates(reactorTarget).filter(({ mechanicFacts }) => {
        const trigger = mechanicFacts.invocation.reactionTrigger
        return trigger && REACTION_TRIGGERS[trigger.kind].moment === 'ATTACK_RESOLVED_ON_HOLDER'
      })
      if (held.length === 0) return []
      const scene = await input.loadScene()
      const reactorToken = scene.tokens.find((token) => token.actorId === reactor.id)
      if (!reactorToken) return []
      const range = {
        grid: resolveEncounterSceneGrid({ encounter: state, sceneGrid: scene.sceneGrid }),
        sourceToken: reactorToken,
        targetToken: scene.sourceToken
      }
      const resolved = (attackerSeen: boolean) =>
        ({
          kind: 'ATTACK_RESOLVED_ON_HOLDER',
          gameSystemId: state.gameSystemId,
          hit: input.hit,
          attackerSeen,
          attackerSizeCode: encounterActorEffectiveSize(attackerTarget),
          attackerScene: range
        }) as const
      if (
        discoverEncounterEventHooks({ reactions: held, events: [resolved(true)] }).reactions
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
        events: [resolved(actual.attackerSeesTarget !== 'UNSEEN')],
        answering: undefined,
        prepare: (actionId) => input.prepareReaction(reactor, reactorTarget, actionId),
        admit: () => ({}),
        range,
        targetIds: [attacker.id],
        capture: input.capture
      })
    }
  })
  // A Character has one reaction a round, so every reaction of its menu spends the same allowance.
  const allowance = found?.reactions[0]?.candidate.allowance
  if (!found || !allowance) return []
  const reactorActorId = found.reactor.id
  return [
    serverAggregateChoicePendingSnapshotDtoSchema.parse({
      snapshotKind: 'AGGREGATE_CHOICE',
      schemaVersion: 1,
      occurrenceId: reactionOfferOccurrenceId(parentCommandId, reactorActorId),
      applicationContext: {
        kind: 'ENCOUNTER_REACTION_OFFER',
        schemaVersion: 1,
        parentCommandId,
        parentOccurrenceId: input.parentOccurrenceId,
        reactorActorId,
        attackerActorId: attacker.id,
        reactionAllowance: {
          definitionId: allowance.definitionId,
          beforeUsed: allowance.beforeUsed
        },
        options: found.reactions.map(({ candidate: { actionId }, prepared }) => ({
          optionId: reactionOfferOptionId({ parentCommandId, reactorActorId, actionId }),
          actionId,
          label: encounterActionSourceLabel(prepared.source)
        }))
      }
    })
  ]
}
