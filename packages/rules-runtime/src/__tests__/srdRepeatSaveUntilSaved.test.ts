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
 * end of each of the holder's turns ends, lasts until that save ends it. A repeated save whose full
 * duration petrifies stays refused (a failure that deals damage is QUALITY-15.T3z's).
 */

const POISONED = srdCondition('Poisoned')
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
  return () =>
    dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
      action,
      compilerSource: buildCompiledActionCompilerSource(action)
    })
}

describe('repeated saves that need room behavior the repeat-save effect does not have stay refused', () => {
  it('Flesh to Stone’s petrification when its full duration completes is not applied by the repeat-save effect', () => {
    expect(compileSpell('Flesh to Stone')).toThrow(
      'D&D test action has an unsupported bounded shape.'
    )
  })
})
