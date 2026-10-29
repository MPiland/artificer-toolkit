import { paginateReceiptHeaders } from '../lib/receiptPagination'
import { zodToConvexFields } from 'convex-helpers/server/zod4'
import type { OrderedQuery, PaginationResult } from 'convex/server'
import type { EncounterTableName } from '@artificer-toolkit/encounter-persistence/store'
import {
  liveRoomInputsInputSchema,
  liveRoomInputsResponseSchema,
  type LiveRoomCharacterPart,
  type LiveRoomInputsCursor,
  type LiveRoomInputsResponse,
  type LiveRoomInputsScope
} from '@artificer-toolkit/schema/api/liveRoomInputs'
import { MAX_ROOM_INPUT_PAGE_DOCUMENTS } from '@artificer-toolkit/schema/api/liveRoomInputsBatch'
import type { DataModel, Doc } from '../_generated/dataModel'
import type { ReceiptHeaderTable } from '@artificer-toolkit/schema/projections/receiptHeaderPersistence'
import type { QueryCtx } from '../_generated/server'
import { internalQuery } from '../lib/queries'
import { readCampaignClockMinute } from '../campaigns/clockReads'
import { readCampaignCharacterState } from '../campaigns/characterState'
import { readCampaignCurrencyOptions } from '../campaigns/currencySystemDocuments'
import { readCharacterSheetState } from '../characters/sheetStateDocuments'
import type { CharacterRow } from '../characters/stateDocuments'
import { requireSystem } from '../content/systemDocuments'
import { readSystemVocabularySnapshot } from '../content/systemVocabulary'
import { requireActiveCampaignLiveAuthority } from './authorityGuard'
import { readAssignedActiveCharacter } from './characterRulesCapture'
import { readLiveSessionRulesRevisions } from './rulesRevisions'
import { readCharacterSources, readCampaignCharacterSources } from '../characters/sourceReads'
import { readContentSnapshotManifest } from '../contentSnapshots/manifest'
import type { ContentSnapshotHead } from '@artificer-toolkit/schema/api/contentSnapshots'
import { livePublicationCampaignScope, type CampaignInternalScope } from '../campaigns/authority'
import { readRoomSceneDefinitionPage, readRoomSceneInputsPage } from './roomSceneInputs'
import { readRoomDefinitionsPage } from './roomDefinitionInputs'

/** A missing head is empty only when its authoritative scope has no content records. */
async function readRoomContentManifest(
  ctx: QueryCtx,
  systemId: string,
  access: Awaited<ReturnType<typeof readCharacterSources>>
) {
  const manifest = await readContentSnapshotManifest(ctx, systemId, access)
  const emptyHead = (scope: 'SOURCE' | 'CAMPAIGN', scopeId: string): ContentSnapshotHead => ({
    scope,
    scopeId,
    revision: 0,
    builtRevision: 0,
    kinds: {}
  })
  const sources = await Promise.all(
    manifest.sources.map(async (source) => {
      if (source.head) return source
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_contentSourceId_subjectKind_ownerUserId', (q) =>
          q.eq('contentSourceId', source.contentSourceId)
        )
        .first()
      if (root) throw new Error('Room content snapshot has not been built.')
      return { ...source, head: emptyHead('SOURCE', source.contentSourceId) }
    })
  )
  const campaign = manifest.campaign
  if (!campaign) throw new Error('Room content manifest requires a Campaign.')
  if (!campaign.head) {
    const share = await ctx.db
      .query('campaignContentShares')
      .withIndex('by_campaignId_subjectKind_subjectId', (q) => q.eq('campaignId', campaign.id))
      .first()
    if (share) throw new Error('Room content snapshot has not been built.')
  }
  return {
    ...manifest,
    sources,
    campaign: { ...campaign, head: campaign.head ?? emptyHead('CAMPAIGN', campaign.id) }
  }
}

type StoredRow = Record<string, unknown> & { _id: string; _creationTime: number }
type PageOptions = {
  cursor: string | null
  numItems: number
  maximumRowsRead: number
  maximumBytesRead: number
}
export type RunTableQuery = (
  ctx: QueryCtx,
  encounterId: string
) => {
  first(): Promise<unknown>
  paginate(options: PageOptions): Promise<PaginationResult<StoredRow>>
}

/** Receipt pages retain native cursors and admit at most 4 MiB of distinct ledger payloads. */
function receiptRunTableQuery<Table extends ReceiptHeaderTable>(
  ctx: QueryCtx,
  table: Table,
  query: OrderedQuery<DataModel[Table]>
): ReturnType<RunTableQuery> {
  return {
    first: () => query.first(),
    paginate: (options) => paginateReceiptHeaders(ctx, table, query, options)
  }
}

/**
 * Native rows and distinct receipt payloads are bounded before hydration, leaving room for authority.
 * The route joins consecutive pages into one response (`readRoomInputsBatch`), since each Worker
 * call is a subrequest and Workers Free allows 50 per invocation.
 */
export const PAGE: Omit<PageOptions, 'cursor'> = {
  numItems: MAX_ROOM_INPUT_PAGE_DOCUMENTS,
  // Let numItems stop a full page before the read ceiling marks it incomplete.
  maximumRowsRead: MAX_ROOM_INPUT_PAGE_DOCUMENTS + 1,
  maximumBytesRead: 4 * 1024 * 1024
}

/**
 * The Run aggregate's tables in the fixed order the room reads them. A page reads one table;
 * empty tables are skipped by a `first` probe so they cost no round trip.
 * The Run document itself rides the first page.
 */
export const RUN_TABLES: ReadonlyArray<{ table: EncounterTableName; query: RunTableQuery }> = [
  {
    table: 'encounterRunActors',
    query: (ctx, encounterId) =>
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
  },
  {
    table: 'encounterActorSnapshots',
    query: (ctx, encounterId) =>
      ctx.db
        .query('encounterActorSnapshots')
        .withIndex('by_encounterId_checksum', (q) => q.eq('encounterId', encounterId))
  },
  {
    table: 'encounterSourceProjectionFacts',
    query: (ctx, encounterId) =>
      ctx.db
        .query('encounterSourceProjectionFacts')
        .withIndex('by_encounterId_checksum', (q) => q.eq('encounterId', encounterId))
  },
  {
    table: 'encounterSpellPins',
    query: (ctx, encounterId) =>
      ctx.db
        .query('encounterSpellPins')
        .withIndex('by_encounterId_spellId', (q) => q.eq('encounterId', encounterId))
  },
  {
    table: 'encounterSceneBindings',
    query: (ctx, encounterId) =>
      ctx.db
        .query('encounterSceneBindings')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
  },
  {
    table: 'encounterActorTokenBindings',
    query: (ctx, encounterId) =>
      ctx.db
        .query('encounterActorTokenBindings')
        .withIndex('by_encounterId_actorId', (q) => q.eq('encounterId', encounterId))
  },
  {
    table: 'encounterInitiativeRounds',
    query: (ctx, encounterId) =>
      ctx.db
        .query('encounterInitiativeRounds')
        .withIndex('by_encounterId_round', (q) => q.eq('encounterId', encounterId))
  },
  {
    table: 'encounterInitiativeParticipants',
    query: (ctx, encounterId) =>
      ctx.db
        .query('encounterInitiativeParticipants')
        .withIndex('by_encounterId_round_actorId', (q) => q.eq('encounterId', encounterId))
  },
  {
    table: 'encounterInitiativeSides',
    query: (ctx, encounterId) =>
      ctx.db
        .query('encounterInitiativeSides')
        .withIndex('by_encounterId_round_sideId', (q) => q.eq('encounterId', encounterId))
  },
  {
    table: 'encounterRunCommands',
    query: (ctx, encounterId) =>
      receiptRunTableQuery(
        ctx,
        'encounterRunCommands',
        ctx.db
          .query('encounterRunCommands')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
      )
  },
  {
    table: 'encounterRuleOccurrences',
    query: (ctx, encounterId) =>
      ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_encounterId_state', (q) => q.eq('encounterId', encounterId))
  },
  {
    table: 'encounterPendingSnapshotParts',
    query: (ctx, encounterId) =>
      ctx.db
        .query('encounterPendingSnapshotParts')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
  },
  {
    table: 'encounterRuleReceipts',
    query: (ctx, encounterId) =>
      receiptRunTableQuery(
        ctx,
        'encounterRuleReceipts',
        ctx.db
          .query('encounterRuleReceipts')
          .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', encounterId))
      )
  },
  {
    table: 'encounterReplayIndex',
    query: (ctx, encounterId) =>
      ctx.db
        .query('encounterReplayIndex')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
  },
  {
    table: 'encounterTurnMovements',
    query: (ctx, encounterId) =>
      ctx.db
        .query('encounterTurnMovements')
        .withIndex('by_encounterId_round_turnActorId_actorId', (q) =>
          q.eq('encounterId', encounterId)
        )
  },
  {
    table: 'encounterDecisionSkips',
    query: (ctx, encounterId) =>
      ctx.db
        .query('encounterDecisionSkips')
        .withIndex('by_encounterId_occurrenceId_occurrenceVersion', (q) =>
          q.eq('encounterId', encounterId)
        )
  },
  {
    table: 'encounterActiveRuleEffects',
    query: (ctx, encounterId) =>
      ctx.db
        .query('encounterActiveRuleEffects')
        .withIndex('by_encounterId_targetActorId_id', (q) => q.eq('encounterId', encounterId))
  },
  {
    table: 'encounterMaintainedEffectStates',
    query: (ctx, encounterId) =>
      ctx.db
        .query('encounterMaintainedEffectStates')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
  },
  {
    table: 'encounterSpatialRuleEffects',
    query: (ctx, encounterId) =>
      ctx.db
        .query('encounterSpatialRuleEffects')
        .withIndex('by_encounterId_sceneId_id', (q) => q.eq('encounterId', encounterId))
  }
]

function toDocument(table: EncounterTableName, { _id, _creationTime, ...fields }: StoredRow) {
  return { table, id: _id, creationTime: _creationTime, fields }
}

const CHAT_METADATA_TABLES: ReadonlyArray<{ table: EncounterTableName; query: RunTableQuery }> = [
  {
    table: 'campaignConversations',
    query: (ctx, campaignId) =>
      ctx.db
        .query('campaignConversations')
        .withIndex('by_campaignId_kind', (q) => q.eq('campaignId', campaignId))
  },
  {
    table: 'campaignConversationMembers',
    query: (ctx, campaignId) =>
      ctx.db
        .query('campaignConversationMembers')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
  },
  {
    table: 'campaignConversationEntries',
    query: (ctx, campaignId) =>
      ctx.db
        .query('campaignConversationEntries')
        .withIndex('by_campaignId_authorUserId_clientNonce', (q) => q.eq('campaignId', campaignId))
  }
]

/** Only access and nonce metadata hydrate; historical text and roll payloads stay in Convex. */
async function readChatMetadataPage(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  scope: Extract<LiveRoomInputsScope, { kind: 'CHAT_METADATA' }>
): Promise<LiveRoomInputsResponse> {
  const paginationCursor = scope.cursor?.paginationCursor ?? null
  let position = scope.cursor?.position ?? 0
  if (position >= CHAT_METADATA_TABLES.length) throw new Error('Room input cursor is invalid.')
  if (paginationCursor === null)
    while (
      position < CHAT_METADATA_TABLES.length &&
      !(await CHAT_METADATA_TABLES[position]!.query(ctx, campaign.id).first())
    )
      position += 1
  const entry = CHAT_METADATA_TABLES[position]
  if (!entry) return { kind: 'CHAT_METADATA', documents: [], continueCursor: null }
  const page = await entry.query(ctx, campaign.id).paginate({ ...PAGE, cursor: paginationCursor })
  if (!page.isDone && page.continueCursor === paginationCursor)
    throw new Error('Room input page cannot advance.')
  return {
    kind: 'CHAT_METADATA',
    documents: page.page.map((row) => toDocument(entry.table, row)),
    continueCursor: !page.isDone
      ? { position, paginationCursor: page.continueCursor }
      : position + 1 < CHAT_METADATA_TABLES.length
        ? { position: position + 1, paginationCursor: null }
        : null
  }
}

/** Refuses a page that cannot advance, so a caller's loop always terminates. */
function assertAdvances(
  page: PaginationResult<unknown>,
  cursor: string | null,
  receiptPage = false
) {
  // Stateless receipt reads use an unfiltered index and no end cursor. convex-test marks a
  // complete one-row scan SplitRequired; native Convex stops at numItems before that limit.
  if (
    (page.pageStatus === 'SplitRequired' && !(receiptPage && page.page.length === 1)) ||
    (!page.isDone && page.continueCursor === cursor)
  )
    throw new Error('Room input page cannot advance.')
}

async function readAuthorityPage(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  scope: Extract<LiveRoomInputsScope, { kind: 'AUTHORITY' }>
): Promise<LiveRoomInputsResponse> {
  const position = scope.cursor?.position ?? 0
  const paginationCursor = scope.cursor?.paginationCursor ?? null
  if (position > 2 || (position === 0 && paginationCursor !== null))
    throw new Error('Room input cursor is invalid.')
  const revisions = (
    await readLiveSessionRulesRevisions(ctx, {
      systemId: campaign.gameSystemId,
      campaignId: campaign.id
    })
  ).filter((revision) => revision.scope !== 'PLAY')
  if (position === 0)
    return {
      kind: 'AUTHORITY',
      revisions,
      accountUserIds: [],
      documents: [toDocument('campaigns', campaign)],
      continueCursor: { position: 1, paginationCursor: null }
    }
  const table = position === 1 ? 'campaignMemberships' : 'campaignCharacterAssignments'
  const page =
    position === 1
      ? await ctx.db
          .query('campaignMemberships')
          .withIndex('by_campaignId_status', (q) => q.eq('campaignId', campaign.id))
          .paginate({ ...PAGE, cursor: paginationCursor })
      : await ctx.db
          .query('campaignCharacterAssignments')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
          .paginate({ ...PAGE, cursor: paginationCursor })
  // A byte-limited SplitRequired page is usable when its native continuation advances.
  if (!page.isDone && page.continueCursor === paginationCursor)
    throw new Error('Room input page cannot advance.')
  const accountUserIds =
    position === 1
      ? (
          await Promise.all(
            page.page.map(async (member) => {
              const profile = await ctx.db
                .query('userProfiles')
                .withIndex('by_userId', (q) => q.eq('userId', member.userId))
                .unique()
              return profile ? member.userId : null
            })
          )
        ).filter((userId) => userId !== null)
      : []
  return {
    kind: 'AUTHORITY',
    revisions,
    accountUserIds,
    documents: page.page.map((row) => toDocument(table, row)),
    continueCursor: !page.isDone
      ? { position, paginationCursor: page.continueCursor }
      : position === 1
        ? { position: 2, paginationCursor: null }
        : null
  }
}

async function readRunPage(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  scope: Extract<LiveRoomInputsScope, { kind: 'RUN' }>
): Promise<LiveRoomInputsResponse> {
  const encounterId = scope.encounterId.toLowerCase()
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', encounterId))
    .unique()
  if (!run || run.campaignId !== campaign.id) throw new Error('Encounter not found.')
  const active = await ctx.db
    .query('encounterRuns')
    .withIndex('by_campaignId_status', (q) =>
      q.eq('campaignId', campaign.id).eq('status', 'ACTIVE')
    )
    .first()
  const activeEncounterId = active?.id ?? null
  const isFirstPage = scope.cursor === null
  const { paginationCursor } = scope.cursor ?? { paginationCursor: null }
  let tableIndex = scope.cursor?.position ?? 0
  if (tableIndex >= RUN_TABLES.length) throw new Error('Room input cursor is invalid.')
  // A table's continuation is never empty, so only a fresh table can be skipped.
  if (paginationCursor === null)
    while (
      tableIndex < RUN_TABLES.length &&
      !(await RUN_TABLES[tableIndex]!.query(ctx, run.id).first())
    )
      tableIndex += 1
  const entry = RUN_TABLES[tableIndex]
  const runDocument = isFirstPage ? [toDocument('encounterRuns', run)] : []
  // Character dependents load with their Character; a detached owner is found only through this.
  const maintenanceCharacterOwners = isFirstPage
    ? (
        await Promise.all(
          (
            await ctx.db
              .query('encounterMaintainedEffectStates')
              .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id))
              .collect()
          ).map(async (state) => {
            const dependents = await ctx.db
              .query('characterActiveRuleEffects')
              .withIndex('by_state_source_owner_order', (q) =>
                q.eq('maintainedEffectStateId', state.id).eq('sourceEncounterId', run.id)
              )
              .collect()
            return [...new Set(dependents.map((effect) => effect.characterId))].map(
              (characterId) => ({ maintainedStateId: state.id, characterId })
            )
          })
        )
      ).flat()
    : null
  if (!entry)
    return {
      kind: 'RUN',
      encounterVersion: run.version,
      activeEncounterId,
      maintenanceCharacterOwners,
      documents: runDocument,
      continueCursor: null
    }
  const page = await entry.query(ctx, run.id).paginate({ ...PAGE, cursor: paginationCursor })
  assertAdvances(
    page,
    paginationCursor,
    ['encounterRunCommands', 'encounterRuleReceipts'].includes(entry.table)
  )
  const continueCursor: LiveRoomInputsCursor = !page.isDone
    ? { position: tableIndex, paginationCursor: page.continueCursor }
    : tableIndex + 1 < RUN_TABLES.length
      ? { position: tableIndex + 1, paginationCursor: null }
      : null
  return {
    kind: 'RUN',
    encounterVersion: run.version,
    activeEncounterId,
    maintenanceCharacterOwners,
    documents: [...runDocument, ...page.page.map((row) => toDocument(entry.table, row))],
    continueCursor
  }
}

/**
 * One page of the request's Characters: the next page of the Character at the cursor's position. A
 * Character the Campaign no longer has assigned reads as UNASSIGNED (its Run actor holds its frozen
 * state), or as DELETED once it no longer exists; every other unreadable state fails, so a broken
 * Character never hides behind a departure.
 */
async function readCharactersPage(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  scope: Extract<LiveRoomInputsScope, { kind: 'CHARACTERS' }>
): Promise<LiveRoomInputsResponse> {
  const position = scope.cursor?.position ?? 0
  const requested = scope.characterIds[position]
  if (!requested) throw new Error('Room input cursor is invalid.')
  const characterId = requested.toLowerCase()
  const assignment = await ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .unique()
  const next: LiveRoomInputsCursor =
    position + 1 < scope.characterIds.length
      ? { position: position + 1, paginationCursor: null }
      : null
  if (assignment?.campaignId !== campaign.id) {
    const exists = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', characterId))
      .unique()
    return {
      kind: 'CHARACTERS',
      parts: [{ status: exists ? 'UNASSIGNED' : 'DELETED', characterId: requested }],
      continueCursor: next
    }
  }
  // The Campaign owner reads for the room, as the Encounter captures do for a command scope.
  const active = await readAssignedActiveCharacter(ctx, campaign, characterId, campaign.ownerUserId)
  const paginationCursor = scope.cursor?.paginationCursor ?? null
  const page = await ctx.db
    .query('characterActiveRuleEffects')
    .withIndex('by_characterId_id', (q) => q.eq('characterId', active.id))
    .paginate({ ...PAGE, cursor: paginationCursor })
  assertAdvances(page, paginationCursor)
  const part: LiveRoomCharacterPart = {
    status: 'ASSIGNED',
    characterId: requested,
    // A Character part holds no play data (the room owns it), so PLAY moving, as the room's own
    // checkpoint does, never changes the part and must not split it from the System read it merges with.
    revisions: (
      await readLiveSessionRulesRevisions(ctx, {
        systemId: active.systemId,
        campaignId: campaign.id,
        characterId: active.id
      })
    ).filter((revision) => revision.scope !== 'PLAY'),
    // A continuation always carries a pagination cursor, so a null one starts the Character.
    inputs:
      paginationCursor === null ? await readStoredCharacterInputs(ctx, active, campaign) : null,
    contentSnapshots:
      paginationCursor === null
        ? await readRoomContentManifest(
            ctx,
            active.systemId,
            await readCharacterSources(ctx, active, active.userId)
          )
        : null,
    documents: page.page.map((row) => toDocument('characterActiveRuleEffects', row))
  }
  return {
    kind: 'CHARACTERS',
    parts: [part],
    continueCursor: page.isDone ? next : { position, paginationCursor: page.continueCursor }
  }
}

async function readRoomInputs(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  scope: LiveRoomInputsScope,
  authorityScope: CampaignInternalScope
): Promise<LiveRoomInputsResponse> {
  switch (scope.kind) {
    case 'CHAT_METADATA':
      return readChatMetadataPage(ctx, campaign, scope)
    case 'AUTHORITY':
      return readAuthorityPage(ctx, campaign, scope)
    case 'CAMPAIGN_PLAY':
      return {
        kind: 'CAMPAIGN_PLAY',
        revisions: await readLiveSessionRulesRevisions(ctx, {
          systemId: campaign.gameSystemId,
          campaignId: campaign.id
        }),
        contentSnapshots: await readRoomContentManifest(
          ctx,
          campaign.gameSystemId,
          await readCampaignCharacterSources(ctx, campaign, campaign.ownerUserId)
        ),
        campaign: {
          id: campaign.id,
          gameSystemId: campaign.gameSystemId,
          ownerUserId: campaign.ownerUserId,
          contentMaturity: campaign.contentMaturity,
          attunementSlotOverride: campaign.attunementSlotOverride,
          currencyOptions: await readCampaignCurrencyOptions(ctx, campaign)
        }
      }
    case 'RUN':
      return readRunPage(ctx, campaign, scope)
    case 'SCENE':
      return readRoomSceneInputsPage(ctx, campaign, scope, authorityScope)
    case 'SCENE_DEFINITION':
      return readRoomSceneDefinitionPage(ctx, campaign, scope, authorityScope)
    case 'CHARACTERS':
      return readCharactersPage(ctx, campaign, scope)
    case 'DEFINITIONS':
      return readRoomDefinitionsPage(ctx, campaign, scope)
    case 'SYSTEM': {
      const system = await requireSystem(ctx, campaign.gameSystemId)
      return {
        kind: 'SYSTEM',
        revisions: await readLiveSessionRulesRevisions(ctx, {
          systemId: campaign.gameSystemId,
          campaignId: campaign.id
        }),
        system: scope.part === 'SYSTEM' ? system : null,
        vocabulary:
          scope.part === 'VOCABULARY' ? await readSystemVocabularySnapshot(ctx, system) : null
      }
    }
    case 'CAMPAIGN_CLOCK':
      return {
        kind: 'CAMPAIGN_CLOCK',
        absoluteMinute: await readCampaignClockMinute(ctx.db, campaign.id)
      }
  }
}

/**
 * The inputs the room's rules engine reads (ADR 0035, Amendment 11), authorized by the Worker
 * secret and the Campaign's `DO_ACTIVE` epoch. The reader is derived on the server, never supplied;
 * every scope is bound to the epoch's Campaign, so another Campaign's data and a released epoch
 * are refused. The response validator is the Zod contract: a Convex validator over the System and
 * Run schemas would be built at module load for every function call.
 */
export const read = internalQuery({
  args: zodToConvexFields(liveRoomInputsInputSchema.shape),
  handler: async (ctx, args): Promise<LiveRoomInputsResponse> => {
    const input = liveRoomInputsInputSchema.parse(args)
    const authority = await requireActiveCampaignLiveAuthority(ctx, input)
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', input.campaignId.toLowerCase()))
      .unique()
    if (!campaign) throw new Error('Campaign not found.')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    return liveRoomInputsResponseSchema.parse(
      await readRoomInputs(ctx, campaign, input.scope, livePublicationCampaignScope(authority))
    )
  }
})

/**
 * An admitted Character's stored rules inputs; the room's Character read returns the same. Both
 * callers have already refused an archived Campaign, so the result states `ACTIVE`.
 */
async function readStoredCharacterInputs(
  ctx: QueryCtx,
  active: CharacterRow,
  campaign: Doc<'campaigns'>
) {
  return {
    owner: active,
    sheetState: readCharacterSheetState(active),
    campaign: {
      id: campaign.id,
      status: 'ACTIVE' as const,
      contentMaturity: campaign.contentMaturity,
      attunementSlotOverride: campaign.attunementSlotOverride,
      state: (await readCampaignCharacterState(ctx, campaign.id, active.id)).state,
      currencyOptions: await readCampaignCurrencyOptions(ctx, campaign)
    }
  }
}
