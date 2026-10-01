import { v } from 'convex/values'
import { campaignEventDtoSchema } from '@artificer-toolkit/schema/api/campaignLiveState'
import { internalMutation } from '../lib/mutations'
import { readCharacterReceiptHistory } from '../characters/documents'
import { requireFixtureAccount } from '../lib/developmentFixtures'
import { readCampaignCharacterState } from './characterState'
import { deleteReceiptHeaders, readReceiptHeader } from '../lib/receiptLedgers'

const NAME = 'Encounter execution fixture'
const limits = {
  sessions: 4,
  notes: 16,
  references: 8,
  rsvps: 8,
  attendance: 4,
  commands: 32,
  segments: 32,
  recoveries: 32,
  events: 32
} as const
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
function payload(json: string) {
  const value = campaignEventDtoSchema.shape.payload.parse(JSON.parse(json))
  check(
    typeof value === 'object' && value !== null && !Array.isArray(value),
    'Fixture recovery payload mismatch.'
  )
  check(
    typeof value.boundaryAbsoluteMinute === 'number' &&
      typeof value.boundaryKind === 'string' &&
      typeof value.characterId === 'string' &&
      typeof value.resourceKey === 'string' &&
      typeof value.characterEventId === 'string',
    'Fixture recovery payload mismatch.'
  )
  return value
}

export const removeFixtureState = internalMutation({
  args: {
    ownerUserId: v.string(),
    playerUserId: v.string(),
    campaignId: v.string(),
    characterId: v.string()
  },
  returns: v.null(),
  handler: async (ctx, input) => {
    await requireFixtureAccount(ctx, input.ownerUserId)
    await requireFixtureAccount(ctx, input.playerUserId)
    check(input.ownerUserId !== input.playerUserId, 'Fixture owner and player must differ.')
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', input.campaignId))
      .unique()
    check(
      campaign?.ownerUserId === input.ownerUserId && campaign.name === NAME,
      'Fixture Campaign ownership or name mismatch.'
    )
    const [
      character,
      memberships,
      assignments,
      sessions,
      clocks,
      commands,
      recoveries,
      events,
      runs,
      overlays
    ] = await Promise.all([
      ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', input.characterId))
        .unique(),
      ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) => q.eq('campaignId', campaign.id))
        .take(3),
      ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
        .take(2),
      ctx.db
        .query('campaignSessions')
        .withIndex('by_campaignId_sessionNumber', (q) => q.eq('campaignId', campaign.id))
        .take(limits.sessions + 1),
      ctx.db
        .query('campaignClocks')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
        .take(2),
      ctx.db
        .query('campaignCommands')
        .withIndex('by_campaignId_commandId', (q) => q.eq('campaignId', campaign.id))
        .take(limits.commands + 1),
      ctx.db
        .query('campaignClockRecoveries')
        .withIndex('by_campaignId_boundary', (q) => q.eq('campaignId', campaign.id))
        .take(limits.recoveries + 1),
      ctx.db
        .query('campaignEvents')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(limits.events + 1),
      ctx.db
        .query('encounterRuns')
        .withIndex('by_campaignId_createdAt_id', (q) => q.eq('campaignId', campaign.id))
        .take(1),
      ctx.db
        .query('campaignCharacterStates')
        .withIndex('by_campaignId_characterId', (q) => q.eq('campaignId', campaign.id))
        .take(2)
    ])
    check(
      !character || character.userId === input.playerUserId,
      'Fixture Character ownership mismatch.'
    )
    check(
      memberships.length <= 2 &&
        memberships.some((m) => m.userId === input.ownerUserId && m.role === 'OWNER') &&
        memberships.every(
          (m) =>
            (m.userId === input.ownerUserId && m.role === 'OWNER') ||
            (m.userId === input.playerUserId && m.role === 'PLAYER')
        ),
      'Fixture membership mismatch.'
    )
    check(assignments.length <= 1, 'Fixture assignment bounds exceeded.')
    if (assignments[0]) {
      check(
        assignments[0].userId === input.playerUserId &&
          assignments[0].characterId === input.characterId &&
          character !== null,
        'Fixture assignment mismatch.'
      )
      await readCampaignCharacterState(ctx, campaign.id, input.characterId)
    }
    check(
      overlays.length <= 1 &&
        overlays.every(
          (overlay) => assignments.length === 1 && overlay.characterId === input.characterId
        ),
      'Fixture overlay ownership mismatch.'
    )
    check(
      sessions.length <= limits.sessions &&
        sessions.every((s) => typeof s.title === 'string' && s.title.startsWith('P15')),
      'Fixture Session records mismatch.'
    )
    check(
      clocks.length <= 1 && runs.length === 0,
      'Fixture Clock or Encounter dependency mismatch.'
    )

    const [notes, references, rsvps, attendance, segments, characterReceipts] = await Promise.all([
      ctx.db
        .query('campaignSessionNotes')
        .withIndex('by_campaignId_sessionId_id', (q) => q.eq('campaignId', campaign.id))
        .take(limits.notes + 1),
      ctx.db
        .query('campaignSessionReferences')
        .withIndex('by_campaignId_sessionId_id', (q) => q.eq('campaignId', campaign.id))
        .take(limits.references + 1),
      ctx.db
        .query('campaignSessionRsvps')
        .withIndex('by_campaignId_sessionId_userId', (q) => q.eq('campaignId', campaign.id))
        .take(limits.rsvps + 1),
      ctx.db
        .query('campaignSessionAttendance')
        .withIndex('by_campaignId_sessionId_characterId', (q) => q.eq('campaignId', campaign.id))
        .take(limits.attendance + 1),
      ctx.db
        .query('campaignClockSegments')
        .withIndex('by_campaignId_startedAt_id', (q) => q.eq('campaignId', campaign.id))
        .take(limits.segments + 1),
      ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) => q.eq('characterId', input.characterId))
        .take(101)
    ])
    const ids = new Set(sessions.map((s) => s.id))
    check(
      notes.length <= limits.notes &&
        references.length <= limits.references &&
        rsvps.length <= limits.rsvps &&
        attendance.length <= limits.attendance &&
        segments.length <= limits.segments,
      'Fixture child bounds exceeded.'
    )
    check(
      notes.every(
        (n) =>
          ids.has(n.sessionId) &&
          [input.ownerUserId, input.playerUserId].includes(n.authorUserId) &&
          [input.ownerUserId, input.playerUserId].includes(n.updatedBy)
      ) &&
        rsvps.every(
          (r) => ids.has(r.sessionId) && [input.ownerUserId, input.playerUserId].includes(r.userId)
        ) &&
        attendance.every((a) => ids.has(a.sessionId) && a.characterId === input.characterId) &&
        references.every((r) => ids.has(r.sessionId) && r.target.kind === 'CAMPAIGN_NOTE') &&
        segments.every((s) => s.campaignId === campaign.id),
      'Fixture child ownership mismatch.'
    )
    for (const pin of references) {
      const noteSectionId = pin.target.kind === 'CAMPAIGN_NOTE' ? pin.target.noteSectionId : null
      if (!noteSectionId) throw new Error('Fixture notebook reference mismatch.')
      const notebook = await ctx.db
        .query('campaignNotebookSections')
        .withIndex('by_campaignId_id', (q) =>
          q.eq('campaignId', campaign.id).eq('id', noteSectionId)
        )
        .unique()
      check(
        notebook?.createdBy === input.ownerUserId && notebook.updatedBy === input.ownerUserId,
        'Fixture notebook reference mismatch.'
      )
    }
    check(
      commands.length <= limits.commands &&
        commands.every((c) =>
          c.commandType === 'FINISH_SESSION'
            ? ids.has(c.resultPayload.id) && c.resultPayload.campaignId === campaign.id
            : c.resultPayload.campaignId === campaign.id
        ),
      'Fixture command result mismatch.'
    )
    check(
      recoveries.length <= limits.recoveries && events.length <= limits.events,
      'Fixture audit bounds exceeded.'
    )
    const byId = new Map(events.map((e) => [e.id, e]))
    check(characterReceipts.length <= 100, 'Fixture Character receipt bounds exceeded.')
    const recoveryReceiptIds = new Set<string>()
    check(
      recoveries.every(
        (r) =>
          r.campaignId === campaign.id && r.characterId === input.characterId && byId.has(r.eventId)
      ) &&
        events.every(
          (e) =>
            e.actorUserId === input.ownerUserId &&
            e.subjectCharacterId === input.characterId &&
            [
              'CAMPAIGN_CLOCK_RESOURCE_RECOVERED',
              'CAMPAIGN_ADJUSTMENT_SAVED',
              'CAMPAIGN_ADJUSTMENT_DELETED',
              'CAMPAIGN_CONDITION_SAVED',
              'CAMPAIGN_CONDITION_DELETED'
            ].includes(e.type)
        ),
      'Fixture audit ownership mismatch.'
    )
    for (const recovery of recoveries) {
      const event = byId.get(recovery.eventId)
      check(event?.type === 'CAMPAIGN_CLOCK_RESOURCE_RECOVERED', 'Fixture recovery event mismatch.')
      const data = payload(event.payloadJson)
      check(
        data.boundaryAbsoluteMinute === recovery.boundaryAbsoluteMinute &&
          data.boundaryKind === recovery.boundaryKind &&
          data.characterId === input.characterId &&
          data.resourceKey === recovery.resourceKey,
        'Fixture recovery payload mismatch.'
      )
      const receipt = characterReceipts.find((row) => row.id === data.characterEventId)
      check(receipt?.actorId === input.ownerUserId, 'Fixture recovery receipt ownership mismatch.')
      check(
        readCharacterReceiptHistory(
          await readReceiptHeader(ctx, 'characterCommandReceipts', receipt)
        ).eventType === 'RECOVER_SHEET_RESOURCE',
        'Fixture recovery receipt command mismatch.'
      )
      recoveryReceiptIds.add(receipt.id)
    }
    check(
      events.filter((e) => e.type === 'CAMPAIGN_CLOCK_RESOURCE_RECOVERED').length ===
        recoveries.length &&
        new Set(recoveries.map((recovery) => recovery.eventId)).size === recoveries.length,
      'Fixture recovery/event identity mismatch.'
    )
    check(
      recoveryReceiptIds.size === recoveries.length &&
        characterReceipts.every(
          (receipt) => receipt.actorId === input.playerUserId || recoveryReceiptIds.has(receipt.id)
        ),
      'Fixture Character receipt ownership mismatch.'
    )

    await deleteReceiptHeaders(
      ctx,
      characterReceipts
        .filter((receipt) => recoveryReceiptIds.has(receipt.id))
        .map((header) => ({ table: 'characterCommandReceipts', header }))
    )
    for (const row of notes) await ctx.db.delete(row._id)
    for (const row of references) await ctx.db.delete(row._id)
    for (const row of rsvps) await ctx.db.delete(row._id)
    for (const row of attendance) await ctx.db.delete(row._id)
    for (const row of segments) await ctx.db.delete(row._id)
    for (const row of recoveries) await ctx.db.delete(row._id)
    for (const row of events) await ctx.db.delete(row._id)
    for (const row of commands) await ctx.db.delete(row._id)
    for (const row of sessions) await ctx.db.delete(row._id)
    if (clocks[0]) await ctx.db.delete(clocks[0]._id)
    const residual = await Promise.all([
      ctx.db
        .query('campaignSessions')
        .withIndex('by_campaignId_sessionNumber', (q) => q.eq('campaignId', campaign.id))
        .take(1),
      ctx.db
        .query('campaignSessionNotes')
        .withIndex('by_campaignId_sessionId_id', (q) => q.eq('campaignId', campaign.id))
        .take(1),
      ctx.db
        .query('campaignSessionReferences')
        .withIndex('by_campaignId_sessionId_id', (q) => q.eq('campaignId', campaign.id))
        .take(1),
      ctx.db
        .query('campaignSessionRsvps')
        .withIndex('by_campaignId_sessionId_userId', (q) => q.eq('campaignId', campaign.id))
        .take(1),
      ctx.db
        .query('campaignSessionAttendance')
        .withIndex('by_campaignId_sessionId_characterId', (q) => q.eq('campaignId', campaign.id))
        .take(1),
      ctx.db
        .query('campaignClocks')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
        .take(1),
      ctx.db
        .query('campaignClockSegments')
        .withIndex('by_campaignId_startedAt_id', (q) => q.eq('campaignId', campaign.id))
        .take(1),
      ctx.db
        .query('campaignClockRecoveries')
        .withIndex('by_campaignId_boundary', (q) => q.eq('campaignId', campaign.id))
        .take(1),
      ctx.db
        .query('campaignCommands')
        .withIndex('by_campaignId_commandId', (q) => q.eq('campaignId', campaign.id))
        .take(1),
      ctx.db
        .query('campaignEvents')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(1)
    ])
    check(
      residual.every((rows) => rows.length === 0),
      'Fixture cleanup left residual state.'
    )
    return null
  }
})
