import { DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY } from '@artificer-toolkit/schema/systems/dnd5e/schemaExtension'
import { describe, expect, it } from 'vitest'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import { compileSpellEffect } from '@artificer-toolkit/shared/compilers'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { prepareNativeActionEffectsPlan } from '../encounterActionEffects.js'
import {
  buildCompiledActionCompilerSource,
  compileEncounterFeatureActionPlan
} from '../encounterActionEntryPointCompiler.js'
import { readEncounterActorConditionState } from '../encounterCharacterMechanicsBatch.js'
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
import { prepareCreatureAction, settleCreatureAction } from './encounterCreatureAction.js'

/**
 * QUALITY-15.T3l: a failed save's repeated save is held by its repeat-save effect while the same
 * failure's other results are proposed once, whether they sit beside it (a GM ruling in its block)
 * or in a block of their own (damage); and a Self-plus-willing-creatures move targets chosen
 * creatures.
 */

const FRIGHTENED = srdCondition('Frightened')
const DEAFENED = srdCondition('Deafened')
const PARALYZED = srdCondition('Paralyzed')
const BLINDED = srdCondition('Blinded')
const conditionDefinitionIds = srdSystemRecord.conditionTypes.map(({ id }) => id)
const abilityDefinitions = (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))

type Compiled = ReturnType<typeof compileEncounterFeatureActionPlan>

/** The active-effect plans an action's first graph carries. */
function activeEffectPlans(
  action: Parameters<typeof compileEncounterFeatureActionPlan>[1],
  plan: Compiled
) {
  return (
    dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({
      action,
      published: plan.kind === 'SINGLE_GRAPH' ? plan.published : plan.test.published
    }) ?? []
  )
}

/** The Creature action the room offers for `effectIndex` of the feature, and its compiled plans. */
function creatureAction(creatureLabel: string, featureLabel: string, effectIndex = 0) {
  const creature = srdByLabel(SRD.creatures, creatureLabel)
  const feature = creatureFeature(creature, featureLabel)
  const effect = feature.effects?.[effectIndex]
  if (!effect) throw new Error(`${creatureLabel} ${featureLabel} has no Effect ${effectIndex}.`)
  const discovered = discoverUncompiledEncounterFeatureActions({
    spells: new Map(),
    actor: srdCreatureActor({ id: testUuid(0x7300), creature }),
    conditionDefinitionIds,
    abilityDefinitions
  })
  const capability = discovered.available.find((candidate) => candidate.effectId === effect.id)
  if (!capability)
    throw new Error(
      `${creatureLabel} ${featureLabel} is not offered: ${JSON.stringify(discovered.unavailable)}`
    )
  const plan = compileEncounterFeatureActionPlan(dnd5eCharacterRuleActionSystemAdapter, capability)
  return { effect, capability, plan, plans: activeEffectPlans(capability, plan) }
}

/** The result block whose follow-up save repeats, which the repeat-save effect holds. */
function repeatBlockId(effect: EffectAuthored) {
  const block = effect.paths
    .flatMap((path) => ('resultBlock' in path ? [path.resultBlock] : []))
    .find(({ outcomes }) => outcomes.some(({ effectKind }) => effectKind === 'FOLLOW_UP_SAVE'))
  if (!block) throw new Error('The Effect has no repeated save.')
  return block.id
}

describe('a repeated save held beside a GM ruling in its own result block', () => {
  it.each([
    { creature: 'Ghost', feature: 'Horrifying Visage', effectIndex: 0, held: [FRIGHTENED] },
    { creature: 'Androsphinx', feature: 'Roar (3/Day)', effectIndex: 0, held: [FRIGHTENED] },
    {
      creature: 'Androsphinx',
      feature: 'Roar (3/Day)',
      effectIndex: 1,
      held: [DEAFENED, FRIGHTENED, PARALYZED]
    }
  ])(
    '$creature’s $feature (Effect $effectIndex) holds its conditions in one repeat-save effect for 1 minute',
    ({ creature, feature, effectIndex, held }) => {
      const { effect, plan, plans } = creatureAction(creature, feature, effectIndex)
      expect(plan.kind).toBe('TEST_OUTCOME')
      if (plan.kind !== 'TEST_OUTCOME') return
      expect(plan.outcomes.map(({ pathCode }) => pathCode)).toContain('ON_SAVE_FAIL')
      const repeat = plans.find(({ frozenGraphNodeId }) => frozenGraphNodeId === 'repeat-save-test')
      expect(repeat).toMatchObject({
        compiledEntryId: repeatBlockId(effect),
        recurrenceStage: 'END_OF_TURN',
        // "for 1 minute" is ten rounds.
        initialRemaining: 10
      })
      expect(repeat?.conditionContributions?.map(({ conditionId }) => conditionId)).toEqual(held)
    }
  )

  it('frightens the Ogre that fails the Ghost’s Horrifying Visage, proposes the aging ruling once, and holds the fear in a repeat-save effect', async () => {
    const ghost = srdByLabel(SRD.creatures, 'Ghost')
    const visage = creatureFeature(ghost, 'Horrifying Visage')
    const prepared = await prepareCreatureAction({
      actor: srdCreatureActor({ id: testUuid(0x7301), creature: ghost }),
      target: srdCreatureActor({
        id: testUuid(0x7302),
        creature: srdByLabel(SRD.creatures, 'Ogre')
      }),
      featureId: visage.id,
      overridable: true
    })
    // A 1 on the d20 fails the DC 13 Wisdom save.
    const { execution, mechanics } = await settleCreatureAction({ prepared, rolls: [0] })
    expect(execution.d20).toMatchObject({ resultPath: 'ON_SAVE_FAIL' })
    const target = mechanics.targetPlan.updatedActor
    if (target.kind === 'CHARACTER') throw new Error('Expected the Ogre target.')
    expect(readEncounterActorConditionState(target.conditions).ids).toEqual([FRIGHTENED])
    expect(
      execution.execution.evidence.trace.filter(
        ({ operation }) => operation.key === DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY
      )
    ).toHaveLength(1)
    const effects = prepareNativeActionEffectsPlan({
      prepared,
      execution,
      occurrenceId: testUuid(0x7303),
      commandId: testUuid(0x7304),
      activeEffectsByActorId: new Map()
    })
    expect(effects.recurringEffect).not.toBeNull()
  })
})

/**
 * The SRD spell's one Effect, cast as a 20th-level Character's action at the spell's level. The
 * Effect is compiled under the descriptor's fixed id, as the golden compiles it.
 */
function spellCast(label: string) {
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
  return {
    effect,
    action,
    compile: () =>
      dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
        action,
        compilerSource: buildCompiledActionCompilerSource(action)
      })
  }
}

describe('a repeated save beside a failed save’s result in another block', () => {
  it('Sunburst holds its blindness in a repeat-save effect beside its failed save’s radiant damage', () => {
    const { effect, action, compile } = spellCast('Sunburst')
    const plan = compile()
    expect(plan?.kind).toBe('TEST_OUTCOME')
    if (plan?.kind !== 'TEST_OUTCOME') return
    expect(plan.outcomes.map(({ pathCode }) => pathCode).sort()).toEqual([
      'ON_SAVE_FAIL',
      'ON_SAVE_SUCCESS'
    ])
    const plans =
      dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({
        action,
        published: plan.test.published
      }) ?? []
    expect(plans).toHaveLength(1)
    expect(plans[0]).toMatchObject({
      compiledEntryId: repeatBlockId(effect),
      frozenGraphNodeId: 'repeat-save-test',
      recurrenceStage: 'END_OF_TURN',
      initialRemaining: 10,
      conditionContributions: [{ conditionId: BLINDED }]
    })
  })
})

describe('a move of its user and willing creatures within reach', () => {
  it.each([
    { creature: 'Nightmare', feature: 'Ethereal Stride' },
    { creature: 'Unicorn', feature: 'Teleport (1/Day)' }
  ])(
    '$creature’s $feature chooses itself and up to three creatures within 5 feet',
    ({ creature, feature }) => {
      const { capability } = creatureAction(creature, feature)
      expect(capability.compiledEffect.invocation).toMatchObject({
        targeting: { selectionKind: 'CHOSEN_CREATURES', maxTargets: 4 },
        range: { rangeKind: 'DISTANCE', amount: 5 }
      })
    }
  )
})
