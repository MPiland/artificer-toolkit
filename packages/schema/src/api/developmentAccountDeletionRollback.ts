import { z } from '../zod.js'
import { accountDeleteInputSchema } from './account.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  developmentAccountDeletionInspectInputSchema,
  developmentAccountDeletionKnownSchema
} from './developmentAccountDeletion.js'

export const developmentAccountDeletionRollbackFixtureSchema = z.strictObject({
  auditorUserId: developmentAccountDeletionInspectInputSchema.shape.auditorUserId,
  subjectUserId: developmentAccountDeletionInspectInputSchema.shape.subjectUserId,
  authUserId: developmentAccountDeletionInspectInputSchema.shape.authUserId,
  email: developmentAccountDeletionInspectInputSchema.shape.email,
  known: z.optional(developmentAccountDeletionKnownSchema)
})
export const developmentAccountDeletionRollbackInputSchema = z.strictObject({
  fixture: developmentAccountDeletionRollbackFixtureSchema,
  sessionToken: z.string().check(z.minLength(1)),
  command: accountDeleteInputSchema
})
const uniqueStrings = z
  .array(z.string().check(z.minLength(1)))
  .check(z.maxLength(256))
  .check(z.refine((value) => new Set(value).size === value.length, 'Scheduled IDs must be unique.'))
const copyJobIds = z
  .array(postgresUuidSchema)
  .check(z.maxLength(32))
  .check(z.refine((value) => new Set(value).size === value.length, 'Copy IDs must be unique.'))
export const developmentAccountDeletionSchedulerInputSchema = z.strictObject({
  fixture: developmentAccountDeletionRollbackFixtureSchema,
  known: developmentAccountDeletionKnownSchema,
  copyJobIds,
  scheduledIds: uniqueStrings
})
export const developmentAccountDeletionSchedulerResultSchema = z.strictObject({
  stateJson: z.string(),
  copyJobIds,
  scheduledIds: uniqueStrings
})
export const developmentAccountDeletionRollbackResultSchema = z.strictObject({
  rolledBack: z.literal(true)
})
export type DevelopmentAccountDeletionRollbackFixture = z.output<
  typeof developmentAccountDeletionRollbackFixtureSchema
>
export type DevelopmentAccountDeletionRollbackInput = z.output<
  typeof developmentAccountDeletionRollbackInputSchema
>
export type DevelopmentAccountDeletionSchedulerInput = z.output<
  typeof developmentAccountDeletionSchedulerInputSchema
>
export type DevelopmentAccountDeletionSchedulerResult = z.output<
  typeof developmentAccountDeletionSchedulerResultSchema
>
export type DevelopmentAccountDeletionRollbackResult = z.output<
  typeof developmentAccountDeletionRollbackResultSchema
>
