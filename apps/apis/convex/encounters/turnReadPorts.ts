import type {
  EncounterTurnReadPorts,
  EncounterTurnReadTransaction
} from '@artificer-toolkit/encounter-persistence/ports'
import { MAX_BASIC_ACTION_CHOICES } from '@artificer-toolkit/schema/api/encounterActionChoices'
import { BASIC_ACTION_DEFINITION_FAMILY_KEY } from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import { VTT_SCENE_LIMITS } from '@artificer-toolkit/shared/vtt/scene'
import type { QueryCtx } from '../_generated/server'
import { readDefinitionRoot } from '../content/definitionStore'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { readLiveScene } from '../scenes/liveDocuments'
import { encounterReadTransaction } from './encounterReadPorts'

type ConvexCharacterTurnFacts = NonNullable<Awaited<ReturnType<typeof loadCharacterSheetFacts>>>

/** The turn-read ports over Convex: each reads the owning domain in this transaction. */
function turnReadPorts(ctx: QueryCtx): EncounterTurnReadPorts<ConvexCharacterTurnFacts> {
  return {
    ...encounterReadTransaction(ctx).ports,
    readCharacterTurnFacts: (campaign, characterId) =>
      loadCharacterSheetFacts(ctx, campaign.ownerUserId, characterId, campaign.id),
    // User-authored Systems are deferred, so no user-owned entry joins a catalogue.
    listBasicActionDefinitions: async (gameSystemId, ownerUserId) => {
      const rows = await ctx.db
        .query('reusableDefinitions')
        .withIndex('by_gameSystemId_owner_family_label_id', (q) =>
          q
            .eq('gameSystemId', gameSystemId)
            .eq('ownerUserId', undefined)
            .eq('definitionFamilyKey', BASIC_ACTION_DEFINITION_FAMILY_KEY)
        )
        .take(MAX_BASIC_ACTION_CHOICES + 1)
      if (rows.length > MAX_BASIC_ACTION_CHOICES)
        throw new Error('The basic-action catalogue exceeds its bound.')
      const roots = await Promise.all(
        rows.map((row) => readDefinitionRoot(ctx, row.id, ownerUserId))
      )
      return roots.flatMap((root) =>
        root?.sourceKind === 'PLATFORM' && root.current ? [root.current] : []
      )
    },
    sceneReaders: {
      readScene: (sceneId) => readLiveScene(ctx, sceneId, 'MEMBER'),
      readLiveToken: async (sceneId, tokenId) => {
        const row = await ctx.db
          .query('sceneLiveEntities')
          .withIndex('by_sceneId_collection_entityId', (q) =>
            q.eq('sceneId', sceneId).eq('collection', 'tokens').eq('entityId', tokenId)
          )
          .unique()
        if (!row) return null
        const { _id, _creationTime, ...stored } = row
        return stored
      },
      readDefinitionToken: async (saveId, tokenId) => {
        let row = await ctx.db
          .query('sceneDefinitionEntities')
          .withIndex('by_saveId_collection_entityId', (q) =>
            q.eq('saveId', saveId).eq('value.collection', 'tokens').eq('entityId', tokenId)
          )
          .unique()
        // Immutable saves preserve UUID spelling; bindings and live edits use canonical IDs.
        if (!row) {
          const tokens = await ctx.db
            .query('sceneDefinitionEntities')
            .withIndex('by_saveId_collection_ordinal', (q) =>
              q.eq('saveId', saveId).eq('value.collection', 'tokens')
            )
            .take(VTT_SCENE_LIMITS.tokens + 1)
          const matches = tokens.filter((token) => token.entityId.toLowerCase() === tokenId)
          if (tokens.length > VTT_SCENE_LIMITS.tokens || matches.length !== 1)
            throw new Error('Action Scene token is unavailable.')
          row = matches[0] ?? null
        }
        if (!row) throw new Error('Action Scene token is unavailable.')
        const { _id, _creationTime, ...stored } = row
        return stored
      }
    }
  }
}

const turnTransactions = new WeakMap<
  QueryCtx,
  EncounterTurnReadTransaction<ConvexCharacterTurnFacts>
>()

/** A Convex query transaction as a turn's reads see it; one per Convex context. */
export function encounterTurnReadTransaction(
  ctx: QueryCtx
): EncounterTurnReadTransaction<ConvexCharacterTurnFacts> {
  let transaction = turnTransactions.get(ctx)
  if (!transaction) {
    transaction = { db: encounterReadTransaction(ctx).db, ports: turnReadPorts(ctx) }
    turnTransactions.set(ctx, transaction)
  }
  return transaction
}
