import { CLOSED_RULE_KIND, modifierRollInfluence } from '@artificer-toolkit/shared/core'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { describe, expect, it } from 'vitest'

import {
  creatureFeatureAttackContributors,
  featureModifiersReadHolderLight,
  type EncounterHolderLight
} from '../encounterActiveGrants.js'
import { foldDnd5eCreatureFeatureGrants } from '../systems/dnd5e/creatureFeatureGrantFold.js'
import { resolveDnd5eRollMode } from '../systems/dnd5e/rollModePolicy.js'

const ATTACK_DOMAINS = ['MELEE', 'RANGED', 'SPELL', 'UNARMED']
const HOLDER_ID = 'holder'
const SUNLIT: EncounterHolderLight = { brightLight: true, daylight: true }
const TORCHLIT: EncounterHolderLight = { brightLight: true, daylight: false }
const DIM_DAYLIT: EncounterHolderLight = { brightLight: false, daylight: false }

function modifiersOf(label: string) {
  const creature = srdBaselineContent.subjects.creatures.find((entry) => entry.label === label)
  if (!creature) throw new Error(`SRD Creature "${label}" is missing.`)
  return foldDnd5eCreatureFeatureGrants(creature)
}

function attackMode(label: string, attackDomain: string, holderLight: EncounterHolderLight | null) {
  return resolveDnd5eRollMode(
    creatureFeatureAttackContributors(
      HOLDER_ID,
      attackDomain,
      null,
      modifiersOf(label),
      null,
      false,
      holderLight
    )
  ).rollMode
}

describe('light sensitivity authored as disadvantage on SRD Creatures (SPELLS-33.T6d1, D189)', () => {
  it('no longer has the Sunlight Sensitivity or Light Sensitivity closed rule kinds', () => {
    expect(Object.keys(CLOSED_RULE_KIND)).not.toContain('CREATURE_SUNLIGHT_SENSITIVITY')
    expect(Object.keys(CLOSED_RULE_KIND)).not.toContain('CREATURE_CLOAKER_LIGHT_SENSITIVITY')
  })

  it('folds one holder-in-bright-light attack roll disadvantage per attack domain', () => {
    const grants = modifiersOf('Drow').filter(
      (modifier) =>
        modifier.valueDomainCode === 'ATTACK_ROLL' &&
        modifierRollInfluence(modifier) === 'DISADVANTAGE'
    )
    expect(grants.map(({ domain }) => domain.attackDomain).sort()).toEqual(
      [...ATTACK_DOMAINS].sort()
    )
    for (const { deferredRequirements } of grants)
      expect(deferredRequirements).toEqual([
        {
          conditions: [
            expect.objectContaining({ kind: 'HOLDER_IN_BRIGHT_LIGHT', requiresDaylight: true })
          ]
        }
      ])
    expect(featureModifiersReadHolderLight(grants)).toBe(true)
  })

  it.each(['Drider', 'Drow', 'Duergar', 'Specter', 'Wight', 'Wraith'])(
    'gives the %s disadvantage on every attack domain in daylight only',
    (label) => {
      for (const attackDomain of ATTACK_DOMAINS) {
        expect(attackMode(label, attackDomain, SUNLIT)).toBe('DISADVANTAGE')
        expect(attackMode(label, attackDomain, TORCHLIT)).toBe('NORMAL')
        expect(attackMode(label, attackDomain, DIM_DAYLIT)).toBe('NORMAL')
        expect(attackMode(label, attackDomain, null)).toBe('NORMAL')
      }
    }
  )

  it('gives the Cloaker disadvantage in any bright light, daylit or not', () => {
    for (const attackDomain of ATTACK_DOMAINS) {
      expect(attackMode('Cloaker', attackDomain, SUNLIT)).toBe('DISADVANTAGE')
      expect(attackMode('Cloaker', attackDomain, TORCHLIT)).toBe('DISADVANTAGE')
      expect(attackMode('Cloaker', attackDomain, DIM_DAYLIT)).toBe('NORMAL')
    }
  })

  it('authors the sight-based Wisdom check disadvantage with the same gate', () => {
    const checks = modifiersOf('Drow').filter(
      ({ valueDomainCode }) => valueDomainCode === 'ABILITY_CHECK'
    )
    expect(checks).toHaveLength(1)
    expect(checks[0].domain).toEqual({ ability: 'WISDOM' })
    expect(modifierRollInfluence(checks[0])).toBe('DISADVANTAGE')
    expect(featureModifiersReadHolderLight(checks)).toBe(true)
  })

  it('gives a Creature without light sensitivity no light read and no disadvantage', () => {
    const goblin = modifiersOf('Goblin')
    expect(featureModifiersReadHolderLight(goblin)).toBe(false)
    expect(
      creatureFeatureAttackContributors(HOLDER_ID, 'MELEE', null, goblin, null, false, SUNLIT)
    ).toEqual([])
  })
})
