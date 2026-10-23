import {
  deathSavesAfterRevive,
  deathSavesAfterStabilize,
  isCharacterDying,
  isTargetDead,
  reviveRestoredHitPoints,
  type ReviveHitPoints,
  type CharacterDeathSaves
} from './characterDeathSaves.js'

type DeathStateReceipt =
  | { kind: 'STABILIZE'; applied: boolean }
  | {
      kind: 'REVIVE'
      applied: boolean
      hitPoints: ReviveHitPoints
      beforeCurrentHitPoints: number
      afterCurrentHitPoints: number
    }

/**
 * Replays a stabilize or revive receipt over the target's hit points and death saves: the issue it
 * breaks, if any, and the state it leaves. Shared by the Character and the Encounter actor receipt
 * validators, which fold the same death-state rules.
 */
export function replayDeathStateReceipt(
  application: DeathStateReceipt,
  state: { current: number; maximum: number; deathSaves: CharacterDeathSaves | null }
): { issue: string | null; current: number; deathSaves: CharacterDeathSaves | null } {
  const { current, maximum, deathSaves } = state
  if (application.kind === 'STABILIZE') {
    const dying = deathSaves !== null && isCharacterDying(deathSaves, current)
    return {
      issue:
        application.applied === dying
          ? null
          : 'Stabilize receipt must apply to a dying Character only.',
      current,
      deathSaves: deathSaves && deathSavesAfterStabilize({ deathSaves, currentHitPoints: current })
    }
  }
  const dead = isTargetDead({ currentHitPoints: current, deathSaves })
  const revivedTo = reviveRestoredHitPoints(application.hitPoints, maximum)
  const valid =
    application.beforeCurrentHitPoints === current &&
    application.applied === dead &&
    application.afterCurrentHitPoints === (dead ? revivedTo : current)
  return {
    issue: valid ? null : 'Revive receipt must restore a dead target only.',
    current: application.applied ? application.afterCurrentHitPoints : current,
    deathSaves: application.applied && deathSaves ? deathSavesAfterRevive() : deathSaves
  }
}
