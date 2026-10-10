import {
  encounterCommandResultDtoSchema,
  revertLastEncounterActionInputDtoSchema,
  type EncounterCommandResultDto,
  type RevertLastEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { z } from 'zod'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type { ServerRuleExecutionApplicationOutputsDto } from '@artificer-toolkit/schema/shared/ruleExecutionApplicationOutputs'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import {
  featureChargeUsed,
  encounterRuleUsageUsed,
  withEncounterRuleUsageUsed,
  withFeatureChargeUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import { readEncounterActorConditionState } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { nextEncounterActorDefeated } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { revertEncounterAttackActionTransition } from '@artificer-toolkit/rules-runtime/encounterAttackAction'
import { characterZeroHitPointsConditionId } from '@artificer-toolkit/rules-runtime/characterZeroHitPoints'
import {
  encounterBasicActionEffects,
  withEncounterBasicActionEffects
} from '@artificer-toolkit/rules-runtime/encounterBasicActions'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { restoreConsumedGrants } from './consumedGrantPersistence.js'
import { rejectDomain } from './domainRejections.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import { readRunActors, readRunState, replaceRunActor } from './documents.js'
import { removeTurnSpeedBonus } from './turnMovement.js'
import { projectNativeGm } from './nativeProjection.js'
import { encounterReplayReceipt, replayEncounterCommandResult } from './replayReceipts.js'
import { insertRunCommand, presentTimelineEntry } from './timelineEntries.js'
import type { EncounterDocument } from './store.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'

type ActionBatch = Extract<
  ServerRuleExecutionApplicationOutputsDto,
  { kind: 'CHARACTER_MECHANICS_BATCH' | 'ENCOUNTER_ACTOR_MECHANICS_BATCH' }
>
type AreaRoot = Extract<ServerRuleExecutionApplicationOutputsDto, { kind: 'ENCOUNTER_AREA_ACTION' }>
type CleavingDamage = Extract<ServerRuleExecutionApplicationOutputsDto, { kind: 'CLEAVING_DAMAGE' }>
type CharacterInverse = {
  hitPoints: ActionBatch['targetTransition']['before'] | null
  removedConditionIds: Set<string>
  resource: ActionBatch['resourceConsumption']
  stow: ActionBatch['sourceItemUseStateTransition']
  item: ActionBatch['sourceItemConsumption']
  expectedStreamVersion: number
}

// Commands between the action and now; a longer tail cannot be only that action's children.
const REVERT_SCAN_LIMIT = 16
const RECEIPT_SCAN_LIMIT = REVERT_SCAN_LIMIT * 4

function unavailable(message: string): never {
  return rejectDomain('REVERT_UNAVAILABLE', message)
}

/**
 * GM-only exact undo of the Run's last committed RESOLVE_ACTION and its committed children, or of
 * its last basic action (ADR 0034 decision 2, D45). Every change is inverted from the before-states
 * in its receipts; a later Encounter command, a later write to an affected Character, or a transition without a recorded
 * before-state refuses the undo instead of approximating it. Undoing an undo is not supported.
 */
export async function revertLastEncounterAction(
  ctx: EncounterCharacterWriteTransaction,
  command: RevertLastEncounterActionInputDto,
  userId: string
): Promise<EncounterCommandResultDto> {
  const parsed = revertLastEncounterActionInputDtoSchema.parse(command)
  const input = {
    ...parsed,
    encounterId: parsed.encounterId.toLowerCase(),
    commandId: parsed.commandId.toLowerCase()
  }
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter is unavailable.')
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(run.campaignId, userId)
  if (membership.role !== 'OWNER') rejectDomain('GM_ONLY')
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  const fingerprint = checksumCanonicalJson(input)
  const prior = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', input.commandId)
    )
    .unique()
  if (prior) {
    if (
      prior.commandType !== 'REVERT_LAST_ACTION' ||
      prior.encounterId !== run.id ||
      prior.commandFingerprint !== fingerprint
    )
      rejectDomain('COMMAND_ID_REUSED')
    presentTimelineEntry(prior)
    return replayEncounterCommandResult(ctx, readRunState(run), prior)
  }
  const state = readRunState(run)
  if (state.version !== input.expectedVersion) rejectDomain('VERSION_STALE')
  if (state.status !== 'ACTIVE')
    rejectDomain('ENCOUNTER_NOT_ACTIVE', 'Only an active Encounter can undo an action.')
  const pending = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', run.id).eq('state', 'PENDING'))
    .first()
  if (pending) rejectDomain('PENDING_DECISION', 'Resolve the pending decision before undoing.')

  // The action must be the Run's latest change, followed only by its own child decisions.
  const recent = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_encounterId_version', (q) => q.eq('encounterId', run.id))
    .order('desc')
    .take(REVERT_SCAN_LIMIT)
  if (recent[0]?.version !== state.version)
    unavailable('The Encounter changed after its last command; adjust manually.')
  const rootIndex = recent.findIndex((entry) => entry.commandType !== 'RESOLVE_RULE_OCCURRENCE')
  const root = recent[rootIndex]
  if (root?.commandType === 'REVERT_LAST_ACTION') unavailable('The last action was already undone.')
  if (root?.commandType === 'USE_BASIC_ACTION') {
    // A check the helper's roll settled is the one command after its action.
    const answer = recent[0]
    if (
      rootIndex > 1 ||
      (rootIndex === 1 &&
        (answer?.commandType !== 'RESOLVE_RULE_OCCURRENCE' ||
          answer.ruleOccurrenceId !== root.receipt.checkOccurrenceId))
    )
      throw new Error('Stored Encounter command scan is invalid.')
    return revertBasicAction(ctx, { run, state, campaign, input, fingerprint, userId, root })
  }
  if (!root || root.commandType !== 'RESOLVE_ACTION')
    unavailable(
      root
        ? 'Only an action can be undone, and something else happened after it.'
        : 'There is no action to undo.'
    )
  const laterOccurrenceIds = new Set(
    recent.slice(0, rootIndex).map((entry) => {
      if (entry.commandType !== 'RESOLVE_RULE_OCCURRENCE')
        throw new Error('Stored Encounter command scan is invalid.')
      return entry.ruleOccurrenceId
    })
  )

  // Every receipt committed since the action belongs to it: the root, its evidence and children.
  const receipts = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_encounterId_encounterVersion', (q) =>
      q.eq('encounterId', run.id).gte('encounterVersion', root.version)
    )
    .take(RECEIPT_SCAN_LIMIT)
  if (receipts.length === RECEIPT_SCAN_LIMIT)
    unavailable('This action has too many follow-up results to undo; adjust manually.')
  let batch: ActionBatch | null = null
  let areaRoot: AreaRoot | null = null
  const areaTargetBatches = new Map<string, ActionBatch>()
  const cleaving: CleavingDamage[] = []
  const unsupported = new Set<string>()
  const childOccurrenceIds = new Set<string>()
  for (const receipt of receipts) {
    const result = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    if (checksumRuleDocument(result) !== receipt.resultChecksum)
      throw new Error('Stored Encounter rule receipt mismatch.')
    const outputs = 'applicationOutputs' in result ? result.applicationOutputs : null
    if (receipt.occurrenceId === root.ruleOccurrenceId) {
      if (receipt.commandId !== root.commandId || receipt.commandType !== 'RESOLVE_ACTION') continue
      if (
        outputs?.kind === 'CHARACTER_MECHANICS_BATCH' ||
        outputs?.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
      )
        batch = outputs
      else if (outputs?.kind === 'ENCOUNTER_AREA_ACTION') areaRoot = outputs
      else unsupported.add(outputs?.kind === 'CONTESTED_ACTION' ? 'a Disarm' : 'this action')
      continue
    }
    if (
      (outputs?.kind === 'CHARACTER_MECHANICS_BATCH' ||
        outputs?.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH') &&
      outputs.parentOccurrenceId === root.ruleOccurrenceId
    ) {
      // One caught creature's outcome of an area action.
      childOccurrenceIds.add(receipt.occurrenceId)
      areaTargetBatches.set(receipt.occurrenceId, outputs)
      continue
    }
    if (
      (outputs?.kind !== 'CONCENTRATION_CHECK' &&
        outputs?.kind !== 'CONCENTRATION_END' &&
        outputs?.kind !== 'CLEAVING_DAMAGE') ||
      outputs.parentOccurrenceId !== root.ruleOccurrenceId
    ) {
      unsupported.add('a later rule result')
      continue
    }
    childOccurrenceIds.add(receipt.occurrenceId)
    if (outputs.kind === 'CONCENTRATION_END') {
      // The holder couldn't act, so its maintained effect ended without a check (D95).
      unsupported.add('lost Concentration')
    } else if (outputs.kind === 'CONCENTRATION_CHECK') {
      // A failed save ended a maintained effect whose contents the receipt does not keep.
      if (outputs.outcome === 'SAVE_FAILURE') unsupported.add('lost Concentration')
    } else if (outputs.outcome === 'APPLIED') cleaving.push(outputs)
  }
  if ([...laterOccurrenceIds].some((occurrenceId) => !childOccurrenceIds.has(occurrenceId)))
    unavailable('Another decision changed the Encounter after this action; adjust manually.')
  if (!batch && !areaRoot && !unsupported.size)
    throw new Error('Stored Encounter action receipt is missing.')
  // An area's creatures undo in reverse of the order they were applied; the root's sealed ids say which.
  const targetBatches = areaRoot
    ? areaRoot.targetOccurrenceIds.map((occurrenceId) => {
        const targetBatch = areaTargetBatches.get(occurrenceId)
        if (!targetBatch) throw new Error('Stored Encounter area target receipt is missing.')
        return targetBatch
      })
    : batch
      ? [batch]
      : []
  if (areaRoot && areaTargetBatches.size !== targetBatches.length)
    throw new Error('Stored Encounter area target receipt is invalid.')
  for (const action of targetBatches) {
    if (
      action.applications.some(
        (application) => application.kind === 'CONDITION_REMOVE' && application.applied
      )
    )
      unsupported.add('a removed condition')
    const maintenance = action.maintenanceTransition ?? null
    if (
      maintenance &&
      (maintenance.priorState ||
        maintenance.removedDependentEffects.length ||
        maintenance.endedCarriedGrants.length)
    )
      unsupported.add('a replaced maintained effect')
    if (action.spellCastConsumption) unsupported.add('a spell slot')
  }
  const spend =
    areaRoot ??
    (batch && {
      sourceActorId: batch.sourceActorId,
      resourceConsumption: batch.resourceConsumption,
      sourceItemUseStateTransition: batch.sourceItemUseStateTransition,
      sourceItemConsumption: batch.sourceItemConsumption,
      featureResourceConsumption: batch.featureResourceConsumption,
      actionEconomyTransition: batch.actionEconomyTransition,
      attackActionTransition: batch.attackActionTransition,
      sourceCharacterStreamVersion:
        batch.kind === 'CHARACTER_MECHANICS_BATCH' && batch.sourceActorId === batch.targetActorId
          ? batch.targetCharacterStreamVersion
          : batch.sourceCharacterStreamVersion
    })
  if (unsupported.size || !spend)
    unavailable(`Undo can't restore ${[...unsupported].join(', ')}; adjust manually.`)

  const actors = await readRunActors(ctx, state)
  const actorsById = new Map(actors.map((actor) => [actor.id, actor]))
  const source = actorsById.get(spend.sourceActorId)
  if (!source) throw new Error('Stored Encounter action actors are unavailable.')
  // Each inverse reads the actor as earlier inverses left it; the schema validates every change.
  const updateActor = (actorId: string, change: Record<string, unknown>) => {
    const next = encounterRunActorStateSchema.parse({ ...actorsById.get(actorId), ...change })
    actorsById.set(actorId, next)
  }
  const restoreHitPoints = (actorId: string, transition: ActionBatch['targetTransition']) => {
    const actor = actorsById.get(actorId)!
    if (actor.kind === 'CHARACTER') throw new Error('Character hit points are not Run state.')
    if (
      actor.currentHitPoints !== transition.after.currentHitPoints ||
      actor.tempHitPoints !== transition.after.temporaryHitPoints ||
      actor.maxHitPoints !== transition.after.maximumHitPoints
    )
      unavailable(`${actor.label}'s hit points changed after this action; adjust manually.`)
    updateActor(actorId, {
      currentHitPoints: transition.before.currentHitPoints,
      tempHitPoints: transition.before.temporaryHitPoints,
      maxHitPoints: transition.before.maximumHitPoints,
      defeated: nextEncounterActorDefeated(actor, transition.before.currentHitPoints)
    })
  }

  // Cleaving children are undone first, in reverse order of application.
  for (const damage of cleaving.toReversed()) {
    const cleaved = damage.targetActorId ? actorsById.get(damage.targetActorId) : undefined
    if (!cleaved || !damage.targetTransition) throw new Error('Stored Cleaving receipt is invalid.')
    if (cleaved.kind === 'CHARACTER')
      unavailable("Undo can't restore Cleaving damage to a Character.")
    restoreHitPoints(cleaved.id, damage.targetTransition)
  }

  // Characters: only when their Sheet is exactly the version this action (and its maintenance) left.
  const characterInverses = new Map<string, CharacterInverse>()
  const characterInverse = (characterId: string, streamVersion: number) => {
    const current = characterInverses.get(characterId)
    const next: CharacterInverse = current
      ? {
          ...current,
          expectedStreamVersion: Math.max(current.expectedStreamVersion, streamVersion)
        }
      : {
          hitPoints: null,
          removedConditionIds: new Set(),
          resource: null,
          stow: null,
          item: null,
          expectedStreamVersion: streamVersion
        }
    characterInverses.set(characterId, next)
    return next
  }
  const store = createActiveRuleEffectStore(ctx)

  /** One creature's outcome: its hit points, conditions, charges, effects and maintenance. */
  const invertTarget = async (action: ActionBatch) => {
    const target = actorsById.get(action.targetActorId)
    if (!target) throw new Error('Stored Encounter action actors are unavailable.')
    const addedConditionIds = new Set(
      action.applications.flatMap((application) =>
        application.kind === 'CONDITION_APPLY' && application.applied
          ? [application.conditionId]
          : []
      )
    )
    if (action.kind === 'CHARACTER_MECHANICS_BATCH') {
      if (target.kind !== 'CHARACTER' || target.sourceId === null)
        throw new Error('Stored Character action target is invalid.')
      // A reapplied condition may have moved from Campaign context into the Sheet; that is not recorded.
      if (
        action.applications.some(
          (application) => application.kind === 'CONDITION_APPLY' && !application.applied
        )
      )
        unavailable("Undo can't restore a reapplied condition; adjust manually.")
      // D63: dropping to 0 added the System's 0 hit point condition, and healing from 0 removed it.
      const { before, after } = action.targetTransition
      const zeroHitPointsConditionId = characterZeroHitPointsConditionId(state.gameSystemId)
      const droppedToZero = before.currentHitPoints > 0 && after.currentHitPoints === 0
      if (
        zeroHitPointsConditionId !== undefined &&
        before.currentHitPoints === 0 &&
        after.currentHitPoints > 0 &&
        before.conditionIds.includes(zeroHitPointsConditionId)
      )
        unavailable("Undo can't restore a removed condition; adjust manually.")
      if (action.targetCharacterStreamVersion !== null) {
        const inverse = characterInverse(target.sourceId, action.targetCharacterStreamVersion)
        inverse.hitPoints = before
        inverse.removedConditionIds = new Set([
          ...addedConditionIds,
          ...(zeroHitPointsConditionId !== undefined &&
          droppedToZero &&
          !before.conditionIds.includes(zeroHitPointsConditionId)
            ? [zeroHitPointsConditionId]
            : [])
        ])
      }
    } else {
      if (target.kind === 'CHARACTER') throw new Error('Stored Encounter actor target is invalid.')
      restoreHitPoints(target.id, action.targetTransition)
      const conditions = readEncounterActorConditionState(target.conditions ?? [])
      updateActor(target.id, {
        conditions: conditions.values.filter(
          (_, index) => !addedConditionIds.has(conditions.ids[index]!)
        )
      })
    }
    for (const owner of action.maintenanceTransition?.characterOwnerTransitions ?? [])
      characterInverse(owner.characterId, owner.afterStreamVersion)
    const targetFeature = action.targetFeatureResourceConsumption
    if (targetFeature) {
      const owner = actorsById.get(targetFeature.ownerActorId)
      if (
        !owner ||
        featureChargeUsed(owner, targetFeature.ownerFeatureId) !== targetFeature.afterUsed
      )
        unavailable("The target's feature charges changed after this action; adjust manually.")
      updateActor(owner.id, {
        resources: withFeatureChargeUsed(
          owner,
          targetFeature.ownerFeatureId,
          targetFeature.beforeUsed
        )
      })
    }
    // Created effects and the maintained state go away; their versions prove nothing touched them.
    const characterOwnerId = target.kind === 'CHARACTER' ? target.sourceId : null
    for (const effect of action.activeEffectTransitions)
      await store.deleteCas({
        id: effect.activeEffectId,
        owner: characterOwnerId
          ? { kind: 'CHARACTER', characterId: characterOwnerId }
          : { kind: 'ENCOUNTER_ACTOR', encounterId: state.id, targetActorId: target.id },
        expectedVersion: effect.afterVersion
      })
    for (const effect of action.stateEffectTransitions)
      await store.deleteCas({
        id: effect.activeEffectId,
        owner: effect.owner,
        expectedVersion: effect.afterVersion
      })
    const created = action.maintenanceTransition?.createdState
    if (created)
      await store.deleteMaintainedStateCas({
        id: created.id,
        encounterId: state.id,
        ownerActorId: created.sourceActorId,
        expectedVersion: created.version
      })
  }
  for (const action of targetBatches.toReversed()) await invertTarget(action)

  // The source's one spend: its Character resource, item or stow, feature charge and allowances.
  const sourceCharacterId =
    source.kind === 'CHARACTER' && source.sourceId !== null ? source.sourceId : null
  if (
    (spend.resourceConsumption ||
      spend.sourceItemUseStateTransition ||
      spend.sourceItemConsumption) &&
    sourceCharacterId
  ) {
    if (spend.sourceCharacterStreamVersion === null)
      throw new Error('Stored source Character version is missing.')
    const inverse = characterInverse(sourceCharacterId, spend.sourceCharacterStreamVersion)
    inverse.resource = spend.resourceConsumption
    inverse.stow = spend.sourceItemUseStateTransition
    inverse.item = spend.sourceItemConsumption
  }
  const feature = spend.featureResourceConsumption
  if (feature) {
    const owner = actorsById.get(feature.ownerActorId)
    if (!owner || featureChargeUsed(owner, feature.ownerFeatureId) !== feature.afterUsed)
      unavailable("The actor's feature charges changed after this action; adjust manually.")
    updateActor(owner.id, {
      resources: withFeatureChargeUsed(owner, feature.ownerFeatureId, feature.beforeUsed)
    })
  }
  const economy = spend.actionEconomyTransition
  if (economy) {
    const owner = actorsById.get(source.id)!
    if (encounterRuleUsageUsed(owner, economy.definitionId) !== economy.afterUsed)
      unavailable("The actor's action economy changed after this action; adjust manually.")
    updateActor(owner.id, {
      resources: withEncounterRuleUsageUsed(owner, economy.definitionId, economy.beforeUsed)
    })
  }
  const attackAction = spend.attackActionTransition
  if (attackAction) {
    const restored = revertEncounterAttackActionTransition(actorsById.get(source.id)!, attackAction)
    if (!restored)
      unavailable("The actor's Attack action changed after this action; adjust manually.")
    updateActor(source.id, { resources: restored.resources })
  }

  // Ally advantages (Help) the action's rolls used go back to their helpers.
  for (const help of root.allyAdvantageUses) {
    const helper = actorsById.get(help.helperActorId)
    if (!helper) unavailable('The helper left the Encounter; adjust manually.')
    updateActor(helper.id, {
      resources: withEncounterBasicActionEffects(helper, [
        ...encounterBasicActionEffects(helper),
        help.effect
      ]).resources
    })
  }

  // D99: only the command that added the Character to the Run's Concentration casters removes it.
  if (root.addedConcentrationCasterId)
    await ctx.db.patch(run._id, {
      concentrationCasterCharacterIds: run.concentrationCasterCharacterIds.filter(
        (id) => id !== root.addedConcentrationCasterId
      )
    })
  // The attacker's grants the roll used up come back with their remaining count.
  await restoreConsumedGrants(ctx, {
    actor: source,
    encounterId: state.id,
    grants: root.consumedGrants
  })

  const updatedAt = new Date().toISOString()
  for (const [characterId, inverse] of characterInverses)
    await restoreCharacter(ctx, {
      characterId,
      inverse,
      userId,
      updatedAt,
      gameSystemId: state.gameSystemId
    })

  return commitRevert(ctx, {
    run,
    state,
    campaign,
    input,
    fingerprint,
    userId,
    root,
    actors,
    nextActors: actors.map((actor) => actorsById.get(actor.id)!),
    updatedAt
  })
}

type StoredCommand = z.infer<typeof encounterStoredRunCommandSchema>
type RevertScope = {
  run: EncounterDocument<'encounterRuns'>
  state: EncounterRunState
  campaign: EncounterDocument<'campaigns'>
  input: RevertLastEncounterActionInputDto
  fingerprint: string
  userId: string
  root: Extract<StoredCommand, { commandType: 'RESOLVE_ACTION' | 'USE_BASIC_ACTION' }>
}

/** Writes the restored actors, the next Run version and the undo's own timeline entry. */
async function commitRevert(
  ctx: EncounterCharacterWriteTransaction,
  input: RevertScope & {
    actors: readonly EncounterRunActorState[]
    nextActors: EncounterRunActorState[]
    updatedAt: string
  }
): Promise<EncounterCommandResultDto> {
  const { run, state, campaign, root, updatedAt, nextActors } = input
  for (const [index, actor] of input.actors.entries()) {
    const next = nextActors[index]!
    if (next === actor) continue
    await replaceRunActor(ctx, actor, next)
  }
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt
  })
  const facts = buildEncounterActorRuleFacts({ actors: nextActors })
  const rules = reconcileEncounterActorRuleOutput(
    evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
    facts
  )
  const projection = await projectNativeGm(ctx, nextState, nextActors, rules)
  const result = encounterCommandResultDtoSchema.parse({
    projection,
    roll: null,
    occurrence: null
  })
  await ctx.db.patch(run._id, {
    version: nextState.version,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState),
    updatedAt
  })
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      commandId: input.input.commandId,
      commandType: 'REVERT_LAST_ACTION',
      revertedCommandId: root.commandId,
      ruleOccurrenceId: root.commandType === 'RESOLVE_ACTION' ? root.ruleOccurrenceId : null,
      commandFingerprint: input.fingerprint,
      actorUserId: input.userId,
      version: nextState.version,
      commandJson: JSON.stringify(input.input),
      ...encounterReplayReceipt(result),
      createdAt: updatedAt
    })
  )
  return result
}

/**
 * Undoes the Run's last basic action (Q11) exactly from its receipt: the effects it added (still
 * the actor's latest), its allowance use and its turn's speed bonus.
 */
async function revertBasicAction(
  ctx: EncounterCharacterWriteTransaction,
  input: RevertScope & { root: Extract<StoredCommand, { commandType: 'USE_BASIC_ACTION' }> }
): Promise<EncounterCommandResultDto> {
  const { state, root } = input
  const { receipt } = root
  const actors = await readRunActors(ctx, state)
  const actor = actors.find((entry) => entry.id === receipt.actorId)
  if (!actor) unavailable('The actor left the Encounter; adjust manually.')
  const effects = encounterBasicActionEffects(actor)
  const kept = effects.slice(0, effects.length - receipt.effects.length)
  if (checksumCanonicalJson(effects.slice(kept.length)) !== checksumCanonicalJson(receipt.effects))
    unavailable(`${actor.label}'s basic-action effects changed; adjust manually.`)
  let restored = withEncounterBasicActionEffects(actor, kept)
  const economy = receipt.actionEconomy
  if (economy) {
    if (encounterRuleUsageUsed(restored, economy.definitionId) !== economy.afterUsed)
      unavailable("The actor's action economy changed after this action; adjust manually.")
    restored = encounterRunActorStateSchema.parse({
      ...restored,
      resources: withEncounterRuleUsageUsed(restored, economy.definitionId, economy.beforeUsed)
    })
  }
  if (receipt.speedBonusTurn)
    await removeTurnSpeedBonus(ctx, {
      encounterId: state.id,
      ...receipt.speedBonusTurn,
      actorId: actor.id
    })
  // The Help the check used goes back to its helpers.
  const restoredActors = new Map(actors.map((entry) => [entry.id, entry]))
  restoredActors.set(actor.id, restored)
  for (const help of receipt.allyAdvantageUses) {
    const helper = restoredActors.get(help.helperActorId)
    if (!helper) unavailable('The helper left the Encounter; adjust manually.')
    restoredActors.set(
      helper.id,
      encounterRunActorStateSchema.parse({
        ...helper,
        resources: withEncounterBasicActionEffects(helper, [
          ...encounterBasicActionEffects(helper),
          help.effect
        ]).resources
      })
    )
  }
  const updatedAt = new Date().toISOString()
  const stabilized = receipt.checkOccurrenceId
    ? await readBasicActionCheckStabilize(ctx, {
        state,
        root,
        occurrenceId: receipt.checkOccurrenceId
      })
    : null
  // The roll stays on the record; only the dying target's death saves come back.
  if (stabilized)
    await restoreCharacter(ctx, {
      characterId: stabilized.targetCharacterId,
      inverse: {
        hitPoints: stabilized.targetTransition.before,
        removedConditionIds: new Set(),
        resource: null,
        stow: null,
        item: null,
        expectedStreamVersion: stabilized.targetTransition.afterStreamVersion
      },
      userId: input.userId,
      updatedAt,
      gameSystemId: state.gameSystemId
    })
  return commitRevert(ctx, {
    ...input,
    actors,
    nextActors: actors.map((entry) => restoredActors.get(entry.id)!),
    updatedAt
  })
}

/** The stabilize a settled basic action check applied, if its roll reached the DC. */
async function readBasicActionCheckStabilize(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: EncounterRunState
    root: Extract<StoredCommand, { commandType: 'USE_BASIC_ACTION' }>
    occurrenceId: string
  }
) {
  const receipts = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_encounterId_encounterVersion', (q) =>
      q.eq('encounterId', input.state.id).gte('encounterVersion', input.root.version)
    )
    .take(RECEIPT_SCAN_LIMIT)
  const receipt = receipts.find((entry) => entry.occurrenceId === input.occurrenceId)
  if (!receipt) throw new Error('Stored basic action check receipt is missing.')
  const result = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
  if (checksumRuleDocument(result) !== receipt.resultChecksum)
    throw new Error('Stored Encounter rule receipt mismatch.')
  if (result.status !== 'COMPLETE' || result.applicationOutputs.kind !== 'BASIC_ACTION_CHECK')
    throw new Error('Stored basic action check receipt is invalid.')
  const { targetTransition, targetCharacterId } = result.applicationOutputs
  return targetTransition ? { targetCharacterId, targetTransition } : null
}
async function restoreCharacter(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    characterId: string
    inverse: CharacterInverse
    userId: string
    updatedAt: string
    gameSystemId: string
  }
) {
  const { inverse } = input
  const row = await ctx.ports.readCharacterRow(input.characterId)
  if (!row || row.status !== 'ACTIVE' || row.systemId !== input.gameSystemId)
    throw new Error('Encounter Character is unavailable.')
  if (row.play.streamVersion !== inverse.expectedStreamVersion)
    unavailable(`${row.label}'s Sheet changed after this action; adjust manually.`)
  const character = ctx.ports.readCharacterRecord(row)
  let state = character.state
  // The fenced stream version proves the Sheet is exactly what this action left.
  if (inverse.hitPoints)
    state = {
      ...state,
      hitpoints: {
        ...state.hitpoints,
        current: inverse.hitPoints.currentHitPoints,
        temp: inverse.hitPoints.temporaryHitPoints,
        deathSaves: inverse.hitPoints.deathSaves ?? state.hitpoints.deathSaves
      },
      conditions: (state.conditions ?? []).filter(
        (condition) => !inverse.removedConditionIds.has(condition.conditionTypeId)
      )
    }
  if (inverse.stow) {
    const equipped = state.equipment.equipped
    const itemId = inverse.stow.itemInstanceId
    const restored = Array.from({ length: equipped.length + 1 }, (_, index) => ({
      ...state.equipment,
      equipped: [...equipped.slice(0, index), itemId, ...equipped.slice(index)]
    })).find((equipment) => checksumRuleDocument(equipment) === inverse.stow!.beforeStateChecksum)
    if (!restored)
      unavailable(`${row.label}'s equipment can't be restored exactly; adjust manually.`)
    state = { ...state, equipment: restored }
  }
  const sheetState = ctx.ports.readCharacterSheetState(row)
  const resource = inverse.resource
  const nextSheetState = resource
    ? {
        ...sheetState,
        resourceUsage: sheetState.resourceUsage.map((usage) => {
          if (createCharacterResourceOwnerKey(usage.owner) !== resource.poolId) return usage
          if (usage.used !== resource.afterUsed)
            unavailable(`${row.label}'s resources changed after this action; adjust manually.`)
          return {
            ...usage,
            used: resource.beforeUsed,
            updatedBy: input.userId,
            updatedAt: input.updatedAt
          }
        })
      }
    : null
  const item = inverse.item
  let restoredSheetState = nextSheetState
  if (item) {
    const base = restoredSheetState ?? sheetState
    // The item is given back by lowering its usage; the stored row never left the Sheet.
    if (
      base.itemUsage.find((usage) => usage.itemInstanceId === item.itemInstanceId)?.used !==
      item.afterUsed
    )
      unavailable(`${row.label}'s items changed after this action; adjust manually.`)
    restoredSheetState = {
      ...base,
      itemUsage: [
        ...base.itemUsage.filter((usage) => usage.itemInstanceId !== item.itemInstanceId),
        ...(item.beforeUsed > 0
          ? [{ itemInstanceId: item.itemInstanceId, used: item.beforeUsed }]
          : [])
      ]
    }
  }
  await ctx.ports.writeCharacterRecord({
    current: row,
    fields: { streamVersion: row.play.streamVersion + 1, updatedAt: input.updatedAt },
    document: JSON.parse(JSON.stringify({ ...character, state })),
    ...(restoredSheetState ? { sheetState: restoredSheetState } : {})
  })
}
