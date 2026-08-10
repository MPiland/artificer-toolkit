import { randomInt, randomUUID } from 'node:crypto'
import {
  createAccountProfileRepository,
  createCampaignRepository,
  createCampaignCollaborationRepository,
  createRollHistoryRepository,
  withTransaction,
  type DBLike
} from '@artificer-toolkit/db'
import {
  campaignChatEntryDtoSchema,
  campaignChatPageDtoSchema,
  campaignConversationsDtoSchema,
  type CampaignChatEntryDto,
  type CampaignChatPageDto,
  type ExecuteCampaignRollInput,
  type ExecuteCampaignPrivateRollInput,
  type SendCampaignChatEntryInput
} from '@artificer-toolkit/schema/api/campaigns'
import { rollRecordDtoSchema, type RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import { evaluateRollExpression, parseRollExpression } from '@artificer-toolkit/shared/rolls'
import type { z } from 'zod'
import {
  editCampaignChatEntryInputSchema,
  listCampaignChatEntriesInputSchema,
  markCampaignConversationReadInputSchema,
  unsendCampaignChatEntryInputSchema
} from '@artificer-toolkit/schema/api/campaigns'
import { evaluateRollForUser } from '../rolls/rollService.js'
import {
  assertActiveCampaignMember,
  assertCampaignOwner,
  assertCampaignWritable,
  CampaignAccessError,
  CampaignConflictError,
  resolveCampaignAuthority,
  type CampaignAuthority
} from './campaignService.js'
import { broadcast, lockCampaign, now } from './campaignCollaborationShared.js'

const EDIT_WINDOW_MS = 15 * 60 * 1000
const UNSEND_WINDOW_MS = 5 * 60 * 1000
const RATE_WINDOW_MS = 60 * 1000
const RATE_LIMIT = 30

type ListChatInput = z.input<typeof listCampaignChatEntriesInputSchema>
type CampaignConversationKind = 'TABLE' | 'PARTY' | 'DIRECT'
type CampaignRoom = CampaignConversationKind
type CampaignChatMode = 'OOC' | 'ROLEPLAY'

function assertRoomAccess(
  authority: CampaignAuthority,
  room: CampaignConversationKind,
  directUserId?: string,
  userId?: string
): void {
  assertActiveCampaignMember(authority)
  if (room === 'PARTY' && authority.membership.role !== 'PLAYER') throw new CampaignAccessError()
  if (
    room === 'DIRECT' &&
    directUserId !== undefined &&
    userId !== undefined &&
    directUserId === userId
  ) {
    throw new CampaignAccessError()
  }
}

function assertEntryWithin(createdAt: string, windowMs: number, message: string): void {
  if (Date.now() - Date.parse(createdAt) > windowMs) {
    throw new CampaignConflictError(message)
  }
}

function characterSnapshot(authority: CampaignAuthority, requestedCharacterId?: string) {
  if (requestedCharacterId !== authority.assignedCharacter?.id) return null
  return authority.assignedCharacter
}

function mapChatEntry(entry: {
  id: string
  campaignId: string
  room: CampaignRoom
  kind: 'CHAT' | 'ROLL'
  mode: CampaignChatMode | null
  body: string | null
  rollPayload: unknown
  authorUserId: string
  usernameSnapshot: string
  authorCharacterId: string | null
  characterNameSnapshot: string | null
  editedAt: string | null
  unsentAt: string | null
  createdAt: string
  conversationId?: string
}): CampaignChatEntryDto {
  return campaignChatEntryDtoSchema.parse({
    id: entry.id,
    campaignId: entry.campaignId,
    conversationId: entry.conversationId ?? entry.id,
    room: entry.room,
    kind: entry.kind,
    mode: entry.mode,
    body: entry.body,
    roll: entry.rollPayload === null ? null : rollRecordDtoSchema.parse(entry.rollPayload),
    authorUserId: entry.authorUserId,
    authorUsername: entry.usernameSnapshot,
    characterId: entry.authorCharacterId,
    characterLabel: entry.characterNameSnapshot,
    editedAt: entry.editedAt,
    unsentAt: entry.unsentAt,
    createdAt: entry.createdAt
  })
}

async function resolveConversation(
  db: DBLike,
  authority: CampaignAuthority,
  kind: CampaignConversationKind,
  userId: string,
  directUserId?: string
) {
  const repository = createCampaignCollaborationRepository(db)
  let participantUserIds: string[] | undefined
  if (kind === 'DIRECT') {
    if (!directUserId) throw new CampaignAccessError()
    const target = await createCampaignRepository(db).findMembership(
      authority.campaign.id,
      directUserId
    )
    if (!target || target.status !== 'ACTIVE') throw new CampaignAccessError()
    participantUserIds = [userId, directUserId].sort()
  }
  if (typeof repository.findConversation !== 'function') {
    return {
      id: authority.campaign.id,
      campaignId: authority.campaign.id,
      kind,
      participantUserIds: participantUserIds ?? [],
      createdAt: now()
    }
  }
  let conversation = await repository.findConversation({
    campaignId: authority.campaign.id,
    kind,
    participantUserIds
  })
  if (!conversation) {
    conversation = await repository.insertConversation({
      campaignId: authority.campaign.id,
      kind,
      participantUserIds
    })
  }
  await repository.ensureConversationMember({
    conversationId: conversation.id,
    campaignId: authority.campaign.id,
    userId,
    accessStartedAt: authority.membership.accessStartedAt
  })
  if (kind === 'DIRECT' && directUserId) {
    const target = await createCampaignRepository(db).findMembership(
      authority.campaign.id,
      directUserId
    )
    if (!target || target.status !== 'ACTIVE') throw new CampaignAccessError()
    await repository.ensureConversationMember({
      conversationId: conversation.id,
      campaignId: authority.campaign.id,
      userId: directUserId,
      accessStartedAt: new Date(target.accessStartedAt).toISOString()
    })
  }
  return conversation
}

function executeOwnerCampaignRoll(
  roll: ExecuteCampaignRollInput['roll'],
  username: string,
  ruleset: RollRecordDto['ruleset']
): CampaignChatEntryDto['roll'] {
  if (roll.characterId !== null) return null
  const evaluated = evaluateRollExpression(
    parseRollExpression(roll.expression),
    { nextInt: (maxExclusive) => randomInt(maxExclusive) },
    roll.rollMode ?? 'NORMAL'
  )
  return rollRecordDtoSchema.parse({
    id: randomUUID(),
    characterId: null,
    characterLabel: username,
    source: roll.source,
    ruleset,
    ...evaluated,
    createdAt: now()
  })
}

async function resolveCampaignRollRuleset(
  db: DBLike,
  campaignId: string,
  userId: string
): Promise<RollRecordDto['ruleset']> {
  const systemId = (
    await createCampaignRepository(db).listAssignedSystemIdsExceptUser(campaignId, userId)
  )[0]
  if (!systemId) {
    throw new CampaignAccessError('Assign at least one Character before making a Campaign roll.')
  }
  const ruleset = await createRollHistoryRepository(db).findRuleset(systemId)
  if (!ruleset) throw new CampaignAccessError('The Campaign ruleset is unavailable.')
  return ruleset
}

async function profileUsername(db: DBLike, userId: string): Promise<string> {
  const username = (await createAccountProfileRepository(db).findForUser(userId))?.username
  if (!username)
    throw new CampaignAccessError('A username is required to participate in Campaign chat.')
  return username
}

export async function listCampaignChatEntries(
  db: DBLike,
  input: ListChatInput,
  userId: string
): Promise<CampaignChatPageDto> {
  const authority = await resolveCampaignAuthority(db, input.campaignId, userId)
  assertRoomAccess(authority, input.room, input.directUserId, userId)
  const conversation = await resolveConversation(
    db,
    authority,
    input.room,
    userId,
    input.directUserId
  )
  const limit = input.limit ?? 50
  const entries = await createCampaignCollaborationRepository(db).listRoomEntries({
    campaignId: input.campaignId,
    room: input.room,
    conversationId: conversation.id,
    accessStartedAt: authority.membership.accessStartedAt,
    cursorId: input.cursor,
    limit
  })
  const hasNext = entries.length > limit
  const collaborationRepository = createCampaignCollaborationRepository(db)
  const readState =
    typeof collaborationRepository.getConversationReadState === 'function'
      ? await collaborationRepository.getConversationReadState({
          conversationId: conversation.id,
          userId,
          accessStartedAt: authority.membership.accessStartedAt
        })
      : { lastReadAt: null, unreadCount: 0 }
  return campaignChatPageDtoSchema.parse({
    entries: entries.slice(0, limit).map(mapChatEntry),
    nextCursor: hasNext ? (entries[limit - 1]?.id ?? null) : null,
    lastReadAt: readState.lastReadAt,
    unreadCount: readState.unreadCount
  })
}

export async function listCampaignConversations(db: DBLike, campaignId: string, userId: string) {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertActiveCampaignMember(authority)
  const repository = createCampaignCollaborationRepository(db)
  for (const kind of authority.membership.role === 'OWNER'
    ? (['TABLE'] as const)
    : (['TABLE', 'PARTY'] as const)) {
    await resolveConversation(db, authority, kind, userId)
  }
  const conversations = (await repository.listConversations(campaignId, userId)).filter(
    (conversation) => authority.membership.role !== 'OWNER' || conversation.kind !== 'PARTY'
  )
  return campaignConversationsDtoSchema.parse(
    await Promise.all(
      conversations.map(async (conversation) => {
        const state = await repository.getConversationReadState({
          conversationId: conversation.id,
          userId,
          accessStartedAt: authority.membership.accessStartedAt
        })
        return {
          ...conversation,
          lastReadAt: state.lastReadAt,
          unreadCount: state.unreadCount
        }
      })
    )
  )
}

export async function markCampaignConversationRead(
  db: DBLike,
  input: z.input<typeof markCampaignConversationReadInputSchema>,
  userId: string
): Promise<{ ok: true }> {
  const authority = await resolveCampaignAuthority(db, input.campaignId, userId)
  assertActiveCampaignMember(authority)
  const repository = createCampaignCollaborationRepository(db)
  const entry = await repository.findRoomEntry(input.campaignId, input.entryId)
  if (!entry || entry.conversationId !== input.conversationId) throw new CampaignAccessError()
  assertRoomAccess(authority, entry.room)
  if (Date.parse(entry.createdAt) < Date.parse(authority.membership.accessStartedAt)) {
    throw new CampaignAccessError()
  }
  if (
    !(await repository.isConversationMember({
      conversationId: input.conversationId,
      userId,
      accessStartedAt: authority.membership.accessStartedAt
    }))
  ) {
    throw new CampaignAccessError()
  }
  await repository.markConversationRead({
    conversationId: input.conversationId,
    userId,
    entryId: entry.id
  })
  return { ok: true }
}

export async function sendCampaignChatEntry(
  db: DBLike,
  input: SendCampaignChatEntryInput,
  userId: string
): Promise<CampaignChatEntryDto> {
  const { entry, duplicate } = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignWritable(authority)
    assertRoomAccess(authority, input.room, input.directUserId, userId)
    const conversation = await resolveConversation(
      trx,
      authority,
      input.room,
      userId,
      input.directUserId
    )
    const repository = createCampaignCollaborationRepository(trx)
    const duplicate = await repository.findIdempotentRoomEntry({
      campaignId: input.campaignId,
      authorUserId: userId,
      clientNonce: input.clientNonce
    })
    if (duplicate) {
      if (duplicate.room !== input.room || duplicate.kind !== 'CHAT')
        throw new CampaignConflictError()
      return { entry: duplicate, duplicate: true }
    }
    const authored = await repository.countAuthorEntriesSince({
      campaignId: input.campaignId,
      authorUserId: userId,
      since: new Date(Date.now() - RATE_WINDOW_MS).toISOString()
    })
    if (authored >= RATE_LIMIT) throw new CampaignConflictError('Chat is temporarily rate limited.')
    if (
      input.mode === 'ROLEPLAY' &&
      input.assignedCharacterId !== authority.assignedCharacter?.id
    ) {
      throw new CampaignAccessError()
    }
    const character = characterSnapshot(authority, input.assignedCharacterId)
    return {
      entry: await repository.insertRoomEntry({
        campaignId: input.campaignId,
        conversationId: conversation.id,
        room: input.room,
        kind: 'CHAT',
        authorUserId: userId,
        authorCharacterId: character?.id ?? null,
        usernameSnapshot: await profileUsername(trx, userId),
        characterNameSnapshot: character?.label ?? null,
        mode: input.mode,
        body: input.body,
        clientNonce: input.clientNonce
      }),
      duplicate: false
    }
  })
  if (!duplicate)
    await broadcast(
      db,
      input.campaignId,
      input.room,
      'CHAT',
      entry.id,
      'CREATED',
      entry.createdAt,
      entry.conversationId
    )
  return mapChatEntry(entry)
}

export async function executeCampaignRoll(
  db: DBLike,
  input: ExecuteCampaignRollInput,
  userId: string
): Promise<CampaignChatEntryDto> {
  const { entry, duplicate } = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignWritable(authority)
    assertRoomAccess(authority, input.room, input.directUserId, userId)
    if (input.room !== 'TABLE') throw new CampaignAccessError()
    const rollCharacter = input.roll.characterId
      ? await createCampaignRepository(trx).findAssignmentByCharacter(
          input.campaignId,
          input.roll.characterId
        )
      : null
    if (input.roll.characterId !== null && !rollCharacter) throw new CampaignAccessError()
    if (
      input.roll.characterId !== null &&
      authority.membership.role !== 'OWNER' &&
      rollCharacter?.userId !== userId
    ) {
      throw new CampaignAccessError()
    }
    if (input.roll.characterId === null && authority.membership.role !== 'OWNER') {
      throw new CampaignAccessError()
    }
    if (input.roll.characterId === null && input.roll.source.kind !== 'MANUAL') {
      throw new CampaignAccessError('A manual Campaign roll is required without a Character.')
    }
    const conversation = await resolveConversation(trx, authority, input.room, userId)
    const repository = createCampaignCollaborationRepository(trx)
    const duplicate = await repository.findIdempotentRoomEntry({
      campaignId: input.campaignId,
      authorUserId: userId,
      clientNonce: input.clientNonce
    })
    if (duplicate) {
      if (duplicate.room !== input.room || duplicate.kind !== 'ROLL')
        throw new CampaignConflictError()
      return { entry: duplicate, duplicate: true }
    }
    const authored = await repository.countAuthorEntriesSince({
      campaignId: input.campaignId,
      authorUserId: userId,
      since: new Date(Date.now() - RATE_WINDOW_MS).toISOString()
    })
    if (authored >= RATE_LIMIT) throw new CampaignConflictError('Chat is temporarily rate limited.')
    const username = await profileUsername(trx, userId)
    const characterRoll =
      input.roll.characterId === null
        ? null
        : { ...input.roll, characterId: input.roll.characterId as string }
    const roll = characterRoll
      ? await evaluateRollForUser(trx, characterRoll, userId)
      : executeOwnerCampaignRoll(
          input.roll,
          username,
          await resolveCampaignRollRuleset(trx, input.campaignId, userId)
        )
    return {
      entry: await repository.insertRoomEntry({
        campaignId: input.campaignId,
        conversationId: conversation.id,
        room: input.room,
        kind: 'ROLL',
        authorUserId: userId,
        authorCharacterId: input.roll.characterId,
        usernameSnapshot: username,
        characterNameSnapshot:
          input.roll.characterId === null ? null : (roll?.characterLabel ?? null),
        rollPayload: roll,
        clientNonce: input.clientNonce
      }),
      duplicate: false
    }
  })
  if (!duplicate)
    await broadcast(
      db,
      input.campaignId,
      input.room,
      'CHAT',
      entry.id,
      'CREATED',
      entry.createdAt,
      entry.conversationId
    )
  return mapChatEntry(entry)
}

export async function insertPreEvaluatedCampaignTableRoll(
  db: DBLike,
  input: {
    campaignId: string
    clientNonce: string
    roll: RollRecordDto
  },
  userId: string
) {
  const authority = await resolveCampaignAuthority(db, input.campaignId, userId)
  assertCampaignWritable(authority)
  assertCampaignOwner(authority)
  const repository = createCampaignCollaborationRepository(db)
  const duplicate = await repository.findIdempotentRoomEntry({
    campaignId: input.campaignId,
    authorUserId: userId,
    clientNonce: input.clientNonce
  })
  if (duplicate) {
    if (
      duplicate.room !== 'TABLE' ||
      duplicate.kind !== 'ROLL' ||
      JSON.stringify(duplicate.rollPayload) !== JSON.stringify(input.roll)
    ) {
      throw new CampaignConflictError('Command ID was already used by another table entry.')
    }
    return duplicate
  }
  const authored = await repository.countAuthorEntriesSince({
    campaignId: input.campaignId,
    authorUserId: userId,
    since: new Date(Date.now() - RATE_WINDOW_MS).toISOString()
  })
  if (authored >= RATE_LIMIT) throw new CampaignConflictError('Chat is temporarily rate limited.')
  const conversation = await resolveConversation(db, authority, 'TABLE', userId)
  const roll = rollRecordDtoSchema.parse(input.roll)
  return repository.insertRoomEntry({
    campaignId: input.campaignId,
    conversationId: conversation.id,
    room: 'TABLE',
    kind: 'ROLL',
    authorUserId: userId,
    authorCharacterId: null,
    usernameSnapshot: await profileUsername(db, userId),
    characterNameSnapshot: roll.characterLabel,
    rollPayload: roll,
    clientNonce: input.clientNonce
  })
}

export async function executeCampaignPrivateRoll(
  db: DBLike,
  input: ExecuteCampaignPrivateRollInput,
  userId: string
) {
  const authority = await resolveCampaignAuthority(db, input.campaignId, userId)
  assertCampaignWritable(authority)
  assertCampaignOwner(authority)
  const username = await profileUsername(db, userId)
  const rollHistory = createRollHistoryRepository(db)
  const ruleset = await resolveCampaignRollRuleset(db, input.campaignId, userId)
  const record = executeOwnerCampaignRoll(input.roll, username, ruleset)
  if (!record) throw new CampaignAccessError()
  return rollHistory.insertAndTrim(userId, record)
}

export async function editCampaignChatEntry(
  db: DBLike,
  input: z.input<typeof editCampaignChatEntryInputSchema>,
  userId: string
): Promise<CampaignChatEntryDto> {
  const entry = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignWritable(authority)
    const repository = createCampaignCollaborationRepository(trx)
    const existing = await repository.findRoomEntry(input.campaignId, input.entryId)
    if (!existing || existing.authorUserId !== userId) throw new CampaignAccessError()
    if (existing.kind !== 'CHAT' || existing.unsentAt) throw new CampaignConflictError()
    assertRoomAccess(authority, existing.room, undefined, userId)
    if (
      existing.room === 'DIRECT' &&
      !(await repository.isConversationMember?.({
        conversationId: existing.conversationId,
        userId,
        accessStartedAt: authority.membership.accessStartedAt
      }))
    ) {
      throw new CampaignAccessError()
    }
    assertEntryWithin(
      existing.createdAt,
      EDIT_WINDOW_MS,
      'Chat entries can only be edited for 15 minutes.'
    )
    const entry = await repository.updateChatBody({
      campaignId: input.campaignId,
      id: input.entryId,
      authorUserId: userId,
      body: input.body,
      editedAt: now()
    })
    if (!entry) throw new CampaignConflictError()
    return entry
  })
  await broadcast(
    db,
    input.campaignId,
    entry.room,
    'CHAT',
    entry.id,
    'UPDATED',
    entry.editedAt ?? entry.createdAt,
    entry.conversationId
  )
  return mapChatEntry(entry)
}

export async function unsendCampaignChatEntry(
  db: DBLike,
  input: z.input<typeof unsendCampaignChatEntryInputSchema>,
  userId: string
): Promise<CampaignChatEntryDto> {
  const entry = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignWritable(authority)
    const repository = createCampaignCollaborationRepository(trx)
    const existing = await repository.findRoomEntry(input.campaignId, input.entryId)
    if (!existing || existing.authorUserId !== userId) throw new CampaignAccessError()
    if (existing.kind !== 'CHAT' || existing.unsentAt) throw new CampaignConflictError()
    assertRoomAccess(authority, existing.room, undefined, userId)
    if (
      existing.room === 'DIRECT' &&
      !(await repository.isConversationMember?.({
        conversationId: existing.conversationId,
        userId,
        accessStartedAt: authority.membership.accessStartedAt
      }))
    ) {
      throw new CampaignAccessError()
    }
    assertEntryWithin(
      existing.createdAt,
      UNSEND_WINDOW_MS,
      'Chat entries can only be unsent for 5 minutes.'
    )
    const entry = await repository.tombstoneChat({
      campaignId: input.campaignId,
      id: input.entryId,
      authorUserId: userId,
      unsentAt: now()
    })
    if (!entry) throw new CampaignConflictError()
    return entry
  })
  await broadcast(
    db,
    input.campaignId,
    entry.room,
    'CHAT',
    entry.id,
    'UPDATED',
    entry.unsentAt ?? entry.createdAt,
    entry.conversationId
  )
  return mapChatEntry(entry)
}
