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

/**
 * One chat or roll entry as one document (D229 step 2): each stored row bills its own index rows, so
 * identity, text or roll, and snapshots persist together under three indexes.
 */
export const campaignStoredEntrySchema = lazySchema(() =>
  z
    .extend(
      z.pick(campaignChatEntryDtoSchema, {
        id: true,
        campaignId: true,
        conversationId: true,
        authorUserId: true,
        createdAt: true,
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
      { clientNonce: uuidSchema, consumedAt: z.nullable(timestampSchema) }
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
            : entry.mode === null &&
              entry.body === null &&
              entry.editedAt === null &&
              entry.unsentAt === null &&
              (entry.kind === 'ROLL'
                ? entry.roll !== null
                : // A "roll notice" carries no result, only the creature's name when visible.
                  entry.roll === null &&
                  entry.characterId === null &&
                  !entry.revealedByGm &&
                  entry.consumedAt === null)
        if (!valid) context.addIssue({ code: 'custom', message: 'Invalid Campaign chat entry.' })
      })
    )
)
