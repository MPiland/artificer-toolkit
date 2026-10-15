import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  buildCompiledActionCompilerSource,
  buildCompiledActionTargetPolicy
} from '../encounterActionEntryPointCompiler.js'
import { encounterActionChoiceTarget, encounterActionTargetKind } from '../encounterAreaAction.js'
import { discoverEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'

const feet = (amount: number) => ({ amount, unit: 'FEET' as const })
const cone = (length: number) => ({ kind: 'DIRECTED', area: { kind: 'CONE', length: feet(length) } })
const line = (length: number, width: number) => ({
  kind: 'DIRECTED',
  area: { kind: 'LINE', length: feet(length), width: feet(width) }
})

/**
 * The areas an SRD breath description prints, in order: "a 60-foot cone", "an 60-foot line that is
 * 5 feet wide", "a line of lightning that is 20 feet long and 5 feet wide".
 */
const PRINTED_AREA =
  /(\d+)-foot (cone|line)(?: that is (\d+) feet wide)?|line of \w+ that is (\d+) feet long and (\d+) feet wide/g

function printedAreas(description: string) {
  return [...description.matchAll(PRINTED_AREA)].map(
    ([, length, shape, width, longLength, longWidth]) => {
      if (longLength && longWidth) return line(Number(longLength), Number(longWidth))
      return shape === 'cone' ? cone(Number(length)) : line(Number(length), Number(width))
    }
  )
}

/** A breath weapon is the Feature whose description says the creature exhales. */
const BREATH_DESCRIPTION = /\bexhales?\b/i

const conditionDefinitionIds = srdSystemRecord.conditionTypes.map(({ id }) => id)
const abilityDefinitions = (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))

/** Every action Effect of every SRD breath weapon, with the area its description prints. */
const breathRows = srdBaselineContent.subjects.creatures.flatMap((creature, creatureIndex) => {
  const discovery = discoverEncounterFeatureActions({
    actor: srdCreatureActor({ id: testUuid(0x1000 + creatureIndex), creature }),
    conditionDefinitionIds,
    abilityDefinitions
  })
  return (creature.features ?? [])
    .filter((feature) => BREATH_DESCRIPTION.test(feature.description ?? ''))
    .flatMap((feature) => {
      const printed = printedAreas(feature.description ?? '')
      const effects = (feature.effects ?? []).filter(({ invocation }) => invocation.kind === 'ACTION')
      return effects.map((effect, index) => ({
        name: `${creature.label} ${feature.label} #${index + 1}`,
        creatureLabel: creature.label,
        featureLabel: feature.label,
        printedAreaCount: printed.length,
        effectCount: effects.length,
        printed: printed[index],
        leavesLastingEffect: [...JSON.stringify(effect.paths).matchAll(/"effectKind":"(\w+)"/g)].some(
          ([, effectKind]) => effectKind !== 'DAMAGE'
        ),
        capability: discovery.available.find(
          (candidate) => candidate.ownerFeatureId === feature.id && candidate.effectId === effect.id
        ),
        unavailable: discovery.unavailable.find(
          (candidate) => candidate.ownerFeatureId === feature.id
        )
      }))
    })
})

describe('SRD breath weapons breathe areas', () => {
  it('finds every breath weapon of the corpus', () => {
    // Four ages of dragon: five chromatic with one breath and five metallic with two (60 Effects),
    // plus the Behir, Chimera, Dragon Turtle, four mephits, Gorgon, Half-Red Dragon Veteran, Hell
    // Hound, Iron Golem and Winter Wolf (12).
    expect(breathRows).toHaveLength(72)
  })

  it.each(breathRows)('$name prints one area per Effect', (row) => {
    expect(row.printedAreaCount).toBe(row.effectCount)
  })

  it.each(breathRows.filter(({ creatureLabel }) => creatureLabel !== 'Gorgon'))(
    '$name compiles to a directed area of its printed size',
    (row) => {
      if (!row.capability) throw new Error(`${row.name} is unavailable: ${row.unavailable?.reason}`)
      const policy = buildCompiledActionTargetPolicy(row.capability)
      expect(policy.range.rangeKind).toBe('SELF')
      expect(encounterActionTargetKind(policy)).toBe('DIRECTED')
      expect(encounterActionChoiceTarget(policy)).toEqual(row.printed)
    }
  )

  // A breath that leaves more than damage (a condition, a push, slowed or weakened targets) keeps its
  // area but stays refused: the Worker journey proves the refusal, so only the damage-only breaths
  // are asked for an executable plan here.
  it.each(breathRows.filter(({ leavesLastingEffect }) => !leavesLastingEffect))(
    '$name compiles to an executable test outcome',
    (row) => {
      if (!row.capability) throw new Error(`${row.name} is unavailable: ${row.unavailable?.reason}`)
      expect(
        dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
          action: row.capability,
          compilerSource: buildCompiledActionCompilerSource(row.capability)
        })?.kind
      ).toBe('TEST_OUTCOME')
    }
  )

  // An area drops a bare condition outcome silently instead of refusing it, so the Gorgon's breath
  // stays unshaped (and refused) until SPELLS-19 handles it.
  it('keeps the Gorgon’s Petrifying Breath unshaped', () => {
    const row = breathRows.find(({ creatureLabel }) => creatureLabel === 'Gorgon')
    if (!row?.capability) throw new Error('The Gorgon’s breath is not an available action.')
    expect(encounterActionTargetKind(buildCompiledActionTargetPolicy(row.capability))).not.toBe(
      'DIRECTED'
    )
  })

  it('finds the breaths that leave more than damage: the metallic second breaths, the Gorgon and the Dust Mephit', () => {
    expect(breathRows.filter(({ leavesLastingEffect }) => leavesLastingEffect)).toHaveLength(22)
  })

  // The sizes below are read from the SRD stat blocks, not from the authored rows or the parser.
  it.each([
    ['Black Dragon Wyrmling', 'Acid Breath', line(15, 5)],
    ['Red Dragon Wyrmling', 'Fire Breath', cone(15)],
    ['Ancient Red Dragon', 'Fire Breath', cone(90)],
    ['Ancient Blue Dragon', 'Lightning Breath', line(120, 10)],
    ['Behir', 'Lightning Breath', line(20, 5)],
    ['Winter Wolf', 'Cold Breath', cone(15)],
    ['Dragon Turtle', 'Steam Breath', cone(60)]
  ])('%s %s is the printed area', (creature, breath, target) => {
    const row = breathRows.find(
      ({ creatureLabel, featureLabel }) =>
        creatureLabel === creature && featureLabel.startsWith(breath)
    )
    if (!row?.capability) throw new Error(`${creature} ${breath} is not an available action.`)
    expect(encounterActionChoiceTarget(buildCompiledActionTargetPolicy(row.capability))).toEqual(
      target
    )
  })
})
