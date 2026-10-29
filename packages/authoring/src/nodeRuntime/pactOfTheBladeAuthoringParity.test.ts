import { describe, expect, it } from 'vitest'

import { discoverCharacterActionCapabilities } from '@artificer-toolkit/rules-runtime/characterActionCapabilityDiscovery'
import { compileCharacterActionEntryPoints } from '@artificer-toolkit/rules-runtime/encounterActionEntryPointCompiler'
import {
  attackRestrictionsMet,
  reduceEffectRestrictions
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/attackRestrictions'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import {
  evaluateSrdCharacter,
  srdByLabel
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import type { EffectAuthored, FeatureAuthored } from '@artificer-toolkit/shared/authored'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { CLOSED_RULE_KIND } from '@artificer-toolkit/shared/core'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { warlock } from '@artificer-toolkit/source-data/srd/classes/warlock.js'
import { damageTypeId } from '@artificer-toolkit/source-data/srd/spells/shared.js'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'

/**
 * SPELLS-31.T4v (D156, D187a): Pact of the Blade and Lifedrinker are authored from core options. The
 * pact binds a chosen held melee weapon with a proficiency (WEAPON_PROFICIENCY) and a magical trait
 * until its next use replaces it (a SAME_EFFECT END_EFFECTS) or the weapon is let go. Lifedrinker's
 * hit rider holds only on a weapon the pact binds (BOUND_BY_EFFECT). A homebrew bond and rider
 * authored the same way pass the class node map unchanged and gate on their own bond alone. Voice of
 * the Chain Master is a GM ruling.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

const optionOf = (featureLabel: string, optionLabel: string) =>
  srdByLabel(srdByLabel(warlock.features ?? [], featureLabel).options ?? [], optionLabel)

const [SRD_PACT] = optionOf('Pact Boon', 'Pact of the Blade').effects ?? []
const [SRD_MELEE_LIFEDRINKER] = optionOf('Eldritch Invocations', 'Lifedrinker').effects ?? []
if (!SRD_PACT || !SRD_MELEE_LIFEDRINKER) throw new Error('The SRD Warlock authors both effects.')

function normalize(record: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(record) as unknown as Record<string, unknown>
  })
}

/** Every authored `id` in a value, so a copy can be given ids of its own. */
function authoredIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(authoredIds)
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, entry]) =>
    key === 'id' && typeof entry === 'string' ? [entry] : authoredIds(entry)
  )
}

/**
 * A homebrew bond on any held weapon and a rider dealing fire damage on its hits, copied from the
 * SRD effects under ids of their own; the rider names the homebrew bond, not the pact.
 */
function homebrewBond() {
  const source = JSON.stringify([SRD_PACT, SRD_MELEE_LIFEDRINKER])
  const ids = [...new Set(authoredIds(JSON.parse(source)))]
  const renamed = ids.reduce(
    (json, id, index) =>
      json.replaceAll(
        id,
        `7e57a000-0000-4000-8000-${(0x4f0 + index).toString(16).padStart(12, '0')}`
      ),
    source
  )
  const [bond, rider] = JSON.parse(renamed) as [EffectAuthored, EffectAuthored]
  const bondPath = bond.paths[0]
  const riderPath = rider.paths[0]
  if (!bondPath?.chosenItem || riderPath?.selectionKind !== 'FIXED')
    throw new Error('Expected the SRD shapes.')
  bondPath.chosenItem = { ...bondPath.chosenItem, requiredProperties: [] }
  const [damage] = riderPath.resultBlock.outcomes
  if (damage?.effectKind !== 'DAMAGE') throw new Error('Expected the rider damage.')
  riderPath.resultBlock.outcomes = [{ ...damage, damageTypeId: damageTypeId('FIRE') }]
  const feature = (id: string, label: string, effect: EffectAuthored, order: number) =>
    ({
      id,
      label,
      description: label,
      availableAtLevel: 1,
      order,
      effects: [effect]
    }) satisfies FeatureAuthored
  return {
    bondId: bond.id,
    features: [
      feature('7e57a000-0000-4000-8000-0000000004e1', 'Bonded Arms', bond, 98),
      feature('7e57a000-0000-4000-8000-0000000004e2', 'Burning Bond', rider, 99)
    ]
  }
}

/** Whether a melee weapon hit owes the rider while the given Effects bind the weapon. */
function riderOwed(rider: EffectAuthored, bindingEffectIds: readonly string[]) {
  const reduced = reduceEffectRestrictions(compileEffect(rider), {
    equipmentIds: [],
    category: 'WEAPON',
    properties: ['MELEE'],
    grip: 'ONE_HANDED',
    otherWeaponEquipped: false
  })
  const damage = reduced.entries.filter(
    (entry) => 'outcome' in entry && entry.outcome.effectKind === 'DAMAGE'
  )
  if (damage.length === 0) throw new Error('Expected the rider damage.')
  return damage.some(
    (entry) =>
      !('restrictions' in entry) ||
      entry.restrictions === undefined ||
      attackRestrictionsMet(entry.restrictions, {
        rollMode: 'NORMAL',
        enemyProximity: null,
        moveToward: null,
        targetCreatureTypeId: null,
        attackItemBindingEffectIds: bindingEffectIds
      })
  )
}

describe('Pact of the Blade, Lifedrinker and Voice of the Chain Master (SPELLS-31.T4v)', () => {
  it('no longer lists their closed rule kinds', () => {
    for (const kind of [
      'CLASS_WARLOCK_PACT_OF_BLADE',
      'CLASS_WARLOCK_LIFEDRINKER',
      'CLASS_WARLOCK_VOICE_OF_CHAIN_MASTER'
    ])
      expect(CLOSED_RULE_KIND).not.toHaveProperty(kind)
  })

  it('authors Voice of the Chain Master as a GM ruling', () => {
    const path = optionOf('Eldritch Invocations', 'Voice of the Chain Master').effects?.[0]
      ?.paths[0]
    expect(path?.selectionKind === 'FIXED' && path.resultBlock.outcomes[0]).toMatchObject({
      effectKind: 'MANUAL_ADJUDICATION'
    })
  })

  it('keeps a homebrew bond and rider exactly as authored through the class node map', async () => {
    const { features } = homebrewBond()
    const result = await normalize({
      ...structuredClone(warlock),
      features: [...(warlock.features ?? []), ...features]
    })
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual([
      ...(warlock.features ?? []),
      ...features
    ])
  })

  it('compiles the homebrew bond as an action that first ends its own earlier binding', () => {
    const { bondId, features } = homebrewBond()
    const WARLOCK = srdByLabel([warlock], 'Warlock')
    const character = evaluateSrdCharacter({
      classes: [{ label: 'Warlock', level: 1 }],
      extraFeatures: features,
      features: features.map((feature) => ({
        acquisitionId: `acquired:${feature.id}`,
        featureId: feature.id,
        source: { kind: 'CLASS' as const, classId: WARLOCK.id, classLevel: 1 },
        timing: { kind: 'CLASS_LEVEL' as const, classId: WARLOCK.id, classLevel: 1 }
      }))
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
    const index = candidates.findIndex((candidate) => candidate.effectId === bondId)
    expect(entries[index]).toMatchObject({
      kind: 'CHARACTER_ACTION',
      compilation: { kind: 'COMPILED' }
    })
    expect(
      candidates[index]?.mechanicFacts.outcomes.flatMap((outcome) =>
        'endEffects' in outcome && outcome.endEffects ? [outcome.endEffects] : []
      )
    ).toEqual([{ scope: 'ALL', selectors: [{ kind: 'SAME_EFFECT', effectId: bondId }] }])
  })

  it('owes each rider only on a weapon its own bond binds', () => {
    const { bondId, features } = homebrewBond()
    const homebrewRider = features[1]!.effects[0]!
    for (const [rider, ownBond, otherBond] of [
      [SRD_MELEE_LIFEDRINKER, SRD_PACT.id, bondId],
      [homebrewRider, bondId, SRD_PACT.id]
    ] as const) {
      expect(riderOwed(rider, [ownBond])).toBe(true)
      expect(riderOwed(rider, [otherBond, ownBond])).toBe(true)
      expect(riderOwed(rider, [otherBond])).toBe(false)
      expect(riderOwed(rider, [])).toBe(false)
    }
  })
})
