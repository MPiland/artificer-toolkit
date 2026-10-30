import { describe, expect, it } from 'vitest'

import { buildCharacterSpellActionRuleFacts } from '@artificer-toolkit/rules-runtime/character/characterSpellActionRuleFacts'
import { evaluateDnd5e2014CharacterPolicy } from '@artificer-toolkit/rules-runtime/systems/dnd5e/characterPolicy'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import {
  evaluateSrdCharacter,
  SRD,
  srdByLabel,
  srdFeature,
  type SrdCharacter
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileSpell } from '@artificer-toolkit/shared/subjects/compilers'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'

/**
 * SPELLS-31.T5i3 (D156, D187a): Eldritch Spear is authored from core options, a RANGE modifier whose
 * SPELL restriction names its spell. A homebrew feature authored the same way, scoped by a school
 * instead, passes the class node map unchanged and resolves the same way.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)
const warlock = srdByLabel(SRD.classes, 'Warlock')
const LONG_REACH_ID = '7e57a000-0000-4000-8000-0000000005d2'

function normalize(record: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(record) as unknown as Record<string, unknown>
  })
}

/** A homebrew reach: your necromancy spells have a range of 60 feet. */
function homebrewLongReach(): FeatureAuthored {
  const idFor = (part: number) =>
    `7e57a000-0000-4000-8${part.toString(16).padStart(3, '0')}-000000000002`
  return {
    id: LONG_REACH_ID,
    label: 'Long Reach',
    description: 'Your necromancy spells have a range of 60 feet.',
    availableAtLevel: 1,
    order: 99,
    grants: {
      modifiers: [
        {
          id: idFor(0xe0),
          grantKind: 'MODIFIER_GRANT',
          valueDomainCode: 'RANGE',
          domain: {},
          modifierKind: 'REPLACE_RANGE_KIND',
          scope: 'GLOBAL',
          selectionKind: 'GRANTED',
          payload: { rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' },
          order: 0,
          restrictions: {
            id: idFor(0xe1),
            groups: [
              {
                id: idFor(0xe2),
                order: 0,
                contexts: [
                  {
                    id: idFor(0xe3),
                    order: 0,
                    subject: 'SPELL',
                    authoringModeKind: 'ALL',
                    conditions: [
                      {
                        id: idFor(0xe4),
                        order: 0,
                        kind: 'PREDICATE',
                        constraint: 'INCLUDE',
                        predicateCode: 'MAGIC_SCHOOL',
                        authoringModeKind: 'SELECTED',
                        magicSchoolIds: [srdByLabel(srdSpells, 'Chill Touch').magicSchoolId]
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

/** Each named SRD spell's range label as the Character casts it. */
function spellRanges(character: SrdCharacter, labels: readonly string[]) {
  const spells = labels.map((label) => srdByLabel(srdSpells, label))
  const output = evaluateDnd5e2014CharacterPolicy({
    ...character.facts,
    ...buildCharacterSpellActionRuleFacts({
      spellIds: spells.map(({ id }) => id),
      spells: spells.map(compileSpell)
    })
  })
  return Object.fromEntries(
    spells.map(({ id, label }) => [
      label,
      output.spellReferenceMechanics.find((entry) => entry.spellId === id)!.mechanics[0]!.rangeLabel
    ])
  )
}

const warlockWith = (optionLabels: readonly string[]) =>
  evaluateSrdCharacter({
    classes: [{ label: 'Warlock', level: 2 }],
    obtainedSpellIds: [srdByLabel(srdSpells, 'Eldritch Blast').id],
    features: [
      srdFeature({
        owner: 'CLASS',
        classLabel: 'Warlock',
        featureLabel: 'Eldritch Invocations',
        level: 2,
        optionLabels
      })
    ]
  })

describe('spell range modifiers (SPELLS-31.T5i3)', () => {
  it('no longer lists the closed rule kind', () => {
    expect(CLOSED_RULE_KIND).not.toHaveProperty('CLASS_WARLOCK_ELDRITCH_SPEAR')
  })

  it('keeps the SRD record and a homebrew reach exactly as authored through the class node map', async () => {
    const withReach: ClassAuthored = {
      ...structuredClone(warlock),
      features: [...(warlock.features ?? []), homebrewLongReach()]
    }
    for (const record of [warlock, withReach]) {
      const result = await normalize(record)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(record.features)
    }
  })

  it('reaches 300 feet with the named spell alone', () => {
    expect(spellRanges(warlockWith(['Eldritch Spear']), ['Eldritch Blast', 'Fire Bolt'])).toEqual({
      'Eldritch Blast': '300 ft',
      'Fire Bolt': '120 ft'
    })
  })

  it('leaves the spell at its authored range without the option', () => {
    expect(spellRanges(warlockWith([]), ['Eldritch Blast'])).toEqual({
      'Eldritch Blast': '120 ft'
    })
  })

  it('replaces the range of a homebrew reach by school, not by spell', () => {
    const reach = homebrewLongReach()
    const source = { kind: 'CLASS', classId: warlock.id, classLevel: 1 } as const
    const character = evaluateSrdCharacter({
      classes: [{ label: 'Warlock', level: 1 }],
      extraFeatures: [reach],
      features: [
        {
          acquisitionId: 'acquired:long-reach',
          featureId: reach.id,
          source,
          timing: { kind: 'CLASS_LEVEL', classId: warlock.id, classLevel: 1 }
        }
      ]
    })
    expect(spellRanges(character, ['Chill Touch', 'Fire Bolt'])).toEqual({
      'Chill Touch': '60 ft',
      'Fire Bolt': '120 ft'
    })
  })
})
