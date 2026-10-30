import { describe, expect, it } from 'vitest'

import {
  encounterAttackAgainstContributors,
  sourceQualifierAdmits,
  type EncounterHolderState
} from '@artificer-toolkit/rules-runtime/encounterActiveGrants'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import {
  SRD,
  evaluateSrdCharacter,
  srdByLabel
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import type { FacetAuthored, FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { DamageDefenseBypassCode } from '@artificer-toolkit/shared/core'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { oathOfDevotion } from '@artificer-toolkit/source-data/srd/classes/oath-of-devotion.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'

/**
 * SPELLS-4.T2j2a (D156, D179): a grant limited to attacks that carry a trait (magical) is one
 * authored option. A feature that gives Purity of Spirit's attack disadvantage only against magical
 * attacks passes the class node map as authored, a trait the System does not list is cleared, and
 * the runtime admits only an attack with the authored trait.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)
const HOMEBREW_ID = '7e57a000-0000-4000-8000-000000000021'
const HOLDER_ID = '7e57a000-0000-4000-8000-000000000022'

const sourceTraitRestriction = (index: number, traits: readonly string[]): FacetAuthored => {
  const id = (entry: number) =>
    `7e57a000-0000-4000-8000-${(0x200 + index * 0x10 + entry).toString(16).padStart(12, '0')}`
  return {
    id: id(0),
    groups: [
      {
        id: id(1),
        order: 0,
        contexts: [
          {
            id: id(2),
            order: 0,
            subject: 'CREATURE',
            authoringModeKind: 'ALL',
            conditions: [
              {
                id: id(3),
                order: 0,
                kind: 'PREDICATE',
                constraint: 'INCLUDE',
                predicateCode: 'SOURCE_TRAIT',
                authoringModeKind: 'SELECTED',
                // A trait the System does not list is authored on purpose to prove it is cleared.
                traits: [...traits] as DamageDefenseBypassCode[]
              }
            ]
          }
        ]
      }
    ]
  }
}

/** Purity of Spirit with every grant limited to a source attack carrying one of `traits`. */
function wardingAgainstAttacksWith(traits: readonly string[]): FeatureAuthored {
  const purity = oathOfDevotion.features?.find(({ label }) => label === 'Purity of Spirit')
  if (!purity?.grants?.modifiers) throw new Error('Oath of Devotion must author Purity of Spirit.')
  return {
    ...structuredClone(purity),
    id: HOMEBREW_ID,
    label: 'Warded',
    grants: {
      modifiers: purity.grants.modifiers.map((modifier, index) => ({
        ...structuredClone(modifier),
        restrictions: sourceTraitRestriction(index, traits)
      }))
    }
  }
}

function normalizeOathWith(feature: FeatureAuthored) {
  const record: ClassAuthored = {
    ...structuredClone(oathOfDevotion),
    features: [...(oathOfDevotion.features ?? []), feature]
  }
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(record) as unknown as Record<string, unknown>
  })
}

const holderState: EncounterHolderState = {
  kind: 'CHARACTER',
  creatureTypeIds: [],
  canAct: true,
  speedAboveZero: true,
  freeHand: true,
  stowableHeldItemInstanceId: null,
  turnMovement: { usedFeet: 0, speedFeet: 30 },
  activeAuthoredEffectIds: []
}

const PALADIN = srdByLabel(SRD.classes, 'Paladin')

describe('an authored source trait on a grant (SPELLS-4.T2j2a)', () => {
  it('keeps a feature limited to magical attacks exactly as authored', async () => {
    const authored = wardingAgainstAttacksWith(['MAGICAL'])
    const result = await normalizeOathWith(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual([
      ...(oathOfDevotion.features ?? []),
      authored
    ])
  })

  it('clears a trait the System does not list', async () => {
    const result = await normalizeOathWith(wardingAgainstAttacksWith(['NOT_A_TRAIT']))
    expect(result.clearedPaths.length).toBeGreaterThan(0)
  })

  it('admits only a source attack with the authored trait', () => {
    const homebrew = wardingAgainstAttacksWith(['MAGICAL'])
    const { output } = evaluateSrdCharacter({
      classes: [{ label: 'Paladin', level: 1 }],
      extraFeatures: [homebrew],
      features: [
        {
          acquisitionId: 'acquired:warded',
          featureId: homebrew.id,
          source: { kind: 'CLASS', classId: PALADIN.id, classLevel: 1 },
          timing: { kind: 'CLASS_LEVEL', classId: PALADIN.id, classLevel: 1 }
        }
      ]
    })
    const attacksAgainst = encounterAttackAgainstContributors({
      holderActorId: HOLDER_ID,
      effects: [],
      grantFold: output.grantFold,
      holderState
    })
    expect(attacksAgainst.length).toBeGreaterThan(0)
    for (const { sourceQualifier } of attacksAgainst) {
      expect(
        sourceQualifierAdmits(sourceQualifier, { creatureTypeIds: [], traits: ['MAGICAL'] })
      ).toBe(true)
      expect(
        sourceQualifierAdmits(sourceQualifier, { creatureTypeIds: [], traits: ['SILVERED'] })
      ).toBe(false)
      expect(sourceQualifierAdmits(sourceQualifier, { creatureTypeIds: [] })).toBe(false)
    }
  })
})
