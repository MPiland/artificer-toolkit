import {
  activateRulePackRevision,
  getRulePackRevision,
  listRulePackRevisions,
  listRulePacks,
  retireRulePack,
  saveRulePackDraft,
  simulateRulePack
} from '@artificer-toolkit/functions'
import {
  activateRulePackRevisionInputDtoSchema,
  listRulePackRevisionsInputDtoSchema,
  retireRulePackInputDtoSchema,
  rulePackRevisionDtoSchema,
  rulePackSummaryDtoSchema,
  saveRulePackDraftInputDtoSchema,
  simulateRulePackInputDtoSchema,
  simulateRulePackResultDtoSchema
} from '@artificer-toolkit/schema/api/rules'
import { z } from 'zod'

import { withAuthenticatedDb } from './dbContext.js'
import { createTRPCRouter, okResponseSchema, superAdminProcedure } from './procedures.js'

const getRulePackRevisionInputSchema = z.strictObject({ revisionId: z.string().uuid() })

export const ruleRouter = createTRPCRouter({
  listPacks: superAdminProcedure
    .output(z.array(rulePackSummaryDtoSchema))
    .query(({ ctx }) =>
      withAuthenticatedDb(ctx, (db, userId, auth) => listRulePacks(db, userId, auth.isSuperAdmin))
    ),
  listRevisions: superAdminProcedure
    .input(listRulePackRevisionsInputDtoSchema)
    .output(z.array(rulePackRevisionDtoSchema))
    .query(({ ctx, input }) =>
      withAuthenticatedDb(ctx, (db, userId, auth) =>
        listRulePackRevisions(db, userId, auth.isSuperAdmin, input)
      )
    ),
  getRevision: superAdminProcedure
    .input(getRulePackRevisionInputSchema)
    .output(rulePackRevisionDtoSchema)
    .query(({ ctx, input }) =>
      withAuthenticatedDb(ctx, (db, userId, auth) =>
        getRulePackRevision(db, userId, auth.isSuperAdmin, input.revisionId)
      )
    ),
  saveDraft: superAdminProcedure
    .input(saveRulePackDraftInputDtoSchema)
    .output(rulePackRevisionDtoSchema)
    .mutation(({ ctx, input }) =>
      withAuthenticatedDb(ctx, (db, userId, auth) =>
        saveRulePackDraft(db, userId, auth.isSuperAdmin, input)
      )
    ),
  simulate: superAdminProcedure
    .input(simulateRulePackInputDtoSchema)
    .output(simulateRulePackResultDtoSchema)
    .mutation(({ ctx, input }) =>
      withAuthenticatedDb(ctx, (db, userId, auth) =>
        simulateRulePack(db, userId, auth.isSuperAdmin, input)
      )
    ),
  activate: superAdminProcedure
    .input(activateRulePackRevisionInputDtoSchema)
    .output(rulePackRevisionDtoSchema)
    .mutation(({ ctx, input }) =>
      withAuthenticatedDb(ctx, (db, userId, auth) =>
        activateRulePackRevision(db, userId, auth.isSuperAdmin, input)
      )
    ),
  retire: superAdminProcedure
    .input(retireRulePackInputDtoSchema)
    .output(okResponseSchema)
    .mutation(({ ctx, input }) =>
      withAuthenticatedDb(ctx, (db, userId, auth) =>
        retireRulePack(db, userId, auth.isSuperAdmin, input)
      )
    )
})
