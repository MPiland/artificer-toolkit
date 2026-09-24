import { z } from '../zod.js'
import { campaignAnnouncementDtoSchema } from '../api/campaignAnnouncements.js'
import { campaignChatEntryDtoSchema } from '../api/campaignCommunication.js'
import { timestampSchema, uuidSchema } from '../api/campaignContractSchemas.js'
import { projectionChecksumSchema } from './identity.js'

export const campaignStoredConversationSchema = z
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

export const campaignStoredConversationMemberSchema = z.strictObject({
  conversationId: uuidSchema,
  campaignId: uuidSchema,
  userId: uuidSchema,
  accessStartedAt: timestampSchema,
  lastReadAt: z.nullable(timestampSchema)
})

export const campaignStoredAnnouncementSchema = z.safeExtend(campaignAnnouncementDtoSchema, {
  commandId: uuidSchema,
  inputFingerprint: projectionChecksumSchema
})

// Counts and retention read only these compact rows, not 500 message/roll payloads per room.
export const campaignStoredEntryHeaderSchema = z.extend(
  z.pick(campaignChatEntryDtoSchema, {
    id: true,
    campaignId: true,
    conversationId: true,
    authorUserId: true,
    createdAt: true
  }),
  { clientNonce: uuidSchema }
)

export const campaignStoredEntryPayloadSchema = z
  .extend(
    z.pick(campaignChatEntryDtoSchema, {
      kind: true,
      mode: true,
      body: true,
      roll: true,
      authorUsername: true,
      characterId: true,
      characterLabel: true,
      editedAt: true,
      unsentAt: true
    }),
    { entryId: uuidSchema }
  )
  .check(
    z.superRefine((entry, context) => {
      const valid =
        entry.kind === 'CHAT'
          ? entry.roll === null &&
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
