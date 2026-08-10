import {
  clearRollHistoryForUser,
  discardRollForUser,
  executeDiceConfiguration,
  getRollHistoryForUser,
  executeRollForUser
} from '@artificer-toolkit/functions'
import {
  executeDiceConfigurationInputDtoSchema,
  executeRollInputDtoSchema,
  rollHistoryResponseDtoSchema,
  rollRecordDtoSchema,
  rollResultDtoSchema
} from '@artificer-toolkit/schema/api/rolls'
import { withAuthenticatedDb } from './dbContext.js'

import {
  authenticatedProcedure,
  createTRPCRouter,
  idInputSchema,
  okResponseSchema
} from './procedures.js'

export const rollRouter = createTRPCRouter({
  executeConfiguration: authenticatedProcedure
    .input(executeDiceConfigurationInputDtoSchema)
    .output(rollResultDtoSchema)
    .mutation(({ input }) => executeDiceConfiguration(input)),

  clearHistory: authenticatedProcedure
    .output(okResponseSchema)
    .mutation(({ ctx }) =>
      withAuthenticatedDb(ctx, async (db, userId) => clearRollHistoryForUser(db, userId))
    ),

  discard: authenticatedProcedure
    .input(idInputSchema)
    .output(okResponseSchema)
    .mutation(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db, userId) => discardRollForUser(db, input.id, userId))
    ),

  execute: authenticatedProcedure
    .input(executeRollInputDtoSchema)
    .output(rollRecordDtoSchema)
    .mutation(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db, userId) => executeRollForUser(db, input, userId))
    ),

  history: authenticatedProcedure
    .output(rollHistoryResponseDtoSchema)
    .query(({ ctx }) =>
      withAuthenticatedDb(ctx, async (db, userId) => getRollHistoryForUser(db, userId))
    )
})
