import { v } from 'convex/values'
import { campaignStoredCommandSchema } from '@artificer-toolkit/schema/projections/campaignSessionPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { internalMutation } from '../lib/mutations'
import { requireFixtureAccount } from '../lib/developmentFixtures'
import { syncAccountUsage } from '../lib/accountUsage'
import { removeFixtureRunState } from './developmentRuns'

const FIXTURE_CAMPAIGN_NAME = 'Encounter execution fixture'

export const admitFixturePlayer = internalMutation({
  args: { ownerUserId: v.string(), playerUserId: v.string(), campaignId: v.string() },
  returns: v.null(),
  handler: async (ctx, { ownerUserId, playerUserId, campaignId }) => {
    await requireFixtureAccount(ctx, ownerUserId)
    await requireFixtureAccount(ctx, playerUserId)
    if (ownerUserId === playerUserId) throw new Error('Fixture owner and player must differ.')
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', campaignId))
      .unique()
    if (
      !campaign ||
      campaign.ownerUserId !== ownerUserId ||
      campaign.name !== FIXTURE_CAMPAIGN_NAME ||
      campaign.status !== 'ACTIVE'
    )
      throw new Error('Fixture Campaign ownership or state mismatch.')
    const memberships = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) => q.eq('campaignId', campaign.id))
      .take(7)
    if (
      memberships.length > 6 ||
      memberships.filter((membership) => membership.role === 'OWNER').length !== 1 ||
      memberships.some(
        (membership) => membership.role === 'OWNER' && membership.userId !== ownerUserId
      )
    )
      throw new Error('Fixture Campaign membership bounds exceeded.')
    const existing = memberships.find((membership) => membership.userId === playerUserId)
    if (existing) {
      if (existing.role !== 'PLAYER' || existing.status !== 'ACTIVE' || existing.leftAt !== null)
        throw new Error('Fixture player membership mismatch.')
      return null
    }
    const now = campaign.createdAt
    await ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: playerUserId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: now,
      joinedAt: now,
      leftAt: null
    })
    return null
  }
})

export const removeFixtureCampaign = internalMutation({
  args: {
    ownerUserId: v.string(),
    playerUserId: v.string(),
    campaignId: v.string(),
    characterId: v.string()
  },
  returns: v.null(),
  handler: async (ctx, { ownerUserId, playerUserId, campaignId, characterId }) => {
    await requireFixtureAccount(ctx, ownerUserId)
    await requireFixtureAccount(ctx, playerUserId)
    if (ownerUserId === playerUserId) throw new Error('Fixture owner and player must differ.')
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', campaignId))
      .unique()
    if (!campaign) return null
    if (campaign.ownerUserId !== ownerUserId || campaign.name !== FIXTURE_CAMPAIGN_NAME)
      throw new Error('Fixture Campaign ownership mismatch.')

    const sceneReferences = await Promise.all([
      ctx.db
        .query('sceneDefinitions')
        .withIndex('by_campaignId_updatedAt_id', (q) => q.eq('campaignId', campaign.id))
        .first(),
      ctx.db
        .query('campaignScenes')
        .withIndex('by_campaignId_createdAt_id', (q) => q.eq('campaignId', campaign.id))
        .first(),
      ctx.db
        .query('campaignScenePresentations')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
        .first()
    ])
    if (sceneReferences.some((reference) => reference !== null))
      throw new Error('Fixture Campaign retains Scene state; remove Runs and Scenes first.')

    const [
      character,
      memberships,
      assignments,
      overlays,
      settings,
      route,
      ownershipTransfer,
      sessions,
      commands,
      runs,
      contentShares,
      contentRemovalEvents,
      announcements,
      conversations,
      notebookSections
    ] = await Promise.all([
      ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', characterId))
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
        .query('campaignCharacterStates')
        .withIndex('by_campaignId_characterId', (q) => q.eq('campaignId', campaign.id))
        .take(2),
      ctx.db
        .query('campaignPlaySettings')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
        .unique(),
      ctx.db
        .query('authoredRouteIds')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', campaign.id))
        .unique(),
      ctx.db
        .query('campaignOwnershipTransfers')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
        .unique(),
      ctx.db
        .query('campaignSessions')
        .withIndex('by_campaignId_sessionNumber', (q) => q.eq('campaignId', campaign.id))
        .take(3),
      ctx.db
        .query('campaignCommands')
        .withIndex('by_campaignId_commandId', (q) => q.eq('campaignId', campaign.id))
        .take(2),
      ctx.db
        .query('encounterRuns')
        .withIndex('by_campaignId_createdAt_id', (q) => q.eq('campaignId', campaign.id))
        .take(8),
      ctx.db
        .query('campaignContentShares')
        .withIndex('by_campaignId_subjectKind_subjectId', (q) => q.eq('campaignId', campaign.id))
        .take(3),
      ctx.db
        .query('campaignEvents')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(5),
      ctx.db
        .query('campaignAnnouncements')
        .withIndex('by_campaignId_createdAt_publicId', (q) => q.eq('campaignId', campaign.id))
        .take(3),
      ctx.db
        .query('campaignConversations')
        .withIndex('by_campaignId_kind', (q) => q.eq('campaignId', campaign.id))
        .take(4),
      ctx.db
        .query('campaignNotebookSections')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(11)
    ])
    if (character && character.userId !== playerUserId)
      throw new Error('Fixture Character ownership mismatch.')
    let finishCommand: ReturnType<typeof campaignStoredCommandSchema.parse> | null = null
    if (commands[0]) {
      const { _id, _creationTime, ...storedCommand } = commands[0]
      finishCommand = campaignStoredCommandSchema.parse(storedCommand)
    }
    const departedPlayer = memberships.find(
      (member) =>
        member.userId === playerUserId && member.role === 'PLAYER' && member.status === 'LEFT'
    )
    const departureEvent = contentRemovalEvents.length === 1 ? contentRemovalEvents[0] : undefined
    const sceneDeparture =
      departedPlayer &&
      departureEvent &&
      checksumCanonicalJson(JSON.parse(departureEvent.payloadJson)) ===
        checksumCanonicalJson({
          reason: 'MEMBER_REMOVED',
          departingMembership: {
            userId: playerUserId,
            accessStartedAt: new Date(departedPlayer.accessStartedAt).toISOString()
          },
          receipt: {
            eventId: departureEvent.id,
            campaignVersion: campaign.version,
            removedShares: [],
            affectedCharacters: [],
            evacuatedVehicles: []
          }
        })
    if (
      memberships.length > 2 ||
      memberships.some(
        (membership) =>
          !(
            (membership.userId === ownerUserId && membership.role === 'OWNER') ||
            (membership.userId === playerUserId && membership.role === 'PLAYER')
          )
      ) ||
      assignments.length > 1 ||
      assignments.some(
        (assignment) => assignment.userId !== playerUserId || assignment.characterId !== characterId
      ) ||
      overlays.length > 1 ||
      overlays.some((overlay) => overlay.characterId !== characterId) ||
      (overlays.length > 0 && !assignments.length) ||
      sessions.length > 2 ||
      (sessions[1] !== undefined && sessions[1].status !== 'OPEN') ||
      commands.length > 1 ||
      (sessions[0]?.status === 'FINISHED' && finishCommand === null) ||
      runs.length > 7 ||
      (finishCommand !== null &&
        (finishCommand.commandType !== 'FINISH_SESSION' ||
          !sessions[0] ||
          sessions[0].status !== 'FINISHED' ||
          finishCommand.resultPayload.campaignId !== campaign.id ||
          finishCommand.resultPayload.id !== sessions[0].id ||
          finishCommand.resultPayload.status !== 'FINISHED' ||
          finishCommand.resultPayload.finishedAt === null ||
          finishCommand.resultPayload.version < 1 ||
          finishCommand.resultPayload.version > sessions[0].version)) ||
      contentShares.length > 2 ||
      contentShares.some((share) => share.sharedBy !== ownerUserId) ||
      contentRemovalEvents.length > 4 ||
      contentRemovalEvents.some(
        (event) =>
          event.actorUserId !== ownerUserId || event.type !== 'CAMPAIGN_CONTENT_SHARES_REMOVED'
      ) ||
      announcements.length > 2 ||
      announcements.some(
        (announcement) =>
          announcement.authorUserId !== ownerUserId ||
          announcement.scope !== 'TABLE' ||
          !['Notification fixture first', 'Notification fixture second'].includes(
            announcement.title
          )
      ) ||
      new Set(announcements.map((announcement) => announcement.title)).size !==
        announcements.length ||
      (announcements.length > 0 &&
        (character ||
          assignments.length > 0 ||
          overlays.length > 0 ||
          sessions.length > 0 ||
          runs.length > 0)) ||
      ((contentShares.length > 0 || (contentRemovalEvents.length > 0 && !sceneDeparture)) &&
        (character ||
          assignments.length > 0 ||
          overlays.length > 0 ||
          sessions.length > 0 ||
          runs.length > 0)) ||
      (route &&
        (route.subjectKind !== 'CAMPAIGN' ||
          route.subjectId !== campaign.id ||
          route.publicId !== campaign.publicId)) ||
      (ownershipTransfer !== null &&
        (ownershipTransfer.campaignId !== campaign.id ||
          ownershipTransfer.fromUserId !== ownerUserId ||
          ownershipTransfer.toUserId !== playerUserId))
    )
      throw new Error('Fixture Campaign dependency or ownership mismatch.')

    const allowedUsers = [ownerUserId, playerUserId].sort()
    if (
      conversations.length > 3 ||
      new Set(conversations.map((conversation) => conversation.kind)).size !==
        conversations.length ||
      conversations.some((conversation) =>
        conversation.kind === 'DIRECT'
          ? conversation.participantUserIds.join(',') !== allowedUsers.join(',')
          : conversation.participantUserIds.length !== 0
      ) ||
      notebookSections.length > 10 ||
      notebookSections.some(
        (section) => section.authorUserId !== ownerUserId || section.updatedBy !== ownerUserId
      )
    )
      throw new Error('Fixture Campaign collaboration dependency mismatch.')
    const collaboration = await Promise.all(
      conversations.map(async (conversation) => {
        const [members, entries] = await Promise.all([
          ctx.db
            .query('campaignConversationMembers')
            .withIndex('by_conversationId_userId', (q) => q.eq('conversationId', conversation.id))
            .take(3),
          ctx.db
            .query('campaignConversationEntries')
            .withIndex('by_conversationId_createdAt_id', (q) =>
              q.eq('conversationId', conversation.id)
            )
            .take(21)
        ])
        const payloads = await Promise.all(
          entries.map((entry) =>
            ctx.db
              .query('campaignConversationEntryPayloads')
              .withIndex('by_entryId', (q) => q.eq('entryId', entry.id))
              .unique()
          )
        )
        return { conversation, members, entries, payloads }
      })
    )
    const noteDependencies = await Promise.all(
      notebookSections.map(async (section) => ({
        references: await ctx.db
          .query('campaignSessionReferences')
          .withIndex('by_campaignId_noteSectionId', (q) =>
            q.eq('campaignId', campaign.id).eq('target.noteSectionId', section.id)
          )
          .take(1)
      }))
    )
    if (
      collaboration.some(
        ({ conversation, members, entries, payloads }) =>
          members.length > 2 ||
          members.some(
            (member) =>
              member.campaignId !== campaign.id ||
              !allowedUsers.includes(member.userId) ||
              (conversation.kind === 'PARTY' && member.userId === ownerUserId)
          ) ||
          entries.length > 20 ||
          entries.some(
            (entry) =>
              entry.campaignId !== campaign.id || !allowedUsers.includes(entry.authorUserId)
          ) ||
          payloads.some((payload) => payload === null)
      ) ||
      noteDependencies.some(({ references }) => references.length) ||
      ((conversations.length || notebookSections.length) &&
        (sessions.length ||
          announcements.length ||
          contentShares.length ||
          (contentRemovalEvents.length > 0 && !sceneDeparture)))
    )
      throw new Error('Fixture Campaign collaboration dependency mismatch.')

    const attendance = await Promise.all(
      sessions.map((session) =>
        ctx.db
          .query('campaignSessionAttendance')
          .withIndex('by_campaignId_sessionId_characterId', (q) =>
            q.eq('campaignId', campaign.id).eq('sessionId', session.id)
          )
          .take(2)
      )
    )
    if (
      attendance.some(
        (rows) => rows.length > 1 || rows.some((row) => row.characterId !== characterId)
      )
    )
      throw new Error('Fixture Encounter dependency bounds or ownership mismatch.')
    await removeFixtureRunState(ctx, { ownerUserId, playerUserId, campaignId, characterId })
    for (const row of attendance.flat()) await ctx.db.delete(row._id)
    if (finishCommand) await ctx.db.delete(commands[0]!._id)
    if (ownershipTransfer) await ctx.db.delete(ownershipTransfer._id)
    for (const session of sessions) await ctx.db.delete(session._id)
    for (const assignment of assignments) await ctx.db.delete(assignment._id)
    for (const overlay of overlays) await ctx.db.delete(overlay._id)
    for (const share of contentShares) await ctx.db.delete(share._id)
    for (const event of contentRemovalEvents) await ctx.db.delete(event._id)
    for (const { entries, payloads, members, conversation } of collaboration) {
      for (const payload of payloads) if (payload) await ctx.db.delete(payload._id)
      for (const entry of entries) await ctx.db.delete(entry._id)
      for (const member of members) await ctx.db.delete(member._id)
      await ctx.db.delete(conversation._id)
    }
    for (const section of notebookSections) await ctx.db.delete(section._id)
    for (const membership of memberships) await ctx.db.delete(membership._id)
    if (settings) await ctx.db.delete(settings._id)
    if (route) await ctx.db.delete(route._id)
    for (const announcement of announcements) await ctx.db.delete(announcement._id)
    await ctx.db.delete(campaign._id)
    await syncAccountUsage(ctx, 'activeHostedCampaigns', campaign.id)
    return null
  }
})
