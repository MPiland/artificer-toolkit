import { powerWordStun } from '@artificer-toolkit/source-data/srd/spells/power-word-stun.js'
import { SRD_ABILITIES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { SpellAuthored } from '@artificer-toolkit/shared'

import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { prepareEncounterActionEffectPlans } from '../encounterActionEffectPlans.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { testUuid } from './dnd5eSrdEncounter.js'
import { compiledTestSpellCast } from './plannedTimedCondition.js'

const SOURCE_ID = testUuid(0xe301)
export const TARGET_ID = testUuid(0xe302)
export const CONSTITUTION = SRD_ABILITIES.find(({ code }) => code === 'CONSTITUTION')!.id
const SAVE_DC = 14

export type RepeatSaveAttempts = {
  successesToEnd: number
  failuresToResolve: number
  consecutive: boolean
}

/** A Power Word Stun whose repeated save counts to thresholds, the shape Flesh to Stone uses. */
function thresholdSpell(attempts: RepeatSaveAttempts): SpellAuthored {
  const [effect] = powerWordStun.effects ?? []
  const [path] = effect!.paths
  if (!path || !('resultBlock' in path)) throw new Error('Expected a result-block path.')
  const block = path.resultBlock
  if (block.resultKind !== 'SEQUENCE') throw new Error('Expected a sequence result block.')
  return {
    ...powerWordStun,
    effects: [
      {
        ...effect!,
        paths: [
          {
            ...path,
            resultBlock: {
              ...block,
              outcomes: block.outcomes.map((outcome) =>
                outcome.effectKind === 'FOLLOW_UP_SAVE'
                  ? { ...outcome, attempts: { kind: 'THRESHOLDS' as const, ...attempts } }
                  : outcome
              )
            }
          }
        ]
      }
    ]
  }
}

function compiled(attempts: RepeatSaveAttempts) {
  const spell = thresholdSpell(attempts)
  const { entry } = compiledTestSpellCast({
    spell,
    cast: {
      sequence: 0,
      candidateId: `CLASS:class-${spell.id}:${spell.id}:level:8`,
      spellId: spell.id,
      source: { spellId: spell.id, sourceKind: 'CLASS', sourceInstanceId: `class-${spell.id}` },
      spellLevel: 8,
      castMode: 'SPELL_SLOT',
      castLevel: 8,
      baseEntry: true,
      resourceOwnerKey: null,
      slotPoolCode: null
    },
    decision: { status: 'AVAILABLE', reasonCode: 'SPELL_SLOT_REMAINING', slotKey: 'STANDARD:8' }
  })
  return entry.compilation
}

/** The active-effect definition a cast of the threshold spell plans for `targetActorId`. */
export async function plannedThresholdDefinition(
  attempts: RepeatSaveAttempts,
  targetActorId = TARGET_ID
) {
  const { executionPlan, activeEffectPlan } = compiled(attempts)
  if (executionPlan.kind !== 'SINGLE_GRAPH') throw new Error('Expected one graph.')
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
    occurrenceId: testUuid(0xe303),
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
      targetActorId,
      targetDerivedFacts: { statBlock: { armorClass: 12 }, savingThrowDefinitions: [] },
      targetConditionIds: [],
      currentHitPoints: 100,
      temporaryHitPoints: 0,
      maximumHitPoints: 100,
      targetScalarValues: {},
      defenses: []
    },
    afterTest: async () => undefined
  })
  const planned = prepareEncounterActionEffectPlans({
    encounterId: testUuid(0xe304),
    occurrenceId: testUuid(0xe303),
    commandId: testUuid(0xe305),
    sourceActorId: SOURCE_ID,
    sourceLabel: powerWordStun.label,
    sourceHidden: false,
    currentActorId: null,
    target: {
      actorId: targetActorId,
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
  if (!planned.recurringEffect) throw new Error('The cast planned no repeating effect.')
  return planned.recurringEffect.definition
}
