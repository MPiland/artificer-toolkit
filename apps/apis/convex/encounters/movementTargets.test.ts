import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { readTestActor } from '../../tests/fixtures/storedActors'
import { describe, expect, it } from 'vitest'
import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { api } from '../_generated/api'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { loadMovementTargets } from '@artificer-toolkit/encounter-persistence/movementTargetReads'
import { readMovementTargets } from '../../tests/fixtures/movementTargets'
import { encounterTurnReadTransaction } from './turnReadPorts'
import { readRunState, writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireIdentity } from '../lib/identity'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { applyCharacterScalarValuesToFacts } from '@artificer-toolkit/rules-runtime/encounterScalarReductions'
import { evaluateInstalledCharacterPolicy } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'

describe('native movement target facts', () => {
  it('reads targets only for the version and Campaign scope the caller verified', async () => {
    const fixture = await setupCharacterRun()
    const input = {
      encounterId: fixture.run.id,
      expectedEncounterVersion: fixture.run.version,
      targetActorIds: fixture.run.actors.map((actor) => actor.id),
      includeReactionSources: true
    }
    await fixture.owner.caller.run(async (ctx) => {
      const { userId } = await requireIdentity(ctx)
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (query) => query.eq('id', input.encounterId))
        .unique()
      if (!row) throw new Error('Fixture Run missing')
      const state = readRunState(row)
      const { campaign } = await requireCampaignAuthority(ctx, state.campaignId, userId)
      const tx = encounterTurnReadTransaction(ctx)
      const targetActorIds = input.targetActorIds
      expect((await loadMovementTargets(tx, { state, campaign, targetActorIds })).size).toBe(
        targetActorIds.length
      )
      await expect(
        readMovementTargets(ctx, { ...input, expectedEncounterVersion: state.version + 1 })
      ).rejects.toThrow('version is stale')
      await expect(
        loadMovementTargets(tx, {
          state,
          campaign: { ...campaign, id: crypto.randomUUID() },
          targetActorIds
        })
      ).rejects.toThrow('scope differs')
    })
  }, 30000)

  it('applies scalar reductions after existing bonuses and manual overrides without changing base facts', async () => {
    const fixture = await setupCharacterRun()
    await fixture.owner.caller.run(async (ctx) => {
      const loaded = await loadCharacterSheetFacts(
        ctx,
        fixture.owner.userId,
        fixture.character.id,
        fixture.campaign.id
      )
      if (!loaded) throw new Error('Fixture Character missing')
      const original = JSON.stringify(loaded.ruleEvaluation.facts)
      const definition = loaded.ruleEvaluation.facts.abilityDefinitions[0]!
      for (const override of [null, 21]) {
        const facts = {
          ...loaded.ruleEvaluation.facts,
          derivedBaseFacts: {
            ...loaded.ruleEvaluation.facts.derivedBaseFacts,
            abilities: loaded.ruleEvaluation.facts.derivedBaseFacts.abilities.map((ability) =>
              ability.abilityId !== definition.code
                ? ability
                : {
                    ...ability,
                    bonuses: [
                      ...ability.bonuses,
                      {
                        kind: 'FIXED' as const,
                        sourceId: 'fixture-bonus',
                        source: { kind: 'SYSTEM' as const, systemId: srdSystemRecord.id },
                        operation: 'ADD' as const,
                        value: 2
                      }
                    ],
                    scoreOverride:
                      override === null
                        ? null
                        : {
                            sourceId: 'fixture-override',
                            source: { kind: 'SYSTEM' as const, systemId: srdSystemRecord.id },
                            value: override
                          }
                  }
            )
          }
        }
        const base = evaluateInstalledCharacterPolicy({
          gameSystemId: srdSystemRecord.id,
          facts
        }).derivedStats.abilities.find((ability) => ability.abilityId === definition.code)!.score
          .effective
        const effective = applyCharacterScalarValuesToFacts(
          facts,
          srdSystemRecord.id,
          { [definition.id]: base },
          { [definition.id]: base - 2 }
        )
        const output = evaluateInstalledCharacterPolicy({
          gameSystemId: srdSystemRecord.id,
          facts: effective
        })
        expect(
          output.derivedStats.abilities.find((ability) => ability.abilityId === definition.code)!
            .score.effective
        ).toBe(base - 2)
      }
      expect(JSON.stringify(loaded.ruleEvaluation.facts)).toBe(original)
    })
  })

  it('evaluates selected custom and Creature protections from persisted actor facts', async () => {
    const fixture = await setupCharacterRun()
    const actor = fixture.run.actors.find((value) => value.kind === 'CUSTOM')!
    const input = {
      encounterId: fixture.run.id,
      expectedEncounterVersion: fixture.run.version,
      targetActorIds: [actor.id]
    }
    const custom = await fixture.owner.caller.run(async (ctx) =>
      (await readMovementTargets(ctx, input)).get(actor.id)!
    )
    expect(custom.defenses).toEqual([])
    expect(custom.baseScalarValues).toEqual({})
    const abilityId = srdSystemRecord.abilities?.[0]?.id
    if (!abilityId) throw new Error('Fixture ability missing')
    const damageTypeId = crypto.randomUUID()
    await fixture.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', fixture.run.id).eq('id', actor.id)
        )
        .unique()
      if (!row) throw new Error('Fixture actor missing')
      const stored = await readTestActor(ctx, row)
      const sourceId = crypto.randomUUID()
      const creature = encounterRunActorStateSchema.parse({
        ...stored,
        kind: 'CREATURE',
        sourceId,
        sourceRevision: 1,
        snapshot: {
          kind: 'CREATURE',
          id: sourceId,
          sourceRevision: 1,
          payload: {
            damageVulnerabilities: [],
            damageResistances: [damageTypeId],
            damageImmunities: [],
            conditionImmunities: [],
            features: []
          },
          ruleFacts: {
            gameSystemId: srdSystemRecord.id,
            vocabularySnapshotId: crypto.randomUUID(),
            vocabularySnapshotVersion: 1,
            vocabularySnapshotChecksum: 'a'.repeat(64),
            abilityScores: { [abilityId]: 12 },
            checkTotals: {},
            saveProficiencyBonuses: {},
            resourceAbilityScores: {},
            initiativeAbilityDefinitionId: abilityId,
            modifiers: []
          }
        }
      })
      await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, creature)
    })
    const creature = await fixture.owner.caller.run(async (ctx) =>
      (await readMovementTargets(ctx, input)).get(actor.id)!
    )
    expect(creature.baseScalarValues).toEqual({ [abilityId]: 12 })
    expect(creature.defenses).toEqual([{ kind: 'RESISTANCE', damageTypeId }])
  })

  it('refuses current private target facts after Campaign membership is revoked', async () => {
    const fixture = await setupCharacterRun()
    await fixture.t.run(async (ctx) => {
      const member = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', fixture.campaign.id).eq('userId', fixture.owner.userId)
        )
        .unique()
      if (!member) throw new Error('Fixture membership missing')
      await ctx.db.patch(member._id, { status: 'LEFT', leftAt: '2026-09-12T00:00:00.000Z' })
    })
    await expect(
      fixture.owner.caller.run((ctx) =>
        readMovementTargets(ctx, {
          encounterId: fixture.run.id,
          expectedEncounterVersion: fixture.run.version,
          targetActorIds: [fixture.actor.id]
        })
      )
    ).rejects.toThrow()
  })

  it('loads only the selected current Character and preserves persisted state', async () => {
    const fixture = await setupCharacterRun()
    const input = {
      encounterId: fixture.run.id,
      expectedEncounterVersion: fixture.run.version,
      targetActorIds: [fixture.actor.id]
    }
    const read = () =>
      fixture.owner.caller.run(async (ctx) => {
        const { characterFacts: _characterFacts, ...target } = (
          await readMovementTargets(ctx, input)
        ).get(fixture.actor.id)!
        return target
      })
    const first = await read()
    expect(first.state.current).toBe(fixture.actor.currentHitPoints)
    expect(first.effectiveMaximumHitPoints).toBe(fixture.actor.maxHitPoints)
    expect(first.effectiveRulePolicyOutput).toEqual(first.baseRulePolicyOutput)
    expect(Object.keys(first.baseScalarValues)).toHaveLength(6)
    expect(Object.keys(first.baseScalarValues).every((id) => /^[a-f0-9-]{36}$/.test(id))).toBe(true)
    expect(await read()).toEqual(first)
    await expect(
      fixture.owner.caller.run((ctx) =>
        readMovementTargets(ctx, {
          ...input,
          expectedEncounterVersion: input.expectedEncounterVersion + 1
        })
      )
    ).rejects.toThrow('version is stale')
    await expect(
      fixture.owner.caller.run((ctx) =>
        readMovementTargets(ctx, { ...input, targetActorIds: [crypto.randomUUID()] })
      )
    ).rejects.toThrow('actor was not found')
    await expect(
      fixture.owner.caller.run((ctx) =>
        readMovementTargets(ctx, {
          ...input,
          targetActorIds: [fixture.actor.id, fixture.actor.id.toUpperCase()]
        })
      )
    ).rejects.toThrow('input is invalid')
  })

  it('recomputes UUID-backed scalar policy and maximum HP from current effects', async () => {
    const fixture = await setupCharacterRun()
    const input = {
      encounterId: fixture.run.id,
      expectedEncounterVersion: fixture.run.version,
      targetActorIds: [fixture.actor.id]
    }
    const read = () =>
      fixture.owner.caller.run(async (ctx) => {
        const { characterFacts: _characterFacts, ...target } = (
          await readMovementTargets(ctx, input)
        ).get(fixture.actor.id)!
        return target
      })
    const before = await read()
    const ability =
      srdSystemRecord.abilities?.find((candidate) => candidate.code === 'STRENGTH') ??
      srdSystemRecord.abilities?.[0]
    if (!ability) throw new Error('Fixture ability missing')
    const definitionId = crypto.randomUUID()
    const entryId = crypto.randomUUID()
    const definition: ActiveRuleEffectDefinitionDto = {
      schemaVersion: 2,
      linkedEffectId: null,
      originLevel: null,
      origin: {
        kind: 'CHARACTER',
        sourceAggregateId: fixture.character.id,
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
          kind: 'SCALAR_REDUCTION',
          valueDefinitionId: ability.id,
          amount: 2,
          stacking: 'ADDITIVE',
          floor: 0,
          recoveryTriggers: ['LONG_REST'],
          terminalConsequence: 'TARGET_DIED',
          sourceOutcomeId: crypto.randomUUID(),
          sourceNodeId: 'entry',
          sourceOperationKey: 'comparison'
        },
        {
          kind: 'HIT_POINT_MAXIMUM_REDUCTION',
          amount: 1,
          recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM'],
          sourceLabel: 'Slam',
          sourceHidden: false,
          sourceDamageOutcomeId: crypto.randomUUID(),
          sourceDamageNodeId: 'entry',
          sourceDamageOperationKey: 'comparison'
        }
      ]
    }
    await fixture.owner.caller.run(async (ctx) => {
      await createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).create({
        owner: { kind: 'CHARACTER', characterId: fixture.character.id },
        id: crypto.randomUUID(),
        definition,
        lifecycle: { schemaVersion: 1, remainingTicks: null },
        maintainedEffectStateId: null
      })
    })
    const after = await read()
    expect(after.baseScalarValues).toEqual(before.baseScalarValues)
    expect(after.effectiveScalarValues[ability.id]).toBe(before.baseScalarValues[ability.id] - 2)
    expect(after.effectiveMaximumHitPoints).toBe(before.effectiveMaximumHitPoints - 1)
    const priorAbility = before.baseRulePolicyOutput!.derivedStats.abilities.find(
      (value) => value.abilityId === ability.code
    )!
    const effectiveAbility = after.effectiveRulePolicyOutput!.derivedStats.abilities.find(
      (value) => value.abilityId === ability.code
    )!
    expect(effectiveAbility.score.effective).toBe(priorAbility.score.effective - 2)
    expect(effectiveAbility.modifier.effective).toBe(priorAbility.modifier.effective - 1)
    expect(after.targetDerivedFacts).toEqual({
      ...after.effectiveRulePolicyOutput,
      savingThrowAddedDice: {},
      healingMaximized: false,
      incomingDamage: { halved: false, saveForHalf: [] },
      targetProtection: {
        status: 'NORMALIZED',
        defenses: after.effectiveRulePolicyOutput!.defenses,
        qualifiedDefenses: [],
        conditionImmunityIds: after.effectiveRulePolicyOutput!.conditionImmunityIds,
        spellSchoolImmunityIds: []
      }
    })
    await fixture.owner.caller.run((ctx) =>
      createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).updateLifecycleCas({
        owner: { kind: 'CHARACTER', characterId: fixture.character.id },
        id: after.activeEffects[0]!.id,
        expectedVersion: after.activeEffects[0]!.version,
        lifecycle: after.activeEffects[0]!.lifecycle
      })
    )
    const refreshed = await read()
    expect(refreshed.actor).toEqual(after.actor)
    expect(refreshed.characterCurrentness!.projectionChecksum).toBe(
      after.characterCurrentness!.projectionChecksum
    )
    expect(refreshed.characterCurrentness!.mechanicalContextChecksum).not.toBe(
      after.characterCurrentness!.mechanicalContextChecksum
    )
  })

  it('reads a Character changed on the Sheet after Run creation live', async () => {
    const fixture = await setupCharacterRun()
    await fixture.player.caller.mutation(api.characters.sheetCommands.execute, {
      id: fixture.character.id,
      command: {
        type: 'ADJUST_HIT_POINTS',
        mode: 'DAMAGE',
        amount: 1,
        expectedVersion: fixture.characterStreamVersion,
        commandId: crypto.randomUUID()
      }
    })
    const target = await fixture.owner.caller.run(async (ctx) => {
      const loaded = (
        await readMovementTargets(ctx, {
          encounterId: fixture.run.id,
          expectedEncounterVersion: fixture.run.version,
          targetActorIds: [fixture.actor.id]
        })
      ).get(fixture.actor.id)
      return {
        currentHitPoints: loaded?.state.current,
        streamVersion: loaded?.characterFacts?.active.play.streamVersion
      }
    })
    expect(target).toEqual({
      currentHitPoints: fixture.actor.currentHitPoints - 1,
      streamVersion: fixture.characterStreamVersion + 1
    })
  })
})
