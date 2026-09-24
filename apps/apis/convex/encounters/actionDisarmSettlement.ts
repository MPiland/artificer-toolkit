import { characterHistoryEntryDtoSchema } from '@artificer-toolkit/schema/api/characterHistory'
import { characterStoredCommandReceiptSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { contestedActionApplicationOutputDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { applyCharacterSheetCommand } from '@artificer-toolkit/rules-runtime/character/sheetCommandReducer'
import {
  applyEncounterActorOptionalContestSuccess,
  readEncounterActorOptionalContestContext
} from '@artificer-toolkit/rules-runtime/encounterActorOptionalContestContext'
import type { EncounterOptionalContestActionExecution } from '@artificer-toolkit/rules-runtime/encounterOptionalContestActionExecution'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { MutationCtx } from '../_generated/server'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { projectCharacterSheetFacts } from '../characters/sheetPreparation'
import type { prepareNativeDisarm } from './actionDisarmPreparation'
import { consumeNativeActionEconomy } from './actionEconomyPersistence'
import { requireSnapshotIdentity } from '@artificer-toolkit/rules-runtime/encounterActorState'
import {
  buildMovementTarget,
  nativeCharacterMaximumHitPoints
} from '@artificer-toolkit/rules-runtime/encounterMovementTargets'

/** Persists terminal item and ACTION changes inside the coordinator's transaction. */
export async function settleNativeDisarm(
  ctx: MutationCtx,
  input: {
    preparation: Awaited<ReturnType<typeof prepareNativeDisarm>>
    execution: Extract<EncounterOptionalContestActionExecution, { kind: 'COMPLETE' }>
    occurrenceId: string
    commandId: string
    sourceCommandId: string
    userId: string
    campaignOwnerUserId: string
    occurredAt: string
  }
) {
  const { preparation, execution } = input
  const { prepared, contest } = preparation
  if (contest.actionKind !== 'DISARM' || contest.selection.kind !== 'DISARM')
    throw new Error('Disarm settlement requires a Disarm contest.')
  const sourceWon = execution.initiator.total > execution.defender.total
  let target = prepared.target
  let stateTransition: ReturnType<
    typeof contestedActionApplicationOutputDtoSchema.parse
  >['stateTransition'] = { kind: 'NONE' }
  if (sourceWon) {
    const targetRow = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', target.encounterId).eq('id', target.id)
      )
      .unique()
    if (!targetRow || targetRow.stateChecksum !== checksumCanonicalJson(target))
      throw new Error('Disarm target changed before settlement.')
    const itemId = contest.selection.heldItemId
    if (target.kind === 'CHARACTER') {
      const facts = prepared.targetFacts.characterFacts
      if (
        !facts ||
        contest.target.kind !== 'CHARACTER' ||
        target.sourceId !== facts.active.id ||
        contest.target.characterId !== facts.active.id ||
        contest.target.streamVersion !== facts.active.streamVersion ||
        target.sourceRevision !== facts.active.streamVersion ||
        !facts.character.state.equipment.equipped.includes(itemId) ||
        contest.target.stateChecksum !==
          checksumRuleDocument({
            itemId,
            streamVersion: facts.active.streamVersion,
            equipped: facts.character.state.equipment.equipped
          })
      )
        throw new Error('Disarm Character item changed before settlement.')
      const active = await ctx.db.get(facts.active._id)
      if (
        !active ||
        active.status !== 'ACTIVE' ||
        active.id !== facts.active.id ||
        active.checksum !== facts.active.checksum ||
        active.streamVersion !== facts.active.streamVersion
      )
        throw new Error('Disarm Character changed before settlement.')
      const priorReceipt = await ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) =>
          q.eq('characterId', active.id).eq('commandId', input.commandId.toLowerCase())
        )
        .unique()
      if (priorReceipt) throw new Error('Disarm Character command already exists.')
      const character = characterAuthoredDtoSchema.parse(
        applyCharacterSheetCommand(
          facts.character,
          { type: 'UNEQUIP_ITEM', expectedVersion: active.streamVersion, itemId },
          projectCharacterSheetFacts(facts).sheet
        )
      )
      const streamVersion = active.streamVersion + 1
      const encoded: unknown = JSON.parse(JSON.stringify(character))
      await ctx.db.patch(active._id, {
        documentJson: canonicalizeRuleDocument(encoded),
        checksum: checksumRuleDocument(encoded),
        streamVersion,
        updatedAt: input.occurredAt
      })
      target = encounterRunActorStateSchema.parse({
        ...target,
        sourceRevision: streamVersion,
        snapshot: { ...requireSnapshotIdentity(target), sourceRevision: streamVersion }
      })
      const fresh = await loadCharacterSheetFacts(
        ctx,
        input.campaignOwnerUserId,
        active.id,
        prepared.state.campaignId
      )
      if (!fresh) throw new Error('Disarm Character source is unavailable after settlement.')
      target = encounterRunActorStateSchema.parse({
        ...target,
        maxHitPoints: nativeCharacterMaximumHitPoints(fresh, prepared.targetFacts.activeEffects)
      })
      target = buildMovementTarget({
        actor: target,
        activeEffects: prepared.targetFacts.activeEffects,
        gameSystemId: prepared.state.gameSystemId,
        campaignId: prepared.state.campaignId,
        characterFacts: fresh
      }).actor
      stateTransition = {
        kind: 'CHARACTER_ITEM_USE_STATE',
        characterId: active.id,
        itemInstanceId: itemId,
        fromState: 'EQUIPPED',
        toState: 'CARRIED',
        beforeStreamVersion: active.streamVersion,
        afterStreamVersion: streamVersion,
        beforeStateChecksum: checksumRuleDocument(facts.character.state.equipment),
        afterStateChecksum: checksumRuleDocument(character.state.equipment)
      }
      const receiptId = crypto.randomUUID()
      const history = characterHistoryEntryDtoSchema.parse({
        eventId: receiptId,
        occurredAt: input.occurredAt,
        actorId: input.userId,
        eventType: 'CHARACTER_RULE_EQUIPMENT_STATE_APPLIED',
        summary: 'Rule equipment state applied'
      })
      await ctx.db.insert(
        'characterCommandReceipts',
        characterStoredCommandReceiptSchema.parse({
          id: receiptId,
          characterId: active.id,
          commandId: input.commandId,
          actorId: input.userId,
          commandFingerprint: checksumRuleDocument({
            encounterId: prepared.state.id,
            occurrenceId: input.occurrenceId,
            sourceCommandId: input.sourceCommandId,
            targetActorId: target.id,
            stateTransition
          }),
          occurredAt: input.occurredAt,
          historyJson: canonicalizeRuleDocument(history),
          historyChecksum: checksumRuleDocument(history)
        })
      )
    } else if (target.kind === 'CREATURE') {
      const context = readEncounterActorOptionalContestContext({
        actor: target,
        loadoutEntryId: itemId
      })
      if (!context || context.stateChecksum !== contest.selection.heldItemStateChecksum)
        throw new Error('Disarm Creature item changed before settlement.')
      const applied = applyEncounterActorOptionalContestSuccess({ context, actor: target })
      target = encounterRunActorStateSchema.parse(applied.actor)
      stateTransition = {
        kind: 'ENCOUNTER_ACTOR_ITEM_USE_STATE',
        actorId: target.id,
        loadoutEntryId: context.equipment.loadoutEntryId,
        equipmentId: context.equipment.equipmentId,
        fromState: 'HELD',
        toState: 'CARRIED',
        beforeStateChecksum: applied.beforeStateChecksum,
        afterStateChecksum: applied.afterStateChecksum
      }
    } else {
      throw new Error('Disarm target is unavailable.')
    }
    await ctx.db.patch(targetRow._id, {
      stateJson: JSON.stringify(target),
      stateChecksum: checksumCanonicalJson(target)
    })
  }
  const actor = preparation.actionEconomy
    ? await consumeNativeActionEconomy(ctx, {
        actor: prepared.actor,
        consumption: preparation.actionEconomy
      })
    : prepared.actor
  const { definitionId, definitionVersion, definitionChecksum, moduleKey, moduleContractVersion } =
    contest.optionalCombat
  const applicationOutputs = contestedActionApplicationOutputDtoSchema.parse({
    kind: 'CONTESTED_ACTION',
    schemaVersion: 1,
    occurrenceId: input.occurrenceId,
    sourceActorId: contest.sourceActorId,
    targetActorId: contest.targetActorId,
    sealedContextChecksum: checksumRuleDocument(contest),
    policy: {
      definitionId,
      definitionVersion,
      definitionChecksum,
      moduleKey,
      moduleContractVersion
    },
    contestGraph: contest.contestGraph,
    sourceRoll: execution.initiator,
    targetRoll: execution.defender,
    outcome: sourceWon ? 'SOURCE_WIN' : 'TARGET_WIN_OR_TIE',
    stateTransition,
    actionEconomyTransition: preparation.actionEconomy
  })
  return { actor, target, applicationOutputs }
}
