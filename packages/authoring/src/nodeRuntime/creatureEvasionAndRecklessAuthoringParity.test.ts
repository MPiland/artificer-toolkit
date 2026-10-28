import { describe, expect, it } from 'vitest'

import { buildMovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import {
  CAMPAIGN_ID,
  SRD_SYSTEM_ID,
  installedSrdCreature,
  srdCreatureActor,
  testUuid
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { assassin } from '@artificer-toolkit/source-data/srd/creatures/assassin.js'
import { berserker } from '@artificer-toolkit/source-data/srd/creatures/berserker.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'

/**
 * SPELLS-33.T5afp (D156, D187a): the Assassin's Evasion is the `INCOMING_DAMAGE` save-for-half
 * grant the Rogue's Evasion uses, and the Berserker's Reckless is a GM ruling, as the Barbarian's
 * Reckless Attack is, because its two grants end on different turn boundaries. Both are core
 * options a Builder author has on a creature feature, so each creature passes the creature node
 * map exactly as authored, as does a homebrew ward for another save.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(creature: CreatureAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
}

function feature(creature: CreatureAuthored, label: string) {
  const found = creature.features?.find((candidate) => candidate.label === label)
  if (!found) throw new Error(`The creature must author ${label}.`)
  return found
}

/** The Assassin with its Evasion turned into a homebrew Constitution ward: none on a success, full on a failure. */
function stalwartAssassin(base: CreatureAuthored = assassin): CreatureAuthored {
  const authored = structuredClone(base)
  const grant = feature(authored, 'Evasion').grants?.modifiers?.[0]
  if (grant?.valueDomainCode !== 'INCOMING_DAMAGE')
    throw new Error('Evasion must author an incoming damage grant.')
  grant.payload = {
    incomingDamageKind: 'SAVE_FOR_HALF',
    saveAbilities: ['CONSTITUTION'],
    onSaveSuccess: 'NONE',
    onSaveFailure: 'FULL'
  }
  return authored
}

function incomingDamage(creature: CreatureAuthored) {
  return buildMovementTarget({
    actor: srdCreatureActor({ id: testUuid(0x5afb), creature }),
    activeEffects: [],
    gameSystemId: SRD_SYSTEM_ID,
    campaignId: CAMPAIGN_ID,
    characterFacts: null
  }).incomingDamage
}

describe('creature Evasion and Reckless from core options (SPELLS-33.T5afp)', () => {
  it('authors no closed rule on either feature', () => {
    expect(JSON.stringify(feature(assassin, 'Evasion'))).not.toContain('CLOSED_RULE')
    expect(JSON.stringify(feature(berserker, 'Reckless'))).not.toContain('CLOSED_RULE')
  })

  it('authors Reckless as a GM ruling', () => {
    const path = feature(berserker, 'Reckless').effects?.[0]?.paths[0]
    expect(path?.selectionKind === 'FIXED' && path.resultBlock.outcomes).toEqual([
      expect.objectContaining({ effectKind: 'MANUAL_ADJUDICATION', label: 'Reckless' })
    ])
  })

  it.each([
    ['Assassin', assassin],
    ['Berserker', berserker],
    ['homebrew ward Assassin', stalwartAssassin()]
  ] as const)('keeps the %s exactly as authored', async (_label, creature) => {
    const result = await normalize(creature)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
  })

  it("gives the Assassin in an Encounter the Rogue's Dexterity save-for-half adjustment", () => {
    expect(incomingDamage(installedSrdCreature(assassin))).toEqual({
      halved: false,
      reductions: [],
      saveForHalf: [
        {
          incomingDamageKind: 'SAVE_FOR_HALF',
          saveAbilities: ['DEXTERITY'],
          onSaveSuccess: 'NONE',
          onSaveFailure: 'HALF'
        }
      ]
    })
  })

  it('folds the homebrew ward for its own save and results', () => {
    expect(incomingDamage(stalwartAssassin(installedSrdCreature(assassin))).saveForHalf).toEqual([
      {
        incomingDamageKind: 'SAVE_FOR_HALF',
        saveAbilities: ['CONSTITUTION'],
        onSaveSuccess: 'NONE',
        onSaveFailure: 'FULL'
      }
    ])
  })
})
