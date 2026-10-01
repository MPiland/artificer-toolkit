import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { SceneStoredGeometrySave } from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import {
  readResponse as readSharedResponse,
  readMovementResponseAuthority as readSharedMovementResponseAuthority,
  assertMovementResolutionCurrent as assertSharedMovementResolutionCurrent,
  type Geometry
} from '@artificer-toolkit/encounter-persistence/movementResolutionDocuments'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { readGeometrySave } from './geometryDocuments'
import { encounterReadTransaction } from '../encounters/encounterPorts'

export type { Geometry } from '@artificer-toolkit/encounter-persistence/movementResolutionDocuments'

export async function readResponse(ctx: MutationCtx, saveId: string, geometry: Geometry) {
  return readSharedResponse(encounterReadTransaction(ctx), saveId, geometry, (id) =>
    readGeometrySave(ctx, id)
  )
}

/** Response authority belongs to the issued decision, independently of the movement initiator. */
export async function readMovementResponseAuthority(
  ctx: QueryCtx,
  command: ResolveRuleOccurrenceInputDto
) {
  return readSharedMovementResponseAuthority(encounterReadTransaction(ctx), command)
}

/** Recheck the frozen response after Node geometry work and before any gameplay writes. */
export async function assertMovementResolutionCurrent(
  ctx: QueryCtx,
  save: SceneStoredGeometrySave
) {
  return assertSharedMovementResolutionCurrent(encounterReadTransaction(ctx), save)
}
