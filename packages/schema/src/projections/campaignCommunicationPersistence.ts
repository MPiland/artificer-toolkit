import { z, lazySchema } from '../zod.js'
import { campaignAnnouncementDtoSchema } from '../api/campaignAnnouncements.js'
import { campaignChatEntryDtoSchema } from '../api/campaignCommunication.js'
import { timestampSchema, uuidSchema } from '../api/campaignContractSchemas.js'
import { projectionChecksumSchema } from './identity.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

export const campaignStoredConversationSchema = lazySchema(() =>
  z
    .strictObject({
      id: uuidSchema,
      campaignId: uuidSchema,
      kind: z.enum(['TABLE', 'PARTY', 'DIRECT']),
      participantUserIds: z.array(uuidSchema).check(z.maxLength(2)),
      createdAt: timestampSchema
    })
    .check(
      z.superRefine((room, context) => {
        if (
          room.kind === 'DIRECT'
            ? room.participantUserIds.length !== 2 || new Set(room.participantUserIds).size !== 2
            : room.participantUserIds.length !== 0
        )
          context.addIssue({ code: 'custom', message: 'Invalid conversation participants.' })
      })
    )
)

export const campaignStoredConversationMemberSchema = lazySchema(() =>
  z.strictObject({
    conversationId: uuidSchema,
    campaignId: uuidSchema,
    userId: uuidSchema,
    accessStartedAt: timestampSchema,
    lastReadAt: z.nullable(timestampSchema)
  })
)

export const campaignStoredAnnouncementSchema = lazySchema(() =>
  z.safeExtend(campaignAnnouncementDtoSchema, {
    commandId: uuidSchema,
    inputFingerprint: projectionChecksumSchema
  })
)

// Counts and retention read only these compact rows, not 500 message/roll payloads per room.
export const campaignStoredEntryIdentitySchema = lazySchema(() =>
  z.extend(
    z.pick(campaignChatEntryDtoSchema, {
      id: true,
      campaignId: true,
      conversationId: true,
      authorUserId: true,
      createdAt: true
    }),
    { clientNonce: uuidSchema }
  )
)

/** Compact nonce evidence is read without loading old roll/message bodies. */
export const campaignStoredEntryHeaderSchema = lazySchema(() =>
  z
    .extend(campaignStoredEntryIdentitySchema, {
      kind: campaignChatEntryDtoSchema.shape.kind,
      rollNonceFingerprint: z.nullable(projectionChecksumSchema)
    })
    .check(
      z.superRefine((header, context) => {
        if ((header.kind === 'ROLL') !== (header.rollNonceFingerprint !== null))
          context.addIssue({ code: 'custom', message: 'Invalid Campaign chat nonce evidence.' })
      })
    )
)

export const campaignStoredEntryPayloadSchema = lazySchema(() =>
  z
    .extend(
      z.pick(campaignChatEntryDtoSchema, {
        kind: true,
        mode: true,
        body: true,
        roll: true,
        revealedByGm: true,
        authorUsername: true,
        characterId: true,
        characterLabel: true,
        editedAt: true,
        unsentAt: true
      }),
      // Set once when rest settlement spends this roll; never part of the chat presentation.
      { entryId: uuidSchema, consumedAt: z.nullable(timestampSchema) }
    )
    .check(
      z.superRefine((entry, context) => {
        const valid =
          entry.kind === 'CHAT'
            ? entry.roll === null &&
              !entry.revealedByGm &&
              entry.consumedAt === null &&
              entry.mode !== null &&
              (entry.unsentAt === null) === (entry.body !== null)
            : entry.roll !== null &&
              entry.mode === null &&
              entry.body === null &&
              entry.editedAt === null &&
              entry.unsentAt === null
        if (!valid)
          context.addIssue({ code: 'custom', message: 'Invalid Campaign chat entry payload.' })
      })
    )
)

/** Exactly the fields the existing table-roll retry compares; reveal/consumption do not alter reuse. */
export function campaignRollNonceFingerprint(
  payload: z.infer<typeof campaignStoredEntryPayloadSchema>
): string {
  return checksumCanonicalJson({
    kind: payload.kind,
    roll: payload.roll,
    authorUsername: payload.authorUsername,
    characterId: payload.characterId,
    characterLabel: payload.characterLabel,
    mode: payload.mode,
    body: payload.body,
    editedAt: payload.editedAt,
    unsentAt: payload.unsentAt
  })
}

/** Header and payload identity and nonce evidence are committed together by each host. */
export function createCampaignEntryHeader(
  identity: z.infer<typeof campaignStoredEntryIdentitySchema>,
  payload: z.infer<typeof campaignStoredEntryPayloadSchema>
): z.infer<typeof campaignStoredEntryHeaderSchema> {
  const validated = campaignStoredEntryPayloadSchema.parse(payload)
  if (validated.entryId !== identity.id)
    throw new Error('Stored conversation payload identity mismatch.')
  return campaignStoredEntryHeaderSchema.parse({
    ...identity,
    kind: validated.kind,
    rollNonceFingerprint: validated.kind === 'ROLL' ? campaignRollNonceFingerprint(validated) : null
  })
}
