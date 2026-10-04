import { convexQuery } from '@convex-dev/react-query'
import { makeFunctionReference } from 'convex/server'
import type { ConvexReactClient } from 'convex/react'
import {
  encounterActionChoicesResponseDtoSchema,
  encounterOptionalActionChoicesDtoSchema,
  getEncounterActionChoicesInputDtoSchema,
  getEncounterOptionalActionChoicesInputDtoSchema,
  type EncounterActionChoicesResponseDto,
  type EncounterOptionalActionChoicesDto,
  type GetEncounterActionChoicesInputDto,
  type GetEncounterOptionalActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import {
  encounterDecisionSettlementDtoSchema,
  getEncounterDecisionSettlementInputDtoSchema,
  type EncounterDecisionSettlementDto,
  type GetEncounterDecisionSettlementInputDto
} from '@artificer-toolkit/schema/api/encounterData'

const getEncounterActionChoices = makeFunctionReference<
  'query',
  GetEncounterActionChoicesInputDto,
  EncounterActionChoicesResponseDto
>('encounters/actionChoices:get')
const getEncounterOptionalActionChoices = makeFunctionReference<
  'query',
  GetEncounterOptionalActionChoicesInputDto,
  EncounterOptionalActionChoicesDto
>('encounters/actionChoices:optional')
const getDecisionSettlement = makeFunctionReference<
  'query',
  GetEncounterDecisionSettlementInputDto,
  EncounterDecisionSettlementDto
>('encounters/activeReads:decisionSettlement')

export function getCampaignEncounterActionChoices(input: GetEncounterActionChoicesInputDto | null) {
  return {
    ...convexQuery(
      getEncounterActionChoices,
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
      getDecisionSettlement,
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
      getEncounterOptionalActionChoices,
      getEncounterOptionalActionChoicesInputDtoSchema.parse(input)
    )
  )
}
