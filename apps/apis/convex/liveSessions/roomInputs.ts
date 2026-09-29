import { zodToConvexFields } from 'convex-helpers/server/zod4'
import type { PaginationResult } from 'convex/server'
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
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { internalQuery } from '../lib/queries'
import { readCampaignCurrencyOptions } from '../campaigns/currencySystemDocuments'
import { readDefinitionRoot } from '../content/definitionStore'
import { requireSystem } from '../content/systemDocuments'
import { readSystemVocabularySnapshot } from '../content/systemVocabulary'
import { requireActiveCampaignLiveAuthority } from './authorityGuard'
import { readAssignedActiveCharacter, readStoredCharacterInputs } from './characterRulesCapture'
import { readLiveSessionRulesRevisions } from './rulesRevisions'

type StoredRow = Record<string, unknown> & { _id: string; _creationTime: number }
type PageOptions = {
  cursor: string | null
  numItems: number
  maximumRowsRead: number
  maximumBytesRead: number
}
type RunTableQuery = (
  ctx: QueryCtx,
  encounterId: string
) => {
  first(): Promise<unknown>
  paginate(options: PageOptions): Promise<PaginationResult<StoredRow>>
}

/**
 * One page stays far below Convex's 8 MiB / 16384-document read limits and the 16 MiB return limit.
 * The route joins consecutive pages into one response (`readRoomInputsBatch`), since each Worker
 * call is a subrequest and Workers Free allows 50 per invocation.
 */
const PAGE: Omit<PageOptions, 'cursor'> = {
  numItems: MAX_ROOM_INPUT_PAGE_DOCUMENTS,
  maximumRowsRead: MAX_ROOM_INPUT_PAGE_DOCUMENTS,
  maximumBytesRead: 4 * 1024 * 1024
}

/**
 * The Run aggregate's tables in the fixed order the room reads them. A page reads one table (Convex
 * permits one `paginate` per function); empty tables are skipped by a `first` probe so they cost
 * no round trip. The Run document itself rides the first page.
 */
const RUN_TABLES: ReadonlyArray<{ table: EncounterTableName; query: RunTableQuery }> = [
  {
    table: 'encounterRunActors',
    query: (ctx, encounterId) =>
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
  },
  {
    table: 'encounterActorProjectionFacts',
    query: (ctx, encounterId) =>
      ctx.db
        .query('encounterActorProjectionFacts')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
  },
  {
    table: 'encounterSourceProjectionFacts',
    query: (ctx, encounterId) =>
      ctx.db
        .query('encounterSourceProjectionFacts')
        .withIndex('by_encounterId_checksum', (q) => q.eq('encounterId', encounterId))
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
      ctx.db
        .query('encounterRunCommands')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
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
      ctx.db
        .query('encounterRuleReceipts')
        .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', encounterId))
  },
  {
    table: 'encounterEvidenceRolls',
    query: (ctx, encounterId) =>
      ctx.db
        .query('encounterEvidenceRolls')
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

/** Refuses a page that cannot advance, so a caller's loop always terminates. */
function assertAdvances(page: PaginationResult<unknown>, cursor: string | null) {
  if (page.pageStatus === 'SplitRequired' || (!page.isDone && page.continueCursor === cursor))
    throw new Error('Room input page cannot advance.')
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
  if (!entry)
    return {
      kind: 'RUN',
      encounterVersion: run.version,
      documents: runDocument,
      continueCursor: null
    }
  const page = await entry.query(ctx, run.id).paginate({ ...PAGE, cursor: paginationCursor })
  assertAdvances(page, paginationCursor)
  const continueCursor: LiveRoomInputsCursor = !page.isDone
    ? { position: tableIndex, paginationCursor: page.continueCursor }
    : tableIndex + 1 < RUN_TABLES.length
      ? { position: tableIndex + 1, paginationCursor: null }
      : null
  return {
    kind: 'RUN',
    encounterVersion: run.version,
    documents: [...runDocument, ...page.page.map((row) => toDocument(entry.table, row))],
    continueCursor
  }
}

/**
 * One page of the request's Characters: the next page of the Character at the cursor's position. A
 * Character the Campaign no longer has assigned reads as UNASSIGNED (its Run actor holds its frozen
 * state); every other unreadable state fails, so a broken Character never hides behind a departure.
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
  if (assignment?.campaignId !== campaign.id)
    return {
      kind: 'CHARACTERS',
      parts: [{ status: 'UNASSIGNED', characterId: requested }],
      continueCursor: next
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
    revisions: await readLiveSessionRulesRevisions(ctx, {
      systemId: active.systemId,
      campaignId: campaign.id,
      characterId: active.id
    }),
    // A continuation always carries a pagination cursor, so a null one starts the Character.
    inputs:
      paginationCursor === null ? await readStoredCharacterInputs(ctx, active, campaign) : null,
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
  scope: LiveRoomInputsScope
): Promise<LiveRoomInputsResponse> {
  switch (scope.kind) {
    case 'CAMPAIGN_PLAY':
      return {
        kind: 'CAMPAIGN_PLAY',
        revisions: await readLiveSessionRulesRevisions(ctx, {
          systemId: campaign.gameSystemId,
          campaignId: campaign.id
        }),
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
    case 'CHARACTERS':
      return readCharactersPage(ctx, campaign, scope)
    case 'DEFINITION': {
      // Encounter rules resolve the Campaign's definitions as its owner, for players too.
      const root = await readDefinitionRoot(
        ctx,
        scope.definitionId.toLowerCase(),
        campaign.ownerUserId
      )
      if (root && root.gameSystemId !== campaign.gameSystemId)
        throw new Error('Reusable definition System mismatch.')
      return {
        kind: 'DEFINITION',
        revisions: await readLiveSessionRulesRevisions(ctx, {
          systemId: campaign.gameSystemId,
          campaignId: campaign.id
        }),
        definition: root?.current ?? null
      }
    }
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
    await requireActiveCampaignLiveAuthority(ctx, input)
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', input.campaignId.toLowerCase()))
      .unique()
    if (!campaign) throw new Error('Campaign not found.')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    return liveRoomInputsResponseSchema.parse(await readRoomInputs(ctx, campaign, input.scope))
  }
})
