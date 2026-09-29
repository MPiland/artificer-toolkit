import { zodToConvexFields } from 'convex-helpers/server/zod4'
import type { PaginationResult } from 'convex/server'
import type { EncounterTableName } from '@artificer-toolkit/encounter-persistence/store'
import {
  liveRoomInputsInputSchema,
  liveRoomInputsResponseSchema,
  type LiveRoomInputsCursor,
  type LiveRoomInputsResponse,
  type LiveRoomInputsScope
} from '@artificer-toolkit/schema/api/liveRoomInputs'
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
type RunTableRead = (
  ctx: QueryCtx,
  encounterId: string,
  options: PageOptions
) => Promise<PaginationResult<StoredRow>>

/** One page stays far below Convex's 8 MiB / 16384-document read limits and the 16 MiB return limit. */
const PAGE: Omit<PageOptions, 'cursor'> = {
  numItems: 128,
  maximumRowsRead: 128,
  maximumBytesRead: 4 * 1024 * 1024
}

/**
 * The Run aggregate's tables in the fixed order the room reads them, one paginated read per call
 * (Convex permits one `paginate` per function). The Run document itself rides the first page.
 */
const RUN_TABLES: ReadonlyArray<{ table: EncounterTableName; read: RunTableRead }> = [
  {
    table: 'encounterRunActors',
    read: (ctx, encounterId, options) =>
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
        .paginate(options)
  },
  {
    table: 'encounterActorProjectionFacts',
    read: (ctx, encounterId, options) =>
      ctx.db
        .query('encounterActorProjectionFacts')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
        .paginate(options)
  },
  {
    table: 'encounterSourceProjectionFacts',
    read: (ctx, encounterId, options) =>
      ctx.db
        .query('encounterSourceProjectionFacts')
        .withIndex('by_encounterId_checksum', (q) => q.eq('encounterId', encounterId))
        .paginate(options)
  },
  {
    table: 'encounterSceneBindings',
    read: (ctx, encounterId, options) =>
      ctx.db
        .query('encounterSceneBindings')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
        .paginate(options)
  },
  {
    table: 'encounterActorTokenBindings',
    read: (ctx, encounterId, options) =>
      ctx.db
        .query('encounterActorTokenBindings')
        .withIndex('by_encounterId_actorId', (q) => q.eq('encounterId', encounterId))
        .paginate(options)
  },
  {
    table: 'encounterInitiativeRounds',
    read: (ctx, encounterId, options) =>
      ctx.db
        .query('encounterInitiativeRounds')
        .withIndex('by_encounterId_round', (q) => q.eq('encounterId', encounterId))
        .paginate(options)
  },
  {
    table: 'encounterInitiativeParticipants',
    read: (ctx, encounterId, options) =>
      ctx.db
        .query('encounterInitiativeParticipants')
        .withIndex('by_encounterId_round_actorId', (q) => q.eq('encounterId', encounterId))
        .paginate(options)
  },
  {
    table: 'encounterInitiativeSides',
    read: (ctx, encounterId, options) =>
      ctx.db
        .query('encounterInitiativeSides')
        .withIndex('by_encounterId_round_sideId', (q) => q.eq('encounterId', encounterId))
        .paginate(options)
  },
  {
    table: 'encounterRunCommands',
    read: (ctx, encounterId, options) =>
      ctx.db
        .query('encounterRunCommands')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
        .paginate(options)
  },
  {
    table: 'encounterRuleOccurrences',
    read: (ctx, encounterId, options) =>
      ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_encounterId_state', (q) => q.eq('encounterId', encounterId))
        .paginate(options)
  },
  {
    table: 'encounterPendingSnapshotParts',
    read: (ctx, encounterId, options) =>
      ctx.db
        .query('encounterPendingSnapshotParts')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
        .paginate(options)
  },
  {
    table: 'encounterRuleReceipts',
    read: (ctx, encounterId, options) =>
      ctx.db
        .query('encounterRuleReceipts')
        .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', encounterId))
        .paginate(options)
  },
  {
    table: 'encounterEvidenceRolls',
    read: (ctx, encounterId, options) =>
      ctx.db
        .query('encounterEvidenceRolls')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
        .paginate(options)
  },
  {
    table: 'encounterTurnMovements',
    read: (ctx, encounterId, options) =>
      ctx.db
        .query('encounterTurnMovements')
        .withIndex('by_encounterId_round_turnActorId_actorId', (q) =>
          q.eq('encounterId', encounterId)
        )
        .paginate(options)
  },
  {
    table: 'encounterDecisionSkips',
    read: (ctx, encounterId, options) =>
      ctx.db
        .query('encounterDecisionSkips')
        .withIndex('by_encounterId_occurrenceId_occurrenceVersion', (q) =>
          q.eq('encounterId', encounterId)
        )
        .paginate(options)
  },
  {
    table: 'encounterActiveRuleEffects',
    read: (ctx, encounterId, options) =>
      ctx.db
        .query('encounterActiveRuleEffects')
        .withIndex('by_encounterId_targetActorId_id', (q) => q.eq('encounterId', encounterId))
        .paginate(options)
  },
  {
    table: 'encounterMaintainedEffectStates',
    read: (ctx, encounterId, options) =>
      ctx.db
        .query('encounterMaintainedEffectStates')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
        .paginate(options)
  },
  {
    table: 'encounterSpatialRuleEffects',
    read: (ctx, encounterId, options) =>
      ctx.db
        .query('encounterSpatialRuleEffects')
        .withIndex('by_encounterId_sceneId_id', (q) => q.eq('encounterId', encounterId))
        .paginate(options)
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
  const { tableIndex, paginationCursor } = scope.cursor ?? { tableIndex: 0, paginationCursor: null }
  const entry = RUN_TABLES[tableIndex]
  if (!entry) throw new Error('Room input cursor is invalid.')
  const page = await entry.read(ctx, run.id, { ...PAGE, cursor: paginationCursor })
  assertAdvances(page, paginationCursor)
  const continueCursor: LiveRoomInputsCursor = !page.isDone
    ? { tableIndex, paginationCursor: page.continueCursor }
    : tableIndex + 1 < RUN_TABLES.length
      ? { tableIndex: tableIndex + 1, paginationCursor: null }
      : null
  return {
    kind: 'RUN',
    encounterVersion: run.version,
    documents: [
      ...(scope.cursor === null ? [toDocument('encounterRuns', run)] : []),
      ...page.page.map((row) => toDocument(entry.table, row))
    ],
    continueCursor
  }
}

async function readCharacterPage(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  scope: Extract<LiveRoomInputsScope, { kind: 'CHARACTER' }>
): Promise<LiveRoomInputsResponse> {
  // The Campaign owner reads for the room, as the Encounter captures do for a command scope.
  const active = await readAssignedActiveCharacter(
    ctx,
    campaign,
    scope.characterId,
    campaign.ownerUserId
  )
  const paginationCursor = scope.cursor?.paginationCursor ?? null
  const page = await ctx.db
    .query('characterActiveRuleEffects')
    .withIndex('by_characterId_id', (q) => q.eq('characterId', active.id))
    .paginate({ ...PAGE, cursor: paginationCursor })
  assertAdvances(page, paginationCursor)
  return {
    kind: 'CHARACTER',
    revisions: await readLiveSessionRulesRevisions(ctx, {
      systemId: active.systemId,
      campaignId: campaign.id,
      characterId: active.id
    }),
    inputs: scope.cursor === null ? await readStoredCharacterInputs(ctx, active, campaign) : null,
    documents: page.page.map((row) => toDocument('characterActiveRuleEffects', row)),
    continueCursor: page.isDone ? null : { tableIndex: 0, paginationCursor: page.continueCursor }
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
    case 'CHARACTER':
      return readCharacterPage(ctx, campaign, scope)
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
