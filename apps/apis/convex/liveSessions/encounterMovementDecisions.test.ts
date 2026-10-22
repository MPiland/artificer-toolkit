import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'
// @vitest-environment node
import { expect, it } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
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
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { SRD_REACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import {
  checkpointLiveRoom,
  closeRoom,
  executeInRoom,
  executeSceneInRoom,
  queueRoomRolls,
  seedRoomContentSnapshots,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

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
        modifierKind: 'ROLL_INFLUENCE' as const,
        payload: { influence: 'ADVANTAGE' },
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
    // The room reads the content snapshots current when it activates, so rebuild them with the Concentration rules.
    await seedRoomContentSnapshots(value.base.campaign.id)
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
    const choice = (await executeSceneInRoom(value.owner.caller, rootInput)).result?.occurrence
      ?.pending
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
    /** Convex's rows, after the room checkpoints what it holds (a Run's history is the room's until then, D85). */
    const records = async () => {
      await checkpointLiveRoom(value.base.campaign.id)
      return value.base.t.run(async (ctx) => ({
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
        sceneStates: await ctx.db.query('sceneLiveStates').collect()
      }))
    }

    const before = await records()
    if (asPlayer) {
      // The room holds the Run, so it closes (checkpointing) before Convex's control grant changes.
      await closeRoom(value.base.campaign.id)
      await setReactorControl([])
      const revoked = await records()
      await expect(executeInRoom(initiator.caller, { command: useCommand })).rejects.toThrow()
      await closeRoom(value.base.campaign.id)
      expect(await records()).toEqual(revoked)
      await setReactorControl([initiator.userId])
    }
    const occurrenceId = choice.occurrenceId
    // The first roll (the reaction's attack) hits; every later one (the Concentration save) is a 1.
    await queueRoomRolls(value.base.campaign.id, { rolls: [14], repeat: 0 })
    const published = await executeInRoom(initiator.caller, { command: useCommand })
    const committed = await records()
    // The room holds the settled result and its Concentration evidence (D85), pinned in
    // apps/session-worker/test/nativeMovementEvidence.test.ts ("a used automatic reaction followed
    // by a failed Concentration save"). What a member sees is the settled state below.
    const spatialHits = withSuffix ? 1 : 0
    expect(before.maintained.map((entry) => entry.id)).toContain(seeded.state.id)
    expect(before.effects.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([seeded.dependent.id, seeded.independent.id])
    )
    expect(before.spatialEffects.map((entry) => entry.id)).toEqual(oneShot ? [oneShot.id] : [])
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
    const targetActor = settledActors.find((actor) => actor.id === value.base.mover.id)
    const sourceActor = settledActors.find((actor) => actor.id === reactor.id)
    // The reactor spent its one Reaction allowance.
    expect(
      sourceActor && encounterRuleUsageUsed(sourceActor, SRD_REACTION_ALLOWANCE_DEFINITION_ID)
    ).toBe(1)
    expect(targetActor?.kind).toBe('CHARACTER')
    // The room's play clock travels in the checkpoint: it advances once per Character state change
    // (the reaction hit, the Concentration owner transition and each spatial hit).
    expect(committed.character?.play.streamVersion).toBe(
      before.character!.play.streamVersion + 2 + spatialHits
    )
    expect(committed.characterReceipts).toEqual(before.characterReceipts)
    if (!committed.character) throw new Error('Settled Character is unavailable.')
    const character = readCharacterRecord(committed.character)
    // The reaction's bite deals 1, and each spatial hit deals 1.
    expect(character.state.hitpoints.current).toBe(
      readCharacterRecord(before.character!).state.hitpoints.current - 1 - spatialHits
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
  },
  120_000
)
