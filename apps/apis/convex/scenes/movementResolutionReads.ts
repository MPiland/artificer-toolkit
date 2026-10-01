import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import type { z } from 'zod'
import type { resolveRuleOccurrenceInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { readMovementResponseResult as readSharedMovementResponseResult } from '@artificer-toolkit/encounter-persistence/movementResolutionReads'
import type { QueryCtx } from '../_generated/server'
import { encounterReadTransaction } from '../encounters/encounterPorts'

/** The published response's current-role result; never the private preparation. */
export async function readMovementResponseResult(
  ctx: QueryCtx,
  args: z.input<typeof resolveRuleOccurrenceInputDtoSchema>
): Promise<EncounterCommandResultDto> {
  return readSharedMovementResponseResult(encounterReadTransaction(ctx), args)
}
