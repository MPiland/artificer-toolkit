import type {
  EncounterCommandResultDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { MutationCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { executeNativeEncounterAction } from './actionCommands'
import { readNativeEncounterActionResponseAdmission } from './actionResumeAdmission'
/** Returns null only for occurrences owned by another native coordinator. */
export async function resumeNativeEncounterAction(
  ctx: MutationCtx,
  response: ResolveRuleOccurrenceInputDto,
  run: Doc<'encounterRuns'>,
  userId: string
): Promise<EncounterCommandResultDto | null> {
  const admission = await readNativeEncounterActionResponseAdmission(ctx, response, run, userId)
  if (!admission) return null
  if (admission.kind === 'REPLAY') return admission.result
  return executeNativeEncounterAction(ctx, admission.admission.input, userId, {
    occurrence: admission.occurrence,
    response,
    resolution: admission.resolution
  })
}
