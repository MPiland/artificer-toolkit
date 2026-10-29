import { recordConcentrationCheckRoll } from '@artificer-toolkit/encounter-persistence/concentrationRollPersistence'
import type { EncounterWriteTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import { postRulesChatMessage } from '@artificer-toolkit/encounter-persistence/rulesChatPersistence'
import type { MutationCtx } from '../_generated/server'
import { insertPreEvaluatedCampaignTableRoll } from '../campaigns/tableRoll'
import { writeCharacterRecord } from '../characters/characterWrites'
import { executeEncounterCharacterCommand } from '../characters/encounterCommands'
import type { CharacterSheetSourceContext } from '../characters/sheetFacts'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { readEncounterSource, snapshotBlueprintEnemies } from './blueprintSnapshots'
import { encounterReadPorts } from './encounterReadPorts'
import { readActorInitiativeRoll } from './initiativeSources'
import { snapshotEncounterOptionalCombatPolicies } from './policySnapshots'
import { retainUserRoll } from '../rollDocuments'
import { readLiveScene } from '../scenes/liveDocuments'

const writeTransactions = new WeakMap<
  MutationCtx,
  EncounterWriteTransaction<CharacterSheetSourceContext>
>()

/** A Convex mutation transaction as the Encounter code writes it; one per Convex context. */
export function encounterWriteTransaction(
  ctx: MutationCtx
): EncounterWriteTransaction<CharacterSheetSourceContext> {
  const known = writeTransactions.get(ctx)
  if (known) return known
  const transaction: EncounterWriteTransaction<CharacterSheetSourceContext> = {
    db: createConvexEncounterStore(ctx),
    ports: {
      ...encounterReadPorts(ctx),
      readEncounterSource: (userId, systemId, id, kind) =>
        readEncounterSource(ctx, userId, systemId, id, kind),
      readActorInitiativeRoll: (state, campaign, actorId) =>
        readActorInitiativeRoll(ctx, state, campaign, actorId),
      snapshotOptionalCombatPolicies: (campaign, userId, definitionIds) =>
        snapshotEncounterOptionalCombatPolicies(ctx, campaign, userId, definitionIds),
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
