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
import { schoolOfEvocation } from '@artificer-toolkit/source-data/srd/classes/school-of-evocation.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'

/**
 * SPELLS-31.T5i4 (D156, D187a): Potent Cantrip is authored from core options, a spell DAMAGE
 * modifier that gives a save spell's damage a success path at half, scoped to cantrips by a spell
 * level facet. A homebrew feature authored the same way, scoped by a school instead, passes the
 * class node map unchanged and resolves the same way.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)
const GRACE_ID = '7e57a000-0000-4000-8000-0000000005d3'

function normalize(record: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(record) as unknown as Record<string, unknown>
  })
}

/** A homebrew grace: your spells of one school deal half their damage, not none, to a creature that saves. */
function homebrewGrace(): FeatureAuthored {
  const idFor = (part: number) =>
    `7e57a000-0000-4000-8${part.toString(16).padStart(3, '0')}-000000000003`
  return {
    id: GRACE_ID,
    label: 'Evoker Grace',
    description: 'Your evocation spells deal half their damage to a creature that saves.',
    availableAtLevel: 1,
    order: 99,
    grants: {
      modifiers: [
        {
          id: idFor(0xe0),
          grantKind: 'MODIFIER_GRANT',
          valueDomainCode: 'DAMAGE',
          domain: { attackDomain: 'SPELL' },
          modifierKind: 'SAVE_SUCCESS_DAMAGE',
          scope: 'GLOBAL',
          selectionKind: 'GRANTED',
          payload: { amountKind: 'HALF' },
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
                        magicSchoolIds: [srdByLabel(srdSpells, 'Sacred Flame').magicSchoolId]
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

/** Each named SRD spell's damage rolls as the Character casts it, by path. */
function spellDamage(character: SrdCharacter, labels: readonly string[]) {
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
      output.spellReferenceMechanics
        .find((entry) => entry.spellId === id)!
        .mechanics[0]!.outcomes.flatMap((outcome) =>
          outcome.kind === 'DAMAGE' ? [`${outcome.pathCode} ${outcome.expression}`] : []
        )
    ])
  )
}

describe('save-success damage modifiers (SPELLS-31.T5i4)', () => {
  it('no longer lists the closed rule kind', () => {
    expect(CLOSED_RULE_KIND).not.toHaveProperty('CLASS_SCHOOL_OF_EVOCATION_POTENT_CANTRIP')
  })

  it('keeps the SRD record and a homebrew grace exactly as authored through the class node map', async () => {
    const withGrace: ClassAuthored = {
      ...structuredClone(schoolOfEvocation),
      features: [...(schoolOfEvocation.features ?? []), homebrewGrace()]
    }
    for (const record of [schoolOfEvocation, withGrace]) {
      const result = await normalize(record)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(record.features)
    }
  })

  it('halves a cantrip’s damage on a success, and leaves leveled spells and attack cantrips alone', () => {
    const character = evaluateSrdCharacter({
      classes: [{ label: 'Wizard', level: 6, subclass: 'School of Evocation' }],
      features: [
        srdFeature({
          owner: 'SUBCLASS',
          classLabel: 'Wizard',
          subclassLabel: 'School of Evocation',
          featureLabel: 'Potent Cantrip',
          level: 6
        })
      ]
    })
    expect(spellDamage(character, ['Acid Splash', 'Fire Bolt', 'Fireball'])).toEqual({
      'Acid Splash': ['ON_SAVE_FAIL 2d6', 'ON_SAVE_SUCCESS half of 2d6'],
      'Fire Bolt': ['ON_HIT 2d10'],
      Fireball: ['ON_SAVE_FAIL 8d6', 'ON_SAVE_SUCCESS half of 8d6']
    })
  })

  it('adds nothing without the feature', () => {
    const character = evaluateSrdCharacter({
      classes: [{ label: 'Wizard', level: 6, subclass: 'School of Evocation' }]
    })
    expect(spellDamage(character, ['Acid Splash'])).toEqual({
      'Acid Splash': ['ON_SAVE_FAIL 2d6']
    })
  })

  it('gives a homebrew grace to its school’s spells only', () => {
    const grace = homebrewGrace()
    const wizard = srdByLabel(SRD.classes, 'Wizard')
    const character = evaluateSrdCharacter({
      classes: [{ label: 'Wizard', level: 1 }],
      extraFeatures: [grace],
      features: [
        {
          acquisitionId: 'acquired:evoker-grace',
          featureId: grace.id,
          source: { kind: 'CLASS', classId: wizard.id, classLevel: 1 },
          timing: { kind: 'CLASS_LEVEL', classId: wizard.id, classLevel: 1 }
        }
      ]
    })
    expect(spellDamage(character, ['Sacred Flame', 'Acid Splash'])).toEqual({
      'Sacred Flame': ['ON_SAVE_FAIL 1d8', 'ON_SAVE_SUCCESS half of 1d8'],
      'Acid Splash': ['ON_SAVE_FAIL 1d6']
    })
  })
})
