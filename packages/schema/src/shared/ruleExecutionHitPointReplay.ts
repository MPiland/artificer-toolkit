import {
  deathSavesAfterDamage,
  deathSavesAfterHealing,
  isCharacterDead,
  type CharacterDeathSaves
} from './characterDeathSaves.js'
import { resolveIncomingDamage } from './ruleExecutionMechanics.js'
import { temporaryHitPointsAfterGrant, temporaryHitPointsAfterLoss } from './temporaryHitPoints.js'

type HitPointReceipt = {
  requestedAmount: number
  resolvedAmount: number
  appliedAmount: number
  maximumHitPoints: number
  beforeCurrentHitPoints: number
  afterCurrentHitPoints: number
  beforeTemporaryHitPoints: number
  afterTemporaryHitPoints: number
} & (
  | { kind: 'HEAL' | 'HIT_POINT_LOSS' }
  | { kind: 'TEMPORARY_HIT_POINTS'; sourceActiveEffectId?: string | null | undefined }
  | ({
      kind: 'DAMAGE'
      critical: boolean
      interceptedBy?: string | undefined
    } & Parameters<typeof resolveIncomingDamage>[0])
)

/**
 * Replays a heal, temporary hit point, damage or hit-point-loss receipt over the target's temporary
 * hit point source and death saves: the issues it breaks and the state it leaves. Shared by the
 * Character and the Encounter actor receipt validators, which fold the same hit-point rules; the
 * caller checks the receipt's `before` values against its own chain first.
 */
export function replayHitPointReceipt(
  application: HitPointReceipt,
  state: { temporarySource: string | null; deathSaves: CharacterDeathSaves | null }
): { issues: string[]; temporarySource: string | null; deathSaves: CharacterDeathSaves | null } {
  const { temporarySource, deathSaves } = state
  if (application.kind === 'HEAL') {
    // A dead Character ignores healing (D96).
    const applied =
      deathSaves !== null && isCharacterDead(deathSaves)
        ? 0
        : Math.min(
            application.resolvedAmount,
            application.maximumHitPoints - application.beforeCurrentHitPoints
          )
    const valid =
      application.resolvedAmount === application.requestedAmount &&
      application.afterTemporaryHitPoints === application.beforeTemporaryHitPoints &&
      application.appliedAmount === applied &&
      application.afterCurrentHitPoints === application.beforeCurrentHitPoints + applied
    return {
      issues: valid ? [] : ['Heal receipt arithmetic is invalid.'],
      temporarySource,
      deathSaves: deathSaves && deathSavesAfterHealing({ deathSaves, appliedAmount: applied })
    }
  }
  if (application.kind === 'TEMPORARY_HIT_POINTS') {
    const granted = temporaryHitPointsAfterGrant(
      { amount: application.beforeTemporaryHitPoints, sourceEffectId: temporarySource },
      {
        amount: application.resolvedAmount,
        sourceEffectId: application.sourceActiveEffectId ?? null
      }
    )
    const valid =
      application.resolvedAmount === application.requestedAmount &&
      application.afterCurrentHitPoints === application.beforeCurrentHitPoints &&
      application.appliedAmount === granted.amount - application.beforeTemporaryHitPoints &&
      application.afterTemporaryHitPoints === granted.amount
    return {
      issues: valid ? [] : ['Temporary hit-point receipt arithmetic is invalid.'],
      temporarySource: granted.sourceEffectId,
      deathSaves
    }
  }
  // Hit points lost directly meet no defense, interception or death save failure.
  const damage = application.kind === 'DAMAGE' ? application : null
  const lost = damage ? resolveIncomingDamage(damage) : application.requestedAmount
  const temporaryLost = Math.min(application.beforeTemporaryHitPoints, lost)
  const currentLost = Math.min(application.beforeCurrentHitPoints, lost - temporaryLost)
  const intercepted = damage?.interceptedBy !== undefined
  // An interception leaves a lethal blow's target at a total above 0 (Death Ward).
  const expectedAfter = intercepted
    ? application.afterCurrentHitPoints
    : application.beforeCurrentHitPoints - currentLost
  const issues: string[] = []
  if (
    intercepted &&
    (application.beforeCurrentHitPoints - currentLost !== 0 ||
      application.beforeCurrentHitPoints < 1 ||
      application.afterCurrentHitPoints < 1 ||
      application.afterCurrentHitPoints > application.maximumHitPoints)
  )
    issues.push('Damage interception receipt is invalid.')
  if (
    application.resolvedAmount !== lost ||
    application.appliedAmount !==
      temporaryLost + application.beforeCurrentHitPoints - expectedAfter ||
    application.afterCurrentHitPoints !== expectedAfter ||
    application.afterTemporaryHitPoints !== application.beforeTemporaryHitPoints - temporaryLost
  )
    issues.push(`${damage ? 'Damage' : 'Hit-point loss'} receipt arithmetic is invalid.`)
  return {
    issues,
    temporarySource: temporaryHitPointsAfterLoss(
      { amount: application.beforeTemporaryHitPoints, sourceEffectId: temporarySource },
      temporaryLost
    ).sourceEffectId,
    deathSaves:
      damage && deathSaves !== null && !intercepted
        ? deathSavesAfterDamage({
            deathSaves,
            currentHitPoints: application.beforeCurrentHitPoints,
            maximumHitPoints: application.maximumHitPoints,
            dealt: lost - temporaryLost,
            critical: damage.critical
          })
        : deathSaves
  }
}
