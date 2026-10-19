import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import {
  encounterActionChoicesResponseDtoSchema,
  encounterActionItemChoicesDtoSchema,
  encounterOptionalActionChoicesDtoSchema,
  getEncounterActionChoicesInputDtoSchema,
  getEncounterActionItemChoicesInputDtoSchema,
  getEncounterOptionalActionChoicesInputDtoSchema,
  type EncounterActionChoicesResponseDto,
  type EncounterActionItemChoicesDto,
  type EncounterOptionalActionChoicesDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import {
  readEncounterActionChoices,
  readEncounterActionItemChoices,
  readEncounterOptionalActionChoices
} from '@artificer-toolkit/encounter-persistence/actionChoiceReads'
import { query } from '../lib/queries'
import { encounterTurnReadTransaction } from './turnReadPorts'
import { readMemberEncounter } from './readAccess'

const choicesValidator: Validator<EncounterActionChoicesResponseDto, 'required', string> =
  zodToConvex<z.core.$ZodType<EncounterActionChoicesResponseDto>>(
    encounterActionChoicesResponseDtoSchema
  )
const optionalChoicesValidator: Validator<EncounterOptionalActionChoicesDto, 'required', string> =
  zodToConvex<z.core.$ZodType<EncounterOptionalActionChoicesDto>>(
    encounterOptionalActionChoicesDtoSchema
  )

export const get = query({
  args: zodToConvexFields(getEncounterActionChoicesInputDtoSchema.shape),
  returns: choicesValidator,
  handler: async (ctx, args): Promise<EncounterActionChoicesResponseDto> => {
    const request = getEncounterActionChoicesInputDtoSchema.parse(args)
    return readEncounterActionChoices(encounterTurnReadTransaction(ctx), {
      ...(await readMemberEncounter(ctx, request.encounterId)),
      request
    })
  }
})

const itemChoicesValidator: Validator<EncounterActionItemChoicesDto, 'required', string> =
  zodToConvex<z.core.$ZodType<EncounterActionItemChoicesDto>>(encounterActionItemChoicesDtoSchema)

export const items = query({
  args: zodToConvexFields(getEncounterActionItemChoicesInputDtoSchema.shape),
  returns: itemChoicesValidator,
  handler: async (ctx, args): Promise<EncounterActionItemChoicesDto> => {
    const request = getEncounterActionItemChoicesInputDtoSchema.parse(args)
    return readEncounterActionItemChoices(encounterTurnReadTransaction(ctx), {
      ...(await readMemberEncounter(ctx, request.encounterId)),
      request
    })
  }
})

export const optional = query({
  args: zodToConvexFields(getEncounterOptionalActionChoicesInputDtoSchema.shape),
  returns: optionalChoicesValidator,
  handler: async (ctx, args): Promise<EncounterOptionalActionChoicesDto> => {
    const request = getEncounterOptionalActionChoicesInputDtoSchema.parse(args)
    return readEncounterOptionalActionChoices(encounterTurnReadTransaction(ctx), {
      ...(await readMemberEncounter(ctx, request.encounterId)),
      request
    })
  }
})
