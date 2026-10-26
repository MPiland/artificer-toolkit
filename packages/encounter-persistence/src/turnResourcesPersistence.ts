import { decoyStrikeEffects } from '@artificer-toolkit/rules-runtime/encounterAttackDecoys'
import { checksumRunActorPlayState } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import { activeRuleEffectRecordSchema } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import { dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/encounterLifecycle'
import { ruleCapabilityReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/ruleState'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import {
  completedTurnRechargePlanDtoSchema,
  turnLegendaryActionEvidenceDtoSchema
} from '@artificer-toolkit/schema/shared/ruleExecutionTurnResources'
import { d20AddedDiceTotal } from '@artificer-toolkit/schema/shared/d20AddedDice'
import {
  featureChargeUsed,
  encounterRuleUsageUsed,
  requireSnapshotIdentity,
  snapshotFeatureDefinitions,
  withEncounterRuleUsageUsed,
  withFeatureChargeUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import { actionEconomyCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformPolicyModules'
import { applyStagedLegendaryActionRefreshes } from '@artificer-toolkit/rules-runtime/encounterLegendaryActionDiscovery'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import type { SpatialSceneToken } from '@artificer-toolkit/shared/vtt'

import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import {
  activeSavingThrowDice,
  effectiveHitPointMaximum
} from '@artificer-toolkit/rules-runtime/character/activeEffectGrantTotals'
import {
  actionEndedEffects,
  actsAgainstEnemy,
  effectsReplacedByGrants,
  endedEffectReleaseKey,
  savingThrowSpentEffects,
  targetEndedEffects
} from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { deleteGrants, spendEffectUses } from './consumedGrantPersistence.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import { readRunActor, writeRunActor } from './documents.js'
import {
  deathSaveRollRecord,
  rechargeRollRecord
} from '@artificer-toolkit/rules-runtime/encounterRuleCheckRolls'
import { readAppCardedDice, settledDie, turnSystemRollAnswers } from './appCardedDice.js'
import { recordActionRollCards, settledD20s } from './actionRollCards.js'
import type {
  CampaignAuthority,
  EncounterCharacterWriteTransaction,
  EncounterWritePorts
} from './ports.js'
import { persistEncounterActionEffects } from './actionEffectPersistence.js'
import {
  persistEncounterMeleeRetaliation,
  readMeleeRetaliationScene
} from './meleeRetaliationPersistence.js'
import { recordRuleRollCard } from './ruleRollCards.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'

/** Applies only the sealed resource outcomes after outgoing effects have committed. */
export async function persistEncounterTurnResources(
  ctx: EncounterCharacterWriteTransaction & {
    readonly ports: Pick<EncounterWritePorts, 'insertTableRoll' | 'retainPrivateRoll'>
  },
  input: {
    state: EncounterRunState
    campaign: CampaignAuthority['campaign']
    root: TurnCoordinatorRootDto
    occurrenceId: string
    occurredAt: string
    userId: string
  },
  callbacks: {
    readDefinition(id: string, userId: string): Promise<ReusableDefinitionCurrentDto | null>
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
    readSceneTokens(sceneId: string): Promise<readonly SpatialSceneToken[]>
  }
): Promise<void> {
  const { state, root, occurrenceId, occurredAt, userId } = input
  const actions = root.completedLegendaryActions ?? []
  const legendaryRefreshes = root.stagedLegendaryActionRefreshes ?? []
  const economyRefreshes = root.stagedActionEconomyRefreshes ?? []
  const recharge = root.completedRechargePlan
    ? completedTurnRechargePlanDtoSchema.parse(root.completedRechargePlan)
    : null
  if (
    (root.commandType === 'START' && actions.length > 0) ||
    root.expectedEncounterVersion !== state.version ||
    (state.automationMode === 'MANUAL' &&
      (actions.length > 0 ||
        legendaryRefreshes.length > 0 ||
        economyRefreshes.length > 0 ||
        recharge))
  )
    throw new Error('Live Session turn resource boundary is stale.')
  const enteringId = root.proposedTerminalTransition.currentActorId
  if (
    (!enteringId && (legendaryRefreshes.length || economyRefreshes.length || recharge)) ||
    (recharge && recharge.executions.some((entry) => entry.candidate.actorId !== enteringId))
  )
    throw new Error('Live Session incoming resource owner is stale.')

  async function currentDefinition(id: string) {
    const definition = await callbacks.readDefinition(id, userId)
    if (
      !definition ||
      definition.id !== id ||
      definition.gameSystemId !== state.gameSystemId ||
      checksumRuleDocument(definition.document) !== definition.checksum
    )
      throw new Error('Live Session turn resource definition is stale.')
    return definition
  }

  async function readActor(actorId: string) {
    const actor = await readRunActor(ctx, state, actorId)
    requireSnapshotIdentity(actor)
    if (actor.systemId !== state.gameSystemId || actor.encounterId !== state.id)
      throw new Error('Live Session turn resource actor is stale.')
    return actor
  }

  async function writeActor(before: EncounterRunActorState, after: EncounterRunActorState) {
    if (checksumCanonicalJson(before) === checksumCanonicalJson(after)) return
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', state.id).eq('id', before.id))
      .unique()
    if (
      !row ||
      row.stateChecksum !== checksumRunActorPlayState(before) ||
      after.id !== before.id ||
      after.encounterId !== before.encounterId ||
      after.systemId !== before.systemId ||
      after.kind !== before.kind ||
      after.sourceId !== before.sourceId ||
      (after.kind !== 'CHARACTER' &&
        before.kind !== 'CHARACTER' &&
        after.sourceRevision !== before.sourceRevision)
    )
      throw new Error('Live Session turn resource actor changed before settlement.')
    const next = encounterRunActorStateSchema.parse({ ...after, updatedAt: occurredAt })
    await writeRunActor(ctx, row._id, next)
  }

  // One answer pool for every window, because two windows can ask the same request.
  const legendaryAppCarded = await readAppCardedDice(ctx, {
    occurrenceId,
    answers: turnSystemRollAnswers(root.resolutionCommands, 'LEGENDARY_SYSTEM_ROLL'),
    dice: actions.flatMap((raw) => {
      const { resolution } = turnLegendaryActionEvidenceDtoSchema.parse(raw)
      return resolution.kind === 'EXECUTED' &&
        (resolution.application.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' ||
          resolution.application.kind === 'CHARACTER_MECHANICS_BATCH')
        ? settledD20s(resolution.application)
        : [null, null]
    })
  })
  const seenOwners = new Set<string>()
  for (const [ordinal, raw] of actions.entries()) {
    const evidence = turnLegendaryActionEvidenceDtoSchema.parse(raw)
    const ownerId = evidence.choice.ownerActorId
    if (seenOwners.has(ownerId) || ownerId === state.currentActorId)
      throw new Error('Live Session Legendary Action owner is stale.')
    seenOwners.add(ownerId)
    if (evidence.resolution.kind === 'DECLINED') continue
    const { selectedOptionId, targetActorId, application, attack, castsSpell, decoyEffectId } =
      evidence.resolution
    const option = evidence.choice.options.find((entry) => entry.optionId === selectedOptionId)
    const target = await readActor(targetActorId)
    if (
      !option ||
      !state.actorIds.includes(targetActorId) ||
      (application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH' &&
        application.kind !== 'CHARACTER_MECHANICS_BATCH') ||
      (target.kind === 'CHARACTER') !== (application.kind === 'CHARACTER_MECHANICS_BATCH') ||
      application.occurrenceId !== occurrenceId ||
      application.sourceActorId !== ownerId ||
      application.targetActorId !== targetActorId ||
      application.sourceCharacterStreamVersion !== null ||
      application.resourceConsumption !== null ||
      application.maintenanceTransition != null ||
      application.targetFeatureResourceConsumption !== null ||
      (application.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
        ? application.legendaryResistance !== null
        : application.spellCastConsumption !== null)
    )
      throw new Error('Live Session Legendary Action application is unavailable.')
    const createdEffects = evidence.resolution.createdEffects.map((effect) =>
      activeRuleEffectRecordSchema.parse(effect)
    )
    const owner = await readActor(ownerId)
    if (owner.kind !== 'CREATURE')
      throw new Error('Live Session Legendary Action owner is unavailable.')
    // An attack roll or spell cast uses up the owner's grants read now (no per-grant versions were
    // planned) and releases the conditions only they held, in the owner's own batch.
    const ownerEffects = await createActiveRuleEffectStore(ctx).list(
      turnEffectOwner(owner, state.id)
    )
    const dispositions = new Map([
      [ownerId, owner.disposition],
      [targetActorId, target.disposition]
    ])
    const { consumedGrants, sourceReleases } = actionEndedEffects({
      holderActorId: ownerId,
      held: ownerEffects,
      makesAttackRoll: attack !== null,
      castsSpell,
      againstEnemy: actsAgainstEnemy({
        actorId: ownerId,
        targetActorIds: [targetActorId],
        dispositions
      })
    })
    const ownerMechanics = sourceReleases.length
      ? await callbacks.applyMechanics({
          encounterId: state.id,
          targetActorId: ownerId,
          expectedEncounterVersion: state.version,
          occurrenceId,
          sourceCommandId: root.rootCommandId,
          commandId: deriveEncounterCharacterMechanicsEventCommandId({
            occurrenceId,
            sourceCommandId: root.rootCommandId,
            phase: 'LEGENDARY_ACTION_RESOURCE',
            ordinal,
            targetCharacterId: ownerId
          }),
          occurredAt,
          applications: sourceReleases,
          effectiveMaximumHitPoints: effectiveHitPointMaximum(owner.maxHitPoints, ownerEffects),
          forceVersionAdvance: false
        })
      : null
    if (
      checksumCanonicalJson(ownerMechanics?.receiptApplications ?? []) !==
      checksumCanonicalJson(application.sourceApplications)
    )
      throw new Error('Live Session Legendary Action source release is stale.')
    await deleteGrants(ctx, consumedGrants)
    // A hit on the target's decoy destroys it: the last ends the effect, any other spends a use.
    const decoy =
      decoyEffectId === undefined
        ? undefined
        : (await createActiveRuleEffectStore(ctx).list(turnEffectOwner(target, state.id))).find(
            ({ id }) => id === decoyEffectId
          )
    if (decoyEffectId !== undefined && !decoy)
      throw new Error('Live Session Legendary Action decoy is unavailable.')
    const decoyStrike = decoyStrikeEffects(
      decoy && { effect: decoy, remaining: decoy.lifecycle.remainingUses ?? 0 },
      application.d20?.resultPath
    )
    await spendEffectUses(ctx, decoyStrike.spentUseGrants)
    await deleteGrants(ctx, decoyStrike.endedGrants)
    // Damage the action dealt ends the target's effects that end on damage, with the conditions
    // only they held, which the planned target batch already released.
    const targetHeld = (
      await createActiveRuleEffectStore(ctx).list(turnEffectOwner(target, state.id))
    ).filter(({ id }) => !consumedGrants.some((ended) => ended.id === id))
    const damageEnded = targetEndedEffects({
      holderActorId: targetActorId,
      held: targetHeld,
      attack,
      testEvidence: [application.d20, application.nestedD20],
      turnActorId: state.currentActorId,
      applications: application.applications.map((planned) => ({
        ...planned,
        targetActorId
      })),
      damagerActorId: ownerId,
      dispositions
    })
    if (
      damageEnded.releases.some(
        (release) =>
          !application.applications.some(
            (planned) =>
              (planned.kind === 'CONDITION_REMOVE' ||
                planned.kind === 'TEMPORARY_HIT_POINTS_RELEASE') &&
              planned.sourceOperationKey === release.sourceOperationKey &&
              endedEffectReleaseKey(planned) === endedEffectReleaseKey(release)
          )
      )
    )
      throw new Error('Live Session Legendary Action damage release is stale.')
    // A timed grant the target's damage triggers made replaces the one it already held.
    const grantIds = new Set(
      application.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
        ? application.grantEffectTransitions.map(({ activeEffectId }) => activeEffectId)
        : []
    )
    const replaced = effectsReplacedByGrants(
      targetHeld,
      createdEffects.filter(({ id }) => grantIds.has(id)).map(({ definition }) => definition)
    )
    await deleteGrants(ctx, [
      ...damageEnded.endedEffects,
      ...replaced.filter(({ id }) => !damageEnded.endedEffects.some((ended) => ended.id === id))
    ])
    const feature = snapshotFeatureDefinitions(owner).find(
      (entry) => entry.id === option.ownerFeatureId
    )
    const charge = feature?.charges
    const resource = application.featureResourceConsumption
    if (
      !feature ||
      !charge ||
      charge.limitKind !== 'FIXED_AMOUNT' ||
      charge.scalingKind !== 'NONE' ||
      charge.id !== option.chargeId ||
      !resource ||
      resource.ownerActorId !== ownerId ||
      resource.ownerFeatureId !== feature.id ||
      resource.chargeId !== charge.id ||
      resource.beforeUsed !== featureChargeUsed(owner, feature.id) ||
      resource.afterUsed !== resource.beforeUsed + resource.cost ||
      resource.beforeRemaining !== charge.amount - resource.beforeUsed ||
      resource.afterRemaining !== charge.amount - resource.afterUsed ||
      resource.cost !== option.featureCost ||
      resource.afterUsed > charge.amount ||
      !feature.ruleDefinitionIds?.includes(option.lifecycle.definitionId)
    )
      throw new Error('Live Session Legendary Action resource is stale.')
    const lifecycle = await currentDefinition(option.lifecycle.definitionId)
    const lifecycleDocument = dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.safeParse(
      lifecycle.document
    )
    const graph = await currentDefinition(option.lifecycle.eligibilityGraphDefinitionId)
    if (
      lifecycle.version !== option.lifecycle.definitionVersion ||
      lifecycle.checksum !== option.lifecycle.definitionChecksum ||
      !lifecycleDocument.success ||
      lifecycleDocument.data.kind !== 'LEGENDARY_ACTION' ||
      lifecycleDocument.data.id !== lifecycle.id ||
      lifecycleDocument.data.gameSystemId !== state.gameSystemId ||
      lifecycleDocument.data.eligibilityGraph.definitionId !==
        option.lifecycle.eligibilityGraphDefinitionId ||
      lifecycleDocument.data.eligibilityGraph.definitionVersion !==
        option.lifecycle.eligibilityGraphDefinitionVersion ||
      lifecycleDocument.data.eligibilityGraph.definitionChecksum !==
        option.lifecycle.eligibilityGraphDefinitionChecksum ||
      lifecycleDocument.data.eligibilityGraph.eligibleOutput !== option.lifecycle.eligibleOutput ||
      graph.version !== option.lifecycle.eligibilityGraphDefinitionVersion ||
      graph.checksum !== option.lifecycle.eligibilityGraphDefinitionChecksum ||
      !ruleGraphDefinitionDtoSchema.safeParse(graph.document).success
    )
      throw new Error('Live Session Legendary Action lifecycle is stale.')
    // The action's outcome lands on its target, the same batch the room planned (D51 option B).
    const mechanics = await callbacks.applyMechanics({
      encounterId: state.id,
      targetActorId,
      expectedEncounterVersion: state.version,
      occurrenceId,
      sourceCommandId: root.rootCommandId,
      commandId:
        target.kind === 'CHARACTER'
          ? deriveEncounterCharacterMechanicsEventCommandId({
              occurrenceId,
              sourceCommandId: root.rootCommandId,
              phase: 'LEGENDARY_ACTION_OUTCOME',
              ordinal,
              targetCharacterId: target.sourceId
            })
          : root.rootCommandId,
      occurredAt,
      applications: application.applications.map((entry) => ({ ...entry, targetActorId })),
      effectiveMaximumHitPoints: application.targetTransition.before.maximumHitPoints,
      effectiveScalarValues: application.targetTransition.before.scalarValues,
      forceVersionAdvance: target.kind === 'CHARACTER' && createdEffects.length > 0
    })
    if (
      checksumCanonicalJson(mechanics.receiptApplications) !==
        checksumCanonicalJson(application.applications) ||
      checksumCanonicalJson(mechanics.targetTransition) !==
        checksumCanonicalJson(application.targetTransition) ||
      (application.kind === 'CHARACTER_MECHANICS_BATCH'
        ? mechanics.characterStreamVersion !== application.targetCharacterStreamVersion ||
          checksumCanonicalJson(evidence.resolution.characterTransitions) !==
            checksumCanonicalJson(
              target.kind === 'CHARACTER' && mechanics.characterStreamVersion !== null
                ? [
                    {
                      characterId: target.sourceId,
                      beforeStreamVersion: mechanics.characterStreamVersion - 1,
                      afterStreamVersion: mechanics.characterStreamVersion
                    }
                  ]
                : []
            )
        : mechanics.characterStreamVersion !== null ||
          evidence.resolution.characterTransitions.length !== 0)
    )
      throw new Error('Live Session Legendary Action mechanics receipt mismatch.')
    // Effects the action created (Shimmering Shield) persist exactly as the receipt projected them.
    const [effectTarget] = await persistEncounterActionEffects(ctx, {
      state,
      command: {
        encounterId: state.id,
        actorId: ownerId,
        target: { kind: 'ACTOR', actorId: targetActorId },
        actionId: option.actionId,
        commandId: root.rootCommandId
      },
      execution: { occurrenceId, applicationOutputs: application },
      maintainedState: null,
      createdEffects,
      authorizedCharacterIds: new Set(target.kind === 'CHARACTER' ? [target.sourceId] : []),
      maintenance: null,
      actors: [mechanics.updatedActor],
      occurredAt: createdEffects[0]?.createdAt ?? occurredAt
    })
    if (!effectTarget)
      throw new Error('Live Session Legendary Action effect target is unavailable.')
    const settled = targetActorId === ownerId ? effectTarget : await readActor(ownerId)
    if (featureChargeUsed(settled, feature.id) !== resource.beforeUsed)
      throw new Error('Live Session Legendary Action resource changed before settlement.')
    await writeActor(
      settled,
      encounterRunActorStateSchema.parse({
        ...settled,
        resources: withFeatureChargeUsed(settled, feature.id, resource.afterUsed)
      })
    )
    // The action's dice post exactly as a direct action's do, each Legendary Action in its own scope.
    await recordActionRollCards(ctx, {
      campaign: input.campaign,
      encounterId: state.id,
      gameSystemId: state.gameSystemId,
      rollScope: `${occurrenceId}:legendary:${ordinal}`,
      batch: application,
      actionLabel: option.label,
      source: ownerMechanics?.updatedActor ?? owner,
      target,
      initiatorUserId: root.initiatorUserId,
      visibility: undefined,
      createdAt: occurredAt,
      appCardedD20s: new Set(
        [0, 1].filter((checkIndex) => legendaryAppCarded.has(2 * ordinal + checkIndex))
      )
    })
    if (!application.meleeRetaliation) continue
    // The zones the melee hit set off burn the owner after its charge is spent (D153), selected
    // against the Run as the hit found it.
    const initialActors = await Promise.all(
      state.actorIds.map((actorId) => (actorId === targetActorId ? target : readActor(actorId)))
    )
    await persistEncounterMeleeRetaliation(
      ctx,
      {
        state,
        initialActors,
        attacker: await readActor(ownerId),
        scene: await readMeleeRetaliationScene(
          ctx,
          { state, attackerActorId: ownerId, hitActorId: targetActorId },
          callbacks.readSceneTokens
        ),
        evidence: application.meleeRetaliation,
        occurrenceId,
        sourceCommandId: root.rootCommandId,
        occurredAt
      },
      { applyMechanics: callbacks.applyMechanics }
    )
  }
  if (legendaryRefreshes.length) {
    if (
      !enteringId ||
      legendaryRefreshes.some(
        (entry, index) => entry.actorId !== enteringId || entry.ordinal !== index
      ) ||
      new Set(legendaryRefreshes.map((entry) => entry.ownerFeatureId)).size !==
        legendaryRefreshes.length
    )
      throw new Error('Live Session Legendary Action refresh owner is stale.')
    const actor = await readActor(enteringId)
    const refreshed = await applyStagedLegendaryActionRefreshes({
      encounter: { gameSystemId: state.gameSystemId, actors: [actor] },
      definitions: { requireCurrent: currentDefinition },
      refreshes: legendaryRefreshes
    })
    if (refreshed.length !== 1)
      throw new Error('Live Session Legendary Action refresh is unavailable.')
    await writeActor(actor, encounterRunActorStateSchema.parse(refreshed[0]))
  }

  if (economyRefreshes.length) {
    const expectedDefinitions = actionEconomyCapabilityRegistry
      .require(state.gameSystemId)
      .refreshCapabilityDefinitionIds()
    if (
      !enteringId ||
      economyRefreshes.some(
        (entry, index) =>
          entry.actorId !== enteringId ||
          entry.afterUsed !== 0 ||
          entry.ordinal !== index ||
          !expectedDefinitions.includes(entry.capabilityDefinitionId)
      ) ||
      new Set(economyRefreshes.map((entry) => entry.capabilityDefinitionId)).size !==
        economyRefreshes.length
    )
      throw new Error('Live Session action-economy refresh owner is stale.')
    let actor = await readActor(enteringId)
    for (const refresh of economyRefreshes) {
      const definition = await currentDefinition(refresh.capabilityDefinitionId)
      const capability = ruleCapabilityReusableDefinitionDocumentDtoSchema.safeParse(
        definition.document
      )
      if (
        definition.version !== refresh.definitionVersion ||
        definition.checksum !== refresh.definitionChecksum ||
        definition.definitionFamilyKey !== 'rule-capability' ||
        !capability.success ||
        capability.data.id !== definition.id ||
        capability.data.gameSystemId !== state.gameSystemId ||
        !capability.data.usage ||
        capability.data.usage.refreshBoundary !== 'START_OF_TURN' ||
        encounterRuleUsageUsed(actor, definition.id) !== refresh.beforeUsed
      )
        throw new Error('Live Session action-economy refresh is stale.')
      const next = encounterRunActorStateSchema.parse({
        ...actor,
        resources: withEncounterRuleUsageUsed(actor, definition.id, 0)
      })
      await writeActor(actor, next)
      actor = await readActor(enteringId)
    }
  }

  if (recharge) {
    if (!enteringId) throw new Error('Live Session Recharge owner is unavailable.')
    const candidates = recharge.executions.map(({ candidate }) => {
      const { ordinal: _ordinal, ...value } = candidate
      return value
    })
    if (recharge.selectionChecksum !== checksumCanonicalJson({ candidates }))
      throw new Error('Live Session Recharge selection is stale.')
    let actor = await readActor(enteringId)
    if (actor.kind !== 'CREATURE') throw new Error('Live Session Recharge owner is unavailable.')
    const appCarded = await readAppCardedDice(ctx, {
      occurrenceId,
      answers: turnSystemRollAnswers(root.resolutionCommands, 'SYSTEM_ROLL'),
      dice: recharge.executions.map((entry) => settledDie(entry.execution, entry.rawDie))
    })
    for (const execution of recharge.executions) {
      const candidate = execution.candidate
      const feature = snapshotFeatureDefinitions(actor).find(
        (entry) => entry.id === candidate.featureId
      )
      const charge = feature?.charges
      if (
        !feature ||
        !charge ||
        charge.limitKind !== 'FIXED_AMOUNT' ||
        charge.scalingKind !== 'NONE' ||
        charge.amount !== candidate.maximum ||
        checksumRuleDocument(feature) !== candidate.featureVersionChecksum ||
        !feature.ruleDefinitionIds?.includes(candidate.policy.definitionId) ||
        featureChargeUsed(actor, feature.id) !== candidate.beforeUsed ||
        execution.beforeUsed !== candidate.beforeUsed ||
        execution.afterUsed !== (execution.recharged ? 0 : candidate.beforeUsed)
      )
        throw new Error('Live Session Recharge resource is stale.')
      const lifecycle = await currentDefinition(candidate.policy.definitionId)
      const graph = await currentDefinition(candidate.policy.graphDefinitionId)
      const lifecycleDocument =
        dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.safeParse(lifecycle.document)
      if (
        lifecycle.version !== candidate.policy.definitionVersion ||
        lifecycle.checksum !== candidate.policy.definitionChecksum ||
        !lifecycleDocument.success ||
        lifecycleDocument.data.kind !== 'RECHARGE' ||
        lifecycleDocument.data.id !== lifecycle.id ||
        lifecycleDocument.data.gameSystemId !== state.gameSystemId ||
        lifecycleDocument.data.rechargeGraph.definitionId !== graph.id ||
        lifecycleDocument.data.rechargeGraph.definitionVersion !== graph.version ||
        lifecycleDocument.data.rechargeGraph.definitionChecksum !== graph.checksum ||
        lifecycleDocument.data.rechargeGraph.rechargedOutput !== candidate.policy.rechargedOutput ||
        graph.version !== candidate.policy.graphDefinitionVersion ||
        graph.checksum !== candidate.policy.graphDefinitionChecksum ||
        !ruleGraphDefinitionDtoSchema.safeParse(graph.document).success
      )
        throw new Error('Live Session Recharge policy is stale.')
      const next = encounterRunActorStateSchema.parse({
        ...actor,
        resources: withFeatureChargeUsed(actor, feature.id, execution.afterUsed)
      })
      await writeActor(actor, next)
      actor = await readActor(enteringId)
      // The d6 posts one card, unless the app's own attempt for it already did.
      if (appCarded.has(execution.ordinal)) continue
      const system = await ctx.ports.requireSystem(state.gameSystemId)
      const roll = rechargeRollRecord({
        occurrenceId: `${occurrenceId}:recharge:${execution.ordinal}`,
        rawDie: execution.rawDie,
        featureLabel: feature.label,
        rollerLabel: actor.label,
        ruleset: { systemId: system.id, code: system.rulesetCode, version: system.rulesetVersion },
        createdAt: occurredAt
      })
      await recordRuleRollCard(ctx, {
        campaign: input.campaign,
        encounterId: state.id,
        roller: actor,
        initiatorUserId: root.initiatorUserId,
        visibility: undefined,
        clientNonce: roll.id,
        roll
      })
    }
  }
}

/**
 * Applies the entering Character's sealed turn-start death save (D96) after the initiative advance
 * and before incoming effects, so those effects read the Character's bumped stream version.
 */
export async function persistEncounterTurnDeathSave(
  ctx: EncounterCharacterWriteTransaction & {
    readonly ports: Pick<EncounterWritePorts, 'insertTableRoll' | 'retainPrivateRoll'>
  },
  input: {
    state: EncounterRunState
    campaign: CampaignAuthority['campaign']
    root: TurnCoordinatorRootDto
    occurrenceId: string
    occurredAt: string
  },
  applyMechanics: (
    batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
  ) => Promise<EncounterMechanicsBatchResult>
): Promise<void> {
  const { state, root, occurrenceId, occurredAt } = input
  const plan = root.completedDeathSavePlan
  if (!plan) return
  const { candidate } = plan
  const enteringId = root.proposedTerminalTransition.currentActorId
  if (
    state.automationMode === 'MANUAL' ||
    root.expectedEncounterVersion !== state.version ||
    enteringId !== candidate.actorId
  )
    throw new Error('Live Session death save owner is stale.')
  const actor = await readRunActor(ctx, state, candidate.actorId)
  const row = await ctx.ports.readCharacterRow(candidate.characterId)
  if (
    actor.kind !== 'CHARACTER' ||
    actor.sourceId !== candidate.characterId ||
    !row ||
    row.status !== 'ACTIVE' ||
    row.systemId !== state.gameSystemId ||
    row.play.streamVersion !== candidate.streamVersion
  )
    throw new Error('Live Session death save Character is stale.')
  const applied = await applyMechanics({
    encounterId: state.id,
    targetActorId: actor.id,
    expectedEncounterVersion: state.version,
    occurrenceId,
    sourceCommandId: root.rootCommandId,
    commandId: deriveEncounterCharacterMechanicsEventCommandId({
      occurrenceId,
      sourceCommandId: root.rootCommandId,
      phase: 'TURN_DEATH_SAVE',
      ordinal: 0,
      targetCharacterId: candidate.characterId
    }),
    occurredAt,
    applications: [],
    deathSave: { rawDie: plan.rawDie, addedTotal: d20AddedDiceTotal(plan.addedDice) },
    effectiveMaximumHitPoints: candidate.effectiveMaximumHitPoints,
    forceVersionAdvance: true
  })
  // The save spent the dice (D156) every saving throw does: the ones its plan rolled.
  const held = await createActiveRuleEffectStore(ctx).list(turnEffectOwner(actor, state.id))
  if (
    checksumCanonicalJson(activeSavingThrowDice(held, null)) !==
    checksumCanonicalJson(candidate.addedDice)
  )
    throw new Error('Live Session death save dice differ from its plan.')
  await deleteGrants(ctx, savingThrowSpentEffects(held, null))
  const { before, after } = applied.targetTransition
  if (
    applied.receiptApplications.length !== 0 ||
    applied.characterStreamVersion !== candidate.streamVersion + 1 ||
    checksumCanonicalJson(before.deathSaves) !== checksumCanonicalJson(candidate.deathSaves) ||
    checksumCanonicalJson(after.deathSaves) !== checksumCanonicalJson(plan.afterDeathSaves) ||
    after.currentHitPoints !== (plan.regainsHitPoint ? 1 : 0)
  )
    throw new Error('Live Session death save settlement differs from its plan.')
  // Every save gets exactly one card, the Character's own roll. A save the app rolled already has
  // its "Rolled by the app" attempt card, so only an auto-rolled or entered die is carded here.
  const appCarded = await readAppCardedDice(ctx, {
    occurrenceId,
    answers: turnSystemRollAnswers(root.resolutionCommands, 'SYSTEM_ROLL'),
    dice: [settledDie(plan.execution, plan.rawDie)]
  })
  if (appCarded.has(0)) return
  const system = await ctx.ports.requireSystem(state.gameSystemId)
  const roll = deathSaveRollRecord({
    occurrenceId,
    rawDie: plan.rawDie,
    addedDice: plan.addedDice,
    rollerLabel: actor.label,
    ruleset: { systemId: system.id, code: system.rulesetCode, version: system.rulesetVersion },
    createdAt: occurredAt
  })
  await recordRuleRollCard(ctx, {
    campaign: input.campaign,
    encounterId: state.id,
    roller: actor,
    initiatorUserId: root.initiatorUserId,
    visibility: undefined,
    clientNonce: roll.id,
    roll
  })
}
