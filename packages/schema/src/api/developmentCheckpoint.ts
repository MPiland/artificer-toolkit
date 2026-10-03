import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { liveSessionCheckpointRequestSchema } from './liveSessionCheckpoint.js'
import { projectionChecksumSchema } from '../projections/identity.js'
import { receiptLedgerMetadataSchema } from '../projections/receiptLedgerPersistence.js'
import { liveSessionAuthorityDtoSchema } from './liveSessionState.js'

/** Exact reserved local fixture scope for native checkpoint transaction evidence. */
export const developmentCheckpointScopeSchema = lazySchema(() =>
  z.strictObject({
    ownerUserId: postgresUuidSchema,
    playerUserId: postgresUuidSchema,
    campaignId: postgresUuidSchema,
    characterId: postgresUuidSchema,
    encounterId: postgresUuidSchema
  })
)

export const developmentCheckpointRollbackInputSchema = lazySchema(() =>
  z.strictObject({
    scope: developmentCheckpointScopeSchema,
    checkpoint: liveSessionCheckpointRequestSchema,
    staged: z._default(z.boolean(), false)
  })
)

export const developmentCheckpointPreparationInputSchema = lazySchema(() =>
  z.extend(developmentCheckpointScopeSchema, { staged: z._default(z.boolean(), false) })
)
export const developmentCheckpointDiscardUploadInputSchema = lazySchema(() =>
  z.strictObject({ scope: developmentCheckpointScopeSchema, checkpointId: postgresUuidSchema })
)

export const DEVELOPMENT_CHECKPOINT_ROLLBACK_MARKER = 'CHECKPOINT_PROOF_ROLLBACK_AFTER_PUBLICATION'
export const developmentCheckpointInspectionSchema = lazySchema(() =>
  z.strictObject({
    digest: projectionChecksumSchema,
    authority: z.nullable(liveSessionAuthorityDtoSchema),
    runVersion: z.number().check(z.int()).check(z.nonnegative()),
    playStreamVersion: z.number().check(z.int()).check(z.nonnegative()),
    runChecksum: projectionChecksumSchema,
    playChecksum: projectionChecksumSchema,
    sharedHeaderCount: z.number().check(z.int()).check(z.nonnegative()),
    privateHeaderCount: z.number().check(z.int()).check(z.nonnegative()),
    stagedUploadCount: z.number().check(z.int()).check(z.nonnegative()),
    stagedPartCount: z.number().check(z.int()).check(z.nonnegative()),
    ledgers: z.array(receiptLedgerMetadataSchema)
  })
)

const documentCount = lazySchema(() => z.number().check(z.int()).check(z.nonnegative()))
/** One page of the load proof's per-document size read: one Encounter or Scene table at a time. */
export const developmentDocumentSizesInputSchema = lazySchema(() =>
  z.strictObject({
    encounterId: postgresUuidSchema,
    sceneId: postgresUuidSchema,
    position: documentCount,
    cursor: z.nullable(z.string())
  })
)
export const developmentDocumentSizesPageSchema = lazySchema(() =>
  z.strictObject({
    table: z.string(),
    documents: documentCount,
    /** UTF-8 bytes of each document's JSON as read, summed. */
    totalBytes: documentCount,
    maxBytes: documentCount,
    next: z.nullable(z.strictObject({ position: documentCount, cursor: z.nullable(z.string()) }))
  })
)
export type DevelopmentDocumentSizesInput = z.infer<typeof developmentDocumentSizesInputSchema>
export type DevelopmentDocumentSizesPage = z.infer<typeof developmentDocumentSizesPageSchema>
export type DevelopmentCheckpointScope = z.infer<typeof developmentCheckpointScopeSchema>
export type DevelopmentCheckpointInspection = z.infer<typeof developmentCheckpointInspectionSchema>
export type DevelopmentCheckpointRollbackInput = z.infer<
  typeof developmentCheckpointRollbackInputSchema
>
export type DevelopmentCheckpointPreparationInput = z.infer<
  typeof developmentCheckpointPreparationInputSchema
>
export type DevelopmentCheckpointDiscardUploadInput = z.infer<
  typeof developmentCheckpointDiscardUploadInputSchema
>
