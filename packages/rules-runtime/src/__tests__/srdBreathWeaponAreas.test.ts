import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { CharacterRuleActionUnsupportedCompilationError } from '../characterRuleActionSystemAdapter.js'
import {
  buildCompiledActionCompilerSource,
  buildCompiledActionTargetPolicy,
  compileEncounterFeatureActionPlan
} from '../encounterActionEntryPointCompiler.js'
import { encounterActionChoiceTarget, encounterActionTargetKind } from '../encounterAreaAction.js'
import { discoverUncompiledEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscovery.js'
import { discoverEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'

const feet = (amount: number) => ({ amount, unit: 'FEET' as const })
const cone = (length: number) => ({
  kind: 'DIRECTED',
  area: { kind: 'CONE', length: feet(length) }
})
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

/** Every action of a Creature before its System compiles the plan it runs. */

/** Why the System cannot execute the action, or null when it can; any other compile failure is a real error. */
function compileRefusal(capability: Parameters<typeof compileEncounterFeatureActionPlan>[1]) {
  try {
    compileEncounterFeatureActionPlan(dnd5eCharacterRuleActionSystemAdapter, capability)
    return null
  } catch (error) {
    if (error instanceof CharacterRuleActionUnsupportedCompilationError) return error.message
    throw error
  }
}

/** Every action Effect of every SRD breath weapon, with the area its description prints. */
const breathRows = srdBaselineContent.subjects.creatures.flatMap((creature, creatureIndex) => {
  const input = {
    actor: srdCreatureActor({ id: testUuid(0x1000 + creatureIndex), creature }),
    conditionDefinitionIds,
    abilityDefinitions,
    spells: new Map()
  }
  const discovery = discoverUncompiledEncounterFeatureActions(input)
  const offered = discoverEncounterFeatureActions(input)
  return creature.features
    .filter((feature) => BREATH_DESCRIPTION.test(feature.description ?? ''))
    .flatMap((feature) => {
      const printed = printedAreas(feature.description ?? '')
      const effects = (feature.effects ?? []).filter(
        ({ invocation }) => invocation.kind === 'ACTION'
      )
      return effects.map((effect, index) => {
        const capability = discovery.available.find(
          (candidate) => candidate.ownerFeatureId === feature.id && candidate.effectId === effect.id
        )
        if (!capability) throw new Error(`${creature.label} ${feature.label} is not an action.`)
        const refusal = compileRefusal(capability)
        return {
          name: `${creature.label} ${feature.label} #${index + 1}`,
          creatureLabel: creature.label,
          featureLabel: feature.label,
          effectId: effect.id,
          printedAreaCount: printed.length,
          effectCount: effects.length,
          printed: printed[index],
          leavesLastingEffect: effect.paths.some((path) =>
            'resultBlock' in path
              ? path.resultBlock.outcomes.some(({ effectKind }) => effectKind !== 'DAMAGE')
              : false
          ),
          capability,
          refusal,
          compiles: refusal === null,
          offered: offered.available.some(({ actionId }) => actionId === capability.actionId),
          listedUnavailable: offered.unavailable.some(
            ({ actionId, ownerFeatureId }) =>
              actionId === capability.actionId && ownerFeatureId === feature.id
          )
        }
      })
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

  it.each(breathRows)('$name compiles to a directed area of its printed size', (row) => {
    const policy = buildCompiledActionTargetPolicy(row.capability)
    expect(policy.range.rangeKind).toBe('SELF')
    expect(encounterActionTargetKind(policy)).toBe('DIRECTED')
    expect(encounterActionChoiceTarget(policy)).toEqual(row.printed)
  })

  const shapedLeavingMoreThanDamage = breathRows.filter(
    ({ leavesLastingEffect }) => leavesLastingEffect
  )

  // The System compiles a damage-only breath to a test outcome, a breath whose condition it times
  // and repeats (Silver, Dust Mephit) or ends on damage (Brass), one whose grant it times and
  // repeats (Gold, Copper), one whose repeat save escalates to a second condition (Gorgon) and one
  // that pushes each creature that fails its save (Bronze).
  it('finds every breath that leaves more than damage', () => {
    expect(shapedLeavingMoreThanDamage).toHaveLength(22)
  })
  it.each(shapedLeavingMoreThanDamage.filter(({ compiles }) => compiles))(
    '$name leaves its condition through its System and is offered',
    (row) => {
      expect(row.refusal).toBeNull()
      expect(row.offered).toBe(true)
      expect(row.listedUnavailable).toBe(false)
    }
  )

  it.each(breathRows.filter(({ compiles }) => compiles))(
    '$name compiles to an executable test outcome and is offered',
    (row) => {
      expect(
        dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
          action: row.capability,
          compilerSource: buildCompiledActionCompilerSource(row.capability)
        })?.kind
      ).toBe('TEST_OUTCOME')
      expect(row.offered).toBe(true)
      expect(row.listedUnavailable).toBe(false)
    }
  )

  // SPELLS-19.AC2: the list of breaths the System cannot execute is empty, so the filtered rows
  // above are every breath, and discovery offers each of them.
  it('leaves no breath its System cannot execute, and offers every breath', () => {
    expect(
      breathRows.filter(({ compiles }) => !compiles).map(({ name, refusal }) => ({ name, refusal }))
    ).toEqual([])
    expect(
      breathRows
        .filter(({ offered, listedUnavailable }) => !offered || listedUnavailable)
        .map(({ effectId }) => effectId)
    ).toEqual([])
  })

  // The sizes below are read from the SRD stat blocks, not from the authored rows or the parser.
  it.each([
    ['Black Dragon Wyrmling', 'Acid Breath', line(15, 5)],
    ['Red Dragon Wyrmling', 'Fire Breath', cone(15)],
    ['Ancient Red Dragon', 'Fire Breath', cone(90)],
    ['Ancient Blue Dragon', 'Lightning Breath', line(120, 10)],
    ['Behir', 'Lightning Breath', line(20, 5)],
    ['Winter Wolf', 'Cold Breath', cone(15)],
    ['Dragon Turtle', 'Steam Breath', cone(60)],
    ['Gorgon', 'Petrifying Breath', cone(30)]
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
