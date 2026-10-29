import type {
  EncounterReadPorts,
  EncounterReadTransaction
} from '@artificer-toolkit/encounter-persistence/ports'
import type { QueryCtx } from '../_generated/server'
import { readCampaignAssignedCharacter } from '../campaigns/assignedCharacter'
import { requireCampaignAuthority } from '../campaigns/authority'
import {
  readCampaignCharacterState,
  requireCampaignCharacterAuthority
} from '../campaigns/characterState'
import { readCharacterSheetState } from '../characters/sheetStateDocuments'
import {
  readCharacterPlay,
  readCharacterRecord,
  readCharacterRow
} from '../characters/stateDocuments'
import { readDefinitionRoot } from '../content/definitionStore'
import { requireSystem } from '../content/systemDocuments'
import { requireIdentity } from '../lib/identity'
import { requireIntactAssignedActiveCharacter } from '../liveSessions/characterRulesCapture'
import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'
import { readAutoRollDice, readGmRollVisibility } from '../lib/rollPreferences'
import { isRoomHeldRun, requireActiveCampaignLiveAuthority } from '../liveSessions/authorityGuard'

async function readContentLabel(ctx: QueryCtx, id: string) {
  const authored = await ctx.db
    .query('authoredRoots')
    .withIndex('by_publicId', (q) => q.eq('id', id))
    .unique()
  if (authored) return authored.label
  const definition = await ctx.db
    .query('reusableDefinitions')
    .withIndex('by_publicId', (q) => q.eq('id', id))
    .unique()
  return definition?.label ?? null
}

/** The Encounter ports over Convex: each reads the owning domain in this transaction. */
export function encounterReadPorts(ctx: QueryCtx): EncounterReadPorts {
  return {
    requireIdentity: () => requireIdentity(ctx),
    requireActiveLiveAuthority: async (input) => {
      await requireActiveCampaignLiveAuthority(ctx, input)
    },
    requireCampaignAuthority: (campaignId, userId) =>
      requireCampaignAuthority(ctx, campaignId, userId),
    requireCampaignCharacterAuthority: (campaignId, characterId, userId) =>
      requireCampaignCharacterAuthority(ctx, campaignId, characterId, userId),
    requireSystem: (systemId) => requireSystem(ctx, systemId),
    readContentLabel: (id) => readContentLabel(ctx, id),
    readCharacterRecord,
    readCharacterRow: (characterId) => readCharacterRow(ctx, characterId),
    readCharacterSheetState,
    readCharacterPlay,
    readAssignedCharacter: (campaign, membership) =>
      readCampaignAssignedCharacter(ctx, campaign, membership),
    readCampaignCharacterConditions: async (campaign, characterId) => {
      await requireIntactAssignedActiveCharacter(ctx, campaign, characterId, campaign.ownerUserId)
      return (await readCampaignCharacterState(ctx, campaign.id, characterId)).state.conditions
    },
    readCurrentDefinition: async (definitionId, ownerUserId) =>
      (await readDefinitionRoot(ctx, definitionId, ownerUserId))?.current ?? null,
    readAutoRollDice: (userId) => readAutoRollDice(ctx, userId),
    readGmRollVisibility: (userId) => readGmRollVisibility(ctx, userId),
    isRoomHeldRun: (run) => isRoomHeldRun(ctx, run),
    // Fog is read only in paged actions, so a query cannot tell what a player's map draws (ATTACK-17.3).
    readViewerSceneTokens: async () => null,
    hasAccountProfile: async (userId) =>
      (await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()) !== null
  }
}

const readTransactions = new WeakMap<QueryCtx, EncounterReadTransaction>()

/** A Convex query transaction as the Encounter code reads it; one per Convex context. */
export function encounterReadTransaction(ctx: QueryCtx): EncounterReadTransaction {
  let transaction = readTransactions.get(ctx)
  if (!transaction) {
    transaction = { db: createConvexEncounterStoreReader(ctx), ports: encounterReadPorts(ctx) }
    readTransactions.set(ctx, transaction)
  }
  return transaction
}
