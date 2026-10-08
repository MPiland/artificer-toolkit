import { z, lazySchema } from '../zod.js'
import { accountDeleteInputSchema } from './account.js'
import {
  developmentAccountDeletionInspectInputSchema,
  developmentAccountDeletionKnownSchema
} from './developmentAccountDeletion.js'

export const developmentAccountDeletionRollbackFixtureSchema = lazySchema(() =>
  z.strictObject({
    auditorUserId: developmentAccountDeletionInspectInputSchema.shape.auditorUserId,
    subjectUserId: developmentAccountDeletionInspectInputSchema.shape.subjectUserId,
    authUserId: developmentAccountDeletionInspectInputSchema.shape.authUserId,
    email: developmentAccountDeletionInspectInputSchema.shape.email,
    known: z.optional(developmentAccountDeletionKnownSchema)
  })
)
export const developmentAccountDeletionRollbackInputSchema = lazySchema(() =>
  z.strictObject({
    fixture: developmentAccountDeletionRollbackFixtureSchema,
    sessionToken: z.string().check(z.minLength(1)),
    command: accountDeleteInputSchema
  })
)
export const developmentAccountDeletionRollbackResultSchema = lazySchema(() =>
  z.strictObject({
    rolledBack: z.literal(true)
  })
)
export type DevelopmentAccountDeletionRollbackFixture = z.output<
  typeof developmentAccountDeletionRollbackFixtureSchema
>
export type DevelopmentAccountDeletionRollbackInput = z.output<
  typeof developmentAccountDeletionRollbackInputSchema
>
export type DevelopmentAccountDeletionRollbackResult = z.output<
  typeof developmentAccountDeletionRollbackResultSchema
>
