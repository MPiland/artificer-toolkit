import type { ActionAreaSceneRequestDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterAreaCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { LiveSessionEncounterRulesResponse } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import {
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ServerRuleExecutionApplicationOutputsDto } from '@artificer-toolkit/schema/shared/ruleExecutionApplicationOutputs'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import {
  encounterAreaTargetCommandId,
  encounterChosenActorEntries,
  encounterCollisionSaveOccurrenceId,
  encounterChosenActorsChecksum
} from '@artificer-toolkit/rules-runtime/encounterAreaPending'
import { nativeConcentrationDamageApplications } from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import { projectNativeActionEffectTransitions } from '@artificer-toolkit/rules-runtime/encounterActionEffectReceipts'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import type { EncounterActorFormCreature } from '@artificer-toolkit/rules-runtime/encounterActorForm'
import { readLiveEncounterActionAdmission } from './liveActionAdmission.js'
import {
  actorFormEntry,
  createdFormCreatureId,
  readActorFormCreature
} from './actorFormPersistence.js'
import { insertActionEvidenceReceipt } from './actionEvidenceReceipt.js'
import {
  requireAreaActionAnswer,
  requireAreaActionForcedMovement,
  requireAreaActionLegendaryResistance,
  requireAreaActionPendingRoot,
  requireAreaActionRemoval
} from './actionAreaPending.js'
import { persistCompletedChild } from './actionChildPersistence.js'
import {
  applyMaintenanceReplacement,
  persistEncounterActionEffects,
  prepareEncounterActionMaintenance,
  prepareMaintenanceReplacement
} from './actionEffectPersistence.js'
import {
  readMaintenanceOwnerRequests,
  type readEncounterMaintenanceCapture
} from './maintenanceCapture.js'
import { endEffects, receiptConsumedGrants } from './consumedGrantPersistence.js'
import {
  completeActionOccurrence,
  recordActionRoot,
  type ApplyEncounterForcedMovements,
  type ApplyEncounterSummonTokens
} from './actionCommitRecords.js'
import {
  combineSpendMutations,
  settleActionSourceSpend,
  sourceSpendMutation
} from './actionSourceSpend.js'
import { castPendingContinues } from './actionPending.js'
import { applyFailedCounterSpends, failedCounterSpends } from './failedCounterSpend.js'
import { actionSystemRollAnswers, readAppCardedDice } from './appCardedDice.js'
import {
  recordActionRollCards,
  recordCounterCheckRollCards,
  settledD20s
} from './actionRollCards.js'
import { rollerAsPerceivedByCaster } from './ruleRollCards.js'
import type {
  bindEncounterConcentrationApplications,
  persistEncounterConcentrationChildren
} from './concentrationChildrenPersistence.js'
import { bindEncounterDamageSaveChain } from './effectRepeatSavePersistence.js'
import { insertRunActor, readRunActors } from './documents.js'
import { idleTurnMarkChanges } from './idleTurnMark.js'
import { createPlacedSpatialEffect } from './placedSpatialEffects.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import { reconcileNativeMaintenanceOwners } from './maintenanceOwnerPersistence.js'
import { projectNativeGm } from './nativeProjection.js'
import type { EncounterCharacterWriteTransaction, EncounterWritePorts } from './ports.js'
import { presentEncounterResultForMember } from './resultPresentation.js'

type Outputs = ServerRuleExecutionApplicationOutputsDto
type AreaRoot = Extract<Outputs, { kind: 'ENCOUNTER_AREA_ACTION' }>
type TargetBatch = Extract<
  Outputs,
  { kind: 'CHARACTER_MECHANICS_BATCH' | 'ENCOUNTER_ACTOR_MECHANICS_BATCH' }
>

/**
 * One creature's receipt carries none of the caster's spend: the root holds it once. Only the
 * Character caster caught by their own area has their resource, item and stow on their own batch,
 * because those land in the same Sheet write as their outcome.
 */
function carriesCasterSpend(batch: TargetBatch, root: AreaRoot, merged: boolean) {
  const spend = (
    value: Pick<
      TargetBatch,
      | 'resourceConsumption'
      | 'sourceItemConsumption'
      | 'spellCastConsumption'
      | 'sourceItemUseStateTransition'
    >
  ) =>
    checksumCanonicalJson({
      resource: value.resourceConsumption,
      item: value.sourceItemConsumption,
      spell: value.spellCastConsumption,
      stow: value.sourceItemUseStateTransition
    })
  return (
    batch.featureResourceConsumption === null &&
    batch.actionEconomyTransition === null &&
    batch.attackActionTransition === undefined &&
    spend(batch) ===
      spend(
        merged
          ? root
          : {
              resourceConsumption: null,
              sourceItemConsumption: null,
              spellCastConsumption: null,
              sourceItemUseStateTransition: null
            }
      )
  )
}

/** What a commit is verified against: the creatures it keeps and the scope the root sealed. */
type CommitScope = {
  /**
   * The kept creatures in commit order, and whether the caster perceives each. One a forced mover
   * struck (D159) rather than the area caught names that mover.
   */
  targets: readonly {
    actorId: string
    perceivedByCaster: boolean
    collision?: { moverActorId: string }
  }[]
  caughtChecksum: string
  removedActorIds: readonly string[]
  /** The caught creatures the action had no effect on, which took no save. */
  unaffectedActorIds: readonly string[]
  /** The Scene the commit places its zone on; null when it places none. */
  zoneSceneId: string | null
}

/**
 * Commits a point-area action in the transaction of the answer that settled it, or a cast on a list
 * of chosen creatures (D118) that asked for no save in the one transaction that ran it: the root with the caster's one
 * spend, each kept creature's outcome as its own child receipt, and the Concentration checks the
 * damage asks for. A pending area's final snapshot is validated against the stored area, so a
 * planner can neither skip a creature's save nor settle an undecided Legendary Resistance. A chosen
 * list that asked for no save has no pending area, so its creatures are the ones the command named, in
 * order; one that asked for saves pends and settles like a point area.
 */
export async function persistEncounterAreaCommit(
  ctx: EncounterCharacterWriteTransaction & {
    readonly ports: Pick<
      EncounterWritePorts,
      | 'insertTableRoll'
      | 'retainPrivateRoll'
      | 'requireCampaignAuthority'
      | 'snapshotBlueprintEnemies'
    >
  },
  input: LiveSessionEncounterAreaCommitInput,
  callbacks: {
    readMaintenanceCapture(
      state: EncounterRunState,
      request: LiveSessionEncounterAreaCommitInput['maintenanceOwners'][number]
    ): ReturnType<typeof readEncounterMaintenanceCapture>
    readAreaSceneInputs(
      state: EncounterRunState,
      input: ActionAreaSceneRequestDto
    ): Promise<Extract<LiveSessionEncounterRulesResponse, { kind: 'ACTION_AREA_SCENE' }>['context']>
    validateReadFence(
      state: EncounterRunState,
      characterIds: readonly string[],
      revisions: LiveSessionRulesRevisions
    ): Promise<void>
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
    currentCharacterMaximumHitPoints(state: EncounterRunState, characterId: string): Promise<number>
    bindConcentrationApplications(
      state: Parameters<typeof bindEncounterConcentrationApplications>[1],
      applications: Parameters<typeof bindEncounterConcentrationApplications>[2]
    ): ReturnType<typeof bindEncounterConcentrationApplications>
    persistConcentrationChildren(
      input: Parameters<typeof persistEncounterConcentrationChildren>[1]
    ): ReturnType<typeof persistEncounterConcentrationChildren>
    applyForcedMovements: ApplyEncounterForcedMovements
    applySummonTokens: ApplyEncounterSummonTokens
  }
): Promise<EncounterCommandResultDto> {
  const admission = await readLiveEncounterActionAdmission(ctx, input)
  const userId = input.expectedUserId
  const { state, run, fingerprint, campaign, membership } = admission
  if (state.campaignId !== input.campaignId)
    throw new Error('Live Session Encounter scope mismatch.')
  if (admission.kind === 'REPLAY')
    return presentEncounterResultForMember(ctx, {
      campaign,
      membership,
      result: admission.result
    })
  const { resume, removal, initiatorUserId } = admission
  const command = admission.input
  // The pending area this commit settles: a creature's answer resumes it, and so does the GM's
  // removal of the last creature it waited on.
  const pendingOccurrence = resume?.occurrence ?? removal?.occurrence ?? null
  const occurrenceVersion = pendingOccurrence ? pendingOccurrence.version + 1 : 0
  const rootExecution = input.execution
  if (
    command.type !== 'RESOLVE_ACTION' ||
    command.target.kind === 'ACTOR' ||
    command.optionalCombatIntent != null ||
    rootExecution.status !== 'AGGREGATE_CHOICE_COMPLETE' ||
    rootExecution.applicationOutputs.kind !== 'ENCOUNTER_AREA_ACTION' ||
    rootExecution.occurrenceVersion !== occurrenceVersion ||
    (pendingOccurrence && rootExecution.occurrenceId !== pendingOccurrence.id)
  )
    throw new Error('Live Session terminal action is not an ordinary completed area.')
  const root = rootExecution.applicationOutputs
  const areaOccurrenceId = rootExecution.occurrenceId
  const { target } = command
  let scope: CommitScope
  const failedReceipts = input.failedCounters.map(({ receipt }) => receipt)
  if (input.area === null) {
    // An action that asked for no save waits on no one, so nothing is removed. Only a counter
    // offered before it did anything can pause it, and its answer resumes the cast (D127). It
    // reaches the creatures a chosen list names or, for an area that picks its own (a hit-point
    // pool), the ones its commit carries.
    const reachedActorIds =
      target.kind === 'ACTORS' ? target.actorIds : input.targets.map(({ actorId }) => actorId)
    if (
      removal ||
      input.removal ||
      (resume
        ? resume.area ||
          !input.response ||
          !castPendingContinues(resume.pending.context, input.response, {
            failedCounters: failedReceipts
          })
        : input.response || failedReceipts.length > 0) ||
      reachedActorIds.some((actorId) => !state.actorIds.includes(actorId))
    )
      throw new Error('Live Session chosen creatures scope mismatch.')
    scope = {
      targets: reachedActorIds.map((actorId) => ({ actorId, perceivedByCaster: true })),
      caughtChecksum: encounterChosenActorsChecksum(reachedActorIds),
      removedActorIds: [],
      unaffectedActorIds: input.unaffectedActorIds,
      zoneSceneId: null
    }
  } else {
    const { area } = input
    if (rootExecution.occurrenceId !== area.occurrenceId)
      throw new Error('Live Session terminal action is not an ordinary completed area.')
    // The area's final snapshot is the stored one with exactly the answer or removal that settled it.
    if (removal) {
      if (input.removal?.actorId.toLowerCase() !== removal.input.actorId)
        throw new Error('Live Session pending area removal mismatch.')
      requireAreaActionRemoval({
        stored: removal.snapshot,
        next: area,
        actorId: removal.input.actorId
      })
    }
    if (resume?.area) {
      const resolution = input.response?.resolution
      if (resolution?.kind === 'FORCED_MOVEMENT')
        requireAreaActionForcedMovement({
          stored: resume.area.snapshot,
          next: area,
          requestId: resolution.requestId,
          position: resolution.position
        })
      else if (resolution?.kind === 'AREA_LEGENDARY_RESISTANCE')
        requireAreaActionLegendaryResistance({
          stored: resume.area.snapshot,
          next: area,
          actorId: resume.area.actorId
        })
      else
        requireAreaActionAnswer({
          stored: resume.area.snapshot,
          next: area,
          requestId: resume.pending.snapshot.request.requestId
        })
    } else if (resume) {
      // The counter's last answer ended the pause and the area caught nobody, so it settled without a
      // stored area: the cast's own pending is what it continues.
      if (
        !input.response ||
        !castPendingContinues(resume.pending.context, input.response, {
          failedCounters: failedReceipts
        })
      )
        throw new Error('Live Session pending area answer mismatch.')
    }
    const context = await requireAreaActionPendingRoot(
      {
        snapshot: area,
        command: { ...command, target },
        fingerprint,
        initiatorUserId,
        state
      },
      callbacks.readAreaSceneInputs
    )
    if (
      context.targets.some(
        (sealed) =>
          sealed.testedJson === undefined ||
          (sealed.legendaryResistance !== undefined &&
            sealed.legendaryResistance.decision === undefined)
      )
    )
      throw new Error('Live Session area has an unanswered save or undecided choice.')
    // Every push its source picked lands where the pick left it (D157), and none is still open.
    const { landed = [], pick, rays } = context.forcedMovement ?? {}
    if (
      pick ||
      // A random push lands on the ray sealed when the pick was held, never a reroll.
      input.forcedMovements.some(({ targetActorId, ray }) => {
        const sealed = rays?.find((entry) => entry.targetActorId === targetActorId)?.ray
        return sealed && (ray?.x !== sealed.x || ray?.y !== sealed.y)
      }) ||
      landed.some(
        ({ targetActorId }) =>
          !input.forcedMovements.some((movement) => movement.targetActorId === targetActorId)
      ) ||
      input.forcedMovements.some(({ targetActorId, position }) => {
        const picked = landed.find((entry) => entry.targetActorId === targetActorId)?.position
        return picked
          ? !position || position.x !== picked.x || position.y !== picked.y
          : position !== null
      })
    )
      throw new Error('Live Session area forced movement mismatch.')
    // The counters that failed against the cast were sealed with its area and are spent with it.
    if (
      checksumCanonicalJson(context.failedCounters ?? []) !==
      checksumCanonicalJson(
        // The receipt is the sealed counter plus what its reactor spent, which the commit adds.
        failedReceipts.map(
          ({
            spellCastConsumption: _spell,
            applications: _applications,
            characterStreamVersion: _version,
            actionEconomyTransition: _economy,
            ...sealed
          }) => sealed
        )
      )
    )
      throw new Error('Live Session area failed counters mismatch.')
    scope = {
      targets: context.targets,
      caughtChecksum: context.caughtChecksum,
      removedActorIds: context.removedActorIds,
      unaffectedActorIds: context.unaffectedActorIds ?? [],
      zoneSceneId: context.placesZone ? (context.scene?.sceneId ?? null) : null
    }
  }
  // A mover's collision damage (D159) settles as one more entry per mover, after the caught creatures',
  // and a creature a mover struck as one more after those, under the occurrence its sealed save ran.
  const caughtActorIds = scope.targets.flatMap(({ actorId, collision }) =>
    collision ? [] : [actorId]
  )
  const struck = scope.targets.flatMap(({ actorId, collision }) =>
    collision ? [{ actorId, moverActorId: collision.moverActorId }] : []
  )
  const collisionActorIds = input.targets
    .slice(caughtActorIds.length, input.targets.length - struck.length)
    .map(({ actorId }) => actorId)
  const movedWithCollision = (actorId: string) =>
    input.forcedMovements.some(
      (movement) => movement.targetActorId === actorId && movement.collision
    )
  if (
    new Set(collisionActorIds).size !== collisionActorIds.length ||
    !collisionActorIds.every(movedWithCollision) ||
    !struck.every(({ moverActorId }) => movedWithCollision(moverActorId))
  )
    throw new Error('Live Session area forced movement collision mismatch.')
  const kept = [
    ...encounterChosenActorEntries(areaOccurrenceId, [...caughtActorIds, ...collisionActorIds]),
    ...struck.map(({ actorId, moverActorId }) => ({
      actorId,
      occurrenceId: encounterCollisionSaveOccurrenceId(areaOccurrenceId, moverActorId, actorId)
    }))
  ]
  if (
    root.sourceActorId !== command.actorId ||
    root.caughtChecksum !== scope.caughtChecksum ||
    checksumCanonicalJson(root.placedSpatialEffectIds) !==
      checksumCanonicalJson(input.placedZones.map(({ id }) => id)) ||
    (scope.zoneSceneId !== null) !== input.placedZones.length > 0 ||
    checksumCanonicalJson(root.removedActorIds) !== checksumCanonicalJson(scope.removedActorIds) ||
    checksumCanonicalJson(root.targetOccurrenceIds) !==
      checksumCanonicalJson(kept.map(({ occurrenceId }) => occurrenceId)) ||
    checksumCanonicalJson(input.targets.map(({ actorId }) => actorId)) !==
      checksumCanonicalJson(kept.map(({ actorId }) => actorId)) ||
    input.ruleOverrides.some((warning) => !command.acknowledgedWarnings.includes(warning.code))
  )
    throw new Error('Live Session area result scope mismatch.')

  const actors = await readRunActors(ctx, state)
  const source = actors.find((actor) => actor.id === command.actorId)
  if (!source || root.sourceCharacterId !== (source.kind === 'CHARACTER' ? source.sourceId : null))
    throw new Error('Live Session area actor scope mismatch.')
  const ruleActors = actors.filter((actor) => actor.kind !== 'CHARACTER')
  if (
    input.rules.actors.length !== ruleActors.length ||
    new Set(input.rules.actors.map((actor) => actor.actorId)).size !== ruleActors.length ||
    input.rules.actors.some((actor) => !ruleActors.some((current) => current.id === actor.actorId))
  )
    throw new Error('Live Session area output scope mismatch.')
  const children = input.targets.map(({ actorId, execution, createdEffects }, index) => {
    const actor = actors.find((candidate) => candidate.id === actorId)
    const batch = execution.status === 'COMPLETE' ? execution.applicationOutputs : null
    const initial = execution.status === 'COMPLETE' ? execution : null
    if (
      !actor ||
      !initial ||
      (batch?.kind !== 'CHARACTER_MECHANICS_BATCH' &&
        batch?.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH') ||
      (actor.kind === 'CHARACTER') !== (batch.kind === 'CHARACTER_MECHANICS_BATCH') ||
      execution.occurrenceId !== kept[index]!.occurrenceId ||
      execution.occurrenceVersion !== 0 ||
      batch.occurrenceId !== execution.occurrenceId ||
      batch.parentOccurrenceId !== areaOccurrenceId ||
      batch.sourceActorId !== source.id ||
      batch.targetActorId !== actor.id ||
      batch.activeEffectTransitions.length +
        batch.stateEffectTransitions.length +
        batch.grantEffectTransitions.length +
        (batch.kind === 'CHARACTER_MECHANICS_BATCH'
          ? batch.reactionEffectTransitions.length
          : 0) !==
        createdEffects.length ||
      (input.maintainedState === null && batch.maintenanceTransition !== undefined) ||
      (batch.kind === 'CHARACTER_MECHANICS_BATCH' &&
        batch.targetFeatureResourceConsumption !== null) ||
      // A collision entry runs the pusher's synthetic damage action, sourced by its own occurrence id.
      initial.evidence.source.definitionId !==
        (index < caughtActorIds.length ? input.initialDefinitionId : execution.occurrenceId) ||
      initial.evidence.source.gameSystemId !== state.gameSystemId ||
      initial.phaseReceipts?.some((phase) => phase.template.gameSystemId !== state.gameSystemId)
    )
      throw new Error('Live Session area target result scope mismatch.')
    return {
      actor,
      batch,
      execution: initial,
      occurrenceId: execution.occurrenceId,
      createdEffects
    }
  })
  const casterIsCharacter = source.kind === 'CHARACTER'
  // A caster named again (a second dart) spends once, with their first outcome.
  const mergedChildIndex = casterIsCharacter
    ? children.findIndex(({ actor }) => actor.id === source.id)
    : -1
  const mergedSpend = mergedChildIndex !== -1
  if (
    children.some(
      (child, index) => !carriesCasterSpend(child.batch, root, index === mergedChildIndex)
    )
  )
    throw new Error('Live Session area target spend mismatch.')
  const characterIds = new Set(
    actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : []))
  )
  await readMaintenanceOwnerRequests({
    requests: input.maintenanceOwners,
    actorIds: [source.id],
    characterIds,
    read: (request) => callbacks.readMaintenanceCapture(state, request)
  })
  await callbacks.validateReadFence(state, [...characterIds], input.revisions)
  for (const occurrenceId of [areaOccurrenceId, ...children.map((child) => child.occurrenceId)]) {
    const collision = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_publicId', (q) => q.eq('id', occurrenceId))
      .unique()
    if (collision && collision._id !== pendingOccurrence?._id)
      throw new Error('Encounter rule occurrence ID was already used.')
  }
  // The first creature whose outcome a Concentration holds replaces the caster's earlier one and
  // creates the state; the rest depend on it. This reads before any mechanics advance a Character.
  const maintained = children.filter(({ batch }) => batch.maintenanceTransition != null)
  // A cast with no creature outcome to hold its Concentration carries it on the root (D135).
  const rootMaintenance = root.maintenanceTransition ?? null
  if (
    (maintained.length > 0 || rootMaintenance !== null) !== (input.maintainedState !== null) ||
    (maintained.length > 0 && rootMaintenance !== null) ||
    input.placedZones.some(
      ({ maintainedEffectStateId }) =>
        maintainedEffectStateId !== null && maintainedEffectStateId !== input.maintainedState?.id
    )
  )
    throw new Error('Live Session area maintenance scope mismatch.')
  const carrier = maintained[0] ?? null
  const maintenance = carrier
    ? await prepareEncounterActionMaintenance(ctx, {
        state,
        command: {
          encounterId: state.id,
          actorId: source.id,
          target: { kind: 'ACTOR', actorId: carrier.actor.id },
          actionId: command.actionId,
          commandId: encounterAreaTargetCommandId(carrier.occurrenceId)
        },
        execution: carrier.execution,
        maintainedState: input.maintainedState,
        createdEffects: [...carrier.createdEffects],
        authorizedCharacterIds: characterIds
      })
    : rootMaintenance && input.maintainedState
      ? await prepareMaintenanceReplacement(ctx, {
          state,
          command: { actorId: source.id, actionId: command.actionId },
          maintainedState: input.maintainedState,
          sourceOccurrenceId: areaOccurrenceId,
          transition: rootMaintenance,
          createdDependentEffectIds: [],
          authorizedCharacterIds: characterIds
        })
      : null

  const { spends, mutation: sourceMutation } = sourceSpendMutation({
    source,
    command,
    resource: input.resourceConsumption,
    item: input.itemConsumption,
    spell: input.spellConsumption,
    receipts: root
  })
  // Every counter that failed against this cast spends its reactor's slot and reaction with the cast (D127).
  const failedSpends = failedCounterSpends({
    failedCounters: input.failedCounters,
    actors,
    source
  })
  // The caster's counter to a counter cast against its cast spends its slot in the caster's one
  // mechanics call, after the cast's, so the Character advances once.
  const casterFailed = failedSpends.find(({ reactor }) => reactor.id === source.id)
  const casterMutation = combineSpendMutations(sourceMutation, casterFailed?.mutation ?? {})
  const casterSpends = spends || Boolean(casterFailed?.spends)
  const current = new Map(actors.map((actor) => [actor.id, actor] as const))
  const live = (actorId: string) => {
    const actor = current.get(actorId)
    if (!actor) throw new Error('Live Session area actor scope mismatch.')
    return actor
  }
  // The caster's resource, item and stow, and the conditions their ended effects released, are one
  // Sheet write; a caster caught by their own area makes it with their outcome (the release leads
  // that batch), any other Character caster makes it alone.
  const sourceMechanics =
    (casterSpends || root.sourceApplications.length) && casterIsCharacter && !mergedSpend
      ? await callbacks.applyMechanics({
          encounterId: state.id,
          expectedEncounterVersion: state.version,
          occurrenceId: areaOccurrenceId,
          sourceCommandId: command.commandId,
          occurredAt: input.occurredAt,
          targetActorId: source.id,
          commandId: deriveEncounterCharacterMechanicsEventCommandId({
            occurrenceId: areaOccurrenceId,
            sourceCommandId: command.commandId,
            phase: 'DIRECT_ACTION_RESOURCE',
            ordinal: 0,
            targetCharacterId: source.sourceId
          }),
          applications: root.sourceApplications.map((application) => ({
            ...application,
            targetActorId: source.id
          })),
          effectiveMaximumHitPoints: await callbacks.currentCharacterMaximumHitPoints(
            state,
            source.sourceId
          ),
          forceVersionAdvance: false,
          ...casterMutation
        })
      : null
  if (sourceMechanics) {
    current.set(source.id, sourceMechanics.updatedActor)
    if (
      root.sourceCharacterStreamVersion !== sourceMechanics.characterStreamVersion ||
      (casterFailed &&
        casterFailed.failed.receipt.characterStreamVersion !==
          sourceMechanics.characterStreamVersion) ||
      checksumCanonicalJson(sourceMechanics.receiptApplications) !==
        checksumCanonicalJson(root.sourceApplications) ||
      checksumCanonicalJson(sourceMechanics.itemUseStateTransition ?? null) !==
        checksumCanonicalJson(root.sourceItemUseStateTransition)
    )
      throw new Error('Live Session source Character receipt mismatch.')
  } else if (
    (!(mergedSpend && casterSpends) && root.sourceCharacterStreamVersion !== null) ||
    root.sourceApplications.length
  )
    throw new Error('Live Session source Character receipt mismatch.')

  const healEndedGrants: ActiveRuleEffectRecord[] = []
  // A cast's creature form is one Creature for every child, read once (D130).
  const formCreatures = new Map<string, Promise<EncounterActorFormCreature>>()
  for (const [index, { actor, batch, occurrenceId, createdEffects }] of children.entries()) {
    const merged = index === mergedChildIndex
    // A creature that countered the cast pays its slot in its first outcome's Character write.
    const childFailed =
      actor.id !== source.id && index === children.findIndex((child) => child.actor.id === actor.id)
        ? failedSpends.find(({ reactor }) => reactor.id === actor.id)
        : undefined
    const [formEffect] = createdEffects
    const creatureId = formEffect ? createdFormCreatureId(formEffect) : null
    if (creatureId !== null && !formCreatures.has(creatureId))
      formCreatures.set(
        creatureId,
        readActorFormCreature(ctx.ports, {
          campaignId: state.campaignId,
          userId,
          gameSystemId: state.gameSystemId,
          creatureId
        })
      )
    const enterForm =
      formEffect && creatureId !== null
        ? actorFormEntry(formEffect, await formCreatures.get(creatureId)!)
        : undefined
    const mechanics = await callbacks.applyMechanics({
      encounterId: state.id,
      expectedEncounterVersion: state.version,
      occurrenceId,
      sourceCommandId: command.commandId,
      occurredAt: input.occurredAt,
      targetActorId: actor.id,
      commandId: encounterAreaTargetCommandId(occurrenceId),
      applications: batch.applications.map((application) => ({
        ...application,
        targetActorId: actor.id
      })),
      effectiveMaximumHitPoints: batch.targetTransition.before.maximumHitPoints,
      effectiveScalarValues: batch.targetTransition.before.scalarValues,
      forceVersionAdvance: false,
      ...(enterForm ? { enterForm } : {}),
      ...(merged ? casterMutation : (childFailed?.mutation ?? {}))
    })
    if (
      checksumCanonicalJson(mechanics.receiptApplications) !==
        checksumCanonicalJson(batch.applications) ||
      checksumCanonicalJson(mechanics.targetTransition) !==
        checksumCanonicalJson(batch.targetTransition) ||
      (batch.kind === 'CHARACTER_MECHANICS_BATCH' &&
        batch.targetCharacterStreamVersion !== mechanics.characterStreamVersion) ||
      (merged &&
        casterSpends &&
        (root.sourceCharacterStreamVersion !== mechanics.characterStreamVersion ||
          checksumCanonicalJson(mechanics.itemUseStateTransition ?? null) !==
            checksumCanonicalJson(root.sourceItemUseStateTransition)))
    )
      throw new Error('Live Session mechanics receipt mismatch.')
    if (
      (casterFailed &&
        merged &&
        casterFailed.failed.receipt.characterStreamVersion !== mechanics.characterStreamVersion) ||
      (childFailed &&
        childFailed.failed.receipt.characterStreamVersion !== mechanics.characterStreamVersion)
    )
      throw new Error('Live Session failed counter Character receipt mismatch.')
    current.set(actor.id, mechanics.updatedActor)
    healEndedGrants.push(...mechanics.endedGrants)
    // A Legendary Resistance the creature used spends one of its own charges.
    const charge =
      batch.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
        ? batch.targetFeatureResourceConsumption
        : null
    if (charge && charge.ownerActorId !== actor.id)
      throw new Error('Live Session area charge scope mismatch.')
    const reactionEconomy = childFailed?.failed.receipt.actionEconomyTransition ?? null
    if (charge || reactionEconomy)
      current.set(
        actor.id,
        await settleActionSourceSpend(ctx, {
          encounterId: state.id,
          source: mechanics.updatedActor,
          spend: {
            featureResourceConsumption: charge,
            actionEconomyTransition: reactionEconomy,
            attackActionTransition: undefined
          },
          economyOverridden: false
        })
      )
  }
  // The grants the cast used up (Invisibility) end with it; an undo gives them back.
  const endedMaintainedStates = await endEffects(ctx, input.consumedGrants)
  current.set(
    source.id,
    await settleActionSourceSpend(ctx, {
      encounterId: state.id,
      source: live(source.id),
      spend: root,
      economyOverridden: overridesActionEconomy(input.ruleOverrides)
    })
  )
  if (casterFailed)
    current.set(
      source.id,
      await settleActionSourceSpend(ctx, {
        encounterId: state.id,
        source: live(source.id),
        spend: {
          featureResourceConsumption: null,
          actionEconomyTransition: casterFailed.failed.receipt.actionEconomyTransition,
          attackActionTransition: undefined
        },
        economyOverridden: false
      })
    )
  // Any other creature that failed to counter the cast pays in a call of its own; the caster and the
  // kept creatures paid with their outcomes.
  for (const [actorId, settled] of await applyFailedCounterSpends(ctx, {
    state,
    occurrenceId: areaOccurrenceId,
    sourceCommandId: command.commandId,
    occurredAt: input.occurredAt,
    spends: failedSpends,
    exceptActorIds: [source.id, ...children.map(({ actor }) => actor.id)],
    applyMechanics: callbacks.applyMechanics,
    currentCharacterMaximumHitPoints: callbacks.currentCharacterMaximumHitPoints
  }))
    current.set(actorId, settled)
  let nextActors: EncounterRunActorState[] = actors.map((actor) => live(actor.id))
  const nextState = encounterRunStateSchema.parse({
    ...state,
    actorIds: [...state.actorIds, ...input.summonedTokens.map(({ actor }) => actor.id)],
    version: state.version + 1,
    updatedAt: input.occurredAt
  })
  const completedOccurrence = await completeActionOccurrence(ctx, {
    state,
    nextState,
    occurrenceId: areaOccurrenceId,
    rootCommandId: command.commandId,
    version: occurrenceVersion,
    resume: pendingOccurrence ? { occurrence: pendingOccurrence } : null,
    occurredAt: input.occurredAt
  })
  if (rootMaintenance && maintenance && input.maintainedState)
    await applyMaintenanceReplacement(ctx, {
      state: nextState,
      actorId: source.id,
      maintenance,
      created: input.maintainedState,
      occurredAt: input.occurredAt
    })
  // A zone's own record, then its bands (D154), in the order the cast planned them.
  if (scope.zoneSceneId !== null)
    for (const zone of input.placedZones)
      await createPlacedSpatialEffect(ctx, {
        encounterId: state.id,
        sceneId: scope.zoneSceneId,
        zone
      })
  // The placed zone's timed grant (D153) or the summon's carrier effect lands on the caster, exactly
  // as the root receipted it; the carrier depends on the cast's Concentration and holds the summon.
  const grant = input.zoneSourceGrant
  const origin = grant?.definition.origin
  const hasSummon = input.summonedTokens.length > 0
  if (
    (hasSummon && !grant) ||
    input.summonedTokens.some(({ actor }) => actor.owner?.sourceEffectId !== grant?.id) ||
    checksumCanonicalJson(
      (grant &&
        projectNativeActionEffectTransitions({
          state: null,
          recurring: grant,
          targetActorId: source.id
        }).activeEffectTransitions[0]) ??
        null
    ) !== checksumCanonicalJson(root.sourceGrantTransition ?? null) ||
    (grant &&
      (input.placedZones.length > 0 === hasSummon ||
        checksumCanonicalJson(grant.owner) !==
          checksumCanonicalJson(turnEffectOwner(source, state.id)) ||
        grant.maintainedEffectStateId !==
          (hasSummon ? (input.maintainedState?.id ?? null) : null) ||
        origin?.kind !== 'ENCOUNTER' ||
        origin.sourceAggregateId !== state.id ||
        origin.sourceActorId !== source.id ||
        origin.sourceOccurrenceId !== areaOccurrenceId ||
        origin.rootCommandId !== command.commandId ||
        grant.definition.frozenGraph.source.gameSystemId !== state.gameSystemId))
  )
    throw new Error('Live Session zone source grant mismatch.')
  if (grant) {
    const created = await createActiveRuleEffectStore(ctx).create({
      id: grant.id,
      owner: grant.owner,
      definition: grant.definition,
      lifecycle: grant.lifecycle,
      maintainedEffectStateId: grant.maintainedEffectStateId,
      occurredAt: input.occurredAt
    })
    if (checksumCanonicalJson(created) !== checksumCanonicalJson(grant))
      throw new Error('Live Session zone source grant changed before settlement.')
  }
  for (const child of children) {
    const { execution, actor, occurrenceId, createdEffects } = child
    await persistCompletedChild(ctx, {
      state: nextState,
      result: execution,
      rootCommandId: encounterAreaTargetCommandId(occurrenceId),
      commandId: encounterAreaTargetCommandId(occurrenceId),
      commandType: 'RESOLVE_ACTION',
      fingerprint: checksumRuleDocument({
        areaOccurrenceId,
        rootFingerprint: fingerprint,
        actorId: actor.id
      }),
      userId: initiatorUserId,
      correlationId: areaOccurrenceId,
      metadata: {
        schemaVersion: 1,
        transition: 'START',
        definitionId: input.initialDefinitionId,
        expectedAggregateVersion: state.version,
        factsChecksum: root.caughtChecksum,
        optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
      },
      occurredAt: input.occurredAt
    })
    if (createdEffects.length > 0)
      nextActors = await persistEncounterActionEffects(ctx, {
        state: nextState,
        command: {
          encounterId: state.id,
          actorId: source.id,
          target: { kind: 'ACTOR', actorId: actor.id },
          actionId: command.actionId,
          commandId: encounterAreaTargetCommandId(occurrenceId)
        },
        execution,
        maintainedState: child.batch.maintenanceTransition ? input.maintainedState : null,
        maintenance: child === carrier ? maintenance : null,
        deferOwnerReconcile: true,
        createdEffects: [...createdEffects],
        actors: nextActors,
        authorizedCharacterIds: characterIds,
        occurredAt: input.occurredAt
      })
  }
  // The replaced Concentration's owners settle once every creature holds its new effect.
  if (maintenance)
    nextActors = await reconcileNativeMaintenanceOwners(ctx, {
      encounterId: state.id,
      maintenance,
      actors: nextActors,
      occurredAt: input.occurredAt
    })
  // One Concentration check per damaged creature, against the damage the root recorded.
  const damage = nativeConcentrationDamageApplications(
    children.map(({ actor, batch }) => ({
      targetActorId: actor.id,
      applications: batch.applications
    })),
    false
  )
  if (checksumCanonicalJson(damage) !== checksumCanonicalJson(root.damage))
    throw new Error('Live Session area damage envelope mismatch.')
  const settledChildren = await callbacks.persistConcentrationChildren({
    state: nextState,
    actors: nextActors,
    parentOccurrenceId: areaOccurrenceId,
    parentCommandFingerprint: fingerprint,
    finalizedDamageEnvelopeChecksum: checksumRuleDocument(damage),
    remaining: await bindEncounterDamageSaveChain(ctx, {
      concentration: await callbacks.bindConcentrationApplications(nextState, damage),
      state: nextState,
      actors: nextActors,
      applications: damage,
      parentOccurrenceId: areaOccurrenceId,
      damagerActorId: command.actorId
    }),
    correlationId: areaOccurrenceId,
    userId,
    authorizedCharacterIds: characterIds,
    occurredAt: input.occurredAt,
    damagedActorIds: new Set(children.map(({ actor }) => actor.id)),
    concentration: input.concentration,
    concentrationEnds: input.concentrationEnds,
    endedGrants: input.endedGrants,
    pendingConcentration: input.pendingConcentration
  })
  // Each creature the area pushes or pulls moves on the Scene in this commit (D139), settling the
  // zones it passes through (D170).
  const settledMovements = input.forcedMovements.length
    ? await callbacks.applyForcedMovements({
        state,
        sourceActorId: command.actorId,
        commandId: command.commandId,
        movements: input.forcedMovements,
        occurrenceId: areaOccurrenceId,
        occurredAt: input.occurredAt,
        authorizedCharacterIds: characterIds,
        actors: settledChildren.actors,
        rules: input.rules
      })
    : { moves: [], landings: [], actors: settledChildren.actors, rules: input.rules }
  // The creature the cast conjures is a new Encounter actor and stands on the Scene from this
  // commit (D187b).
  for (const { actor } of input.summonedTokens) await insertRunActor(ctx, actor)
  const summoned = input.summonedTokens.length
    ? await callbacks.applySummonTokens({
        state,
        commandId: command.commandId,
        summons: input.summonedTokens
      })
    : []
  const projection = await projectNativeGm(
    ctx,
    nextState,
    [...settledMovements.actors, ...input.summonedTokens.map(({ actor }) => actor)],
    settledMovements.rules
  )
  // Each creature's save is its own card; the area's one damage roll is carded once, with the first,
  // unless every entry rolled its own.
  const answers = await actionSystemRollAnswers(ctx, {
    occurrenceId: areaOccurrenceId,
    response: input.response,
    responderUserId: userId
  })
  for (const [index, { actor, batch, occurrenceId }] of children.entries())
    await recordActionRollCards(ctx, {
      campaign,
      encounterId: state.id,
      gameSystemId: state.gameSystemId,
      rollScope: occurrenceId,
      batch: index === 0 || input.rollsPerTarget ? batch : { ...batch, applications: [] },
      actionLabel: input.label,
      source,
      target: rollerAsPerceivedByCaster(
        actor,
        scope.targets.find((target) => target.actorId === actor.id)?.perceivedByCaster ?? true
      ),
      initiatorUserId,
      visibility: command.visibility,
      createdAt: input.occurredAt,
      appCardedD20s: await readAppCardedDice(ctx, {
        occurrenceId: areaOccurrenceId,
        answers,
        dice: settledD20s(batch)
      })
    })
  await recordCounterCheckRollCards(ctx, {
    campaign,
    encounterId: state.id,
    gameSystemId: state.gameSystemId,
    occurrenceId: areaOccurrenceId,
    checks: failedSpends.flatMap(({ failed, reactor }) =>
      failed.receipt.check ? [{ reactor, check: failed.receipt.check }] : []
    ),
    response: input.response,
    responderUserId: userId,
    initiatorUserId,
    visibility: command.visibility,
    createdAt: input.occurredAt
  })
  const result = encounterCommandResultDtoSchema.parse({
    projection,
    roll: null,
    occurrence: {
      occurrenceId: areaOccurrenceId,
      occurrenceVersion,
      status: 'COMPLETE',
      pending: null
    }
  })
  await recordActionRoot(ctx, {
    run,
    state,
    nextState,
    command,
    fingerprint,
    initiatorUserId,
    execution: rootExecution,
    definitionId: input.initialDefinitionId,
    factsChecksum: root.caughtChecksum,
    result,
    commandFields: {
      label: input.label,
      ruleOverrides: input.ruleOverrides,
      consumedGrants: receiptConsumedGrants({
        ...input,
        endedGrants: [...input.endedGrants, ...healEndedGrants]
      }),
      endedMaintainedStates,
      addedConcentrationCasterId: maintenance?.addedConcentrationCasterId ?? null,
      failedCounters: failedReceipts,
      speedBonusTurn: null,
      teleportAllowanceTurn: null,
      forcedMovements: settledMovements.moves,
      summonedTokens: summoned,
      forcedMovementLandings: settledMovements.landings,
      turnUses: null,
      idleTurnMarkChanges: idleTurnMarkChanges(actors, nextActors),
      issuerLines: children.flatMap(({ actor, batch }) => {
        // A cast on chosen creatures asks no save, so it has nothing to report per creature.
        if (!batch.d20) return []
        // The rolled d20 keeps its failed path when Legendary Resistance turned it into a success.
        const failed =
          batch.d20?.resultPath === 'ON_SAVE_FAIL' &&
          !(batch.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' && batch.legendaryResistance?.use)
        if (scope.targets.find((target) => target.actorId === actor.id)?.perceivedByCaster)
          return [`${actor.label} ${failed ? 'failed its save' : 'succeeded on its save'}`]
        // An unperceived creature reaches the caster only by failing, and then unnamed.
        return failed ? ['An unseen creature failed its save'] : []
      }),
      gmLines: [
        ...scope.removedActorIds.map((actorId) => {
          const removed = actors.find((actor) => actor.id === actorId)
          if (!removed) throw new Error('Live Session area removed an unknown creature.')
          return `GM removed ${removed.label} from the area`
        }),
        ...scope.unaffectedActorIds.map((actorId) => {
          const unaffected = actors.find((actor) => actor.id === actorId)
          if (!unaffected) throw new Error('Live Session area left out an unknown creature.')
          return `${unaffected.label} was unaffected`
        })
      ]
    },
    occurredAt: input.occurredAt
  })
  if (resume && input.response)
    await insertActionEvidenceReceipt(ctx, {
      occurrence: { ...resume.occurrence, ...completedOccurrence },
      response: input.response,
      rootCommand: command,
      rootFingerprint: fingerprint,
      userId,
      rootInitiatorUserId: initiatorUserId,
      answeredRequestId: resume.pending.snapshot.request.requestId,
      result: rootExecution
    })
  return presentEncounterResultForMember(ctx, { campaign, membership, result })
}
