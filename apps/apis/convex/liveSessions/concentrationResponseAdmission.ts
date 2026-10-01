import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { QueryCtx } from '../_generated/server'
import { readLiveConcentrationResponseAdmission as readSharedConcentrationResponseAdmission } from '@artificer-toolkit/encounter-persistence/liveConcentrationResponseAdmission'
import { encounterReadTransaction } from '../encounters/encounterPorts'

type ConcentrationResponseScope = Omit<LiveSessionEncounterRulesInput, 'request'> & {
  concentrationResponse: ResolveRuleOccurrenceInputDto
}

/** Admits the exact pending child through the owning Convex read transaction. */
export function readLiveConcentrationResponseAdmission(
  ctx: QueryCtx,
  input: ConcentrationResponseScope
) {
  return readSharedConcentrationResponseAdmission(encounterReadTransaction(ctx), input)
}
