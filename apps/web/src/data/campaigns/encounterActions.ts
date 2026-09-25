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
  encounterEvidenceRollDtoSchema,
  type EncounterEvidenceRollDto
} from '@artificer-toolkit/schema/api/encounters'

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
const getLatestEvidenceRolls = makeFunctionReference<
  'query',
  { encounterId: string },
  EncounterEvidenceRollDto[]
>('encounters/evidenceRolls:latest')

export function getCampaignEncounterActionChoices(input: GetEncounterActionChoicesInputDto | null) {
  return {
    ...convexQuery(
      getEncounterActionChoices,
      input ? getEncounterActionChoicesInputDtoSchema.parse(input) : 'skip'
    ),
    select: encounterActionChoicesResponseDtoSchema.parse
  }
}

/** The viewer's latest "Roll dice" attempt for their current pending request, if any. */
export function getEncounterLatestEvidenceRoll(encounterId: string | null) {
  return {
    ...convexQuery(getLatestEvidenceRolls, encounterId ? { encounterId } : 'skip'),
    select: ([latest]: EncounterEvidenceRollDto[]) =>
      latest ? encounterEvidenceRollDtoSchema.parse(latest) : null
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
