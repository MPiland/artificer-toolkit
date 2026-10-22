import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { prepareNativeActionEffectsPlan } from '../encounterActionEffects.js'
import { compileEncounterFeatureActionPlan } from '../encounterActionEntryPointCompiler.js'
import { readEncounterActorConditionState } from '../encounterCharacterMechanicsBatch.js'
import { discoverUncompiledEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscovery.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import {
  creatureFeature,
  srdCondition,
  srdCreatureActor,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { prepareCreatureAction, settleCreatureAction } from './encounterCreatureAction.js'

/**
 * SPELLS-33.T7a (D156): the SRD creatures whose save grants immunity to their source's use of the
 * action for 24 hours, authored with SOURCE_IMMUNITY in place of their closed rules. SPELLS-33.T7b
 * adds the Mummies' Dreadful Glare, whose failure margin also paralyzes.
 */

const FRIGHTENED = srdCondition('Frightened')
const PARALYZED = srdCondition('Paralyzed')
// The Ogre's Wisdom of 7, which no save proficiency changes.
const OGRE_WISDOM_MODIFIER = -2
const conditionDefinitionIds = srdSystemRecord.conditionTypes.map(({ id }) => id)
const abilityDefinitions = (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))

const SAVE_IMMUNITIES = [
  { creature: 'Cloaker', feature: 'Moan' },
  { creature: 'Nalfeshnee', feature: 'Horror Nimbus (Recharge 5-6)' },
  ...srdBaselineContent.subjects.creatures
    .filter(({ features }) => features?.some(({ label }) => label === 'Frightful Presence'))
    .map(({ label }) => ({ creature: label, feature: 'Frightful Presence' }))
]

/** The Creature action the room offers, and the active-effect plan it compiles to. */
function compiledAction(creatureLabel: string, featureLabel: string) {
  const creature = srdByLabel(SRD.creatures, creatureLabel)
  const feature = creatureFeature(creature, featureLabel)
  const actor = srdCreatureActor({ id: testUuid(0x5300), creature })
  const discovered = discoverUncompiledEncounterFeatureActions({
    spells: new Map(),
    actor,
    conditionDefinitionIds,
    abilityDefinitions
  })
  const capability = discovered.available.find(
    (candidate) => candidate.ownerFeatureId === feature.id
  )
  if (!capability)
    throw new Error(
      `${creatureLabel} ${featureLabel} is not offered: ${JSON.stringify(discovered.unavailable)}`
    )
  const executionPlan = compileEncounterFeatureActionPlan(
    dnd5eCharacterRuleActionSystemAdapter,
    capability
  )
  const plans =
    dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({
      action: capability,
      published:
        executionPlan.kind === 'SINGLE_GRAPH'
          ? executionPlan.published
          : executionPlan.test.published
    }) ?? []
  return { effectId: feature.effects?.[0]?.id, plans }
}

describe('SRD creature save immunities (SPELLS-33.T7a, D156)', () => {
  it('covers the 20 adult and ancient dragons and the Tarrasque', () => {
    expect(SAVE_IMMUNITIES.filter(({ creature }) => creature.endsWith(' Dragon'))).toHaveLength(20)
    expect(SAVE_IMMUNITIES.map(({ creature }) => creature)).toContain('Tarrasque')
  })

  it.each(SAVE_IMMUNITIES)(
    '$creature’s $feature frightens on a failure and makes a success immune to it for 24 hours',
    ({ creature, feature }) => {
      const { effectId, plans } = compiledAction(creature, feature)
      expect(plans).toHaveLength(1)
      expect(plans[0]).toMatchObject({
        conditionContributions: [{ conditionId: FRIGHTENED }],
        // 24 hours of 6-second rounds.
        sourceImmunity: {
          appliesTo: 'SAVE_SUCCESS',
          immuneToId: effectId,
          initialRemaining: 14_400
        }
      })
    }
  )

  it('frightens the Ogre that fails the Adult White Dragon’s Frightful Presence and makes the one that succeeds immune', async () => {
    const dragon = srdByLabel(SRD.creatures, 'Adult White Dragon')
    const presence = creatureFeature(dragon, 'Frightful Presence')
    const settle = async (face: number) => {
      const prepared = await prepareCreatureAction({
        actor: srdCreatureActor({ id: testUuid(0x5301), creature: dragon }),
        target: srdCreatureActor({
          id: testUuid(0x5302),
          creature: srdByLabel(SRD.creatures, 'Ogre')
        }),
        featureId: presence.id,
        overridable: true
      })
      const { execution, mechanics } = await settleCreatureAction({ prepared, rolls: [face] })
      const target = mechanics.targetPlan.updatedActor
      if (target.kind === 'CHARACTER') throw new Error('Expected the Ogre target.')
      return {
        d20: execution.d20,
        conditionIds: readEncounterActorConditionState(target.conditions).ids,
        effects: prepareNativeActionEffectsPlan({
          prepared,
          execution,
          occurrenceId: testUuid(0x5303),
          commandId: testUuid(0x5304),
          activeEffectsByActorId: new Map()
        })
      }
    }
    const failed = await settle(0)
    expect(failed.conditionIds).toEqual([FRIGHTENED])
    expect(failed.effects.riderEffects.filter(Boolean)).toEqual([])
    const saved = await settle(19)
    expect(saved.d20).toMatchObject({ resultPath: 'ON_SAVE_SUCCESS' })
    expect(saved.conditionIds).toEqual([])
    expect(saved.effects.riderEffects[0]?.definition).toMatchObject({
      recurrence: { expiration: { initialRemaining: 14_400 } },
      stateContributions: [
        {
          kind: 'SOURCE_IMMUNITY',
          immuneToId: presence.effects?.[0]?.id,
          sourceLabel: 'Frightful Presence'
        }
      ]
    })
  })
})

describe('SRD Mummies’ Dreadful Glare (SPELLS-33.T7b, D156)', () => {
  const GLARES = [
    { creature: 'Mummy', dc: 11 },
    { creature: 'Mummy Lord', dc: 16 }
  ]

  it.each(GLARES)(
    '$creature’s Dreadful Glare frightens through its next turn, paralyzes a failure by 5 or more, and makes a success immune',
    ({ creature }) => {
      const { effectId, plans } = compiledAction(creature, 'Dreadful Glare')
      expect(plans).toHaveLength(1)
      expect(plans[0]).toMatchObject({
        recurrenceStage: 'END_OF_TURN',
        tickAnchor: 'SOURCE',
        conditionContributions: [{ conditionId: FRIGHTENED }],
        marginRiders: [{ failedBy: 5, conditionContributions: [{ conditionId: PARALYZED }] }],
        sourceImmunity: {
          appliesTo: 'SAVE_SUCCESS',
          immuneToId: effectId,
          initialRemaining: 14_400
        }
      })
    }
  )

  it.each(GLARES)(
    'frightens the Ogre that fails $creature’s glare by less than 5, adds paralysis from 5, and spares one that succeeds',
    async ({ creature, dc }) => {
      const mummy = srdByLabel(SRD.creatures, creature)
      const glare = creatureFeature(mummy, 'Dreadful Glare')
      // The zero-based roll that gives the Ogre a save total of `total`.
      const rollFor = (total: number) => total - OGRE_WISDOM_MODIFIER - 1
      const settle = async (total: number) => {
        const prepared = await prepareCreatureAction({
          actor: srdCreatureActor({ id: testUuid(0x5310), creature: mummy }),
          target: srdCreatureActor({
            id: testUuid(0x5311),
            creature: srdByLabel(SRD.creatures, 'Ogre')
          }),
          featureId: glare.id,
          overridable: true
        })
        const { execution, mechanics } = await settleCreatureAction({
          prepared,
          rolls: [rollFor(total)]
        })
        const target = mechanics.targetPlan.updatedActor
        if (target.kind === 'CHARACTER') throw new Error('Expected the Ogre target.')
        return {
          d20: execution.d20,
          conditionIds: [...readEncounterActorConditionState(target.conditions).ids].sort(),
          effects: prepareNativeActionEffectsPlan({
            prepared,
            execution,
            occurrenceId: testUuid(0x5312),
            commandId: testUuid(0x5313),
            activeEffectsByActorId: new Map()
          })
        }
      }
      const narrow = await settle(dc - 4)
      expect(narrow.conditionIds).toEqual([FRIGHTENED])
      expect(narrow.effects.riderEffects.filter(Boolean)).toEqual([])
      const margin = await settle(dc - 5)
      expect(margin.conditionIds).toEqual([FRIGHTENED, PARALYZED].sort())
      expect(margin.effects.riderEffects[0]?.definition).toMatchObject({
        stateContributions: [{ kind: 'CONDITION_OWNERSHIP', conditionId: PARALYZED }]
      })
      const saved = await settle(dc)
      expect(saved.d20).toMatchObject({ resultPath: 'ON_SAVE_SUCCESS' })
      expect(saved.conditionIds).toEqual([])
      expect(saved.effects.riderEffects[0]?.definition).toMatchObject({
        recurrence: { expiration: { initialRemaining: 14_400 } },
        stateContributions: [
          {
            kind: 'SOURCE_IMMUNITY',
            immuneToId: glare.effects?.[0]?.id,
            sourceLabel: 'Dreadful Glare'
          }
        ]
      })
    }
  )
})
