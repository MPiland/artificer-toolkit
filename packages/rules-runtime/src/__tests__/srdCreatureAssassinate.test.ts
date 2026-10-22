import { CLOSED_RULE_KIND, modifierRollInfluence } from '@artificer-toolkit/shared/core'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { describe, expect, it } from 'vitest'

import {
  creatureFeatureAttackContributors,
  featureModifiersReadEnemyProximity,
  featureModifiersReadTargetTurn
} from '../encounterActiveGrants.js'
import { foldDnd5eCreatureFeatureGrants } from '../systems/dnd5e/creatureFeatureGrantFold.js'
import { resolveDnd5eRollMode } from '../systems/dnd5e/rollModePolicy.js'

const ATTACK_DOMAINS = ['MELEE', 'RANGED', 'SPELL', 'UNARMED']
const HOLDER_ID = 'holder'

function creatureOf(label: string) {
  const creature = srdBaselineContent.subjects.creatures.find((entry) => entry.label === label)
  if (!creature) throw new Error(`SRD Creature "${label}" is missing.`)
  return creature
}

function modifiersOf(label: string) {
  return foldDnd5eCreatureFeatureGrants(creatureOf(label))
}

function attackMode(
  label: string,
  attackDomain: string,
  circumstances: { nearestEnemyFeet?: number | null; targetHasNotTakenTurn: boolean }
) {
  return resolveDnd5eRollMode(
    creatureFeatureAttackContributors(
      HOLDER_ID,
      attackDomain,
      null,
      modifiersOf(label),
      circumstances.nearestEnemyFeet ?? null,
      circumstances.targetHasNotTakenTurn
    )
  ).rollMode
}

describe('Assassinate authored as attack roll advantage on the SRD Assassin (SPELLS-33.T6d3b, D165)', () => {
  it('no longer has the Assassinate or Surprise Attack closed rule kinds', () => {
    expect(Object.keys(CLOSED_RULE_KIND)).not.toContain('CREATURE_ASSASSINATE')
    expect(Object.keys(CLOSED_RULE_KIND)).not.toContain('CREATURE_SURPRISE_ATTACK')
  })

  it('folds one target-has-not-taken-a-turn attack roll advantage per attack domain', () => {
    const grants = modifiersOf('Assassin').filter(
      (modifier) =>
        modifier.valueDomainCode === 'ATTACK_ROLL' &&
        modifierRollInfluence(modifier) === 'ADVANTAGE'
    )
    expect(grants.map(({ domain }) => domain.attackDomain).sort()).toEqual(
      [...ATTACK_DOMAINS].sort()
    )
    for (const { deferredRequirements } of grants)
      expect(deferredRequirements).toEqual([
        { conditions: [expect.objectContaining({ kind: 'TARGET_HAS_NOT_TAKEN_TURN' })] }
      ])
    expect(featureModifiersReadTargetTurn(grants)).toBe(true)
    expect(featureModifiersReadEnemyProximity(grants)).toBe(false)
  })

  it('has advantage on every attack domain only against a target that has not taken a turn', () => {
    for (const attackDomain of ATTACK_DOMAINS) {
      expect(attackMode('Assassin', attackDomain, { targetHasNotTakenTurn: true })).toBe(
        'ADVANTAGE'
      )
      expect(attackMode('Assassin', attackDomain, { targetHasNotTakenTurn: false })).toBe('NORMAL')
    }
  })

  it('does not take advantage from a nearby enemy of the target', () => {
    expect(
      attackMode('Assassin', 'MELEE', { nearestEnemyFeet: 5, targetHasNotTakenTurn: false })
    ).toBe('NORMAL')
  })

  it('keeps Pack Tactics from reading the turn state', () => {
    expect(featureModifiersReadTargetTurn(modifiersOf('Giant Rat'))).toBe(false)
    expect(attackMode('Giant Rat', 'MELEE', { targetHasNotTakenTurn: true })).toBe('NORMAL')
  })

  it('gives a Creature without Assassinate no turn-state read and no advantage', () => {
    const goblin = modifiersOf('Goblin')
    expect(featureModifiersReadTargetTurn(goblin)).toBe(false)
    expect(creatureFeatureAttackContributors(HOLDER_ID, 'MELEE', null, goblin, null, true)).toEqual(
      []
    )
  })

  it('leaves the Bugbear Surprise Attack as a description with no authored mechanic', () => {
    const feature = creatureOf('Bugbear').features?.find(({ label }) => label === 'Surprise Attack')
    expect(feature?.description).toContain('2d6')
    expect(feature?.effects ?? []).toEqual([])
    expect(feature?.grants).toBeUndefined()
  })
})
