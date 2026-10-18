import type { FeatureBaseAuthored } from '@artificer-toolkit/shared'
import { ATTACK_TRIGGER_CODES } from '@artificer-toolkit/schema/effects/effect'
import { describe, expect, it } from 'vitest'
import { SRD_CREATURE_ATTACK_BONUSES } from './creatures/attack-bonuses.js'
import { srdBaselineContent } from './index.js'

const attackSources = srdBaselineContent.subjects.creatures.flatMap((creature) =>
  creature.features
    .flatMap((feature): FeatureBaseAuthored[] => [feature, ...(feature.options ?? [])])
    .filter((source) =>
      (source.effects ?? []).some(
        (effect) =>
          effect.invocation.kind === 'ACTION' &&
          ATTACK_TRIGGER_CODES.has(effect.invocation.triggerCode ?? '')
      )
    )
    .map((source) => ({ label: `${creature.label}: ${source.label}`, source }))
)

function attackBonuses(label: string) {
  const entry = attackSources.find((candidate) => candidate.label === label)
  if (!entry) throw new Error(`SRD attack "${label}" is missing.`)
  return (entry.source.rollDefinitions ?? [])
    .filter((definition) => definition.kind === 'ATTACK')
    .map((definition) => definition.expression.modifier)
}

describe('SRD Creature attack rolls', () => {
  it('authors exactly one d20 ATTACK roll on every attack-triggered Feature and option', () => {
    const invalid = attackSources.flatMap(({ label, source }) => {
      const attacks = (source.rollDefinitions ?? []).filter(
        (definition) => definition.kind === 'ATTACK'
      )
      const [attack] = attacks
      return attacks.length === 1 &&
        attack?.expression.count === 1 &&
        attack.expression.die === 20 &&
        Number.isSafeInteger(attack.expression.modifier)
        ? []
        : [label]
    })

    expect(attackSources).toHaveLength(521)
    expect(invalid).toEqual([])
  })

  it('keys every authored attack bonus to an attack-triggered Feature or option', () => {
    const sourceIds = new Set(attackSources.map(({ source }) => source.id))

    expect([...SRD_CREATURE_ATTACK_BONUSES.keys()].filter((id) => !sourceIds.has(id))).toEqual([])
  })

  it('authors the printed normal and long range on every ranged weapon attack (D62)', () => {
    const ranges = srdBaselineContent.subjects.creatures.flatMap((creature) =>
      creature.features.flatMap((feature) =>
        [feature, ...(feature.options ?? [])].flatMap((source) =>
          (source.effects ?? []).flatMap((effect) => {
            if (
              effect.invocation.kind !== 'ACTION' ||
              effect.invocation.triggerCode !== 'RANGED_WEAPON_ATTACK'
            )
              return []
            // An option that prints no text of its own reads its Feature's.
            const printed = /range (\d+)(?: ft\.)?\/(\d+) ft|range (\d+) ft/.exec(
              source.description || feature.description || ''
            )
            const { range } = effect.invocation
            return [
              {
                label: `${creature.label}: ${source.label}`,
                authored:
                  range.rangeKind === 'DISTANCE' ? [range.amount, range.longAmount ?? null] : null,
                printed: printed
                  ? [Number(printed[1] ?? printed[3]), printed[2] ? Number(printed[2]) : null]
                  : null
              }
            ]
          })
        )
      )
    )

    expect(ranges).toHaveLength(57)
    expect(
      ranges.filter(({ authored, printed }) => JSON.stringify(authored) !== JSON.stringify(printed))
    ).toEqual([])
  })

  it('authors a long range on every ranged attack of an SRD weapon (D62)', () => {
    // Thrown flasks and vials are improvised: they print one range and no long range.
    const missing = srdBaselineContent.subjects.equipment.flatMap((equipment) =>
      (equipment.category === 'WEAPON' ? (equipment.effects ?? []) : []).flatMap((effect) =>
        effect.invocation.kind === 'ACTION' &&
        effect.invocation.triggerCode === 'RANGED_WEAPON_ATTACK' &&
        (effect.invocation.range.rangeKind !== 'DISTANCE' ||
          effect.invocation.range.longAmount === undefined)
          ? [equipment.label]
          : []
      )
    )

    expect(missing).toEqual([])
  })

  it('uses the printed bonus, or the base attack bonus when none is printed', () => {
    expect(attackBonuses('Wolf: Bite')).toEqual([4])
    expect(attackBonuses('Adult Black Dragon: Tail')).toEqual([11])
    expect(attackBonuses('Remorhaz: Swallow')).toEqual([11])
    expect(attackBonuses('Druid: Quarterstaff')).toEqual([2])
    expect(attackBonuses('Dryad: Club (Shillelagh)')).toEqual([6])
  })
})
