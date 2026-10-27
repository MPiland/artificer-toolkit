import { recordConcentrationCheckRoll } from '@artificer-toolkit/encounter-persistence/concentrationRollPersistence'
import type {
  EncounterReadPorts,
  EncounterReadTransaction,
  EncounterWriteTransaction
} from '@artificer-toolkit/encounter-persistence/ports'
import { postRulesChatMessage } from '@artificer-toolkit/encounter-persistence/rulesChatPersistence'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { readCampaignAssignedCharacter } from '../campaigns/assignedCharacter'
import { requireCampaignAuthority } from '../campaigns/authority'
import {
  readCampaignCharacterState,
  requireCampaignCharacterAuthority
} from '../campaigns/characterState'
import { insertPreEvaluatedCampaignTableRoll } from '../campaigns/tableRoll'
import { writeCharacterRecord } from '../characters/characterWrites'
import { executeEncounterCharacterCommand } from '../characters/encounterCommands'
import type { CharacterSheetSourceContext } from '../characters/sheetFacts'
import { readCharacterSheetState } from '../characters/sheetStateDocuments'
import {
  readCharacterPlay,
  readCharacterRecord,
  readCharacterRow
} from '../characters/stateDocuments'
import { readDefinitionRoot } from '../content/definitionStore'
import { requireSystem } from '../content/systemDocuments'
import { requireIdentity } from '../lib/identity'
import { requireAssignedActiveCharacterHead } from '../liveSessions/characterRulesCapture'
import {
  createConvexEncounterStore,
  createConvexEncounterStoreReader
} from '../lib/convexEncounterStore'
import { readAutoRollDice, readGmRollVisibility } from '../lib/rollPreferences'
import { isRoomHeldRun, requireActiveCampaignLiveAuthority } from '../liveSessions/authorityGuard'
import { readEncounterSource, snapshotBlueprintEnemies } from './blueprintSnapshots'
import { readActorInitiativeRoll } from './initiativeSources'
import { snapshotEncounterOptionalCombatPolicies } from './policySnapshots'
import { retainUserRoll } from '../rollDocuments'
import { readLiveScene } from '../scenes/liveDocuments'

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
function readPorts(ctx: QueryCtx): EncounterReadPorts {
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
    readEncounterSource: (userId, systemId, id, kind) =>
      readEncounterSource(ctx, userId, systemId, id, kind),
    readCharacterRecord,
    readCharacterRow: (characterId) => readCharacterRow(ctx, characterId),
    readCharacterSheetState,
    readCharacterPlay,
    readAssignedCharacter: (campaign, membership) =>
      readCampaignAssignedCharacter(ctx, campaign, membership),
    readCampaignCharacterConditions: async (campaign, characterId) => {
      await requireAssignedActiveCharacterHead(ctx, campaign, characterId, campaign.ownerUserId)
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
        .unique()) !== null,
    readActorInitiativeRoll: (state, campaign, actorId) =>
      readActorInitiativeRoll(ctx, state, campaign, actorId),
    snapshotOptionalCombatPolicies: (campaign, userId, definitionIds) =>
      snapshotEncounterOptionalCombatPolicies(ctx, campaign, userId, definitionIds)
  }
}

const readTransactions = new WeakMap<QueryCtx, EncounterReadTransaction>()
const writeTransactions = new WeakMap<
  MutationCtx,
  EncounterWriteTransaction<CharacterSheetSourceContext>
>()

/** A Convex query transaction as the Encounter code reads it; one per Convex context. */
export function encounterReadTransaction(ctx: QueryCtx): EncounterReadTransaction {
  let transaction = readTransactions.get(ctx)
  if (!transaction) {
    transaction = { db: createConvexEncounterStoreReader(ctx), ports: readPorts(ctx) }
    readTransactions.set(ctx, transaction)
  }
  return transaction
}

/** A Convex mutation transaction as the Encounter code writes it; one per Convex context. */
export function encounterWriteTransaction(
  ctx: MutationCtx
): EncounterWriteTransaction<CharacterSheetSourceContext> {
  const known = writeTransactions.get(ctx)
  if (known) return known
  const transaction: EncounterWriteTransaction<CharacterSheetSourceContext> = {
    db: createConvexEncounterStore(ctx),
    ports: {
      ...readPorts(ctx),
      sceneReaders: { readScene: (sceneId) => readLiveScene(ctx, sceneId, 'MEMBER') },
      insertTableRoll: (authority, userId, clientNonce, roll) =>
        insertPreEvaluatedCampaignTableRoll(ctx, authority, userId, clientNonce, roll),
      retainPrivateRoll: async (userId, roll, gmCampaignRoll) => {
        const retained = await ctx.db
          .query('userRollHistory')
          .withIndex('by_userId_id', (q) => q.eq('userId', userId).eq('id', roll.id))
          .unique()
        if (!retained) await retainUserRoll(ctx, userId, roll, gmCampaignRoll)
      },
      recordConcentrationCheckRoll: (input) =>
        recordConcentrationCheckRoll(encounterWriteTransaction(ctx), input),
      postRulesChatMessage: (authority, input) =>
        postRulesChatMessage(encounterWriteTransaction(ctx), authority, input),
      writeCharacterRecord: async (input) => {
        await writeCharacterRecord(ctx, input)
      },
      snapshotBlueprintEnemies: (userId, input) => snapshotBlueprintEnemies(ctx, userId, input),
      executeCharacterCommand: (userId, input) =>
        executeEncounterCharacterCommand(ctx, userId, input)
    }
  }
  writeTransactions.set(ctx, transaction)
  return transaction
}
