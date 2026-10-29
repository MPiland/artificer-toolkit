import { describe, expect, it } from 'vitest'

import { discoverCharacterActionCapabilities } from '@artificer-toolkit/rules-runtime/characterActionCapabilityDiscovery'
import { buildCharacterSpellActionRuleFacts } from '@artificer-toolkit/rules-runtime/character/characterSpellActionRuleFacts'
import { compileCharacterActionEntryPoints } from '@artificer-toolkit/rules-runtime/encounterActionEntryPointCompiler'
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
import { draconicBloodlineOrigin } from '@artificer-toolkit/source-data/srd/classes/draconic-bloodline.js'
import { schoolOfEvocation } from '@artificer-toolkit/source-data/srd/classes/school-of-evocation.js'
import { sorceryPointsCharge } from '@artificer-toolkit/source-data/srd/classes/sorcerer.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import {
  ABILITY_CODE,
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES,
  SRD_SYSTEM_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'

/**
 * SPELLS-31.T5i1 (D156, D187a): Empowered Evocation and Elemental Affinity are authored from core
 * options. Each is a spell DAMAGE modifier whose SPELL restriction names a school or a damage type
 * (Elemental Affinity per ancestry, through the stored specialization), and Elemental Affinity's
 * resistance is a sorcery-point action. A homebrew bonus authored the same way passes the class
 * node map unchanged and resolves the same way.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)
const damageTypeId = (code: string) => SRD_DAMAGE_TYPES.find((entry) => entry.code === code)!.id
const COLD_FOCUS_ID = '7e57a000-0000-4000-8000-0000000005d1'

function normalize(record: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(record) as unknown as Record<string, unknown>
  })
}

/** A homebrew focus: your Constitution modifier on cold damage of leveled spells. */
function homebrewColdFocus(): FeatureAuthored {
  const idFor = (part: number) =>
    `7e57a000-0000-4000-8${part.toString(16).padStart(3, '0')}-000000000001`
  return {
    id: COLD_FOCUS_ID,
    label: 'Cold Focus',
    description: 'Add your Constitution modifier to the cold damage of your leveled spells.',
    availableAtLevel: 1,
    order: 99,
    grants: {
      modifiers: [
        {
          id: idFor(0xd0),
          grantKind: 'MODIFIER_GRANT',
          valueDomainCode: 'DAMAGE',
          domain: { attackDomain: 'SPELL' },
          modifierKind: 'ABILITY_MODIFIER_BONUS',
          scope: 'GLOBAL',
          selectionKind: 'GRANTED',
          payload: { ability: ABILITY_CODE.CONSTITUTION },
          order: 0,
          restrictions: {
            id: idFor(0xd1),
            groups: [
              {
                id: idFor(0xd2),
                order: 0,
                contexts: [
                  {
                    id: idFor(0xd3),
                    order: 0,
                    subject: 'SPELL',
                    authoringModeKind: 'ALL',
                    conditions: [
                      {
                        id: idFor(0xd4),
                        order: 0,
                        kind: 'PREDICATE',
                        constraint: 'INCLUDE',
                        predicateCode: 'DAMAGE_TYPE',
                        authoringModeKind: 'SELECTED',
                        damageTypeIds: [damageTypeId('COLD')]
                      },
                      {
                        id: idFor(0xd5),
                        order: 1,
                        kind: 'PREDICATE',
                        constraint: 'INCLUDE',
                        predicateCode: 'SPELL_LEVEL',
                        min: 1
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

describe('spell-scoped damage modifiers (SPELLS-31.T5i1)', () => {
  it('no longer lists the two closed rule kinds', () => {
    for (const kind of [
      'CLASS_SCHOOL_OF_EVOCATION_EMPOWERED_EVOCATION',
      'CLASS_DRACONIC_BLOODLINE_ELEMENTAL_AFFINITY'
    ])
      expect(CLOSED_RULE_KIND).not.toHaveProperty(kind)
  })

  it('keeps the SRD records and a homebrew focus exactly as authored through the class node map', async () => {
    const withFocus: ClassAuthored = {
      ...structuredClone(schoolOfEvocation),
      features: [...(schoolOfEvocation.features ?? []), homebrewColdFocus()]
    }
    for (const record of [schoolOfEvocation, draconicBloodlineOrigin, withFocus]) {
      const result = await normalize(record)
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(record.features)
    }
  })

  it('adds Intelligence to evocation spells and the homebrew focus to leveled cold spells', () => {
    const focus = homebrewColdFocus()
    const character = evaluateSrdCharacter({
      abilities: { INTELLIGENCE: 18, CONSTITUTION: 14 },
      classes: [{ label: 'Wizard', level: 10, subclass: 'School of Evocation' }],
      extraFeatures: [focus],
      features: [
        srdFeature({
          owner: 'SUBCLASS',
          classLabel: 'Wizard',
          subclassLabel: 'School of Evocation',
          featureLabel: 'Empowered Evocation',
          level: 10
        }),
        {
          acquisitionId: 'acquired:cold-focus',
          featureId: focus.id,
          source: {
            kind: 'SUBCLASS',
            subclassId: schoolOfEvocation.id,
            classLevel: 1
          },
          timing: {
            kind: 'CLASS_LEVEL',
            classId: srdByLabel(SRD.classes, 'Wizard').id,
            classLevel: 1
          }
        }
      ]
    })
    expect(
      spellDamage(character, [
        'Fireball',
        'Fire Bolt',
        'Cone of Cold',
        'Ray of Frost',
        'Acid Splash'
      ])
    ).toEqual({
      // A save spell gets it too, and a success halves it with the rest.
      Fireball: ['ON_SAVE_FAIL 8d6 + 4', 'ON_SAVE_SUCCESS half of 8d6 + 4'],
      'Fire Bolt': ['ON_HIT 2d10 + 4'],
      'Cone of Cold': ['ON_SAVE_FAIL 8d8 + 6', 'ON_SAVE_SUCCESS half of 8d8 + 6'],
      // An evocation cantrip: Intelligence, but not the focus, which needs a leveled spell.
      'Ray of Frost': ['ON_HIT 2d8 + 4'],
      // Conjuration: neither.
      'Acid Splash': ['ON_SAVE_FAIL 2d6']
    })
  })

  it('adds Charisma to spells of the ancestry type and buys a resistance with a sorcery point', () => {
    const character = evaluateSrdCharacter({
      abilities: { CHARISMA: 16 },
      classes: [
        {
          label: 'Sorcerer',
          level: 6,
          subclass: 'Draconic Bloodline',
          specialization: 'Red Dragon'
        }
      ],
      resourceUsage: [],
      features: [
        srdFeature({
          owner: 'SUBCLASS',
          classLabel: 'Sorcerer',
          subclassLabel: 'Draconic Bloodline',
          featureLabel: 'Elemental Affinity',
          level: 6
        })
      ]
    })
    expect(spellDamage(character, ['Fire Bolt', 'Ray of Frost', 'Fireball'])).toEqual({
      'Fire Bolt': ['ON_HIT 2d10 + 3'],
      'Ray of Frost': ['ON_HIT 2d8'],
      Fireball: ['ON_SAVE_FAIL 8d6 + 3', 'ON_SAVE_SUCCESS half of 8d6 + 3']
    })

    const affinityEffectId =
      srdByLabel(draconicBloodlineOrigin.features ?? [], 'Elemental Affinity').effects?.[0]?.id ??
      ''
    const candidates = character.facts.actionCandidates
    const index = candidates.findIndex((candidate) => candidate.effectId === affinityEffectId)
    const sorceryPoints = character.facts.resourcePoolCandidates.find(
      (pool) => pool.chargeId === sorceryPointsCharge.id
    )
    expect(candidates[index]?.resourceUse).toEqual({
      chargeId: sorceryPointsCharge.id,
      cost: 1,
      poolId: sorceryPoints?.poolId
    })
    const entry = compileCharacterActionEntryPoints({
      gameSystemId: SRD_SYSTEM_ID,
      candidates,
      descriptors: discoverCharacterActionCapabilities({
        gameSystemId: SRD_SYSTEM_ID,
        candidates,
        conditionDefinitionIds: SRD_CONDITION_TYPES.map((condition) => condition.id).sort(),
        abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
        entryPoints: character.entryPoints
      })
    })[index]
    if (entry?.kind !== 'CHARACTER_ACTION' || entry.compilation.kind !== 'COMPILED')
      throw new Error('Expected Elemental Affinity to compile.')
    // Every ancestry type is offered; matching your ancestry is the GM's call (DOC rider).
    expect(
      (entry.compilation.choice?.options ?? []).map(({ label, activeEffectPlan }) => ({
        label,
        resistances: activeEffectPlan?.modifierGrantContribution?.modifiers.map(
          ({ valueDomainCode, payload }) => ({ valueDomainCode, payload })
        )
      }))
    ).toEqual(
      ['ACID', 'COLD', 'FIRE', 'LIGHTNING', 'POISON'].map((code) => ({
        label: SRD_DAMAGE_TYPES.find((each) => each.code === code)!.label,
        resistances: [
          { valueDomainCode: 'DAMAGE_RESISTANCE', payload: { damageTypeId: damageTypeId(code) } }
        ]
      }))
    )
  })
})
