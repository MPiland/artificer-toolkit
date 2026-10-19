import { deriveEncounterCharacterMechanicsEventCommandId } from './encounterCharacterMechanicsBatch.js'
import type { EncounterCharacterMechanicsEventPhase } from './encounterCharacterMechanicsBatch.js'
import { featureChargeUsed, withFeatureChargeUsed } from './encounterActorState.js'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import type {
  CharacterEndedEffectReleaseApplication,
  CharacterRuleActionApplication
} from './characterRuleActionSystemAdapter.js'
import type { prepareEncounterActionMechanics } from './encounterActionMechanicsPreparation.js'
import { planEncounterMechanicsBatch } from './encounterMechanicsBatchPlan.js'
import { encounterStowedItemInstanceId } from './encounterWieldConflict.js'
import type {
  EncounterMechanicsBatchInput,
  EncounterMechanicsBatchPlan
} from './encounterMechanicsBatchPlan.js'
import type { CharacterMovementFacts } from './encounterMovementTargets.js'
import type { NativeCharacterSpellConsumption } from './character/characterNativeActionResources.js'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'

type ActionCharacterFacts = CharacterMovementFacts & {
  character: CharacterAuthored
  sheetState: CharacterSheetState
}

type PreparedActionMechanics = Awaited<
  ReturnType<typeof prepareEncounterActionMechanics<ActionCharacterFacts>>
>

export type NativeEncounterActionMechanicsInput = {
  prepared: PreparedActionMechanics
  encounterId: string
  expectedEncounterVersion: number
  occurrenceId: string
  sourceCommandId: string
  commandId: string
  occurredAt: string
  applications: readonly CharacterRuleActionApplication[]
  /**
   * The conditions the source's effects that ended on this action's event held alone
   * (`endedEffectReleases`), applied to the source in the same transaction as the
   * effects' deletion. An action that targets its own source applies them first on that one batch,
   * so the condition it releases is gone before the outcome adds its own.
   */
  sourceReleases?: readonly CharacterEndedEffectReleaseApplication[]
  /**
   * The conditions released for a reacting Character that is this action's target (a Shield cast
   * against the attack on its caster), applied first on the target's batch.
   */
  targetReleases?: readonly CharacterEndedEffectReleaseApplication[]
  /**
   * The conditions the target's effects that this action's damage ended held alone
   * (`targetEndedEffects`), applied to the target after the outcome in the same transaction as
   * the effects' deletion.
   */
  damageReleases?: readonly CharacterEndedEffectReleaseApplication[]
  forceTargetVersionAdvance?: boolean
  /** The item a hand of the target holds that it drops with this outcome (Heat Metal). */
  releaseTargetItemInstanceId?: string
  /** The form the target takes with this outcome (D130), when the action created the effect holding it. */
  enterForm?: EncounterMechanicsBatchInput['enterForm']
  eventPhases?: {
    resource: EncounterCharacterMechanicsEventPhase
    outcome: EncounterCharacterMechanicsEventPhase
  }
  ordinal?: number
  /**
   * The slots the source spends countering a Counterspell cast against this cast (D127), applied on the
   * source's one batch after the cast's own, so the Character advances once.
   */
  counterSpellConsumptions?: readonly NativeCharacterSpellConsumption[]
  /**
   * Whether this plan settles the source's one spend (resource, item, stow, feature charge) with the
   * outcome. An area action settles it once on its root, so each creature it catches plans with `NONE`.
   */
  sourceSpend?: SourceSpend
}

type SourceSpend = 'WITH_OUTCOME' | 'NONE'

/** What a Character's spell cast spent, recorded so a GM undo can restore the exact slot. */
export function characterSpellConsumptionReceipt(
  spellConsumption:
    | NonNullable<PreparedActionMechanics['characterActionState']>['spellConsumption']
    | undefined
) {
  return spellConsumption
    ? {
        characterId: spellConsumption.characterId,
        spellId: spellConsumption.spellId,
        candidateId: spellConsumption.candidateId,
        slotKey: spellConsumption.slotKey,
        beforeUsed: spellConsumption.beforeUsed,
        afterUsed: spellConsumption.afterUsed
      }
    : null
}

/** Uses the same event identities and batches for planning and publication. */
function prepareNativeActionMechanicsBatches(
  input: NativeEncounterActionMechanicsInput,
  spend: SourceSpend | 'ONLY' = input.sourceSpend ?? 'WITH_OUTCOME'
) {
  const { prepared } = input
  const { state, actor, target, source, sourceFacts, targetFacts } = prepared
  if (input.encounterId !== state.id || input.expectedEncounterVersion !== state.version)
    throw new Error('Encounter action settlement is stale.')
  const resourceConsumption =
    spend === 'NONE' ? undefined : prepared.characterActionState?.resourceConsumption
  const itemConsumption =
    spend === 'NONE' ? undefined : prepared.characterActionState?.itemConsumption
  const castConsumption = prepared.characterActionState?.spellConsumption
  const spellConsumptions =
    spend === 'NONE'
      ? []
      : [...(castConsumption ? [castConsumption] : []), ...(input.counterSpellConsumptions ?? [])]
  const stow = spend === 'NONE' ? undefined : prepared.acceptedWieldConflict
  const draw = spend === 'NONE' ? undefined : prepared.weaponDraw
  // The stow comes first in the batch, then the draw it freed a hand for.
  const equipmentMutation = {
    ...(stow ? { stowEquippedItemInstanceId: encounterStowedItemInstanceId(stow) } : {}),
    ...(draw?.kind === 'DRAW' ? { drawHeldItem: { itemId: draw.itemId, slot: draw.slot } } : {})
  }
  const sourceMutation = {
    ...(resourceConsumption ? { characterResourceConsumption: resourceConsumption } : {}),
    ...(itemConsumption ? { characterItemConsumption: itemConsumption } : {}),
    ...(spellConsumptions.length > 0 ? { characterSpellConsumptions: spellConsumptions } : {}),
    ...equipmentMutation
  }
  const sourceReleases = input.sourceReleases ?? []
  const onTargetBatch = actor.id === target.id && spend !== 'ONLY'
  // A Character's basic action spends nothing of its own but may stow a held weapon (D152).
  const sourceResourceBatch: EncounterMechanicsBatchInput | null =
    ((source.kind === 'CHARACTER_ACTION' &&
      (resourceConsumption || itemConsumption || spellConsumptions.length > 0)) ||
      stow ||
      draw?.kind === 'DRAW' ||
      sourceReleases.length) &&
    !onTargetBatch
      ? {
          encounterId: input.encounterId,
          targetActorId: actor.id,
          expectedEncounterVersion: input.expectedEncounterVersion,
          occurrenceId: input.occurrenceId,
          sourceCommandId: input.sourceCommandId,
          commandId: deriveEncounterCharacterMechanicsEventCommandId({
            occurrenceId: input.occurrenceId,
            sourceCommandId: input.sourceCommandId,
            phase: input.eventPhases?.resource ?? 'DIRECT_ACTION_RESOURCE',
            ordinal: input.ordinal ?? 0,
            targetCharacterId:
              source.kind === 'CHARACTER_ACTION'
                ? source.characterId
                : actor.kind === 'CHARACTER'
                  ? actor.sourceId
                  : actor.id
          }),
          occurredAt: input.occurredAt,
          applications: sourceReleases,
          expectedCharacterStreamVersion:
            source.kind === 'CHARACTER_ACTION'
              ? source.characterStreamVersion
              : (sourceFacts.characterFacts?.active.play.streamVersion ?? null),
          effectiveMaximumHitPoints: sourceFacts.effectiveMaximumHitPoints,
          sheetMaximumHitPoints: sourceFacts.sheetMaximumHitPoints,
          effectiveScalarValues: sourceFacts.effectiveScalarValues,
          forceVersionAdvance: false,
          ...sourceMutation
        }
      : null
  const targetBatch: EncounterMechanicsBatchInput = {
    encounterId: input.encounterId,
    targetActorId: target.id,
    expectedEncounterVersion: input.expectedEncounterVersion,
    occurrenceId: input.occurrenceId,
    sourceCommandId: input.sourceCommandId,
    commandId:
      target.kind === 'CHARACTER' && input.eventPhases
        ? deriveEncounterCharacterMechanicsEventCommandId({
            occurrenceId: input.occurrenceId,
            sourceCommandId: input.sourceCommandId,
            phase: input.eventPhases.outcome,
            ordinal: input.ordinal ?? 0,
            targetCharacterId: target.sourceId
          })
        : input.commandId,
    occurredAt: input.occurredAt,
    applications: [
      ...(onTargetBatch ? sourceReleases : []),
      ...(input.targetReleases ?? []),
      ...input.applications,
      ...(input.damageReleases ?? [])
    ],
    expectedCharacterStreamVersion: targetFacts.characterFacts?.active.play.streamVersion ?? null,
    effectiveMaximumHitPoints: targetFacts.effectiveMaximumHitPoints,
    sheetMaximumHitPoints: targetFacts.sheetMaximumHitPoints,
    effectiveScalarValues: targetFacts.effectiveScalarValues,
    forceVersionAdvance: input.forceTargetVersionAdvance ?? false,
    ...(input.enterForm ? { enterForm: input.enterForm } : {}),
    ...(input.releaseTargetItemInstanceId
      ? { releaseHeldItemInstanceId: input.releaseTargetItemInstanceId }
      : {}),
    ...(onTargetBatch
      ? source.kind === 'CHARACTER_ACTION'
        ? sourceMutation
        : equipmentMutation
      : {})
  }
  return { sourceResourceBatch, targetBatch }
}

type SettledMechanicsPlan = Pick<
  EncounterMechanicsBatchPlan,
  | 'updatedActor'
  | 'receiptApplications'
  | 'targetTransition'
  | 'characterStreamVersion'
  | 'itemUseStateTransition'
  | 'itemReleaseTransition'
  | 'itemDrawTransition'
>

/** The receipts of the source's one spend, read from what the action prepared. */
function nativeSourceSpendReceipts(prepared: NativeEncounterActionMechanicsInput['prepared']) {
  const { actor, source, resourceUse, featureResource, featureUsed, featureSpent } = prepared
  const resourceConsumption = prepared.characterActionState?.resourceConsumption
  const itemConsumption = prepared.characterActionState?.itemConsumption
  const spellConsumption = prepared.characterActionState?.spellConsumption
  const resourceReceipt = resourceConsumption
    ? {
        poolId: resourceConsumption.poolId,
        chargeId: resourceConsumption.chargeId,
        cost: resourceConsumption.cost,
        beforeUsed: resourceConsumption.beforeUsed,
        afterUsed: resourceConsumption.afterUsed,
        beforeRemaining: resourceConsumption.beforeRemaining,
        afterRemaining: resourceConsumption.afterRemaining
      }
    : null
  const itemConsumptionReceipt = itemConsumption
    ? {
        characterId: itemConsumption.characterId,
        itemInstanceId: itemConsumption.itemInstanceId,
        beforeUsed: itemConsumption.beforeUsed,
        afterUsed: itemConsumption.afterUsed,
        beforeQuantity: itemConsumption.beforeQuantity,
        afterQuantity: itemConsumption.afterQuantity
      }
    : null
  const spellConsumptionReceipt = characterSpellConsumptionReceipt(spellConsumption)
  const featureResourceReceipt =
    source.kind === 'CREATURE' &&
    resourceUse &&
    featureSpent > 0 &&
    featureResource?.remaining !== null &&
    featureResource?.remaining !== undefined
      ? {
          ownerActorId: actor.id,
          ownerFeatureId: source.capability.ownerFeatureId,
          chargeId: resourceUse.chargeId,
          cost: featureSpent,
          beforeUsed: featureUsed,
          afterUsed: featureUsed + featureSpent,
          beforeRemaining: featureResource.remaining,
          afterRemaining: featureResource.remaining - featureSpent
        }
      : null
  return {
    resourceReceipt,
    itemConsumptionReceipt,
    spellConsumptionReceipt,
    featureResourceReceipt
  }
}

/** A Creature source's feature charge the action spends, applied to the source as settled so far. */
function spendNativeSourceFeatureCharge(
  prepared: NativeEncounterActionMechanicsInput['prepared'],
  settledSource: NativeEncounterActionMechanicsInput['prepared']['actor']
) {
  const { source, resourceUse, featureUsed, featureSpent } = prepared
  if (source.kind !== 'CREATURE' || !resourceUse || featureSpent <= 0) return settledSource
  if (featureChargeUsed(settledSource, source.capability.ownerFeatureId) !== featureUsed)
    throw new Error('The selected Encounter feature action resource changed before settlement.')
  return encounterRunActorStateSchema.parse({
    ...settledSource,
    resources: withFeatureChargeUsed(
      settledSource,
      source.capability.ownerFeatureId,
      featureUsed + featureSpent
    )
  })
}

export function finishNativeActionMechanicsSettlement(
  prepared: NativeEncounterActionMechanicsInput['prepared'],
  mechanics: SettledMechanicsPlan,
  sourceResourceMechanics: SettledMechanicsPlan | null,
  spend: SourceSpend = 'WITH_OUTCOME'
) {
  const { actor, target, source } = prepared
  const spendsSource = spend === 'WITH_OUTCOME'
  const settledSourceApplications = sourceResourceMechanics?.receiptApplications ?? []
  const settledMechanicsSource =
    sourceResourceMechanics?.updatedActor ??
    (mechanics.updatedActor.id === actor.id ? mechanics.updatedActor : actor)
  const settledSource = spendsSource
    ? spendNativeSourceFeatureCharge(prepared, settledMechanicsSource)
    : settledMechanicsSource
  const spendsCharacter =
    spendsSource &&
    ((source.kind === 'CHARACTER_ACTION' &&
      (prepared.characterActionState?.resourceConsumption ||
        prepared.characterActionState?.itemConsumption ||
        prepared.characterActionState?.spellConsumption)) ||
      prepared.acceptedWieldConflict ||
      (source.kind === 'CHARACTER_ACTION' && prepared.weaponDraw.kind === 'DRAW')) &&
    actor.id !== target.id
  const sourceCharacterStreamVersion = spendsCharacter
    ? (sourceResourceMechanics?.characterStreamVersion ??
      (() => {
        throw new Error('The selected Character action resource was not committed.')
      })())
    : source.kind === 'CHARACTER_ACTION'
      ? (sourceResourceMechanics?.characterStreamVersion ?? null)
      : null
  const sourceItemUseStateTransition =
    spendsSource && prepared.acceptedWieldConflict
      ? ((actor.id === target.id ? mechanics : sourceResourceMechanics)?.itemUseStateTransition ??
        (() => {
          throw new Error('The accepted stow was not committed.')
        })())
      : null
  const sourceItemDraw =
    spendsSource && prepared.weaponDraw.kind === 'DRAW'
      ? ((actor.id === target.id ? mechanics : sourceResourceMechanics)?.itemDrawTransition ??
        (() => {
          throw new Error('The weapon draw was not committed.')
        })())
      : null
  return {
    mechanics,
    settledSource,
    sourceResourceMechanics,
    sourceCharacterStreamVersion,
    sourceItemUseStateTransition,
    sourceItemDraw,
    targetItemUseStateTransition: mechanics.itemReleaseTransition,
    sourceApplications: settledSourceApplications,
    ...(spendsSource
      ? nativeSourceSpendReceipts(prepared)
      : {
          resourceReceipt: null,
          itemConsumptionReceipt: null,
          spellConsumptionReceipt: null,
          featureResourceReceipt: null
        })
  }
}

/** Computes resource and outcome changes without publishing either one. */
export function planNativeEncounterActionMechanics(
  input: NativeEncounterActionMechanicsInput,
  userId: string
) {
  const { sourceResourceBatch, targetBatch } = prepareNativeActionMechanicsBatches(input)
  const { prepared } = input
  const sourceResourcePlan = sourceResourceBatch
    ? planEncounterMechanicsBatch({
        batch: sourceResourceBatch,
        actor: prepared.actor,
        userId,
        ...(prepared.sourceFacts.characterFacts
          ? { characterFacts: prepared.sourceFacts.characterFacts }
          : {})
      })
    : null
  const targetPlan = planEncounterMechanicsBatch({
    batch: targetBatch,
    actor: prepared.target,
    userId,
    ...(prepared.targetFacts.characterFacts
      ? { characterFacts: prepared.targetFacts.characterFacts }
      : {})
  })
  return {
    ...finishNativeActionMechanicsSettlement(
      prepared,
      targetPlan,
      sourceResourcePlan,
      input.sourceSpend
    ),
    sourceResourcePlan,
    targetPlan
  }
}

/**
 * The source's one spend of an area action, settled alone: the Character's resource, item or stow
 * through its own batch, and a Creature's feature charge. A Disarm uses it for the conditions its
 * initiator's attack roll releases and an area cast the conditions its caster's cast ends, which it
 * carries without any spend. Each creature the area catches then plans
 * its outcome with no spend of its own, so the spend lands exactly once even when the source is caught.
 */
export function planNativeEncounterAreaSourceSpend(
  input: Omit<NativeEncounterActionMechanicsInput, 'applications' | 'sourceSpend'>,
  userId: string
) {
  const { prepared } = input
  const { sourceResourceBatch } = prepareNativeActionMechanicsBatches(
    { ...input, applications: [] },
    'ONLY'
  )
  const sourceResourcePlan = sourceResourceBatch
    ? planEncounterMechanicsBatch({
        batch: sourceResourceBatch,
        actor: prepared.actor,
        userId,
        ...(prepared.sourceFacts.characterFacts
          ? { characterFacts: prepared.sourceFacts.characterFacts }
          : {})
      })
    : null
  if (prepared.acceptedWieldConflict && !sourceResourcePlan?.itemUseStateTransition)
    throw new Error('The accepted stow was not committed.')
  if (prepared.weaponDraw.kind === 'DRAW' && !sourceResourcePlan?.itemDrawTransition)
    throw new Error('The weapon draw was not committed.')
  return {
    sourceResourcePlan,
    settledSource: spendNativeSourceFeatureCharge(
      prepared,
      sourceResourcePlan?.updatedActor ?? prepared.actor
    ),
    sourceCharacterStreamVersion: sourceResourcePlan?.characterStreamVersion ?? null,
    sourceItemUseStateTransition: sourceResourcePlan?.itemUseStateTransition ?? null,
    sourceItemDraw: sourceResourcePlan?.itemDrawTransition ?? null,
    sourceApplications: sourceResourcePlan?.receiptApplications ?? [],
    ...nativeSourceSpendReceipts(prepared)
  }
}
