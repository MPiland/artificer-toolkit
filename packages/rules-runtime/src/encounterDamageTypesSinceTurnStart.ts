import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { foldCharacterMechanicsApplications } from './encounterCharacterMechanicsBatch.js'

/** One damage type a creature took, and the command that dealt it. */
export type DamageTypeTaken = { damageTypeId: string; commandId: string }

/** The damage types an actor took since its last turn began; none for an actor that keeps no record. */
export function damageTypeIdsTaken(holder: EncounterRunActorState): string[] {
  return (
    'damageTypesSinceTurnStart' in holder ? (holder.damageTypesSinceTurnStart ?? []) : []
  ).map(({ damageTypeId }) => damageTypeId)
}

/**
 * The creature's damage-type record after `applications` landed under `commandId`: one entry per
 * damage type that dealt damage, deduplicated per command. The only place the record grows.
 */
export function withDamageTypesTaken<T extends { damageTypesSinceTurnStart?: DamageTypeTaken[] }>(
  holder: T,
  applications: ReturnType<typeof foldCharacterMechanicsApplications>['applications'],
  commandId: string
): T {
  const damageTypeIds = new Set(
    applications.flatMap((application) =>
      application.kind === 'DAMAGE' && application.resolvedAmount > 0
        ? [application.damageTypeId]
        : []
    )
  )
  if (!damageTypeIds.size) return holder
  return {
    ...holder,
    damageTypesSinceTurnStart: [
      ...(holder.damageTypesSinceTurnStart ?? []),
      ...[...damageTypeIds].map((damageTypeId) => ({ damageTypeId, commandId }))
    ]
  }
}

/** The record emptied by a start-of-turn trigger, and what it held so undo can restore it. */
export function clearDamageTypesTaken<T extends { damageTypesSinceTurnStart?: DamageTypeTaken[] }>(
  holder: T
): { holder: T; cleared: DamageTypeTaken[] } {
  const { damageTypesSinceTurnStart = [], ...rest } = holder
  return { holder: rest as T, cleared: damageTypesSinceTurnStart }
}

/** Undo of a command: drops what it dealt and puts back what it cleared, exactly. */
export function revertDamageTypesTaken<T extends { damageTypesSinceTurnStart?: DamageTypeTaken[] }>(
  holder: T,
  input: { commandId: string; cleared: readonly DamageTypeTaken[] }
): T {
  const { damageTypesSinceTurnStart = [], ...rest } = holder
  const restored = [
    ...input.cleared,
    ...damageTypesSinceTurnStart.filter(({ commandId }) => commandId !== input.commandId)
  ]
  return (restored.length ? { ...rest, damageTypesSinceTurnStart: restored } : rest) as T
}
