import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import {
  SRD_CONDITION_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

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

/** Whether the System can execute the action; any other compile failure is a real error. */
function compilesToPlan(capability: Parameters<typeof compileEncounterFeatureActionPlan>[1]) {
  try {
    compileEncounterFeatureActionPlan(dnd5eCharacterRuleActionSystemAdapter, capability)
    return true
  } catch (error) {
    if (error instanceof CharacterRuleActionUnsupportedCompilationError) return false
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
          compiles: compilesToPlan(capability),
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
  // System cannot execute even unshaped, so it is listed unavailable. It stays unshaped: shaping it
  // would not make it run, and an area does not refuse a bare condition (SPELLS-19).
  it('keeps the Gorgon’s Petrifying Breath unshaped and unavailable', () => {
    if (!gorgonRow) throw new Error('The Gorgon has no breath.')
    expect(
      encounterActionTargetKind(buildCompiledActionTargetPolicy(gorgonRow.capability))
    ).not.toBe('DIRECTED')
    expect(gorgonRow.compiles).toBe(false)
    expect(gorgonRow.offered).toBe(false)
    expect(gorgonRow.listedUnavailable).toBe(true)
  })

  // A Brass Dragon's Sleep Breath is a lone on-fail Unconscious for minutes that ends when the
  // sleeper takes damage: a timed condition its System owns, so the save runs it (SPELLS-29.T1a).
  const brassSleepBreaths = breathRows.filter(
    ({ creatureLabel, leavesLastingEffect }) =>
      leavesLastingEffect && creatureLabel.includes('Brass')
  )
  const unconsciousId = SRD_CONDITION_TYPES.find(({ code }) => code === 'UNCONSCIOUS')?.id

  it('finds the Sleep Breath of every age of Brass Dragon', () => {
    expect(brassSleepBreaths).toHaveLength(4)
  })

  it.each(brassSleepBreaths)(
    '$name runs its Unconscious as a timed condition that ends on damage',
    (row) => {
      const plan = compileEncounterFeatureActionPlan(
        dnd5eCharacterRuleActionSystemAdapter,
        row.capability
      )
      expect(plan.kind).toBe('TEST_OUTCOME')
      if (plan.kind !== 'TEST_OUTCOME') return
      expect(plan.outcomes.map(({ pathCode }) => pathCode)).toEqual(['ON_SAVE_FAIL'])
      const [activeEffectPlan, ...rest] =
        dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({
          action: row.capability,
          published: plan.test.published
        }) ?? []
      expect(rest).toEqual([])
      expect(activeEffectPlan?.conditionContribution).toMatchObject({
        conditionId: unconsciousId,
        endOnTriggers: [{ event: 'DAMAGE_TAKEN', by: 'ANYONE' }]
      })
      expect(row.offered).toBe(true)
    }
  )

  const shapedLeavingMoreThanDamage = breathRows.filter(
    (row) =>
      row.leavesLastingEffect &&
      row.creatureLabel !== 'Gorgon' &&
      !brassSleepBreaths.includes(row)
  )

  // The System compiles a damage-only breath to a test outcome. One that also leaves a condition
  // with a repeat save, a push, slowed or weakened targets has a shape it cannot execute, so
  // discovery never offers it.
  it('cannot execute exactly the shaped breaths that leave more than damage, and the unshaped Gorgon’s', () => {
    expect(shapedLeavingMoreThanDamage).toHaveLength(17)
    expect(
      breathRows
        .filter(({ compiles }) => !compiles)
        .map(({ effectId }) => effectId)
        .sort()
    ).toEqual(
      [...shapedLeavingMoreThanDamage, ...(gorgonRow ? [gorgonRow] : [])]
        .map(({ effectId }) => effectId)
        .sort()
    )
  })

  it.each(shapedLeavingMoreThanDamage)(
    '$name is a shaped area its System cannot execute, so it is listed unavailable and not offered',
    (row) => {
      expect(() =>
        compileEncounterFeatureActionPlan(dnd5eCharacterRuleActionSystemAdapter, row.capability)
      ).toThrow(CharacterRuleActionUnsupportedCompilationError)
      expect(row.offered).toBe(false)
      expect(row.listedUnavailable).toBe(true)
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
