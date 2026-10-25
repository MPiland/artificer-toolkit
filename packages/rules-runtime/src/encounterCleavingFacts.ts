import type { ServerAggregateChoicePendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { rangeDtoSchema } from '@artificer-toolkit/schema/shared/range'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  lengthMeasurementInSceneUnits,
  measureSceneTokenFootprintDistance,
  type SceneGrid,
  type SceneToken
} from '@artificer-toolkit/shared/vtt'
import { withCreatureActiveGrantArmorClass } from './encounterActiveGrants.js'
import { snapshotStatBlock } from './encounterProjection.js'
import { deadCharacterIdsOfTargets, isEncounterActorDefeated } from './encounterActorDefeat.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import type { NativeEncounterActionSource } from './encounterActionSources.js'
import type { NativeCleavingCandidate } from './encounterCleavingChoice.js'
export type CleavingContext = Extract<
  ServerAggregateChoicePendingSnapshotDto['applicationContext'],
  { kind: 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING' }
>
type CompleteAction = Extract<StoredRuleExecutionResultDto, { status: 'COMPLETE' }>

/** A single finalized damage component is the only transferable action output. */
export function retainedCleavingDamage(result: CompleteAction) {
  const batch = result.applicationOutputs
  if (
    (batch.kind !== 'CHARACTER_MECHANICS_BATCH' &&
      batch.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH') ||
    !batch.d20 ||
    batch.nestedD20 !== null ||
    batch.applications.length !== 1 ||
    batch.activeEffectTransitions.length !== 0 ||
    batch.stateEffectTransitions.length !== 0
  )
    return null
  const application = batch.applications[0]
  if (!application || application.kind !== 'DAMAGE' || !cleavingCarriesOn(application)) return null
  return {
    initialTargetActorId: batch.targetActorId,
    originalAttack: { total: batch.d20.total, naturalRoll: batch.d20.selectedNatural },
    damage: cleavingDamageEnvelope({ ...application, targetActorId: batch.targetActorId })
  }
}

export function cleavingDamageEnvelope(application: {
  sourceNodeId: string
  sourceOperationKey: string
  damageTypeId: string
  requestedAmount: number
  resolvedAmount: number
  appliedAmount: number
  beforeCurrentHitPoints: number
  afterCurrentHitPoints: number
  beforeTemporaryHitPoints: number
  afterTemporaryHitPoints: number
  maximumHitPoints: number
  targetActorId: string
  damageDisposition: string
}): CleavingContext['damage'] {
  return {
    sourceNodeId: application.sourceNodeId,
    sourceOperationKey: application.sourceOperationKey,
    damageTypeId: application.damageTypeId,
    resolvedAmount: application.resolvedAmount,
    appliedAmount: application.appliedAmount,
    remainingAmount: application.resolvedAmount - application.appliedAmount,
    envelopeChecksum: checksumRuleDocument({
      schemaVersion: 1,
      sourceNodeId: application.sourceNodeId,
      sourceOperationKey: application.sourceOperationKey,
      damageTypeId: application.damageTypeId,
      requestedAmount: application.requestedAmount,
      resolvedAmount: application.resolvedAmount,
      appliedAmount: application.appliedAmount,
      beforeCurrentHitPoints: application.beforeCurrentHitPoints,
      afterCurrentHitPoints: application.afterCurrentHitPoints,
      beforeTemporaryHitPoints: application.beforeTemporaryHitPoints,
      afterTemporaryHitPoints: application.afterTemporaryHitPoints,
      maximumHitPoints: application.maximumHitPoints,
      targetActorId: application.targetActorId,
      damageDisposition: application.damageDisposition
    })
  }
}

/** The chosen Cleaving target takes the retained damage: temporary hit points first, as usual. */
export function cleavingDamageApplication(input: {
  damage: CleavingContext['damage']
  targetActorId: string
  before: { current: number; temporary: number; maximum: number }
}) {
  const { damage, before } = input
  const remaining = damage.remainingAmount
  const temporaryLost = Math.min(before.temporary, remaining)
  const currentLost = Math.min(before.current, remaining - temporaryLost)
  return {
    kind: 'DAMAGE' as const,
    targetActorId: input.targetActorId,
    sourceNodeId: damage.sourceNodeId,
    sourceOperationKey: damage.sourceOperationKey,
    damageTypeId: damage.damageTypeId,
    requestedAmount: remaining,
    resolvedAmount: remaining,
    appliedAmount: temporaryLost + currentLost,
    beforeCurrentHitPoints: before.current,
    afterCurrentHitPoints: before.current - currentLost,
    beforeTemporaryHitPoints: before.temporary,
    afterTemporaryHitPoints: before.temporary - temporaryLost,
    maximumHitPoints: before.maximum,
    damageDisposition: 'NORMAL' as const,
    incomingHalved: false,
    critical: false,
    authoredPath: null,
    resolvedPath: null
  }
}

/**
 * An undamaged target (full hit points; temporary hit points don't count as damage) reduced to 0
 * with damage to spare lets the attack carry on (overkill).
 */
export function cleavingCarriesOn(
  application: Pick<
    ReturnType<typeof cleavingDamageApplication>,
    | 'beforeCurrentHitPoints'
    | 'maximumHitPoints'
    | 'afterCurrentHitPoints'
    | 'resolvedAmount'
    | 'appliedAmount'
  >
) {
  return (
    application.beforeCurrentHitPoints === application.maximumHitPoints &&
    application.afterCurrentHitPoints === 0 &&
    application.resolvedAmount > application.appliedAmount
  )
}

export function nativeCleavingSourceCurrentness(
  target: MovementTarget,
  source?: NativeEncounterActionSource
): CleavingContext['sourceCurrentness'] {
  const actor = target.actor
  if (actor.kind === 'CHARACTER') {
    if (!target.characterFacts || !target.characterCurrentness)
      throw new Error('Cleaving Character source is unavailable.')
    return {
      kind: 'CHARACTER',
      actorId: actor.id,
      characterId: actor.sourceId,
      streamVersion: target.characterFacts.active.play.streamVersion,
      ...target.characterCurrentness
    }
  }
  if (source?.kind !== 'CREATURE') throw new Error('Cleaving Creature source is unavailable.')
  return {
    kind: 'ENCOUNTER_ACTOR',
    actorId: actor.id,
    sourceRevision: source.capability.sourceRevision,
    sourceVersionId: source.capability.sourceVersionId,
    sourceChecksum: source.capability.sourceChecksum,
    stateChecksum: checksumRuleDocument(actor)
  }
}

/**
 * The armor class an attack is judged against: a Character's derived value, or a Creature's
 * computed value with its held ARMOR_CLASS grants. Custom actors have none.
 */
export function cleavingTargetArmorClass(
  target: Pick<MovementTarget, 'actor' | 'activeEffects' | 'effectiveRulePolicyOutput'>
): number | null | undefined {
  return target.actor.kind === 'CHARACTER'
    ? target.effectiveRulePolicyOutput?.derivedStats.armorClass?.effective
    : withCreatureActiveGrantArmorClass(
        snapshotStatBlock(target.actor)?.armorClass ?? null,
        target.activeEffects
      )
}

/** Calculates one eligible target from captured actor facts and current Scene geometry. */
export function buildEncounterCleavingCandidate(input: {
  target: MovementTarget
  targetTokenId: string
  action: CleavingContext['action']
  scene: CleavingContext['scene']
  originalAttack: CleavingContext['originalAttack']
  geometry: {
    grid: SceneGrid
    sourceToken: Pick<SceneToken, 'position' | 'height' | 'width' | 'rotationDegrees'>
    targetToken: Pick<SceneToken, 'position' | 'height' | 'width' | 'rotationDegrees'> & {
      actorId: string
      tokenId: string
    }
  } | null
}): NativeCleavingCandidate | null {
  const { target, geometry } = input
  // Excess damage never carries into a defeated creature (D63).
  if (
    target.actor.kind === 'CUSTOM' ||
    isEncounterActorDefeated(target.actor, deadCharacterIdsOfTargets([target]))
  )
    return null
  const armorClass = cleavingTargetArmorClass(target)
  const targetActorVersion =
    target.actor.kind === 'CHARACTER'
      ? (target.characterFacts?.active.play.streamVersion ?? null)
      : target.actor.sourceRevision
  if (armorClass == null || targetActorVersion === null) return null
  const range = rangeDtoSchema.parse(input.action.range)
  if (range.rangeKind !== 'DISTANCE') return null
  if (!geometry || checksumRuleDocument(geometry.grid) !== input.scene.effectiveGridChecksum)
    throw new Error('Cleaving Scene is stale.')
  const reach = lengthMeasurementInSceneUnits(
    { amount: range.amount, unit: range.unit },
    geometry.grid
  )
  const { actorId: _actorId, ...footprint } = geometry.targetToken
  return {
    actorId: target.actor.id,
    targetTokenId: input.targetTokenId,
    targetActorVersion,
    targetStateChecksum: checksumRuleDocument(target.actor),
    armorClass,
    footprintChecksum: checksumRuleDocument(footprint),
    withinAttackerReach:
      measureSceneTokenFootprintDistance(
        geometry.grid,
        geometry.sourceToken,
        geometry.targetToken
      ) <= reach,
    originalAttackCanHit:
      input.originalAttack.naturalRoll === 20 ||
      (input.originalAttack.naturalRoll !== 1 && input.originalAttack.total >= armorClass)
  }
}
