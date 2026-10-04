import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'
import { readReceiptHeaders } from '../lib/receiptLedgers'
// @vitest-environment node
import { expect, it, vi } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { concentrationCommandId } from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_CONCENTRATION_DEFINITIONS,
  SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
} from '@artificer-toolkit/source-data/srd/concentration.js'
import { setupAutomaticCharacterMovement } from '../../tests/fixtures/automaticCharacterMovement'
import { grantFixtureActorControl } from '../../tests/fixtures/spatialPreparation'
import { seedConcentration } from '../../tests/fixtures/concentration'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import { sourceImportBatches } from '../content/importBatches'
import { internal } from '../_generated/api'
import * as rollRandom from '../lib/rollRandom'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import {
  planMovementDecisionInRoom,
  planMovementInRoom,
  readEncounterHistory
} from '../../tests/fixtures/liveSessionWorker'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: vi.fn() }))

const concentrationAdvantageFeature = {
  id: '00000000-0000-4000-8000-000000000c30',
  label: 'Focused Concentration',
  description: 'You have advantage on Constitution saving throws to maintain Concentration.',
  availableAtLevel: 1,
  order: 0,
  grants: {
    modifiers: [
      {
        id: '00000000-0000-4000-8000-000000000c31',
        grantKind: 'MODIFIER_GRANT' as const,
        valueDomainCode: 'SAVING_THROW_MODIFIER' as const,
        domain: {
          ability: 'CONSTITUTION' as const,
          ruleDefinitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
        },
        modifierKind: 'ADVANTAGE' as const,
        scope: 'GLOBAL' as const,
        selectionKind: 'GRANTED' as const,
        order: 0
      }
    ]
  }
}


it.each([
  { withSuffix: false, asPlayer: false },
  { withSuffix: true, asPlayer: false },
  { withSuffix: false, asPlayer: true }
])(
  'settles a used automatic reaction and failed Concentration with spatial suffix $withSuffix as PLAYER $asPlayer',
  async ({ withSuffix, asPlayer }) => {
    const random = vi.mocked(rollRandom.nextRollInt)
    random.mockReset()
    random.mockReturnValueOnce(14).mockReturnValue(0)
    const value = await setupAutomaticCharacterMovement(
      ['AUTOMATIC'],
      false,
      {
        features: [concentrationAdvantageFeature]
      },
      asPlayer
    )
    // Assisted play offers the authored automatic reaction to its controller as Use/Decline; the
    // controller (the GM, or a player the GM granted the reactor) answers it through the room.
    const initiator = asPlayer ? value.additionalPlayer : value.owner
    if (!initiator) throw new Error('Additional movement Player is unavailable.')
    const reactor = value.base.reactors[0]
    if (!reactor) throw new Error('Movement reactor is unavailable.')
    const setReactorControl = (controllerUserIds: string[]) =>
      value.base.t.run((ctx) =>
        grantFixtureActorControl(ctx, {
          encounterId: value.base.run.id,
          actorId: reactor.id,
          controllerUserIds
        })
      )
    if (asPlayer) await setReactorControl([initiator.userId])
    for (const definitions of sourceImportBatches(SRD_CONCENTRATION_DEFINITIONS))
      await value.base.t.mutation(internal.content.import.importDefinitions, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitions
      })
    const seeded = await seedConcentration({
      t: value.base.t,
      run: value.base.run,
      target: value.base.mover,
      character: value.base.character
    })
    const oneShot = withSuffix
      ? await seedSpatialEffect({ ...value.base, sceneId: value.sceneId }, { x: 375, y: 50 }, 5)
      : null
    const rootInput = withSuffix
      ? { ...value.rootInput, path: [value.rootInput.path[0]!, { x: 450, y: 50 }] }
      : value.rootInput
    const root = await planMovementInRoom(value.owner.caller, rootInput)
    const choice = (await root.publish()).occurrence?.pending
    if (!choice || choice.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
      throw new Error('Expected the Assisted Use/Decline reaction choice.')
    const responseCommandId = crypto.randomUUID()
    const useCommand: ResolveRuleOccurrenceInputDto = {
      type: 'RESOLVE_RULE_OCCURRENCE',
      commandId: responseCommandId,
      encounterId: value.base.run.id,
      expectedVersion: choice.encounterVersion,
      occurrenceId: choice.occurrenceId,
      expectedOccurrenceVersion: choice.occurrenceVersion,
      correlationId: null,
      resolution: { kind: 'OPTION', optionId: choice.choice.options[0].optionId }
    }
    const records = () =>
      value.base.t.run(async (ctx) => ({
        receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
        receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
        run: await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
          .unique(),
        actors: await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
          .collect(),
        character: await readCharacterRow(ctx, value.base.character.id),
        maintained: await ctx.db
          .query('encounterMaintainedEffectStates')
          .withIndex('by_encounter_owner_definition_order', (q) =>
            q.eq('encounterId', value.base.run.id)
          )
          .collect(),
        effects: await ctx.db
          .query('characterActiveRuleEffects')
          .withIndex('by_characterId_createdOrdinal_id', (q) =>
            q.eq('characterId', value.base.character.id)
          )
          .collect(),
        spatialEffects: await ctx.db
          .query('encounterSpatialRuleEffects')
          .withIndex('by_encounterId_sceneId_createdOrdinal_id', (q) =>
            q.eq('encounterId', value.base.run.id).eq('sceneId', value.sceneId)
          )
          .collect(),
        receipts: await (await readEncounterHistory(ctx))
          .query('encounterRuleReceipts')
          .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', value.base.run.id))
          .collect(),
        characterReceipts: await ctx.db
          .query('characterCommandReceipts')
          .withIndex('by_characterId_commandId', (q) =>
            q.eq('characterId', value.base.character.id)
          )
          .collect(),
        occurrences: await ctx.db
          .query('encounterRuleOccurrences')
          .withIndex('by_encounterId_state', (q) => q.eq('encounterId', value.base.run.id))
          .collect(),
        sceneCommands: await ctx.db.query('sceneLiveCommands').collect(),
        sceneStates: await ctx.db.query('sceneLiveStates').collect()
      }))

    const before = await records()
    if (asPlayer) {
      await setReactorControl([])
      const revoked = await records()
      await expect(planMovementDecisionInRoom(initiator.caller, useCommand)).rejects.toThrow()
      expect(await records()).toEqual(revoked)
      await setReactorControl([initiator.userId])
    }
    const occurrenceId = choice.occurrenceId
    const plan = await planMovementDecisionInRoom(initiator.caller, useCommand)
    const outcome = plan.outcome
    expect(outcome.kind).toBe('TERMINAL')
    if (outcome.kind !== 'TERMINAL') throw new Error('Expected terminal movement.')
    const reaction = outcome.result.reactionExecutions[0]
    const concentration = reaction?.concentrationChecks?.[0]
    if (!concentration) throw new Error('Expected reaction Concentration evidence.')
    if (reaction.application.kind !== 'CHARACTER_MECHANICS_BATCH')
      throw new Error('Expected a Character movement reaction target.')
    const spatial = outcome.result.status === 'BATCH_COMPLETE' ? outcome.result.executions : []
    if (withSuffix) {
      if (!oneShot) throw new Error('Expected the one-shot spatial fixture.')
      expect(spatial).toHaveLength(1)
      expect(spatial[0]?.candidate.candidate.effectId).toBe(oneShot.id)
      expect(spatial[0]?.candidate.candidate.targetActorId).toBe(value.base.mover.id)
      expect(spatial[0]!.candidate.candidate.pathDistance).toBeGreaterThan(
        reaction.option.candidate.pathDistance
      )
    } else expect(spatial).toHaveLength(0)
    expect(concentration.result.applicationOutputs).toMatchObject({
      outcome: 'SAVE_FAILURE',
      d20: { rawFaces: [1, 1], rollMode: 'ADVANTAGE', dc: 10, modifier: 1 },
      cleanup: {
        maintainedStateId: seeded.state.id,
        removedDependentEffectIds: expect.arrayContaining([seeded.dependent.id])
      }
    })
    expect(concentration.ownerTransitions).toMatchObject([
      {
        characterId: value.base.character.id,
        targetActorId: value.base.mover.id,
        after: { conditionIds: expect.arrayContaining([seeded.poisoned.id]) }
      }
    ])
    expect(concentration.ownerTransitions[0]?.after.conditionIds).not.toContain(seeded.blinded.id)
    expect(random).toHaveBeenCalledTimes(3)
    expect(before.maintained.map((entry) => entry.id)).toContain(seeded.state.id)
    expect(before.effects.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([seeded.dependent.id, seeded.independent.id])
    )
    expect(before.spatialEffects.map((entry) => entry.id)).toEqual(oneShot ? [oneShot.id] : [])
    expect(await records()).toEqual(before)

    const published = await plan.publish()
    const committed = await records()
    // A decision answer returns its Encounter result for the member.
    expect(published.occurrence).toMatchObject({ occurrenceId, status: 'COMPLETE' })
    expect(committed.run?.version).toBe(before.run!.version + 1)
    const settledActors = await initiator.caller.run(async (ctx) => {
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
        .unique()
      if (!run) throw new Error('Published movement Run is unavailable.')
      return readRunActors({ db: createConvexEncounterStoreReader(ctx) }, readRunState(run))
    })
    const sourceActor = settledActors.find(
      (actor) => actor.id === reaction.option.candidate.reactorActorId
    )
    const targetActor = settledActors.find((actor) => actor.id === value.base.mover.id)
    expect(
      sourceActor && encounterRuleUsageUsed(sourceActor, reaction.allowance.definitionId)
    ).toBe(reaction.allowance.afterUsed)
    expect(targetActor?.kind).toBe('CHARACTER')
    // The room's play clock travels in the checkpoint: it advances once per Character state change
    // (the reaction hit, the Concentration owner transition and each spatial hit).
    expect(committed.character?.play.streamVersion).toBe(
      before.character!.play.streamVersion +
        1 +
        concentration.ownerTransitions.length +
        spatial.length
    )
    expect(committed.characterReceipts).toEqual(before.characterReceipts)
    if (!committed.character) throw new Error('Settled Character is unavailable.')
    const character = readCharacterRecord(committed.character)
    expect(character.state.hitpoints.current).toBe(
      withSuffix
        ? spatial.at(-1)!.targetTransition.after.currentHitPoints
        : reaction.application.targetTransition.after.currentHitPoints
    )
    expect((character.state.conditions ?? []).map((entry) => entry.conditionTypeId)).toContain(
      seeded.poisoned.id
    )
    expect((character.state.conditions ?? []).map((entry) => entry.conditionTypeId)).not.toContain(
      seeded.blinded.id
    )
    expect(committed.maintained.map((entry) => entry.id)).not.toContain(seeded.state.id)
    expect(committed.effects.map((entry) => entry.id)).toEqual([seeded.independent.id])
    expect(committed.spatialEffects.map((entry) => entry.id)).toEqual([])
    const child = committed.receipts.find(
      (entry) => entry.commandId === concentrationCommandId(concentration.result.occurrenceId)
    )
    if (!child) throw new Error('Movement Concentration receipt is unavailable.')
    expect(child.actorUserId).toBe(initiator.userId)
    expect(storedRuleExecutionResultDtoSchema.parse(JSON.parse(child.resultJson))).toEqual(
      concentration.result
    )
    const rootReceipt = committed.receipts.find((entry) => entry.commandId === responseCommandId)
    if (!rootReceipt) throw new Error('Published movement response receipt is unavailable.')
    expect(rootReceipt.actorUserId).toBe(initiator.userId)
    const rootResult = storedRuleExecutionResultDtoSchema.parse(JSON.parse(rootReceipt.resultJson))
    expect(rootResult).toEqual(outcome.result)
    expect(rootResult).toMatchObject({
      reactionExecutions: [{ concentrationChecks: [concentration] }]
    })
  },
  120_000
)
