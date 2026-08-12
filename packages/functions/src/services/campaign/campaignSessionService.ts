import {
  createCampaignRepository,
  createCampaignCollaborationRepository,
  withTransaction,
  type DBLike
} from '@artificer-toolkit/db'
import {
  campaignSessionDtoSchema,
  campaignSessionAttendanceDtoListSchema,
  campaignSessionRsvpDtoListSchema,
  campaignSessionReferencePinDtoSchema,
  campaignSessionReferencePinsDtoSchema,
  campaignSessionNoteSectionDtoSchema,
  campaignSessionNoteSectionsDtoSchema,
  campaignSessionsDtoSchema,
  type CampaignSessionDto,
  type CampaignSessionAttendanceDto,
  type CampaignSessionRsvpDto,
  type CampaignSessionReferencePinDto,
  type CampaignSessionNoteSectionDto
} from '@artificer-toolkit/schema/api/campaigns'
import type { z } from 'zod'
import {
  presentCampaignPlainText,
  presentCampaignRichText
} from '@artificer-toolkit/shared/campaign/textPolicy'
import {
  createCampaignSessionInputSchema,
  createCampaignSessionNoteSectionInputSchema,
  createCampaignSessionReferencePinInputSchema,
  deleteCampaignSessionNoteSectionInputSchema,
  deleteCampaignSessionReferencePinInputSchema,
  listCampaignSessionNoteSectionsInputSchema,
  listCampaignSessionsInputSchema,
  listCampaignSessionAttendanceInputSchema,
  listCampaignSessionRsvpsInputSchema,
  listCampaignSessionReferencePinsInputSchema,
  setCampaignSessionAttendanceInputSchema,
  setCampaignSessionRsvpInputSchema,
  finishCampaignSessionInputSchema,
  getCampaignSessionInputSchema,
  updateCampaignSessionInputSchema,
  updateCampaignSessionNoteSectionInputSchema
} from '@artificer-toolkit/schema/api/campaigns'
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
  resolveCampaignAuthority
} from './campaignService.js'
import { broadcast, lockCampaign, now } from './campaignCollaborationShared.js'
import { findCampaignCommandResult, storeCampaignCommandResult } from './campaignCommandService.js'

type CreateSessionInput = z.input<typeof createCampaignSessionInputSchema>
type UpdateSessionInput = z.input<typeof updateCampaignSessionInputSchema>
type FinishSessionInput = z.input<typeof finishCampaignSessionInputSchema>
type SetSessionAttendanceInput = z.input<typeof setCampaignSessionAttendanceInputSchema>
type SetSessionRsvpInput = z.input<typeof setCampaignSessionRsvpInputSchema>
type CreateSessionReferencePinInput = z.input<typeof createCampaignSessionReferencePinInputSchema>
type DeleteSessionReferencePinInput = z.input<typeof deleteCampaignSessionReferencePinInputSchema>
type CreateSessionNoteInput = z.input<typeof createCampaignSessionNoteSectionInputSchema>
type UpdateSessionNoteInput = z.input<typeof updateCampaignSessionNoteSectionInputSchema>
type DeleteSessionNoteInput = z.input<typeof deleteCampaignSessionNoteSectionInputSchema>

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

function mapSession(
  session: {
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
  },
  maturity: 'STANDARD' | 'MATURE'
): CampaignSessionDto {
  return campaignSessionDtoSchema.parse({
    id: session.id,
    campaignId: session.campaignId,
    sessionNumber: session.sessionNumber,
    title: session.title ? presentCampaignPlainText(session.title, maturity) : null,
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
  campaignId: string,
  maturity: 'STANDARD' | 'MATURE'
): CampaignSessionNoteSectionDto {
  const privateNote = section.visibility === 'GM_PRIVATE'
  return campaignSessionNoteSectionDtoSchema.parse({
    id: section.id,
    campaignId,
    sessionId: section.sessionId,
    authorUserId: section.createdBy,
    title: privateNote ? section.title : presentCampaignPlainText(section.title, maturity),
    content: privateNote ? section.content : presentCampaignRichText(section.content, maturity),
    visibility: section.visibility,
    kind: section.kind,
    sortOrder: section.sortOrder,
    version: section.version,
    createdAt: section.createdAt,
    updatedAt: section.updatedAt
  })
}

function mapSessionReferencePin(
  pin: {
    id: string
    campaignId: string
    sessionId: string
    target: CampaignSessionReferencePinDto['target']
    label: string
    createdAt: string
  },
  maturity: 'STANDARD' | 'MATURE'
): CampaignSessionReferencePinDto {
  return campaignSessionReferencePinDtoSchema.parse({
    ...pin,
    label: presentCampaignPlainText(pin.label, maturity)
  })
}

async function campaignMaturity(
  db: DBLike,
  campaignId: string,
  userId: string
): Promise<'STANDARD' | 'MATURE'> {
  return (await resolveCampaignAuthority(db, campaignId, userId)).campaign.contentMaturity
}

async function requireSession(db: DBLike, campaignId: string, sessionId: string) {
  const session = (
    await createCampaignCollaborationRepository(db).listCampaignSessions(campaignId)
  ).find((candidate) => candidate.id === sessionId)
  if (!session) throw new CampaignAccessError()
  return session
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
      (session) => mapSession(session, authority.campaign.contentMaturity)
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
  return mapSession(session, await campaignMaturity(db, input.campaignId, userId))
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
  return mapSession(session, await campaignMaturity(db, input.campaignId, userId))
}

export async function finishCampaignSession(
  db: DBLike,
  rawInput: FinishSessionInput,
  userId: string
): Promise<CampaignSessionDto> {
  const input = finishCampaignSessionInputSchema.parse(rawInput)
  const session = await withTransaction(db, async (trx): Promise<CampaignSessionDto> => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    const prior = await findCampaignCommandResult<CampaignSessionDto>(trx, input, 'FINISH_SESSION')
    if (prior) return campaignSessionDtoSchema.parse(prior)
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
    const result = mapSession(saved, authority.campaign.contentMaturity)
    await storeCampaignCommandResult(trx, input, 'FINISH_SESSION', result)
    return result
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
  return session
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
  return mapSession(session, authority.campaign.contentMaturity)
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
  if (authority.membership.role !== 'OWNER') return []
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
      .map((pin) => mapSessionReferencePin(pin, authority.campaign.contentMaturity))
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
  const maturity = await campaignMaturity(db, input.campaignId, userId)
  const pinTarget = pin.target
  if (pinTarget.kind === 'CAMPAIGN_NOTE') {
    const note = (
      await createCampaignCollaborationRepository(db).listCampaignNoteSections(
        input.campaignId,
        'ALL'
      )
    ).find((section) => section.id === pinTarget.noteSectionId)
    if (!note) throw new CampaignAccessError('Campaign note is unavailable.')
    return mapSessionReferencePin({ ...pin, label: note.title }, maturity)
  }
  const label = await resolveAuthoredReferenceLabel(db, userId, pinTarget)
  if (!label) throw new CampaignAccessError('Authored record is unavailable.')
  return mapSessionReferencePin({ ...pin, label }, maturity)
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
      .map((section) =>
        mapSessionNote(section, input.campaignId, authority.campaign.contentMaturity)
      )
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
  return mapSessionNote(
    section,
    input.campaignId,
    await campaignMaturity(db, input.campaignId, userId)
  )
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
  return mapSessionNote(
    section,
    input.campaignId,
    await campaignMaturity(db, input.campaignId, userId)
  )
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
