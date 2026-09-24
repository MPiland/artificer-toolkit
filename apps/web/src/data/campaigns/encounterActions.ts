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

export function getCampaignEncounterActionChoices(input: GetEncounterActionChoicesInputDto | null) {
  return {
    ...convexQuery(
      getEncounterActionChoices,
      input ? getEncounterActionChoicesInputDtoSchema.parse(input) : 'skip'
    ),
    select: encounterActionChoicesResponseDtoSchema.parse
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
