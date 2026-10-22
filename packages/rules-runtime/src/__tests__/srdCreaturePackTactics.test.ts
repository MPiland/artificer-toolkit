import { CLOSED_RULE_KIND, modifierRollInfluence } from '@artificer-toolkit/shared/core'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { describe, expect, it } from 'vitest'

import {
  creatureFeatureAttackContributors,
  featureModifiersReadEnemyProximity
} from '../encounterActiveGrants.js'
import { foldDnd5eCreatureFeatureGrants } from '../systems/dnd5e/creatureFeatureGrantFold.js'
import { resolveDnd5eRollMode } from '../systems/dnd5e/rollModePolicy.js'

const PACK_TACTICS_CREATURES = [
  'Giant Rat',
  'Giant Vulture',
  'Hell Hound',
  'Thug',
  'Tribal Warrior'
]
const ATTACK_DOMAINS = ['MELEE', 'RANGED', 'SPELL', 'UNARMED']
const HOLDER_ID = 'holder'

function modifiersOf(label: string) {
  const creature = srdBaselineContent.subjects.creatures.find((entry) => entry.label === label)
  if (!creature) throw new Error(`SRD Creature "${label}" is missing.`)
  return foldDnd5eCreatureFeatureGrants(creature)
}

function attackMode(label: string, attackDomain: string, nearestEnemyFeet: number | null) {
  return resolveDnd5eRollMode(
    creatureFeatureAttackContributors(
      HOLDER_ID,
      attackDomain,
      null,
      modifiersOf(label),
      nearestEnemyFeet
    )
  ).rollMode
}

describe('Pack Tactics authored as attack roll advantage on SRD Creatures (SPELLS-33.T6d3a)', () => {
  it('no longer has a closed rule kind', () => {
    expect(Object.keys(CLOSED_RULE_KIND)).not.toContain('CREATURE_PACK_TACTICS')
  })

  it.each(PACK_TACTICS_CREATURES)(
    '%s folds one enemy-near-target attack roll advantage per attack domain',
    (label) => {
      const grants = modifiersOf(label).filter(
        (modifier) =>
          modifier.valueDomainCode === 'ATTACK_ROLL' &&
          modifierRollInfluence(modifier) === 'ADVANTAGE'
      )
      expect(grants.map(({ domain }) => domain.attackDomain).sort()).toEqual(
        [...ATTACK_DOMAINS].sort()
      )
      for (const { deferredRequirements } of grants)
        expect(deferredRequirements).toEqual([
          { conditions: [expect.objectContaining({ kind: 'ENEMY_NEAR_TARGET', max: 5 })] }
        ])
      expect(featureModifiersReadEnemyProximity(grants)).toBe(true)
    }
  )

  it.each(PACK_TACTICS_CREATURES)(
    '%s has advantage on every attack domain only with an able enemy of the target within 5 feet',
    (label) => {
      for (const attackDomain of ATTACK_DOMAINS) {
        expect(attackMode(label, attackDomain, 5)).toBe('ADVANTAGE')
        expect(attackMode(label, attackDomain, 0)).toBe('ADVANTAGE')
        expect(attackMode(label, attackDomain, 10)).toBe('NORMAL')
        expect(attackMode(label, attackDomain, null)).toBe('NORMAL')
      }
    }
  )

  it('gives a Creature without Pack Tactics no enemy-proximity read and no advantage', () => {
    const goblin = modifiersOf('Goblin')
    expect(featureModifiersReadEnemyProximity(goblin)).toBe(false)
    expect(creatureFeatureAttackContributors(HOLDER_ID, 'MELEE', null, goblin, 5)).toEqual([])
  })
})
