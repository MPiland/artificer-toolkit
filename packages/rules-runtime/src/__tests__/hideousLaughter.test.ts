import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { hideousLaughter } from '@artificer-toolkit/source-data/srd/spells/hideous-laughter.js'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import {
  executeTargetBoundActiveRuleEffectWithPause,
  resumeTargetBoundActiveRuleEffectWithPause
} from '../targetBoundActiveRuleEffectExecutor.js'
import { createSrdRulesRuntime, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { compiledTestSpellCast, plannedTimedCondition } from '../testing/plannedTimedCondition.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'

const HOLDER_ID = testUuid(0xe303)
const WISDOM = SRD_ABILITIES.find(({ code }) => code === 'WISDOM')!.id
const conditionId = (code: string) => SRD_CONDITION_TYPES.find((entry) => entry.code === code)!.id
const PRONE = conditionId('PRONE')
const INCAPACITATED = conditionId('INCAPACITATED')

const { entry } = compiledTestSpellCast({
  spell: hideousLaughter,
  cast: {
    sequence: 0,
    candidateId: `CLASS:class-${hideousLaughter.id}:${hideousLaughter.id}:level:1`,
    spellId: hideousLaughter.id,
    source: {
      spellId: hideousLaughter.id,
      sourceKind: 'CLASS',
      sourceInstanceId: `class-${hideousLaughter.id}`
    },
    spellLevel: 1,
    castMode: 'SPELL_SLOT',
    castLevel: 1,
    baseEntry: true,
    resourceOwnerKey: null
  },
  decision: { status: 'AVAILABLE', reasonCode: 'SPELL_SLOT_REMAINING', slotKey: 'STANDARD:1' }
})
const { executionPlan, activeEffectPlan } = entry.compilation

describe('Hideous Laughter authored from core options', () => {
  it('holds Prone and Incapacitated for a minute of end-of-turn saves under Concentration', () => {
    expect(activeEffectPlan).toMatchObject({
      frozenGraphNodeId: 'repeat-save-test',
      recurrenceStage: 'END_OF_TURN',
      initialRemaining: 10,
      conditionContributions: [{ conditionId: PRONE }, { conditionId: INCAPACITATED }],
      adapterFacts: { 'dnd5e.active-effect-repeat-save-condition-ids': `${PRONE},${INCAPACITATED}` }
    })
    expect(activeEffectPlan?.maintenance).not.toBeNull()
  })

  it('stores the damage repeat with advantage on the plan', () => {
    expect(activeEffectPlan?.lifecycle?.repeatTriggers).toEqual([
      { event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null, rollInfluence: 'ADVANTAGE' }
    ])
  })

  it('proposes both conditions from the failed save, each with its own immunity fact', () => {
    if (executionPlan.kind !== 'TEST_OUTCOME') throw new Error('The cast saves, then applies.')
    const failed = executionPlan.outcomes.find(({ pathCode }) => pathCode === 'ON_SAVE_FAIL')
    const specialized = dnd5eCharacterRuleActionSystemAdapter.specializeOutcomeTemplate?.({
      compilerSource: executionPlan.compilerSource,
      testTemplate: executionPlan.test,
      selectedPath: 'ON_SAVE_FAIL',
      facts: {},
      testOutputs: { resultPath: 'ON_SAVE_FAIL' },
      testRollMode: 'NORMAL'
    })
    expect(specialized?.templateChecksum).toBe(failed?.template.checksum)
    const proposals = specialized?.published.definition.nodes.filter(
      ({ operation }) => operation.key === 'dnd5e.condition-apply-proposal'
    )
    expect(proposals?.map(({ inputs }) => inputs.conditionId)).toEqual([
      { kind: 'LITERAL', value: PRONE },
      { kind: 'LITERAL', value: INCAPACITATED }
    ])
    expect(
      new Set(proposals?.map(({ inputs }) => JSON.stringify(inputs.conditionImmune))).size
    ).toBe(2)
  })

  describe('at the end of the holder’s turn', () => {
    /** One tick of the planned effect on a holder with a +0 Wisdom save, answered with `face`. */
    async function tick(face: number, remainingTicks: number) {
      const { definition } = plannedTimedCondition({
        encounterId: testUuid(0xe301),
        sourceActorId: testUuid(0xe302),
        holderActorId: HOLDER_ID,
        spell: hideousLaughter,
        lifetimeScope: 'ENCOUNTER'
      })
      const lifecycle = { schemaVersion: 1 as const, remainingTicks }
      const input = {
        activeEffectId: testUuid(0xe304),
        activeEffectVersion: 1,
        definition,
        lifecycle,
        lifecycleChecksum: checksumRuleDocument(lifecycle),
        occurrenceId: testUuid(0xe305),
        targetActorId: HOLDER_ID,
        currentHitPoints: 10,
        temporaryHitPoints: 0,
        maximumHitPoints: 10,
        targetScalarValues: {},
        targetConditionIds: [PRONE, INCAPACITATED],
        targetDerivedFacts: {
          savingThrowDefinitions: [
            { abilityDefinitionId: WISDOM, modifier: 0, rollMode: 'NORMAL', contributors: [] }
          ]
        },
        defenses: [],
        runtime: createSrdRulesRuntime()
      } as const
      const paused = await executeTargetBoundActiveRuleEffectWithPause(input)
      if (!('continuation' in paused)) throw new Error('The holder is asked for its save.')
      const resumed = await resumeTargetBoundActiveRuleEffectWithPause({
        ...input,
        continuation: paused.continuation,
        resolution: {
          requestId: paused.continuation.request.requestId,
          rawFaces: [face],
          rollMode: 'NORMAL',
          addedDice: []
        }
      })
      if ('continuation' in resumed) throw new Error('The save resolves in one roll.')
      return resumed
    }

    it('removes both conditions and ends the effect on a made save', async () => {
      const ended = await tick(20, 10)
      expect(ended).toMatchObject({ terminal: true })
      expect(ended.applications.map((application) => application.kind)).toEqual([
        'CONDITION_REMOVE',
        'CONDITION_REMOVE'
      ])
      expect(
        ended.applications.map((application) =>
          'conditionId' in application ? application.conditionId : null
        )
      ).toEqual([PRONE, INCAPACITATED])
    })

    it('keeps both conditions on a failed save', async () => {
      expect(await tick(1, 10)).toMatchObject({ terminal: false, applications: [] })
    })

    it('removes both conditions when the minute runs out on a failed save', async () => {
      const expired = await tick(1, 1)
      expect(expired).toMatchObject({ terminal: true })
      expect(expired.applications).toHaveLength(2)
    })
  })
})
