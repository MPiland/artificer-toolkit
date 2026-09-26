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
import { snapshotStatBlock } from './encounterProjection.js'
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
  const { before, after } = batch.targetTransition
  if (
    !application ||
    application.kind !== 'DAMAGE' ||
    before.currentHitPoints !== before.maximumHitPoints ||
    before.temporaryHitPoints !== 0 ||
    after.currentHitPoints !== 0 ||
    application.resolvedAmount <= application.appliedAmount
  )
    return null
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
    authoredPath: null,
    resolvedPath: null
  }
}

/** An undamaged target reduced to 0 with damage to spare lets the attack carry on (overkill). */
export function cleavingCarriesOn(application: ReturnType<typeof cleavingDamageApplication>) {
  return (
    application.beforeCurrentHitPoints === application.maximumHitPoints &&
    application.beforeTemporaryHitPoints === 0 &&
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
      streamVersion: target.characterFacts.active.streamVersion,
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
  if (target.actor.kind === 'CUSTOM') return null
  const armorClass =
    target.actor.kind === 'CHARACTER'
      ? target.effectiveRulePolicyOutput?.derivedStats.armorClass?.effective
      : snapshotStatBlock(target.actor)?.armorClass
  const targetActorVersion =
    target.actor.kind === 'CHARACTER'
      ? (target.characterFacts?.active.streamVersion ?? null)
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
  if (reach === null) return null
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
