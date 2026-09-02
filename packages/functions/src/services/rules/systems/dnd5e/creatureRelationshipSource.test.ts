import type { EncounterActorRecord, Json } from '@artificer-toolkit/db'
import { describe, expect, it } from 'vitest'

import { buildCompiledActionCompilerSource } from '../../characterActionEntryPointCompiler.js'
import { dnd5eCharacterRuleActionSystemAdapter } from './effectActionCompiler.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { cloakerBiteFixture, rugSmotherFixture } from './creatureRelationshipFixtures.js'

const ids = {
  encounter: '00000000-0000-4000-8000-000000000901',
  cloakerActor: '00000000-0000-4000-8000-000000000902',
  rugActor: '00000000-0000-4000-8000-000000000903',
  cloakerVersion: '00000000-0000-4000-8000-000000000904',
  rugVersion: '00000000-0000-4000-8000-000000000905'
}

function immutableCreatureActor(input: {
  actorId: string
  sourceVersionId: string
  sourceId: string
  label: string
  abilityScores: Readonly<Record<string, number>>
}): EncounterActorRecord {
  return {
    id: input.actorId,
    encounterId: ids.encounter,
    kind: 'CREATURE',
    sourceId: input.sourceId,
    sourceRevision: 1,
    label: input.label,
    systemId: DND5E_SYSTEM_ID,
    stableTieKey: input.actorId,
    public: true,
    currentHitPoints: 78,
    maxHitPoints: 78,
    tempHitPoints: 0,
    conditions: [],
    resources: {},
    gmNotes: null,
    initiative: null,
    manualOrder: null,
    snapshot: {
      kind: 'CREATURE',
      id: input.sourceId,
      systemId: DND5E_SYSTEM_ID,
      sourceRevision: 1,
      sourceVersionId: input.sourceVersionId,
      sourceChecksum: 'a'.repeat(64),
      payload: {
        size: 'MEDIUM',
        abilityScores: input.abilityScores,
        features: []
      }
    } as Json,
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z'
  }
}

describe('immutable Creature relationship capabilities', () => {
  it('compiles a Cloaker-shaped Bite fixture through the Creature TEST/OUTCOME source', () => {
    const fixture = cloakerBiteFixture()
    const capability = fixture.capability
    expect(
      immutableCreatureActor({
        actorId: ids.cloakerActor,
        sourceVersionId: ids.cloakerVersion,
        sourceId: fixture.source.creatureId,
        label: 'Cloaker fixture',
        abilityScores: fixture.abilityScores
      })
    ).toMatchObject({ sourceId: fixture.source.creatureId })
    const compilerSource = buildCompiledActionCompilerSource(capability)
    const plan = dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan!({
      action: capability,
      compilerSource
    })

    expect(plan.kind).toBe('TEST_OUTCOME')
    if (plan.kind !== 'TEST_OUTCOME') throw new Error('Expected a TEST_OUTCOME plan.')
    expect(plan.compilerSource).toMatchObject({
      effectId: capability.effectId,
      compiledEffectChecksum: capability.compiledEffectChecksum
    })
    expect(plan.test.published).toMatchObject({ id: capability.effectId })
    expect(plan.outcomes).toContainEqual(expect.objectContaining({ pathCode: 'ON_HIT' }))
    const bound = dnd5eCharacterRuleActionSystemAdapter.bindFacts({
      actionMechanic: {
        ...capability.mechanicFacts,
        attackBonus: capability.attackMechanic?.attackBonus ?? null,
        attackKind: 'MELEE',
        attackRollMode: capability.attackMechanic?.rollMode ?? 'NORMAL',
        save: null
      },
      published: plan.test.published,
      sourceDerivedFacts: { statBlock: { abilityScores: fixture.abilityScores } },
      targetActorId: ids.rugActor,
      targetDerivedFacts: { statBlock: { armorClass: 12 } },
      targetConditionIds: [],
      currentHitPoints: 33,
      temporaryHitPoints: 0,
      maximumHitPoints: 33,
      targetScalarValues: {},
      defenses: []
    })
    expect(bound.facts).toMatchObject({
      'dnd5e.resolved-damage-expression.on-hit': '2d6+3'
    })
  })

  it('compiles a Rug-shaped Smother fixture with a target start-turn recurrence', () => {
    const capability = rugSmotherFixture().capability
    const published = dnd5eCharacterRuleActionSystemAdapter.compile({ action: capability })
    const [plan] = dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans!({
      action: capability,
      published
    })

    expect(plan).toMatchObject({
      authoredEffectId: capability.effectId,
      recurrenceStage: 'START_OF_TURN',
      frozenGraph: expect.objectContaining({
        definition: expect.objectContaining({
          sourceEntryBindings: [expect.objectContaining({ sourceEntryId: expect.any(String) })]
        })
      }),
      actorRelationshipContribution: {
        capabilitySuppressions: [
          expect.objectContaining({ capabilityDefinitionIds: [expect.any(String)] })
        ],
        modules: expect.arrayContaining([
          expect.objectContaining({ kind: 'TARGET_SIZE_MAXIMUM', sizeCode: 'MEDIUM' }),
          expect.objectContaining({ kind: 'SOURCE_EXCLUSIVE_TARGET' }),
          expect.objectContaining({ kind: 'TARGET_CAPABILITY_SUPPRESSION' })
        ])
      }
    })
  })
})
