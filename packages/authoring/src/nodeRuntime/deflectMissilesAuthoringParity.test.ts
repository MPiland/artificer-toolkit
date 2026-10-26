import { describe, expect, it } from 'vitest'

import { incomingDamageProfile } from '@artificer-toolkit/rules-runtime/encounterActiveGrants'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { CLASS_IDS } from '@artificer-toolkit/source-data/srd/ids.js'
import { incomingDamageReactionEffect } from '@artificer-toolkit/source-data/srd/classes/mechanics.js'
import { monk } from '@artificer-toolkit/source-data/srd/classes/monk.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'

/**
 * SPELLS-31.T5b (D156): Deflect Missiles is a reaction to a ranged weapon attack that grants an
 * `INCOMING_DAMAGE` reduction of a die plus holder bonuses, core options a Builder author has on a
 * feature. Slow Fall is a GM ruling until the engine deals falling damage. A homebrew reduction for
 * another die and bonus passes the class node map unchanged and folds the same way.
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

/** A homebrew reaction to any melee hit that shrugs off 2d6 + twice the proficiency bonus. */
function ironHide(): FeatureAuthored {
  return {
    id: idFor(0x60, 1),
    label: 'Iron Hide',
    description: 'When a melee attack hits you, reduce its damage by 2d6 + twice your proficiency.',
    availableAtLevel: 1,
    order: 99,
    effects: [
      incomingDamageReactionEffect(
        {
          effect: idFor(0x61, 1),
          range: idFor(0x61, 2),
          path: idFor(0x61, 3),
          duration: idFor(0x61, 4),
          outcome: idFor(0x61, 5),
          grant: idFor(0x61, 6)
        },
        {
          trigger: { kind: 'ATTACKED_SELF', attackRange: 'MELEE' },
          payload: {
            incomingDamageKind: 'REDUCE',
            count: 2,
            faces: 6,
            bonuses: [
              { id: idFor(0x62, 1), bonusKind: 'PROFICIENCY_BONUS', multiplier: 2, order: 1 }
            ]
          }
        }
      )
    ]
  }
}

const featureNamed = (label: string) => {
  const feature = monk.features?.find((entry) => entry.label === label)
  if (!feature) throw new Error(`The SRD Monk must author ${label}.`)
  return feature
}

/** The INCOMING_DAMAGE modifiers a feature's reaction grants when it is used. */
const grantedModifiers = (feature: FeatureAuthored) =>
  (feature.effects ?? []).flatMap((effect) =>
    effect.paths.flatMap((path) =>
      path.selectionKind === 'FIXED'
        ? path.resultBlock.outcomes.flatMap((outcome) =>
            outcome.effectKind === 'APPLY_GRANT' ? (outcome.grants.modifiers ?? []) : []
          )
        : []
    )
  )

/** A 6th-level Monk with Dexterity +3 and proficiency +3. */
const sixthLevelMonk = {
  abilityModifier: (ability: string) => (ability === 'DEXTERITY' ? 3 : 0),
  proficiencyBonus: 3,
  classLevel: (classId: string) => (classId === CLASS_IDS.MONK ? 6 : 0)
}

describe('Deflect Missiles and Slow Fall (SPELLS-31.T5b)', () => {
  // `srdClassNodeMap.test.ts` proves the SRD Monk passes the class node map unchanged.
  it('leaves no closed rule for either on the SRD Monk', () => {
    expect(JSON.stringify(monk.features)).not.toMatch(/DEFLECT_MISSILES|SLOW_FALL/)
  })

  it('keeps a homebrew reduction reaction exactly as authored', async () => {
    const authored = [ironHide()]
    const result = await normalize({
      ...structuredClone(monk),
      features: [...(monk.features ?? []), ...authored]
    })
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual([
      ...(monk.features ?? []),
      ...authored
    ])
  })

  it('answers only a ranged weapon attack with Deflect Missiles', () => {
    const [effect] = featureNamed('Deflect Missiles').effects ?? []
    expect(effect?.invocation).toMatchObject({
      activation: { code: 'REACTION' },
      reactionTrigger: { kind: 'ATTACKED_SELF', attackRange: 'RANGED', weaponOnly: true }
    })
  })

  it('folds Deflect Missiles to 1d10 + Dexterity modifier + monk level', () => {
    expect(
      incomingDamageProfile(grantedModifiers(featureNamed('Deflect Missiles')), sixthLevelMonk)
    ).toEqual({
      halved: false,
      saveForHalf: [],
      reductions: [{ die: { count: 1, faces: 10 }, flat: 9 }]
    })
  })

  it('folds the homebrew reduction for its own dice and bonus', () => {
    expect(incomingDamageProfile(grantedModifiers(ironHide()), sixthLevelMonk)).toEqual({
      halved: false,
      saveForHalf: [],
      reductions: [{ die: { count: 2, faces: 6 }, flat: 6 }]
    })
  })

  it('makes Slow Fall a reaction the GM rules on', () => {
    const [effect] = featureNamed('Slow Fall').effects ?? []
    expect(effect?.invocation).toMatchObject({ activation: { code: 'REACTION' } })
    expect(effect?.paths).toMatchObject([
      { resultBlock: { outcomes: [{ effectKind: 'MANUAL_ADJUDICATION', label: 'Slow Fall' }] } }
    ])
  })
})
