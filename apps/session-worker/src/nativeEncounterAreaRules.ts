import {
  type RemoveAreaTargetInputDto,
  type ResolveEncounterActionInputDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { EncounterSealedChoiceSelection } from '@artificer-toolkit/rules-runtime/encounterSealedChoice'
import { encounterFacingRule } from '@artificer-toolkit/rules-runtime/encounterFacing'
import type { ServerAggregateChoicePendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import type { EncounterEvidenceAnswer } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import type { EncounterActionWindowAnswer } from '@artificer-toolkit/rules-runtime/encounterActionSaveWindow'
import {
  openEncounterAreaDamageRollWindow,
  type EncounterDamageRerollAnswer
} from '@artificer-toolkit/rules-runtime/encounterDamageRollWindow'
import { initiativeActionOrder } from '@artificer-toolkit/rules-runtime/encounterInitiativeCursor'
import { isD20RolledCheck } from '@artificer-toolkit/schema/shared/ruleExecutionD20WindowOffer'
import { isDamageRollWindow } from '@artificer-toolkit/schema/shared/ruleExecutionDamageRollWindow'
import { liveSessionEncounterActionPendingInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { LiveSessionEncounterActionResume } from '@artificer-toolkit/schema/api/liveSessionCommandScopes'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type {
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesRequest
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { type EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterActionCurrentnessChecksum } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  decideEncounterAreaLegendaryResistance,
  encounterAreaLegendaryResistanceAudits,
  offerEncounterAreaLegendaryResistance
} from '@artificer-toolkit/rules-runtime/encounterAreaLegendaryResistance'
import {
  absentEncounterActorIds,
  advanceEncounterListAttacks,
  catchEncounterAreaActorIds,
  prepareEncounterAreaTests,
  settleEncounterAreaAction
} from '@artificer-toolkit/rules-runtime/encounterAreaActionExecution'
import { sealedTestDice } from '@artificer-toolkit/rules-runtime/encounterActionTestBoundary'
import { collisionDamageDiceConfig } from '@artificer-toolkit/rules-runtime/encounterForcedMovementCollision'
import { encounterSourceImmunityLabel } from '@artificer-toolkit/rules-runtime/encounterSourceImmunity'
import { encounterSpellSchoolImmunity } from '@artificer-toolkit/rules-runtime/encounterSpellSchoolImmunity'
import {
  buildEncounterAreaPendingSnapshot,
  decideEncounterAreaDamageRoll,
  encounterAreaDamageRollWindow,
  encounterAreaHeldRay,
  encounterAreaSaveAwaiting,
  encounterAreaSettled,
  encounterChosenActorEntries,
  encounterChosenActorsChecksum,
  encounterCollisionSaveOccurrenceId,
  holdEncounterAreaCollisionSaves,
  holdEncounterAreaDamageRoll,
  holdEncounterAreaForcedMovement,
  landEncounterAreaForcedMovement,
  markEncounterAreaLegendaryResistanceDecided,
  markEncounterAreaSaveRolled,
  markEncounterAreaSaveTested,
  nextEncounterAreaWindowRequestId,
  openEncounterAreaSaveWindow,
  removeEncounterAreaTargetFromSnapshot,
  rerolledEncounterAreaRolls,
  resealEncounterAreaTargets
} from '@artificer-toolkit/rules-runtime/encounterAreaPending'
import { buildEncounterActionPendingSnapshot } from '@artificer-toolkit/rules-runtime/encounterActionPendingSnapshot'
import type { EncounterCastReactionOfferDto } from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import {
  characterClassLevels,
  characterTotalLevel
} from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import {
  creatureFormFilterRefusal,
  resolveCreatureFormFilter
} from '@artificer-toolkit/rules-runtime/encounterFormChoice'
import { executeEncounterActorsAction } from '@artificer-toolkit/rules-runtime/encounterActorsActionExecution'
import { targetingExcludesCreatureType } from '@artificer-toolkit/rules-runtime/encounterActionTargetPolicy'
import { nextRollInt } from '@artificer-toolkit/rules-runtime/random'
import { evaluateRollExpression, parseRollExpression } from '@artificer-toolkit/shared/rolls'
import { snapshotCreatureTypeId } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { findEncounterFeatureResource } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { readNativeLiveAttackPerception } from './nativeAttackPerception.js'
import { evaluateNativeLiveActionEconomy } from './nativeEncounterActionEconomy.js'
import { refuseActionOutsideItsWindow } from './nativeEncounterActionInputs.js'
import {
  payableCharacterDamageRerolls,
  prepareNativeLiveActionMaintenance,
  settledCharacterActionSpend
} from './nativeEncounterMaintenance.js'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import {
  type AreaPlanBase,
  type AreaPlanInput,
  type AreaPrepared,
  type AreaReach,
  type MovementTargets,
  type ReachCastWindow,
  type ReachCommand,
  type ReachPlanInput,
  type ReachTarget,
  hitPointPoolCovered,
  leadActiveEffectPlans,
  openReachCastWindow,
  prepareAreaScene,
  prepareAreaTarget,
  prepareReach,
  reachCastPause,
  reachRuleOverrides
} from './nativeAreaPreparation.js'
import {
  type AreaContext,
  type AreaTargetRecord,
  discoverNativeLegendaryResistance,
  prepareStruckTarget,
  replayAreaTargetSave,
  revalidateAreaTarget,
  revalidateStruckTarget,
  rollAreaTargetSave,
  sealedListAttack
} from './nativeAreaRevalidation.js'
import { completeAreaCommit } from './nativeAreaCommit.js'
import { advanceAreaRay, advanceAreaRayAim } from './nativeAreaRayAdvance.js'
import type { NativePauseAnswer } from './nativePauseTypes.js'
import { readNativeLiveCover } from './nativeLiveCover.js'

/**
 * Plans a point-area action up to its pending saves. Whom the area catches is decided here, from the
 * Scene the caster saw (fenced by its version); every caught creature, allies and the caster
 * included, gets its own sealed save, and none is rolled until its roller answers.
 */
export async function planNativeLiveEncounterAreaAction(input: AreaPlanInput) {
  const { command, state, actors, capture } = input
  const base = await prepareAreaScene(input)
  const { caster, casterFacts, movementTargets, scene, area, targetPolicy } = base

  // A zone is entered later, by movement; placing it puts nobody through its entry save, only
  // through the save its cast authors for when it appears. A creature immune to this source's use
  // of the action (D156), or of a creature type the action has no effect on, is caught but left
  // out, with no save.
  const inArea =
    base.summon || (base.placement && !base.placement.appearSave)
      ? []
      : catchEncounterAreaActorIds({
          origin: area.origin,
          shape: area.shape,
          casterActorId: caster.id,
          tokens: scene.tokens.map((token) => ({ ...token, id: token.tokenId })),
          fromCasterSpace: command.target.kind === 'CASTER_CENTERED',
          absentActorIds: absentEncounterActorIds(actors)
        })
  const inAreaActors = inArea.map((actorId) => {
    const actor = actors.find((candidate) => candidate.id === actorId)
    const token = scene.tokens.find((candidate) => candidate.actorId === actorId)
    if (!actor || !token) throw new Error('Encounter rules input binding mismatch.')
    return { actor, token }
  })
  for (const { actor } of inAreaActors)
    if (!movementTargets.has(actor.id)) movementTargets.set(actor.id, await input.loadTarget(actor))
  // A creature with total cover from the area's origin is caught but left out, as an immune one is.
  const totalCoverActorIds = new Set<string>()
  for (const { actor } of inAreaActors) {
    if (actor.id === caster.id) continue
    const cover = await readNativeLiveCover({
      state,
      system: input.system,
      sourceActorId: caster.id,
      targetActorId: actor.id,
      originPoint: area.origin,
      sceneContext: {
        sceneId: scene.sceneId,
        sceneVersion: scene.sceneVersion,
        grid: scene.grid
      },
      capture
    })
    if (cover?.tier?.blocksTargeting) totalCoverActorIds.add(actor.id)
  }
  // Creatures the caster spared at cast (validated against what their features allow).
  const sparedActorIds =
    !base.placement && 'unaffectedActorIds' in command.target
      ? (command.target.unaffectedActorIds ?? [])
      : []
  const unaffectedActorIds = inAreaActors.flatMap(({ actor }) => {
    const creatureTypeId = snapshotCreatureTypeId(actor)
    return sparedActorIds.includes(actor.id) ||
      totalCoverActorIds.has(actor.id) ||
      encounterSourceImmunityLabel({
        source: base.source,
        holderEffects: input.activeEffectsByActorId.get(actor.id) ?? []
      }) !== null ||
      encounterSpellSchoolImmunity({
        source: base.source,
        sourceFacts: casterFacts,
        target: movementTargets.get(actor.id)!
      }) ||
      (creatureTypeId !== null &&
        targetingExcludesCreatureType(targetPolicy.targeting, creatureTypeId))
      ? [actor.id]
      : []
  })
  const caughtInArea = inAreaActors.filter(({ actor }) => !unaffectedActorIds.includes(actor.id))
  const caughtActorIds = caughtInArea.map(({ actor }) => actor.id)
  // An area with a hit-point pool affects the creatures the pool covers, lowest hit points first.
  const contents =
    targetPolicy.targeting?.selectionKind === 'AREA_CONTENTS' ? targetPolicy.targeting : null
  const caught = contents?.hitPointPool
    ? hitPointPoolCovered(
        caughtInArea,
        evaluateRollExpression(parseRollExpression(contents.hitPointPool.diceConfig), {
          nextInt: input.random ?? nextRollInt
        }).evidence.total,
        contents,
        movementTargets
      )
    : caughtInArea

  // Whom the caster perceives is decided once, as the area opens, and sealed with each creature's
  // save: a later change of sight or lighting does not change what the caster is told (D100).
  const perceivedByCaster = new Set<string>()
  for (const { actor } of caught) {
    const target = movementTargets.get(actor.id)
    if (
      actor.id === caster.id ||
      (target &&
        (
          await readNativeLiveAttackPerception({
            state,
            system: input.system,
            attacker: casterFacts,
            target,
            roller: 'ATTACKER',
            sceneContext: {
              sceneId: scene.sceneId,
              sceneVersion: scene.sceneVersion,
              grid: scene.grid
            },
            capture
          })
        ).actual.attackerSeesTarget === 'SEES')
    )
      perceivedByCaster.add(actor.id)
  }

  const reached = []
  for (const { actor, token } of caught)
    reached.push({
      actor,
      perceivedByCaster: perceivedByCaster.has(actor.id),
      ...(await prepareAreaTarget({ ...input, base, actor, token }))
    })
  // An area that catches nobody still spends the action: its checks run against the caster's own
  // preparation of it.
  // An area that keeps no creature is checked and spent against the caster's own preparation.
  const lead =
    reached[0] ??
    (await prepareAreaTarget({
      ...input,
      base,
      actor: base.caster,
      token: base.scene?.sourceToken ?? null
    }))
  refuseActionOutsideItsWindow(lead.prepared, command)
  if (command.optionalCombatIntent != null) throw new Error('The action is not an ordinary action.')

  const evaluation = await evaluateNativeLiveActionEconomy({
    prepared: lead.prepared,
    state,
    actionId: command.actionId,
    sourceTarget: casterFacts,
    targetIds: caughtActorIds,
    capture
  })
  const ruleOverrides = reachRuleOverrides({
    command,
    lead: lead.prepared,
    evaluation,
    areaWarnings: area.warnings,
    targets: reached,
    movementTargets,
    facing: encounterFacingRule(state)
  })
  const opened = await openReachCastWindow(input, {
    reach: base,
    lead: lead.prepared,
    chosenActorIds: null,
    evaluation,
    ruleOverrides
  })
  if (opened.kind === 'PLAN') return opened.plan
  // An area that asks no save commits at once, as one cast on the creatures it reached.
  if (contents?.hitPointPool && lead.prepared.plan.kind === 'SINGLE_GRAPH') {
    const { window } = opened
    const settled = await executeEncounterActorsAction({
      runtime: input.runtime,
      random: input.random,
      adapter: lead.prepared.adapter,
      plan: lead.prepared.plan,
      occurrenceId: window.occurrenceId,
      rollsPerTarget: false,
      targets: reached.map(({ actor, prepared }) => ({
        actorId: actor.id,
        binding: prepared.binding
      }))
    })
    return completeAreaCommit({
      input,
      command,
      caster,
      occurredAt: window.occurredAt,
      movementTargets,
      kept: reached.map(({ actor, prepared }) => ({ actor, target: { prepared } })),
      lead: lead.prepared,
      formCreature: null,
      ruleOverrides,
      actionEconomy: evaluation.economy?.consumption ?? null,
      attackAction: evaluation.attackAction,
      settled,
      rollsPerTarget: false,
      tests: [],
      audits: new Map(),
      areaOccurrenceId: window.occurrenceId,
      areaSnapshot: null,
      caughtChecksum: encounterChosenActorsChecksum(caught.map(({ actor }) => actor.id)),
      removedActorIds: [],
      unaffectedActorIds,
      placement: null,
      occurrenceVersion: window.occurrenceVersion,
      response: window.response,
      removal: null
    })
  }
  return sealReachSaves(input, {
    reach: base,
    lead: lead.prepared,
    targets: reached,
    unaffectedActorIds,
    evaluation,
    ruleOverrides,
    window: opened.window
  })
}

/**
 * Seals the save of every creature a multi-creature action reaches, one pending request each, then
 * either settles the action (every roller auto-rolled) or leaves it pending on its rollers. None is
 * rolled until its roller answers, except for a roller who auto-rolls. The rays of a list are sealed
 * together and answered one at a time, in order (`encounterAreaSaveAwaiting`).
 */
export async function sealReachSaves(
  input: ReachPlanInput,
  sealed: {
    reach: AreaReach
    lead: AreaPrepared
    targets: readonly ReachTarget[]
    /**
     * The caught creatures the action has no effect on, which take no save: immune to this source's
     * use of it (D156), or of a creature type it excludes.
     */
    unaffectedActorIds: readonly string[]
    evaluation: Awaited<ReturnType<typeof evaluateNativeLiveActionEconomy>>
    ruleOverrides: ReturnType<typeof reachRuleOverrides>
    window: ReachCastWindow
  }
) {
  const { command, state, actors, capture } = input
  const {
    reach,
    lead,
    targets: reached,
    unaffectedActorIds,
    evaluation,
    ruleOverrides,
    window
  } = sealed
  const { economy, attackAction } = evaluation
  const actionEconomy = economy?.consumption ?? null
  const maintenance = await prepareNativeLiveActionMaintenance({
    prepared: lead,
    activeEffectsByActorId: input.activeEffectsByActorId,
    capture,
    endedMaintainedStateId: command.endedMaintainedStateId,
    loadCarriedHolder: async (actor) =>
      reach.movementTargets.get(actor.id) ?? input.loadTarget(actor)
  })

  const { occurrenceId } = window
  const entries = encounterChosenActorEntries(
    occurrenceId,
    reached.map(({ prepared }) => prepared.target.id)
  )
  const tests = await prepareEncounterAreaTests({
    runtime: input.runtime,
    random: input.random,
    adapter: lead.adapter,
    plan: lead.plan,
    occurrenceId,
    targets: reached.map(({ prepared }, index) => ({
      actorId: prepared.target.id,
      occurrenceId: entries[index]!.occurrenceId,
      binding: prepared.binding,
      attackSight: prepared.attackSight,
      autoRoll: { SOURCE: false, TARGET: false },
      discoverLegendaryResistance: discoverNativeLegendaryResistance(input, prepared)
    }))
  })
  const commandJson = JSON.stringify(command)
  const { initiatorUserId } = window
  const targets = reached.map(({ prepared, token, sceneContext, perceivedByCaster }, index) => {
    const test = tests.find((candidate) => candidate.occurrenceId === entries[index]!.occurrenceId)
    if (test?.kind !== 'PENDING') throw new Error('An area roll must wait for its roller.')
    return {
      actorId: prepared.target.id,
      perceivedByCaster,
      token: token
        ? {
            tokenId: token.tokenId,
            position: token.position,
            width: token.width,
            height: token.height,
            rotationDegrees: token.rotationDegrees
          }
        : null,
      snapshot: buildEncounterActionPendingSnapshot({
        execution: test.pending,
        optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
        commandJson,
        commandFingerprint: input.fingerprint,
        initiatorUserId,
        sourceActorId: reach.caster.id,
        targetActorId: prepared.target.id,
        currentnessChecksum: encounterActionCurrentnessChecksum({
          prepared,
          actionEconomy,
          attackAction,
          maintenance,
          sceneContext
        })
      })
    }
  })
  let snapshot = buildEncounterAreaPendingSnapshot({
    occurrenceId,
    optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
    commandJson,
    commandFingerprint: input.fingerprint,
    initiatorUserId,
    casterActorId: reach.caster.id,
    placesZone: reach.placement !== null,
    zoneAppearSave: reach.placement?.appearSave ?? false,
    placesSummon: Boolean(reach.summon),
    scene: reach.scene && { sceneId: reach.scene.sceneId, sceneVersion: reach.scene.sceneVersion },
    area: reach.area && { origin: reach.area.origin, shape: reach.area.shape },
    ...(unaffectedActorIds.length > 0 ? { unaffectedActorIds: [...unaffectedActorIds] } : {}),
    targets
  })
  for (const [index, { actor, prepared }] of reached.entries()) {
    // A ray's aim is heard as its turn comes, before its d20 (D217).
    snapshot = (
      await advanceAreaRayAim(
        input,
        snapshot,
        { prepared, sealed: sealedAt(snapshot, index) },
        reach,
        { kind: 'OPEN' }
      )
    ).snapshot
    snapshot = await autoRollAreaSave(input, snapshot, occurrenceId, {
      actor,
      prepared,
      sealed: sealedAt(snapshot, index)
    })
  }
  snapshot = await openNextAreaSaveWindow(input, snapshot)
  if (encounterAreaSettled(snapshot))
    return planNativeLiveEncounterAreaCommit({
      ...input,
      response: window.response,
      areaSnapshot: snapshot
    })
  return {
    kind: 'AREA_PENDING' as const,
    command,
    response: window.response,
    snapshot,
    prepared: { actors },
    ruleOverrides,
    fingerprint: input.fingerprint,
    initiatorUserId,
    occurrenceId
  }
}

/** The entry at `index` of a pending area as `snapshot` holds it now. */
function sealedAt(snapshot: ServerAggregateChoicePendingSnapshotDto, index: number) {
  const context = snapshot.applicationContext
  const sealed = context.kind === 'ENCOUNTER_AREA_ACTION' ? context.targets[index] : undefined
  if (!sealed) throw new Error('The pending action evidence is invalid.')
  return sealed
}

/**
 * An entry whose roller auto-rolls has its roll made now, so an auto-rolled failed save opens its
 * Legendary Resistance choice. It is kept as the dice it rolled, which replay without rolling again.
 */
async function autoRollAreaSave(
  input: ReachPlanInput,
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  areaOccurrenceId: string,
  entry: { actor: EncounterRunActorState; prepared: AreaPrepared; sealed: AreaTargetRecord }
) {
  const { sealed } = entry
  const context = snapshot.applicationContext
  const current =
    context.kind === 'ENCOUNTER_AREA_ACTION'
      ? context.targets.find(
          (target) => target.snapshot.occurrenceId === sealed.snapshot.occurrenceId
        )
      : undefined
  // A ray behind one held on its hit's reaction offer waits for that ray (D219).
  if (
    context.kind !== 'ENCOUNTER_AREA_ACTION' ||
    !current ||
    encounterAreaSaveAwaiting(context, current) !== 'ROLL' ||
    sealed.snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION' ||
    !input.requireAutoRoll(sealed.snapshot.applicationContext.rollerActorId)
  )
    return snapshot
  return recordAreaRoll(input, snapshot, areaOccurrenceId, entry, {
    kind: 'AUTO_ROLL',
    requestId: sealed.snapshot.request.requestId
  })
}

/**
 * Keeps one entry's roll in the pending area. A save settles with the Legendary Resistance its
 * failure offers; one whose creature holds dice for after its d20 keeps the roll as the dice it
 * rolled, to open its window with (D168), and replays it without rolling again. A rolled die is
 * never rolled twice: an auto-roll is kept as its faces, and a settled window as its d20.
 *
 * A ray is answered in its turn and runs to its outcome here, through the single-target driver, on
 * the hit points the earlier rays at its creature left it. Every die it rolled is kept with its
 * answer as a roll tape, which the later rays and the commit replay.
 */
async function recordAreaRoll(
  input: ReachPlanInput,
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  areaOccurrenceId: string,
  entry: { actor: EncounterRunActorState; prepared: AreaPrepared; sealed: AreaTargetRecord },
  resolution: EncounterEvidenceAnswer | EncounterActionWindowAnswer
) {
  const requestId = entry.sealed.snapshot.request.requestId
  if (entry.prepared.makesAttackRoll) {
    if (resolution.kind === 'ROLL_WINDOW')
      throw new Error('The pending action evidence is invalid.')
    // A hit its creature can react to holds the ray on that offer, which no child is chosen at yet.
    return (await advanceAreaRay(input, snapshot, entry, { kind: 'ROLL', resolution })).snapshot
  }
  const result = await rollAreaTargetSave(
    input,
    { actor: entry.actor, target: entry },
    entry.sealed,
    areaOccurrenceId,
    resolution
  )
  if (result.kind === 'PENDING') {
    const held = result.pending.pause
    if (
      held?.kind !== 'ROLL_WINDOW' ||
      isDamageRollWindow(held.payload) ||
      isD20RolledCheck(held.payload.rolled)
    )
      throw new Error('An area save must settle with its answer.')
    const { rawFaces, rollMode } = held.payload.rolled.d20
    const rolled: EncounterEvidenceAnswer = { kind: 'ENTER_DICE', requestId, rawFaces, rollMode }
    return markEncounterAreaSaveRolled(snapshot, requestId, JSON.stringify(rolled))
  }
  const kept: EncounterEvidenceAnswer | EncounterActionWindowAnswer =
    resolution.kind === 'AUTO_ROLL'
      ? {
          kind: 'ENTER_DICE',
          requestId,
          rawFaces: result.boundary.d20.rawFaces,
          rollMode: result.boundary.d20.rollMode
        }
      : resolution
  return markEncounterAreaSaveTested(snapshot, requestId, {
    testedJson: JSON.stringify(kept),
    legendaryResistance:
      offerEncounterAreaLegendaryResistance({
        test: result,
        targetStateChecksum: checksumRuleDocument(entry.prepared.target)
      }) ?? undefined,
    testDice: sealedTestDice(result.boundary)
  })
}

/**
 * Once every save is rolled, opens the d20 window of the rolled save whose creature acts earliest in
 * the initiative order (D168), one window at a time; a settled window opens the next. The window
 * replays the roll that was kept, so opening it rolls nothing.
 */
async function openNextAreaSaveWindow(
  input: ReachPlanInput,
  snapshot: ServerAggregateChoicePendingSnapshotDto
) {
  if (nextEncounterAreaWindowRequestId(snapshot, []) === null) return snapshot
  const captured = await input.capture({ kind: 'INITIATIVE_ROUND' })
  if (captured.kind !== 'INITIATIVE_ROUND') throw new Error('Turn initiative is unavailable.')
  const requestId = nextEncounterAreaWindowRequestId(
    snapshot,
    captured.state ? initiativeActionOrder(captured.state, input.actors) : []
  )
  const context = snapshot.applicationContext
  if (requestId === null || context.kind !== 'ENCOUNTER_AREA_ACTION') return snapshot
  const sealed = context.targets.find((target) => target.snapshot.request.requestId === requestId)
  if (
    sealed?.rolledJson === undefined ||
    sealed.snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION'
  )
    throw new Error('The area save has no roll to open a window with.')
  const rolled: EncounterEvidenceAnswer = JSON.parse(sealed.rolledJson)
  const opened = await rollAreaTargetSave(
    input,
    await revalidateAreaTarget(input, context, sealed, await prepareReach(input)),
    sealed,
    snapshot.occurrenceId,
    rolled
  )
  if (opened.kind !== 'PENDING') throw new Error('The area save has no d20 window to open.')
  return openEncounterAreaSaveWindow(
    snapshot,
    requestId,
    buildEncounterActionPendingSnapshot({
      execution: opened.pending,
      optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum,
      commandJson: context.commandJson,
      commandFingerprint: context.commandFingerprint,
      initiatorUserId: context.initiatorUserId,
      sourceActorId: context.casterActorId,
      targetActorId: sealed.actorId,
      currentnessChecksum: sealed.snapshot.applicationContext.currentnessChecksum
    })
  )
}

/**
 * Plans one creature's answer to its save in a pending area. The answer is checked against that
 * creature's own sealed facts and kept with its save; no other creature is touched, and nothing is
 * rolled for damage until the area settles.
 */
export async function planNativeLiveEncounterAreaAnswer(
  input: ReachPlanInput & {
    response: ResolveRuleOccurrenceInputDto
    /** The save the answer is for: its sealed roll, or the d20 window opened on it. */
    requestId: string
    resolution: EncounterEvidenceAnswer | EncounterActionWindowAnswer | EncounterDamageRerollAnswer
    areaSnapshot: ServerAggregateChoicePendingSnapshotDto
  }
) {
  const { command, actors, areaSnapshot, resolution } = input
  const context = areaSnapshot.applicationContext
  if (context.kind !== 'ENCOUNTER_AREA_ACTION')
    throw new Error('The pending area action is unavailable.')
  // The caster's answer to the area's one damage window rerolls the shared roll for every creature
  // and settles the area on it (D208).
  if (resolution.kind === 'DAMAGE_REROLL') {
    if (
      encounterAreaDamageRollWindow(context)?.window.request.requestId !== input.requestId ||
      areaSnapshot.occurrenceId !== input.response.occurrenceId ||
      context.commandFingerprint !== input.fingerprint
    )
      throw new Error('The pending action evidence is invalid.')
    const { option } = resolution
    return planNativeLiveEncounterAreaCommit({
      ...input,
      areaSnapshot: decideEncounterAreaDamageRoll(
        areaSnapshot,
        rerolledEncounterAreaRolls(areaSnapshot, resolution.rerolled),
        option && {
          modifierId: option.modifierId,
          label: option.label,
          chargeId: option.chargeId,
          cost: option.cost,
          poolId: option.poolId,
          maxDice: option.maxDice
        }
      )
    })
  }
  const answered = context.targets.find(
    (target) => target.snapshot.request.requestId === input.requestId
  )
  const caught = context.targets.filter(({ collision }) => !collision)
  if (
    !answered ||
    encounterAreaSaveAwaiting(context, answered) !==
      (resolution.kind === 'ROLL_WINDOW' ? 'WINDOW' : 'ROLL') ||
    answered.snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION' ||
    areaSnapshot.occurrenceId !== input.response.occurrenceId ||
    answered.snapshot.occurrenceId !==
      (answered.collision
        ? encounterCollisionSaveOccurrenceId(
            areaSnapshot.occurrenceId,
            answered.collision.moverActorId,
            answered.actorId
          )
        : encounterChosenActorEntries(
            areaSnapshot.occurrenceId,
            caught.map(({ actorId }) => actorId)
          )[caught.indexOf(answered)]?.occurrenceId) ||
    context.commandFingerprint !== input.fingerprint ||
    command.optionalCombatIntent != null
  )
    throw new Error('The pending action evidence is invalid.')
  const reach = await prepareReach(input)
  const revalidated = answered.collision
    ? await revalidateStruckTarget(input, context, answered, answered.collision, reach)
    : await revalidateAreaTarget(input, context, answered, reach)
  let snapshot = await recordAreaRoll(
    input,
    areaSnapshot,
    areaSnapshot.occurrenceId,
    { ...revalidated, prepared: revalidated.target.prepared, sealed: answered },
    resolution
  )
  // An answered ray hands the turn to the next, whose aim is heard before its d20 (D217).
  const answeredAt = context.targets.indexOf(answered)
  const following = context.targets[answeredAt + 1]
  if (
    revalidated.target.prepared.makesAttackRoll &&
    following &&
    sealedAt(snapshot, answeredAt).testedJson !== undefined
  )
    snapshot = (
      await advanceAreaRayAim(
        input,
        snapshot,
        {
          prepared: (await revalidateAreaTarget(input, context, following, reach)).target.prepared,
          sealed: following
        },
        reach,
        { kind: 'OPEN' }
      )
    ).snapshot
  snapshot = await openNextAreaSaveWindow(input, snapshot)
  if (encounterAreaSettled(snapshot))
    return planNativeLiveEncounterAreaCommit({
      ...input,
      areaSnapshot: snapshot
    })
  return {
    kind: 'AREA_PENDING' as const,
    command,
    response: input.response,
    snapshot,
    prepared: { actors },
    fingerprint: input.fingerprint,
    initiatorUserId: context.initiatorUserId,
    occurrenceId: areaSnapshot.occurrenceId
  }
}

/**
 * Plans one creature's Legendary Resistance decision on its failed area save. Its save is replayed
 * from the answer kept with it, so the decision is checked against the save, the creature's facts and
 * its pool as they are now; no other creature is touched. The charge it proposes is spent when the
 * area commits, not here.
 */
export async function planNativeLiveEncounterAreaLegendaryResistance(
  input: ReachPlanInput & {
    response: ResolveRuleOccurrenceInputDto
    areaSnapshot: ServerAggregateChoicePendingSnapshotDto
    decision: Extract<
      ResolveRuleOccurrenceInputDto['resolution'],
      { kind: 'AREA_LEGENDARY_RESISTANCE' }
    >
  }
) {
  const { command, actors, areaSnapshot, decision } = input
  const selection: EncounterSealedChoiceSelection =
    decision.decision.kind === 'USE'
      ? { kind: 'OPTION', optionId: decision.decision.optionId }
      : { kind: 'DECLINE' }
  const context = areaSnapshot.applicationContext
  if (context.kind !== 'ENCOUNTER_AREA_ACTION')
    throw new Error('The pending area action is unavailable.')
  // A creature a mover struck is caught twice; its offers are decided in the order they were made.
  const decided = context.targets.find(
    (target) =>
      target.actorId === decision.actorId &&
      target.legendaryResistance &&
      !target.legendaryResistance.decision
  )
  if (
    !decided?.legendaryResistance ||
    decided.testedJson === undefined ||
    decided.snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION' ||
    areaSnapshot.occurrenceId !== input.response.occurrenceId ||
    context.commandFingerprint !== input.fingerprint ||
    command.optionalCombatIntent != null
  )
    throw new Error('The pending Legendary Resistance evidence is invalid.')
  const reach = await prepareReach(input)
  const revalidated = decided.collision
    ? await revalidateStruckTarget(input, context, decided, decided.collision, reach)
    : await revalidateAreaTarget(input, context, decided, reach)
  const resolution: EncounterEvidenceAnswer | EncounterActionWindowAnswer = JSON.parse(
    decided.testedJson
  )
  const tested = await replayAreaTargetSave(
    input,
    revalidated,
    decided,
    areaSnapshot.occurrenceId,
    resolution
  )
  const { prepared } = revalidated.target
  const candidate = await discoverNativeLegendaryResistance(input, prepared)()
  if (!candidate) throw new Error('Legendary Resistance evidence is stale.')
  const resource = findEncounterFeatureResource(
    prepared.actorRules,
    candidate.targetActorId,
    candidate.ownerFeatureId
  )
  if (!resource) throw new Error('The Legendary Resistance resource is unavailable.')
  const { legendaryResistance, chargeProposal } = await decideEncounterAreaLegendaryResistance({
    runtime: input.runtime,
    areaOccurrenceId: areaSnapshot.occurrenceId,
    test: tested,
    offer: decided.legendaryResistance,
    candidate,
    targetStateChecksum: checksumRuleDocument(prepared.target),
    selection,
    currentFeatureResource: resource
  })
  const snapshot = markEncounterAreaLegendaryResistanceDecided(
    areaSnapshot,
    decision.actorId,
    legendaryResistance
  )
  if (encounterAreaSettled(snapshot))
    return planNativeLiveEncounterAreaCommit({
      ...input,
      areaSnapshot: snapshot
    })
  return {
    kind: 'AREA_PENDING' as const,
    command,
    response: input.response,
    snapshot,
    chargeProposal,
    prepared: { actors },
    fingerprint: input.fingerprint,
    initiatorUserId: context.initiatorUserId,
    occurrenceId: areaSnapshot.occurrenceId
  }
}

/**
 * Plans what moves a ray held on an offer its hit raised: the answer of the creature it hit to the
 * reaction offer (D219), the room's resume once the reaction it chose committed as its holder's own
 * child action, or its caster's answer to the on-hit rider offer. A declined reaction runs the ray's
 * outcome, or holds the hit on its rider offer. A chosen reaction keeps the ray held, records its
 * child and keeps, with every answered ray, the facts it was rolled against, so the list's replay
 * finds the earlier rolls as they were made. The resume seals every entry again to the creatures as
 * the child left them, then runs the ray past its offer against them. The rider decision runs the
 * ray's outcome with it and is kept with the ray's answer. The rays behind it whose roller auto-rolls
 * follow, each stopping the list at its own hit's offer.
 *
 * A ray held before its d20 on an offer of its aim (D217) moves the same way: the answer of a
 * creature beside its aim, or the resume from that creature's child, hands it to the next creature
 * or seals it again for its caster's roll, and each ray behind it is heard in its own turn.
 */
export async function planNativeLiveEncounterAreaRayOffer(
  input: ReachPlanInput & {
    areaSnapshot: ServerAggregateChoicePendingSnapshotDto
    continuation:
      | {
          response: ResolveRuleOccurrenceInputDto
          answer: Extract<NativePauseAnswer, { kind: 'CAST_REACTION' | 'ON_HIT' }>
        }
      | { resume: LiveSessionEncounterActionResume; offer: EncounterCastReactionOfferDto }
  }
) {
  const { command, actors, areaSnapshot, continuation } = input
  const context = areaSnapshot.applicationContext
  const held = encounterAreaHeldRay(areaSnapshot)
  const response = 'response' in continuation ? continuation.response : null
  const resume = 'resume' in continuation ? continuation.resume : null
  if (
    context.kind !== 'ENCOUNTER_AREA_ACTION' ||
    !held ||
    (response ?? resume)?.occurrenceId !== areaSnapshot.occurrenceId ||
    (response !== null && encounterAreaSaveAwaiting(context, held) !== 'DECISION') ||
    context.commandFingerprint !== input.fingerprint ||
    command.optionalCombatIntent != null ||
    context.targets.some(({ collision }) => collision)
  )
    throw new Error('The pending action evidence is invalid.')
  const reach = await prepareReach(input)
  const entries = []
  for (const sealed of context.targets)
    entries.push({ sealed, ...(await revalidateAreaTarget(input, context, sealed, reach)) })
  const heldIndex = context.targets.indexOf(held)
  const heldEntry = entries[heldIndex]
  if (!heldEntry) throw new Error('The pending action evidence is invalid.')
  let snapshot = areaSnapshot
  if ('resume' in continuation) {
    const lead = heldEntry.target.prepared
    const reactionChildren = await reachCastPause(input, {
      reach,
      lead,
      chosenActorIds: null,
      occurrenceId: areaSnapshot.occurrenceId,
      occurredAt: new Date().toISOString(),
      answer: null
    }).resolveReactionChildren()
    const unrolled = entries.filter(
      ({ sealed }) => sealed.testedJson === undefined && sealed !== held
    )
    const tests = await prepareEncounterAreaTests({
      runtime: input.runtime,
      random: input.random,
      adapter: lead.adapter,
      plan: lead.plan,
      occurrenceId: areaSnapshot.occurrenceId,
      targets: unrolled.map(({ sealed, target: { prepared } }) => ({
        actorId: sealed.actorId,
        occurrenceId: sealed.snapshot.occurrenceId,
        binding: prepared.binding,
        attackSight: prepared.attackSight,
        autoRoll: { SOURCE: false, TARGET: false },
        discoverLegendaryResistance: discoverNativeLegendaryResistance(input, prepared)
      }))
    })
    snapshot = resealEncounterAreaTargets(
      areaSnapshot,
      entries.map(({ sealed, currentnessChecksum }) => {
        const inner = sealed.snapshot.applicationContext
        if (inner.kind !== 'ENCOUNTER_ACTION')
          throw new Error('The pending action evidence is invalid.')
        // An answered ray keeps its roll, and the held ray its offer with its child's outcome.
        if (sealed.testedJson !== undefined || sealed === held)
          return {
            ...sealed.snapshot,
            applicationContext: {
              ...inner,
              currentnessChecksum,
              ...(sealed === held && { reactionChildren })
            }
          }
        const test = tests.find(
          (candidate) => candidate.occurrenceId === sealed.snapshot.occurrenceId
        )
        if (test?.kind !== 'PENDING') throw new Error('An area roll must wait for its roller.')
        return buildEncounterActionPendingSnapshot({
          execution: test.pending,
          optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum,
          commandJson: context.commandJson,
          commandFingerprint: context.commandFingerprint,
          initiatorUserId: context.initiatorUserId,
          sourceActorId: context.casterActorId,
          targetActorId: sealed.actorId,
          currentnessChecksum
        })
      })
    )
  }
  const heldRay = { prepared: heldEntry.target.prepared, sealed: sealedAt(snapshot, heldIndex) }
  const testBindings = new Map(
    entries.flatMap(({ sealed, target }) =>
      sealed.testedJson !== undefined && sealed.testBindingJson === undefined
        ? [[sealed.snapshot.occurrenceId, JSON.stringify(target.prepared.binding)] as const]
        : []
    )
  )
  // An offer of the ray's aim is heard before its d20 (D217); every other is one its roll raised.
  const aimStep =
    'resume' in continuation
      ? continuation.offer.kind === 'ATTACK_ON_OTHER'
        ? ({ kind: 'RESUMED' } as const)
        : null
      : continuation.answer.kind === 'CAST_REACTION' &&
          continuation.answer.answer.offer.kind === 'ATTACK_ON_OTHER'
        ? ({ kind: 'ANSWER', answer: continuation.answer.answer, testBindings } as const)
        : null
  const advanced = aimStep
    ? await advanceAreaRayAim(input, snapshot, heldRay, reach, aimStep)
    : await advanceAreaRay(
        input,
        snapshot,
        heldRay,
        'resume' in continuation
          ? { kind: 'RESUMED', offer: continuation.offer }
          : { kind: 'ANSWER', answer: continuation.answer, testBindings }
      )
  snapshot = advanced.snapshot
  // The held ray, once past its aim, and the rays behind it go on for a roller who auto-rolls.
  for (const [index, { actor, target }] of entries.entries()) {
    if (index < heldIndex) continue
    if (index > heldIndex)
      snapshot = (
        await advanceAreaRayAim(
          input,
          snapshot,
          { prepared: target.prepared, sealed: sealedAt(snapshot, index) },
          reach,
          { kind: 'OPEN' }
        )
      ).snapshot
    snapshot = await autoRollAreaSave(input, snapshot, areaSnapshot.occurrenceId, {
      actor,
      prepared: target.prepared,
      sealed: sealedAt(snapshot, index)
    })
  }
  if (encounterAreaSettled(snapshot))
    return planNativeLiveEncounterAreaCommit({ ...input, response, resume, areaSnapshot: snapshot })
  return {
    kind: 'AREA_PENDING' as const,
    command,
    response,
    snapshot,
    reactionChild: advanced.reactionChild,
    prepared: { actors },
    fingerprint: input.fingerprint,
    initiatorUserId: context.initiatorUserId,
    occurrenceId: areaSnapshot.occurrenceId
  }
}

/** The sealed pending contract the room persists for a point-area action: every caught creature's save. */
export function buildNativeLiveEncounterAreaActionPendingInput(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  plan: Pick<
    Extract<
      | Awaited<ReturnType<typeof planNativeLiveEncounterAreaAction>>
      | Awaited<ReturnType<typeof planNativeLiveEncounterAreaAnswer>>
      | Awaited<ReturnType<typeof planNativeLiveEncounterAreaLegendaryResistance>>,
      { kind: 'AREA_PENDING' }
    >,
    'command' | 'response' | 'snapshot'
  > & {
    /** The child resume the held cast went on from to ask its saves (D219), when it did. */
    resume?: LiveSessionEncounterActionResume | null
    dependencies: readonly { request: LiveSessionEncounterRulesRequest }[]
    revisions: LiveSessionRulesRevisions
  }
) {
  return liveSessionEncounterActionPendingInputSchema.parse({
    ...scope,
    command: plan.command,
    response: plan.response,
    resume: plan.resume ?? undefined,
    revisions: plan.revisions,
    maintenanceOwners: plan.dependencies.flatMap(({ request }) =>
      request.kind === 'MAINTENANCE_OWNER' ? [request] : []
    ),
    snapshot: plan.snapshot
  })
}

const formRefusal = (message: string) =>
  new LiveSessionDomainRejectionError(422, {
    code: 'DOMAIN_REJECTED',
    reason: 'TARGET_UNAVAILABLE',
    message
  })

const characterLevelOf = (target: MovementTargets | undefined) =>
  target?.characterFacts ? characterTotalLevel(target.characterFacts) : null

/**
 * The Creature the caster's chosen form swaps the targets into (D130), or null for an action that
 * holds no form. The form is the caster's one choice for the whole cast: one of the action's fixed
 * forms (capped by its own targets), or a Creature that meets the action's form filter, checked
 * here against the System creature corpus. A save that pends re-reads it from the sealed command.
 */
export async function readChosenFormCreature(
  input: AreaPlanBase & { command: ReachCommand },
  lead: AreaPrepared,
  targets: readonly EncounterRunActorState[],
  movementTargets: ReadonlyMap<string, MovementTargets>
) {
  const chosen = input.command.target.kind === 'ACTORS' ? input.command.target : null
  const formId = chosen?.formId
  const creatureId = chosen?.creatureId
  const contribution = leadActiveEffectPlans(lead).find(
    ({ creatureFormContribution }) => creatureFormContribution
  )?.creatureFormContribution
  if (!contribution) {
    if (formId !== undefined || creatureId !== undefined)
      throw formRefusal('This action takes no creature form.')
    return null
  }
  const form = contribution.forms.find((candidate) => candidate.id === formId)
  const sourceId = form?.creatureId ?? creatureId
  if (sourceId === undefined || (formId !== undefined && creatureId !== undefined))
    throw formRefusal('This action needs one of its creature forms.')
  if (creatureId !== undefined && !contribution.filter)
    throw formRefusal('This action takes only its own creature forms.')
  if (form && targets.length > form.maxTargets)
    throw formRefusal(`That form takes at most ${form.maxTargets} creatures.`)
  if (targets.some((actor) => actor.form !== null))
    throw formRefusal('A chosen creature cannot take a creature form.')
  if (!input.readFormCreature) throw new Error('The creature form cannot be read.')
  const creature = await input.readFormCreature(input.state.gameSystemId, sourceId)
  if (contribution.filter && creatureId !== undefined) {
    // A scaled cap reads the caster's level, not the target's.
    const filter = resolveCreatureFormFilter(
      contribution.filter,
      characterClassLevels(lead.sourceFacts.characterFacts)
    )
    for (const actor of targets) {
      const refused = creatureFormFilterRefusal({
        filter,
        form: creature,
        target: {
          snapshot: actor.kind === 'CHARACTER' ? null : actor.snapshot,
          level: characterLevelOf(movementTargets.get(actor.id))
        },
        system: input.system
      })
      if (refused) throw formRefusal(refused)
    }
  }
  return creature
}

/**
 * The caster's lead for an area that keeps no creature: the action prepared on the caster, checked
 * and measured against the economy as an area that caught creatures would have been.
 */
async function prepareAreaCasterLead(
  input: ReachPlanInput,
  base: AreaReach,
  removedActorIds: readonly string[]
) {
  const target = await prepareAreaTarget({
    ...input,
    base,
    actor: base.caster,
    token: base.scene?.sourceToken ?? null
  })
  refuseActionOutsideItsWindow(target.prepared, input.command)
  return {
    target,
    evaluation: await evaluateNativeLiveActionEconomy({
      prepared: target.prepared,
      state: input.state,
      actionId: input.command.actionId,
      sourceTarget: base.casterFacts,
      targetIds: [...removedActorIds],
      capture: input.capture
    })
  }
}

/**
 * Plans the area the GM's removal of the last creature it waited on settles: the same commit the
 * last answer would have made, over the area as the removal leaves it.
 */
export async function planNativeLiveEncounterAreaRemoval(
  input: ReachPlanInput & {
    removal: RemoveAreaTargetInputDto
    areaSnapshot: ServerAggregateChoicePendingSnapshotDto
  }
) {
  const removed = removeEncounterAreaTargetFromSnapshot(
    input.areaSnapshot,
    input.removal.actorId.toLowerCase()
  )
  if (removed.kind !== 'REMOVED' || !encounterAreaSettled(removed.snapshot))
    throw new Error('The area still waits on a creature.')
  return planNativeLiveEncounterAreaCommit({
    ...input,
    response: null,
    areaSnapshot: removed.snapshot
  })
}

/** An area held for a roller's answer or for the source's push pick, with the actors it was planned over. */
type AreaPendingPlan = {
  kind: 'AREA_PENDING'
  command: ResolveEncounterActionInputDto
  response: ResolveRuleOccurrenceInputDto | null
  snapshot: ServerAggregateChoicePendingSnapshotDto
  /** The reaction a ray's creature chose at its hit, which the room runs as its own action (D219). */
  reactionChild?: Awaited<ReturnType<typeof advanceAreaRay>>['reactionChild']
  prepared: { actors: AreaPlanBase['actors'] }
  fingerprint: string
  initiatorUserId: string
  occurrenceId: string
}

/**
 * Plans the commit of a settled area: every kept creature's save is replayed from the answer kept
 * with it, damage is rolled once and frozen across them, and each creature's outcome becomes its
 * own receipt under one root that holds the caster's single spend. A list of rays replays each ray
 * in order from the roll tape kept with its answer, so the commit rolls nothing for it.
 */
export async function planNativeLiveEncounterAreaCommit(
  input: ReachPlanInput & {
    response: ResolveRuleOccurrenceInputDto | null
    areaSnapshot: ServerAggregateChoicePendingSnapshotDto
    /** The GM removal that left nothing to wait on, when it, not an answer, settles the area. */
    removal?: RemoveAreaTargetInputDto
    /** The room's resume from a ray's reaction child (D219), when it, not an answer, settles the list. */
    resume?: LiveSessionEncounterActionResume | null
  }
): Promise<Awaited<ReturnType<typeof completeAreaCommit>> | AreaPendingPlan> {
  const { command, areaSnapshot } = input
  const context = areaSnapshot.applicationContext
  if (context.kind !== 'ENCOUNTER_AREA_ACTION')
    throw new Error('The pending area action is unavailable.')
  const areaOccurrenceId = areaSnapshot.occurrenceId
  const base = await prepareReach(input)
  const { caster } = base
  const kept = []
  const struck = []
  for (const sealed of context.targets) {
    if (sealed.collision)
      struck.push({
        sealed,
        ...(await revalidateStruckTarget(input, context, sealed, sealed.collision, base))
      })
    else
      kept.push({
        sealed,
        ...(await revalidateAreaTarget(input, context, sealed, base))
      })
  }
  // An area that keeps no creature (it caught nobody, or the GM removed everyone it caught) commits
  // the caster's spend alone, against the caster's own preparation of the action.
  const first = kept[0] ?? (await prepareAreaCasterLead(input, base, context.removedActorIds))
  // A damage reroll the caster paid for at the area's window joins the cast's own spend (D208), and
  // so does each rider the caster chose at a ray's on-hit offer: one slot and one pool at most.
  const lead = kept
    .flatMap(({ sealed }) => (sealed.onHit?.option ? [sealed.onHit.option] : []))
    .reduce(
      (prepared, chosenOnHit) =>
        settledCharacterActionSpend({
          prepared,
          chosenOnHit,
          damageReroll: null,
          maintenance: null,
          automationMode: input.state.automationMode
        }),
      settledCharacterActionSpend({
        prepared: first.target.prepared,
        chosenOnHit: null,
        damageReroll: context.damageRoll?.reroll ?? null,
        maintenance: null,
        automationMode: input.state.automationMode
      })
    )
  const formCreature = await readChosenFormCreature(
    input,
    lead,
    kept.map(({ target }) => target.prepared.target),
    base.movementTargets
  )
  const ruleOverrides = reachRuleOverrides({
    command,
    lead,
    evaluation: first.evaluation,
    areaWarnings: base.area?.warnings ?? [],
    targets: kept.map(({ target }) => target),
    movementTargets: base.movementTargets,
    facing: encounterFacingRule(input.state)
  })
  const { economy, attackAction } = first.evaluation
  const actionEconomy = economy?.consumption ?? null

  // Each ray of an attack list rolls its own damage; a point area or a save list shares one roll.
  const rollsPerTarget = lead.makesAttackRoll
  const replaySealedTests = async (
    entries: readonly {
      sealed: AreaTargetRecord
      actor: EncounterRunActorState
      target: { prepared: AreaPrepared }
    }[]
  ) => {
    const replayed = []
    for (const entry of entries) {
      if (entry.sealed.testedJson === undefined) throw new Error('The area roll is unanswered.')
      const resolution: EncounterEvidenceAnswer | EncounterActionWindowAnswer = JSON.parse(
        entry.sealed.testedJson
      )
      replayed.push(
        await replayAreaTargetSave(input, entry, entry.sealed, areaOccurrenceId, resolution)
      )
    }
    return replayed
  }
  const tests = rollsPerTarget ? [] : await replaySealedTests(kept)
  const legendaryResistanceAudits = (entries: readonly { sealed: AreaTargetRecord }[]) =>
    encounterAreaLegendaryResistanceAudits(
      new Map(
        entries.flatMap(({ sealed: { actorId, legendaryResistance } }) =>
          legendaryResistance ? [[actorId, legendaryResistance] as const] : []
        )
      )
    )
  const audits = legendaryResistanceAudits(kept)
  // A point area rolls its damage on one tape; once its window opened, every replan settles on it.
  const sharedRolls = context.damageRoll?.rolls.map((roll) => ({ ...roll })) ?? []
  const source = {
    runtime: input.runtime,
    random: input.random,
    adapter: lead.adapter,
    plan: lead.plan,
    occurrenceId: areaOccurrenceId
  }
  const settled = rollsPerTarget
    ? (
        await advanceEncounterListAttacks({
          ...source,
          attacks: kept.map(({ sealed, target }) =>
            sealedListAttack(sealed, target.prepared, input.reactionChildren.committed)
          )
        })
      ).settled
    : await settleEncounterAreaAction({
        ...source,
        targets: kept.map(({ target, sealed }) => ({
          actorId: target.prepared.target.id,
          occurrenceId: sealed.snapshot.occurrenceId,
          binding: target.prepared.binding,
          attackSight: target.prepared.attackSight,
          autoRoll: { SOURCE: false, TARGET: false },
          discoverLegendaryResistance: discoverNativeLegendaryResistance(input, target.prepared)
        })),
        tests,
        legendaryResistance: audits,
        sharedRolls
      })
  // A caster who can pay to reroll damage dice answers the area's one shared roll before any of it
  // lands (D208). Each ray of an attack list is its own roll, and a GM removal settles without one.
  const damageWindow =
    context.damageRoll || rollsPerTarget || input.removal
      ? null
      : await openEncounterAreaDamageRollWindow({
          runtime: input.runtime,
          adapter: lead.adapter,
          occurrenceId: areaOccurrenceId,
          costs: payableCharacterDamageRerolls({ prepared: lead, maintenance: null }),
          rolls: sharedRolls,
          settled
        })
  if (damageWindow) {
    const rolledFor = kept.find(({ sealed }) => sealed.actorId === damageWindow.actorId)?.sealed
    if (rolledFor?.snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION')
      throw new Error('The area damage roll has no creature to open its window on.')
    return {
      kind: 'AREA_PENDING' as const,
      command,
      response: input.response,
      snapshot: holdEncounterAreaDamageRoll(
        areaSnapshot,
        sharedRolls,
        buildEncounterActionPendingSnapshot({
          execution: damageWindow.pending,
          optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum,
          commandJson: context.commandJson,
          commandFingerprint: context.commandFingerprint,
          initiatorUserId: context.initiatorUserId,
          sourceActorId: context.casterActorId,
          targetActorId: damageWindow.actorId,
          currentnessChecksum: rolledFor.snapshot.applicationContext.currentnessChecksum
        })
      ),
      prepared: { actors: input.actors },
      fingerprint: input.fingerprint,
      initiatorUserId: context.initiatorUserId,
      occurrenceId: areaOccurrenceId
    }
  }

  // The area settles under the occurrence the answer, the removal or a reaction's child resume (D219)
  // moved on.
  const resumed = input.response ?? input.removal ?? input.resume ?? input.castResume?.continuation
  const occurredAt = new Date().toISOString()
  const plan = await completeAreaCommit({
    input,
    command,
    caster,
    occurredAt,
    movementTargets: base.movementTargets,
    kept,
    lead,
    ruleOverrides,
    formCreature,
    actionEconomy,
    attackAction,
    settled,
    rollsPerTarget,
    tests,
    audits,
    struck: {
      entries: struck,
      tests: await replaySealedTests(struck),
      audits: legendaryResistanceAudits(struck)
    },
    areaOccurrenceId,
    areaSnapshot,
    caughtChecksum: context.caughtChecksum,
    removedActorIds: context.removedActorIds,
    unaffectedActorIds: context.unaffectedActorIds ?? [],
    sealedRays: context.forcedMovement?.rays,
    placement: base.placement,
    summon: base.summon,
    occurrenceVersion: resumed ? resumed.expectedOccurrenceVersion + 1 : 0,
    response: input.response,
    removal: input.removal ?? null
  })
  // A push whose source picks where its creature lands holds the settled area for that pick, the
  // farthest creature first, each offer derived with the farther ones landed; it commits after the
  // last answer (D157).
  const landed = context.forcedMovement?.landed ?? []
  const forcedMovements = plan.forcedMovements.map((movement) => ({
    ...movement,
    position:
      landed.find(({ targetActorId }) => targetActorId === movement.targetActorId)?.position ?? null
  }))
  const { owed: pick, landings } = await input.forcedMovementPick({
    encounterId: input.state.id,
    sourceActorId: caster.id,
    movements: forcedMovements
  })
  const rays = forcedMovements.flatMap(({ targetActorId, ray }) =>
    ray ? [{ targetActorId, ray }] : []
  )
  if (pick) {
    if (input.removal)
      throw new Error('A removal that leaves an area push to pick is not supported yet.')
    return {
      kind: 'AREA_PENDING' as const,
      command,
      response: input.response,
      snapshot: holdEncounterAreaForcedMovement(areaSnapshot, pick, rays),
      prepared: { actors: input.actors },
      fingerprint: input.fingerprint,
      initiatorUserId: context.initiatorUserId,
      occurrenceId: areaOccurrenceId
    }
  }
  // A mover stopped by another creature strikes it (D159): that creature makes the authored save, held
  // after the movers land. A replan finds the same landings, so it must find the same creatures sealed.
  const strikes = landings.flatMap(({ targetActorId, feet, stoppedBy }) => {
    const collision = forcedMovements.find(
      (movement) => movement.targetActorId === targetActorId
    )?.collision
    return collision && stoppedBy !== 'NONE' && stoppedBy !== 'OBJECT'
      ? [
          {
            struckActorId: stoppedBy,
            collision: {
              moverActorId: targetActorId,
              damageDiceConfig: collisionDamageDiceConfig(collision.diceConfig, feet),
              damageTypeId: collision.damageTypeId,
              abilityDefinitionId: collision.abilityDefinitionId,
              dc: collision.dc,
              conditionId: collision.conditionId
            }
          }
        ]
      : []
  })
  const sealedStrikes = struck.map(({ sealed }) => ({
    struckActorId: sealed.actorId,
    collision: sealed.collision
  }))
  if (sealedStrikes.length === 0 && strikes.length > 0) {
    if (input.removal)
      throw new Error('A removal that leaves an area collision save to roll is not supported yet.')
    return sealCollisionSaves(input, { base, context, areaSnapshot, strikes, rays })
  }
  if (checksumCanonicalJson(strikes) !== checksumCanonicalJson(sealedStrikes))
    throw new Error('The pending area changed.')
  return { ...plan, forcedMovements }
}

/**
 * Seals the save of every creature a settled push struck (D159), one pending request each, after the
 * movers landed. A creature whose roller auto-rolls has its roll made now; the area commits at once
 * when every one did, and otherwise holds for the rest.
 */
async function sealCollisionSaves(
  input: ReachPlanInput & { response: ResolveRuleOccurrenceInputDto | null },
  sealed: {
    base: AreaReach
    context: AreaContext
    areaSnapshot: ServerAggregateChoicePendingSnapshotDto
    strikes: readonly {
      struckActorId: string
      collision: NonNullable<AreaTargetRecord['collision']>
    }[]
    rays: { targetActorId: string; ray: ScenePoint }[]
  }
) {
  const { base, context, areaSnapshot } = sealed
  const areaOccurrenceId = areaSnapshot.occurrenceId
  const commandJson = JSON.stringify(input.command)
  const entries = []
  for (const { struckActorId, collision } of sealed.strikes) {
    const actor = input.actors.find(({ id }) => id === struckActorId)
    if (!actor) throw new Error('Encounter rules input binding mismatch.')
    const occurrenceId = encounterCollisionSaveOccurrenceId(
      areaOccurrenceId,
      collision.moverActorId,
      struckActorId
    )
    const { prepared, currentnessChecksum } = await prepareStruckTarget(input, base, {
      actor,
      occurrenceId,
      collision
    })
    const [test] = await prepareEncounterAreaTests({
      runtime: input.runtime,
      random: input.random,
      adapter: prepared.adapter,
      plan: prepared.plan,
      occurrenceId: areaOccurrenceId,
      targets: [
        {
          actorId: struckActorId,
          occurrenceId,
          binding: prepared.binding,
          attackSight: prepared.attackSight,
          autoRoll: { SOURCE: false, TARGET: false },
          discoverLegendaryResistance: discoverNativeLegendaryResistance(input, prepared)
        }
      ]
    })
    if (test?.kind !== 'PENDING') throw new Error('An area roll must wait for its roller.')
    const token = base.scene?.tokens.find((candidate) => candidate.actorId === struckActorId)
    entries.push({
      actor,
      prepared,
      record: {
        actorId: struckActorId,
        perceivedByCaster: true,
        token: token
          ? {
              tokenId: token.tokenId,
              position: token.position,
              width: token.width,
              height: token.height,
              rotationDegrees: token.rotationDegrees
            }
          : null,
        collision,
        snapshot: buildEncounterActionPendingSnapshot({
          execution: test.pending,
          optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum,
          commandJson,
          commandFingerprint: input.fingerprint,
          initiatorUserId: context.initiatorUserId,
          sourceActorId: base.caster.id,
          targetActorId: struckActorId,
          currentnessChecksum
        })
      }
    })
  }
  let snapshot = holdEncounterAreaCollisionSaves(
    areaSnapshot,
    entries.map(({ record }) => record),
    sealed.rays
  )
  for (const { actor, prepared, record } of entries)
    snapshot = await autoRollAreaSave(input, snapshot, areaOccurrenceId, {
      actor,
      prepared,
      sealed: record
    })
  if (encounterAreaSettled(snapshot))
    return planNativeLiveEncounterAreaCommit({ ...input, areaSnapshot: snapshot })
  return {
    kind: 'AREA_PENDING' as const,
    command: input.command,
    response: input.response,
    snapshot,
    prepared: { actors: input.actors },
    fingerprint: input.fingerprint,
    initiatorUserId: context.initiatorUserId,
    occurrenceId: areaOccurrenceId
  }
}

/**
 * Plans the source's answer to a settled area's push pick (D157): the creature lands on a square the
 * pick offered, and the area holds the next creature's pick, derived with it landed, or commits.
 */
export async function planNativeLiveEncounterAreaForcedMovement(
  input: ReachPlanInput & {
    response: ResolveRuleOccurrenceInputDto
    areaSnapshot: ServerAggregateChoicePendingSnapshotDto
    landing: { requestId: string; position: ScenePoint }
  }
) {
  const { areaSnapshot, landing } = input
  const context = areaSnapshot.applicationContext
  if (
    context.kind !== 'ENCOUNTER_AREA_ACTION' ||
    areaSnapshot.occurrenceId !== input.response.occurrenceId ||
    context.commandFingerprint !== input.fingerprint
  )
    throw new Error('The pending action evidence is invalid.')
  return planNativeLiveEncounterAreaCommit({
    ...input,
    areaSnapshot: landEncounterAreaForcedMovement(areaSnapshot, landing.requestId, landing.position)
  })
}
