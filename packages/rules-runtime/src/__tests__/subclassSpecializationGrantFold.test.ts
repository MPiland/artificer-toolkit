import { describe, expect, it } from 'vitest'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import { SRD_DAMAGE_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { SRD, evaluateSrdCharacter, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'

/**
 * SPELLS-31.T5k ruling (a): a grant gated on the subclass specialization the Builder stored (a
 * Draconic Bloodline's dragon) is decided by the Character grant fold, beside OPTION_OBTAINED.
 */

const SORCERER = srdByLabel(SRD.classes, 'Sorcerer')
const BLOODLINE = srdByLabel(SRD.classes, 'Draconic Bloodline')
if (BLOODLINE.category !== 'SUBCLASS') throw new Error('Draconic Bloodline is a subclass.')
const RED = srdByLabel(BLOODLINE.specializations ?? [], 'Red Dragon')
const damageTypeId = (code: string) => SRD_DAMAGE_TYPES.find((each) => each.code === code)!.id

/** Resistance to `damageCode` while the stored ancestor is (INCLUDE) or is not (EXCLUDE) red. */
function ancestryResistance(
  part: number,
  damageCode: string,
  constraint: 'INCLUDE' | 'EXCLUDE'
): NonNullable<NonNullable<FeatureAuthored['grants']>['modifiers']>[number] {
  return {
    id: testUuid(part),
    grantKind: 'MODIFIER_GRANT',
    valueDomainCode: 'DAMAGE_RESISTANCE',
    domain: {},
    modifierKind: 'ADD_OPTION',
    payload: { damageTypeId: damageTypeId(damageCode) },
    scope: 'GLOBAL',
    selectionKind: 'GRANTED',
    order: part,
    restrictions: {
      id: testUuid(part + 1),
      groups: [
        {
          id: testUuid(part + 2),
          order: 0,
          contexts: [
            {
              id: testUuid(part + 3),
              order: 0,
              subject: 'SUBCLASS',
              authoringModeKind: 'SELECTED',
              subclassIds: [BLOODLINE.id],
              conditions: [
                {
                  id: testUuid(part + 4),
                  order: 0,
                  kind: 'PREDICATE',
                  constraint,
                  predicateCode: 'SUBCLASS_SPECIALIZATION',
                  authoringModeKind: 'SELECTED',
                  specializationIds: [RED.id]
                }
              ]
            }
          ]
        }
      ]
    }
  }
}

const HOMEBREW: FeatureAuthored = {
  id: testUuid(0x5a0),
  label: 'Ancestral Ward',
  description: 'Red descendants resist fire; every other ancestry resists cold.',
  availableAtLevel: 1,
  order: 1,
  grants: {
    modifiers: [
      ancestryResistance(0x5b0, 'FIRE', 'INCLUDE'),
      ancestryResistance(0x5c0, 'COLD', 'EXCLUDE')
    ]
  }
}

function resistances(classEntry: { subclass?: string; specialization?: string }) {
  return evaluateSrdCharacter({
    classes: [{ label: 'Sorcerer', level: 1, ...classEntry }],
    extraFeatures: [HOMEBREW],
    features: [
      {
        acquisitionId: 'acquired:ancestral-ward',
        featureId: HOMEBREW.id,
        source: { kind: 'CLASS', classId: SORCERER.id, classLevel: 1 },
        timing: { kind: 'CLASS_LEVEL', classId: SORCERER.id, classLevel: 1 }
      }
    ]
  })
    .output.grantFold.modifiers.filter(
      ({ valueDomainCode }) => valueDomainCode === 'DAMAGE_RESISTANCE'
    )
    .map(({ payload }) => payload)
}

describe('a grant gated on the stored subclass specialization (SPELLS-31.T5k)', () => {
  it('holds the INCLUDE grant for the named specialization and drops the EXCLUDE one', () => {
    expect(resistances({ subclass: 'Draconic Bloodline', specialization: 'Red Dragon' })).toEqual([
      { damageTypeId: damageTypeId('FIRE') }
    ])
  })

  it('excludes it for another specialization and keeps the EXCLUDE grant', () => {
    expect(resistances({ subclass: 'Draconic Bloodline', specialization: 'Blue Dragon' })).toEqual([
      { damageTypeId: damageTypeId('COLD') }
    ])
  })

  it('treats a subclass without a stored specialization as not the named one', () => {
    expect(resistances({ subclass: 'Draconic Bloodline' })).toEqual([
      { damageTypeId: damageTypeId('COLD') }
    ])
  })
})
