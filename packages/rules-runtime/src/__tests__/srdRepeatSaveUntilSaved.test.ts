import { MAX_ACTIVE_EFFECT_TURNS } from '@artificer-toolkit/schema/shared/activeRuleEffectLifecycle'
import { describe, expect, it } from 'vitest'
import { compileSpellEffect } from '@artificer-toolkit/shared/compilers'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  buildCompiledActionCompilerSource,
  compileEncounterFeatureActionPlan
} from '../encounterActionEntryPointCompiler.js'
import { discoverUncompiledEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscovery.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  DND5E_ACTIVE_EFFECT_DURATION_COMPLETE_CONDITION_FACT_KEY,
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ESCALATION_CONDITION_FACT_KEY,
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ESCALATION_HELD_FACT_KEY
} from '../systems/dnd5e/effectActionContracts.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import {
  creatureFeature,
  srdCondition,
  srdCreatureActor,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'

/**
 * QUALITY-15.T3r: a failed save's condition with no duration of its own, which a repeated save at the
 * end of each of the holder's turns ends, lasts until that save ends it (a failure that deals damage
 * is QUALITY-15.T3z's). QUALITY-15.T3ad: a timed condition whose counted failures add a condition it
 * holds, and whose full duration leaves that condition, compiles too.
 */

const POISONED = srdCondition('Poisoned')
const RESTRAINED = srdCondition('Restrained')
const PETRIFIED = srdCondition('Petrified')
const conditionDefinitionIds = srdSystemRecord.conditionTypes.map(({ id }) => id)
const abilityDefinitions = (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))

describe('a failed save’s condition held until its repeated save ends it', () => {
  it('Vrock Spores poisons until a repeated Constitution save ends it, and proposes the spore damage ruling once', () => {
    const creature = srdByLabel(SRD.creatures, 'Vrock')
    const feature = creatureFeature(creature, 'Spores (Recharge 6)')
    const [effect] = feature.effects ?? []
    if (!effect) throw new Error('Vrock Spores has no Effect.')
    const discovered = discoverUncompiledEncounterFeatureActions({
      spells: new Map(),
      actor: srdCreatureActor({ id: testUuid(0x7310), creature }),
      conditionDefinitionIds,
      abilityDefinitions
    })
    const capability = discovered.available.find((candidate) => candidate.effectId === effect.id)
    if (!capability)
      throw new Error(`Vrock Spores is not offered: ${JSON.stringify(discovered.unavailable)}`)
    const plan = compileEncounterFeatureActionPlan(
      dnd5eCharacterRuleActionSystemAdapter,
      capability
    )
    expect(plan.kind).toBe('TEST_OUTCOME')
    if (plan.kind !== 'TEST_OUTCOME') return
    expect(plan.outcomes.map(({ pathCode }) => pathCode)).toEqual(['ON_SAVE_FAIL'])
    const plans =
      dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({
        action: capability,
        published: plan.test.published
      }) ?? []
    const block = effect.paths.flatMap((path) => ('resultBlock' in path ? [path.resultBlock] : []))
    expect(plans).toHaveLength(1)
    expect(plans[0]).toMatchObject({
      compiledEntryId: block[0]?.id,
      frozenGraphNodeId: 'repeat-save-test',
      recurrenceStage: 'END_OF_TURN',
      // No duration of its own: it lasts until the save ends it, at most the longest active effect.
      initialRemaining: MAX_ACTIVE_EFFECT_TURNS,
      conditionContributions: [{ conditionId: POISONED }]
    })
  })
})

/** The SRD spell's one Effect, cast as a 20th-level Character's action at the spell's level. */
function compileSpell(label: string) {
  const spell = srdByLabel(SRD.spells, label)
  const [effect] = spell.effects ?? []
  if (!effect) throw new Error(`${label} has no Effect.`)
  const action = {
    ...characterActionDescriptor(
      compileSpellEffect(
        { attributes: spell.attributes ?? [], effects: [effect] },
        { ...effect, id: ACTION_EFFECT_ID }
      ),
      spell.level,
      20
    ),
    conditionDefinitionIds
  }
  const plan = dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
    action,
    compilerSource: buildCompiledActionCompilerSource(action)
  })
  return { action, plan }
}

describe('a timed condition whose counted failures escalate and whose full duration leaves a condition', () => {
  it('Flesh to Stone restrains for its minute, holds petrified at three failures, and leaves it at the minute’s end', () => {
    const { action, plan } = compileSpell('Flesh to Stone')
    expect(plan?.kind).toBe('TEST_OUTCOME')
    if (plan?.kind !== 'TEST_OUTCOME') return
    const plans =
      dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({
        action,
        published: plan.test.published
      }) ?? []
    expect(plans).toHaveLength(1)
    expect(plans[0]).toMatchObject({
      frozenGraphNodeId: 'repeat-save-test',
      recurrenceStage: 'END_OF_TURN',
      initialRemaining: 10,
      saveThresholds: { successesToEnd: 3, failuresToResolve: 3, consecutive: false },
      conditionContributions: [{ conditionId: RESTRAINED }, { conditionId: PETRIFIED }],
      adapterFacts: {
        [DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ESCALATION_CONDITION_FACT_KEY]: PETRIFIED,
        [DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ESCALATION_HELD_FACT_KEY]: true,
        [DND5E_ACTIVE_EFFECT_DURATION_COMPLETE_CONDITION_FACT_KEY]: PETRIFIED
      }
    })
  })
})
