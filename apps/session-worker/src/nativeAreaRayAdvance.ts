import type { EncounterEvidenceAnswer } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import { advanceEncounterListAttacks } from '@artificer-toolkit/rules-runtime/encounterAreaActionExecution'
import {
  holdEncounterAreaRayReaction,
  markEncounterAreaSaveTested
} from '@artificer-toolkit/rules-runtime/encounterAreaPending'
import {
  buildEncounterActionPendingSnapshot,
  restoreEncounterActionPending
} from '@artificer-toolkit/rules-runtime/encounterActionPendingSnapshot'
import type { ServerAggregateChoicePendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { EncounterCastReactionOfferDto } from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { advanceNativeActionTarget } from './nativeActionTargetAdvance.js'
import {
  type AreaPrepared,
  type AreaReach,
  type ReachPlanInput,
  prepareReach,
  prepareReachReaction,
  reachCastPause
} from './nativeAreaPreparation.js'
import { type AreaTargetRecord, sealedListAttack } from './nativeAreaRevalidation.js'
import type { NativeCastReactionAnswer } from './nativeEncounterCastReaction.js'

/**
 * Advances the ray whose turn it is through the single-target function, on the hit points the earlier
 * rays at its creature left it: with the caster's roll, with its creature's answer to the reaction
 * offer its hit raised, or past that offer once the chosen reaction's child action committed (D219).
 * A hit its creature can react to, and a reaction it chose, leave the ray held on the offer in its
 * own snapshot; any other outcome keeps the ray's answer with every die it rolled.
 */
export async function advanceAreaRay(
  input: ReachPlanInput,
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  entry: { prepared: AreaPrepared; sealed: AreaTargetRecord },
  step:
    | { kind: 'ROLL'; resolution: EncounterEvidenceAnswer }
    | {
        kind: 'REACTION'
        answer: NativeCastReactionAnswer
        /** The facts each answered ray was rolled against, kept if the reaction is used. */
        testBindings: ReadonlyMap<string, string>
      }
    | { kind: 'RESUMED'; offer: EncounterCastReactionOfferDto }
) {
  const { prepared, sealed } = entry
  const context = snapshot.applicationContext
  const inner = sealed.snapshot.applicationContext
  if (context.kind !== 'ENCOUNTER_AREA_ACTION' || inner.kind !== 'ENCOUNTER_ACTION')
    throw new Error('The pending action evidence is invalid.')
  const requestId = sealed.snapshot.request.requestId
  const index = context.targets.findIndex(
    (target) => target.snapshot.request.requestId === requestId
  )
  let reach: Promise<AreaReach> | undefined
  const readReach = () => (reach ??= prepareReach(input))
  const occurredAt = new Date().toISOString()
  const chosen: { child: Awaited<ReturnType<typeof advanceNativeActionTarget>>['reactionChild'] } =
    { child: null }
  const { settled, held } = await advanceEncounterListAttacks({
    runtime: input.runtime,
    random: input.random,
    adapter: prepared.adapter,
    plan: prepared.plan,
    occurrenceId: snapshot.occurrenceId,
    attacks: [
      ...context.targets
        .slice(0, index)
        .filter((target) => target.actorId === sealed.actorId)
        .map((earlier) => sealedListAttack(earlier, prepared)),
      {
        actorId: sealed.actorId,
        occurrenceId: sealed.snapshot.occurrenceId,
        binding: prepared.binding,
        attackSight: prepared.attackSight,
        rolls: null,
        host: async (actionSource) => {
          const advanced = await advanceNativeActionTarget({
            state: input.state,
            system: input.system,
            capture: input.capture,
            attack: prepared,
            actionSource,
            targetStateChecksum: checksumRuleDocument(prepared.target),
            prepareReaction: prepareReachReaction(
              input,
              prepared.target,
              // The reaction is its holder's action on itself, so it reads that creature alone.
              async () => new Map([[sealed.actorId, await input.loadTarget(prepared.target)]])
            ),
            onHitNow: [],
            pauseAnswer:
              step.kind === 'REACTION' ? { kind: 'CAST_REACTION', answer: step.answer } : null,
            resumedOffer: step.kind === 'RESUMED' ? step.offer : null,
            resume:
              step.kind === 'ROLL'
                ? {
                    pending: restoreEncounterActionPending(sealed.snapshot),
                    resolution: step.resolution
                  }
                : null
          })
          chosen.child = advanced.reactionChild
          return advanced.execution
        }
      }
    ]
  })
  if (held) {
    const launched = chosen.child
      ? await reachCastPause(input, {
          reach: await readReach(),
          lead: prepared,
          chosenActorIds: null,
          occurrenceId: snapshot.occurrenceId,
          occurredAt,
          answer: null
        }).launchReactionChild(
          input.reactionChildren.recorded,
          chosen.child,
          chosen.child.holderActorId
        )
      : null
    return {
      snapshot: holdEncounterAreaRayReaction(
        snapshot,
        requestId,
        buildEncounterActionPendingSnapshot({
          execution: held,
          optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum,
          commandJson: context.commandJson,
          commandFingerprint: context.commandFingerprint,
          initiatorUserId: context.initiatorUserId,
          sourceActorId: context.casterActorId,
          targetActorId: sealed.actorId,
          currentnessChecksum: inner.currentnessChecksum,
          ...(launched && { reactionChildren: launched.reactionChildren })
        }),
        step.kind === 'REACTION' ? step.testBindings : undefined
      ),
      reactionChild: launched?.reactionChild ?? null
    }
  }
  // A ray that left its hit's offer keeps the d20 the offer held as its answer.
  const hit = inner.pause?.kind === 'CAST_REACTION' ? inner.pause.payload.hit : undefined
  const answer: EncounterEvidenceAnswer | null =
    step.kind === 'ROLL'
      ? step.resolution
      : hit
        ? {
            kind: 'ENTER_DICE',
            requestId,
            rawFaces: hit.originalD20.rawFaces,
            rollMode: hit.originalD20.rollMode
          }
        : null
  if (!answer) throw new Error('The pending action evidence is invalid.')
  return {
    snapshot: markEncounterAreaSaveTested(snapshot, requestId, {
      testedJson: JSON.stringify(answer),
      rolls: settled.at(-1)?.rolls
    }),
    reactionChild: null
  }
}
