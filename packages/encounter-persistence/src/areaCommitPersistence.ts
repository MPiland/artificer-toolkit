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
  encounterChosenActorsChecksum
} from '@artificer-toolkit/rules-runtime/encounterAreaPending'
import { nativeConcentrationDamageApplications } from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { readLiveEncounterActionAdmission } from './liveActionAdmission.js'
import { insertActionEvidenceReceipt } from './actionEvidenceReceipt.js'
import {
  requireAreaActionAnswer,
  requireAreaActionLegendaryResistance,
  requireAreaActionPendingRoot,
  requireAreaActionRemoval
} from './actionAreaPending.js'
import { persistCompletedChild } from './actionChildPersistence.js'
import { receiptConsumedGrants } from './consumedGrantPersistence.js'
import { completeActionOccurrence, recordActionRoot } from './actionCommitRecords.js'
import { settleActionSourceSpend, sourceSpendMutation } from './actionSourceSpend.js'
import { actionSystemRollAnswers, readAppCardedDice } from './appCardedDice.js'
import { recordActionRollCards, settledD20s } from './actionRollCards.js'
import { rollerAsPerceivedByCaster } from './ruleRollCards.js'
import type {
  bindEncounterConcentrationApplications,
  persistEncounterConcentrationChildren
} from './concentrationChildrenPersistence.js'
import { readRunActors } from './documents.js'
import { createPlacedSpatialEffect } from './placedSpatialEffects.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
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
  /** The kept creatures in commit order, and whether the caster perceives each. */
  targets: readonly { actorId: string; perceivedByCaster: boolean }[]
  caughtChecksum: string
  removedActorIds: readonly string[]
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
    readonly ports: Pick<EncounterWritePorts, 'insertTableRoll' | 'retainPrivateRoll'>
  },
  input: LiveSessionEncounterAreaCommitInput,
  callbacks: {
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
  if (input.area === null) {
    // A chosen list that asked for no save waits on no one, so nothing resumes or is removed.
    if (
      target.kind !== 'ACTORS' ||
      pendingOccurrence ||
      input.response ||
      input.removal ||
      target.actorIds.some((actorId) => !state.actorIds.includes(actorId))
    )
      throw new Error('Live Session chosen creatures scope mismatch.')
    scope = {
      targets: target.actorIds.map((actorId) => ({ actorId, perceivedByCaster: true })),
      caughtChecksum: encounterChosenActorsChecksum(target.actorIds),
      removedActorIds: [],
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
    if (resume) {
      if (!resume.area) throw new Error('Live Session pending area answer mismatch.')
      if (input.response?.resolution.kind === 'AREA_LEGENDARY_RESISTANCE')
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
    scope = {
      targets: context.targets,
      caughtChecksum: context.caughtChecksum,
      removedActorIds: context.removedActorIds,
      zoneSceneId: context.placesZone ? (context.scene?.sceneId ?? null) : null
    }
  }
  const kept = encounterChosenActorEntries(
    areaOccurrenceId,
    scope.targets.map(({ actorId }) => actorId)
  )
  if (
    root.sourceActorId !== command.actorId ||
    root.caughtChecksum !== scope.caughtChecksum ||
    root.placedSpatialEffectId !== (input.placedZone?.id ?? null) ||
    (scope.zoneSceneId !== null) !== (input.placedZone !== null) ||
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
  const children = input.targets.map(({ actorId, execution }, index) => {
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
      batch.activeEffectTransitions.length > 0 ||
      batch.stateEffectTransitions.length > 0 ||
      batch.maintenanceTransition !== undefined ||
      (batch.kind === 'CHARACTER_MECHANICS_BATCH' &&
        batch.targetFeatureResourceConsumption !== null) ||
      initial.evidence.source.definitionId !== input.initialDefinitionId ||
      initial.evidence.source.gameSystemId !== state.gameSystemId ||
      initial.phaseReceipts?.some((phase) => phase.template.gameSystemId !== state.gameSystemId)
    )
      throw new Error('Live Session area target result scope mismatch.')
    return {
      actor,
      batch,
      execution: initial,
      occurrenceId: execution.occurrenceId
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
  await callbacks.validateReadFence(state, [...characterIds], input.revisions)
  for (const occurrenceId of [areaOccurrenceId, ...children.map((child) => child.occurrenceId)]) {
    const collision = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_publicId', (q) => q.eq('id', occurrenceId))
      .unique()
    if (collision && collision._id !== pendingOccurrence?._id)
      throw new Error('Encounter rule occurrence ID was already used.')
  }

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
  // The caster's resource, item and stow are one Sheet write; a caster caught by their own area
  // makes it with their outcome, any other Character caster makes it alone.
  const sourceMechanics =
    spends && casterIsCharacter && !mergedSpend
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
          applications: [],
          effectiveMaximumHitPoints: await callbacks.currentCharacterMaximumHitPoints(
            state,
            source.sourceId
          ),
          forceVersionAdvance: false,
          ...sourceMutation
        })
      : null
  if (sourceMechanics) {
    current.set(source.id, sourceMechanics.updatedActor)
    if (
      root.sourceCharacterStreamVersion !== sourceMechanics.characterStreamVersion ||
      checksumCanonicalJson(sourceMechanics.itemUseStateTransition ?? null) !==
        checksumCanonicalJson(root.sourceItemUseStateTransition)
    )
      throw new Error('Live Session source Character receipt mismatch.')
  } else if (!(mergedSpend && spends) && root.sourceCharacterStreamVersion !== null)
    throw new Error('Live Session source Character receipt mismatch.')

  const healEndedGrants: ActiveRuleEffectRecord[] = []
  for (const [index, { actor, batch, occurrenceId }] of children.entries()) {
    const merged = index === mergedChildIndex
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
      ...(merged ? sourceMutation : {})
    })
    if (
      checksumCanonicalJson(mechanics.receiptApplications) !==
        checksumCanonicalJson(batch.applications) ||
      checksumCanonicalJson(mechanics.targetTransition) !==
        checksumCanonicalJson(batch.targetTransition) ||
      (batch.kind === 'CHARACTER_MECHANICS_BATCH' &&
        batch.targetCharacterStreamVersion !== mechanics.characterStreamVersion) ||
      (merged &&
        spends &&
        (root.sourceCharacterStreamVersion !== mechanics.characterStreamVersion ||
          checksumCanonicalJson(mechanics.itemUseStateTransition ?? null) !==
            checksumCanonicalJson(root.sourceItemUseStateTransition)))
    )
      throw new Error('Live Session mechanics receipt mismatch.')
    current.set(actor.id, mechanics.updatedActor)
    healEndedGrants.push(...mechanics.endedGrants)
    // A Legendary Resistance the creature used spends one of its own charges.
    const charge =
      batch.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
        ? batch.targetFeatureResourceConsumption
        : null
    if (charge) {
      if (charge.ownerActorId !== actor.id)
        throw new Error('Live Session area charge scope mismatch.')
      current.set(
        actor.id,
        await settleActionSourceSpend(ctx, {
          encounterId: state.id,
          source: mechanics.updatedActor,
          spend: {
            featureResourceConsumption: charge,
            actionEconomyTransition: null,
            attackActionTransition: undefined
          },
          economyOverridden: false
        })
      )
    }
  }
  current.set(
    source.id,
    await settleActionSourceSpend(ctx, {
      encounterId: state.id,
      source: live(source.id),
      spend: root,
      economyOverridden: overridesActionEconomy(input.ruleOverrides)
    })
  )
  const nextActors: EncounterRunActorState[] = actors.map((actor) => live(actor.id))
  const nextState = encounterRunStateSchema.parse({
    ...state,
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
  if (input.placedZone && scope.zoneSceneId !== null)
    await createPlacedSpatialEffect(ctx, {
      encounterId: state.id,
      sceneId: scope.zoneSceneId,
      zone: input.placedZone
    })
  for (const { execution, actor, occurrenceId } of children)
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
    remaining: await callbacks.bindConcentrationApplications(nextState, damage),
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
  const projection = await projectNativeGm(ctx, nextState, settledChildren.actors, input.rules)
  // Each creature's save is its own card; the area's one damage roll is carded once, with the first,
  // unless every entry rolled its own.
  const actionLabel = (await ctx.ports.readContentLabel(input.initialDefinitionId)) ?? 'Action'
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
      actionLabel,
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
      addedConcentrationCasterId: null,
      speedBonusTurn: null,
      turnUses: null,
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
      gmLines: scope.removedActorIds.map((actorId) => {
        const removed = actors.find((actor) => actor.id === actorId)
        if (!removed) throw new Error('Live Session area removed an unknown creature.')
        return `GM removed ${removed.label} from the area`
      })
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
