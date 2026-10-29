import { describe, expect, it } from 'vitest'

import { discoverCharacterActionCapabilities } from '@artificer-toolkit/rules-runtime/characterActionCapabilityDiscovery'
import { compileCharacterActionEntryPoints } from '@artificer-toolkit/rules-runtime/encounterActionEntryPointCompiler'
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
import { draconicBloodlineOrigin } from '@artificer-toolkit/source-data/srd/classes/draconic-bloodline.js'
import { ranger } from '@artificer-toolkit/source-data/srd/classes/ranger.js'
import { theFiend } from '@artificer-toolkit/source-data/srd/classes/the-fiend.js'
import { warlock } from '@artificer-toolkit/source-data/srd/classes/warlock.js'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES,
  SRD_SYSTEM_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'

/**
 * SPELLS-31.T5k (D156, D187a): Fiendish Resilience is authored from core options. A use picks a
 * damage type, ends what the same Effect granted before (a SAME_EFFECT END_EFFECTS) and grants a
 * resistance until dispelled. A homebrew ward authored the same way passes the class node map
 * unchanged and compiles the same way. Favored Enemy, Foe Slayer and Dragon Ancestor's
 * dragon-dealing rider stay in their descriptions as GM rulings.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)
const FIENDISH_RESILIENCE = srdByLabel(theFiend.features ?? [], 'Fiendish Resilience')
const WARD_EFFECT_ID = '7e57a000-0000-4000-8000-0000000005c1'
const WARD_TYPES = SRD_DAMAGE_TYPES.filter(({ code }) => code === 'FIRE' || code === 'COLD')

function normalize(record: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(record) as unknown as Record<string, unknown>
  })
}

/** A homebrew ward: once between rests, resistance to fire or cold until it is used again. */
function homebrewWard(): FeatureAuthored {
  const idFor = (part: number, entry: number) =>
    `7e57a000-0000-4000-8${part.toString(16).padStart(3, '0')}-${entry.toString(16).padStart(12, '0')}`
  return {
    id: idFor(0xc0, 1),
    label: 'Elemental Ward',
    description: 'Choose fire or cold: you resist it until you choose again.',
    availableAtLevel: 1,
    order: 99,
    attributes: ['LIMITED_USE'],
    charges: {
      id: idFor(0xc1, 1),
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'LONG_REST',
      amount: 1
    },
    effects: [
      {
        id: WARD_EFFECT_ID,
        order: 1,
        invocation: {
          kind: 'ACTION',
          triggerCode: 'ACTIVATED',
          resourceUse: { chargeId: idFor(0xc1, 1), cost: 1 },
          activation: { code: 'BONUS_ACTION', amount: 1 },
          range: { id: idFor(0xc2, 1), rangeKind: 'SELF' },
          targeting: { selectionKind: 'SELF' }
        },
        paths: [
          {
            id: idFor(0xc3, 1),
            order: 1,
            pathCode: 'ON_USE',
            groupType: 'CHOICE',
            originKind: 'SOURCE',
            selectionKind: 'CHOICE',
            options: WARD_TYPES.map(({ id: damageTypeId, label }, index) => ({
              id: idFor(0xc4, index + 1),
              order: index + 1,
              label,
              description: `Resistance to ${label.toLowerCase()} damage.`,
              resultBlock: {
                id: idFor(0xc5, index + 1),
                resultKind: 'SEQUENCE',
                duration: { id: idFor(0xc6, index + 1), durationKind: 'UNTIL_DISPELLED' },
                outcomes: [
                  {
                    id: idFor(0xc7, index + 1),
                    effectKind: 'END_EFFECTS',
                    scope: 'ALL',
                    selectors: [{ kind: 'SAME_EFFECT' }]
                  },
                  {
                    id: idFor(0xc8, index + 1),
                    effectKind: 'APPLY_GRANT',
                    grants: {
                      modifiers: [
                        {
                          id: idFor(0xc9, index + 1),
                          grantKind: 'MODIFIER_GRANT',
                          valueDomainCode: 'DAMAGE_RESISTANCE',
                          domain: {},
                          modifierKind: 'ADD_OPTION',
                          scope: 'GLOBAL',
                          selectionKind: 'GRANTED',
                          payload: { damageTypeId },
                          order: 1
                        }
                      ]
                    }
                  }
                ]
              }
            }))
          }
        ]
      }
    ]
  }
}

/** The compiled options of the Warlock's `effectId` action: each pick's label and grant plan. */
function compiledOptions(homebrew: FeatureAuthored, effectId: string) {
  const WARLOCK = srdByLabel([warlock], 'Warlock')
  const character = evaluateSrdCharacter({
    classes: [{ label: 'Warlock', level: 10, subclass: 'The Fiend' }],
    extraFeatures: [homebrew],
    features: [
      srdFeature({
        owner: 'SUBCLASS',
        classLabel: 'Warlock',
        subclassLabel: 'The Fiend',
        featureLabel: 'Fiendish Resilience',
        level: 10
      }),
      {
        acquisitionId: 'acquired:elemental-ward',
        featureId: homebrew.id,
        source: { kind: 'CLASS', classId: WARLOCK.id, classLevel: 1 },
        timing: { kind: 'CLASS_LEVEL', classId: WARLOCK.id, classLevel: 1 }
      }
    ]
  })
  const candidates = character.facts.actionCandidates
  const entries = compileCharacterActionEntryPoints({
    gameSystemId: SRD_SYSTEM_ID,
    candidates,
    descriptors: discoverCharacterActionCapabilities({
      gameSystemId: SRD_SYSTEM_ID,
      candidates,
      conditionDefinitionIds: SRD_CONDITION_TYPES.map((condition) => condition.id).sort(),
      abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
      entryPoints: character.entryPoints
    })
  })
  const index = candidates.findIndex((candidate) => candidate.effectId === effectId)
  const entry = entries[index]
  if (entry?.kind !== 'CHARACTER_ACTION' || entry.compilation.kind !== 'COMPILED')
    throw new Error(`Expected ${effectId} to compile.`)
  const endEffects = candidates[index]?.mechanicFacts.outcomes.flatMap((outcome) =>
    'endEffects' in outcome && outcome.endEffects ? [outcome.endEffects] : []
  )
  return {
    endEffects,
    options: (entry.compilation.choice?.options ?? []).map(({ label, activeEffectPlan }) => ({
      label,
      initialRemaining: activeEffectPlan?.initialRemaining,
      recurrenceStage: activeEffectPlan?.recurrenceStage,
      resistances: activeEffectPlan?.modifierGrantContribution?.modifiers.map(
        ({ valueDomainCode, payload }) => ({ valueDomainCode, payload })
      )
    }))
  }
}

describe('feature choices and their rulings (SPELLS-31.T5k)', () => {
  it('no longer lists the four closed rule kinds', () => {
    for (const kind of [
      'CLASS_RANGER_FAVORED_ENEMY',
      'CLASS_RANGER_FOE_SLAYER',
      'CLASS_DRACONIC_BLOODLINE_DRAGON_ANCESTOR',
      'CLASS_FIEND_FIENDISH_RESILIENCE'
    ])
      expect(CLOSED_RULE_KIND).not.toHaveProperty(kind)
  })

  it('leaves Favored Enemy, Foe Slayer and Dragon Ancestor to their descriptions', () => {
    for (const [record, label] of [
      [ranger, 'Favored Enemy'],
      [ranger, 'Foe Slayer'],
      [draconicBloodlineOrigin, 'Dragon Ancestor']
    ] as const)
      expect(srdByLabel(record.features ?? [], label).effects ?? []).toEqual([])
    // The ancestor itself is the specialization the Builder stores.
    expect(draconicBloodlineOrigin.specializations?.map(({ label }) => label)).toContain(
      'Red Dragon'
    )
  })

  it('keeps a homebrew ward exactly as authored through the class node map', async () => {
    const authored = homebrewWard()
    const result = await normalize({
      ...structuredClone(theFiend),
      features: [...(theFiend.features ?? []), authored]
    })
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual([
      ...(theFiend.features ?? []),
      authored
    ])
  })

  it('compiles the SRD and the homebrew the same way, each replacing only its own grant', () => {
    const homebrew = homebrewWard()
    const fiendishId = FIENDISH_RESILIENCE.effects?.[0]?.id ?? ''
    for (const [effectId, labels, bypassedBy] of [
      [fiendishId, SRD_DAMAGE_TYPES.map(({ label }) => label), ['MAGICAL', 'SILVERED']],
      [WARD_EFFECT_ID, WARD_TYPES.map(({ label }) => label), undefined]
    ] as const) {
      const { endEffects, options } = compiledOptions(homebrew, effectId)
      expect(endEffects).toEqual([{ scope: 'ALL', selectors: [{ kind: 'SAME_EFFECT', effectId }] }])
      expect(options).toEqual(
        labels.map((label) => ({
          label,
          initialRemaining: null,
          recurrenceStage: 'NONE',
          resistances: [
            {
              valueDomainCode: 'DAMAGE_RESISTANCE',
              payload: {
                damageTypeId: SRD_DAMAGE_TYPES.find((each) => each.label === label)!.id,
                ...(bypassedBy && { bypassedBy })
              }
            }
          ]
        }))
      )
    }
  })
})
