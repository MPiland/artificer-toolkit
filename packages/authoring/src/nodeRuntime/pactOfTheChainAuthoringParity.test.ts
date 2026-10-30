import { describe, expect, it } from 'vitest'

import { encounterAttackDelegated } from '@artificer-toolkit/rules-runtime/encounterDelegatedAttack'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import {
  evaluateSrdCharacter,
  srdByLabel,
  srdFeature
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { warlock } from '@artificer-toolkit/source-data/srd/classes/warlock.js'
import { SPELL_IDS } from '@artificer-toolkit/source-data/srd/ids.js'
import { spellChildId } from '@artificer-toolkit/source-data/srd/spells/shared.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'

/**
 * SPELLS-31.T4v2a (D156): Pact of the Chain is authored from core options. Beside the Find Familiar
 * it grants, it holds a DELEGATED_ATTACK grant naming Find Familiar's summoning effect: the familiar
 * that effect conjured may attack with its reaction in place of one of the Warlock's attacks. A
 * homebrew grant naming another summoning effect passes the class node map unchanged and delegates
 * to its own summons alone.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

const PACT_OF_THE_CHAIN = srdByLabel(
  srdByLabel(warlock.features ?? [], 'Pact Boon').options ?? [],
  'Pact of the Chain'
)
const FIND_FAMILIAR_SUMMONS = spellChildId(SPELL_IDS.FIND_FAMILIAR, 0x210, 1)
const HOMEBREW_SUMMONS = '7e57a000-0000-4000-8000-0000000005a1'
const HOLDER_ID = '7e57a000-0000-4000-8000-0000000005a2'
const CARRIER_ID = '7e57a000-0000-4000-8000-0000000005a3'

/** A homebrew Feature whose summoned creatures attack in its holder's place, copied from the pact. */
function homebrewCommand(): FeatureAuthored {
  const grant = PACT_OF_THE_CHAIN.grants?.modifiers?.find(
    (modifier) => modifier.valueDomainCode === 'DELEGATED_ATTACK'
  )
  if (grant?.valueDomainCode !== 'DELEGATED_ATTACK')
    throw new Error('Pact of the Chain must author its grant.')
  return {
    id: '7e57a000-0000-4000-8000-0000000005a4',
    label: 'Bonded Servant',
    description: 'Bonded Servant',
    availableAtLevel: 1,
    order: 99,
    grants: {
      modifiers: [
        {
          ...grant,
          id: '7e57a000-0000-4000-8000-0000000005a5',
          payload: { effectIds: [HOMEBREW_SUMMONS] }
        }
      ]
    }
  }
}

/** Whether a creature the holder summoned with the effect `summonedWith` attacks in its place. */
function delegated(
  modifiers: Parameters<typeof encounterAttackDelegated>[0]['holderModifiers'],
  summonedWith: string
) {
  return encounterAttackDelegated({
    holder: { id: HOLDER_ID },
    delegate: { owner: { ownerActorId: HOLDER_ID, sourceEffectId: CARRIER_ID } },
    holderModifiers: modifiers,
    holderEffects: [{ id: CARRIER_ID, definition: { authoredEffectId: summonedWith } }]
  })
}

describe('Pact of the Chain (SPELLS-31.T4v2a)', () => {
  it('no longer lists its closed rule kind', () => {
    expect(CLOSED_RULE_KIND).not.toHaveProperty('CLASS_WARLOCK_PACT_OF_CHAIN')
    expect(PACT_OF_THE_CHAIN.effects ?? []).toEqual([])
  })

  it('delegates an attack only to the familiar its granted spell summoned', () => {
    const { output } = evaluateSrdCharacter({
      classes: [{ label: 'Warlock', level: 3 }],
      features: [
        srdFeature({
          owner: 'CLASS',
          classLabel: 'Warlock',
          featureLabel: 'Pact Boon',
          level: 3,
          optionLabels: ['Pact of the Chain']
        })
      ]
    })
    const { modifiers } = output.grantFold
    expect(delegated(modifiers, FIND_FAMILIAR_SUMMONS)).toBe(true)
    expect(delegated(modifiers, HOMEBREW_SUMMONS)).toBe(false)
    // A summons the holder no longer carries attacks for no one.
    expect(
      encounterAttackDelegated({
        holder: { id: HOLDER_ID },
        delegate: { owner: { ownerActorId: HOLDER_ID, sourceEffectId: CARRIER_ID } },
        holderModifiers: modifiers,
        holderEffects: []
      })
    ).toBe(false)
  })

  it('keeps a homebrew delegation exactly as authored through the class node map', async () => {
    const feature = homebrewCommand()
    const result = await normalizeNodeRuntimeValues(reader, {
      mapId: 'class',
      systemId: srdSystemRecord.id,
      values: structuredClone({
        ...warlock,
        features: [...(warlock.features ?? []), feature]
      } satisfies ClassAuthored) as unknown as Record<string, unknown>
    })
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual([
      ...(warlock.features ?? []),
      feature
    ])
  })

  it('delegates a homebrew grant to its own summons alone', () => {
    const feature = homebrewCommand()
    const { output } = evaluateSrdCharacter({
      classes: [{ label: 'Warlock', level: 1 }],
      extraFeatures: [feature],
      features: [
        {
          acquisitionId: `acquired:${feature.id}`,
          featureId: feature.id,
          source: { kind: 'CLASS', classId: warlock.id, classLevel: 1 },
          timing: { kind: 'CLASS_LEVEL', classId: warlock.id, classLevel: 1 }
        }
      ]
    })
    const { modifiers } = output.grantFold
    expect(delegated(modifiers, HOMEBREW_SUMMONS)).toBe(true)
    expect(delegated(modifiers, FIND_FAMILIAR_SUMMONS)).toBe(false)
  })
})
