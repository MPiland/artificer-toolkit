import type { EncounterEvidenceAnswer } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import { advanceEncounterListAttacks } from '@artificer-toolkit/rules-runtime/encounterAreaActionExecution'
import {
  holdEncounterAreaRay,
  markEncounterAreaSaveTested
} from '@artificer-toolkit/rules-runtime/encounterAreaPending'
import { withEncounterReactionDice } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { onHitCandidates } from '@artificer-toolkit/rules-runtime/character/characterOnHitCosts'
import { encounterOnHitAudit } from '@artificer-toolkit/rules-runtime/encounterOnHitChoice'
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
  reachCastPause,
  reachRollReactions
} from './nativeAreaPreparation.js'
import { type AreaTargetRecord, sealedListAttack } from './nativeAreaRevalidation.js'
import type { NativePauseAnswer } from './nativePauseTypes.js'

/**
 * Advances the ray whose turn it is through the single-target function, on the hit points the earlier
 * rays at its creature left it: with the caster's roll, with the answer to an offer its roll raised
 * (each creature's reaction to the rolled d20 in turn, its creature's reaction to the hit, then its
 * caster's on-hit rider), or past a reaction offer once the chosen reaction's child action committed
 * (D219). A roll or a hit a creature can react to, a reaction one chose and a hit its caster can add
 * a rider to leave the ray held on the offer in its own snapshot;
 * any other outcome keeps the ray's answer with every die it rolled. A rider is offered per hit, and
 * one that spends a slot or a pool is not offered once an earlier ray of the list chose such a one:
 * the cast settles one slot and one pool.
 */
export async function advanceAreaRay(
  input: ReachPlanInput,
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  entry: { prepared: AreaPrepared; sealed: AreaTargetRecord },
  step:
    | { kind: 'ROLL'; resolution: EncounterEvidenceAnswer }
    | {
        kind: 'ANSWER'
        answer: Extract<NativePauseAnswer, { kind: 'CAST_REACTION' | 'ON_HIT' }>
        /** The facts each answered ray was rolled against, kept if a reaction is used. */
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
  // The optional on-hit riders the caster could pay for at this ray's hit, as for an attack at one creature.
  const onHitNow =
    prepared.source.kind === 'CHARACTER_ACTION' && prepared.plan.kind === 'TEST_OUTCOME'
      ? onHitCandidates({
          riders: prepared.adapter.optionalOnHitRiders({
            compilerSource: prepared.plan.compilerSource
          }),
          settled: prepared.characterActionState,
          chosenBefore: context.targets
            .slice(0, index)
            .flatMap(({ onHit }) => (onHit?.option ? [onHit.option] : [])),
          spellSlots: prepared.source.effectivePolicyOutput.spellSlots,
          resources: prepared.source.effectivePolicyOutput.resources
        })
      : []
  // The dice the ray's own children rolled against its d20, as its snapshot records them: they join
  // the dice its roll may total (D219).
  const rolledChildDice = (inner.reactionChildren ?? []).flatMap(({ rolledDie }) =>
    rolledDie ? [rolledDie] : []
  )
  const ray = withEncounterReactionDice(prepared, rolledChildDice)
  let reach: Promise<AreaReach> | undefined
  const readReach = () => (reach ??= prepareReach(input))
  let rollReactions: ReturnType<typeof reachRollReactions> | undefined
  const occurredAt = new Date().toISOString()
  const chosen: Pick<
    Awaited<ReturnType<typeof advanceNativeActionTarget>>,
    'reactionChild' | 'chosenOnHit'
  > = { reactionChild: null, chosenOnHit: null }
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
        binding: ray.binding,
        attackSight: prepared.attackSight,
        rolls: null,
        host: async (actionSource) => {
          const advanced = await advanceNativeActionTarget({
            state: input.state,
            system: input.system,
            capture: input.capture,
            attack: ray,
            actionSource: {
              ...actionSource,
              // The ray's rolled d20 is held for each creature that may react to it, as one attack's is.
              rollReaction: {
                discover: async (heardReactorActorIds) =>
                  (
                    await (rollReactions ??= readReach().then((read) =>
                      reachRollReactions(input, read)
                    ))
                  ).discover(heardReactorActorIds)
              }
            },
            targetStateChecksum: checksumRuleDocument(prepared.target),
            prepareReaction: prepareReachReaction(
              input,
              prepared.target,
              // The reaction is its holder's action on itself, so it reads that creature alone.
              async () => new Map([[sealed.actorId, await input.loadTarget(prepared.target)]])
            ),
            onHitNow,
            pauseAnswer: step.kind === 'ANSWER' ? step.answer : null,
            resumedOffer: step.kind === 'RESUMED' ? step.offer : null,
            rolledChildDice,
            resume:
              step.kind === 'ROLL'
                ? {
                    pending: restoreEncounterActionPending(sealed.snapshot),
                    resolution: step.resolution
                  }
                : null
          })
          chosen.reactionChild = advanced.reactionChild
          chosen.chosenOnHit = advanced.chosenOnHit
          return advanced.execution
        }
      }
    ]
  })
  if (held) {
    const launched = chosen.reactionChild
      ? await reachCastPause(input, {
          reach: await readReach(),
          lead: prepared,
          chosenActorIds: null,
          occurrenceId: snapshot.occurrenceId,
          occurredAt,
          answer: null
        }).launchReactionChild(
          input.reactionChildren.recorded,
          chosen.reactionChild,
          chosen.reactionChild.targetActorId
        )
      : null
    return {
      snapshot: holdEncounterAreaRay(
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
          // A hit held on its rider once its reaction ran keeps the record of that reaction's child.
          ...((launched ?? inner).reactionChildren && {
            reactionChildren: (launched ?? inner).reactionChildren
          })
        }),
        // Only a chosen reaction's child changes the creature under the answered rays.
        launched && step.kind === 'ANSWER' ? step.testBindings : undefined
      ),
      reactionChild: launched?.reactionChild ?? null
    }
  }
  // A ray that left an offer keeps the d20 the offer held as its answer.
  const onHitOffer = inner.pause?.kind === 'ON_HIT' ? inner.pause.payload : null
  const reactionOffer = inner.pause?.kind === 'CAST_REACTION' ? inner.pause.payload : null
  const heldD20 =
    onHitOffer?.testD20 ?? reactionOffer?.hit?.originalD20 ?? reactionOffer?.rolled?.test.d20
  const answer: EncounterEvidenceAnswer | null =
    step.kind === 'ROLL'
      ? step.resolution
      : heldD20
        ? {
            kind: 'ENTER_DICE',
            requestId,
            rawFaces: heldD20.rawFaces,
            rollMode: heldD20.rollMode
          }
        : null
  if (!answer) throw new Error('The pending action evidence is invalid.')
  return {
    snapshot: markEncounterAreaSaveTested(snapshot, requestId, {
      testedJson: JSON.stringify(answer),
      rolls: settled.at(-1)?.rolls,
      ...(onHitOffer && {
        onHit: encounterOnHitAudit({ offer: onHitOffer, option: chosen.chosenOnHit })
      })
    }),
    reactionChild: null
  }
}
