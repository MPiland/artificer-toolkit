import { beforeAll, describe, expect, it } from 'vitest'

import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { barbarian } from '@artificer-toolkit/source-data/srd/classes/barbarian.js'
import { bard } from '@artificer-toolkit/source-data/srd/classes/bard.js'
import { circleOfTheLand } from '@artificer-toolkit/source-data/srd/classes/circle-of-the-land.js'
import { cleric } from '@artificer-toolkit/source-data/srd/classes/cleric.js'
import { hunterConclave } from '@artificer-toolkit/source-data/srd/classes/hunter.js'
import { lifeDomainCleric } from '@artificer-toolkit/source-data/srd/classes/life-domain.js'
import { draconicBloodlineOrigin } from '@artificer-toolkit/source-data/srd/classes/draconic-bloodline.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { monk } from '@artificer-toolkit/source-data/srd/classes/monk.js'
import { oathOfDevotion } from '@artificer-toolkit/source-data/srd/classes/oath-of-devotion.js'
import { paladin } from '@artificer-toolkit/source-data/srd/classes/paladin.js'
import { rogue } from '@artificer-toolkit/source-data/srd/classes/rogue.js'
import { sorcerer } from '@artificer-toolkit/source-data/srd/classes/sorcerer.js'
import { thiefRoguishArchetype } from '@artificer-toolkit/source-data/srd/classes/thief.js'
import { warlock } from '@artificer-toolkit/source-data/srd/classes/warlock.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { SRD_DAMAGE_TYPES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-31.T3a-T3c and T5s (D156): Fast Movement, Divine Strike, Purity of Body, Magical Secrets,
 * Divine Sense, Signature Spells, Empty Body, Devil's Sight, Gaze of Two Minds, Divine Intervention,
 * Volley, Whirlwind Attack (T3), Sacred Weapon and Ki-Empowered Strikes (T4e), Elusive and Escape
 * the Horde (T4k2a) and Nature's Sanctuary (T4k2b) resolve from the
 * same core options a Builder author has on a class feature or option, so each must pass the class
 * node map exactly as authored, as must a homebrew variant built from those options. Perfect Self
 * and Superior Inspiration (T5o) are a RESTORE_RESOURCE outcome on a ROLL_INITIATIVE passive.
 * Thief's Reflexes (T5o2, D187a) is a passive GM ruling. Dragon Wings (T4o) is a fly speed equal to
 * the walking speed; Unarmored Movement Improvement and Second-Story Work (T4o, D187a) are GM rulings.
 * Reliable Talent (T5c) is a proficient-only ability check floor; Indomitable, Diamond Soul and
 * Stroke of Luck (T5c, D187a) spend their use automatically and leave the new result to a GM ruling.
 * Arcane Recovery, Natural Recovery and Font of Magic (T5j) are SPELL_SLOT_EXCHANGE outcomes;
 * Sorcerous Restoration and Eldritch Master (T5j) are GM rulings.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(values: ClassAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(values) as unknown as Record<string, unknown>
  })
}

function feature(record: ClassAuthored, label: string): FeatureAuthored {
  const found = record.features?.find((entry) => entry.label === label)
  if (!found) throw new Error(`${record.label} has no ${label}.`)
  return found
}

/** The authored nodes a case names: the features with its label, or one option of `parent`. */
function caseNodes(record: ClassAuthored, label: string, parent?: string) {
  return parent === undefined
    ? (record.features?.filter((entry) => entry.label === label) ?? [])
    : (feature(record, parent).options?.filter((entry) => entry.label === label) ?? [])
}

function option(record: ClassAuthored, parent: string, label: string) {
  const [found] = caseNodes(record, label, parent)
  if (!found) throw new Error(`${parent} has no ${label}.`)
  return found
}

const fire = SRD_DAMAGE_TYPES.find(({ code }) => code === 'FIRE')!.id

/** Each SRD feature, and a homebrew variant authored from the same options. */
const CASES: ReadonlyArray<{
  record: ClassAuthored
  label: string
  /** The feature whose option this case is. */
  parent?: string
  variant: () => ClassAuthored
}> = [
  {
    record: barbarian,
    label: 'Fast Movement',
    variant: () => {
      const record = structuredClone(barbarian)
      const [speed] = feature(record, 'Fast Movement').grants?.modifiers ?? []
      if (speed?.valueDomainCode !== 'SPEED' || speed.modifierKind !== 'BONUS')
        throw new Error('Fast Movement must author a speed bonus.')
      speed.payload = { amount: 15, unit: 'FEET' }
      return record
    }
  },
  {
    record: lifeDomainCleric,
    label: 'Divine Strike',
    variant: () => {
      const record = structuredClone(lifeDomainCleric)
      for (const effect of feature(record, 'Divine Strike').effects ?? []) {
        const path = effect.paths[0]
        const damage = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
        if (damage?.effectKind !== 'DAMAGE' || !('levels' in damage) || !damage.levels)
          throw new Error('Divine Strike must author level-scaled damage.')
        damage.damageTypeId = fire
        damage.levels = damage.levels.map((level) => ({ ...level, diceConfig: '1d6' }))
      }
      return record
    }
  },
  {
    record: monk,
    label: 'Purity of Body',
    variant: () => {
      const record = structuredClone(monk)
      const [poison] = feature(record, 'Purity of Body').grants?.modifiers ?? []
      if (poison?.valueDomainCode !== 'DAMAGE_IMMUNITY')
        throw new Error('Purity of Body must author a damage immunity.')
      poison.domain = { damageTypeId: fire }
      return record
    }
  },
  {
    record: bard,
    label: 'Magical Secrets',
    variant: () => {
      const record = structuredClone(bard)
      const [secrets] = feature(record, 'Magical Secrets').grants?.spells ?? []
      if (secrets?.selectionKind !== 'CHOSEN' || !('count' in secrets))
        throw new Error('Magical Secrets must be a flat chosen grant.')
      secrets.count = 3
      return record
    }
  },
  {
    record: paladin,
    label: 'Divine Sense',
    variant: () => {
      const record = structuredClone(paladin)
      const authored = feature(record, 'Divine Sense')
      const charges = 'charges' in authored ? authored.charges : undefined
      if (charges?.limitKind !== 'FIXED_AMOUNT' || !('amount' in charges))
        throw new Error('Divine Sense must author a fixed charge with a bonus.')
      charges.amount = 2
      return record
    }
  },
  {
    record: wizard,
    label: 'Signature Spells',
    variant: () => {
      const record = structuredClone(wizard)
      const [signature] = feature(record, 'Signature Spells').grants?.spells ?? []
      const charges = signature && 'charges' in signature ? signature.charges : undefined
      if (!charges || charges.limitKind === 'SOURCE_CHARGES')
        throw new Error('Signature Spells must author its own limited-use charges.')
      charges.resetKind = 'LONG_REST'
      return record
    }
  },
  {
    record: monk,
    label: 'Empty Body',
    variant: () => {
      const record = structuredClone(monk)
      const [effect] = feature(record, 'Empty Body').effects ?? []
      if (effect?.invocation.kind !== 'ACTION' || !effect.invocation.resourceUse)
        throw new Error('Empty Body must spend ki as an action.')
      effect.invocation.resourceUse.cost = 6
      return record
    }
  },
  {
    record: warlock,
    label: "Devil's Sight",
    parent: 'Eldritch Invocations',
    variant: () => {
      const record = structuredClone(warlock)
      const [sight] = option(record, 'Eldritch Invocations', "Devil's Sight").grants?.senses ?? []
      if (sight?.range?.rangeKind !== 'DISTANCE')
        throw new Error("Devil's Sight must author a ranged sense grant.")
      sight.range.amount = 60
      return record
    }
  },
  {
    record: warlock,
    label: 'Gaze of Two Minds',
    parent: 'Eldritch Invocations',
    variant: () => {
      const record = structuredClone(warlock)
      const [effect] = option(record, 'Eldritch Invocations', 'Gaze of Two Minds').effects ?? []
      const path = effect?.paths[0]
      if (path?.selectionKind !== 'FIXED')
        throw new Error('Gaze of Two Minds must author a fixed self path.')
      path.resultBlock.outcomes = path.resultBlock.outcomes.slice(0, 1)
      return record
    }
  },
  {
    record: cleric,
    label: 'Divine Intervention',
    variant: () => {
      const record = structuredClone(cleric)
      const authored = feature(record, 'Divine Intervention')
      const charges = 'charges' in authored ? authored.charges : undefined
      if (charges?.limitKind !== 'FIXED_AMOUNT' || !('amount' in charges))
        throw new Error('Divine Intervention must author a fixed long-rest charge.')
      charges.amount = 2
      return record
    }
  },
  {
    record: hunterConclave,
    label: 'Volley',
    parent: "Hunter's Multiattack",
    variant: () => {
      const record = structuredClone(hunterConclave)
      const [effect] = option(record, "Hunter's Multiattack", 'Volley').effects ?? []
      if (!effect?.weaponAttack) throw new Error('Volley must attack with the wielded weapons.')
      effect.weaponAttack.requiredPropertyCodes = ['THROWN']
      return record
    }
  },
  {
    record: hunterConclave,
    label: 'Whirlwind Attack',
    parent: "Hunter's Multiattack",
    variant: () => {
      const record = structuredClone(hunterConclave)
      const [effect] = option(record, "Hunter's Multiattack", 'Whirlwind Attack').effects ?? []
      if (!effect?.weaponAttack || effect.invocation.range.rangeKind !== 'DISTANCE')
        throw new Error('Whirlwind Attack must attack with the wielded weapons within a distance.')
      effect.invocation.range.amount = 10
      effect.weaponAttack.requiredPropertyCodes = ['REACH']
      return record
    }
  },
  {
    record: monk,
    label: 'Ki-Empowered Strikes',
    variant: () => {
      const record = structuredClone(monk)
      const [trait] = feature(record, 'Ki-Empowered Strikes').grants?.modifiers ?? []
      if (trait?.valueDomainCode !== 'ATTACK_TRAIT' || !('attackDomain' in trait.domain))
        throw new Error('Ki-Empowered Strikes must author a trait for one attack domain.')
      trait.domain = { ...trait.domain, attackDomain: 'MELEE' }
      return record
    }
  },
  {
    record: oathOfDevotion,
    label: 'Channel Divinity: Sacred Weapon',
    variant: () => {
      const record = structuredClone(oathOfDevotion)
      const [effect] = feature(record, 'Channel Divinity: Sacred Weapon').effects ?? []
      const path = effect?.paths[0]
      const grant = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
      const [bonus] = grant?.effectKind === 'APPLY_GRANT' ? (grant.grants?.modifiers ?? []) : []
      if (
        bonus?.modifierKind !== 'BONUS' ||
        !bonus.payload ||
        !('valueKind' in bonus.payload) ||
        bonus.payload.valueKind !== 'ABILITY_MODIFIER'
      )
        throw new Error('Sacred Weapon must author an ability modifier bonus on attack rolls.')
      bonus.payload = {
        valueKind: 'ABILITY_MODIFIER',
        ability: 'WISDOM',
        multiplier: 2,
        min: 2,
        max: 5
      }
      return record
    }
  },
  {
    record: rogue,
    label: 'Elusive',
    variant: () => {
      const record = structuredClone(rogue)
      const grants = feature(record, 'Elusive').grants?.modifiers ?? []
      if (grants.some((grant) => grant.modifierKind !== 'SUPPRESS_ROLL_INFLUENCE'))
        throw new Error('Elusive must suppress advantage on attacks against the holder.')
      // A homebrew variant that holds only against melee attacks.
      feature(record, 'Elusive').grants = { modifiers: grants.slice(0, 1) }
      return record
    }
  },
  {
    record: hunterConclave,
    label: 'Escape the Horde',
    parent: 'Defensive Tactics',
    variant: () => {
      const record = structuredClone(hunterConclave)
      const escape = option(record, 'Defensive Tactics', 'Escape the Horde')
      const grants = escape.grants?.modifiers ?? []
      if (
        grants.some(
          (grant) => grant.valueDomainCode !== 'ATTACKS_AGAINST' || !grant.domain.attackOccasion
        )
      )
        throw new Error('Escape the Horde must qualify attacks against the holder by occasion.')
      // A homebrew variant that holds only against melee opportunity attacks.
      escape.grants = { modifiers: grants.slice(0, 1) }
      return record
    }
  },
  {
    record: circleOfTheLand,
    label: "Nature's Sanctuary",
    variant: () => {
      const record = structuredClone(circleOfTheLand)
      const [ward] = feature(record, "Nature's Sanctuary").grants?.modifiers ?? []
      if (
        ward?.valueDomainCode !== 'INCOMING_ATTACK_GATE' ||
        !ward.payload ||
        !('attackerCreatureTypeIds' in ward.payload) ||
        !ward.payload.successImmunity
      )
        throw new Error(
          'Nature’s Sanctuary must author a creature-type ward with a success immunity.'
        )
      // A homebrew variant that warns off beasts only and remembers a pass for an hour.
      ward.payload.attackerCreatureTypeIds = ward.payload.attackerCreatureTypeIds?.slice(0, 1)
      ward.payload.successImmunity.duration = {
        id: ward.payload.successImmunity.duration.id,
        durationKind: 'HOUR',
        amount: 1
      }
      return record
    }
  },
  ...(
    [
      { record: monk, label: 'Perfect Self' },
      { record: bard, label: 'Superior Inspiration' }
    ] as const
  ).map(({ record, label }) => ({
    record,
    label,
    variant: () => {
      const variant = structuredClone(record)
      const path = feature(variant, label).effects?.[0]?.paths[0]
      const outcome = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
      if (outcome?.effectKind !== 'RESTORE_RESOURCE')
        throw new Error(`${label} must author a resource restore.`)
      // A homebrew variant that restores more, and also when one use is left.
      outcome.floor += 1
      outcome.whenAtOrBelow = 1
      return variant
    }
  })),
  {
    record: thiefRoguishArchetype,
    label: "Thief's Reflexes",
    variant: () => {
      const variant = structuredClone(thiefRoguishArchetype)
      const path = feature(variant, "Thief's Reflexes").effects?.[0]?.paths[0]
      const outcome = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
      if (outcome?.effectKind !== 'MANUAL_ADJUDICATION')
        throw new Error("Thief's Reflexes must author a manual adjudication.")
      outcome.reasonCode = 'GM_CHOICE'
      outcome.instructions = 'The table decides when this feature adds a turn.'
      return variant
    }
  },
  {
    record: draconicBloodlineOrigin,
    label: 'Dragon Wings',
    variant: () => {
      const variant = structuredClone(draconicBloodlineOrigin)
      const path = feature(variant, 'Dragon Wings').effects?.[0]?.paths[0]
      if (path?.selectionKind !== 'FIXED' || path.resultBlock.duration === undefined)
        throw new Error('Dragon Wings must author a fixed result with a duration.')
      // A homebrew variant whose wings last an hour.
      path.resultBlock.duration = {
        id: path.resultBlock.duration.id,
        durationKind: 'HOUR',
        amount: 1
      }
      return variant
    }
  },
  ...(
    [
      { record: monk, label: 'Unarmored Movement Improvement' },
      { record: thiefRoguishArchetype, label: 'Second-Story Work' }
    ] as const
  ).map(({ record, label }) => ({
    record,
    label,
    variant: () => {
      const variant = structuredClone(record)
      const path = feature(variant, label).effects?.[0]?.paths[0]
      const outcome = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
      if (outcome?.effectKind !== 'MANUAL_ADJUDICATION')
        throw new Error(`${label} must author a manual adjudication.`)
      outcome.reasonCode = 'GM_CHOICE'
      outcome.instructions = 'The table decides how this applies.'
      return variant
    }
  })),
  {
    record: rogue,
    label: 'Reliable Talent',
    variant: () => {
      const variant = structuredClone(rogue)
      const [floor] = feature(variant, 'Reliable Talent').grants?.modifiers ?? []
      if (floor?.valueDomainCode !== 'ABILITY_CHECK' || floor.modifierKind !== 'MINIMUM_ROLL')
        throw new Error('Reliable Talent must author an ability check floor.')
      // A homebrew variant that floors proficient Strength checks at 12.
      floor.domain = { ability: 'STRENGTH', proficientOnly: true }
      floor.payload = { amount: 12 }
      return variant
    }
  },
  ...(
    [
      { record: fighter, label: 'Indomitable' },
      { record: monk, label: 'Diamond Soul' },
      { record: rogue, label: 'Stroke of Luck' }
    ] as const
  ).map(({ record, label }) => ({
    record,
    label,
    variant: () => {
      const variant = structuredClone(record)
      const [effect] = feature(variant, label).effects ?? []
      const path = effect?.paths[0]
      const outcome = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
      if (
        effect?.invocation.kind !== 'ACTION' ||
        !effect.invocation.resourceUse ||
        outcome?.effectKind !== 'MANUAL_ADJUDICATION'
      )
        throw new Error(`${label} must author a charged GM ruling.`)
      // A homebrew variant that costs two uses and words the ruling for the table.
      effect.invocation.resourceUse.cost = 2
      outcome.instructions = 'The table decides the new result.'
      return variant
    }
  })),
  ...(
    [
      { record: wizard, label: 'Arcane Recovery' },
      { record: circleOfTheLand, label: 'Natural Recovery' }
    ] as const
  ).map(({ record, label }) => ({
    record,
    label,
    variant: () => {
      const variant = structuredClone(record)
      const path = feature(variant, label).effects?.[0]?.paths[0]
      const outcome = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
      if (outcome?.effectKind !== 'SPELL_SLOT_EXCHANGE' || outcome.mode !== 'RECOVER_SLOTS')
        throw new Error(`${label} must author a spell slot recovery.`)
      // A homebrew variant that recovers a third of the class level, up to 4th-level slots.
      outcome.levelBudget = { ...outcome.levelBudget, divisor: 3, rounding: 'DOWN' }
      outcome.maximumSlotLevel = 4
      return variant
    }
  })),
  {
    record: sorcerer,
    label: 'Font of Magic',
    variant: () => {
      const variant = structuredClone(sorcerer)
      const outcomes = (feature(variant, 'Font of Magic').effects ?? []).map((effect) => {
        const path = effect.paths[0]
        return path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
      })
      const [toPool, toSlot] = outcomes
      if (
        toPool?.effectKind !== 'SPELL_SLOT_EXCHANGE' ||
        toPool.mode !== 'SLOT_TO_RESOURCE' ||
        toSlot?.effectKind !== 'SPELL_SLOT_EXCHANGE' ||
        toSlot.mode !== 'RESOURCE_TO_SLOT'
      )
        throw new Error('Font of Magic must author both spell slot conversions.')
      // A homebrew variant that converts slots up to 3rd level and creates only cheap ones.
      toPool.maximumSlotLevel = 3
      toSlot.costs = [
        { slotLevel: 1, cost: 1 },
        { slotLevel: 2, cost: 2 }
      ]
      return variant
    }
  },
  ...(
    [
      { record: sorcerer, label: 'Sorcerous Restoration' },
      { record: warlock, label: 'Eldritch Master' }
    ] as const
  ).map(({ record, label }) => ({
    record,
    label,
    variant: () => {
      const variant = structuredClone(record)
      const path = feature(variant, label).effects?.[0]?.paths[0]
      const outcome = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes[0] : undefined
      if (outcome?.effectKind !== 'MANUAL_ADJUDICATION')
        throw new Error(`${label} must author a GM ruling.`)
      outcome.instructions = 'The table decides what this feature restores.'
      return variant
    }
  }))
]

describe('class features resolved from core options through the class node map (SPELLS-31.T3a-T3c, T5s)', () => {
  // The first normalize of each SRD class pays a one-time cold load of the node map and the dnd5e
  // graph from source; paying it here keeps it out of the first case's 5 s budget.
  beforeAll(async () => {
    for (const record of new Set(CASES.map((entry) => entry.record))) await normalize(record)
  }, 60_000)

  it.each(CASES)('keeps the SRD $label exactly as authored, with no closed rule', async (entry) => {
    const nodes = caseNodes(entry.record, entry.label, entry.parent)
    expect(nodes.length).toBeGreaterThan(0)
    expect(JSON.stringify(nodes)).not.toContain('CLOSED_RULE')
    const result = await normalize(entry.record)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(entry.record.features)
  })

  it.each(CASES)('keeps a homebrew $label variant the same way', async (entry) => {
    const authored = entry.variant()
    expect(authored.features).not.toEqual(entry.record.features)
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })
})

/**
 * SPELLS-31.T5r-a (D156): an optional on-hit rider paid from a resource pool is authored from the
 * `optionalOnHit` core option, so a ki-costed rider and a homebrew rider on another pool, cost and
 * damage both pass the class node map exactly as authored; the pool binding applies to that kind only.
 */
function poolRiderFeature(input: {
  chargeId: string
  cost: number
  diceConfig: string
  damageTypeId: string
}): FeatureAuthored {
  return {
    id: '00000000-0000-4000-8000-0000000000a1',
    label: 'Pool Rider',
    description: 'After a hit you may spend charges of a pool to add damage.',
    availableAtLevel: 3,
    order: 99,
    effects: [
      {
        id: '00000000-0000-4000-8000-0000000000a2',
        order: 1,
        invocation: {
          kind: 'PASSIVE',
          triggerCode: 'MELEE_WEAPON_ATTACK',
          range: { id: '00000000-0000-4000-8000-0000000000a3', rangeKind: 'SPECIAL' },
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'HOSTILE' },
          optionalOnHit: { kind: 'RESOURCE_POOL', chargeId: input.chargeId, cost: input.cost }
        },
        paths: [
          {
            id: '00000000-0000-4000-8000-0000000000a4',
            order: 1,
            pathCode: 'ON_HIT',
            groupType: 'SINGLE',
            originKind: 'SOURCE',
            selectionKind: 'FIXED',
            resultBlock: {
              id: '00000000-0000-4000-8000-0000000000a5',
              resultKind: 'SINGLE',
              outcomes: [
                {
                  id: '00000000-0000-4000-8000-0000000000a6',
                  effectKind: 'DAMAGE',
                  damageTypeId: input.damageTypeId,
                  valueKind: 'DICE',
                  diceConfig: input.diceConfig,
                  scalingKind: 'NONE'
                }
              ]
            }
          }
        ]
      }
    ]
  }
}

function withFeature(record: ClassAuthored, added: FeatureAuthored): ClassAuthored {
  const variant = structuredClone(record)
  variant.features = [...(variant.features ?? []), added]
  return variant
}

describe('an optional on-hit rider paid from a resource pool (SPELLS-31.T5r-a, D156)', () => {
  const kiChargeId = monk.resources?.charges?.id
  if (!kiChargeId) throw new Error('Ki must author its charges.')
  const radiant = SRD_DAMAGE_TYPES.find(({ code }) => code === 'RADIANT')!.id

  it.each([
    ['a ki-costed rider', { chargeId: kiChargeId, cost: 1, diceConfig: '1d6', damageTypeId: fire }],
    [
      'a homebrew rider on another pool, cost and damage',
      { chargeId: 'homebrew-pool', cost: 3, diceConfig: '2d8', damageTypeId: radiant }
    ]
  ])('keeps %s exactly as authored', async (_label, input) => {
    const authored = withFeature(monk, poolRiderFeature(input))
    const result = await normalize(authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(authored.features)
  })

  it('clears the pool binding from a rider that is paid another way', async () => {
    const authored = withFeature(
      monk,
      poolRiderFeature({ chargeId: kiChargeId, cost: 1, diceConfig: '1d6', damageTypeId: fire })
    )
    const rider = authored.features!.at(-1)!.effects![0]!
    Object.assign(rider.invocation, {
      optionalOnHit: { kind: 'SPELL_SLOT', chargeId: kiChargeId, cost: 1 }
    })
    const result = await normalize(authored)
    const features = getValueAtPath(result.values, ['features']) as FeatureAuthored[]
    expect(features.at(-1)!.effects![0]!.invocation).toMatchObject({
      optionalOnHit: { kind: 'SPELL_SLOT' }
    })
    expect(features.at(-1)!.effects![0]!.invocation).not.toHaveProperty('optionalOnHit.chargeId')
    expect(result.clearedPaths.length).toBeGreaterThan(0)
  })
})
