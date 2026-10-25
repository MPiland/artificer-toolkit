import { describe, expect, it } from 'vitest'

import {
  encounterSourceConditionImmunities,
  sourceQualifierAdmits,
  type EncounterHolderState
} from '@artificer-toolkit/rules-runtime/encounterActiveGrants'
import { characterHeldDamageInterceptions } from '@artificer-toolkit/rules-runtime/encounterDamageInterception'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import {
  evaluateSrdCharacter,
  srdByLabel,
  srdFeature
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { barbarian, RAGE_EFFECT_ID } from '@artificer-toolkit/source-data/srd/classes/barbarian.js'
import { pathOfTheBerserker } from '@artificer-toolkit/source-data/srd/classes/path-of-the-berserker.js'
import {
  conditionTypeId,
  creatureTypeId
} from '@artificer-toolkit/source-data/srd/spells/shared.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'

/**
 * SPELLS-31.T5f1 (D187a): Mindless Rage and Reckless Attack are authored from the core options a
 * Builder author has. Mindless Rage's immunities are restricted by the holder carrying the Rage
 * effect (HOLDER_ACTIVE_EFFECT), and its suspension clause is a GM ruling. Reckless Attack is a GM
 * ruling: its two grants end on different turn boundaries, which the compiler's one fixed self
 * action refuses. A homebrew feature bound to its own effect passes the class node map unchanged and
 * resolves the same way.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)
const HOMEBREW_EFFECT_ID = '7e57a000-0000-4000-8000-0000000005f1'

function normalize(record: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(record) as unknown as Record<string, unknown>
  })
}

function holderState(activeAuthoredEffectIds: readonly string[]): EncounterHolderState {
  return {
    kind: 'CHARACTER',
    creatureTypeIds: [],
    canAct: true,
    speedAboveZero: true,
    freeHand: true,
    stowableHeldItemInstanceId: null,
    turnMovement: { usedFeet: 0, speedFeet: 30 },
    activeAuthoredEffectIds
  }
}

/** A homebrew focus: no poison while the holder's own trance effect is active. */
function homebrewFocus(): FeatureAuthored {
  const idFor = (part: number, entry: number) =>
    `7e57a000-0000-4000-8${part.toString(16).padStart(3, '0')}-${entry.toString(16).padStart(12, '0')}`
  return {
    id: idFor(0x50, 1),
    label: 'Trance Focus',
    description: 'You cannot be poisoned while your trance lasts.',
    availableAtLevel: 1,
    order: 99,
    grants: {
      modifiers: [
        {
          id: idFor(0x51, 1),
          grantKind: 'MODIFIER_GRANT',
          valueDomainCode: 'CONDITION_IMMUNITY',
          domain: {},
          modifierKind: 'ADD_OPTION',
          scope: 'GLOBAL',
          selectionKind: 'GRANTED',
          payload: { conditionTypeId: conditionTypeId('POISONED') },
          order: 0,
          restrictions: {
            id: idFor(0x52, 0),
            groups: [
              {
                id: idFor(0x52, 1),
                order: 0,
                contexts: [
                  {
                    id: idFor(0x52, 2),
                    order: 0,
                    subject: 'CHARACTER',
                    conditions: [
                      {
                        id: idFor(0x52, 3),
                        order: 0,
                        kind: 'PREDICATE',
                        constraint: 'INCLUDE',
                        predicateCode: 'HOLDER_ACTIVE_EFFECT',
                        effectIds: [HOMEBREW_EFFECT_ID]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      ]
    }
  }
}

function mindlessRageOutput() {
  return evaluateSrdCharacter({
    classes: [{ label: 'Barbarian', level: 6, subclass: 'Path of the Berserker' }],
    features: [
      srdFeature({
        owner: 'SUBCLASS',
        classLabel: 'Barbarian',
        subclassLabel: 'Path of the Berserker',
        featureLabel: 'Mindless Rage',
        level: 6
      })
    ]
  }).output
}

describe('Mindless Rage and Reckless Attack (SPELLS-31.T5f1)', () => {
  // `srdClassNodeMap.test.ts` proves each of these SRD records passes the class node map unchanged.
  it('leaves no closed rule on the SRD Barbarian or Path of the Berserker for either feature', () => {
    for (const record of [barbarian, pathOfTheBerserker]) {
      expect(JSON.stringify(record.features)).not.toMatch(/MINDLESS_RAGE|RECKLESS_ATTACK/)
    }
  })

  it("authors Mindless Rage's suspension clause and Reckless Attack as GM rulings", () => {
    for (const [record, label] of [
      [pathOfTheBerserker, 'Mindless Rage'],
      [barbarian, 'Reckless Attack']
    ] as const) {
      const path = srdByLabel(record.features ?? [], label).effects?.[0]?.paths[0]
      expect(path?.selectionKind === 'FIXED' && path.resultBlock.outcomes[0]).toMatchObject({
        effectKind: 'MANUAL_ADJUDICATION'
      })
    }
  })

  it('keeps a homebrew feature bound to its own effect exactly as authored', async () => {
    const authored = homebrewFocus()
    const result = await normalize({
      ...structuredClone(pathOfTheBerserker),
      features: [...(pathOfTheBerserker.features ?? []), authored]
    })
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual([
      ...(pathOfTheBerserker.features ?? []),
      authored
    ])
  })

  it('makes the Berserker immune to charm and fright from any source only while raging', () => {
    const output = mindlessRageOutput()
    // The Character-wide fold cannot know the holder rages, so the immunities wait for the Encounter.
    expect(output.conditionImmunityIds).toEqual([])
    const raging = encounterSourceConditionImmunities({
      effects: [],
      grantFold: output.grantFold,
      holderState: holderState([RAGE_EFFECT_ID])
    })
    expect(raging.map(({ conditionTypeId: id }) => id).sort()).toEqual(
      [conditionTypeId('CHARMED'), conditionTypeId('FRIGHTENED')].sort()
    )
    for (const { sourceQualifier } of raging) {
      expect(sourceQualifierAdmits(sourceQualifier, { creatureTypeIds: [] })).toBe(true)
      expect(
        sourceQualifierAdmits(sourceQualifier, { creatureTypeIds: [creatureTypeId('FIEND')] })
      ).toBe(true)
    }
    for (const ids of [[], [HOMEBREW_EFFECT_ID]]) {
      expect(
        encounterSourceConditionImmunities({
          effects: [],
          grantFold: output.grantFold,
          holderState: holderState(ids)
        })
      ).toEqual([])
    }
  })

  it('resolves the homebrew feature against its own effect, not Rage', () => {
    const homebrew = homebrewFocus()
    const BARBARIAN = srdByLabel([barbarian], 'Barbarian')
    const { output } = evaluateSrdCharacter({
      classes: [{ label: 'Barbarian', level: 1 }],
      extraFeatures: [homebrew],
      features: [
        {
          acquisitionId: 'acquired:trance-focus',
          featureId: homebrew.id,
          source: { kind: 'CLASS', classId: BARBARIAN.id, classLevel: 1 },
          timing: { kind: 'CLASS_LEVEL', classId: BARBARIAN.id, classLevel: 1 }
        }
      ]
    })
    const immunityIds = (ids: readonly string[]) =>
      encounterSourceConditionImmunities({
        effects: [],
        grantFold: output.grantFold,
        holderState: holderState(ids)
      }).map(({ conditionTypeId: id }) => id)
    expect(immunityIds([HOMEBREW_EFFECT_ID])).toEqual([conditionTypeId('POISONED')])
    expect(immunityIds([RAGE_EFFECT_ID])).toEqual([])
  })
})

/** A homebrew last stand: while its own trance lasts, a DC 8 WIS save (+2 per use) keeps it at 1. */
function homebrewLastStand(): FeatureAuthored {
  const idFor = (part: number, entry: number) =>
    `7e57a000-0000-4000-8${part.toString(16).padStart(3, '0')}-${entry.toString(16).padStart(12, '0')}`
  const focus = homebrewFocus()
  const [immunity] = focus.grants?.modifiers ?? []
  if (!immunity) throw new Error('Expected the homebrew focus grant.')
  return {
    id: idFor(0x60, 1),
    label: 'Trance Last Stand',
    description: 'While your trance lasts, a Wisdom save keeps you standing at 1 hit point.',
    availableAtLevel: 1,
    order: 100,
    charges: {
      id: idFor(0x61, 1),
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'LONG_REST',
      amount: 3
    },
    grants: {
      modifiers: [
        {
          ...immunity,
          id: idFor(0x62, 1),
          valueDomainCode: 'DAMAGE_INTERCEPTION',
          modifierKind: 'ENABLE',
          payload: {
            dropToHitPoints: 1,
            negatesKill: false,
            save: {
              ability: 'WISDOM',
              dc: { base: 8, plusDamageTaken: false, plusPerChargeUsed: 2 },
              spendsUseOnFailure: true
            }
          }
        }
      ]
    }
  }
}

describe('Relentless Rage (SPELLS-31.T5f3)', () => {
  it('leaves no closed rule on the SRD Barbarian for it', () => {
    expect(JSON.stringify(barbarian.features)).not.toMatch(/RELENTLESS_RAGE/)
  })

  it('keeps a homebrew charged interception bound to its own effect exactly as authored', async () => {
    const authored = homebrewLastStand()
    const result = await normalize({
      ...structuredClone(barbarian),
      features: [...(barbarian.features ?? []), authored]
    })
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual([
      ...(barbarian.features ?? []),
      authored
    ])
  })

  it('holds the SRD and the homebrew interception the same way, each on its own effect', () => {
    const homebrew = homebrewLastStand()
    const BARBARIAN = srdByLabel([barbarian], 'Barbarian')
    const { output } = evaluateSrdCharacter({
      classes: [{ label: 'Barbarian', level: 11 }],
      resourceUsage: [],
      extraFeatures: [homebrew],
      features: [
        srdFeature({
          owner: 'CLASS',
          classLabel: 'Barbarian',
          featureLabel: 'Relentless Rage',
          level: 11
        }),
        {
          acquisitionId: 'acquired:trance-last-stand',
          featureId: homebrew.id,
          source: { kind: 'CLASS', classId: BARBARIAN.id, classLevel: 1 },
          timing: { kind: 'CLASS_LEVEL', classId: BARBARIAN.id, classLevel: 1 }
        }
      ]
    })
    const relentlessRage = srdByLabel(barbarian.features ?? [], 'Relentless Rage')
    const held = (ids: readonly string[]) =>
      characterHeldDamageInterceptions(output, ids).map(({ effectId, save, charge }) => ({
        effectId,
        dc: save?.dc,
        amount: charge?.amount
      }))
    expect(held([RAGE_EFFECT_ID])).toEqual([
      {
        effectId: relentlessRage.id,
        dc: { base: 10, plusDamageTaken: false, plusPerChargeUsed: 5 },
        amount: 6
      }
    ])
    expect(held([HOMEBREW_EFFECT_ID])).toEqual([
      {
        effectId: homebrew.id,
        dc: { base: 8, plusDamageTaken: false, plusPerChargeUsed: 2 },
        amount: 3
      }
    ])
    expect(held([])).toEqual([])
  })
})
