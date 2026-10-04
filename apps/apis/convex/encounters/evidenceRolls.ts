import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import * as zMini from 'zod/mini'
import {
  encounterEvidenceRollDtoSchema,
  getEncounterInputDtoSchema,
  type EncounterEvidenceRollDto
} from '@artificer-toolkit/schema/api/encounterData'
import { readLatestEvidenceRolls } from '@artificer-toolkit/encounter-persistence/evidenceRolls'
import { query } from '../lib/queries'
import { encounterReadTransaction } from './encounterPorts'
import { readMemberEncounter } from './readAccess'

const latestRollsValidator: Validator<EncounterEvidenceRollDto[], 'required', string> = zodToConvex<
  z.core.$ZodType<EncounterEvidenceRollDto[]>
>(zMini.array(encounterEvidenceRollDtoSchema))

/** The caller's latest app roll for each request of their current pending decision. */
export const latest = query({
  args: zodToConvexFields(getEncounterInputDtoSchema.shape),
  returns: latestRollsValidator,
  handler: async (ctx, args): Promise<EncounterEvidenceRollDto[]> => {
    const { run, campaign, membership } = await readMemberEncounter(
      ctx,
      args.encounterId.toLowerCase()
    )
    return readLatestEvidenceRolls(encounterReadTransaction(ctx), { run, campaign, membership })
  }
})
