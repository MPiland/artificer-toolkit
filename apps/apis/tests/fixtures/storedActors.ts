import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { readActorSnapshot } from '@artificer-toolkit/encounter-persistence/actorSnapshots'
import type { EncounterDocument } from '@artificer-toolkit/encounter-persistence/store'
import { composeRunActorState } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import type { QueryCtx } from '../../convex/_generated/server'
import { createConvexEncounterStoreReader } from '../../convex/lib/convexEncounterStore'

/** An actor row's full actor: its stored play state joined with the snapshot row it names. */
export async function readTestActor(ctx: QueryCtx, row: EncounterDocument<'encounterRunActors'>) {
  return composeRunActorState(
    readStoredRunActor(row),
    await readActorSnapshot(
      { db: createConvexEncounterStoreReader(ctx) },
      row.encounterId,
      row.snapshotChecksum
    )
  )
}
