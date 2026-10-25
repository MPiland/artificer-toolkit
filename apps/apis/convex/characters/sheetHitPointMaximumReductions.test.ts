import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { describe, expect, it } from 'vitest'
import { characterSheetCommandInputDtoSchema } from '@artificer-toolkit/schema/api/characterSheetCommands'
import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { HitPointMaximumReductionRecoveryTag } from '@artificer-toolkit/schema/effects/hitPointMaximumReduction'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { api } from '../_generated/api'
import { readMovementTargets } from '../../tests/fixtures/movementTargets'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'

function reductionDefinition(
  characterId: string,
  amount: number,
  recoveryTags: HitPointMaximumReductionRecoveryTag[]
): ActiveRuleEffectDefinitionDto {
  const definitionId = crypto.randomUUID()
  const entryId = crypto.randomUUID()
  return {
    schemaVersion: 2,
    linkedEffectId: null,
    originLevel: null,
    origin: {
      kind: 'CHARACTER',
      sourceAggregateId: characterId,
      sourceOccurrenceId: crypto.randomUUID(),
      rootCommandId: crypto.randomUUID()
    },
    authoredEffectId: definitionId,
    compiledEntryId: entryId,
    frozenGraphNodeId: 'entry',
    frozenGraph: {
      schemaVersion: 1,
      source: {
        definitionId,
        gameSystemId: srdSystemRecord.id,
        definitionFamilyKey: 'effect',
        checksum: 'a'.repeat(64)
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [{ id: 'entry', operation: { key: 'comparison', contractVersion: 1 }, inputs: {} }],
      sourceEntryBindings: [{ sourceEntryId: entryId, nodeId: 'entry' }],
      outputs: { result: { kind: 'LITERAL', value: true } }
    },
    adapterFacts: {},
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: 'NONE',
      anchor: 'HOLDER',
      consumeOnFirstEvents: [],
      endOnEvents: [],
      endOnTriggers: [],
      endOnConditionIds: [],
      holderEnd: null,
      lifetimeScope: 'OWNER',
      expiration: { kind: 'INDEFINITE' }
    },
    stateContributions: [
      {
        kind: 'HIT_POINT_MAXIMUM_REDUCTION',
        amount,
        recoveryTags,
        sourceLabel: 'Life Drain',
        sourceHidden: false,
        sourceDamageOutcomeId: crypto.randomUUID(),
        sourceDamageNodeId: 'entry',
        sourceDamageOperationKey: 'comparison'
      }
    ]
  }
}

describe('Character Sheet hit point maximum reductions (D62)', () => {
  it('reduces the Sheet maximum as the Encounter does until a long rest ends the reduction', async () => {
    const fixture = await setupCharacterRun()
    const readSheet = async () => {
      const sheet = await fixture.player.caller.query(api.characters.sheet.get, {
        id: fixture.character.id
      })
      if (!sheet) throw new Error('Missing Character Sheet.')
      return sheet
    }
    const before = await readSheet()
    const baseMaximum = before.overview.maxHitPoints
    expect(before.overview.currentHitPoints).toBe(baseMaximum)
    expect(before.overview.maxHitPointsReductions).toEqual([])

    const drainId = crypto.randomUUID()
    await fixture.owner.caller.run((ctx) =>
      createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).create({
        id: drainId,
        owner: { kind: 'CHARACTER', characterId: fixture.character.id },
        definition: reductionDefinition(fixture.character.id, 4, [
          'RESTORE_HIT_POINT_MAXIMUM',
          'LONG_REST'
        ]),
        lifecycle: { schemaVersion: 1, remainingTicks: null },
        maintainedEffectStateId: null
      })
    )

    const drained = await readSheet()
    expect(drained.overview).toMatchObject({
      maxHitPoints: baseMaximum - 4,
      currentHitPoints: baseMaximum - 4,
      maxHitPointsReductions: [
        {
          id: drainId,
          label: 'Life Drain',
          sourceHidden: false,
          amount: 4,
          recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM', 'LONG_REST']
        }
      ]
    })
    // The stored column keeps the maximum before active-effect reductions.
    expect((await fixture.readState()).character?.play.maximumHitPoints).toBe(baseMaximum)

    const encounter = await fixture.owner.caller.query(api.encounters.projectionReads.get, {
      encounterId: fixture.run.id
    })
    expect(encounter.actors.find((actor) => actor.id === fixture.actor.id)).toMatchObject({
      maxHitPoints: baseMaximum - 4,
      currentHitPoints: baseMaximum - 4
    })
    const encounterMaximum = await fixture.owner.caller.run(
      async (ctx) =>
        (
          await readMovementTargets(ctx, {
            encounterId: fixture.run.id,
            expectedEncounterVersion: fixture.run.version,
            targetActorIds: [fixture.actor.id]
          })
        ).get(fixture.actor.id)?.effectiveMaximumHitPoints
    )
    expect(encounterMaximum).toBe(drained.overview.maxHitPoints)

    const healed = await fixture.player.caller.mutation(api.characters.sheetCommands.execute, {
      id: fixture.character.id,
      command: {
        type: 'ADJUST_HIT_POINTS',
        mode: 'HEAL',
        amount: 10,
        expectedVersion: drained.meta.streamVersion,
        commandId: crypto.randomUUID()
      }
    })
    expect(healed).not.toHaveProperty('sheet')
    const healedSheet = (await fixture.player.caller.query(api.characters.sheet.get, {
      id: healed.characterId
    }))!
    expect(healedSheet.overview.currentHitPoints).toBe(baseMaximum - 4)

    const input = {
      restKind: 'LONG' as const,
      expectedVersion: healed.streamVersion,
      selectedHitDice: [],
      resetMaximumHitPointModifier: false,
      healingMode: 'AUTOMATIC' as const,
      manualHealingAccepted: false,
      selectedCompanionInstanceIds: [],
      requestRoll: false as const
    }
    const preview = await fixture.player.caller.query(api.characters.rest.preview, {
      id: fixture.character.id,
      input
    })
    expect(preview.hitPoints.maximum).toBe(baseMaximum)
    const rested = await fixture.player.caller.mutation(api.characters.sheetCommands.execute, {
      id: fixture.character.id,
      command: characterSheetCommandInputDtoSchema.parse({
        ...input,
        type: 'COMPLETE_REST',
        commandId: crypto.randomUUID(),
        previewFingerprint: preview.previewFingerprint
      })
    })
    expect(rested).not.toHaveProperty('sheet')
    const restedSheet = (await fixture.player.caller.query(api.characters.sheet.get, {
      id: rested.characterId
    }))!
    expect(restedSheet.overview).toMatchObject({
      maxHitPoints: baseMaximum,
      currentHitPoints: baseMaximum,
      maxHitPointsReductions: []
    })
    expect((await fixture.readState()).character?.play.maximumHitPoints).toBe(baseMaximum)
  }, 30000)
})
