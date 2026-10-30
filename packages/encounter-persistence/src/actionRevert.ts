import { resolveEncounterActionInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  revertLastEncounterActionInputDtoSchema,
  type EncounterCommandResultDto,
  type RevertLastEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { type ConcentrationEndReason } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import { damageSaveCheckMutatesRun } from '@artificer-toolkit/schema/shared/ruleExecutionDamageSaveOutputs'
import type { ServerRuleExecutionApplicationOutputsDto } from '@artificer-toolkit/schema/shared/ruleExecutionApplicationOutputs'
import {
  ENDED_EFFECT_RELEASE_OPERATION_KEY,
  isEndedEffectRelease,
  type DamageInterceptionChargeDto
} from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import { interceptionChargesSpent } from '@artificer-toolkit/rules-runtime/encounterDamageInterception'
import { withCharacterTemporaryHitPoints } from '@artificer-toolkit/schema/shared/temporaryHitPoints'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type { EncounterActionEconomyConsumption } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import {
  featureChargeUsed,
  encounterRuleUsageUsed,
  withEncounterActorIdleTurnMark,
  withEncounterRuleUsageUsed,
  withFeatureChargeUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import {
  readEncounterActorConditionState,
  targetTemporaryHitPoints
} from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { nextEncounterActorDefeated } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { concealmentLifecycleFor } from '@artificer-toolkit/rules-runtime/encounterConcealment'
import { revertDamageTypesTaken } from '@artificer-toolkit/rules-runtime/encounterDamageTypesSinceTurnStart'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { revertEncounterAttackActionTransition } from '@artificer-toolkit/rules-runtime/encounterAttackAction'
import {
  revertEncounterActorItemDraw,
  revertEncounterActorItemRelease
} from '@artificer-toolkit/rules-runtime/encounterActorOptionalContestContext'
import { updateSpellSlotUsage } from '@artificer-toolkit/rules-runtime/character/sheetCommandReducer'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import { EQUIPPED_SLOT_CODES } from '@artificer-toolkit/shared/core'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { restoreConsumedGrants, restoreEndedMaintainedStates } from './consumedGrantPersistence.js'
import { deletePlacedSpatialEffect } from './placedSpatialEffects.js'
import { rejectDomain } from './domainRejections.js'
import {
  invertTargetMechanics,
  returnInterceptionCharges,
  revertUnavailable,
  withHitPointsBefore,
  type ActionBatch
} from './targetMechanicsInverse.js'
import { holdsActorForm } from './actorFormPersistence.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import { readRunActors, readRunActorWithRow, readRunState } from './documents.js'
import { settleCharacterConditionMaximum } from './conditionMaximumSettlement.js'
import { commitRevert, type RevertScope, type StoredCommand } from './revertCommit.js'
import { revertZoneDcs, revertZoneDisarm, revertZoneSightingDismissal } from './zoneRevert.js'
import { removeConjuredActors } from './summonRemoval.js'
import {
  removeTurnSpeedBonus,
  removeTurnTeleportAllowance,
  restoreTurnUses
} from './turnMovement.js'
import { replayEncounterCommandResult } from './replayReceipts.js'
import { presentTimelineEntry } from './timelineEntries.js'
import type { EncounterDocument } from './store.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import { revertCreatureRestActor } from './creatureRestRevert.js'

function replacesMaintainedEffect(
  maintenance: {
    priorState: unknown
    removedDependentEffects: readonly unknown[]
    endedCarriedGrants: readonly unknown[]
  } | null
) {
  return Boolean(
    maintenance &&
    (maintenance.priorState ||
      maintenance.removedDependentEffects.length ||
      maintenance.endedCarriedGrants.length)
  )
}

type AreaRoot = Extract<ServerRuleExecutionApplicationOutputsDto, { kind: 'ENCOUNTER_AREA_ACTION' }>
type CounteredRoot = Extract<
  ServerRuleExecutionApplicationOutputsDto,
  { kind: 'ENCOUNTER_COUNTERED_CAST' }
>
type GatedRoot = Extract<
  ServerRuleExecutionApplicationOutputsDto,
  { kind: 'ENCOUNTER_GATED_ACTION' }
>
type CleavingDamage = Extract<ServerRuleExecutionApplicationOutputsDto, { kind: 'CLEAVING_DAMAGE' }>
type CharacterInverse = {
  hitPoints: ActionBatch['targetTransition']['before'] | null
  /** The current hit points the Character had before the action healed it (D181); null when it did not. */
  healedFromCurrentHitPoints: number | null
  removedConditionIds: Set<string>
  /** Conditions the action released from the Character, given back by the undo. */
  restoredConditionIds: Set<string>
  resource: ActionBatch['resourceConsumption']
  /** The one item this action unequipped from the Character: a stow it accepted, or a drop. */
  unequipped: ActionBatch['sourceItemUseStateTransition']
  /** The weapon this action's attack drew or threw (D107); undo takes a drawn one back to carried and a thrown one back to its hand. */
  drawn: Extract<ActionBatch['sourceItemDraw'], { kind: 'CHARACTER_ITEM_DRAW' }> | null
  item: ActionBatch['sourceItemConsumption']
  /** The item the action corroded (a worn one, or the weapon the source struck with); undo restores its penalty and, if destroyed, its use. */
  degradation: ActionBatch['sourceItemDegradation']
  /** Slot spends in the order they committed; one batch can carry several (the cast, then its counter). */
  spells: NonNullable<ActionBatch['spellCastConsumption']>[]
  /** The Sheet pool charges the Character's feature-held damage interceptions spent, in spend order. */
  interceptionCharges: DamageInterceptionChargeDto[]
  expectedStreamVersion: number
}

/** The conditions an action's ended effects released, which its undo gives back with the effects. */
function endedConditionReleases(applications: ActionBatch['applications']) {
  return applications.flatMap((application) =>
    application.kind === 'CONDITION_REMOVE' &&
    application.applied &&
    application.sourceOperationKey === ENDED_EFFECT_RELEASE_OPERATION_KEY
      ? [application.conditionId]
      : []
  )
}

/** A Character inverse that restores nothing yet, fenced on the Sheet version the action left. */
function characterInverseAt(expectedStreamVersion: number): CharacterInverse {
  return {
    hitPoints: null,
    healedFromCurrentHitPoints: null,
    removedConditionIds: new Set(),
    restoredConditionIds: new Set(),
    resource: null,
    unequipped: null,
    drawn: null,
    item: null,
    degradation: null,
    spells: [],
    interceptionCharges: [],
    expectedStreamVersion
  }
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

/** The command a rule-raised action was raised by, or null for an action a player took. */
function storedSystemTriggerParentId(root: { commandJson: string }) {
  const command = resolveEncounterActionInputDtoSchema.parse(JSON.parse(root.commandJson))
  return command.systemTrigger?.parentCommandId.toLowerCase() ?? null
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
    revertUnavailable('The Encounter changed after its last command; adjust manually.')
  const rootIndex = recent.findIndex((entry) => entry.commandType !== 'RESOLVE_RULE_OCCURRENCE')
  const root = recent[rootIndex]
  if (root?.commandType === 'REVERT_LAST_ACTION')
    revertUnavailable('The last action was already undone.')
  const scope = { run, state, campaign, input, fingerprint, userId }
  // Only the check's own answers follow its action: its d20, a d20 window's choice, its outcome dice.
  const requireCheckAnswerScan = (checkOccurrenceId: string | null) => {
    if (
      recent
        .slice(0, rootIndex)
        .some(
          (answer) =>
            answer.commandType !== 'RESOLVE_RULE_OCCURRENCE' ||
            answer.ruleOccurrenceId !== checkOccurrenceId
        )
    )
      throw new Error('Stored Encounter command scan is invalid.')
  }
  if (root?.commandType === 'ESCAPE') {
    const outputs = await readCheckReceiptOutputs(ctx, {
      state,
      root,
      occurrenceId: root.receipt.checkOccurrenceId
    })
    // A contested escape settles through the one contest path, which undo leaves to the GM.
    if (outputs.kind === 'CONTESTED_ACTION')
      revertUnavailable("Undo can't restore a contested escape; adjust manually.")
    requireCheckAnswerScan(root.receipt.checkOccurrenceId)
    return revertEscape(ctx, { ...scope, root, outputs })
  }
  if (root?.commandType === 'SET_CONCEALMENT_OBSERVERS') {
    if (rootIndex !== 0) throw new Error('Stored Encounter command scan is invalid.')
    return revertConcealmentObservers(ctx, { ...scope, root })
  }
  if (root?.commandType === 'PLACE_ZONE') {
    if (rootIndex !== 0) throw new Error('Stored Encounter command scan is invalid.')
    return revertPlaceZone(ctx, { ...scope, root })
  }
  if (root?.commandType === 'SET_ZONE_DCS' || root?.commandType === 'REVEAL_ZONE') {
    if (rootIndex !== 0) throw new Error('Stored Encounter command scan is invalid.')
    return revertZoneDcs(ctx, { ...scope, root })
  }
  if (root?.commandType === 'DISARM_ZONE') {
    if (rootIndex !== 0) throw new Error('Stored Encounter command scan is invalid.')
    return revertZoneDisarm(ctx, { ...scope, root })
  }
  if (root?.commandType === 'DISMISS_ZONE_SIGHTING') {
    if (rootIndex !== 0) throw new Error('Stored Encounter command scan is invalid.')
    return revertZoneSightingDismissal(ctx, { ...scope, root })
  }
  if (root?.commandType === 'CREATURE_REST') {
    if (rootIndex !== 0) throw new Error('Stored Encounter command scan is invalid.')
    return revertCreatureRest(ctx, { ...scope, root })
  }
  if (root?.commandType === 'MOVE_HELD_EFFECT') {
    if (rootIndex !== 0) throw new Error('Stored Encounter command scan is invalid.')
    return revertMoveHeldEffect(ctx, { ...scope, root })
  }
  if (root?.commandType === 'CHANGE_FACING') {
    if (rootIndex !== 0) throw new Error('Stored Encounter command scan is invalid.')
    return revertChangeFacing(ctx, { ...scope, root })
  }
  if (root?.commandType !== 'RESOLVE_ACTION')
    revertUnavailable(
      root
        ? 'Only an action can be undone, and something else happened after it.'
        : 'There is no action to undo.'
    )
  if (root.damageMirrored)
    revertUnavailable("Undo can't restore damage a mirror passed on; adjust manually.")
  if (root.root.kind === 'CHECK') {
    requireCheckAnswerScan(root.root.checkReceipt.checkOccurrenceId)
    return revertCheckAction(ctx, { ...scope, root, checkReceipt: root.root.checkReceipt })
  }
  const { ruleOccurrenceId } = root.root
  // A rule-raised action (a defeat trigger) goes back with the action that raised it, system first.
  const parentCommandId = storedSystemTriggerParentId(root)
  const groupRoots: Omit<RevertGroup, 'receipts'>[] = [
    { root, ruleOccurrenceId, laterEntries: recent.slice(0, rootIndex) }
  ]
  if (parentCommandId) {
    const parentIndex = recent.findIndex(
      (entry, index) => index > rootIndex && entry.commandType !== 'RESOLVE_RULE_OCCURRENCE'
    )
    const parent = recent[parentIndex]
    if (parent?.commandType !== 'RESOLVE_ACTION' || parent.root.kind !== 'RULE_OCCURRENCE')
      revertUnavailable('The action that raised this one changed after it; adjust manually.')
    groupRoots.push({
      root: parent,
      ruleOccurrenceId: parent.root.ruleOccurrenceId,
      laterEntries: recent.slice(rootIndex + 1, parentIndex)
    })
  }

  // Every receipt committed since the earliest action belongs to one of the groups.
  const receipts = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_encounterId_encounterVersion', (q) =>
      q.eq('encounterId', run.id).gte('encounterVersion', groupRoots.at(-1)!.root.version)
    )
    .take(RECEIPT_SCAN_LIMIT)
  if (receipts.length === RECEIPT_SCAN_LIMIT)
    revertUnavailable('This action has too many follow-up results to undo; adjust manually.')
  // The raising command is the parent's own, or an answer that settled it (one receipt, no Run row).
  const raisingRoot = groupRoots[1]?.root
  if (
    raisingRoot &&
    raisingRoot.commandId !== parentCommandId &&
    !receipts.some((receipt) => receipt.commandId === parentCommandId)
  )
    revertUnavailable('The action that raised this one changed after it; adjust manually.')
  const plans = groupRoots.map((group, index) =>
    planRevertRoot({
      ...group,
      receipts: receipts.filter(
        (receipt) =>
          receipt.encounterVersion >= group.root.version &&
          (index === 0 || receipt.encounterVersion < groupRoots[index - 1]!.root.version)
      )
    })
  )

  const store = createActiveRuleEffectStore(ctx)
  // A cast's creature form ends first: ending its effect restores the origin the cast swapped out
  // (D130), so the inverses below read the actor as it stood before the cast.
  const endedFormEffectIds = new Set<string>()
  for (const action of plans.flatMap((plan) => plan.targetBatches)) {
    // A Character's form is held by an effect on the Character, found through its Run actor.
    const wearer =
      action.kind === 'CHARACTER_MECHANICS_BATCH'
        ? (await readRunActorWithRow(ctx, state, action.targetActorId)).actor
        : null
    if (wearer && wearer.kind !== 'CHARACTER')
      throw new Error('Stored Character action target is invalid.')
    const owner =
      wearer?.kind === 'CHARACTER'
        ? { kind: 'CHARACTER' as const, characterId: wearer.sourceId }
        : {
            kind: 'ENCOUNTER_ACTOR' as const,
            encounterId: state.id,
            targetActorId: action.targetActorId
          }
    for (const transition of action.activeEffectTransitions) {
      const effect = await store.findById(owner, transition.activeEffectId)
      if (!effect || !holdsActorForm(effect.definition)) continue
      await store.deleteCas({
        id: effect.id,
        owner,
        expectedVersion: transition.afterVersion,
        removal: 'REMOVED'
      })
      endedFormEffectIds.add(effect.id)
    }
  }

  const actors = await readRunActors(ctx, state)
  const actorsById = new Map(actors.map((actor) => [actor.id, actor]))
  // Each inverse reads the actor as earlier inverses left it; the schema validates every change.
  const updateActor = (actorId: string, change: Record<string, unknown>) => {
    const next = encounterRunActorStateSchema.parse({ ...actorsById.get(actorId), ...change })
    actorsById.set(actorId, next)
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
      : characterInverseAt(streamVersion)
    characterInverses.set(characterId, next)
    return next
  }
  const conjuredActorIds: string[] = []
  let revertedState = state
  /** Inverts one root's outcomes onto the shared actors and Character inverses. */
  const invertRoot = async ({
    root,
    batch,
    areaRoot,
    lostRoot,
    cleaving,
    retaliation,
    targetBatches,
    zoneDamage,
    spend
  }: (typeof plans)[number]) => {
    const source = actorsById.get(spend.sourceActorId)
    if (!source) throw new Error('Stored Encounter action actors are unavailable.')
    const restoreHitPoints = (
      actorId: string,
      transition: Pick<ActionBatch['targetTransition'], 'before' | 'after'>
    ) => actorsById.set(actorId, withHitPointsBefore(actorsById.get(actorId)!, transition))

    // The zone contacts a forced movement settled came last, so they undo first.
    for (const { targetActorId, ...transition } of zoneDamage.toReversed()) {
      if (actorsById.get(targetActorId)?.kind === 'CHARACTER')
        revertUnavailable("Undo can't restore zone damage to a Character.")
      restoreHitPoints(targetActorId, transition)
    }
    // Cleaving children are undone first, in reverse order of application.
    for (const damage of cleaving.toReversed()) {
      const cleaved = damage.targetActorId ? actorsById.get(damage.targetActorId) : undefined
      if (!cleaved || !damage.targetTransition)
        throw new Error('Stored Cleaving receipt is invalid.')
      if (cleaved.kind === 'CHARACTER')
        revertUnavailable("Undo can't restore Cleaving damage to a Character.")
      restoreHitPoints(cleaved.id, damage.targetTransition)
    }
    const [firstRetaliation] = retaliation
    if (firstRetaliation)
      restoreHitPoints(firstRetaliation.candidate.candidate.targetActorId, {
        ...firstRetaliation.targetTransition,
        after: retaliation.at(-1)!.targetTransition.after
      })
    // The timed grants the attacker's own passive triggers made from that damage go with it.
    for (const grant of batch?.meleeRetaliation?.grantEffectTransitions ?? [])
      await store.deleteCas({
        id: grant.activeEffectId,
        owner: {
          kind: 'ENCOUNTER_ACTOR',
          encounterId: state.id,
          targetActorId: grant.targetActorId
        },
        expectedVersion: grant.afterVersion,
        removal: 'REMOVED'
      })

    const createdStates = new Map<
      string,
      NonNullable<ActionBatch['maintenanceTransition']>['createdState']
    >()
    /** Gives back what an ended effect released from `actor`: on the Sheet for a Character, in the Run otherwise. */
    const restoreReleasedConditions = (
      actor: NonNullable<typeof source>,
      conditionIds: readonly string[],
      streamVersion: number | null
    ) => {
      if (!conditionIds.length) return
      if (actor.kind === 'CHARACTER') {
        if (actor.sourceId === null || streamVersion === null)
          throw new Error('Stored source Character version is missing.')
        characterInverse(actor.sourceId, streamVersion).restoredConditionIds = new Set(conditionIds)
        return
      }
      const conditions = readEncounterActorConditionState(actor.conditions ?? [])
      if (conditionIds.some((conditionId) => conditions.ids.includes(conditionId)))
        revertUnavailable(`${actor.label}'s conditions changed after this action; adjust manually.`)
      updateActor(actor.id, {
        conditions: [
          ...conditions.values,
          ...conditionIds.map((conditionTypeId) => ({ conditionTypeId }))
        ]
      })
    }

    /** One creature's outcome: its hit points, conditions, charges, effects and maintenance. */
    const invertTarget = async (action: ActionBatch) => {
      const target = actorsById.get(action.targetActorId)
      if (!target) throw new Error('Stored Encounter action actors are unavailable.')
      const characterBatch = action.kind === 'CHARACTER_MECHANICS_BATCH'
      if (characterBatch !== (target.kind === 'CHARACTER'))
        throw new Error(
          characterBatch
            ? 'Stored Character action target is invalid.'
            : 'Stored Encounter actor target is invalid.'
        )
      const inverted = invertTargetMechanics(state.gameSystemId, target, {
        ...action,
        targetCharacterStreamVersion: characterBatch ? action.targetCharacterStreamVersion : null
      })
      actorsById.set(target.id, inverted.actor)
      // A reaction the target used spent its slot and allowance and created its effect with this outcome.
      const reaction = action.reaction
      if (inverted.sheet && action.kind === 'CHARACTER_MECHANICS_BATCH') {
        const inverse = characterInverse(inverted.sheet.characterId, inverted.sheet.streamVersion)
        inverse.hitPoints = inverted.sheet.hitPoints
        inverse.removedConditionIds = inverted.sheet.removedConditionIds
        if (reaction?.spellCastConsumption) inverse.spells.push(reaction.spellCastConsumption)
        inverse.interceptionCharges.push(...interceptionChargesSpent(action.applications))
        if (action.targetItemUseStateTransition)
          inverse.unequipped = action.targetItemUseStateTransition
        inverse.degradation = action.targetItemDegradation
      }
      // An item a Creature target dropped goes back in the hand it left.
      const release = characterBatch ? null : action.targetItemUseStateTransition
      if (release) {
        const held = revertEncounterActorItemRelease({
          actor: actorsById.get(target.id)!,
          transition: release
        })
        if (!held)
          revertUnavailable(
            `${target.label}'s equipment changed after this action; adjust manually.`
          )
        updateActor(target.id, { snapshot: held.snapshot })
      }
      // A creature that ended its own effects (it cast, or was caught by its own area) gets them back.
      restoreReleasedConditions(
        actorsById.get(target.id)!,
        endedConditionReleases(action.applications),
        action.kind === 'CHARACTER_MECHANICS_BATCH' ? action.targetCharacterStreamVersion : null
      )
      for (const owner of action.maintenanceTransition?.characterOwnerTransitions ?? [])
        characterInverse(owner.characterId, owner.afterStreamVersion)
      const targetFeature = action.targetFeatureResourceConsumption
      if (targetFeature) {
        const owner = actorsById.get(targetFeature.ownerActorId)
        if (
          !owner ||
          featureChargeUsed(owner, targetFeature.ownerFeatureId) !== targetFeature.afterUsed
        )
          revertUnavailable(
            "The target's feature charges changed after this action; adjust manually."
          )
        updateActor(owner.id, {
          resources: withFeatureChargeUsed(
            owner,
            targetFeature.ownerFeatureId,
            targetFeature.beforeUsed
          )
        })
      }
      actorsById.set(
        target.id,
        returnInterceptionCharges(actorsById.get(target.id)!, action.applications)
      )
      const reactionEconomy = reaction?.actionEconomyTransition
      if (reactionEconomy) {
        const reactor = actorsById.get(target.id)!
        if (
          encounterRuleUsageUsed(reactor, reactionEconomy.definitionId) !==
          reactionEconomy.afterUsed
        )
          revertUnavailable("The target's reactions changed after this action; adjust manually.")
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
        ...(reaction?.activeEffectTransitions ?? []),
        ...(action.kind === 'CHARACTER_MECHANICS_BATCH' ? action.reactionEffectTransitions : []),
        ...action.grantEffectTransitions
      ].filter(({ activeEffectId }) => !endedFormEffectIds.has(activeEffectId)))
        await store.deleteCas({
          id: effect.activeEffectId,
          owner: characterOwnerId
            ? { kind: 'CHARACTER', characterId: characterOwnerId }
            : { kind: 'ENCOUNTER_ACTOR', encounterId: state.id, targetActorId: target.id },
          expectedVersion: effect.afterVersion,
          removal: 'REMOVED'
        })
      for (const effect of action.stateEffectTransitions)
        await store.deleteCas({
          id: effect.activeEffectId,
          owner: effect.owner,
          expectedVersion: effect.afterVersion,
          removal: 'REMOVED'
        })
      const created = action.maintenanceTransition?.createdState
      if (created) createdStates.set(created.id, created)
    }
    for (const action of targetBatches.toReversed()) await invertTarget(action)
    const rootCreated = areaRoot?.maintenanceTransition?.createdState
    if (rootCreated) createdStates.set(rootCreated.id, rootCreated)
    // The timed grant the placed zone gave its placer goes with the zone; its version proves it untouched.
    const sourceGrant = areaRoot?.sourceGrantTransition
    if (areaRoot && sourceGrant)
      await store.deleteCas({
        id: sourceGrant.activeEffectId,
        owner: areaRoot.sourceCharacterId
          ? { kind: 'CHARACTER', characterId: areaRoot.sourceCharacterId }
          : {
              kind: 'ENCOUNTER_ACTOR',
              encounterId: state.id,
              targetActorId: areaRoot.sourceActorId
            },
        expectedVersion: sourceGrant.afterVersion,
        removal: 'REMOVED'
      })
    // Every record an area action placed (a zone's own and its bands) leaves the Scene with it,
    // before the state they depend on goes.
    for (const id of areaRoot?.placedSpatialEffectIds ?? [])
      await deletePlacedSpatialEffect(ctx, { encounterId: state.id, id })
    // Every creature of an area shares the one state, so it goes once, after the last dependent.
    for (const created of createdStates.values())
      await store.deleteMaintainedStateCas({
        id: created.id,
        encounterId: state.id,
        ownerActorId: created.sourceActorId,
        expectedVersion: created.version,
        removal: 'REMOVED'
      })

    // The weapon the source's attack drew or threw: a Creature's goes back where it was here.
    const sourceDraw = batch?.sourceItemDraw ?? null
    const sourceDegradation = batch?.sourceItemDegradation ?? null
    if (sourceDraw?.kind === 'ENCOUNTER_ACTOR_ITEM_DRAW') {
      const actor = actorsById.get(sourceDraw.actorId)!
      const restored =
        sourceDraw.movement === 'THROW'
          ? revertEncounterActorItemRelease({
              actor,
              transition: { ...sourceDraw, fromState: sourceDraw.slot }
            })
          : revertEncounterActorItemDraw({ actor, transition: sourceDraw })
      if (!restored)
        revertUnavailable(`${source.label}'s equipment changed after this action; adjust manually.`)
      updateActor(sourceDraw.actorId, { snapshot: restored.snapshot })
    }
    // The source's one spend: its Character resource, item or stow, spell slot, feature charge and allowances.
    const sourceCharacterId =
      source.kind === 'CHARACTER' && source.sourceId !== null ? source.sourceId : null
    if (
      (spend.resourceConsumption ||
        spend.sourceItemUseStateTransition ||
        sourceDraw?.kind === 'CHARACTER_ITEM_DRAW' ||
        sourceDegradation ||
        spend.sourceItemConsumption ||
        spend.spellCastConsumption?.owner.kind === 'CHARACTER') &&
      sourceCharacterId
    ) {
      if (spend.sourceCharacterStreamVersion === null)
        throw new Error('Stored source Character version is missing.')
      const inverse = characterInverse(sourceCharacterId, spend.sourceCharacterStreamVersion)
      inverse.resource = spend.resourceConsumption
      if (spend.sourceItemUseStateTransition)
        inverse.unequipped = spend.sourceItemUseStateTransition
      if (sourceDraw?.kind === 'CHARACTER_ITEM_DRAW') inverse.drawn = sourceDraw
      inverse.degradation = sourceDegradation
      inverse.item = spend.sourceItemConsumption
      if (spend.spellCastConsumption?.owner.kind === 'CHARACTER')
        inverse.spells.push(spend.spellCastConsumption)
    }
    // The conditions the source's ended effects released (Invisibility) come back with the effects.
    restoreReleasedConditions(
      source,
      endedConditionReleases(spend.sourceApplications),
      spend.sourceCharacterStreamVersion
    )
    // The hit points the source regained from its damage (D181) go back, refusing if they changed since.
    const heals = spend.sourceApplications.filter(
      (application) => application.kind === 'HEAL' && application.appliedAmount > 0
    )
    const firstHeal = heals[0]
    const lastHeal = heals.at(-1)
    if (firstHeal?.kind === 'HEAL' && lastHeal?.kind === 'HEAL') {
      if (source.kind === 'CHARACTER') {
        if (sourceCharacterId === null || spend.sourceCharacterStreamVersion === null)
          throw new Error('Stored source Character version is missing.')
        characterInverse(
          sourceCharacterId,
          spend.sourceCharacterStreamVersion
        ).healedFromCurrentHitPoints = firstHeal.beforeCurrentHitPoints
      } else {
        const holder = actorsById.get(source.id)!
        if (
          holder.kind === 'CHARACTER' ||
          holder.currentHitPoints !== lastHeal.afterCurrentHitPoints
        )
          revertUnavailable(
            `${source.label}'s hit points changed after this action; adjust manually.`
          )
        updateActor(holder.id, {
          currentHitPoints: firstHeal.beforeCurrentHitPoints,
          defeated: nextEncounterActorDefeated(holder, firstHeal.beforeCurrentHitPoints)
        })
      }
    }
    // So do the ones the retaliation's damage released from the attacker; the effects themselves
    // come back with the root's consumed grants, after the grants that damage made are deleted.
    restoreReleasedConditions(source, batch?.meleeRetaliation?.releasedConditionIds ?? [], null)
    // A Creature's spell slot row is one of its feature charges.
    const slot = spend.spellCastConsumption
    for (const feature of [
      spend.featureResourceConsumption,
      slot?.owner.kind === 'CREATURE'
        ? {
            ownerActorId: slot.owner.actorId,
            ownerFeatureId: slot.owner.featureId,
            slotRowId: slot.slotKey,
            beforeUsed: slot.beforeUsed,
            afterUsed: slot.afterUsed
          }
        : null
    ]) {
      if (!feature) continue
      const owner = actorsById.get(feature.ownerActorId)
      if (!owner) revertUnavailable(FEATURE_CHARGES_CHANGED)
      updateActor(owner.id, { resources: returnSpentFeatureCharge(owner, feature).resources })
    }
    // The allowance and Attack action the source spent, and the commander's on a delegated attack.
    const returnEconomy = (
      actorId: string,
      {
        actionEconomyTransition: economy,
        attackActionTransition: attackAction
      }: Pick<typeof spend, 'actionEconomyTransition' | 'attackActionTransition'>
    ) => {
      const owner = actorsById.get(actorId)
      if (!owner) throw new Error('Stored Encounter action actors are unavailable.')
      if (economy) {
        if (encounterRuleUsageUsed(owner, economy.definitionId) !== economy.afterUsed)
          revertUnavailable(
            "The actor's action economy changed after this action; adjust manually."
          )
        updateActor(actorId, {
          resources: withEncounterRuleUsageUsed(owner, economy.definitionId, economy.beforeUsed)
        })
      }
      if (attackAction) {
        const restored = revertEncounterAttackActionTransition(
          actorsById.get(actorId)!,
          attackAction
        )
        if (!restored)
          revertUnavailable("The actor's Attack action changed after this action; adjust manually.")
        updateActor(actorId, { resources: restored.resources })
      }
    }
    returnEconomy(source.id, spend)
    const delegated = batch?.delegatingActorSpend
    if (delegated) returnEconomy(delegated.actorId, delegated)
    // Each mark this action armed or engaged goes back to what it was; an actor engaged earlier stays so.
    for (const { actorId, before } of root.idleTurnMarkChanges) {
      const marked = actorsById.get(actorId)
      if (marked)
        updateActor(actorId, { resources: withEncounterActorIdleTurnMark(marked, before) })
    }
    // The creature that countered the cast, and each that failed to, spent its own slot and reaction.
    const invertReactorSpend = (
      spend: Pick<
        CounteredRoot['counter'],
        | 'reaction'
        | 'spellCastConsumption'
        | 'applications'
        | 'characterStreamVersion'
        | 'actionEconomyTransition'
      >
    ) => {
      const reactor = actorsById.get(spend.reaction.reactorActorId)
      if (reactor?.kind !== 'CHARACTER')
        throw new Error('Stored Encounter action actors are unavailable.')
      if (spend.spellCastConsumption) {
        if (spend.characterStreamVersion === null)
          throw new Error('Stored reactor Character version is missing.')
        characterInverse(reactor.sourceId, spend.characterStreamVersion).spells.push(
          spend.spellCastConsumption
        )
      }
      restoreReleasedConditions(
        reactor,
        endedConditionReleases(spend.applications),
        spend.characterStreamVersion
      )
      const reaction = spend.actionEconomyTransition
      if (encounterRuleUsageUsed(reactor, reaction.definitionId) !== reaction.afterUsed)
        revertUnavailable(
          "The reacting creature's reactions changed after this action; adjust manually."
        )
      updateActor(reactor.id, {
        resources: withEncounterRuleUsageUsed(reactor, reaction.definitionId, reaction.beforeUsed)
      })
    }
    if (lostRoot && 'counter' in lostRoot) invertReactorSpend(lostRoot.counter)
    for (const failed of root.failedCounters) invertReactorSpend(failed)

    // A Dash's speed bonus leaves the turn's movement record.
    if (root.speedBonusTurn)
      await removeTurnSpeedBonus(ctx, {
        encounterId: state.id,
        ...root.speedBonusTurn,
        actorId: source.id
      })
    // A teleport cast's allowance leaves the record unless a move already spent it (undo that move first).
    if (root.teleportAllowanceTurn)
      await removeTurnTeleportAllowance(ctx, {
        encounterId: state.id,
        ...root.teleportAllowanceTurn,
        actorId: source.id,
        castCommandId: root.commandId
      })
    // D139: the creatures the action pushed or pulled return, last move first; a token moved since refuses.
    if (root.forcedMovements.length) {
      if (!ctx.ports.restoreActionForcedMovements)
        revertUnavailable('This action moved creatures on the Scene; adjust manually.')
      await ctx.ports.restoreActionForcedMovements({
        encounterId: state.id,
        commandId: root.commandId,
        movements: root.forcedMovements
      })
    }
    // The creatures the action conjured leave the Scene and the Run with it (D187b).
    if (root.summonedTokens.length) {
      const actorIds = root.summonedTokens.map(({ actorId }) => actorId)
      revertedState = await removeConjuredActors(ctx, {
        state: revertedState,
        commandId: input.commandId,
        actorIds
      })
      conjuredActorIds.push(...actorIds)
    }
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
    await restoreEndedMaintainedStates(ctx, root.endedMaintainedStates)
    await restoreConsumedGrants(ctx, root.consumedGrants)
  }
  for (const plan of plans) await invertRoot(plan)
  const updatedAt = new Date().toISOString()
  for (const [characterId, inverse] of characterInverses)
    await restoreCharacter(ctx, {
      characterId,
      inverse,
      userId,
      ownerUserId: campaign.ownerUserId,
      updatedAt,
      gameSystemId: state.gameSystemId
    })

  // The damage this command dealt leaves the record; what a start-of-turn trigger cleared returns.
  for (const actor of actors) {
    const current = actorsById.get(actor.id)!
    if (current.kind === 'CHARACTER') continue
    actorsById.set(
      actor.id,
      revertDamageTypesTaken(current, {
        commandId: root.commandId,
        cleared:
          root.clearedDamageTypes?.actorId === actor.id ? root.clearedDamageTypes.entries : []
      })
    )
  }

  const kept = actors.filter(({ id }) => !conjuredActorIds.includes(id))
  return commitRevert(ctx, {
    run,
    state: revertedState,
    campaign,
    input,
    fingerprint,
    userId,
    root,
    actors: kept,
    nextActors: kept.map((actor) => actorsById.get(actor.id)!),
    updatedAt
  })
}

type RevertGroup = {
  root: Extract<StoredCommand, { commandType: 'RESOLVE_ACTION' }>
  ruleOccurrenceId: string
  /** The answers committed after the root; each must settle one of the root's own children. */
  laterEntries: readonly StoredCommand[]
  /** The receipts committed from this root's version until the next group's root. */
  receipts: readonly EncounterDocument<'encounterRuleReceipts'>[]
}

/** What one root's receipts say to invert, or a refusal naming what undo can't restore. */
function planRevertRoot({ root, ruleOccurrenceId, laterEntries, receipts }: RevertGroup) {
  const laterOccurrenceIds = new Set(
    laterEntries.map((entry) => {
      if (entry.commandType !== 'RESOLVE_RULE_OCCURRENCE')
        throw new Error('Stored Encounter command scan is invalid.')
      return entry.ruleOccurrenceId
    })
  )
  let batch: ActionBatch | null = null
  let areaRoot: AreaRoot | null = null
  let lostRoot: CounteredRoot | GatedRoot | null = null
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
      else if (
        outputs?.kind === 'ENCOUNTER_COUNTERED_CAST' ||
        outputs?.kind === 'ENCOUNTER_GATED_ACTION'
      )
        lostRoot = outputs
      else unsupported.add(outputs?.kind === 'CONTESTED_ACTION' ? 'a contest' : 'this action')
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
      outputs?.kind === 'CHECK_ACTION' &&
      outputs.source.kind === 'SPELL_CAST' &&
      outputs.source.castOccurrenceId === ruleOccurrenceId
    ) {
      // One of the cast's per-effect checks (D182): a success ended an effect with the conditions
      // only it held, which the receipt keeps as ids and which undo does not give back.
      childOccurrenceIds.add(receipt.occurrenceId)
      if (outputs.outcome === 'SUCCESS') unsupported.add('an effect a dispel ended')
      continue
    }
    if (
      (outputs?.kind !== 'DAMAGE_SAVE_CHECK' &&
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
    } else if (outputs.kind === 'DAMAGE_SAVE_CHECK') {
      // A failed Concentration save ended a maintained effect, and a made repeat save released a
      // turn effect; the receipt keeps the contents of neither. A massive-damage save only records.
      if (damageSaveCheckMutatesRun(outputs))
        unsupported.add(
          outputs.source === 'CONCENTRATION' ? 'lost Concentration' : 'a released effect'
        )
    } else if (outputs.outcome === 'APPLIED') cleaving.push(outputs)
  }
  if ([...laterOccurrenceIds].some((occurrenceId) => !childOccurrenceIds.has(occurrenceId)))
    revertUnavailable('Another decision changed the Encounter after this action; adjust manually.')
  if (!batch && !areaRoot && !lostRoot && !unsupported.size)
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
  // D170: the zone contacts a forced movement settled are kept on its landings and undo with the move.
  const zoneDamage = root.forcedMovementLandings.flatMap((landing) => landing.zoneDamage ?? [])
  if (root.forcedMovementLandings.some((landing) => landing.zoneUndoRefused))
    unsupported.add('the zones a forced movement set off')
  for (const action of targetBatches) {
    if (
      action.applications.some(
        (application) =>
          application.kind === 'CONDITION_REMOVE' &&
          application.applied &&
          application.sourceOperationKey !== ENDED_EFFECT_RELEASE_OPERATION_KEY
      )
    )
      unsupported.add('a removed condition')
    if (replacesMaintainedEffect(action.maintenanceTransition ?? null))
      unsupported.add('a replaced maintained effect')
  }
  // A Creature attacker's burns from the zones its melee hit set off restore with the hit (D153).
  const retaliation = batch?.meleeRetaliation?.executions ?? []
  if (
    retaliation.some(
      ({ candidate, applications }) =>
        candidate.target.kind !== 'ENCOUNTER_ACTOR' ||
        applications.some((application) => application.kind !== 'DAMAGE')
    )
  )
    unsupported.add('a melee attacker’s retaliation damage')
  // A zone-only cast's Concentration rides on the root.
  if (replacesMaintainedEffect(areaRoot?.maintenanceTransition ?? null))
    unsupported.add('a replaced maintained effect')
  const spend =
    areaRoot ??
    lostRoot ??
    (batch && {
      sourceActorId: batch.sourceActorId,
      sourceApplications: batch.sourceApplications,
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
    revertUnavailable(`Undo can't restore ${[...unsupported].join(', ')}; adjust manually.`)
  return {
    root,
    batch,
    areaRoot,
    lostRoot,
    cleaving,
    retaliation,
    targetBatches,
    zoneDamage,
    spend
  }
}

/**
 * Undoes the Run's last CHECK action exactly from its receipt: its allowance use, the Creature
 * feature charges it spent, the grants its check used up and a won check's outcome on its target
 * (D173). The roll stays on the record.
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
  if (!actor) revertUnavailable('The actor left the Encounter; adjust manually.')
  const restored = returnSpentFeatureCharge(
    returnSpentActionEconomy(actor, receipt.actionEconomy),
    receipt.featureResourceConsumption
  )
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
  else if (outputs && outputs.kind !== 'CHECK_ACTION')
    throw new Error('Stored basic action check receipt is invalid.')
  const nextActors = actors.map((entry) => (entry.id === actor.id ? restored : entry))
  const checkAction = outputs?.kind === 'CHECK_ACTION' ? outputs : null
  const outcome =
    checkAction?.stateTransition.kind === 'TARGET_OUTCOME' ? checkAction.stateTransition : null
  if (outcome?.forcedMovements.length)
    revertUnavailable("Undo can't move a pushed creature back; adjust manually.")
  const mechanics = outcome?.mechanics
  if (mechanics) {
    if (mechanics.applications.some(isEndedEffectRelease))
      revertUnavailable("Undo can't restore an effect this outcome ended; adjust manually.")
    const index = nextActors.findIndex((entry) => entry.id === checkAction!.targetActorId)
    if (index < 0) revertUnavailable('The target left the Encounter; adjust manually.')
    const inverted = invertTargetMechanics(state.gameSystemId, nextActors[index]!, mechanics)
    nextActors[index] = returnInterceptionCharges(inverted.actor, mechanics.applications)
    if (inverted.sheet)
      await restoreCharacter(ctx, {
        characterId: inverted.sheet.characterId,
        inverse: {
          ...characterInverseAt(inverted.sheet.streamVersion),
          hitPoints: inverted.sheet.hitPoints,
          removedConditionIds: inverted.sheet.removedConditionIds,
          interceptionCharges: interceptionChargesSpent(mechanics.applications)
        },
        userId: input.userId,
        ownerUserId: input.campaign.ownerUserId,
        updatedAt,
        gameSystemId: state.gameSystemId
      })
  }
  return commitRevert(ctx, { ...input, actors, nextActors, updatedAt })
}

const FEATURE_CHARGES_CHANGED =
  "The actor's feature charges changed after this action; adjust manually."

/**
 * Gives a Creature feature's spent charges, or the spell slot its cast spent, back, refusing if they
 * changed since.
 */
function returnSpentFeatureCharge(
  actor: EncounterRunActorState,
  feature: {
    ownerActorId: string
    ownerFeatureId: string
    /** The slot row a spell cast spent; its use is counted under the row, not the Feature. */
    slotRowId?: string
    beforeUsed: number
    afterUsed: number
  } | null
): EncounterRunActorState {
  if (!feature) return actor
  if (feature.ownerActorId !== actor.id)
    throw new Error('Stored feature charge receipt is invalid.')
  const chargeKey = feature.slotRowId ?? feature.ownerFeatureId
  if (featureChargeUsed(actor, chargeKey) !== feature.afterUsed)
    revertUnavailable(FEATURE_CHARGES_CHANGED)
  return encounterRunActorStateSchema.parse({
    ...actor,
    resources: withFeatureChargeUsed(actor, chargeKey, feature.beforeUsed)
  })
}

/** Gives a spent allowance back, refusing if the actor used it again since. */
function returnSpentActionEconomy(
  actor: EncounterRunActorState,
  economy: EncounterActionEconomyConsumption | null
): EncounterRunActorState {
  if (!economy) return actor
  if (encounterRuleUsageUsed(actor, economy.definitionId) !== economy.afterUsed)
    revertUnavailable("The actor's action economy changed after this action; adjust manually.")
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
  input: RevertScope & {
    root: Extract<StoredCommand, { commandType: 'ESCAPE' }>
    outputs: Awaited<ReturnType<typeof readCheckReceiptOutputs>>
  }
): Promise<EncounterCommandResultDto> {
  const { state, root, outputs } = input
  const { receipt } = root
  if (outputs.kind !== 'ESCAPE_CHECK') throw new Error('Stored escape check receipt is invalid.')
  if (outputs.outcome === 'ESCAPED')
    revertUnavailable("Undo can't restore an escaped grapple; adjust manually.")
  const actors = await readRunActors(ctx, state)
  const actor = actors.find((entry) => entry.id === receipt.actorId)
  if (!actor) revertUnavailable('The actor left the Encounter; adjust manually.')
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
      const owner = heldEffectOwner(state, actors, created.targetActorId)
      const effect = await store.findById(owner, created.activeEffectId)
      if (!effect || effect.version !== created.afterVersion)
        revertUnavailable('The concealment changed after this action; adjust manually.')
      await store.deleteCas({
        id: effect.id,
        owner,
        expectedVersion: effect.version,
        removal: 'REMOVED'
      })
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

/** Undoes the GM's environmental zone (MOVE-3.2): the zone leaves the Scene. */
async function revertPlaceZone(
  ctx: EncounterCharacterWriteTransaction,
  input: RevertScope & { root: Extract<StoredCommand, { commandType: 'PLACE_ZONE' }> }
): Promise<EncounterCommandResultDto> {
  const { state, root } = input
  await deletePlacedSpatialEffect(ctx, { encounterId: state.id, id: root.receipt.spatialEffectId })
  const actors = await readRunActors(ctx, state)
  return commitRevert(ctx, {
    ...input,
    actors,
    nextActors: [...actors],
    updatedAt: new Date().toISOString()
  })
}

/** Undoes the GM's creature rest, creature by creature (`revertCreatureRestActor`). */
async function revertCreatureRest(
  ctx: EncounterCharacterWriteTransaction,
  input: RevertScope & { root: Extract<StoredCommand, { commandType: 'CREATURE_REST' }> }
): Promise<EncounterCommandResultDto> {
  const { state, root } = input
  const actors = await readRunActors(ctx, state)
  const restored = new Map<string, EncounterRunActorState>()
  for (const { actorId, resets, armedEffectIds } of root.receipt.actors) {
    const actor = actors.find((entry) => entry.id === actorId)
    if (!actor) revertUnavailable('A creature left the Encounter; adjust manually.')
    restored.set(
      actorId,
      await revertCreatureRestActor(ctx, { encounterId: state.id, actor, resets, armedEffectIds })
    )
  }
  return commitRevert(ctx, {
    ...input,
    actors,
    nextActors: actors.map((entry) => restored.get(entry.id) ?? entry),
    updatedAt: new Date().toISOString()
  })
}

/**
 * Undoes a move of a held effect (D160): the effect leaves its new holder and returns to the old one
 * exactly as it was (same record, duration and maintained state), and the offer's activation goes
 * back, only while nothing touched the moved effect since.
 */
async function revertMoveHeldEffect(
  ctx: EncounterCharacterWriteTransaction,
  input: RevertScope & { root: Extract<StoredCommand, { commandType: 'MOVE_HELD_EFFECT' }> }
): Promise<EncounterCommandResultDto> {
  const { state, root } = input
  const { receipt } = root
  const actors = await readRunActors(ctx, state)
  const actor = actors.find((entry) => entry.id === receipt.actorId)
  if (!actor) revertUnavailable('The actor left the Encounter; adjust manually.')
  const store = createActiveRuleEffectStore(ctx)
  const toOwner = heldEffectOwner(state, actors, receipt.toActorId)
  const moved = await store.findById(toOwner, receipt.effectId)
  if (!moved || moved.version !== receipt.afterVersion)
    revertUnavailable('The effect changed after it was moved; adjust manually.')
  await store.deleteCas({
    id: moved.id,
    owner: toOwner,
    expectedVersion: moved.version,
    removal: 'REMOVED'
  })
  await store.create({
    id: receipt.before.id,
    owner: heldEffectOwner(state, actors, receipt.fromActorId),
    definition: receipt.before.definition,
    lifecycle: receipt.before.lifecycle,
    maintainedEffectStateId: receipt.before.maintainedEffectStateId,
    restoredFrom: receipt.before
  })
  const restored = returnSpentActionEconomy(actor, receipt.actionEconomy)
  return commitRevert(ctx, {
    ...input,
    actors,
    nextActors: actors.map((entry) => (entry.id === actor.id ? restored : entry)),
    updatedAt: new Date().toISOString()
  })
}

/**
 * Undoes a Change facing reaction (ATTACK-12): the token turns back and the reaction returns, only
 * while the token was not moved or turned since.
 */
async function revertChangeFacing(
  ctx: EncounterCharacterWriteTransaction,
  input: RevertScope & { root: Extract<StoredCommand, { commandType: 'CHANGE_FACING' }> }
): Promise<EncounterCommandResultDto> {
  const { state, root } = input
  const { receipt } = root
  const actors = await readRunActors(ctx, state)
  const actor = actors.find((entry) => entry.id === receipt.actorId)
  if (!actor) revertUnavailable('The actor left the Encounter; adjust manually.')
  if (!ctx.ports.restoreActionFacing)
    revertUnavailable('This action turned a token on the Scene; adjust manually.')
  await ctx.ports.restoreActionFacing({
    encounterId: state.id,
    commandId: root.commandId,
    sceneId: receipt.sceneId,
    sceneCommandId: receipt.sceneCommandId
  })
  const restored = returnSpentActionEconomy(actor, receipt.actionEconomy)
  return commitRevert(ctx, {
    ...input,
    actors,
    nextActors: actors.map((entry) => (entry.id === actor.id ? restored : entry)),
    updatedAt: new Date().toISOString()
  })
}

function heldEffectOwner(
  state: EncounterRunState,
  actors: readonly EncounterRunActorState[],
  holderActorId: string
) {
  const holder = actors.find((entry) => entry.id === holderActorId)
  if (!holder) revertUnavailable('The actor left the Encounter; adjust manually.')
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
  const owner = heldEffectOwner(state, actors, input.holderActorId)
  const effect = await store.findById(owner, input.activeEffectId)
  if (!effect || effect.version !== input.afterVersion)
    revertUnavailable('The concealment changed after this action; adjust manually.')
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
    /** The Campaign owner, who reads the restored conditions' definitions. */
    ownerUserId: string
    updatedAt: string
    gameSystemId: string
  }
) {
  const { inverse } = input
  const row = await ctx.ports.readCharacterRow(input.characterId)
  if (!row || row.status !== 'ACTIVE' || row.systemId !== input.gameSystemId)
    throw new Error('Encounter Character is unavailable.')
  if (row.play.streamVersion !== inverse.expectedStreamVersion)
    revertUnavailable(`${row.label}'s Sheet changed after this action; adjust manually.`)
  const character = ctx.ports.readCharacterRecord(row)
  let state = character.state
  // The fenced stream version proves the Sheet is exactly what this action left.
  if (inverse.hitPoints)
    state = {
      ...state,
      hitpoints: withCharacterTemporaryHitPoints(
        {
          ...state.hitpoints,
          current: inverse.hitPoints.currentHitPoints,
          deathSaves: inverse.hitPoints.deathSaves ?? state.hitpoints.deathSaves
        },
        targetTemporaryHitPoints(inverse.hitPoints)
      ),
      conditions: (state.conditions ?? []).filter(
        (condition) => !inverse.removedConditionIds.has(condition.conditionTypeId)
      )
    }
  if (inverse.healedFromCurrentHitPoints !== null)
    state = {
      ...state,
      hitpoints: { ...state.hitpoints, current: inverse.healedFromCurrentHitPoints }
    }
  if (inverse.restoredConditionIds.size)
    state = {
      ...state,
      conditions: [
        ...(state.conditions ?? []),
        ...[...inverse.restoredConditionIds].map((conditionTypeId) => ({ conditionTypeId }))
      ]
    }
  // Latest spend first: two spends of one slot restore to the earlier one's before-state last.
  for (const spell of inverse.spells.toReversed())
    state = updateSpellSlotUsage(
      { ...character, state },
      spell.slotKey,
      () => spell.beforeUsed
    ).state
  // The hand move undoes before the stow it followed, so the equipment retraces its checksums.
  // The receipt holds the equipment checksum, not the slot or the position: the one entry that
  // reproduces the checksum is the exact one that was unequipped.
  const reequip = (itemId: string, beforeStateChecksum: string) => {
    const { equipped } = state.equipment
    const restored = Array.from({ length: equipped.length + 1 }, (_, index) => index)
      .flatMap((index) =>
        EQUIPPED_SLOT_CODES.map((slot) => ({
          ...state.equipment,
          equipped: [...equipped.slice(0, index), { itemId, slot }, ...equipped.slice(index)]
        }))
      )
      .find((equipment) => checksumRuleDocument(equipment) === beforeStateChecksum)
    if (!restored)
      revertUnavailable(`${row.label}'s equipment can't be restored exactly; adjust manually.`)
    state = { ...state, equipment: restored }
  }
  const drawn = inverse.drawn
  if (drawn?.movement === 'THROW') {
    if (checksumRuleDocument(state.equipment) !== drawn.afterStateChecksum)
      revertUnavailable(`${row.label}'s equipment can't be restored exactly; adjust manually.`)
    reequip(drawn.itemInstanceId, drawn.beforeStateChecksum)
  } else if (drawn) {
    const equipment = {
      ...state.equipment,
      equipped: state.equipment.equipped.filter((entry) => entry.itemId !== drawn.itemInstanceId)
    }
    if (
      checksumRuleDocument(state.equipment) !== drawn.afterStateChecksum ||
      checksumRuleDocument(equipment) !== drawn.beforeStateChecksum
    )
      revertUnavailable(`${row.label}'s equipment can't be restored exactly; adjust manually.`)
    state = { ...state, equipment }
  }
  const unequipped = inverse.unequipped
  if (unequipped) reequip(unequipped.itemInstanceId, unequipped.beforeStateChecksum)
  const sheetState = ctx.ports.readCharacterSheetState(row)
  let restoredSheetState: typeof sheetState | null = null
  // Latest spend first, so each charge finds the usage its own spend left: the interceptions spent
  // during settlement, then the action's own charge.
  const charges = [...(inverse.resource ? [inverse.resource] : []), ...inverse.interceptionCharges]
  for (const charge of charges.toReversed()) {
    const base: typeof sheetState = restoredSheetState ?? sheetState
    const usage = base.resourceUsage.find(
      (entry) => createCharacterResourceOwnerKey(entry.owner) === charge.poolId
    )
    if (!usage || usage.used !== charge.afterUsed)
      revertUnavailable(`${row.label}'s resources changed after this action; adjust manually.`)
    restoredSheetState = {
      ...base,
      resourceUsage: base.resourceUsage.map((entry) =>
        entry === usage
          ? {
              ...entry,
              used: charge.beforeUsed,
              updatedBy: input.userId,
              updatedAt: input.updatedAt
            }
          : entry
      )
    }
  }
  const item = inverse.item
  if (item) {
    const base = restoredSheetState ?? sheetState
    // The item is given back by lowering its usage; the stored row never left the Sheet.
    if (
      base.itemUsage.find((usage) => usage.itemInstanceId === item.itemInstanceId)?.used !==
      item.afterUsed
    )
      revertUnavailable(`${row.label}'s items changed after this action; adjust manually.`)
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
  const degradation = inverse.degradation
  if (degradation) {
    const base = restoredSheetState ?? sheetState
    const usedNow =
      base.itemUsage.find((usage) => usage.itemInstanceId === degradation.itemInstanceId)?.used ?? 0
    if (
      base.itemDegradation.find((entry) => entry.itemInstanceId === degradation.itemInstanceId)
        ?.penalty !== degradation.afterPenalty ||
      usedNow !== degradation.afterUsed
    )
      revertUnavailable(`${row.label}'s items changed after this action; adjust manually.`)
    restoredSheetState = {
      ...base,
      itemDegradation: [
        ...base.itemDegradation.filter(
          (entry) => entry.itemInstanceId !== degradation.itemInstanceId
        ),
        ...(degradation.beforePenalty > 0
          ? [{ itemInstanceId: degradation.itemInstanceId, penalty: degradation.beforePenalty }]
          : [])
      ],
      itemUsage: [
        ...base.itemUsage.filter((usage) => usage.itemInstanceId !== degradation.itemInstanceId),
        ...(degradation.beforeUsed > 0
          ? [{ itemInstanceId: degradation.itemInstanceId, used: degradation.beforeUsed }]
          : [])
      ]
    }
  }
  state = await settleCharacterConditionMaximum(ctx, {
    characterId: input.characterId,
    systemId: row.systemId,
    before: character.state,
    state,
    maximumHitPoints: row.play.maximumHitPoints,
    ownerUserId: input.ownerUserId
  })
  await ctx.ports.writeCharacterRecord({
    current: row,
    fields: { streamVersion: row.play.streamVersion + 1, updatedAt: input.updatedAt },
    document: JSON.parse(JSON.stringify({ ...character, state })),
    ...(restoredSheetState ? { sheetState: restoredSheetState } : {})
  })
}
