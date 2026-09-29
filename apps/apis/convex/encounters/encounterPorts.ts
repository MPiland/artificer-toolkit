import type {
  CampaignAuthority,
  EncounterReadPorts,
  EncounterReadTransaction,
  EncounterWriteTransaction
} from '@artificer-toolkit/encounter-persistence/ports'
import { ruleCheckAuthorLabel } from '@artificer-toolkit/schema/api/campaignCommunication'
import {
  campaignStoredEntryHeaderSchema,
  campaignStoredEntryPayloadSchema
} from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { readCampaignAssignedCharacter } from '../campaigns/assignedCharacter'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireCampaignCharacterAuthority } from '../campaigns/characterState'
import {
  insertConversationEntry,
  openConversation,
  readCampaignAccessTime
} from '../campaigns/conversationDocuments'
import { insertPreEvaluatedCampaignTableRoll } from '../campaigns/tableRoll'
import { writeCharacterRecord } from '../characters/characterWrites'
import { executeEncounterCharacterCommand } from '../characters/encounterCommands'
import type { CharacterSheetSourceContext } from '../characters/sheetFacts'
import { readCharacterSheetState } from '../characters/sheetStateDocuments'
import { readCharacterPlay, readCharacterRecord } from '../characters/stateDocuments'
import { requireSystem } from '../content/systemDocuments'
import { requireIdentity } from '../lib/identity'
import { readAutoRollDice } from '../lib/rollPreferences'
import { requireActiveCampaignLiveAuthority } from '../liveSessions/authorityGuard'
import { readEncounterSource, snapshotBlueprintEnemies } from './blueprintSnapshots'
import { readActorInitiativeRoll } from './initiativeSources'
import { snapshotEncounterOptionalCombatPolicies } from './policySnapshots'
import { recordConcentrationCheckRoll } from './ruleCheckRolls'

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

/** A rules message in the table chat; like other rules entries it spends no chat rate limit. */
async function postRulesChatMessage(
  ctx: MutationCtx,
  authority: CampaignAuthority,
  input: { authorUserId: string; clientNonce: string; body: string }
) {
  const { campaign } = authority
  const { conversation } = await openConversation(ctx, authority, 'TABLE')
  const header = campaignStoredEntryHeaderSchema.parse({
    id: crypto.randomUUID(),
    campaignId: campaign.id,
    conversationId: conversation.id,
    authorUserId: input.authorUserId,
    clientNonce: input.clientNonce,
    createdAt: new Date(await readCampaignAccessTime(ctx, campaign)).toISOString()
  })
  await insertConversationEntry(
    ctx,
    header,
    campaignStoredEntryPayloadSchema.parse({
      entryId: header.id,
      kind: 'CHAT',
      mode: 'OOC',
      body: input.body,
      roll: null,
      revealedByGm: false,
      authorUsername: ruleCheckAuthorLabel,
      characterId: null,
      characterLabel: null,
      editedAt: null,
      unsentAt: null,
      consumedAt: null
    })
  )
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
    readCharacterSheetState,
    readCharacterPlay,
    readAssignedCharacter: (campaign, membership) =>
      readCampaignAssignedCharacter(ctx, campaign, membership),
    readAutoRollDice: (userId) => readAutoRollDice(ctx, userId),
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
    transaction = { db: ctx.db, ports: readPorts(ctx) }
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
    db: ctx.db,
    ports: {
      ...readPorts(ctx),
      insertTableRoll: (authority, userId, clientNonce, roll) =>
        insertPreEvaluatedCampaignTableRoll(ctx, authority, userId, clientNonce, roll),
      recordConcentrationCheckRoll: (input) => recordConcentrationCheckRoll(ctx, input),
      postRulesChatMessage: (authority, input) => postRulesChatMessage(ctx, authority, input),
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
