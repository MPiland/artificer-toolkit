import { convexQuery } from '@convex-dev/react-query'
import type { ConvexReactClient } from 'convex/react'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  encounterActionChoicesResponseDtoSchema,
  encounterOptionalActionChoicesDtoSchema,
  getEncounterActionChoicesInputDtoSchema,
  getEncounterOptionalActionChoicesInputDtoSchema,
  type EncounterOptionalActionChoicesDto,
  type GetEncounterActionChoicesInputDto,
  type GetEncounterOptionalActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import {
  encounterDecisionSettlementDtoSchema,
  getEncounterDecisionSettlementInputDtoSchema,
  type GetEncounterDecisionSettlementInputDto
} from '@artificer-toolkit/schema/api/encounterData'

export function getCampaignEncounterActionChoices(input: GetEncounterActionChoicesInputDto | null) {
  return {
    ...convexQuery(
      api.encounters.actionChoices.get,
      input ? getEncounterActionChoicesInputDtoSchema.parse(input) : 'skip'
    ),
    select: encounterActionChoicesResponseDtoSchema.parse
  }
}

/** Who settled a decision the viewer was shown once it leaves `pending` (D39). */
export function getEncounterDecisionSettlement(
  input: GetEncounterDecisionSettlementInputDto | null
) {
  return {
    ...convexQuery(
      api.encounters.activeReads.decisionSettlement,
      input ? getEncounterDecisionSettlementInputDtoSchema.parse(input) : 'skip'
    ),
    select: encounterDecisionSettlementDtoSchema.parse
  }
}

export async function loadCampaignEncounterOptionalActionChoices(
  client: ConvexReactClient,
  input: GetEncounterOptionalActionChoicesInputDto
): Promise<EncounterOptionalActionChoicesDto> {
  return encounterOptionalActionChoicesDtoSchema.parse(
    await client.query(
      api.encounters.actionChoices.optional,
      getEncounterOptionalActionChoicesInputDtoSchema.parse(input)
    )
  )
}
