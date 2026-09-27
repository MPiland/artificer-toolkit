import { z, lazySchema } from '../zod.js'
import { campaignAnnouncementDtoSchema } from '../api/campaignAnnouncements.js'
import { campaignChatEntryDtoSchema } from '../api/campaignCommunication.js'
import { timestampSchema, uuidSchema } from '../api/campaignContractSchemas.js'
import { projectionChecksumSchema } from './identity.js'

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
export const campaignStoredEntryHeaderSchema = lazySchema(() =>
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
