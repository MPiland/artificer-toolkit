import { describe, expect, it } from 'vitest'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'

/**
 * RULES-2.T6h: an action accepts several direct results in authored order. The spell here is
 * Longstrider's grant authored after an END_EFFECTS outcome, as a SEQUENCE result block.
 */

const conditionDefinitionIds = srdSystemRecord.conditionTypes.map(({ id }) => id)
const poisoned = srdSystemRecord.conditionTypes.find(({ code }) => code === 'POISONED')!.id

const longstrider = srdBaselineContent.subjects.spells.find(({ label }) => label === 'Longstrider')
  ?.effects?.[0]
if (!longstrider) throw new Error('SRD spell Longstrider is missing.')

/** END_EFFECTS then Longstrider's grant, which lasts an hour (the block's one duration). */
function endThenGrant() {
  const path = longstrider!.paths[0]
  if (path?.selectionKind !== 'FIXED') throw new Error('Longstrider authors a fixed path.')
  const { duration, ...block } = path.resultBlock
  return {
    ...longstrider!,
    paths: [
      {
        ...path,
        groupType: 'SEQUENTIAL' as const,
        resultBlock: {
          ...block,
          ...(duration ? { duration } : {}),
          resultKind: 'SEQUENCE' as const,
          outcomes: [
            {
              id: testUuid(0x2301),
              effectKind: 'END_EFFECTS' as const,
              scope: 'ONE_CHOSEN' as const,
              conditionIds: [poisoned]
            },
            ...block.outcomes
          ]
        }
      }
    ]
  }
}

function compile(effect: ReturnType<typeof endThenGrant>) {
  const action = {
    ...characterActionDescriptor(compileEffect({ ...effect, id: ACTION_EFFECT_ID }), 1, 5),
    conditionDefinitionIds
  }
  const adapter = dnd5eCharacterRuleActionSystemAdapter
  const plan = adapter.compileExecutionPlan?.({
    action,
    compilerSource: buildCompiledActionCompilerSource(action)
  })
  if (plan?.kind !== 'SINGLE_GRAPH') throw new Error('Expected a single graph.')
  const activeEffectPlans = adapter.activeEffectPlans?.({ action, published: plan.published })
  return { plan, activeEffectPlans }
}

describe('an action with several direct results (RULES-2.T6h)', () => {
  it('compiles END_EFFECTS then a timed APPLY_GRANT in authored order', () => {
    const { plan, activeEffectPlans } = compile(endThenGrant())
    expect(plan.published.definition.nodes.map(({ operation }) => operation.key)).toEqual([
      'dnd5e.end-effects-proposal',
      'dnd5e.modifier-grant-proposal'
    ])
    // The grant keeps its own plan; the instant END_EFFECTS result adds none.
    expect(activeEffectPlans).toHaveLength(1)
    expect(activeEffectPlans?.[0]?.modifierGrantContribution).toBeDefined()
  })

  it('refuses two results that would share an output', () => {
    const effect = endThenGrant()
    const path = effect.paths[0]!
    const [ending, grant] = path.resultBlock.outcomes
    expect(() =>
      compile({
        ...effect,
        paths: [
          {
            ...path,
            resultBlock: {
              ...path.resultBlock,
              outcomes: [ending!, { ...ending!, id: testUuid(0x2302) }, grant!]
            }
          }
        ]
      })
    ).toThrow(/cannot share a cast/)
  })
})
