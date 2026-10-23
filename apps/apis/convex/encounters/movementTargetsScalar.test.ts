import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { describe, expect, it } from 'vitest'
import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { readMovementTargets } from '../../tests/fixtures/movementTargets'

describe('native movement target scalar facts', () => {
  it('uses effective Character policy facts after a persisted scalar reduction', async () => {
    const fixture = await setupCharacterRun()
    const input = {
      encounterId: fixture.run.id,
      expectedEncounterVersion: fixture.run.version,
      targetActorIds: [fixture.actor.id]
    }
    const before = await fixture.owner.caller.run(async (ctx) => {
      const target = (await readMovementTargets(ctx, input)).get(fixture.actor.id)!
      const sheet = await loadCharacterSheetFacts(
        ctx,
        fixture.owner.userId,
        fixture.character.id,
        fixture.campaign.id
      )
      if (!sheet) throw new Error('Fixture Character missing.')
      return {
        target: { baseRulePolicyOutput: target.baseRulePolicyOutput },
        abilityDefinitions: sheet.ruleEvaluation.facts.abilityDefinitions
      }
    })
    const beforeTarget = before.target
    const ability = beforeTarget.baseRulePolicyOutput!.derivedStats.abilities[0]!
    const abilityDefinition = before.abilityDefinitions.find(
      (value) => value.code === ability.abilityId
    )
    if (!abilityDefinition) throw new Error('Fixture ability definition missing.')
    const definitionId = crypto.randomUUID()
    const entryId = crypto.randomUUID()
    const definition: ActiveRuleEffectDefinitionDto = {
      schemaVersion: 2,
      linkedEffectId: null,
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
          gameSystemId: fixture.campaign.gameSystemId,
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
          valueDefinitionId: abilityDefinition.id,
          amount: 2,
          stacking: 'ADDITIVE',
          floor: 0,
          recoveryTriggers: ['LONG_REST'],
          terminalConsequence: 'TARGET_DIED',
          sourceOutcomeId: crypto.randomUUID(),
          sourceNodeId: 'entry',
          sourceOperationKey: 'comparison'
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
    const after = await fixture.owner.caller.run(async (ctx) => {
      const target = (await readMovementTargets(ctx, input)).get(fixture.actor.id)!
      return {
        baseRulePolicyOutput: target.baseRulePolicyOutput,
        effectiveRulePolicyOutput: target.effectiveRulePolicyOutput,
        targetDerivedFacts: target.targetDerivedFacts,
        defenses: target.defenses,
        conditionImmunityIds: target.conditionImmunityIds
      }
    })
    const effectiveAbility = after.effectiveRulePolicyOutput!.derivedStats.abilities.find(
      (value) => value.abilityId === ability.abilityId
    )!
    const baseAbility = after.baseRulePolicyOutput!.derivedStats.abilities.find(
      (value) => value.abilityId === ability.abilityId
    )!
    expect(effectiveAbility.score.effective).toBe(baseAbility.score.effective - 2)
    expect(after.targetDerivedFacts).toEqual({
      ...after.effectiveRulePolicyOutput,
      savingThrowAddedDice: {},
      healingMaximized: false,
      targetProtection: {
        status: 'NORMALIZED',
        defenses: after.effectiveRulePolicyOutput!.defenses,
        qualifiedDefenses: [],
        conditionImmunityIds: after.effectiveRulePolicyOutput!.conditionImmunityIds,
        spellSchoolImmunityIds: []
      }
    })
    expect(after.defenses).toEqual(after.effectiveRulePolicyOutput!.defenses)
    expect(after.conditionImmunityIds).toEqual(
      after.effectiveRulePolicyOutput!.conditionImmunityIds
    )
  }, 30000)
})
