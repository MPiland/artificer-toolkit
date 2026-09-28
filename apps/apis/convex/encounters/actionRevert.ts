import {
  encounterCommandResultDtoSchema,
  revertLastEncounterActionInputDtoSchema,
  type EncounterCommandResultDto,
  type RevertLastEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { characterHistoryEntryDtoSchema } from '@artificer-toolkit/schema/api/characterHistory'
import { characterStoredCommandReceiptSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
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
import { characterZeroHitPointsConditionId } from '@artificer-toolkit/rules-runtime/characterZeroHitPoints'
import {
  encounterBasicActionEffects,
  withEncounterBasicActionEffects
} from '@artificer-toolkit/rules-runtime/encounterBasicActions'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { readCharacterRecord, readCharacterSheetState } from '../characters/documents'
import { writeCharacterRecord } from '../characters/characterWrites'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { createActiveRuleEffectStore } from '../rules/effectStore'
import {
  readRunActors,
  readRunState,
  replaceRunActor
} from '@artificer-toolkit/encounter-persistence/documents'
import { removeTurnSpeedBonus } from './turnMovement'
import { projectNativeGm } from './nativeProjection'
import {
  insertRunCommand,
  presentTimelineEntry
} from '@artificer-toolkit/encounter-persistence/timelineEntries'

type ActionBatch = Extract<
  ServerRuleExecutionApplicationOutputsDto,
  { kind: 'CHARACTER_MECHANICS_BATCH' | 'ENCOUNTER_ACTOR_MECHANICS_BATCH' }
>
type CleavingDamage = Extract<ServerRuleExecutionApplicationOutputsDto, { kind: 'CLEAVING_DAMAGE' }>
type CharacterInverse = {
  hitPoints: ActionBatch['targetTransition']['before'] | null
  removedConditionIds: Set<string>
  resource: ActionBatch['resourceConsumption']
  stow: ActionBatch['sourceItemUseStateTransition']
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
  ctx: MutationCtx,
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
  const { campaign, membership } = await requireCampaignAuthority(ctx, run.campaignId, userId)
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
    return encounterCommandResultDtoSchema.parse(JSON.parse(prior.resultJson))
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
    if (rootIndex !== 0) throw new Error('Stored Encounter command scan is invalid.')
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
      else unsupported.add(outputs?.kind === 'CONTESTED_ACTION' ? 'a Disarm' : 'this action')
      continue
    }
    if (
      (outputs?.kind !== 'CONCENTRATION_CHECK' && outputs?.kind !== 'CLEAVING_DAMAGE') ||
      outputs.parentOccurrenceId !== root.ruleOccurrenceId
    ) {
      unsupported.add('a later rule result')
      continue
    }
    childOccurrenceIds.add(receipt.occurrenceId)
    if (outputs.kind === 'CONCENTRATION_CHECK') {
      // A failed save ended a maintained effect whose contents the receipt does not keep.
      if (outputs.outcome === 'SAVE_FAILURE') unsupported.add('lost Concentration')
    } else if (outputs.outcome === 'APPLIED') cleaving.push(outputs)
  }
  if ([...laterOccurrenceIds].some((occurrenceId) => !childOccurrenceIds.has(occurrenceId)))
    unavailable('Another decision changed the Encounter after this action; adjust manually.')
  if (!batch && !unsupported.size) throw new Error('Stored Encounter action receipt is missing.')
  const action = batch
  if (action) {
    if (
      action.applications.some(
        (application) => application.kind === 'CONDITION_REMOVE' && application.applied
      )
    )
      unsupported.add('a removed condition')
    const maintenance = action.maintenanceTransition ?? null
    if (maintenance && (maintenance.priorState || maintenance.removedDependentEffects.length))
      unsupported.add('a replaced maintained effect')
    if (action.spellCastConsumption) unsupported.add('a spell slot')
  }
  if (unsupported.size || !action)
    unavailable(`Undo can't restore ${[...unsupported].join(', ')}; adjust manually.`)

  const actors = await readRunActors(ctx, state)
  const actorsById = new Map(actors.map((actor) => [actor.id, actor]))
  const source = actorsById.get(action.sourceActorId)
  const target = actorsById.get(action.targetActorId)
  if (!source || !target) throw new Error('Stored Encounter action actors are unavailable.')
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
          expectedStreamVersion: streamVersion
        }
    characterInverses.set(characterId, next)
    return next
  }
  const addedConditionIds = new Set(
    action.applications.flatMap((application) =>
      application.kind === 'CONDITION_APPLY' && application.applied ? [application.conditionId] : []
    )
  )
  const sourceCharacterId =
    source.kind === 'CHARACTER' && source.sourceId !== null ? source.sourceId : null
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
  const sourceStreamVersion =
    action.kind === 'CHARACTER_MECHANICS_BATCH' && action.sourceActorId === action.targetActorId
      ? action.targetCharacterStreamVersion
      : action.sourceCharacterStreamVersion
  if ((action.resourceConsumption || action.sourceItemUseStateTransition) && sourceCharacterId) {
    if (sourceStreamVersion === null) throw new Error('Stored source Character version is missing.')
    const inverse = characterInverse(sourceCharacterId, sourceStreamVersion)
    inverse.resource = action.resourceConsumption
    inverse.stow = action.sourceItemUseStateTransition
  }
  for (const owner of action.maintenanceTransition?.characterOwnerTransitions ?? [])
    characterInverse(owner.characterId, owner.afterStreamVersion)

  // Run-owned source changes: feature charges and the action allowance.
  const feature = action.featureResourceConsumption
  if (feature) {
    const owner = actorsById.get(feature.ownerActorId)
    if (!owner || featureChargeUsed(owner, feature.ownerFeatureId) !== feature.afterUsed)
      unavailable("The actor's feature charges changed after this action; adjust manually.")
    updateActor(owner.id, {
      resources: withFeatureChargeUsed(owner, feature.ownerFeatureId, feature.beforeUsed)
    })
  }
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
  const economy = action.actionEconomyTransition
  if (economy) {
    const owner = actorsById.get(source.id)!
    if (encounterRuleUsageUsed(owner, economy.definitionId) !== economy.afterUsed)
      unavailable("The actor's action economy changed after this action; adjust manually.")
    updateActor(owner.id, {
      resources: withEncounterRuleUsageUsed(owner, economy.definitionId, economy.beforeUsed)
    })
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

  // Created effects and the maintained state go away; their versions prove nothing touched them.
  const store = createActiveRuleEffectStore(ctx)
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

  const updatedAt = new Date().toISOString()
  for (const [characterId, inverse] of characterInverses)
    await restoreCharacter(ctx, {
      characterId,
      inverse,
      userId,
      updatedAt,
      encounterId: state.id,
      commandId: input.commandId,
      revertedCommandId: root.commandId,
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
  run: Doc<'encounterRuns'>
  state: EncounterRunState
  campaign: Doc<'campaigns'>
  input: RevertLastEncounterActionInputDto
  fingerprint: string
  userId: string
  root: Extract<StoredCommand, { commandType: 'RESOLVE_ACTION' | 'USE_BASIC_ACTION' }>
}

/** Writes the restored actors, the next Run version and the undo's own timeline entry. */
async function commitRevert(
  ctx: MutationCtx,
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
    projectionJson: JSON.stringify(projection),
    projectionChecksum: checksumCanonicalJson(projection),
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
      resultJson: JSON.stringify(result),
      resultChecksum: checksumCanonicalJson(result),
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
  ctx: MutationCtx,
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
  return commitRevert(ctx, {
    ...input,
    actors,
    nextActors: actors.map((entry) => (entry.id === actor.id ? restored : entry)),
    updatedAt: new Date().toISOString()
  })
}
async function restoreCharacter(
  ctx: MutationCtx,
  input: {
    characterId: string
    inverse: CharacterInverse
    userId: string
    updatedAt: string
    encounterId: string
    commandId: string
    revertedCommandId: string
    gameSystemId: string
  }
) {
  const { inverse } = input
  const row: Doc<'characters'> | null = await ctx.db
    .query('characters')
    .withIndex('by_publicId', (q) => q.eq('id', input.characterId))
    .unique()
  if (!row || row.status !== 'ACTIVE' || row.systemId !== input.gameSystemId)
    throw new Error('Encounter Character is unavailable.')
  if (row.streamVersion !== inverse.expectedStreamVersion)
    unavailable(`${row.label}'s Sheet changed after this action; adjust manually.`)
  const character = readCharacterRecord(row)
  let state = character.state
  // The fenced stream version proves the Sheet is exactly what this action left.
  if (inverse.hitPoints)
    state = {
      ...state,
      hitpoints: {
        ...state.hitpoints,
        current: inverse.hitPoints.currentHitPoints,
        temp: inverse.hitPoints.temporaryHitPoints
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
  const sheetState = readCharacterSheetState(row)
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
  await writeCharacterRecord(ctx, {
    current: row,
    fields: { streamVersion: row.streamVersion + 1, updatedAt: input.updatedAt },
    document: JSON.parse(JSON.stringify({ ...character, state })),
    ...(nextSheetState ? { sheetState: nextSheetState } : {})
  })
  const eventId = crypto.randomUUID()
  const history = characterHistoryEntryDtoSchema.parse({
    eventId,
    occurredAt: input.updatedAt,
    actorId: input.userId,
    eventType: 'CHARACTER_RULE_OUTCOME_REVERTED',
    summary: 'Encounter action undone by the GM'
  })
  await ctx.db.insert(
    'characterCommandReceipts',
    characterStoredCommandReceiptSchema.parse({
      id: eventId,
      characterId: row.id,
      commandId: input.commandId,
      actorId: input.userId,
      commandFingerprint: checksumRuleDocument({
        encounterId: input.encounterId,
        revertedCommandId: input.revertedCommandId,
        characterId: row.id
      }),
      occurredAt: input.updatedAt,
      historyJson: canonicalizeRuleDocument(history),
      historyChecksum: checksumRuleDocument(history)
    })
  )
}
