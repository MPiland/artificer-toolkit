import type { FeatureBaseAuthored } from '@artificer-toolkit/shared'
import { ATTACK_TRIGGER_CODES } from '@artificer-toolkit/schema/effects/effect'
import { describe, expect, it } from 'vitest'
import { SRD_CREATURE_ATTACK_BONUSES } from './creatures/attack-bonuses.js'
import { srdBaselineContent } from './index.js'

const attackSources = srdBaselineContent.subjects.creatures.flatMap((creature) =>
  (creature.features ?? [])
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

    expect(attackSources).toHaveLength(499)
    expect(invalid).toEqual([])
  })

  it('keys every authored attack bonus to an attack-triggered Feature or option', () => {
    const sourceIds = new Set(attackSources.map(({ source }) => source.id))

    expect([...SRD_CREATURE_ATTACK_BONUSES.keys()].filter((id) => !sourceIds.has(id))).toEqual([])
  })

  it('uses the printed bonus, or the base attack bonus when none is printed', () => {
    expect(attackBonuses('Wolf: Bite')).toEqual([4])
    expect(attackBonuses('Adult Black Dragon: Tail')).toEqual([11])
    expect(attackBonuses('Adult Black Dragon: Tail Attack')).toEqual([11])
    expect(attackBonuses('Druid: Quarterstaff')).toEqual([2])
    expect(attackBonuses('Dryad: Club (Shillelagh)')).toEqual([6])
  })
})
