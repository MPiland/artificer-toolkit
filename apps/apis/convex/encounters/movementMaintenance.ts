import type {
  ActiveRuleEffectRecord,
  EncounterMaintainedEffectStateRecord
} from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ServerKernelRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { readCharacterRecord } from '../characters/documents'
import { type NativeMaintenanceProjection, type PreparedMaintenance } from './actionMaintenance'
import {
  projectEncounterMovementMaintenance,
  projectEncounterMovementConcentrationEnd,
  bindEncounterMovementMaintenancePending,
  requireEncounterMovementMaintenanceCurrentness
} from '@artificer-toolkit/rules-runtime/encounterMovementMaintenance'
import type { MovementTarget } from './movementTargets'
import type { prepareNativeConcentrationEnd } from './concentrationState'

type MovementMaintenanceProjectionInput = {
  createdEffects: readonly ActiveRuleEffectRecord[]
  targets: ReadonlyMap<string, MovementTarget>
  projection?: NativeMaintenanceProjection
  campaignId: string
  gameSystemId: string
  occurredAt: string
}

/** Carries exact slot, owner and condition changes into the next contact without publishing. */
export function projectNativeMovementMaintenance(
  input: MovementMaintenanceProjectionInput & {
    maintenance: PreparedMaintenance
    state: EncounterMaintainedEffectStateRecord
  }
) {
  return projectEncounterMovementMaintenance(input, readCharacterRecord)
}

/** Forecasts failed-save cleanup; an explicit empty slot prevents stale storage fallback. */
export function projectNativeMovementConcentrationEnd(
  input: Omit<MovementMaintenanceProjectionInput, 'createdEffects'> & {
    maintenance: Awaited<ReturnType<typeof prepareNativeConcentrationEnd>>
  }
) {
  return projectEncounterMovementConcentrationEnd(input, readCharacterRecord)
}

/** The native caller adds its preflight binding before the whole snapshot is stored and checksummed. */
export function bindNativeMovementMaintenancePending(
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto,
  maintenance: PreparedMaintenance | null
): ServerKernelRuleExecutionPendingSnapshotDto {
  return bindEncounterMovementMaintenancePending(snapshot, maintenance)
}

export function requireNativeMovementMaintenanceCurrentness(
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto,
  maintenance: PreparedMaintenance | null
) {
  requireEncounterMovementMaintenanceCurrentness(snapshot, maintenance)
}
