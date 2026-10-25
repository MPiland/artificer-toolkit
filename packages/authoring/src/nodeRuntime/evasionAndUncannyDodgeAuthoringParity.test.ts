import { describe, expect, it } from 'vitest'

import { incomingDamageProfile } from '@artificer-toolkit/rules-runtime/encounterActiveGrants'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import {
  SRD,
  evaluateSrdCharacter,
  srdByLabel,
  srdFeature
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { hunterConclave } from '@artificer-toolkit/source-data/srd/classes/hunter.js'
import { uncannyDodgeEffect } from '@artificer-toolkit/source-data/srd/classes/mechanics.js'
import { monk } from '@artificer-toolkit/source-data/srd/classes/monk.js'
import { rogue } from '@artificer-toolkit/source-data/srd/classes/rogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'

/**
 * SPELLS-31.T5a (D156): Evasion is an `INCOMING_DAMAGE` save-for-half grant and Uncanny Dodge a
 * reaction granting an `INCOMING_DAMAGE` halving, both core options a Builder author has on a
 * feature. Homebrew variants for another save or result pass the class node map unchanged and fold
 * the same way.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

const idFor = (part: number, entry: number) =>
  `7e57a000-0000-4000-8${part.toString(16).padStart(3, '0')}-${entry.toString(16).padStart(12, '0')}`

function normalize(record: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(record) as unknown as Record<string, unknown>
  })
}

/** A homebrew ward: no damage on a successful Constitution save that halves it, full on a failure. */
function stalwartFrame(): FeatureAuthored {
  return {
    id: idFor(0x50, 1),
    label: 'Stalwart Frame',
    description: 'You take no damage when you succeed on a Constitution save for half.',
    availableAtLevel: 1,
    order: 99,
    grants: {
      modifiers: [
        {
          id: idFor(0x51, 1),
          grantKind: 'MODIFIER_GRANT',
          valueDomainCode: 'INCOMING_DAMAGE',
          domain: {},
          modifierKind: 'ENABLE',
          scope: 'GLOBAL',
          selectionKind: 'GRANTED',
          payload: {
            incomingDamageKind: 'SAVE_FOR_HALF',
            saveAbilities: ['CONSTITUTION'],
            onSaveSuccess: 'NONE',
            onSaveFailure: 'FULL'
          },
          order: 0
        }
      ]
    }
  }
}

/** A homebrew reaction that halves a hit, authored with Uncanny Dodge's options. */
function braceForImpact(): FeatureAuthored {
  return {
    id: idFor(0x52, 1),
    label: 'Brace for Impact',
    description:
      'When a creature you can see hits you, you can use your reaction to halve the damage.',
    availableAtLevel: 1,
    order: 100,
    effects: [
      uncannyDodgeEffect({
        effect: idFor(0x53, 1),
        range: idFor(0x53, 2),
        path: idFor(0x53, 3),
        duration: idFor(0x53, 4),
        outcome: idFor(0x53, 5),
        grant: idFor(0x53, 6)
      })
    ]
  }
}

const evasionProfile = {
  halved: false,
  saveForHalf: [
    {
      incomingDamageKind: 'SAVE_FOR_HALF',
      saveAbilities: ['DEXTERITY'],
      onSaveSuccess: 'NONE',
      onSaveFailure: 'HALF'
    }
  ]
}

describe('Evasion and Uncanny Dodge (SPELLS-31.T5a)', () => {
  // `srdClassNodeMap.test.ts` proves each of these SRD records passes the class node map unchanged.
  it('leaves no closed rule on the SRD Rogue, Monk or Hunter', () => {
    for (const record of [rogue, monk, hunterConclave]) {
      expect(JSON.stringify(record.features)).not.toMatch(/_EVASION|UNCANNY_DODGE/)
    }
  })

  it('keeps homebrew save-for-half and halving features exactly as authored', async () => {
    const authored = [stalwartFrame(), braceForImpact()]
    const result = await normalize({
      ...structuredClone(rogue),
      features: [...(rogue.features ?? []), ...authored]
    })
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual([
      ...(rogue.features ?? []),
      ...authored
    ])
  })

  it.each([
    ['Rogue', 7],
    ['Monk', 7]
  ])('gives the %s Evasion as a Dexterity save-for-half adjustment', (classLabel, level) => {
    const { output } = evaluateSrdCharacter({
      classes: [{ label: classLabel, level }],
      features: [srdFeature({ owner: 'CLASS', classLabel, featureLabel: 'Evasion', level })]
    })
    expect(incomingDamageProfile(output.grantFold.modifiers)).toEqual(evasionProfile)
  })

  it("gives the Hunter's Evasion option the same adjustment", () => {
    const { output } = evaluateSrdCharacter({
      classes: [{ label: 'Ranger', level: 15, subclass: 'Hunter' }],
      features: [
        srdFeature({
          owner: 'SUBCLASS',
          classLabel: 'Ranger',
          subclassLabel: 'Hunter',
          featureLabel: "Superior Hunter's Defense",
          level: 15,
          optionLabels: ['Evasion']
        })
      ]
    })
    expect(incomingDamageProfile(output.grantFold.modifiers)).toEqual(evasionProfile)
  })

  it('folds the homebrew ward for its own save and results', () => {
    const homebrew = stalwartFrame()
    const ROGUE = srdByLabel(SRD.classes, 'Rogue')
    const { output } = evaluateSrdCharacter({
      classes: [{ label: 'Rogue', level: 1 }],
      extraFeatures: [homebrew],
      features: [
        {
          acquisitionId: 'acquired:stalwart-frame',
          featureId: homebrew.id,
          source: { kind: 'CLASS', classId: ROGUE.id, classLevel: 1 },
          timing: { kind: 'CLASS_LEVEL', classId: ROGUE.id, classLevel: 1 }
        }
      ]
    })
    expect(incomingDamageProfile(output.grantFold.modifiers)).toEqual({
      halved: false,
      saveForHalf: [
        {
          incomingDamageKind: 'SAVE_FOR_HALF',
          saveAbilities: ['CONSTITUTION'],
          onSaveSuccess: 'NONE',
          onSaveFailure: 'FULL'
        }
      ]
    })
  })
})
