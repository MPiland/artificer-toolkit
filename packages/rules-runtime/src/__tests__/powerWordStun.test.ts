import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { powerWordStun } from '@artificer-toolkit/source-data/srd/spells/power-word-stun.js'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { characterRuleActionSystemAdapterRegistry } from '../characterRuleActionSystemAdapterRegistry.js'
import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { prepareEncounterActionEffectPlans } from '../encounterActionEffectPlans.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import {
  executeTargetBoundActiveRuleEffectWithPause,
  resumeTargetBoundActiveRuleEffectWithPause
} from '../targetBoundActiveRuleEffectExecutor.js'
import { createSrdRulesRuntime, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { compiledTestSpellCast } from '../testing/plannedTimedCondition.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'

const SOURCE_ID = testUuid(0xe201)
const TARGET_ID = testUuid(0xe202)
const SAVE_DC = 17
const CONSTITUTION = SRD_ABILITIES.find(({ code }) => code === 'CONSTITUTION')!.id
const STUNNED = SRD_CONDITION_TYPES.find(({ code }) => code === 'STUNNED')!.id

const { entry } = compiledTestSpellCast({
  spell: powerWordStun,
  cast: {
    sequence: 0,
    candidateId: `CLASS:class-${powerWordStun.id}:${powerWordStun.id}:level:8`,
    spellId: powerWordStun.id,
    source: {
      spellId: powerWordStun.id,
      sourceKind: 'CLASS',
      sourceInstanceId: `class-${powerWordStun.id}`
    },
    spellLevel: 8,
    castMode: 'SPELL_SLOT',
    castLevel: 8,
    baseEntry: true,
    resourceOwnerKey: null
  },
  decision: { status: 'AVAILABLE', reasonCode: 'SPELL_SLOT_REMAINING', slotKey: 'STANDARD:8' }
})
const { executionPlan, activeEffectPlan } = entry.compilation

/** Casts Power Word Stun at a target with `hitPoints`, the caster's save DC settled at 17. */
async function cast(hitPoints: number) {
  if (executionPlan.kind !== 'SINGLE_GRAPH')
    throw new Error('Power Word Stun applies its condition in one graph.')
  const result = await executeNativeActionGraphs({
    runtime: createPlatformRulesRuntime({
      definitions: {
        async requireCurrent() {
          throw new Error('Definitions are not used by sealed graphs.')
        }
      }
    }),
    adapter: dnd5eCharacterRuleActionSystemAdapter,
    plan: executionPlan,
    occurrenceId: testUuid(0xe203),
    binding: {
      actionMechanic: {
        attackBonus: null,
        attackKind: null,
        attackAbility: null,
        attackRollMode: 'NORMAL',
        save: { abilityDefinitionId: CONSTITUTION, dc: SAVE_DC },
        outcomes: []
      },
      sourceDerivedFacts: {},
      targetActorId: TARGET_ID,
      targetDerivedFacts: { statBlock: { armorClass: 12 }, savingThrowDefinitions: [] },
      targetConditionIds: [],
      currentHitPoints: hitPoints,
      temporaryHitPoints: 0,
      maximumHitPoints: Math.max(hitPoints, 1),
      targetScalarValues: {},
      defenses: []
    },
    afterTest: async () => undefined
  })
  return result
}

/** The effect the room plans from a cast's settled evidence. */
async function plannedEffect(hitPoints: number) {
  const result = await cast(hitPoints)
  const planned = prepareEncounterActionEffectPlans({
    encounterId: testUuid(0xe204),
    occurrenceId: testUuid(0xe203),
    commandId: testUuid(0xe205),
    sourceActorId: SOURCE_ID,
    sourceLabel: powerWordStun.label,
    sourceHidden: false,
    currentActorId: null,
    target: {
      actorId: TARGET_ID,
      conditionIds: [],
      effectiveSize: 'MEDIUM',
      lifetimeScope: 'ENCOUNTER',
      activeEffects: []
    },
    activeEffectsByActorId: new Map(),
    activeEffectPlan,
    published: result.published,
    execution: result.execution,
    d20: result.d20,
    applications: result.applications
  })
  return { result, recurringEffect: planned.recurringEffect }
}

describe('the SRD Power Word Stun (a hit-point gate, a condition and a repeated save), from data', () => {
  it('gates the condition at 150 hit points on a version 2 condition proposal', () => {
    if (executionPlan.kind !== 'SINGLE_GRAPH') throw new Error('Expected one graph.')
    const [node] = executionPlan.published.definition.nodes
    expect(node).toMatchObject({
      operation: { key: 'dnd5e.condition-apply-proposal', contractVersion: 2 },
      inputs: {
        hitPointsAbove: { kind: 'LITERAL', value: -1 },
        hitPointsAtMost: { kind: 'LITERAL', value: 150 }
      }
    })
  })

  it.each([1, 150])('stuns a target with %i hit points', async (hitPoints) => {
    const { result } = await plannedEffect(hitPoints)
    expect(result.applications).toMatchObject([
      { kind: 'CONDITION_APPLY', conditionId: STUNNED, targetActorId: TARGET_ID }
    ])
  })

  it('applies no condition to a target with 151 hit points, so the room creates no active effect', async () => {
    const { result } = await plannedEffect(151)
    expect(result.execution.evidence.trace.map(({ outputs }) => outputs.authorized)).toEqual([
      false
    ])
    expect(result.applications).toEqual([])
  })

  it('plans one minute of a Constitution save at the end of each of the target turns', async () => {
    expect(activeEffectPlan).toMatchObject({
      frozenGraphNodeId: 'repeat-save-test',
      recurrenceStage: 'END_OF_TURN',
      initialRemaining: 10,
      conditionContributions: [{ conditionId: STUNNED }],
      castFactKeys: ['dnd5e.save-dc']
    })
    const { recurringEffect } = await plannedEffect(150)
    expect(recurringEffect?.definition.adapterFacts).toMatchObject({ 'dnd5e.save-dc': SAVE_DC })
    expect(Object.values(recurringEffect?.definition.adapterFacts ?? {})).toContain(CONSTITUTION)
  })

  /** One end-of-turn tick of the stun, answered with `face` on the d20. */
  async function endOfTurnSave(face: number) {
    const { recurringEffect } = await plannedEffect(150)
    if (!recurringEffect) throw new Error('Power Word Stun planned no effect.')
    const lifecycle = { schemaVersion: 1 as const, remainingTicks: 10 }
    const input = {
      activeEffectId: testUuid(0xe206),
      activeEffectVersion: 1,
      definition: recurringEffect.definition,
      lifecycle,
      lifecycleChecksum: checksumRuleDocument(lifecycle),
      occurrenceId: testUuid(0xe207),
      targetActorId: TARGET_ID,
      currentHitPoints: 150,
      temporaryHitPoints: 0,
      maximumHitPoints: 150,
      targetScalarValues: {},
      targetConditionIds: [STUNNED],
      targetDerivedFacts: {
        savingThrowDefinitions: [
          { abilityDefinitionId: CONSTITUTION, modifier: 0, rollMode: 'NORMAL', contributors: [] }
        ]
      },
      defenses: [],
      runtime: createSrdRulesRuntime(),
      adapters: characterRuleActionSystemAdapterRegistry
    } as const
    const paused = await executeTargetBoundActiveRuleEffectWithPause(input)
    if (!('continuation' in paused)) throw new Error('The stun asks for the target save.')
    expect(paused.evidencePolicy).toMatchObject({ requestNodeId: 'repeat-save-d20', dc: SAVE_DC })
    return resumeTargetBoundActiveRuleEffectWithPause({
      ...input,
      continuation: paused.continuation,
      resolution: {
        requestId: paused.continuation.request.requestId,
        rawFaces: [face],
        rollMode: 'NORMAL',
        keep: 'FIRST',
        addedDice: []
      }
    })
  }

  it('ends the stun when the target succeeds on its end-of-turn save', async () => {
    const ended = await endOfTurnSave(20)
    expect(ended).toMatchObject({
      terminal: true,
      applications: [{ kind: 'CONDITION_REMOVE', conditionId: STUNNED }]
    })
  })

  it('keeps the stun, and the save, when the target fails it', async () => {
    const kept = await endOfTurnSave(1)
    expect(kept).toMatchObject({ terminal: false, applications: [] })
  })
})
