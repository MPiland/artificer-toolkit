import { checksumRunActorPlayState } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import {
  consequenceRollDamageFacts,
  offerConsequenceRolls,
  withDeathSaveFacts
} from '@artificer-toolkit/rules-runtime/encounterConsequenceRolls'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { effectiveHitPointMaximum } from '@artificer-toolkit/rules-runtime/character/activeEffectGrantTotals'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import type {
  ReceiptApplications,
  TargetState
} from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { readRunActor, readRunState, writeRunActor } from './documents.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { z } from 'zod'
import type {
  EncounterMechanicsBatchInput,
  EncounterMechanicsBatchPlan
} from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import {
  settleCharacterConditionMaximum,
  settleCreatureConditionMaximum
} from './conditionMaximumSettlement.js'
import { rejectDomain } from './domainRejections.js'
import { ensureEncounterSpellPins } from './spellPins.js'
import { engageIdleTurnActor } from './idleTurnMark.js'
import {
  deleteGrants,
  endGrantsOnHitPointsRegained,
  spendEffectUses
} from './consumedGrantPersistence.js'
import { createActiveRuleEffectStore, listActiveRuleEffects } from './effectStore.js'
import type { EncounterCharacterRow } from './characterPlay.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'

export type EncounterMechanicsBatchResult = {
  updatedActor: Awaited<ReturnType<typeof readRunActor>>
  receiptApplications: ReceiptApplications
  targetTransition: {
    checksum: string
    before: TargetState
    after: TargetState
  }
  characterStreamVersion: number | null
  itemUseStateTransition: EncounterMechanicsBatchPlan['itemUseStateTransition']
  /** The item the target dropped (`releaseHeldItemInstanceId`); null when it dropped none. */
  itemReleaseTransition: EncounterMechanicsBatchPlan['itemReleaseTransition']
  /** The weapon the actor drew or threw (`drawHeldItem`, `throwHeldItem`); null when it moved none. */
  itemDrawTransition: EncounterMechanicsBatchPlan['itemDrawTransition']
  /** The worn item the outcome corroded (`degradeItem`); null when it corroded none. */
  itemDegradationTransition: EncounterMechanicsBatchPlan['itemDegradationTransition']
  /** The "until healed" grants a heal in this batch ended: the action's undo gives them back. */
  endedGrants: ActiveRuleEffectRecord[]
}

function validateInput(input: EncounterMechanicsBatchInput): EncounterMechanicsBatchInput {
  const [encounterId, targetActorId, occurrenceId, sourceCommandId, commandId] = [
    input.encounterId,
    input.targetActorId,
    input.occurrenceId,
    input.sourceCommandId,
    input.commandId
  ].map((id) => postgresUuidSchema.parse(id))
  if (!Number.isSafeInteger(input.expectedEncounterVersion) || input.expectedEncounterVersion < 0)
    throw new Error('Encounter version is invalid.')
  if (!Number.isSafeInteger(input.effectiveMaximumHitPoints) || input.effectiveMaximumHitPoints < 0)
    throw new Error('Effective maximum hit points are invalid.')
  if (
    input.expectedCharacterStreamVersion !== null &&
    (!Number.isSafeInteger(input.expectedCharacterStreamVersion) ||
      input.expectedCharacterStreamVersion < 0)
  )
    throw new Error('Expected Character stream version is invalid.')
  return {
    ...input,
    encounterId,
    targetActorId,
    occurrenceId,
    sourceCommandId,
    commandId,
    occurredAt: z.iso.datetime().parse(input.occurredAt)
  }
}

/** Authorizes current Run and actor state without evaluating Character rules. */
export async function readEncounterMechanicsBatchTarget<CharacterSources>(
  ctx: EncounterCharacterWriteTransaction<CharacterSources>,
  input: EncounterMechanicsBatchInput
) {
  input = validateInput(input)
  const { userId } = await ctx.ports.requireIdentity()
  const runRow = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', input.encounterId.toLowerCase()))
    .unique()
  if (!runRow) throw new Error('Encounter Run was not found.')
  const state = readRunState(runRow)
  const { campaign } = await ctx.ports.requireCampaignAuthority(state.campaignId, userId)
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  if (campaign.gameSystemId !== state.gameSystemId)
    throw new Error('Encounter Campaign System is stale.')
  if (state.version !== input.expectedEncounterVersion) rejectDomain('VERSION_STALE')

  const actor = await readRunActor(ctx, state, input.targetActorId.toLowerCase())
  const actorRow = await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_id', (query) => query.eq('encounterId', state.id).eq('id', actor.id))
    .unique()
  if (!actorRow) throw new Error('Encounter actor was not found.')
  // Rules evaluate a Character's effective maximum live; only Run-owned maxima are compared.
  if (
    actor.kind !== 'CHARACTER' &&
    effectiveHitPointMaximum(
      actor.maxHitPoints,
      await listActiveRuleEffects(
        ctx,
        { kind: 'ENCOUNTER_ACTOR', encounterId: state.id, targetActorId: actor.id },
        { ownerVerified: true }
      )
    ) !== input.effectiveMaximumHitPoints
  )
    throw new Error('Encounter actor maximum hit points are stale.')
  return { ctx, input, userId, runRow, state, campaign, actor, actorRow }
}

/** Regaining hit points, by a heal or a death save, ends the grants that last until they are regained. */
async function endGrantsOnRegain<CharacterSources>(
  ctx: EncounterCharacterWriteTransaction<CharacterSources>,
  target: Awaited<ReturnType<typeof readEncounterMechanicsBatchTarget>>,
  { before, after }: EncounterMechanicsBatchPlan['targetTransition']
) {
  return after.currentHitPoints > before.currentHitPoints
    ? endGrantsOnHitPointsRegained(ctx, turnEffectOwner(target.actor, target.state.id))
    : []
}

/**
 * Spends the effect-held damage interceptions the plan's receipt names (`DAMAGE.interceptedBy`, a
 * failed save that still spent its use, `KILL_NEGATED.negatedBy`): each spends one use of its holding
 * effect and the last use ends it. A feature-held one names a feature, not a held effect: its charge
 * is already in the plan's actor or Sheet. The plan was derived from these same held effects in this
 * transaction. The records come back as they were so an undoable root gives the uses back
 * (`restoreConsumedGrants`).
 */
async function spendDamageInterceptions<CharacterSources>(
  ctx: EncounterCharacterWriteTransaction<CharacterSources>,
  target: Awaited<ReturnType<typeof readEncounterMechanicsBatchTarget>>,
  receiptApplications: EncounterMechanicsBatchPlan['receiptApplications']
) {
  const namedIds = receiptApplications.flatMap((application) =>
    application.kind === 'DAMAGE'
      ? [
          ...(application.interceptionSaves ?? []).flatMap(({ effectId, spent }) =>
            spent ? [effectId] : []
          ),
          ...(application.interceptedBy === undefined ? [] : [application.interceptedBy])
        ]
      : application.kind === 'KILL_NEGATED'
        ? [application.negatedBy]
        : []
  )
  if (!namedIds.length) return []
  const held = await createActiveRuleEffectStore(ctx).list(
    turnEffectOwner(target.actor, target.state.id)
  )
  const spentEffectIds = namedIds.filter((id) => held.some((effect) => effect.id === id))
  const effects = held.filter(({ id }) => spentEffectIds.includes(id))
  for (const effect of effects) {
    const spent = spentEffectIds.filter((effectId) => effectId === effect.id).length
    if ((effect.lifecycle.remainingUses ?? 0) <= spent) await deleteGrants(ctx, [effect])
    else for (let use = 0; use < spent; use += 1) await spendEffectUses(ctx, [effect])
  }
  return effects
}

/**
 * Writes a trusted domain plan after current authority and exact aggregate checks. The caller
 * owns source/effect freshness and root command replay in the same transaction. This helper is
 * not a remote-plan authorization boundary and does not evaluate rules or rebuild Sheet facts.
 */
export async function persistEncounterMechanicsBatchPlan<CharacterSources>(
  ctx: EncounterCharacterWriteTransaction<CharacterSources>,
  target: Awaited<ReturnType<typeof readEncounterMechanicsBatchTarget>>,
  prepared: {
    actor: Awaited<ReturnType<typeof readRunActor>>
    character: EncounterCharacterRow | null
    plan: EncounterMechanicsBatchPlan
    /** Authored sources already loaded for this Character, reused to evaluate its written state. */
    sourceContext?: CharacterSources
  }
): Promise<EncounterMechanicsBatchResult> {
  if (target.ctx !== ctx)
    throw new Error('Encounter mechanics target belongs to another transaction.')
  const { input, actor, actorRow, campaign } = target
  const { plan, character } = prepared
  // Entering or leaving a Creature form (D130) swaps the actor's source; nothing else may.
  const formChanged =
    actor.kind !== 'CHARACTER' &&
    plan.updatedActor.kind !== 'CHARACTER' &&
    actor.form?.effectId !== plan.updatedActor.form?.effectId
  const { before, after } = plan.targetTransition
  // Damage engages an actor armed for an idle-bound grant (SRD Rage); every other actor is untouched.
  const engagedActor =
    after.currentHitPoints < before.currentHitPoints ||
    after.temporaryHitPoints < before.temporaryHitPoints
      ? engageIdleTurnActor(plan.updatedActor)
      : plan.updatedActor
  // Every automated outcome settles here, so its consequence roll offers do too (ATTACK-15); a
  // manual hit point change never reaches this seam and offers nothing.
  const damageFacts = consequenceRollDamageFacts([
    { targetActorId: actor.id, applications: plan.receiptApplications }
  ])
  const [offered] = offerConsequenceRolls({
    state: target.state,
    actors: [engagedActor],
    facts: input.deathSave
      ? withDeathSaveFacts(damageFacts, { actorId: actor.id, ...input.deathSave })
      : damageFacts,
    sourceCommandId: input.sourceCommandId,
    occurredAt: input.occurredAt
  })
  const updatedActor = offered?.after ?? engagedActor
  const [currentRun, currentActor] = await Promise.all([
    ctx.db.get(target.runRow._id),
    ctx.db.get(actorRow._id)
  ])
  if (
    !currentRun ||
    currentRun.version !== input.expectedEncounterVersion ||
    currentRun.stateChecksum !== target.runRow.stateChecksum
  )
    rejectDomain('VERSION_STALE')
  if (
    checksumCanonicalJson(prepared.actor) !== checksumCanonicalJson(actor) ||
    !currentActor ||
    currentActor.stateChecksum !== actorRow.stateChecksum ||
    currentActor.stateJson !== actorRow.stateJson ||
    plan.updatedActor.id !== actor.id ||
    plan.updatedActor.encounterId !== actor.encounterId ||
    plan.updatedActor.systemId !== actor.systemId ||
    plan.updatedActor.kind !== actor.kind ||
    (!formChanged && plan.updatedActor.sourceId !== actor.sourceId)
  )
    throw new Error('Encounter mechanics target changed before settlement.')
  if (actor.kind !== 'CHARACTER') {
    if (
      character ||
      plan.characterUpdate ||
      plan.characterStreamVersion !== null ||
      plan.itemUseStateTransition ||
      plan.itemDrawTransition?.kind === 'CHARACTER_ITEM_DRAW'
    )
      throw new Error('Encounter non-Character plan contains Character state.')
    // A system-less actor is an ad hoc one: it names no authored Spells.
    if (formChanged && actor.systemId)
      await ensureEncounterSpellPins(ctx, ctx.ports.readEncounterSource, {
        encounterId: actor.encounterId,
        userId: target.userId,
        systemId: actor.systemId,
        snapshots: [updatedActor.snapshot]
      })
    const settledActor = await settleCreatureConditionMaximum(ctx, {
      before: actor,
      actor: updatedActor,
      ownerUserId: campaign.ownerUserId,
      gameSystemId: target.state.gameSystemId
    })
    if (plan.stateChanged || settledActor !== plan.updatedActor)
      await writeRunActor(ctx, actorRow._id, settledActor)
    return {
      updatedActor: settledActor,
      receiptApplications: plan.receiptApplications,
      targetTransition: plan.targetTransition,
      characterStreamVersion: null,
      itemUseStateTransition: null,
      itemReleaseTransition: plan.itemReleaseTransition,
      itemDrawTransition: plan.itemDrawTransition,
      itemDegradationTransition: null,
      endedGrants: [
        ...(await spendDamageInterceptions(ctx, target, plan.receiptApplications)),
        ...(await endGrantsOnRegain(ctx, target, plan.targetTransition))
      ]
    }
  }
  if (
    !character ||
    character.id !== actor.sourceId ||
    character.systemId !== actor.systemId ||
    character.status !== 'ACTIVE'
  )
    throw new Error('Encounter Character source is unavailable.')
  if (character.play.streamVersion !== input.expectedCharacterStreamVersion)
    throw new Error('Encounter Character changed after the outcome was planned.')
  const { assignment } = await ctx.ports.requireCampaignCharacterAuthority(
    campaign.id,
    character.id,
    campaign.ownerUserId
  )
  const currentCharacter = await ctx.ports.readCharacterRow(character.id)
  if (
    !currentCharacter ||
    assignment.userId !== character.userId ||
    checksumCanonicalJson(currentCharacter) !== checksumCanonicalJson(character)
  )
    throw new Error('Encounter Character changed before settlement.')
  if (
    plan.shouldAdvance !== (plan.characterUpdate !== null) ||
    plan.characterStreamVersion !==
      (plan.shouldAdvance ? character.play.streamVersion + 1 : null) ||
    (plan.itemUseStateTransition &&
      (!plan.shouldAdvance ||
        plan.itemUseStateTransition.characterId !== character.id ||
        plan.itemUseStateTransition.beforeStreamVersion !== character.play.streamVersion)) ||
    (plan.itemDrawTransition &&
      (!plan.shouldAdvance ||
        plan.itemDrawTransition.kind !== 'CHARACTER_ITEM_DRAW' ||
        plan.itemDrawTransition.characterId !== character.id ||
        plan.itemDrawTransition.beforeStreamVersion !== character.play.streamVersion)) ||
    (plan.characterUpdate &&
      (plan.characterUpdate.character.id !== character.id ||
        plan.characterUpdate.character.systemId !== character.systemId ||
        plan.characterUpdate.character.userId !== character.userId))
  )
    throw new Error('Encounter Character plan is invalid.')
  if (plan.characterUpdate) {
    const characterStreamVersion = plan.characterStreamVersion
    if (characterStreamVersion === null) throw new Error('Encounter Character plan is invalid.')
    const { character: planned } = plan.characterUpdate
    const state = await settleCharacterConditionMaximum(ctx, {
      characterId: character.id,
      systemId: character.systemId,
      before: ctx.ports.readCharacterRecord(character).state,
      state: planned.state,
      maximumHitPoints: character.play.maximumHitPoints,
      ownerUserId: campaign.ownerUserId
    })
    await ctx.ports.writeCharacterRecord({
      current: character,
      fields: { streamVersion: characterStreamVersion, updatedAt: input.occurredAt },
      document: JSON.parse(JSON.stringify({ ...planned, state })),
      ...(plan.characterUpdate.sheetState ? { sheetState: plan.characterUpdate.sheetState } : {}),
      sourceContext: prepared.sourceContext
    })
  }
  if (checksumRunActorPlayState(updatedActor) !== actorRow.stateChecksum)
    await writeRunActor(ctx, actorRow._id, updatedActor)
  return {
    updatedActor,
    receiptApplications: plan.receiptApplications,
    targetTransition: plan.targetTransition,
    characterStreamVersion: plan.characterStreamVersion,
    itemUseStateTransition: plan.itemUseStateTransition,
    itemReleaseTransition: plan.itemReleaseTransition,
    itemDrawTransition: plan.itemDrawTransition,
    itemDegradationTransition: plan.itemDegradationTransition,
    endedGrants: [
      ...(await spendDamageInterceptions(ctx, target, plan.receiptApplications)),
      ...(await endGrantsOnRegain(ctx, target, plan.targetTransition))
    ]
  }
}
