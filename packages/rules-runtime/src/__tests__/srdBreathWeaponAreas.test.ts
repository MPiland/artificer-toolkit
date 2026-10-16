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
import { createEncounterFeatureActionCapabilityDiscoveryRegistry } from '../encounterFeatureActionCapabilityDiscovery.js'
import { discoverEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { dnd5eEncounterFeatureActionCapabilityAdapter } from '../systems/dnd5e/encounterFeatureActionCapabilityDiscovery.js'
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
const everyAction = createEncounterFeatureActionCapabilityDiscoveryRegistry([
  dnd5eEncounterFeatureActionCapabilityAdapter
])

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
    abilityDefinitions
  }
  const discovery = everyAction.discover(input)
  const offered = discoverEncounterFeatureActions(input)
  return (creature.features ?? [])
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

  it.each(breathRows.filter(({ creatureLabel }) => creatureLabel !== 'Gorgon'))(
    '$name compiles to a directed area of its printed size',
    (row) => {
      const policy = buildCompiledActionTargetPolicy(row.capability)
      expect(policy.range.rangeKind).toBe('SELF')
      expect(encounterActionTargetKind(policy)).toBe('DIRECTED')
      expect(encounterActionChoiceTarget(policy)).toEqual(row.printed)
    }
  )

  const gorgonRow = breathRows.find(({ creatureLabel }) => creatureLabel === 'Gorgon')

  // The Gorgon's breath is a lone on-fail Restrained whose repeat save is not authored, a shape its
  // System cannot execute even unshaped, so it is listed unavailable. It stays unshaped until its
  // petrification is authored: shaping it would not make it run (SPELLS-19.T3c).
  it('keeps the Gorgon’s Petrifying Breath unshaped and unavailable', () => {
    if (!gorgonRow) throw new Error('The Gorgon has no breath.')
    expect(
      encounterActionTargetKind(buildCompiledActionTargetPolicy(gorgonRow.capability))
    ).not.toBe('DIRECTED')
    expect(gorgonRow.compiles).toBe(false)
    expect(gorgonRow.offered).toBe(false)
    expect(gorgonRow.listedUnavailable).toBe(true)
  })

  const shapedLeavingMoreThanDamage = breathRows.filter(
    ({ creatureLabel, leavesLastingEffect }) => leavesLastingEffect && creatureLabel !== 'Gorgon'
  )

  // The breaths SPELLS-19 has still to author: the slowing and weakening of the Copper and Gold
  // Dragons (T3b), the Gorgon's petrification (T3c) and the Bronze Dragons' push (T4). Each task
  // takes its rows off this list, and the last leaves it empty (AC 19.2).
  const stillToAuthor = breathRows.filter(({ creatureLabel, leavesLastingEffect }) => {
    const pending = /(Copper|Gold|Bronze) Dragon|^Gorgon$/.test(creatureLabel)
    return leavesLastingEffect && pending
  })
  const shapedStillToAuthor = stillToAuthor.filter(
    ({ creatureLabel }) => creatureLabel !== 'Gorgon'
  )

  // The System compiles a damage-only breath to a test outcome, and a breath whose condition it
  // times and repeats (Silver, Dust Mephit) or ends on damage (Brass). The rest it cannot execute,
  // so discovery never offers them.
  it('cannot execute exactly the breaths still to author', () => {
    expect(shapedLeavingMoreThanDamage).toHaveLength(21)
    expect(stillToAuthor).toHaveLength(13)
    expect(
      breathRows
        .filter(({ compiles }) => !compiles)
        .map(({ effectId }) => effectId)
        .sort()
    ).toEqual(stillToAuthor.map(({ effectId }) => effectId).sort())
  })

  it.each(shapedStillToAuthor)(
    '$name is a shaped area its System cannot execute, so it is listed unavailable and not offered',
    (row) => {
      expect(() =>
        compileEncounterFeatureActionPlan(dnd5eCharacterRuleActionSystemAdapter, row.capability)
      ).toThrow(CharacterRuleActionUnsupportedCompilationError)
      expect(row.offered).toBe(false)
      expect(row.listedUnavailable).toBe(true)
    }
  )

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

  // SPELLS-19.AC2: the list of breaths the System cannot execute is empty. T3b, T3c and T4 take the
  // rows off `stillToAuthor`; the task that empties it drops `.fails` (vitest errors once it passes).
  it.fails('leaves no breath its System cannot execute', () => {
    expect(
      breathRows.filter(({ compiles }) => !compiles).map(({ name, refusal }) => ({ name, refusal }))
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
