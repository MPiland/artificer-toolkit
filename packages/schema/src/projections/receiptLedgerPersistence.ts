import { z, lazySchema } from '../zod.js'
import { projectionChecksumSchema } from './identity.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { JSON_PAYLOAD_CHUNK_MAX_BYTES } from '@artificer-toolkit/shared/jsonPayloadChunks'

/** Journal-page byte bound and Convex's per-transaction write ceiling bound packed history. */
export const RECEIPT_LEDGER_MAX_BYTES = 4 * 1024 * 1024
export const RECEIPT_LEDGER_MAX_ENTRIES = 16000
export const RECEIPT_LEDGER_MAX_PARTS = Math.ceil(
  RECEIPT_LEDGER_MAX_BYTES / JSON_PAYLOAD_CHUNK_MAX_BYTES
)

const nonnegativeInteger = lazySchema(() =>
  z.number().check(z.int()).check(z.nonnegative()).check(z.lte(Number.MAX_SAFE_INTEGER))
)
const positiveInteger = lazySchema(() =>
  z.number().check(z.int()).check(z.positive()).check(z.lte(Number.MAX_SAFE_INTEGER))
)

/** Counts include tombstoned slots so surviving receipt pointers keep their indexes. */
export const receiptLedgerPayloadMetadataSchema = lazySchema(() =>
  z.strictObject({
    entryCount: positiveInteger.check(z.lte(RECEIPT_LEDGER_MAX_ENTRIES)),
    byteLength: positiveInteger.check(z.lte(RECEIPT_LEDGER_MAX_BYTES)),
    checksum: projectionChecksumSchema,
    partCount: nonnegativeInteger.check(z.lte(RECEIPT_LEDGER_MAX_PARTS))
  })
)

/** Scalar-only storage metadata; evaluating the database schema loads no rules graph. */
export const receiptLedgerMetadataSchema = lazySchema(() =>
  z
    .extend(receiptLedgerPayloadMetadataSchema, {
      id: postgresUuidSchema,
      scope: z.enum(['CAMPAIGN', 'CHARACTER']),
      scopeId: postgresUuidSchema,
      epoch: z.nullable(postgresUuidSchema),
      checkpointId: z.nullable(postgresUuidSchema),
      createdAt: z.iso.datetime()
    })
    .check(
      z.superRefine((ledger, context) => {
        if ((ledger.epoch === null) !== (ledger.checkpointId === null))
          context.addIssue({ code: 'custom', message: 'Receipt ledger scope is invalid.' })
      })
    )
)

export const receiptLedgerPointerSchema = lazySchema(() =>
  z.strictObject({
    ledgerId: postgresUuidSchema,
    entryIndex: nonnegativeInteger,
    entryChecksum: projectionChecksumSchema
  })
)

export const receiptLedgerPartMetadataSchema = lazySchema(() =>
  z.strictObject({
    ledgerId: postgresUuidSchema,
    index: nonnegativeInteger.check(z.lt(RECEIPT_LEDGER_MAX_PARTS))
  })
)

/** Durable intent created with private state/reference deletion; payload removal follows later. */
export const characterReceiptPurgeJobSchema = lazySchema(() =>
  z.strictObject({
    characterId: postgresUuidSchema,
    ownerUserId: postgresUuidSchema,
    createdAt: z.iso.datetime()
  })
)

export const characterReceiptPurgeInputSchema = lazySchema(() =>
  z.strictObject({ characterId: postgresUuidSchema })
)

export type ReceiptLedgerPayloadMetadata = z.infer<typeof receiptLedgerPayloadMetadataSchema>
export type ReceiptLedgerMetadata = z.infer<typeof receiptLedgerMetadataSchema>
export type ReceiptLedgerPointer = z.infer<typeof receiptLedgerPointerSchema>
export type ReceiptLedgerPartMetadata = z.infer<typeof receiptLedgerPartMetadataSchema>
export type CharacterReceiptPurgeInput = z.infer<typeof characterReceiptPurgeInputSchema>

/** Convex validates these binary fields with v.bytes(); the shared codec checks their byte limits. */
export type ReceiptLedgerStoredRecord = ReceiptLedgerMetadata & { payload: ArrayBuffer | null }
export type ReceiptLedgerStoredPart = ReceiptLedgerPartMetadata & { bytes: ArrayBuffer }
export type ReceiptLedgerEncodedPayload = ReceiptLedgerPayloadMetadata & {
  payload: ArrayBuffer | null
  parts: ArrayBuffer[]
}
