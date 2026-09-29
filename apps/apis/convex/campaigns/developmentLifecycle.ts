import { ConvexError, convexToJson, v } from 'convex/values'
import { makeFunctionReference } from 'convex/server'
import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  developmentCampaignFixtureSchema,
  developmentCampaignDescendantsSchema,
  developmentCampaignInspectionSchema,
  developmentCampaignRemovedInputSchema,
  developmentCampaignRollbackInputSchema,
  type DevelopmentCampaignFixture,
  type DevelopmentCampaignDescendants,
  type DevelopmentCampaignInspection,
  type DevelopmentCampaignRemovedInput,
  type DevelopmentCampaignRollbackInput
} from '@artificer-toolkit/schema/api/developmentCampaignLifecycle'
import type { AuthIdentityDto } from '@artificer-toolkit/schema/api/authIdentity'
import { authoredSubjectKindSchema } from '@artificer-toolkit/schema/projections/identity'
import { CHARACTER_DRAFT_PAYLOAD_CHUNK_MAX_BYTES } from '@artificer-toolkit/schema/projections/characterPersistence'
import { action, type MutationCtx, type QueryCtx } from '../_generated/server'
import { internalQuery } from '../lib/queries'
import { requireFixtureAccount } from '../lib/developmentFixtures'

const identityReference = makeFunctionReference<'query', {}, AuthIdentityDto>('account:identity')
const MARKER = 'Injected Campaign deletion fixture rollback'
const RETAINED_CLI_BYTE_LIMIT = 8 * 1024 * 1024
const CHARACTER_DRAFT_FIXTURE_MAX_CHUNKS = Math.floor(
  RETAINED_CLI_BYTE_LIMIT / 2 / CHARACTER_DRAFT_PAYLOAD_CHUNK_MAX_BYTES
)
const inspectReference = makeFunctionReference<
  'query',
  DevelopmentCampaignFixture,
  DevelopmentCampaignInspection
>('campaigns/developmentLifecycle:inspect')
const forceReference = makeFunctionReference<'mutation', DevelopmentCampaignRollbackInput, null>(
  'campaigns/developmentLifecycleCommands:forceDeletionRollback'
)
type Ctx = QueryCtx | MutationCtx
type NativeRow = { _id: string }

async function rows<T extends NativeRow>(
  query: { take(count: number): Promise<T[]> },
  maximum: number,
  label: string
): Promise<T[]> {
  const result = await query.take(maximum + 1)
  if (result.length > maximum) throw new Error(label + ' exceeds its fixture bound.')
  return result.sort((a, b) => a._id.localeCompare(b._id))
}
async function children<T extends NativeRow>(
  ids: string[],
  read: (id: string) => Promise<T[]>,
  maximum: number,
  label: string
): Promise<T[]> {
  const result = (await Promise.all(ids.map(read))).flat()
  if (result.length > maximum) throw new Error(label + ' exceeds its fixture bound.')
  return result.sort((a, b) => a._id.localeCompare(b._id))
}
function json(tables: Record<string, NativeRow[]>): string {
  const result = JSON.stringify(convexToJson(tables))
  if (new TextEncoder().encode(result).byteLength > RETAINED_CLI_BYTE_LIMIT)
    throw new Error('Fixture inspection exceeds its retained CLI byte bound.')
  return result
}
async function fixtureGuard(ctx: Ctx, input: DevelopmentCampaignFixture, required: boolean) {
  const fixture = developmentCampaignFixtureSchema.parse(input)
  for (const userId of fixture.userIds) await requireFixtureAccount(ctx, userId)
  const campaign = await ctx.db
    .query('campaigns')
    .withIndex('by_publicId', (q) => q.eq('id', fixture.campaignId))
    .unique()
  if (
    (!campaign && required) ||
    (campaign &&
      (campaign.ownerUserId !== fixture.ownerUserId ||
        campaign.name !== 'Encounter execution fixture' ||
        campaign.gameSystemId !== fixture.gameSystemId))
  )
    throw new Error('Fixture Campaign ownership, name, or System mismatch.')
  return campaign
}

async function campaignRows(
  ctx: Ctx,
  fixture: DevelopmentCampaignFixture,
  known?: DevelopmentCampaignDescendants
) {
  const campaignId = fixture.campaignId
  const campaigns = await rows(
    ctx.db.query('campaigns').withIndex('by_publicId', (q) => q.eq('id', campaignId)),
    1,
    'campaigns'
  )
  const campaignSessions = await rows(
    ctx.db
      .query('campaignSessions')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId)),
    4,
    'campaignSessions'
  )
  const encounterRuns = await rows(
    ctx.db
      .query('encounterRuns')
      .withIndex('by_campaignId_status', (q) => q.eq('campaignId', campaignId)),
    4,
    'encounterRuns'
  )
  const campaignScenes = await rows(
    ctx.db
      .query('campaignScenes')
      .withIndex('by_campaignId_createdAt_id', (q) => q.eq('campaignId', campaignId)),
    4,
    'campaignScenes'
  )
  const sceneDefinitionSaves = await rows(
    ctx.db
      .query('sceneDefinitionSaves')
      .withIndex('by_campaignId_commandId', (q) => q.eq('settings.campaignId', campaignId)),
    8,
    'sceneDefinitionSaves'
  )
  const campaignConversations = await rows(
    ctx.db
      .query('campaignConversations')
      .withIndex('by_campaignId_kind', (q) => q.eq('campaignId', campaignId)),
    8,
    'campaignConversations'
  )
  const campaignConversationEntries = await rows(
    ctx.db
      .query('campaignConversationEntries')
      .withIndex('by_campaignId_authorUserId_createdAt', (q) => q.eq('campaignId', campaignId)),
    32,
    'campaignConversationEntries'
  )
  const socialListings = await rows(
    ctx.db
      .query('socialListings')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId)),
    1,
    'socialListings'
  )
  const ids = (current: string[], before: string[] = []) =>
    [...new Set([...current, ...before])].sort()
  const sceneIds = ids(
    campaignScenes.map((row) => row.id),
    known?.sceneIds
  )
  const listingIds = ids(
    socialListings.map((row) => row.id),
    known?.listingIds
  )
  const sceneFogSaves = await children(
    sceneIds,
    (id) =>
      rows(
        ctx.db.query('sceneFogSaves').withIndex('by_sceneId_commandId', (q) => q.eq('sceneId', id)),
        8,
        'sceneFogSaves'
      ),
    8,
    'sceneFogSaves'
  )
  const socialApplications = await children(
    listingIds,
    (id) =>
      rows(
        ctx.db
          .query('socialApplications')
          .withIndex('by_listingId_status', (q) => q.eq('listingId', id)),
        32,
        'socialApplications'
      ),
    32,
    'socialApplications'
  )
  const campaignVehicleCleanupJobs = await rows(
    ctx.db
      .query('campaignVehicleCleanupJobs')
      .withIndex('by_campaignId_status_id', (q) => q.eq('grant.campaignId', campaignId)),
    8,
    'campaignVehicleCleanupJobs'
  )
  const cleanupJobIds = ids(
    campaignVehicleCleanupJobs.map((job) => job.id),
    known?.cleanupJobIds
  )
  const descendants = developmentCampaignDescendantsSchema.parse({
    sessionIds: ids(
      campaignSessions.map((row) => row.id),
      known?.sessionIds
    ),
    encounterIds: ids(
      encounterRuns.map((row) => row.id),
      known?.encounterIds
    ),
    sceneIds,
    definitionSaveIds: ids(
      sceneDefinitionSaves.map((row) => row.id),
      known?.definitionSaveIds
    ),
    fogSaveIds: ids(
      sceneFogSaves.map((row) => row.id),
      known?.fogSaveIds
    ),
    conversationIds: ids(
      campaignConversations.map((row) => row.id),
      known?.conversationIds
    ),
    entryIds: ids(
      campaignConversationEntries.map((row) => row.id),
      known?.entryIds
    ),
    listingIds,
    applicationIds: ids(
      socialApplications.map((row) => row.id),
      known?.applicationIds
    ),
    cleanupJobIds
  })
  const campaignCopyJobs = await rows(
    ctx.db
      .query('campaignCopyJobs')
      .withIndex('by_sourceCampaignId_id', (q) => q.eq('command.campaignId', campaignId)),
    8,
    'campaignCopyJobs'
  )
  if (campaignCopyJobs.some((job) => !fixture.userIds.includes(job.ownerUserId)))
    throw new Error('Fixture copy job owner is outside its reserved account scope.')
  const campaignCopyStagedNotebookSections = await children(
    campaignCopyJobs
      .filter((job) => job.status !== 'COMPLETED')
      .map((job) => job.destinationCampaignId),
    (id) =>
      rows(
        ctx.db
          .query('campaignNotebookSections')
          .withIndex('by_campaignId_id', (q) => q.eq('campaignId', id)),
        32,
        'Campaign copy staged notebook sections'
      ),
    32,
    'campaignCopyStagedNotebookSections'
  )
  const campaignVehicleCleanupTotals = await children(
    cleanupJobIds,
    (id) =>
      rows(
        ctx.db
          .query('campaignVehicleCleanupTotals')
          .withIndex('by_jobId_slot', (q) => q.eq('jobId', id)),
        200,
        'campaignVehicleCleanupTotals'
      ),
    200,
    'campaignVehicleCleanupTotals'
  )
  const campaignVehicleCleanupSegments = await children(
    cleanupJobIds,
    (id) =>
      rows(
        ctx.db
          .query('campaignVehicleCleanupSegments')
          .withIndex('by_jobId_sequence', (q) => q.eq('jobId', id)),
        200,
        'campaignVehicleCleanupSegments'
      ),
    200,
    'campaignVehicleCleanupSegments'
  )
  const tables = {
    campaigns,
    campaignCopyJobs,
    campaignCopyStagedNotebookSections,
    campaignVehicleCleanupJobs,
    campaignVehicleCleanupTotals,
    campaignVehicleCleanupSegments,
    campaignSessions,
    encounterRuns,
    campaignScenes,
    sceneDefinitionSaves,
    campaignConversations,
    campaignConversationEntries,
    socialListings,
    sceneFogSaves,
    socialApplications,
    authoredRouteIds: await rows(
      ctx.db
        .query('authoredRouteIds')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', campaignId)),
      1,
      'Campaign route'
    ),
    accountUsageEntries: await rows(
      ctx.db
        .query('accountUsageEntries')
        .withIndex('by_resource_sourceId', (q) =>
          q.eq('resource', 'activeHostedCampaigns').eq('sourceId', campaignId)
        ),
      1,
      'Campaign usage'
    ),
    sceneVisionRevisions: [
      ...(await rows(
        ctx.db
          .query('sceneVisionRevisions')
          .withIndex('by_scope_id', (q) => q.eq('scope', 'CAMPAIGN').eq('id', campaignId)),
        1,
        'Campaign vision marker'
      )),
      ...(await rows(
        ctx.db
          .query('sceneVisionRevisions')
          .withIndex('by_scope_id', (q) => q.eq('scope', 'PLAY').eq('id', campaignId)),
        1,
        'Campaign play vision marker'
      ))
    ].sort((a, b) => a._id.localeCompare(b._id)),
    campaignMemberships: await rows(
      ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) => q.eq('campaignId', campaignId)),
      4,
      'campaignMemberships'
    ),
    campaignPlaySettings: await rows(
      ctx.db
        .query('campaignPlaySettings')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId)),
      1,
      'campaignPlaySettings'
    ),
    campaignCharacterAssignments: await rows(
      ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId)),
      4,
      'campaignCharacterAssignments'
    ),
    campaignCharacterStates: await rows(
      ctx.db
        .query('campaignCharacterStates')
        .withIndex('by_campaignId_characterId', (q) => q.eq('campaignId', campaignId)),
      4,
      'campaignCharacterStates'
    ),
    campaignContentShares: await rows(
      ctx.db
        .query('campaignContentShares')
        .withIndex('by_campaignId_subjectKind_subjectId', (q) => q.eq('campaignId', campaignId)),
      32,
      'campaignContentShares'
    ),
    campaignEvents: await rows(
      ctx.db
        .query('campaignEvents')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId)),
      200,
      'campaignEvents'
    ),
    campaignOwnershipTransfers: await rows(
      ctx.db
        .query('campaignOwnershipTransfers')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId)),
      1,
      'campaignOwnershipTransfers'
    ),
    campaignSessionReferences: await rows(
      ctx.db
        .query('campaignSessionReferences')
        .withIndex('by_campaignId_sessionId_id', (q) => q.eq('campaignId', campaignId)),
      32,
      'campaignSessionReferences'
    ),
    campaignSessionAttendance: await rows(
      ctx.db
        .query('campaignSessionAttendance')
        .withIndex('by_campaignId_sessionId_characterId', (q) => q.eq('campaignId', campaignId)),
      32,
      'campaignSessionAttendance'
    ),
    campaignSessionRsvps: await rows(
      ctx.db
        .query('campaignSessionRsvps')
        .withIndex('by_campaignId_sessionId_userId', (q) => q.eq('campaignId', campaignId)),
      32,
      'campaignSessionRsvps'
    ),
    campaignSessionNotes: await rows(
      ctx.db
        .query('campaignSessionNotes')
        .withIndex('by_campaignId_sessionId_id', (q) => q.eq('campaignId', campaignId)),
      32,
      'campaignSessionNotes'
    ),
    campaignCommands: await rows(
      ctx.db
        .query('campaignCommands')
        .withIndex('by_campaignId_commandId', (q) => q.eq('campaignId', campaignId)),
      200,
      'campaignCommands'
    ),
    campaignClocks: await rows(
      ctx.db
        .query('campaignClocks')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId)),
      1,
      'campaignClocks'
    ),
    campaignClockSegments: await rows(
      ctx.db
        .query('campaignClockSegments')
        .withIndex('by_campaignId_startedAt_id', (q) => q.eq('campaignId', campaignId)),
      32,
      'campaignClockSegments'
    ),
    campaignClockRecoveries: await rows(
      ctx.db
        .query('campaignClockRecoveries')
        .withIndex('by_campaignId_boundary', (q) => q.eq('campaignId', campaignId)),
      200,
      'campaignClockRecoveries'
    ),
    campaignNotebookSections: await rows(
      ctx.db
        .query('campaignNotebookSections')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId)),
      32,
      'campaignNotebookSections'
    ),
    campaignPartyCurrencies: await rows(
      ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId)),
      200,
      'campaignPartyCurrencies'
    ),
    campaignPartyCurrencyGroups: await rows(
      ctx.db
        .query('campaignPartyCurrencyGroups')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId)),
      100,
      'campaignPartyCurrencyGroups'
    ),
    campaignPartyItems: await rows(
      ctx.db
        .query('campaignPartyItems')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId)),
      100,
      'campaignPartyItems'
    ),
    campaignPartyInventories: await rows(
      ctx.db
        .query('campaignPartyInventories')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId)),
      8,
      'campaignPartyInventories'
    ),
    campaignCurrencyDenominations: await rows(
      ctx.db
        .query('campaignCurrencyDenominations')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId)),
      32,
      'campaignCurrencyDenominations'
    ),
    campaignCurrencySystems: await rows(
      ctx.db
        .query('campaignCurrencySystems')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId)),
      8,
      'campaignCurrencySystems'
    ),
    campaignVehicles: await rows(
      ctx.db
        .query('campaignVehicles')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId)),
      4,
      'campaignVehicles'
    ),
    campaignAttachments: await rows(
      ctx.db
        .query('campaignAttachments')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId)),
      8,
      'campaignAttachments'
    ),
    campaignAnnouncements: await rows(
      ctx.db
        .query('campaignAnnouncements')
        .withIndex('by_campaignId_publicId', (q) => q.eq('campaignId', campaignId)),
      32,
      'campaignAnnouncements'
    ),
    campaignScenePresentations: await rows(
      ctx.db
        .query('campaignScenePresentations')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId)),
      4,
      'campaignScenePresentations'
    ),
    sceneDefinitions: await rows(
      ctx.db
        .query('sceneDefinitions')
        .withIndex('by_campaignId_updatedAt_id', (q) => q.eq('campaignId', campaignId)),
      8,
      'sceneDefinitions'
    ),
    encounterRunCommands: await rows(
      ctx.db
        .query('encounterRunCommands')
        .withIndex('by_campaignId_commandId', (q) => q.eq('campaignId', campaignId)),
      200,
      'encounterRunCommands'
    ),
    encounterRuleOccurrences: await rows(
      ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_campaignId_rootCommandId', (q) => q.eq('campaignId', campaignId)),
      200,
      'encounterRuleOccurrences'
    ),
    encounterRuleReceipts: await rows(
      ctx.db
        .query('encounterRuleReceipts')
        .withIndex('by_campaignId_commandId', (q) => q.eq('campaignId', campaignId)),
      200,
      'encounterRuleReceipts'
    ),
    encounterRunActors: await children(
      descendants.encounterIds,
      (id) =>
        rows(
          ctx.db
            .query('encounterRunActors')
            .withIndex('by_encounterId_id', (q) => q.eq('encounterId', id)),
          44,
          'encounterRunActors'
        ),
      44,
      'encounterRunActors'
    ),
    encounterActorProjectionFacts: await children(
      descendants.encounterIds,
      (id) =>
        rows(
          ctx.db
            .query('encounterActorProjectionFacts')
            .withIndex('by_encounterId_id', (q) => q.eq('encounterId', id)),
          44,
          'encounterActorProjectionFacts'
        ),
      44,
      'encounterActorProjectionFacts'
    ),
    encounterSourceProjectionFacts: await children(
      descendants.encounterIds,
      (id) =>
        rows(
          ctx.db
            .query('encounterSourceProjectionFacts')
            .withIndex('by_encounterId_checksum', (q) => q.eq('encounterId', id)),
          44,
          'encounterSourceProjectionFacts'
        ),
      44,
      'encounterSourceProjectionFacts'
    ),
    encounterPendingSnapshotParts: await children(
      descendants.encounterIds,
      (id) =>
        rows(
          ctx.db
            .query('encounterPendingSnapshotParts')
            .withIndex('by_encounterId', (q) => q.eq('encounterId', id)),
          200,
          'encounterPendingSnapshotParts'
        ),
      200,
      'encounterPendingSnapshotParts'
    ),
    encounterSceneBindings: await children(
      descendants.encounterIds,
      (id) =>
        rows(
          ctx.db
            .query('encounterSceneBindings')
            .withIndex('by_encounterId', (q) => q.eq('encounterId', id)),
          4,
          'encounterSceneBindings'
        ),
      4,
      'encounterSceneBindings'
    ),
    encounterActorTokenBindings: await children(
      descendants.encounterIds,
      (id) =>
        rows(
          ctx.db
            .query('encounterActorTokenBindings')
            .withIndex('by_encounterId_actorId', (q) => q.eq('encounterId', id)),
          44,
          'encounterActorTokenBindings'
        ),
      44,
      'encounterActorTokenBindings'
    ),
    encounterInitiativeParticipants: await children(
      descendants.encounterIds,
      (id) =>
        rows(
          ctx.db
            .query('encounterInitiativeParticipants')
            .withIndex('by_encounterId_round_actorId', (q) => q.eq('encounterId', id)),
          200,
          'encounterInitiativeParticipants'
        ),
      200,
      'encounterInitiativeParticipants'
    ),
    encounterInitiativeSides: await children(
      descendants.encounterIds,
      (id) =>
        rows(
          ctx.db
            .query('encounterInitiativeSides')
            .withIndex('by_encounterId_round_sideId', (q) => q.eq('encounterId', id)),
          80,
          'encounterInitiativeSides'
        ),
      80,
      'encounterInitiativeSides'
    ),
    encounterInitiativeRounds: await children(
      descendants.encounterIds,
      (id) =>
        rows(
          ctx.db
            .query('encounterInitiativeRounds')
            .withIndex('by_encounterId_round', (q) => q.eq('encounterId', id)),
          40,
          'encounterInitiativeRounds'
        ),
      40,
      'encounterInitiativeRounds'
    ),
    sceneGeometrySaves: await children(
      descendants.sceneIds,
      (id) =>
        rows(
          ctx.db
            .query('sceneGeometrySaves')
            .withIndex('by_sceneId_commandId', (q) => q.eq('sceneId', id)),
          32,
          'sceneGeometrySaves'
        ),
      32,
      'sceneGeometrySaves'
    ),
    sceneFogLayers: await children(
      descendants.sceneIds,
      (id) =>
        rows(
          ctx.db
            .query('sceneFogLayers')
            .withIndex('by_sceneId_ownerUserId', (q) => q.eq('sceneId', id)),
          16,
          'sceneFogLayers'
        ),
      16,
      'sceneFogLayers'
    ),
    sceneLiveStates: await children(
      descendants.sceneIds,
      (id) =>
        rows(
          ctx.db.query('sceneLiveStates').withIndex('by_sceneId', (q) => q.eq('sceneId', id)),
          4,
          'sceneLiveStates'
        ),
      4,
      'sceneLiveStates'
    ),
    sceneLiveEntities: await children(
      descendants.sceneIds,
      (id) =>
        rows(
          ctx.db
            .query('sceneLiveEntities')
            .withIndex('by_sceneId_collection_entityId', (q) => q.eq('sceneId', id)),
          200,
          'sceneLiveEntities'
        ),
      200,
      'sceneLiveEntities'
    ),
    sceneLiveCommands: await children(
      descendants.sceneIds,
      (id) =>
        rows(
          ctx.db
            .query('sceneLiveCommands')
            .withIndex('by_sceneId_commandId', (q) => q.eq('sceneId', id)),
          200,
          'sceneLiveCommands'
        ),
      200,
      'sceneLiveCommands'
    ),
    sceneDefinitionEntities: await children(
      descendants.definitionSaveIds,
      (id) =>
        rows(
          ctx.db.query('sceneDefinitionEntities').withIndex('by_saveId', (q) => q.eq('saveId', id)),
          200,
          'sceneDefinitionEntities'
        ),
      200,
      'sceneDefinitionEntities'
    ),
    sceneFogChunks: await children(
      descendants.fogSaveIds,
      (id) =>
        rows(
          ctx.db.query('sceneFogChunks').withIndex('by_saveId_ordinal', (q) => q.eq('saveId', id)),
          200,
          'sceneFogChunks'
        ),
      200,
      'sceneFogChunks'
    ),
    campaignConversationMembers: await children(
      descendants.conversationIds,
      (id) =>
        rows(
          ctx.db
            .query('campaignConversationMembers')
            .withIndex('by_conversationId_userId', (q) => q.eq('conversationId', id)),
          32,
          'campaignConversationMembers'
        ),
      32,
      'campaignConversationMembers'
    ),
    campaignConversationEntryPayloads: await children(
      descendants.entryIds,
      (id) =>
        rows(
          ctx.db
            .query('campaignConversationEntryPayloads')
            .withIndex('by_entryId', (q) => q.eq('entryId', id)),
          32,
          'campaignConversationEntryPayloads'
        ),
      32,
      'campaignConversationEntryPayloads'
    ),
    campaignInvites: await children(
      descendants.listingIds,
      (id) =>
        rows(
          ctx.db
            .query('campaignInvites')
            .withIndex('by_listingId_status', (q) => q.eq('listingId', id)),
          32,
          'campaignInvites'
        ),
      32,
      'campaignInvites'
    ),
    socialModerationActions: await children(
      descendants.listingIds,
      (id) =>
        rows(
          ctx.db
            .query('socialModerationActions')
            .withIndex('by_affectedListingId', (q) => q.eq('affectedListingId', id)),
          32,
          'socialModerationActions'
        ),
      32,
      'socialModerationActions'
    ),
    socialReports: [
      ...(await children(
        descendants.listingIds,
        (id) =>
          rows(
            ctx.db
              .query('socialReports')
              .withIndex('by_targetListingId', (q) => q.eq('targetListingId', id)),
            32,
            'Listing reports'
          ),
        32,
        'Listing reports'
      )),
      ...(await children(
        descendants.applicationIds,
        (id) =>
          rows(
            ctx.db
              .query('socialReports')
              .withIndex('by_targetApplicationId_queuePriority_resolvedAt', (q) =>
                q.eq('targetApplicationId', id)
              ),
            32,
            'Application reports'
          ),
        32,
        'Application reports'
      ))
    ].sort((a, b) => a._id.localeCompare(b._id))
  }
  if (
    tables.campaignMemberships.some((row) => !fixture.userIds.includes(row.userId)) ||
    tables.campaignCharacterAssignments.some((row) => !fixture.userIds.includes(row.userId))
  )
    throw new Error('Fixture Campaign contains an account outside its reserved scope.')
  for (const assignment of tables.campaignCharacterAssignments) {
    const character = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', assignment.characterId))
      .unique()
    if (!character || character.userId !== assignment.userId)
      throw new Error('Fixture assignment Character ownership mismatch.')
  }
  return { tables, descendants }
}

async function personalRows(ctx: Ctx, fixture: DevelopmentCampaignFixture) {
  const users = fixture.userIds
  const userProfiles = await children(
    users,
    (id) =>
      rows(
        ctx.db.query('userProfiles').withIndex('by_userId', (q) => q.eq('userId', id)),
        1,
        'userProfiles'
      ),
    4,
    'userProfiles'
  )
  const characters = await children(
    users,
    (id) =>
      rows(
        ctx.db.query('characters').withIndex('by_userId', (q) => q.eq('userId', id)),
        8,
        'characters'
      ),
    32,
    'characters'
  )
  const characterDrafts = await children(
    users,
    (id) =>
      rows(
        ctx.db.query('characterDrafts').withIndex('by_userId_updatedAt', (q) => q.eq('userId', id)),
        8,
        'characterDrafts'
      ),
    32,
    'characterDrafts'
  )
  const authoredRoots = await children(
    users,
    (id) =>
      rows(
        ctx.db.query('authoredRoots').withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', id)),
        32,
        'authoredRoots'
      ),
    128,
    'authoredRoots'
  )
  const authoredDrafts = await children(
    users,
    (id) =>
      rows(
        ctx.db.query('authoredDrafts').withIndex('by_userId', (q) => q.eq('userId', id)),
        32,
        'authoredDrafts'
      ),
    128,
    'authoredDrafts'
  )
  const contentSources = await children(
    users,
    (id) =>
      rows(
        ctx.db
          .query('contentSources')
          .withIndex('by_gameSystemId_kind_ownerUserId', (q) =>
            q.eq('gameSystemId', fixture.gameSystemId).eq('kind', 'USER').eq('ownerUserId', id)
          ),
        8,
        'contentSources'
      ),
    32,
    'contentSources'
  )
  const encounterBlueprints = await children(
    users,
    (id) =>
      rows(
        ctx.db
          .query('encounterBlueprints')
          .withIndex('by_ownerUserId_commandId', (q) => q.eq('ownerUserId', id)),
        8,
        'encounterBlueprints'
      ),
    32,
    'encounterBlueprints'
  )
  const otherCampaigns = (
    await children(
      users,
      (id) =>
        rows(
          ctx.db
            .query('campaigns')
            .withIndex('by_ownerUserId_status', (q) => q.eq('ownerUserId', id)),
          8,
          'owned Campaigns'
        ),
      32,
      'owned Campaigns'
    )
  ).filter((row) => row.id !== fixture.campaignId)
  const characterIds = [
    ...new Set([
      ...characters.map((row) => row.id),
      ...characterDrafts.map((row) => row.characterId)
    ])
  ].sort()
  const characterDraftPayloads = await children(
    characterIds,
    (id) =>
      rows(
        ctx.db
          .query('characterDraftPayloads')
          .withIndex('by_characterId_id', (q) => q.eq('characterId', id)),
        32,
        'characterDraftPayloads'
      ),
    64,
    'characterDraftPayloads'
  )
  const characterDraftPayloadBytes = characterDraftPayloads.reduce(
    (total, payload) =>
      total +
      (typeof payload.totalByteLength === 'number'
        ? payload.totalByteLength
        : typeof payload.payloadJson === 'string'
          ? new TextEncoder().encode(payload.payloadJson).byteLength
          : 0),
    0
  )
  if (characterDraftPayloadBytes > RETAINED_CLI_BYTE_LIMIT / 2)
    throw new Error('Character draft payloads exceed their fixture byte bound.')
  const characterDraftPayloadChunks = await children(
    characterIds,
    (id) =>
      rows(
        ctx.db
          .query('characterDraftPayloadChunks')
          .withIndex('by_characterId_payloadId_chunkIndex', (q) => q.eq('characterId', id)),
        CHARACTER_DRAFT_FIXTURE_MAX_CHUNKS,
        'characterDraftPayloadChunks'
      ),
    CHARACTER_DRAFT_FIXTURE_MAX_CHUNKS,
    'characterDraftPayloadChunks'
  )
  const subjectIds = [
    ...new Set([
      ...characterIds,
      ...authoredRoots.map((row) => row.id),
      ...authoredDrafts.map((row) => row.subjectId),
      ...encounterBlueprints.map((row) => row.id),
      ...otherCampaigns.map((row) => row.id)
    ])
  ].sort()
  const reusableDefinitions = await children(
    users,
    (id) =>
      rows(
        ctx.db
          .query('reusableDefinitions')
          .withIndex('by_gameSystemId_owner_family_label_id', (q) =>
            q.eq('gameSystemId', fixture.gameSystemId).eq('ownerUserId', id)
          ),
        32,
        'reusableDefinitions'
      ),
    128,
    'reusableDefinitions'
  )
  const authoredCatalogueOwnerCounts = (
    await Promise.all(
      authoredSubjectKindSchema.options.map((kind) =>
        children(
          users,
          (id) =>
            rows(
              ctx.db
                .query('authoredCatalogueOwnerCounts')
                .withIndex('by_subjectKind_ownerUserId', (q) =>
                  q.eq('subjectKind', kind).eq('ownerUserId', id)
                ),
              1,
              'owner catalogue counts'
            ),
          4,
          'owner catalogue counts'
        )
      )
    )
  )
    .flat()
    .sort((a, b) => a._id.localeCompare(b._id))
  const socialProfiles = await children(
    users,
    (id) =>
      rows(
        ctx.db.query('socialProfiles').withIndex('by_userId', (q) => q.eq('userId', id)),
        1,
        'socialProfiles'
      ),
    4,
    'socialProfiles'
  )
  const socialProfileIds = socialProfiles.map((row) => row.id)
  const socialProfileInvalidations = await children(
    users,
    (id) =>
      rows(
        ctx.db
          .query('socialProfileInvalidations')
          .withIndex('by_userId_generation', (q) => q.eq('userId', id)),
        32,
        'socialProfileInvalidations'
      ),
    128,
    'socialProfileInvalidations'
  )
  const socialBlocks = Array.from(
    new Map(
      (
        await Promise.all(
          socialProfileIds.flatMap((profileId) => [
            rows(
              ctx.db
                .query('socialBlocks')
                .withIndex('by_blockerProfileId_blockedProfileId', (q) =>
                  q.eq('blockerProfileId', profileId)
                ),
              32,
              'socialBlocks'
            ),
            rows(
              ctx.db
                .query('socialBlocks')
                .withIndex('by_blockedProfileId_blockerProfileId', (q) =>
                  q.eq('blockedProfileId', profileId)
                ),
              32,
              'socialBlocks'
            )
          ])
        )
      )
        .flat()
        .map((row) => [row._id, row] as const)
    ).values()
  ).sort((a, b) => a._id.localeCompare(b._id))
  if (socialBlocks.length > 128) throw new Error('socialBlocks exceeds its fixture bound.')
  const socialBlockInvalidations = Array.from(
    new Map(
      (
        await Promise.all(
          socialProfileIds.flatMap((profileId) => [
            rows(
              ctx.db
                .query('socialBlockInvalidations')
                .withIndex('by_firstProfileId_secondUserId_generation', (q) =>
                  q.eq('firstProfileId', profileId)
                ),
              32,
              'socialBlockInvalidations'
            ),
            rows(
              ctx.db
                .query('socialBlockInvalidations')
                .withIndex('by_secondProfileId_firstUserId_generation', (q) =>
                  q.eq('secondProfileId', profileId)
                ),
              32,
              'socialBlockInvalidations'
            )
          ])
        )
      )
        .flat()
        .map((row) => [row._id, row] as const)
    ).values()
  ).sort((a, b) => a._id.localeCompare(b._id))
  if (socialBlockInvalidations.length > 128)
    throw new Error('socialBlockInvalidations exceeds its fixture bound.')
  return {
    userProfiles,
    characters,
    characterDrafts,
    characterDraftPayloads,
    characterDraftPayloadChunks,
    authoredRoots,
    authoredDrafts,
    contentSources,
    encounterBlueprints,
    otherCampaigns,
    accountEntitlements: await children(
      users,
      (id) =>
        rows(
          ctx.db.query('accountEntitlements').withIndex('by_userId', (q) => q.eq('userId', id)),
          1,
          'accountEntitlements'
        ),
      4,
      'accountEntitlements'
    ),
    characterCommandReceipts: await children(
      characterIds,
      (id) =>
        rows(
          ctx.db
            .query('characterCommandReceipts')
            .withIndex('by_characterId_commandId', (q) => q.eq('characterId', id)),
          200,
          'characterCommandReceipts'
        ),
      200,
      'characterCommandReceipts'
    ),
    authoredVersions: await children(
      authoredRoots.map((row) => row.id),
      (id) =>
        rows(
          ctx.db.query('authoredVersions').withIndex('by_id_version', (q) => q.eq('id', id)),
          32,
          'authoredVersions'
        ),
      200,
      'authoredVersions'
    ),
    authoredRouteIds: await children(
      subjectIds,
      (id) =>
        rows(
          ctx.db.query('authoredRouteIds').withIndex('by_subjectId', (q) => q.eq('subjectId', id)),
          1,
          'personal route'
        ),
      200,
      'personal routes'
    ),
    authoredCatalogueCounts: await children(
      contentSources.map((row) => row.id),
      (id) =>
        rows(
          ctx.db
            .query('authoredCatalogueCounts')
            .withIndex('by_source_kind', (q) => q.eq('contentSourceId', id)),
          32,
          'source catalogue counts'
        ),
      200,
      'source catalogue counts'
    ),
    authoredCatalogueOwnerCounts,
    socialProfiles,
    socialProfileInvalidations,
    socialBlocks,
    socialBlockInvalidations,
    reusableDefinitions,
    reusableDefinitionDrafts: await children(
      reusableDefinitions.map((row) => row.id),
      (id) =>
        rows(
          ctx.db
            .query('reusableDefinitionDrafts')
            .withIndex('by_definitionId', (q) => q.eq('definitionId', id)),
          1,
          'definition draft'
        ),
      128,
      'definition drafts'
    ),
    encounterBlueprintUpdates: await children(
      encounterBlueprints.map((row) => row.id),
      (id) =>
        rows(
          ctx.db
            .query('encounterBlueprintUpdates')
            .withIndex('by_blueprintId', (q) => q.eq('blueprintId', id)),
          32,
          'Blueprint updates'
        ),
      200,
      'Blueprint updates'
    ),
    accountUsageEntries: await children(
      users,
      (id) =>
        rows(
          ctx.db
            .query('accountUsageEntries')
            .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', id)),
          200,
          'accountUsageEntries'
        ),
      200,
      'accountUsageEntries'
    ),
    mediaAssets: await children(
      users,
      (id) =>
        rows(
          ctx.db.query('mediaAssets').withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', id)),
          32,
          'mediaAssets'
        ),
      128,
      'mediaAssets'
    ),
    notificationDeliveryIntents: await children(
      users,
      (id) =>
        rows(
          ctx.db
            .query('notificationDeliveryIntents')
            .withIndex('by_recipientUserId', (q) => q.eq('recipientUserId', id)),
          200,
          'notificationDeliveryIntents'
        ),
      200,
      'notificationDeliveryIntents'
    ),
    notificationFeedItems: await children(
      users,
      (id) =>
        rows(
          ctx.db
            .query('notificationFeedItems')
            .withIndex('by_userId_occurredAt_id', (q) => q.eq('userId', id)),
          200,
          'notificationFeedItems'
        ),
      200,
      'notificationFeedItems'
    ),
    userRollHistory: await children(
      users,
      (id) =>
        rows(
          ctx.db
            .query('userRollHistory')
            .withIndex('by_userId_createdAt_id', (q) => q.eq('userId', id)),
          32,
          'userRollHistory'
        ),
      128,
      'userRollHistory'
    ),
    sceneVisionRevisions: [
      ...(await rows(
        ctx.db
          .query('sceneVisionRevisions')
          .withIndex('by_scope_id', (q) => q.eq('scope', 'SYSTEM').eq('id', fixture.gameSystemId)),
        1,
        'System vision marker'
      )),
      ...(await children(
        characterIds,
        (id) =>
          rows(
            ctx.db
              .query('sceneVisionRevisions')
              .withIndex('by_scope_id', (q) => q.eq('scope', 'CHARACTER').eq('id', id)),
            1,
            'Character vision marker'
          ),
        32,
        'Character vision markers'
      ))
    ].sort((a, b) => a._id.localeCompare(b._id))
  }
}

export const inspect = internalQuery({
  args: zodToConvex(developmentCampaignFixtureSchema),
  returns: zodToConvex(developmentCampaignInspectionSchema),
  handler: async (ctx, fixture): Promise<DevelopmentCampaignInspection> => {
    await fixtureGuard(ctx, fixture, true)
    const state = await campaignRows(ctx, fixture)
    const result = developmentCampaignInspectionSchema.parse({
      campaignStateJson: json(state.tables),
      personalStateJson: json(await personalRows(ctx, fixture)),
      descendants: state.descendants
    })
    if (new TextEncoder().encode(JSON.stringify(result)).byteLength > 8 * 1024 * 1024)
      throw new Error('Fixture inspection exceeds its retained CLI byte bound.')
    return result
  }
})
export const inspectPersonal = internalQuery({
  args: zodToConvex(developmentCampaignFixtureSchema),
  returns: v.string(),
  handler: async (ctx, fixture): Promise<string> => {
    await fixtureGuard(ctx, fixture, false)
    return json(await personalRows(ctx, fixture))
  }
})
export async function assertAbsent(
  ctx: Ctx,
  input: DevelopmentCampaignRemovedInput
): Promise<null> {
  const checked = developmentCampaignRemovedInputSchema.parse(input)
  await fixtureGuard(ctx, checked.fixture, false)
  const { tables } = await campaignRows(ctx, checked.fixture, checked.descendants)
  for (const [name, contents] of Object.entries(tables)) {
    if (contents.length) throw new Error('Fixture Campaign cleanup retains ' + name + '.')
  }
  return null
}
export const assertRemoved = internalQuery({
  args: zodToConvex(developmentCampaignRemovedInputSchema),
  returns: v.null(),
  handler: assertAbsent
})
export const verifyDeletionRollback = action({
  args: zodToConvex(developmentCampaignRollbackInputSchema),
  returns: v.object({ rolledBack: v.literal(true) }),
  handler: async (ctx, input): Promise<{ rolledBack: true }> => {
    const checked = developmentCampaignRollbackInputSchema.parse(input)
    const identity = await ctx.runQuery(identityReference, {})
    if (identity.userId !== checked.fixture.ownerUserId)
      throw new Error('Fixture owner does not match the caller.')
    const before = await ctx.runQuery(inspectReference, checked.fixture)
    let caughtMarker = false
    try {
      await ctx.runMutation(forceReference, checked)
    } catch (error) {
      if (!(error instanceof ConvexError) || error.data !== MARKER) throw error
      caughtMarker = true
    }
    if (!caughtMarker) throw new Error('Fixture deletion rollback marker was not raised.')
    const after = await ctx.runQuery(inspectReference, checked.fixture)
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw new Error('Fixture Campaign deletion rollback changed persisted state.')
    return { rolledBack: true }
  }
})
