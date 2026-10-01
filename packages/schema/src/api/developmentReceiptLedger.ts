import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { authoredDraftListInputSchema, authoredDraftListPageSchema } from './authoredDrafts.js'
import { characterHistoryEntryDtoSchema, characterHistoryInputSchema } from './characterHistory.js'

export const developmentReceiptLedgerScopeSchema = lazySchema(() =>
  z.strictObject({
    userId: postgresUuidSchema,
    characterId: postgresUuidSchema
  })
)

export const developmentReceiptLedgerEntryInputSchema = lazySchema(() =>
  z.extend(developmentReceiptLedgerScopeSchema, {
    ordinal: z.number().check(z.int()).check(z.gte(0)).check(z.lte(3))
  })
)

export const developmentReceiptLedgerSeedInputSchema = lazySchema(() =>
  z.extend(developmentReceiptLedgerEntryInputSchema, { rollback: z.boolean() })
)

export const developmentReceiptLedgerPageInputSchema = lazySchema(() =>
  z.extend(developmentReceiptLedgerScopeSchema, {
    paginationOpts: authoredDraftListInputSchema.shape.paginationOpts
  })
)

export const developmentReceiptLedgerKeysetInputSchema = lazySchema(() =>
  z.extend(developmentReceiptLedgerScopeSchema, {
    paginationOpts: characterHistoryInputSchema.shape.paginationOpts
  })
)

export const developmentReceiptLedgerSeedResultSchema = lazySchema(() =>
  z.strictObject({
    ledgerId: postgresUuidSchema,
    commandId: postgresUuidSchema,
    eventId: postgresUuidSchema,
    byteLength: z.number().check(z.int()).check(z.positive())
  })
)

export const developmentReceiptLedgerInspectionSchema = lazySchema(() =>
  z.strictObject({
    headerExists: z.boolean(),
    ledgerExists: z.boolean(),
    partCount: z.number().check(z.int()).check(z.nonnegative())
  })
)

export const developmentReceiptLedgerRemovalSchema = lazySchema(() => z.null())

export const developmentReceiptLedgerRetirementInputSchema = lazySchema(() =>
  z.extend(developmentReceiptLedgerScopeSchema, {
    authUserId: z.string().check(z.minLength(1)).check(z.maxLength(128))
  })
)

export const developmentReceiptLedgerRetirementInspectionSchema = lazySchema(() =>
  z.strictObject({
    characterExists: z.boolean(),
    profileExists: z.boolean(),
    headerCount: z.number().check(z.int()).check(z.gte(0)).check(z.lte(100)),
    jobExists: z.boolean(),
    ledgerCount: z.number().check(z.int()).check(z.gte(0)).check(z.lte(3)),
    storagePresent: z.boolean()
  })
)

export const developmentReceiptLedgerNativePageSchema = lazySchema(() =>
  z.extend(authoredDraftListPageSchema, {
    characterId: postgresUuidSchema,
    page: z.array(characterHistoryEntryDtoSchema)
  })
)

/** Raw scalar headers only; diagnostic windows never load ledger bodies. */
export const developmentReceiptLedgerNativeWindowSchema = lazySchema(() =>
  z.extend(z.omit(authoredDraftListPageSchema, { page: true }), {
    headerIds: z.array(postgresUuidSchema)
  })
)

export type DevelopmentReceiptLedgerScope = z.infer<typeof developmentReceiptLedgerScopeSchema>
export type DevelopmentReceiptLedgerEntryInput = z.infer<
  typeof developmentReceiptLedgerEntryInputSchema
>
export type DevelopmentReceiptLedgerSeedInput = z.infer<
  typeof developmentReceiptLedgerSeedInputSchema
>
export type DevelopmentReceiptLedgerSeedResult = z.infer<
  typeof developmentReceiptLedgerSeedResultSchema
>
export type DevelopmentReceiptLedgerInspection = z.infer<
  typeof developmentReceiptLedgerInspectionSchema
>
