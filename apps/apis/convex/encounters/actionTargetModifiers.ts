import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import {
  encounterActionTargetModifiersDtoSchema,
  getEncounterActionTargetModifiersInputDtoSchema,
  type EncounterActionTargetModifiersDto
} from '@artificer-toolkit/schema/api/encounterActionTargetModifiers'
import { readEncounterActionTargetModifiers } from '@artificer-toolkit/encounter-persistence/actionTargetModifierReads'
import { query } from '../lib/queries'
import { encounterTurnReadTransaction } from './turnReadPorts'
import { readMemberEncounter } from './readAccess'

const modifiersValidator: Validator<EncounterActionTargetModifiersDto, 'required', string> =
  zodToConvex<z.core.$ZodType<EncounterActionTargetModifiersDto>>(
    encounterActionTargetModifiersDtoSchema
  )

export const get = query({
  args: zodToConvexFields(getEncounterActionTargetModifiersInputDtoSchema.shape),
  returns: modifiersValidator,
  handler: async (ctx, args): Promise<EncounterActionTargetModifiersDto> => {
    const request = getEncounterActionTargetModifiersInputDtoSchema.parse(args)
    return readEncounterActionTargetModifiers(encounterTurnReadTransaction(ctx), {
      ...(await readMemberEncounter(ctx, request.encounterId)),
      request
    })
  }
})
