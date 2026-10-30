import { describe, expect, it } from 'vitest'

import { characterHeldDamageInterceptions } from '@artificer-toolkit/rules-runtime/encounterDamageInterception'
import { dnd5eAttackCriticalRules } from '@artificer-toolkit/rules-runtime/systems/dnd5e/characterCriticalRules'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import { dnd5eCharacterActionTarget } from '@artificer-toolkit/rules-runtime/systems/dnd5e/modifierApplicability'
import {
  evaluateSrdCharacter,
  itemAction,
  srdByLabel
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { RaceAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { halfOrc } from '@artificer-toolkit/source-data/srd/races/half-orc.js'
import { halfling } from '@artificer-toolkit/source-data/srd/races/halfling.js'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'

/**
 * SPELLS-32.T5 (D156): Halfling Lucky, Relentless Endurance and Savage Attacks are authored from the
 * core options a race author has. Relentless Endurance is an unbound DAMAGE_INTERCEPTION spending
 * the feature's long-rest charge, Savage Attacks a melee CRITICAL_EXTRA_DICE bonus, and Lucky's
 * reroll a GM ruling until the d20 result reroll window exists (future-enhancements). A homebrew
 * race feature with a different charge and attack domain passes the race node map unchanged and
 * resolves through the same paths.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(record: RaceAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'race',
    systemId: srdSystemRecord.id,
    values: structuredClone(record) as unknown as Record<string, unknown>
  })
}

/** A homebrew race trait: twice per short rest it stays at 1, and its ranged crits add a die. */
function homebrewTenacity(): FeatureAuthored {
  const idFor = (part: number, entry: number) =>
    `7e57a000-0000-4000-8${part.toString(16).padStart(3, '0')}-${entry.toString(16).padStart(12, '0')}`
  return {
    id: idFor(0x80, 1),
    label: 'Hunter Tenacity',
    description: 'Twice per short rest you stay at 1 hit point, and your ranged crits hit harder.',
    availableAtLevel: 1,
    order: 99,
    charges: {
      id: idFor(0x81, 1),
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'SHORT_REST',
      amount: 2
    },
    grants: {
      modifiers: [
        {
          id: idFor(0x82, 1),
          grantKind: 'MODIFIER_GRANT',
          valueDomainCode: 'DAMAGE_INTERCEPTION',
          domain: {},
          modifierKind: 'ENABLE',
          scope: 'GLOBAL',
          selectionKind: 'GRANTED',
          payload: { dropToHitPoints: 1, negatesKill: false },
          order: 0
        },
        {
          id: idFor(0x82, 2),
          grantKind: 'MODIFIER_GRANT',
          valueDomainCode: 'CRITICAL_EXTRA_DICE',
          domain: { attackDomain: 'RANGED' },
          modifierKind: 'BONUS',
          scope: 'GLOBAL',
          selectionKind: 'GRANTED',
          payload: { valueKind: 'FIXED', amount: 1 },
          order: 1
        }
      ]
    }
  }
}

/** A Fighter, Half-Orc or else a Human acquiring the homebrew trait, holding item if given. */
function fighter(input: { homebrew?: FeatureAuthored; item?: string }) {
  const { homebrew } = input
  return evaluateSrdCharacter({
    abilities: { STRENGTH: 16, DEXTERITY: 16 },
    race: homebrew ? human.label : halfOrc.label,
    classes: [{ label: 'Fighter', level: 1 }],
    items: input.item ? [{ label: input.item, equipped: true }] : [],
    resourceUsage: [],
    ...(homebrew
      ? {
          extraFeatures: [homebrew],
          features: [
            {
              featureId: homebrew.id,
              source: { kind: 'RACE', raceId: human.id },
              timing: { kind: 'IMMEDIATE' }
            }
          ]
        }
      : {})
  })
}

function extraDice(
  homebrew: FeatureAuthored | undefined,
  item: string,
  attackKind: 'MELEE' | 'RANGED'
) {
  const character = fighter({ ...(homebrew ? { homebrew } : {}), item })
  const { candidate } = itemAction(character, item, { attackKind })
  return dnd5eAttackCriticalRules(
    character.output,
    attackKind,
    dnd5eCharacterActionTarget(candidate)
  ).extraDice
}

describe('race trait conversions (SPELLS-32.T5)', () => {
  it('leaves no closed rule on the SRD Halfling or Half-Orc', () => {
    for (const race of [halfling, halfOrc])
      expect(JSON.stringify(race.features)).not.toMatch(/CLOSED_RULE/)
  })

  it("authors Lucky's reroll as a passive GM ruling", () => {
    const effect = srdByLabel(halfling.features ?? [], 'Lucky').effects?.[0]
    expect(effect?.invocation.kind).toBe('PASSIVE')
    const path = effect?.paths[0]
    expect(path?.selectionKind === 'FIXED' && path.resultBlock.outcomes[0]).toMatchObject({
      effectKind: 'MANUAL_ADJUDICATION'
    })
  })

  it('keeps the SRD races and a homebrew trait exactly as authored', async () => {
    for (const race of [halfling, halfOrc]) {
      const authored = homebrewTenacity()
      const result = await normalize({
        ...structuredClone(race),
        features: [...(race.features ?? []), authored]
      })
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual([
        ...(race.features ?? []),
        authored
      ])
    }
  })

  it('holds the SRD and homebrew interceptions the same way, each on its own charge', () => {
    const relentless = srdByLabel(halfOrc.features ?? [], 'Relentless Endurance')
    const homebrew = homebrewTenacity()
    const held = (character: ReturnType<typeof fighter>) =>
      characterHeldDamageInterceptions(character.output, []).map(({ effectId, save, charge }) => ({
        effectId,
        save,
        amount: charge?.amount
      }))
    expect(held(fighter({}))).toEqual([{ effectId: relentless.id, save: undefined, amount: 1 }])
    expect(held(fighter({ homebrew }))).toEqual([
      { effectId: homebrew.id, save: undefined, amount: 2 }
    ])
  })

  it('adds the SRD melee and the homebrew ranged critical die through the same path', () => {
    expect(extraDice(undefined, 'Greataxe', 'MELEE')).toBe(1)
    expect(extraDice(undefined, 'Shortbow', 'RANGED')).toBe(0)
    const homebrew = homebrewTenacity()
    expect(extraDice(homebrew, 'Greataxe', 'MELEE')).toBe(0)
    expect(extraDice(homebrew, 'Shortbow', 'RANGED')).toBe(1)
  })
})
