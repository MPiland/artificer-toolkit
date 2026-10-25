import type { MoveHeldEffectInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { liveSessionEncounterMoveHeldEffectCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { isEncounterActorDefeated } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { evaluateEncounterActionTargetPolicy } from '@artificer-toolkit/rules-runtime/encounterActionTargetPolicy'
import {
  effectOfferTargetPolicy,
  resolveEffectOffer
} from '@artificer-toolkit/rules-runtime/encounterEffectOffers'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { resolveEncounterSceneGrid } from '@artificer-toolkit/rules-runtime/sceneGridPolicy'
import { encounterFacingRule } from '@artificer-toolkit/rules-runtime/encounterFacing'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects
} from './nativeEncounterTargets.js'
import {
  admitNativeLiveHolderCommand,
  spendNativeHolderActivation
} from './nativeHolderActivation.js'

const refusal = (reason: 'SOURCE_REQUIREMENTS_NOT_MET' | 'TARGET_UNAVAILABLE', message: string) =>
  new LiveSessionDomainRejectionError(422, { code: 'DOMAIN_REJECTED', reason, message })

/**
 * Plans the current actor moving an effect it is offered (D160) to another actor: the offer is
 * re-read live (a spent, ended or no longer applicable one is refused), the new holder is held to
 * the offer's range, and the actor pays the offer's activation. Convex re-derives the offer from the
 * stored effect, moves the record and records the plan; it evaluates none of it.
 */
export async function planNativeLiveMoveHeldEffect(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  command: MoveHeldEffectInputDto,
  executionOptions: { captures: LiveCaptureReads; random(maximum: number): number }
) {
  const admitted = await admitNativeLiveHolderCommand(scope, command, executionOptions.captures)
  if (admitted.kind === 'REPLAY') return admitted
  const { initial, reads, ready, state } = admitted
  const { capture } = reads
  const root = ready.command
  if (root.type !== 'MOVE_HELD_EFFECT') throw new Error('The effect move is unavailable.')
  const { actors, activeEffectsByActorId, deadCharacterIds } = await readNativeLiveActorsAndEffects(
    { state, capture }
  )
  const actor = actors.find((entry) => entry.id === root.actorId)
  const newHolder = actors.find((entry) => entry.id === root.target.actorId)
  if (!actor || !newHolder) throw new Error('Effect-move actor is unavailable.')
  const heldBy = actors.find((entry) =>
    activeEffectsByActorId.get(entry.id)?.some((effect) => effect.id === root.effectId)
  )
  const prepare = (target: typeof actor) =>
    prepareNativeLiveMovementTarget({
      scope: initial,
      state,
      actor: target,
      activeEffectsByActorId,
      ...executionOptions
    })
  const prepared = await prepare(actor)
  reads.observe(prepared.revisions)
  const heldByPrepared = heldBy ? await prepare(heldBy) : null
  if (heldByPrepared) reads.observe(heldByPrepared.revisions)
  let offer: ReturnType<typeof resolveEffectOffer>
  try {
    offer = resolveEffectOffer({
      actorId: actor.id,
      effectsByHolder: activeEffectsByActorId,
      zeroHitPointActorIds: new Set(
        heldBy && heldByPrepared?.target.state.current === 0 ? [heldBy.id] : []
      ),
      effectId: root.effectId,
      offerIndex: root.offerIndex,
      kind: 'MOVE_HELD_EFFECT'
    })
  } catch {
    throw refusal('SOURCE_REQUIREMENTS_NOT_MET', 'That effect can no longer be moved.')
  }
  if (newHolder.id === offer.holderActorId || isEncounterActorDefeated(newHolder, deadCharacterIds))
    throw refusal('TARGET_UNAVAILABLE', "That creature can't take the effect.")
  const capturedScene = root.sceneContext
    ? await capture({
        kind: 'ACTION_SCENE',
        command: {
          actorId: actor.id,
          targetActorId: newHolder.id,
          sceneContext: root.sceneContext
        }
      })
    : null
  if (capturedScene && capturedScene.kind !== 'ACTION_SCENE')
    throw new Error('Action Scene context is unavailable.')
  const sceneInputs = capturedScene?.context ?? null
  const rangeWarnings = evaluateEncounterActionTargetPolicy({
    actor,
    target: newHolder,
    targetPolicy: effectOfferTargetPolicy(offer.range),
    sceneContext: sceneInputs && {
      ...sceneInputs,
      grid: resolveEncounterSceneGrid({
        encounter: state,
        sceneGrid: sceneInputs.sceneGrid
      })
    },
    makesAttackRoll: false,
    facing: encounterFacingRule(state)
  })
  if (!rangeWarnings) throw refusal('TARGET_UNAVAILABLE', "That creature can't take the effect.")
  const { actionEconomy, warnings, spent } = await spendNativeHolderActivation({
    actor,
    state,
    holder: prepared.target,
    activation: { code: offer.activation, amount: 1 },
    acknowledgedWarnings: root.acknowledgedWarnings,
    extraWarnings: rangeWarnings,
    capture
  })
  const facts = buildEncounterActorRuleFacts({ actors })
  const nextFacts = buildEncounterActorRuleFacts({
    actors: actors.map((entry) => (entry.id === spent.id ? spent : entry))
  })
  return {
    kind: 'PLANNED' as const,
    input: liveSessionEncounterMoveHeldEffectCommitInputSchema.parse({
      ...scope,
      command: root,
      revisions: reads.revisions(),
      occurredAt: new Date().toISOString(),
      actionEconomy,
      ruleOverrides: warnings,
      rules: reconcileEncounterActorRuleOutput(
        evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts: nextFacts }),
        nextFacts,
        {
          output: reconcileEncounterActorRuleOutput(
            evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
            facts
          )
        }
      )
    })
  }
}
