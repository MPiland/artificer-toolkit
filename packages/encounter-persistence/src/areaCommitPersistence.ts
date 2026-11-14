import type { ActionAreaSceneRequestDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterAreaCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { LiveSessionEncounterRulesResponse } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import {
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterInitiativeRoundStateDto } from '@artificer-toolkit/schema/shared/initiativeState'
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
import {
  followedActorId,
  takesInitiativeTurns
} from '@artificer-toolkit/rules-runtime/encounterInitiativeCursor'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import type { EncounterActorFormCreature } from '@artificer-toolkit/rules-runtime/encounterActorForm'
import {
  admitActionCommit,
  requireActionCommitFence,
  requireRuleOutputScope
} from './actionCommitFences.js'
import {
  actorFormEntry,
  createdFormCreatureId,
  readActorFormCreature
} from './actorFormPersistence.js'
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
  recordActionCommit,
  type ApplyEncounterForcedMovements,
  type ApplyEncounterSummonTokens
} from './actionCommitRecords.js'
import {
  applyActionSpendMechanics,
  requireSourceSpendReceipt,
  settleActionSourceSpend,
  sourceSpendMutation
} from './actionSourceSpend.js'
import { castPendingContinues } from './actionPending.js'
import { settleActionTargetOutcome } from './actionTargetOutcomeSettlement.js'
import { actionSystemRollAnswers, readAppCardedDice } from './appCardedDice.js'
import { recordActionRollCards, settledD20s } from './actionRollCards.js'
import { rollerAsPerceivedByCaster } from './ruleRollCards.js'
import type { persistEncounterConcentrationChildren } from './concentrationChildrenPersistence.js'
import { bindEncounterDamageSaveChain } from './effectRepeatSavePersistence.js'
import { insertReinforcementInitiative } from './actorReinforcementInitiative.js'
import { persistSummonInitiativeRollCard } from './initiativeRollCards.js'
import { insertRunActor, readRunActors } from './documents.js'
import { idleTurnMarkChanges } from './idleTurnMark.js'
import { storedInitiativeReceipt } from './initiativeReceipt.js'
import { createPlacedSpatialEffect } from './placedSpatialEffects.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import { reconcileNativeMaintenanceOwners } from './maintenanceOwnerPersistence.js'
import { projectNativeGm } from './nativeProjection.js'
import type { EncounterCharacterWriteTransaction, EncounterWritePorts } from './ports.js'

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
    persistConcentrationChildren(
      input: Parameters<typeof persistEncounterConcentrationChildren>[1]
    ): ReturnType<typeof persistEncounterConcentrationChildren>
    applyForcedMovements: ApplyEncounterForcedMovements
    applySummonTokens: ApplyEncounterSummonTokens
  }
): Promise<EncounterCommandResultDto> {
  const admission = await admitActionCommit(ctx, input)
  if (admission.kind === 'REPLAY') return admission.result
  const userId = input.expectedUserId
  const { state, fingerprint, campaign, resume, removal, initiatorUserId } = admission
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
  if (input.area === null) {
    // An action that asked for no save waits on no one, so nothing is removed. Only a reaction
    // offered before it did anything can pause it, and the cast resumes from that offer's decline
    // (D127) or from the chosen reaction's committed child action (D219). It reaches the creatures
    // a chosen list names or, for an area that picks its own (a hit-point pool), the ones its
    // commit carries.
    const reachedActorIds =
      target.kind === 'ACTORS' ? target.actorIds : input.targets.map(({ actorId }) => actorId)
    if (
      removal ||
      input.removal ||
      (resume
        ? resume.area || !castPendingContinues(resume.pending.context, input.response, {})
        : input.response) ||
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
          requestId: resume.pending.snapshot.request.requestId,
          resume,
          response: input.response
        })
    } else if (resume) {
      // The cast left its pause, by the last decline or from a reaction's committed child (D219), and
      // the area settled without a stored one: the cast's own pending is what it continues.
      if (!castPendingContinues(resume.pending.context, input.response, {}))
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
  // The plan's rule output also covers the creatures this cast conjures, which are not stored yet.
  requireRuleOutputScope(
    [...actors, ...input.summonedTokens.map(({ actor }) => actor)],
    input.rules,
    'area'
  )
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
        batch.grantEffectTransitions.length !==
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
  await requireActionCommitFence(ctx, {
    state,
    characterIds: [...characterIds],
    revisions: input.revisions,
    occurrenceIds: [areaOccurrenceId, ...children.map((child) => child.occurrenceId)],
    pendingOccurrence,
    validateReadFence: callbacks.validateReadFence
  })
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
    (spends || root.sourceApplications.length) && casterIsCharacter && !mergedSpend
      ? await applyActionSpendMechanics(ctx, {
          state,
          occurrenceId: areaOccurrenceId,
          sourceCommandId: command.commandId,
          occurredAt: input.occurredAt,
          actor: source,
          applications: root.sourceApplications,
          mutation: sourceMutation,
          applyMechanics: callbacks.applyMechanics,
          currentCharacterMaximumHitPoints: callbacks.currentCharacterMaximumHitPoints
        })
      : null
  if (sourceMechanics) {
    current.set(source.id, sourceMechanics.updatedActor)
    requireSourceSpendReceipt(sourceMechanics, root)
  } else if (
    (!(mergedSpend && spends) && root.sourceCharacterStreamVersion !== null) ||
    root.sourceApplications.length
  )
    throw new Error('Live Session source Character receipt mismatch.')

  const healEndedGrants: ActiveRuleEffectRecord[] = []
  // A cast's creature form is one Creature for every child, read once (D130).
  const formCreatures = new Map<string, Promise<EncounterActorFormCreature>>()
  for (const [index, { actor, batch, occurrenceId, createdEffects }] of children.entries()) {
    const merged = index === mergedChildIndex
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
    const { mechanics, target: settled } = await settleActionTargetOutcome(ctx, {
      state,
      target: actor,
      batch,
      label: 'area',
      occurrenceId,
      sourceCommandId: command.commandId,
      commandId: encounterAreaTargetCommandId(occurrenceId),
      occurredAt: input.occurredAt,
      forceVersionAdvance: false,
      sourceMutation: merged ? sourceMutation : {},
      extra: enterForm ? { enterForm } : {},
      applyMechanics: callbacks.applyMechanics
    })
    if (
      merged &&
      spends &&
      (root.sourceCharacterStreamVersion !== mechanics.characterStreamVersion ||
        checksumCanonicalJson(mechanics.itemUseStateTransition ?? null) !==
          checksumCanonicalJson(root.sourceItemUseStateTransition))
    )
      throw new Error('Live Session mechanics receipt mismatch.')
    current.set(actor.id, settled)
    healEndedGrants.push(...mechanics.endedGrants)
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
  const damageBatches = children.map(({ actor, batch }) => ({
    targetActorId: actor.id,
    applications: batch.applications
  }))
  const damage = nativeConcentrationDamageApplications(damageBatches, false)
  if (checksumCanonicalJson(damage) !== checksumCanonicalJson(root.damage))
    throw new Error('Live Session area damage envelope mismatch.')
  const settledChildren = await callbacks.persistConcentrationChildren({
    state: nextState,
    actors: nextActors,
    parentOccurrenceId: areaOccurrenceId,
    parentCommandFingerprint: fingerprint,
    finalizedDamageEnvelopeChecksum: checksumRuleDocument(damage),
    remaining: await bindEncounterDamageSaveChain(ctx, {
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
  // commit (D187b). One authored to act right after its owner takes the place behind it in the
  // round; one authored to roll its own joins at the score it rolled, or behind its owner when the
  // policy could not roll it (D200).
  let castActors = settledMovements.actors
  let seatedInitiative: EncounterInitiativeRoundStateDto | null = null
  const summonedActors: EncounterRunActorState[] = []
  for (const { actor, initiativeRoll } of input.summonedTokens) {
    const anchorActorId =
      actor.owner?.turnTiming === 'AFTER_OWNER' ||
      (actor.owner?.turnTiming === 'OWN_INITIATIVE' && !initiativeRoll)
        ? followedActorId(actor, castActors, (id) => {
            const followed = castActors.find((candidate) => candidate.id === id)
            return followed !== undefined && takesInitiativeTurns(followed)
          })
        : null
    const seated =
      anchorActorId || initiativeRoll
        ? await insertReinforcementInitiative({
            ctx,
            state: nextState,
            actors: castActors,
            actor,
            initiative: initiativeRoll ? initiativeRoll.face + initiativeRoll.modifier : null,
            ...(anchorActorId ? { anchorActorId } : {}),
            occurredAt: input.occurredAt
          })
        : null
    const placed = seated?.actor ?? actor
    seatedInitiative = seated?.state ?? seatedInitiative
    castActors = [...castActors, placed]
    summonedActors.push(placed)
    await insertRunActor(ctx, placed)
    if (initiativeRoll && seated?.state)
      await persistSummonInitiativeRollCard(ctx, {
        state: nextState,
        campaign,
        actor: placed,
        roll: initiativeRoll,
        occurrenceId: areaOccurrenceId,
        initiatorUserId,
        occurredAt: input.occurredAt
      })
  }
  const summoned = input.summonedTokens.length
    ? await callbacks.applySummonTokens({
        state,
        commandId: command.commandId,
        summons: input.summonedTokens.map((summon, index) => ({
          ...summon,
          actor: summonedActors[index]!
        }))
      })
    : []
  const projection = await projectNativeGm(
    ctx,
    nextState,
    [...settledMovements.actors, ...summonedActors],
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
  return recordActionCommit(ctx, {
    admission,
    command,
    nextState,
    projection,
    completedOccurrence,
    execution: rootExecution,
    definitionId: input.initialDefinitionId,
    factsChecksum: root.caughtChecksum,
    response: input.response,
    userId,
    commandFields: {
      label: input.label,
      ruleOverrides: input.ruleOverrides,
      consumedGrants: receiptConsumedGrants({
        ...input,
        endedGrants: [...input.endedGrants, ...healEndedGrants]
      }),
      endedMaintainedStates,
      addedConcentrationCasterId: maintenance?.addedConcentrationCasterId ?? null,
      speedBonusTurn: null,
      teleportAllowanceTurn: null,
      forcedMovements: settledMovements.moves,
      summonedTokens: summoned,
      ...storedInitiativeReceipt(seatedInitiative),
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
}
