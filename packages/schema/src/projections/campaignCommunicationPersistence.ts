import { z, lazySchema } from '../zod.js'
import { campaignAnnouncementDtoSchema } from '../api/campaignAnnouncements.js'
import {
  campaignChatEntryDtoSchema,
  campaignChatRollDtoSchema
} from '../api/campaignCommunication.js'
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

/**
 * One roll of a stored ROLL entry. `consumedAt` is set once when rest settlement spends this roll
 * and is never part of the chat presentation.
 */
export const campaignStoredRollSchema = lazySchema(() =>
  z.extend(campaignChatRollDtoSchema, { consumedAt: z.nullable(timestampSchema) })
)

/**
 * One chat or roll entry as one document (D229 step 2): each stored row bills its own index rows, so
 * identity, text or rolls, and snapshots persist together under three indexes.
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
        authorUsername: true,
        characterId: true,
        characterLabel: true,
        editedAt: true,
        unsentAt: true
      }),
      { clientNonce: uuidSchema, rolls: z.array(campaignStoredRollSchema) }
    )
    .check(
      z.superRefine((entry, context) => {
        const valid =
          entry.kind === 'CHAT'
            ? entry.rolls.length === 0 &&
              entry.mode !== null &&
              (entry.unsentAt === null) === (entry.body !== null)
            : entry.mode === null &&
              entry.body === null &&
              entry.editedAt === null &&
              entry.unsentAt === null &&
              (entry.kind === 'ROLL'
                ? entry.rolls.length > 0
                : // A "roll notice" carries no result, only the creature's name when visible.
                  entry.rolls.length === 0 && entry.characterId === null)
        if (!valid) context.addIssue({ code: 'custom', message: 'Invalid Campaign chat entry.' })
      })
    )
)

/**
 * The room's hydrated view of a historical entry: identity and nonce evidence only. Text, roll
 * payloads and snapshots stay in Convex. It is a read-time projection of the stored entry and is
 * never stored.
 */
export const campaignStoredEntryMetadataSchema = lazySchema(() =>
  z
    .extend(
      z.pick(campaignChatEntryDtoSchema, {
        id: true,
        campaignId: true,
        conversationId: true,
        authorUserId: true,
        createdAt: true,
        kind: true
      }),
      { clientNonce: uuidSchema, rollNonceFingerprint: z.nullable(projectionChecksumSchema) }
    )
    .check(
      z.superRefine((metadata, context) => {
        if ((metadata.kind === 'ROLL') !== (metadata.rollNonceFingerprint !== null))
          context.addIssue({ code: 'custom', message: 'Invalid Campaign chat nonce evidence.' })
      })
    )
)

/** A room's entry row: a full entry it wrote, or the metadata it hydrated for a historical one. */
export const campaignRoomEntrySchema = lazySchema(() =>
  z.union([campaignStoredEntrySchema, campaignStoredEntryMetadataSchema])
)

/**
 * Exactly the fields the table-roll retry compares: every roll record in order, not their reveal
 * or consumption, which do not alter reuse.
 */
export function campaignRollNonceFingerprint(
  entry: Pick<
    z.infer<typeof campaignStoredEntrySchema>,
    | 'kind'
    | 'rolls'
    | 'authorUsername'
    | 'characterId'
    | 'characterLabel'
    | 'mode'
    | 'body'
    | 'editedAt'
    | 'unsentAt'
  >
): string {
  return checksumCanonicalJson({
    kind: entry.kind,
    rolls: entry.rolls.map(({ roll }) => roll),
    authorUsername: entry.authorUsername,
    characterId: entry.characterId,
    characterLabel: entry.characterLabel,
    mode: entry.mode,
    body: entry.body,
    editedAt: entry.editedAt,
    unsentAt: entry.unsentAt
  })
}

/** The one projection of a stored entry to what the room hydrates. */
export function projectCampaignEntryMetadata(
  entry: z.infer<typeof campaignStoredEntrySchema>
): z.infer<typeof campaignStoredEntryMetadataSchema> {
  return {
    id: entry.id,
    campaignId: entry.campaignId,
    conversationId: entry.conversationId,
    authorUserId: entry.authorUserId,
    createdAt: entry.createdAt,
    kind: entry.kind,
    clientNonce: entry.clientNonce,
    rollNonceFingerprint: entry.kind === 'ROLL' ? campaignRollNonceFingerprint(entry) : null
  }
}

/** Whether a room row carries text or a roll, not just hydrated metadata. */
export function hasCampaignEntryContent<Entry extends z.infer<typeof campaignRoomEntrySchema>>(
  entry: Entry
): entry is Extract<Entry, z.infer<typeof campaignStoredEntrySchema>> {
  return 'rolls' in entry
}
