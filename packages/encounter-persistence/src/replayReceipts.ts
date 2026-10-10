import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import {
  encounterStoredReplayReceiptSchema,
  type EncounterStoredReplayReceipt
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readEncounterGmProjection } from './nativeProjection.js'
import type { EncounterReadTransaction } from './ports.js'

type StoredReplayReceipt = { replayReceiptJson: string; replayReceiptChecksum: string }

/** The replay receipt a command stores for its result: everything but the projection. */
export function encounterReplayReceipt(
  result: Pick<EncounterCommandResultDto, 'roll' | 'occurrence'>
): StoredReplayReceipt {
  const receipt = encounterStoredReplayReceiptSchema.parse({
    roll: result.roll,
    occurrence: result.occurrence
  })
  return {
    replayReceiptJson: JSON.stringify(receipt),
    replayReceiptChecksum: checksumCanonicalJson(receipt)
  }
}

export function readEncounterReplayReceipt(
  stored: StoredReplayReceipt
): EncounterStoredReplayReceipt {
  const receipt = encounterStoredReplayReceiptSchema.parse(JSON.parse(stored.replayReceiptJson))
  if (checksumCanonicalJson(receipt) !== stored.replayReceiptChecksum)
    throw new Error('Stored Encounter command receipt mismatch.')
  return receipt
}

/**
 * A settled command's result for exact replay: its receipt with the projection built from the Run's
 * records. While the Run is still at the command's version this is the result the command returned;
 * after later commands the projection is the Run's current one (ADR 0035 Amendment 12).
 */
export async function replayEncounterCommandResult(
  ctx: EncounterReadTransaction,
  state: EncounterRunState,
  stored: StoredReplayReceipt
): Promise<EncounterCommandResultDto> {
  return encounterCommandResultDtoSchema.parse({
    ...readEncounterReplayReceipt(stored),
    projection: await readEncounterGmProjection(ctx, state)
  })
}
