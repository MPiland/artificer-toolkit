import { readCharacterRecord } from '../characters/documents'
import type { NativeMaintenanceProjection } from './actionMaintenance'
import { projectEncounterMovementConcentrationEnd } from '@artificer-toolkit/rules-runtime/encounterMovementMaintenance'
import type { MovementTarget } from './movementTargets'
import type { prepareNativeConcentrationEnd } from './concentrationState'

/** Forecasts failed-save cleanup; an explicit empty slot prevents stale storage fallback. */
export function projectNativeMovementConcentrationEnd(input: {
  targets: ReadonlyMap<string, MovementTarget>
  projection?: NativeMaintenanceProjection
  campaignId: string
  gameSystemId: string
  occurredAt: string
  maintenance: Awaited<ReturnType<typeof prepareNativeConcentrationEnd>>
}) {
  return projectEncounterMovementConcentrationEnd(input, readCharacterRecord)
}
