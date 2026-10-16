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
import type { ConcentrationEndReason } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import type { ServerRuleExecutionApplicationOutputsDto } from '@artificer-toolkit/schema/shared/ruleExecutionApplicationOutputs'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type { EncounterActionEconomyConsumption } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import {
  featureChargeUsed,
  encounterRuleUsageUsed,
  withEncounterActorEngaged,
  withEncounterRuleUsageUsed,
  withFeatureChargeUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import { readEncounterActorConditionState } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { concealmentLifecycleFor } from '@artificer-toolkit/rules-runtime/encounterConcealment'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { nextEncounterActorDefeated } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { revertEncounterAttackActionTransition } from '@artificer-toolkit/rules-runtime/encounterAttackAction'
import { characterZeroHitPointsConditionId } from '@artificer-toolkit/rules-runtime/characterZeroHitPoints'
import { updateSpellSlotUsage } from '@artificer-toolkit/rules-runtime/character/sheetCommandReducer'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import { EQUIPPED_SLOT_CODES } from '@artificer-toolkit/shared/core'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { restoreConsumedGrants } from './consumedGrantPersistence.js'
import { deletePlacedSpatialEffect } from './placedSpatialEffects.js'
import { rejectDomain } from './domainRejections.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import { readRunActors, readRunState, replaceRunActor } from './documents.js'
import { removeTurnSpeedBonus, restoreTurnUses } from './turnMovement.js'
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
  spell: ActionBatch['spellCastConsumption']
  expectedStreamVersion: number
}

// Commands between the action and now; a longer tail cannot be only that action's children.
const REVERT_SCAN_LIMIT = 16
const RECEIPT_SCAN_LIMIT = REVERT_SCAN_LIMIT * 4

/** Why undo can't bring back a Concentration an action ended, named for the GM. */
const CONCENTRATION_END_LIMIT: Record<ConcentrationEndReason, string> = {
  INCAPACITATED: 'lost Concentration to incapacitation',
  DEFEATED: 'lost Concentration to defeat',
  SPELLCASTING_LOCKED: 'lost Concentration to a spellcasting lock',
  CHOSEN: 'lost Concentration because its holder ended it'
}

function unavailable(message: string): never {
  return rejectDomain('REVERT_UNAVAILABLE', message)
}

/**
 * GM-only exact undo of the Run's last committed RESOLVE_ACTION and its committed children, or of
 * its last basic action or concealment-observer change (ADR 0034 decision 2, D45). Every change is inverted from the before-states
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
  const scope = { run, state, campaign, input, fingerprint, userId }
  // A check the helper's roll settled is the one command after its action.
  const requireCheckAnswerScan = (checkOccurrenceId: string | null) => {
    const answer = recent[0]
    if (
      rootIndex > 1 ||
      (rootIndex === 1 &&
        (answer?.commandType !== 'RESOLVE_RULE_OCCURRENCE' ||
          answer.ruleOccurrenceId !== checkOccurrenceId))
    )
      throw new Error('Stored Encounter command scan is invalid.')
  }
  if (root?.commandType === 'ESCAPE_RELATIONSHIP') {
    requireCheckAnswerScan(root.receipt.checkOccurrenceId)
    return revertEscape(ctx, { ...scope, root })
  }
  if (root?.commandType === 'SET_CONCEALMENT_OBSERVERS') {
    if (rootIndex !== 0) throw new Error('Stored Encounter command scan is invalid.')
    return revertConcealmentObservers(ctx, { ...scope, root })
  }
  if (root?.commandType !== 'RESOLVE_ACTION')
    unavailable(
      root
        ? 'Only an action can be undone, and something else happened after it.'
        : 'There is no action to undo.'
    )
  if (root.root.kind === 'CHECK') {
    requireCheckAnswerScan(root.root.checkReceipt.checkOccurrenceId)
    return revertCheckAction(ctx, { ...scope, root, checkReceipt: root.root.checkReceipt })
  }
  const { ruleOccurrenceId } = root.root
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
    if (receipt.occurrenceId === ruleOccurrenceId) {
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
      outputs.parentOccurrenceId === ruleOccurrenceId
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
      outputs.parentOccurrenceId !== ruleOccurrenceId
    ) {
      unsupported.add('a later rule result')
      continue
    }
    childOccurrenceIds.add(receipt.occurrenceId)
    if (outputs.kind === 'CONCENTRATION_END') {
      // The receipt keeps ids, not the ended maintained effect and its dependents, so it can't be restored (D95).
      unsupported.add(CONCENTRATION_END_LIMIT[outputs.reason])
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
  }
  const spend =
    areaRoot ??
    (batch && {
      sourceActorId: batch.sourceActorId,
      resourceConsumption: batch.resourceConsumption,
      sourceItemUseStateTransition: batch.sourceItemUseStateTransition,
      sourceItemConsumption: batch.sourceItemConsumption,
      spellCastConsumption: batch.spellCastConsumption,
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
          spell: null,
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
    // A reaction the target used spent its slot and allowance and created its effect with this outcome.
    const reaction = action.kind === 'CHARACTER_MECHANICS_BATCH' ? action.reaction : null
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
        inverse.spell = reaction?.spellCastConsumption ?? null
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
    const reactionEconomy = reaction?.actionEconomyTransition
    if (reactionEconomy) {
      const reactor = actorsById.get(target.id)!
      if (
        encounterRuleUsageUsed(reactor, reactionEconomy.definitionId) !== reactionEconomy.afterUsed
      )
        unavailable("The target's reactions changed after this action; adjust manually.")
      updateActor(reactor.id, {
        resources: withEncounterRuleUsageUsed(
          reactor,
          reactionEconomy.definitionId,
          reactionEconomy.beforeUsed
        )
      })
    }
    // Created effects and the maintained state go away; their versions prove nothing touched them.
    const characterOwnerId = target.kind === 'CHARACTER' ? target.sourceId : null
    for (const effect of [
      ...action.activeEffectTransitions,
      ...(reaction?.activeEffectTransitions ?? [])
    ])
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

  // The source's one spend: its Character resource, item or stow, spell slot, feature charge and allowances.
  const sourceCharacterId =
    source.kind === 'CHARACTER' && source.sourceId !== null ? source.sourceId : null
  if (
    (spend.resourceConsumption ||
      spend.sourceItemUseStateTransition ||
      spend.sourceItemConsumption ||
      spend.spellCastConsumption) &&
    sourceCharacterId
  ) {
    if (spend.sourceCharacterStreamVersion === null)
      throw new Error('Stored source Character version is missing.')
    const inverse = characterInverse(sourceCharacterId, spend.sourceCharacterStreamVersion)
    inverse.resource = spend.resourceConsumption
    inverse.stow = spend.sourceItemUseStateTransition
    inverse.item = spend.sourceItemConsumption
    inverse.spell = spend.spellCastConsumption
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
  // Only the marks this action set go: an actor engaged earlier in the turn stays engaged.
  for (const actorId of root.engagedActorIds) {
    const engaged = actorsById.get(actorId)
    if (engaged) updateActor(actorId, { resources: withEncounterActorEngaged(engaged, false) })
  }

  // A Dash's speed bonus leaves the turn's movement record.
  if (root.speedBonusTurn)
    await removeTurnSpeedBonus(ctx, {
      encounterId: state.id,
      ...root.speedBonusTurn,
      actorId: source.id
    })
  // The once-per-turn uses the attack spent return to the attacker's turn record.
  if (root.turnUses)
    await restoreTurnUses(ctx, {
      encounterId: state.id,
      round: root.turnUses.round,
      turnActorId: root.turnUses.turnActorId,
      actorId: source.id,
      keys: root.turnUses.keys
    })
  // D99: only the command that added the Character to the Run's Concentration casters removes it.
  if (root.addedConcentrationCasterId)
    await ctx.db.patch(run._id, {
      concentrationCasterCharacterIds: run.concentrationCasterCharacterIds.filter(
        (id) => id !== root.addedConcentrationCasterId
      )
    })
  // The grants the action used up or ended (rolls, an incapacitation, a heal) come back with their remaining count.
  await restoreConsumedGrants(ctx, root.consumedGrants)
  // The zone an area action placed leaves the Scene with it.
  if (areaRoot?.placedSpatialEffectId)
    await deletePlacedSpatialEffect(ctx, {
      encounterId: state.id,
      id: areaRoot.placedSpatialEffectId
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
  root: Extract<
    StoredCommand,
    { commandType: 'RESOLVE_ACTION' | 'ESCAPE_RELATIONSHIP' | 'SET_CONCEALMENT_OBSERVERS' }
  >
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
      ruleOccurrenceId:
        root.commandType === 'RESOLVE_ACTION' && root.root.kind === 'RULE_OCCURRENCE'
          ? root.root.ruleOccurrenceId
          : null,
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
 * Undoes the Run's last CHECK action exactly from its receipt: its allowance use and the grants its
 * check used up.
 */
async function revertCheckAction(
  ctx: EncounterCharacterWriteTransaction,
  input: RevertScope & {
    root: Extract<StoredCommand, { commandType: 'RESOLVE_ACTION' }>
    checkReceipt: Extract<
      Extract<StoredCommand, { commandType: 'RESOLVE_ACTION' }>['root'],
      { kind: 'CHECK' }
    >['checkReceipt']
  }
): Promise<EncounterCommandResultDto> {
  const { state, root, checkReceipt: receipt } = input
  const actors = await readRunActors(ctx, state)
  const actor = actors.find((entry) => entry.id === receipt.actorId)
  if (!actor) unavailable('The actor left the Encounter; adjust manually.')
  const restored = returnSpentActionEconomy(actor, receipt.actionEconomy)
  // The Help the check used goes back to its holder.
  await restoreConsumedGrants(ctx, root.consumedGrants)
  const updatedAt = new Date().toISOString()
  const outputs = receipt.checkOccurrenceId
    ? await readCheckReceiptOutputs(ctx, {
        state,
        root,
        occurrenceId: receipt.checkOccurrenceId
      })
    : null
  if (outputs?.kind === 'CONCEALMENT_CHECK')
    await revertConcealmentCheck(ctx, state, actors, outputs)
  else if (outputs && outputs.kind !== 'BASIC_ACTION_CHECK')
    throw new Error('Stored basic action check receipt is invalid.')
  const stabilized =
    outputs?.kind === 'BASIC_ACTION_CHECK' && outputs.targetTransition
      ? {
          targetCharacterId: outputs.targetCharacterId,
          targetTransition: outputs.targetTransition
        }
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
        spell: null,
        expectedStreamVersion: stabilized.targetTransition.afterStreamVersion
      },
      userId: input.userId,
      updatedAt,
      gameSystemId: state.gameSystemId
    })
  return commitRevert(ctx, {
    ...input,
    actors,
    nextActors: actors.map((entry) => (entry.id === actor.id ? restored : entry)),
    updatedAt
  })
}

/** Gives a spent allowance back, refusing if the actor used it again since. */
function returnSpentActionEconomy(
  actor: EncounterRunActorState,
  economy: EncounterActionEconomyConsumption | null
): EncounterRunActorState {
  if (!economy) return actor
  if (encounterRuleUsageUsed(actor, economy.definitionId) !== economy.afterUsed)
    unavailable("The actor's action economy changed after this action; adjust manually.")
  return encounterRunActorStateSchema.parse({
    ...actor,
    resources: withEncounterRuleUsageUsed(actor, economy.definitionId, economy.beforeUsed)
  })
}

/**
 * Undoes an Escape attempt that failed: it returns the activation it spent. An escape that freed
 * the holder removed an effect and conditions the receipts do not keep, so it is not undone.
 */
async function revertEscape(
  ctx: EncounterCharacterWriteTransaction,
  input: RevertScope & { root: Extract<StoredCommand, { commandType: 'ESCAPE_RELATIONSHIP' }> }
): Promise<EncounterCommandResultDto> {
  const { state, root } = input
  const { receipt } = root
  const outputs = await readCheckReceiptOutputs(ctx, {
    state,
    root,
    occurrenceId: receipt.checkOccurrenceId
  })
  if (outputs.kind !== 'ESCAPE_CHECK') throw new Error('Stored escape check receipt is invalid.')
  if (outputs.outcome === 'ESCAPED')
    unavailable("Undo can't restore an escaped grapple; adjust manually.")
  const actors = await readRunActors(ctx, state)
  const actor = actors.find((entry) => entry.id === receipt.actorId)
  if (!actor) unavailable('The actor left the Encounter; adjust manually.')
  const restored = returnSpentActionEconomy(actor, receipt.actionEconomy)
  // The Help the check used goes back to its holder.
  await restoreConsumedGrants(ctx, receipt.consumedGrants)
  return commitRevert(ctx, {
    ...input,
    actors,
    nextActors: actors.map((entry) => (entry.id === actor.id ? restored : entry)),
    updatedAt: new Date().toISOString()
  })
}

/** The application outputs of a root command's settled check occurrence. */
async function readCheckReceiptOutputs(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: EncounterRunState
    root: { version: number }
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
  if (!receipt) throw new Error('Stored check receipt is missing.')
  const result = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
  if (checksumRuleDocument(result) !== receipt.resultChecksum)
    throw new Error('Stored Encounter rule receipt mismatch.')
  if (result.status !== 'COMPLETE') throw new Error('Stored check receipt is invalid.')
  return result.applicationOutputs
}

/**
 * Undoes a settled concealment check: a Hide's concealment is deleted and a Search's found
 * concealments get their observers back, each only while nothing touched the effect since.
 */
async function revertConcealmentCheck(
  ctx: EncounterCharacterWriteTransaction,
  state: EncounterRunState,
  actors: readonly EncounterRunActorState[],
  outputs: Extract<ServerRuleExecutionApplicationOutputsDto, { kind: 'CONCEALMENT_CHECK' }>
) {
  const { resolution } = outputs
  if (resolution.kind === 'CONCEAL') {
    const created = resolution.createdEffect
    if (created) {
      const store = createActiveRuleEffectStore(ctx)
      const owner = concealmentHolderOwner(state, actors, created.targetActorId)
      const effect = await store.findById(owner, created.activeEffectId)
      if (!effect || effect.version !== created.afterVersion)
        unavailable('The concealment changed after this action; adjust manually.')
      await store.deleteCas({ id: effect.id, owner, expectedVersion: effect.version })
    }
    return
  }
  // A Search that emptied a concealment ended it; the action's receipt gave that record back.
  for (const found of resolution.found.filter(
    ({ afterObserverActorIds }) => afterObserverActorIds.length
  ))
    await restoreConcealmentObservers(ctx, state, actors, {
      holderActorId: found.holderActorId,
      activeEffectId: found.activeEffectId,
      afterVersion: found.afterVersion,
      observerActorIds: found.beforeObserverActorIds
    })
}

/**
 * Undoes the GM's observer change: the concealment gets its earlier observers back, only while
 * nothing touched it since. A change that emptied the set ended the concealment, and undo gives
 * the ended record back.
 */
async function revertConcealmentObservers(
  ctx: EncounterCharacterWriteTransaction,
  input: RevertScope & {
    root: Extract<StoredCommand, { commandType: 'SET_CONCEALMENT_OBSERVERS' }>
  }
): Promise<EncounterCommandResultDto> {
  const { state, root } = input
  const { receipt } = root
  const actors = await readRunActors(ctx, state)
  if (receipt.endedEffect) await restoreConsumedGrants(ctx, [receipt.endedEffect])
  else
    await restoreConcealmentObservers(ctx, state, actors, {
      holderActorId: receipt.holderActorId,
      activeEffectId: receipt.activeEffectId,
      afterVersion: receipt.afterVersion,
      observerActorIds: receipt.beforeObserverActorIds
    })
  return commitRevert(ctx, {
    ...input,
    actors,
    nextActors: [...actors],
    updatedAt: new Date().toISOString()
  })
}

function concealmentHolderOwner(
  state: EncounterRunState,
  actors: readonly EncounterRunActorState[],
  holderActorId: string
) {
  const holder = actors.find((entry) => entry.id === holderActorId)
  if (!holder) unavailable('The actor left the Encounter; adjust manually.')
  return turnEffectOwner(holder, state.id)
}

/** Sets a concealment's observers back to an earlier set, refusing if the effect changed since. */
async function restoreConcealmentObservers(
  ctx: EncounterCharacterWriteTransaction,
  state: EncounterRunState,
  actors: readonly EncounterRunActorState[],
  input: {
    holderActorId: string
    activeEffectId: string
    afterVersion: number
    observerActorIds: readonly string[]
  }
) {
  const store = createActiveRuleEffectStore(ctx)
  const owner = concealmentHolderOwner(state, actors, input.holderActorId)
  const effect = await store.findById(owner, input.activeEffectId)
  if (!effect || effect.version !== input.afterVersion)
    unavailable('The concealment changed after this action; adjust manually.')
  await store.updateLifecycleCas({
    id: effect.id,
    owner,
    expectedVersion: effect.version,
    lifecycle: concealmentLifecycleFor(effect, input.observerActorIds)
  })
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
  const spell = inverse.spell
  if (spell)
    state = updateSpellSlotUsage(
      { ...character, state },
      spell.slotKey,
      () => spell.beforeUsed
    ).state
  if (inverse.stow) {
    const equipped = state.equipment.equipped
    const itemId = inverse.stow.itemInstanceId
    // The receipt holds the equipment checksum, not the slot or the position: the one entry that
    // reproduces the checksum is the exact one that was stowed.
    const restored = Array.from({ length: equipped.length + 1 }, (_, index) => index)
      .flatMap((index) =>
        EQUIPPED_SLOT_CODES.map((slot) => ({
          ...state.equipment,
          equipped: [...equipped.slice(0, index), { itemId, slot }, ...equipped.slice(index)]
        }))
      )
      .find((equipment) => checksumRuleDocument(equipment) === inverse.stow!.beforeStateChecksum)
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
