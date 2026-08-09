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
  campaignNotebookSectionDtoSchema,
  campaignNotebookSectionsDtoSchema,
  campaignSessionDtoSchema,
  campaignSessionAttendanceDtoListSchema,
  campaignSessionRsvpDtoListSchema,
  campaignSessionReferencePinDtoSchema,
  campaignSessionReferencePinsDtoSchema,
  campaignSessionNoteSectionDtoSchema,
  campaignSessionNoteSectionsDtoSchema,
  campaignSessionsDtoSchema,
  type CampaignChatEntryDto,
  type CampaignChatPageDto,
  type CampaignNotebookSectionDto,
  type CampaignSessionDto,
  type CampaignSessionAttendanceDto,
  type CampaignSessionRsvpDto,
  type CampaignSessionReferencePinDto,
  type CampaignSessionNoteSectionDto,
  type ExecuteCampaignRollInput,
  type ExecuteCampaignPrivateRollInput,
  type SendCampaignChatEntryInput
} from '@artificer-toolkit/schema/api/campaigns'
import { rollRecordDtoSchema, type RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import { evaluateRollExpression, parseRollExpression } from '@artificer-toolkit/shared/rolls'
import type { z } from 'zod'
import {
  createCampaignNotebookSectionInputSchema,
  createCampaignSessionInputSchema,
  createCampaignSessionNoteSectionInputSchema,
  createCampaignSessionReferencePinInputSchema,
  deleteCampaignNotebookSectionInputSchema,
  deleteCampaignSessionInputSchema,
  deleteCampaignSessionNoteSectionInputSchema,
  deleteCampaignSessionReferencePinInputSchema,
  editCampaignChatEntryInputSchema,
  listCampaignChatEntriesInputSchema,
  markCampaignConversationReadInputSchema,
  listCampaignNotebookSectionsInputSchema,
  listCampaignSessionNoteSectionsInputSchema,
  listCampaignSessionsInputSchema,
  listCampaignSessionAttendanceInputSchema,
  listCampaignSessionRsvpsInputSchema,
  listCampaignSessionReferencePinsInputSchema,
  setCampaignSessionAttendanceInputSchema,
  setCampaignSessionRsvpInputSchema,
  finishCampaignSessionInputSchema,
  getCampaignSessionInputSchema,
  reopenCampaignSessionInputSchema,
  unsendCampaignChatEntryInputSchema,
  updateCampaignNotebookSectionInputSchema,
  updateCampaignSessionInputSchema,
  updateCampaignSessionNoteSectionInputSchema
} from '@artificer-toolkit/schema/api/campaigns'
import { evaluateRollForUser } from '../rolls/rollService.js'
import {
  authoredDomainConfigs,
  getAuthoredDomain,
  type DirectAuthoredDomainConfig
} from '../authoredContent/authoredDomainService.js'
import {
  assertActiveCampaignMember,
  assertCampaignOwner,
  assertCampaignWritable,
  CampaignAccessError,
  CampaignConflictError,
  CampaignNotFoundError,
  resolveCampaignAuthority,
  type CampaignAuthority
} from './campaignService.js'
import { broadcastCampaignInvalidation } from './realtimeService.js'

const EDIT_WINDOW_MS = 15 * 60 * 1000
const UNSEND_WINDOW_MS = 5 * 60 * 1000
const RATE_WINDOW_MS = 60 * 1000
const RATE_LIMIT = 30

type CreateNotebookInput = z.input<typeof createCampaignNotebookSectionInputSchema>
type UpdateNotebookInput = z.input<typeof updateCampaignNotebookSectionInputSchema>
type DeleteNotebookInput = z.input<typeof deleteCampaignNotebookSectionInputSchema>
type CreateSessionInput = z.input<typeof createCampaignSessionInputSchema>
type UpdateSessionInput = z.input<typeof updateCampaignSessionInputSchema>
type DeleteSessionInput = z.input<typeof deleteCampaignSessionInputSchema>
type FinishSessionInput = z.input<typeof finishCampaignSessionInputSchema>
type ReopenSessionInput = z.input<typeof reopenCampaignSessionInputSchema>
type SetSessionAttendanceInput = z.input<typeof setCampaignSessionAttendanceInputSchema>
type SetSessionRsvpInput = z.input<typeof setCampaignSessionRsvpInputSchema>
type CreateSessionReferencePinInput = z.input<typeof createCampaignSessionReferencePinInputSchema>
type DeleteSessionReferencePinInput = z.input<typeof deleteCampaignSessionReferencePinInputSchema>
type CreateSessionNoteInput = z.input<typeof createCampaignSessionNoteSectionInputSchema>
type UpdateSessionNoteInput = z.input<typeof updateCampaignSessionNoteSectionInputSchema>
type DeleteSessionNoteInput = z.input<typeof deleteCampaignSessionNoteSectionInputSchema>
type ListChatInput = z.input<typeof listCampaignChatEntriesInputSchema>
type CampaignConversationKind = 'TABLE' | 'PARTY' | 'DIRECT'
type CampaignRoom = CampaignConversationKind
type CampaignChatMode = 'OOC' | 'ROLEPLAY'

function now(): string {
  return new Date().toISOString()
}

function authoredReferenceConfig(
  subjectKind: Extract<
    CampaignSessionReferencePinDto['target'],
    { kind: 'AUTHORED_ROUTE' }
  >['routeSubjectKind']
): DirectAuthoredDomainConfig {
  if (subjectKind === 'BACKGROUND') return authoredDomainConfigs.backgrounds
  if (subjectKind === 'CLASS') return authoredDomainConfigs.classes
  if (subjectKind === 'CREATURE') return authoredDomainConfigs.creatures
  if (subjectKind === 'EQUIPMENT') return authoredDomainConfigs.equipment
  if (subjectKind === 'FEAT') return authoredDomainConfigs.feats
  if (subjectKind === 'RACE') return authoredDomainConfigs.races
  if (subjectKind === 'SPELL') return authoredDomainConfigs.spells
  return authoredDomainConfigs.vehicles
}

async function resolveAuthoredReferenceLabel(
  db: DBLike,
  userId: string,
  target: Extract<CampaignSessionReferencePinDto['target'], { kind: 'AUTHORED_ROUTE' }>
): Promise<string | null> {
  const detail = await getAuthoredDomain(
    db,
    authoredReferenceConfig(target.routeSubjectKind),
    { id: target.publicId, view: 'active' },
    userId
  )
  return detail?.item?.label ?? null
}

function assertSessionSchedule(schedule: {
  scheduledStartAt: string | null
  scheduledEndAt: string | null
  timeZone: string | null
}): void {
  const { scheduledStartAt, scheduledEndAt, timeZone } = schedule
  const values = [scheduledStartAt, scheduledEndAt, timeZone]
  if (values.every((value) => value === null)) return
  if (scheduledStartAt === null || scheduledEndAt === null || timeZone === null) {
    throw new CampaignConflictError('Session scheduling requires a start, end, and time zone.')
  }
  if (Date.parse(scheduledEndAt) <= Date.parse(scheduledStartAt)) {
    throw new CampaignConflictError('Session end must be after its start.')
  }
}

function assertRoomAccess(
  authority: CampaignAuthority,
  room: CampaignConversationKind,
  directUserId?: string,
  userId?: string
): void {
  assertActiveCampaignMember(authority)
  if (room === 'PARTY' && authority.membership.role !== 'PLAYER') throw new CampaignAccessError()
  if (room === 'DIRECT' && directUserId === userId) throw new CampaignAccessError()
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

async function lockCampaign(db: DBLike, campaignId: string): Promise<void> {
  if (!(await createCampaignRepository(db).lockCampaign(campaignId)))
    throw new CampaignNotFoundError()
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

function mapNotebookSection(section: {
  id: string
  campaignId: string
  title: string
  content: string
  visibility: 'GM_PRIVATE' | 'SHARED'
  category: 'GENERAL' | 'PEOPLE' | 'PLACES'
  version: number
  createdAt: string
  updatedAt: string
}): CampaignNotebookSectionDto {
  return campaignNotebookSectionDtoSchema.parse({
    id: section.id,
    campaignId: section.campaignId,
    title: section.title,
    content: section.content,
    visibility: section.visibility,
    category: section.category,
    version: section.version,
    createdAt: section.createdAt,
    updatedAt: section.updatedAt
  })
}

function mapSession(session: {
  id: string
  campaignId: string
  sessionNumber: number
  title: string | null
  scheduledStartAt: string | null
  scheduledEndAt: string | null
  timeZone: string | null
  status: 'OPEN' | 'FINISHED'
  finishedAt: string | null
  version: number
  createdAt: string
  updatedAt: string
}): CampaignSessionDto {
  return campaignSessionDtoSchema.parse({
    id: session.id,
    campaignId: session.campaignId,
    sessionNumber: session.sessionNumber,
    title: session.title,
    scheduledStartAt: session.scheduledStartAt,
    scheduledEndAt: session.scheduledEndAt,
    timeZone: session.timeZone,
    status: session.status,
    finishedAt: session.finishedAt,
    version: session.version,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  })
}

function mapSessionNote(
  section: {
    id: string
    sessionId: string
    title: string
    content: string
    visibility: CampaignSessionNoteSectionDto['visibility']
    kind: CampaignSessionNoteSectionDto['kind']
    sortOrder: number
    version: number
    createdBy: string
    createdAt: string
    updatedAt: string
  },
  campaignId: string
): CampaignSessionNoteSectionDto {
  return campaignSessionNoteSectionDtoSchema.parse({
    id: section.id,
    campaignId,
    sessionId: section.sessionId,
    authorUserId: section.createdBy,
    title: section.title,
    content: section.content,
    visibility: section.visibility,
    kind: section.kind,
    sortOrder: section.sortOrder,
    version: section.version,
    createdAt: section.createdAt,
    updatedAt: section.updatedAt
  })
}

function mapSessionReferencePin(pin: {
  id: string
  campaignId: string
  sessionId: string
  target: CampaignSessionReferencePinDto['target']
  label: string
  createdAt: string
}): CampaignSessionReferencePinDto {
  return campaignSessionReferencePinDtoSchema.parse(pin)
}

async function broadcast(
  db: DBLike,
  campaignId: string,
  scope: 'TABLE' | 'PARTY' | 'DIRECT' | 'OWNER',
  entity: 'CHAT' | 'NOTE' | 'SESSION',
  entityId: string,
  event: 'CREATED' | 'UPDATED' | 'DELETED',
  cursor: string,
  conversationId?: string
): Promise<void> {
  await broadcastCampaignInvalidation(db, campaignId, {
    scope,
    entity,
    entityId,
    event,
    eventId: randomUUID(),
    cursor,
    ...(scope === 'DIRECT' && conversationId ? { conversationId } : {})
  })
}

function notebookScope(visibility: 'GM_PRIVATE' | 'SHARED'): 'OWNER' | 'TABLE' {
  return visibility === 'SHARED' ? 'TABLE' : 'OWNER'
}

async function profileUsername(db: DBLike, userId: string): Promise<string> {
  const username = (await createAccountProfileRepository(db).findForUser(userId))?.username
  if (!username)
    throw new CampaignAccessError('A username is required to participate in Campaign chat.')
  return username
}

async function requireSession(db: DBLike, campaignId: string, sessionId: string) {
  const session = (
    await createCampaignCollaborationRepository(db).listCampaignSessions(campaignId)
  ).find((candidate) => candidate.id === sessionId)
  if (!session) throw new CampaignAccessError()
  return session
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
  const conversations = await repository.listConversations(campaignId, userId)
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

export async function listCampaignNotebookSections(
  db: DBLike,
  input: z.input<typeof listCampaignNotebookSectionsInputSchema>,
  userId: string
): Promise<CampaignNotebookSectionDto[]> {
  const authority = await resolveCampaignAuthority(db, input.campaignId, userId)
  assertActiveCampaignMember(authority)
  const visibility = authority.membership.role === 'OWNER' ? 'ALL' : 'SHARED'
  return campaignNotebookSectionsDtoSchema.parse(
    (
      await createCampaignCollaborationRepository(db).listCampaignNoteSections(
        input.campaignId,
        visibility
      )
    ).map(mapNotebookSection)
  )
}

export async function createCampaignNotebookSection(
  db: DBLike,
  input: CreateNotebookInput,
  userId: string
): Promise<CampaignNotebookSectionDto> {
  const section = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignWritable(authority)
    assertCampaignOwner(authority)
    const visibility = input.visibility ?? 'GM_PRIVATE'
    return createCampaignCollaborationRepository(trx).insertCampaignNoteSection({
      campaignId: input.campaignId,
      title: input.title,
      content: input.content,
      visibility,
      category: input.category ?? 'GENERAL',
      sortOrder: 0,
      createdBy: userId
    })
  })
  await broadcast(
    db,
    input.campaignId,
    notebookScope(section.visibility),
    'NOTE',
    section.id,
    'CREATED',
    section.createdAt
  )
  return mapNotebookSection(section)
}

export async function updateCampaignNotebookSection(
  db: DBLike,
  input: UpdateNotebookInput,
  userId: string
): Promise<CampaignNotebookSectionDto> {
  const { section, oldVisibility } = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignWritable(authority)
    assertCampaignOwner(authority)
    const repository = createCampaignCollaborationRepository(trx)
    const existing = (await repository.listCampaignNoteSections(input.campaignId, 'ALL')).find(
      (section) => section.id === input.sectionId
    )
    if (!existing) throw new CampaignAccessError()
    const visibility = input.visibility ?? existing.visibility
    const section = await repository.updateCampaignNoteSection({
      campaignId: input.campaignId,
      id: input.sectionId,
      expectedVersion: input.expectedVersion,
      title: input.title === undefined ? existing.title : input.title,
      content: input.content ?? existing.content,
      visibility,
      category: input.category ?? existing.category,
      sortOrder: existing.sortOrder,
      updatedBy: userId,
      updatedAt: now()
    })
    if (!section) throw new CampaignConflictError()
    return { section, oldVisibility: existing.visibility }
  })
  const oldScope = notebookScope(oldVisibility)
  const newScope = notebookScope(section.visibility)
  await broadcast(db, input.campaignId, oldScope, 'NOTE', section.id, 'UPDATED', section.updatedAt)
  if (newScope !== oldScope)
    await broadcast(
      db,
      input.campaignId,
      newScope,
      'NOTE',
      section.id,
      'UPDATED',
      section.updatedAt
    )
  return mapNotebookSection(section)
}

export async function deleteCampaignNotebookSection(
  db: DBLike,
  input: DeleteNotebookInput,
  userId: string
): Promise<{ ok: true }> {
  const visibility = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignWritable(authority)
    assertCampaignOwner(authority)
    const repository = createCampaignCollaborationRepository(trx)
    const existing = (await repository.listCampaignNoteSections(input.campaignId, 'ALL')).find(
      (section) => section.id === input.sectionId
    )
    if (!existing) throw new CampaignAccessError()
    if (!(await repository.deleteCampaignNoteSection(input.campaignId, input.sectionId)))
      throw new CampaignAccessError()
    return existing.visibility
  })
  await broadcast(
    db,
    input.campaignId,
    notebookScope(visibility),
    'NOTE',
    input.sectionId,
    'DELETED',
    now()
  )
  return { ok: true }
}

export async function listCampaignSessions(
  db: DBLike,
  input: z.input<typeof listCampaignSessionsInputSchema>,
  userId: string
): Promise<CampaignSessionDto[]> {
  const authority = await resolveCampaignAuthority(db, input.campaignId, userId)
  assertActiveCampaignMember(authority)
  return campaignSessionsDtoSchema.parse(
    (await createCampaignCollaborationRepository(db).listCampaignSessions(input.campaignId)).map(
      mapSession
    )
  )
}

export async function createCampaignSession(
  db: DBLike,
  input: CreateSessionInput,
  userId: string
): Promise<CampaignSessionDto> {
  const session = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    const repository = createCampaignCollaborationRepository(trx)
    const session = await repository.insertCampaignSession({
      campaignId: input.campaignId,
      title: input.title ?? null,
      scheduledStartAt: input.scheduledStartAt ?? null,
      scheduledEndAt: input.scheduledEndAt ?? null,
      timeZone: input.timeZone ?? null
    })
    await repository.seedSessionAttendance(
      input.campaignId,
      session.id,
      await createCampaignRepository(trx).listAssignmentCharacterIds(input.campaignId)
    )
    return session
  })
  await broadcast(
    db,
    input.campaignId,
    'TABLE',
    'SESSION',
    session.id,
    'CREATED',
    session.createdAt
  )
  return mapSession(session)
}

export async function updateCampaignSession(
  db: DBLike,
  input: UpdateSessionInput,
  userId: string
): Promise<CampaignSessionDto> {
  const session = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    const existing = await requireSession(trx, input.campaignId, input.sessionId)
    const schedule = {
      scheduledStartAt:
        input.scheduledStartAt === undefined ? existing.scheduledStartAt : input.scheduledStartAt,
      scheduledEndAt:
        input.scheduledEndAt === undefined ? existing.scheduledEndAt : input.scheduledEndAt,
      timeZone: input.timeZone === undefined ? existing.timeZone : input.timeZone
    }
    assertSessionSchedule(schedule)
    const session = await createCampaignCollaborationRepository(trx).updateCampaignSession({
      campaignId: input.campaignId,
      id: input.sessionId,
      expectedVersion: input.expectedVersion,
      title: input.title === undefined ? existing.title : input.title,
      ...schedule,
      updatedAt: now()
    })
    if (!session) throw new CampaignConflictError()
    return session
  })
  await broadcast(
    db,
    input.campaignId,
    'TABLE',
    'SESSION',
    session.id,
    'UPDATED',
    session.updatedAt
  )
  return mapSession(session)
}

export async function finishCampaignSession(
  db: DBLike,
  rawInput: FinishSessionInput,
  userId: string
): Promise<CampaignSessionDto> {
  const input = finishCampaignSessionInputSchema.parse(rawInput)
  const session = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    const existing = await requireSession(trx, input.campaignId, input.sessionId)
    if (existing.version !== input.expectedVersion) throw new CampaignConflictError()
    if (existing.status !== 'OPEN') throw new CampaignConflictError('Session is already finished.')
    const saved = await createCampaignCollaborationRepository(trx).updateCampaignSessionLifecycle({
      campaignId: input.campaignId,
      id: input.sessionId,
      expectedVersion: input.expectedVersion,
      status: 'FINISHED',
      finishedAt: now()
    })
    if (!saved) throw new CampaignConflictError()
    return saved
  })
  await broadcast(
    db,
    input.campaignId,
    'TABLE',
    'SESSION',
    session.id,
    'UPDATED',
    session.updatedAt
  )
  return mapSession(session)
}

export async function reopenCampaignSession(
  db: DBLike,
  rawInput: ReopenSessionInput,
  userId: string
): Promise<CampaignSessionDto> {
  const input = reopenCampaignSessionInputSchema.parse(rawInput)
  const session = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    const existing = await requireSession(trx, input.campaignId, input.sessionId)
    if (existing.version !== input.expectedVersion) throw new CampaignConflictError()
    if (existing.status !== 'FINISHED') throw new CampaignConflictError('Session is already open.')
    const saved = await createCampaignCollaborationRepository(trx).updateCampaignSessionLifecycle({
      campaignId: input.campaignId,
      id: input.sessionId,
      expectedVersion: input.expectedVersion,
      status: 'OPEN',
      finishedAt: null
    })
    if (!saved) throw new CampaignConflictError()
    return saved
  })
  await broadcast(
    db,
    input.campaignId,
    'TABLE',
    'SESSION',
    session.id,
    'UPDATED',
    session.updatedAt
  )
  return mapSession(session)
}

export async function getCampaignSession(
  db: DBLike,
  input: z.input<typeof getCampaignSessionInputSchema>,
  userId: string
): Promise<CampaignSessionDto> {
  const authority = await resolveCampaignAuthority(db, input.campaignId, userId)
  assertActiveCampaignMember(authority)
  const session = await createCampaignCollaborationRepository(db).findCampaignSession(
    input.campaignId,
    input.sessionNumber
  )
  if (!session) throw new CampaignNotFoundError()
  return mapSession(session)
}

export async function listCampaignSessionAttendance(
  db: DBLike,
  input: z.input<typeof listCampaignSessionAttendanceInputSchema>,
  userId: string
): Promise<CampaignSessionAttendanceDto[]> {
  const authority = await resolveCampaignAuthority(db, input.campaignId, userId)
  assertActiveCampaignMember(authority)
  const session = await requireSession(db, input.campaignId, input.sessionId)
  const attendance = await createCampaignCollaborationRepository(db).listSessionAttendance(
    session.id
  )
  return campaignSessionAttendanceDtoListSchema.parse(attendance)
}

export async function setCampaignSessionAttendance(
  db: DBLike,
  rawInput: SetSessionAttendanceInput,
  userId: string
): Promise<CampaignSessionAttendanceDto> {
  const input = setCampaignSessionAttendanceInputSchema.parse(rawInput)
  const attendance = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    const session = await requireSession(trx, input.campaignId, input.sessionId)
    if (session.status !== 'OPEN') throw new CampaignConflictError('Finished sessions are locked.')
    if (session.version !== input.expectedVersion) throw new CampaignConflictError()
    const assignment = await createCampaignRepository(trx).findAssignmentByCharacter(
      input.campaignId,
      input.characterId
    )
    if (!assignment) throw new CampaignAccessError('Character is not assigned to this Campaign.')
    const activeMember = await trx
      .selectFrom('campaign_memberships')
      .select('user_id')
      .where('campaign_id', '=', input.campaignId)
      .where('user_id', '=', assignment.userId)
      .where('status', '=', 'ACTIVE')
      .executeTakeFirst()
    if (!activeMember) throw new CampaignAccessError('Character owner is not an active member.')
    return createCampaignCollaborationRepository(trx).upsertSessionAttendance({
      campaignId: input.campaignId,
      sessionId: input.sessionId,
      characterId: input.characterId,
      present: input.present
    })
  })
  await broadcast(db, input.campaignId, 'TABLE', 'SESSION', input.sessionId, 'UPDATED', now())
  return attendance
}

export async function listCampaignSessionRsvps(
  db: DBLike,
  rawInput: z.input<typeof listCampaignSessionRsvpsInputSchema>,
  userId: string
): Promise<CampaignSessionRsvpDto[]> {
  const input = listCampaignSessionRsvpsInputSchema.parse(rawInput)
  const authority = await resolveCampaignAuthority(db, input.campaignId, userId)
  assertActiveCampaignMember(authority)
  await requireSession(db, input.campaignId, input.sessionId)
  return campaignSessionRsvpDtoListSchema.parse(
    await createCampaignCollaborationRepository(db).listSessionRsvps(input.sessionId)
  )
}

export async function setCampaignSessionRsvp(
  db: DBLike,
  rawInput: SetSessionRsvpInput,
  userId: string
): Promise<CampaignSessionRsvpDto> {
  const input = setCampaignSessionRsvpInputSchema.parse(rawInput)
  const rsvp = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignWritable(authority)
    const session = await requireSession(trx, input.campaignId, input.sessionId)
    if (session.status !== 'OPEN')
      throw new CampaignConflictError('Finished sessions cannot receive RSVPs.')
    return createCampaignCollaborationRepository(trx).upsertSessionRsvp({
      campaignId: input.campaignId,
      sessionId: input.sessionId,
      userId,
      response: input.response
    })
  })
  await broadcast(
    db,
    input.campaignId,
    'TABLE',
    'SESSION',
    input.sessionId,
    'UPDATED',
    rsvp.updatedAt
  )
  return rsvp
}

export async function listCampaignSessionReferencePins(
  db: DBLike,
  rawInput: z.input<typeof listCampaignSessionReferencePinsInputSchema>,
  userId: string
): Promise<CampaignSessionReferencePinDto[]> {
  const input = listCampaignSessionReferencePinsInputSchema.parse(rawInput)
  const authority = await resolveCampaignAuthority(db, input.campaignId, userId)
  assertActiveCampaignMember(authority)
  await requireSession(db, input.campaignId, input.sessionId)
  const pins = await createCampaignCollaborationRepository(db).listSessionReferencePins(
    input.sessionId
  )
  const notes = await createCampaignCollaborationRepository(db).listCampaignNoteSections(
    input.campaignId,
    authority.membership.role === 'OWNER' ? 'ALL' : 'SHARED'
  )
  const visible = await Promise.all(
    pins.map(async (pin) => {
      const target = pin.target
      if (target.kind === 'CAMPAIGN_NOTE') {
        const note = notes.find((section) => section.id === target.noteSectionId)
        return note ? { ...pin, label: note.title } : null
      }
      const label = await resolveAuthoredReferenceLabel(db, userId, target)
      return label ? { ...pin, label } : null
    })
  )
  return campaignSessionReferencePinsDtoSchema.parse(
    visible
      .filter((pin): pin is NonNullable<typeof pin> => pin !== null)
      .map(mapSessionReferencePin)
  )
}

export async function createCampaignSessionReferencePin(
  db: DBLike,
  rawInput: CreateSessionReferencePinInput,
  userId: string
): Promise<CampaignSessionReferencePinDto> {
  const input = createCampaignSessionReferencePinInputSchema.parse(rawInput)
  const pin = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    await requireSession(trx, input.campaignId, input.sessionId)
    const target = input.target
    if (target.kind === 'CAMPAIGN_NOTE') {
      const note = (
        await createCampaignCollaborationRepository(trx).listCampaignNoteSections(
          input.campaignId,
          'ALL'
        )
      ).find((section) => section.id === target.noteSectionId)
      if (!note) throw new CampaignAccessError('Campaign note is unavailable.')
    } else {
      const label = await resolveAuthoredReferenceLabel(trx, userId, target)
      if (!label) throw new CampaignAccessError('Authored record is unavailable.')
    }
    return createCampaignCollaborationRepository(trx).insertSessionReferencePin({
      campaignId: input.campaignId,
      sessionId: input.sessionId,
      target
    })
  })
  await broadcast(
    db,
    input.campaignId,
    'TABLE',
    'SESSION',
    input.sessionId,
    'UPDATED',
    pin.createdAt
  )
  const pinTarget = pin.target
  if (pinTarget.kind === 'CAMPAIGN_NOTE') {
    const note = (
      await createCampaignCollaborationRepository(db).listCampaignNoteSections(
        input.campaignId,
        'ALL'
      )
    ).find((section) => section.id === pinTarget.noteSectionId)
    if (!note) throw new CampaignAccessError('Campaign note is unavailable.')
    return mapSessionReferencePin({ ...pin, label: note.title })
  }
  const label = await resolveAuthoredReferenceLabel(db, userId, pinTarget)
  if (!label) throw new CampaignAccessError('Authored record is unavailable.')
  return mapSessionReferencePin({ ...pin, label })
}

export async function deleteCampaignSessionReferencePin(
  db: DBLike,
  rawInput: DeleteSessionReferencePinInput,
  userId: string
): Promise<{ ok: true }> {
  const input = deleteCampaignSessionReferencePinInputSchema.parse(rawInput)
  await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    await requireSession(trx, input.campaignId, input.sessionId)
    if (
      !(await createCampaignCollaborationRepository(trx).deleteSessionReferencePin(
        input.sessionId,
        input.pinId
      ))
    ) {
      throw new CampaignAccessError()
    }
  })
  await broadcast(db, input.campaignId, 'TABLE', 'SESSION', input.sessionId, 'UPDATED', now())
  return { ok: true }
}

export async function deleteCampaignSession(
  db: DBLike,
  input: DeleteSessionInput,
  userId: string
): Promise<{ ok: true }> {
  await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    if (
      !(await createCampaignCollaborationRepository(trx).deleteCampaignSession(
        input.campaignId,
        input.sessionId
      ))
    )
      throw new CampaignAccessError()
  })
  await broadcast(db, input.campaignId, 'TABLE', 'SESSION', input.sessionId, 'DELETED', now())
  return { ok: true }
}

export async function listCampaignSessionNoteSections(
  db: DBLike,
  input: z.input<typeof listCampaignSessionNoteSectionsInputSchema>,
  userId: string
): Promise<CampaignSessionNoteSectionDto[]> {
  const authority = await resolveCampaignAuthority(db, input.campaignId, userId)
  assertActiveCampaignMember(authority)
  await requireSession(db, input.campaignId, input.sessionId)
  return campaignSessionNoteSectionsDtoSchema.parse(
    (await createCampaignCollaborationRepository(db).listSessionNoteSections(input.sessionId))
      .filter((section) => section.visibility === 'SHARED' || authority.membership.role === 'OWNER')
      .map((section) => mapSessionNote(section, input.campaignId))
  )
}

export async function createCampaignSessionNoteSection(
  db: DBLike,
  input: CreateSessionNoteInput,
  userId: string
): Promise<CampaignSessionNoteSectionDto> {
  const section = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignWritable(authority)
    if (input.visibility === 'GM_PRIVATE') assertCampaignOwner(authority)
    await requireSession(trx, input.campaignId, input.sessionId)
    return createCampaignCollaborationRepository(trx).insertSessionNoteSection({
      sessionId: input.sessionId,
      title: input.title,
      content: input.content,
      visibility: input.visibility,
      kind: input.kind,
      sortOrder: input.sortOrder ?? 0,
      createdBy: userId
    })
  })
  await broadcast(
    db,
    input.campaignId,
    section.visibility === 'GM_PRIVATE' ? 'OWNER' : 'TABLE',
    'NOTE',
    section.id,
    'CREATED',
    section.createdAt
  )
  return mapSessionNote(section, input.campaignId)
}

export async function updateCampaignSessionNoteSection(
  db: DBLike,
  input: UpdateSessionNoteInput,
  userId: string
): Promise<CampaignSessionNoteSectionDto> {
  const section = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignWritable(authority)
    await requireSession(trx, input.campaignId, input.sessionId)
    const repository = createCampaignCollaborationRepository(trx)
    const existing = (await repository.listSessionNoteSections(input.sessionId)).find(
      (section) => section.id === input.sectionId
    )
    if (!existing) throw new CampaignAccessError()
    if (existing.visibility === 'GM_PRIVATE') assertCampaignOwner(authority)
    const visibility = input.visibility ?? existing.visibility
    const kind = input.kind ?? existing.kind
    if ((kind === 'SHARED_NOTE') !== (visibility === 'SHARED')) {
      throw new CampaignConflictError(
        'Shared notes must be shared; all other Session section kinds are GM-private.'
      )
    }
    if (visibility === 'GM_PRIVATE') assertCampaignOwner(authority)
    const section = await repository.updateSessionNoteSection({
      sessionId: input.sessionId,
      id: input.sectionId,
      expectedVersion: input.expectedVersion,
      title: input.title ?? existing.title,
      content: input.content ?? existing.content,
      visibility,
      kind,
      sortOrder: input.sortOrder ?? existing.sortOrder,
      updatedBy: userId,
      updatedAt: now()
    })
    if (!section) throw new CampaignConflictError()
    return section
  })
  await broadcast(
    db,
    input.campaignId,
    section.visibility === 'GM_PRIVATE' ? 'OWNER' : 'TABLE',
    'NOTE',
    section.id,
    'UPDATED',
    section.updatedAt
  )
  return mapSessionNote(section, input.campaignId)
}

export async function deleteCampaignSessionNoteSection(
  db: DBLike,
  input: DeleteSessionNoteInput,
  userId: string
): Promise<{ ok: true }> {
  const visibility = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignWritable(authority)
    await requireSession(trx, input.campaignId, input.sessionId)
    const repository = createCampaignCollaborationRepository(trx)
    const existing = (await repository.listSessionNoteSections(input.sessionId)).find(
      (section) => section.id === input.sectionId
    )
    if (!existing) throw new CampaignAccessError()
    if (existing.visibility === 'GM_PRIVATE') assertCampaignOwner(authority)
    const deleted =
      authority.membership.role === 'OWNER'
        ? await repository.deleteSessionNoteSection(input.sessionId, input.sectionId)
        : await repository.deleteSessionNoteSectionByAuthor(
            input.sessionId,
            input.sectionId,
            userId
          )
    if (!deleted) throw new CampaignAccessError()
    return existing.visibility
  })
  await broadcast(
    db,
    input.campaignId,
    visibility === 'GM_PRIVATE' ? 'OWNER' : 'TABLE',
    'NOTE',
    input.sectionId,
    'DELETED',
    now()
  )
  return { ok: true }
}
