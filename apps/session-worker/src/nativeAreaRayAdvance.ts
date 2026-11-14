import type { EncounterEvidenceAnswer } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import {
  advanceEncounterListAttacks,
  prepareEncounterAreaTests
} from '@artificer-toolkit/rules-runtime/encounterAreaActionExecution'
import {
  encounterAreaSaveAwaiting,
  holdEncounterAreaRay,
  markEncounterAreaSaveTested,
  resealEncounterAreaTargets
} from '@artificer-toolkit/rules-runtime/encounterAreaPending'
import { onHitCandidates } from '@artificer-toolkit/rules-runtime/character/characterOnHitCosts'
import { snapshotCreatureTypeId } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { encounterOnHitAudit } from '@artificer-toolkit/rules-runtime/encounterOnHitChoice'
import {
  buildEncounterActionPendingSnapshot,
  buildEncounterHeldActionPendingSnapshot,
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
import {
  type AreaTargetRecord,
  discoverNativeLegendaryResistance,
  sealedListAttack
} from './nativeAreaRevalidation.js'
import { applyNativeReactionChildren } from './nativeEncounterCastPause.js'
import type { NativeCastReactionAnswer } from './nativeEncounterCastReaction.js'
import {
  advanceNativeIncomingGate,
  type NativeIncomingGateAnswer
} from './nativeEncounterIncomingGate.js'
import type { NativePauseAnswer } from './nativePauseTypes.js'

/**
 * Hears the creatures beside a ray's aim at another creature before its d20 (D217), in the window
 * one attack's aim is heard in: as the ray's turn comes (`OPEN`), with a creature's answer to the
 * offer, or past the offer once the reaction chosen from it committed as its holder's own child
 * action (D219). The ray is held in its own snapshot on each creature's offer in turn, and on the
 * answered offer while its child runs. Once nobody is left to ask, a ray that was held is sealed
 * again for its caster's roll, under the roll mode its reactions imposed.
 */
export async function advanceAreaRayAim(
  input: ReachPlanInput,
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  entry: { prepared: AreaPrepared; sealed: AreaTargetRecord },
  reach: AreaReach,
  step:
    | { kind: 'OPEN' }
    | {
        kind: 'ANSWER'
        answer: NativeCastReactionAnswer
        /** The facts each answered ray was rolled against, kept if a reaction is used. */
        testBindings: ReadonlyMap<string, string>
      }
    | { kind: 'RESUMED' }
    /** The caster's roll of the incoming gate the ray is held on. */
    | { kind: 'GATE'; answer: NativeIncomingGateAnswer }
) {
  const { prepared } = entry
  const context = snapshot.applicationContext
  const ray =
    context.kind === 'ENCOUNTER_AREA_ACTION'
      ? context.targets.find(
          (target) => target.snapshot.occurrenceId === entry.sealed.snapshot.occurrenceId
        )
      : undefined
  const inner = ray?.snapshot.applicationContext
  if (context.kind !== 'ENCOUNTER_AREA_ACTION' || !ray || inner?.kind !== 'ENCOUNTER_ACTION')
    throw new Error('The pending action evidence is invalid.')
  const gateHeld = inner.pause?.kind === 'INCOMING_GATE'
  // A ray is aimed once, as its turn to be rolled comes; a save is never aimed.
  if (
    step.kind === 'OPEN' &&
    (!prepared.makesAttackRoll || gateHeld || encounterAreaSaveAwaiting(context, ray) !== 'ROLL')
  )
    return { snapshot, reactionChild: null }
  if (step.kind === 'GATE' && !gateHeld) throw new Error('The pending action evidence is invalid.')
  // Every ray is its own attack, so each owes the incoming gate of the creature it is aimed at before
  // its aim is heard: a pass is kept with that ray alone, and a ray that fails is lost while the
  // list goes on.
  let { passedIncomingGate } = inner
  if ((step.kind === 'OPEN' || step.kind === 'GATE') && ray.actorId !== context.casterActorId) {
    const gate = await advanceNativeIncomingGate({
      runtime: input.runtime,
      random: input.random,
      gameSystemId: input.state.gameSystemId,
      occurrenceId: ray.snapshot.occurrenceId,
      owed: {
        kind: 'WARD',
        holderActorId: ray.actorId,
        holderEffects: input.activeEffectsByActorId.get(ray.actorId) ?? [],
        holderGrantFold:
          (reach.movementTargets.get(ray.actorId) ?? (await input.loadTarget(prepared.target)))
            .effectiveRulePolicyOutput?.grantFold ?? null,
        attackerCreatureTypeId: snapshotCreatureTypeId(reach.caster),
        owner: async (ownerActorId) => {
          const owner = input.actors.find((actor) => actor.id === ownerActorId)
          return owner
            ? (reach.movementTargets.get(owner.id) ?? (await input.loadTarget(owner)))
            : null
        }
      },
      attacker: reach.casterFacts,
      autoRoll: input.requireAutoRoll(context.casterActorId),
      passed: passedIncomingGate,
      answer: step.kind === 'GATE' ? step.answer : null
    })
    if (gate.kind === 'PENDING')
      return {
        snapshot: holdEncounterAreaRay(
          snapshot,
          ray.snapshot.request.requestId,
          buildEncounterHeldActionPendingSnapshot({
            continuation: gate.continuation,
            pause: gate.pause,
            rollerActorId: gate.rollerActorId,
            optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum,
            commandJson: context.commandJson,
            commandFingerprint: context.commandFingerprint,
            initiatorUserId: context.initiatorUserId,
            currentnessChecksum: inner.currentnessChecksum
          })
        ),
        reactionChild: null
      }
    if (gate.kind === 'FAILED') {
      const requestId = ray.snapshot.request.requestId
      const { rawFaces, rollMode } = gate.gate.d20
      const lostRoll: EncounterEvidenceAnswer = {
        kind: 'ENTER_DICE',
        requestId,
        rawFaces,
        rollMode
      }
      return {
        snapshot: markEncounterAreaSaveTested(snapshot, requestId, {
          testedJson: JSON.stringify(lostRoll),
          lost: { gate: gate.gate }
        }),
        reactionChild: null
      }
    }
    if (gate.kind === 'PASSED') passedIncomingGate = gate.gate
  }
  const aimed = await reachCastPause(input, {
    reach,
    lead: prepared,
    chosenActorIds: null,
    occurrenceId: ray.snapshot.occurrenceId,
    occurredAt: new Date().toISOString(),
    answer: step.kind === 'ANSWER' ? step.answer : null,
    ray: {
      recorded: inner.reactionChildren ?? [],
      resumedOffer: step.kind === 'RESUMED' ? input.reactionChildren.resumedOffer : null
    }
  }).advanceAimed()
  if (aimed.kind === 'CAST_PENDING')
    return {
      snapshot: holdEncounterAreaRay(
        snapshot,
        ray.snapshot.request.requestId,
        buildEncounterHeldActionPendingSnapshot({
          continuation: aimed.continuation,
          pause: aimed.pause,
          rollerActorId: aimed.rollerActorId,
          optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum,
          commandJson: context.commandJson,
          commandFingerprint: context.commandFingerprint,
          initiatorUserId: context.initiatorUserId,
          currentnessChecksum: inner.currentnessChecksum,
          passedIncomingGate,
          reactionChildren: aimed.reactionChildren
        }),
        // Only a chosen reaction's child changes the creature under the answered rays.
        aimed.reactionChild && step.kind === 'ANSWER' ? step.testBindings : undefined
      ),
      reactionChild: aimed.reactionChild
    }
  // Nobody was asked and no gate was passed now, so the ray's sealed roll stands.
  if (step.kind === 'OPEN' && passedIncomingGate === inner.passedIncomingGate)
    return { snapshot, reactionChild: null }
  const [test] = await prepareEncounterAreaTests({
    runtime: input.runtime,
    random: input.random,
    adapter: prepared.adapter,
    plan: prepared.plan,
    occurrenceId: snapshot.occurrenceId,
    targets: [
      {
        actorId: ray.actorId,
        occurrenceId: ray.snapshot.occurrenceId,
        binding: applyNativeReactionChildren(
          input.reactionChildren.committed,
          aimed.reactionChildren
        )(prepared).binding,
        attackSight: prepared.attackSight,
        autoRoll: { SOURCE: false, TARGET: false },
        discoverLegendaryResistance: discoverNativeLegendaryResistance(input, prepared)
      }
    ]
  })
  if (test?.kind !== 'PENDING') throw new Error('An area roll must wait for its roller.')
  const sealedAgain = buildEncounterActionPendingSnapshot({
    execution: test.pending,
    optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum,
    commandJson: context.commandJson,
    commandFingerprint: context.commandFingerprint,
    initiatorUserId: context.initiatorUserId,
    sourceActorId: context.casterActorId,
    targetActorId: ray.actorId,
    currentnessChecksum: inner.currentnessChecksum,
    passedIncomingGate,
    reactionChildren: aimed.reactionChildren
  })
  return {
    snapshot: resealEncounterAreaTargets(
      snapshot,
      context.targets.map((target) => (target === ray ? sealedAgain : target.snapshot))
    ),
    reactionChild: null
  }
}

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
  // The ray's own children, as its snapshot records them, change its roll as one attack's do: the
  // mode one imposed before its d20 (D217), and the dice they rolled against it, which join the dice
  // its roll may total (D219).
  const rolledChildDice = (inner.reactionChildren ?? []).flatMap(({ rolledDie }) =>
    rolledDie ? [rolledDie] : []
  )
  const ray = applyNativeReactionChildren(
    input.reactionChildren.committed,
    inner.reactionChildren ?? []
  )(prepared)
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
        // A ray lost at the creature's incoming gate did nothing to it.
        .filter((target) => target.actorId === sealed.actorId && !target.lost)
        .map((earlier) => sealedListAttack(earlier, prepared, input.reactionChildren.committed)),
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
          passedIncomingGate: inner.passedIncomingGate,
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
