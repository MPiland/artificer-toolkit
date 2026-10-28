import { SRD_ABILITIES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { compileSpell } from '@artificer-toolkit/shared/subjects/compilers'
import { describe, expect, it } from 'vitest'

import { planCreatureRest } from '../encounterCreatureRest.js'
import { assertEncounterFeatureActionCapabilityCurrent } from '../encounterFeatureActionCapabilityDiscovery.js'
import { discoverEncounterFeatureActionCapabilities } from '../encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'

const MAGE = srdByLabel(SRD.creatures, 'Mage')
const SPELLS = new Map(SRD.spells.map((spell) => [spell.id, compileSpell(spell)]))
const SLOT_ROWS = MAGE.features.flatMap((feature) => feature.grants?.spellSlots?.levels ?? [])

function discoverCasts(featureCharges?: Record<string, number>) {
  return discoverEncounterFeatureActionCapabilities({
    actor: srdCreatureActor({ id: testUuid(0xe2), creature: MAGE, featureCharges }),
    conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
    abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
    spells: SPELLS
  }).filter((capability) => capability.spellCast !== null)
}

const castLevelsOf = (label: string, casts = discoverCasts()) =>
  casts
    .filter((capability) => capability.label.startsWith(label))
    .map((capability) => capability.spellCast?.castLevel)

describe('Creature spell cast discovery (SPELLS-33.T3c2a1)', () => {
  it('lists a slotted spell at its own level and every higher level the table has', () => {
    expect(castLevelsOf('Fireball')).toEqual([3, 4, 5])
  })

  it('lists a cantrip once, at will, with no slot level', () => {
    const casts = discoverCasts().filter((capability) => capability.label === 'Fire Bolt')
    expect(casts.map((capability) => capability.spellCast?.castLevel)).toEqual([0])
  })

  it('offers only the levels whose row still has a slot', () => {
    const row = (level: number) => SLOT_ROWS.find((entry) => entry.level === level)!
    const spent = Object.fromEntries(SLOT_ROWS.map((entry) => [entry.id, entry.amount]))
    expect(
      castLevelsOf('Fireball', discoverCasts({ ...spent, [row(4).id]: row(4).amount - 1 }))
    ).toEqual([4])
  })

  it('offers no spell cast without the loaded spells', () => {
    expect(
      discoverEncounterFeatureActionCapabilities({
        spells: new Map(),
        actor: srdCreatureActor({ id: testUuid(0xe2), creature: MAGE }),
        conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
        abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code }))
      }).filter((capability) => capability.spellCast !== null)
    ).toEqual([])
  })

  it('fails closed when a Spell the Creature names has no pin', () => {
    const fireballId = srdByLabel(SRD.spells, 'Fireball').id
    const partial = new Map([...SPELLS].filter(([id]) => id !== fireballId))
    const discover = (spells: typeof SPELLS) =>
      discoverEncounterFeatureActionCapabilities({
        actor: srdCreatureActor({ id: testUuid(0xe2), creature: MAGE }),
        conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
        abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
        spells
      })
    expect(() => discover(partial)).toThrow('not pinned')
  })

  it('rechecks an issued spell cast as current for its Creature, and refuses a tampered one', () => {
    const actor = srdCreatureActor({ id: testUuid(0xe2), creature: MAGE })
    const [cast] = discoverCasts()
    expect(() =>
      assertEncounterFeatureActionCapabilityCurrent({ actor, capability: cast!, spells: SPELLS })
    ).not.toThrow()
    expect(() =>
      assertEncounterFeatureActionCapabilityCurrent({
        actor,
        capability: { ...cast!, authoredEffectChecksum: 'tampered' },
        spells: SPELLS
      })
    ).toThrow('Spell cast is stale')
  })
})

function discoverCreatureCasts(creature: typeof MAGE, featureCharges?: Record<string, number>) {
  return discoverEncounterFeatureActionCapabilities({
    actor: srdCreatureActor({ id: testUuid(0xe3), creature, featureCharges }),
    conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
    abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
    spells: SPELLS
  }).filter((capability) => capability.spellCast !== null)
}

function grantedCastOption(creature: typeof MAGE, spellKind: 'CANTRIP' | 'LEVELED') {
  for (const feature of creature.features)
    for (const option of feature.options ?? [])
      if (option.effects?.some((effect) => effect.grantedSpellCast?.spellKind === spellKind))
        return { feature, option }
  throw new Error(`${creature.label} has no ${spellKind} granted cast option.`)
}

describe('Creature spell cast execution (SPELLS-33.T3c2b)', () => {
  const spellcasting = MAGE.features.find((feature) => feature.grants?.spellSlots)!

  it('rolls a spell attack at the caster’s spell attack bonus and binds no slot for a cantrip', () => {
    const [fireBolt] = discoverCasts().filter((capability) => capability.label === 'Fire Bolt')
    expect(fireBolt?.attackMechanic).toEqual({
      rollDefinitionId: null,
      attackBonus: 6,
      damageBonus: 0,
      rollMode: 'NORMAL',
      definitionChecksum: null
    })
    expect(fireBolt?.spellSlotUse).toBeNull()
    expect(fireBolt?.featureResourceUse).toBeNull()
  })

  it('binds a slot cast to the row of its cast level and its save to the spell save DC', () => {
    const fireballs = discoverCasts().filter((capability) =>
      capability.label.startsWith('Fireball')
    )
    expect(
      fireballs.map((capability) => [capability.spellCast?.castLevel, capability.spellSlotUse])
    ).toEqual(
      [3, 4, 5].map((level) => [
        level,
        {
          ownerFeatureId: spellcasting.id,
          slotKey: SLOT_ROWS.find((row) => row.level === level)!.id,
          spellId: srdByLabel(SRD.spells, 'Fireball').id
        }
      ])
    )
    expect(fireballs.map((capability) => capability.spellSaveDc)).toEqual([14, 14, 14])
    expect(fireballs.map((capability) => capability.attackMechanic)).toEqual([null, null, null])
  })

  it('lets a Legendary Cantrip option cast each cantrip for the option’s own cost', () => {
    const lich = srdByLabel(SRD.creatures, 'Lich')
    const { feature, option } = grantedCastOption(lich, 'CANTRIP')
    const all = discoverCreatureCasts(lich)
    const casts = all.filter((capability) => capability.featureOptionId === option.id)
    expect(casts.map((capability) => capability.label)).toEqual(
      all
        .filter(
          (capability) =>
            capability.featureOptionId === null && capability.spellCast?.castLevel === 0
        )
        .map((capability) => `${option.label}: ${capability.label}`)
    )
    expect(casts.map((capability) => capability.label)).toContain('Cantrip: Ray of Frost')
    for (const cast of casts) {
      expect(cast.ownerFeatureId).toBe(feature.id)
      expect(cast.spellCast?.castLevel).toBe(0)
      expect(cast.featureResourceUse).toEqual({ chargeId: feature.charges!.id, cost: 1 })
      expect(cast.spellSlotUse).toBeNull()
    }
    expect(casts.find((cast) => cast.label === 'Cantrip: Ray of Frost')?.attackMechanic).toEqual(
      expect.objectContaining({ attackBonus: 12 })
    )
  })

  it('lets a Legendary Cast a Spell option cast a levelled spell from a slot, never a reaction', () => {
    const sphinx = srdByLabel(SRD.creatures, 'Gynosphinx')
    const { feature, option } = grantedCastOption(sphinx, 'LEVELED')
    const sphinxSpellcasting = sphinx.features.find((entry) => entry.grants?.spellSlots)!
    const slotRows = sphinxSpellcasting.grants!.spellSlots!.levels
    const casts = discoverCreatureCasts(sphinx).filter(
      (capability) => capability.featureOptionId === option.id
    )
    expect(casts.length).toBeGreaterThan(0)
    expect(casts.some((cast) => cast.label.includes('Shield'))).toBe(false)
    for (const cast of casts) {
      expect(cast.ownerFeatureId).toBe(feature.id)
      expect(cast.featureResourceUse).toEqual({ chargeId: feature.charges!.id, cost: 3 })
      const spellLabel = cast.label
        .slice(`${option.label}: `.length)
        .replace(/ \(\d+\w+ level\)$/, '')
      expect(cast.spellSlotUse).toEqual({
        ownerFeatureId: sphinxSpellcasting.id,
        slotKey: slotRows.find((row) => row.level === cast.spellCast?.castLevel)!.id,
        spellId: srdByLabel(SRD.spells, spellLabel).id
      })
    }
    expect(new Set(casts.map((cast) => cast.spellSaveDc))).toEqual(new Set([16]))
  })

  it('refuses a cast whose slot binding was tampered with or whose row has since run out', () => {
    const actor = srdCreatureActor({ id: testUuid(0xe2), creature: MAGE })
    const fireball = discoverCasts().find(
      (capability) =>
        capability.label.startsWith('Fireball') && capability.spellCast?.castLevel === 3
    )!
    const row = SLOT_ROWS.find((entry) => entry.level === 3)!
    expect(() =>
      assertEncounterFeatureActionCapabilityCurrent({
        actor,
        capability: {
          ...fireball,
          spellSlotUse: { ...fireball.spellSlotUse!, slotKey: SLOT_ROWS[0]!.id }
        },
        spells: SPELLS
      })
    ).toThrow('Spell cast is stale')
    expect(() =>
      assertEncounterFeatureActionCapabilityCurrent({
        actor: srdCreatureActor({
          id: testUuid(0xe2),
          creature: MAGE,
          featureCharges: { [row.id]: row.amount }
        }),
        capability: fireball,
        spells: SPELLS
      })
    ).toThrow('Spell cast is stale')
  })
})

describe('Creature innate casts from a charge pool (SPELLS-33.T3c2c)', () => {
  const DJINNI = srdByLabel(SRD.creatures, 'Djinni')
  const ACOLYTE = srdByLabel(SRD.creatures, 'Acolyte')
  const PLANETAR = srdByLabel(SRD.creatures, 'Planetar')
  const grantOf = (creature: typeof MAGE, spellLabel: string) => {
    const spellId = srdByLabel(SRD.spells, spellLabel).id
    for (const feature of creature.features)
      for (const grant of feature.grants?.spells ?? [])
        if (grant.authoringModeKind === 'SELECTED' && grant.spellIds.includes(spellId))
          return { feature, grant, spellId }
    throw new Error(`${creature.label} has no grant of ${spellLabel}.`)
  }
  const directCasts = (
    creature: typeof MAGE,
    label: string,
    featureCharges?: Record<string, number>
  ) =>
    discoverCreatureCasts(creature, featureCharges).filter(
      (capability) => capability.featureOptionId === null && capability.label.startsWith(label)
    )
  /** The Creature with the Feature owning `spellLabel`'s grant rewritten by `edit`. */
  const withGrant = (
    creature: typeof MAGE,
    spellLabel: string,
    edit: (grant: ReturnType<typeof grantOf>['grant']) => ReturnType<typeof grantOf>['grant']
  ): typeof MAGE => {
    const { feature, grant } = grantOf(creature, spellLabel)
    return {
      ...creature,
      features: creature.features.map((entry) =>
        entry.id !== feature.id
          ? entry
          : {
              ...entry,
              grants: {
                ...entry.grants,
                spells: entry.grants!.spells!.map((candidate) =>
                  candidate.id === grant.id ? edit(candidate) : candidate
                )
              }
            }
      )
    }
  }

  it('offers a 3/day spell at its own level and binds the cast to its grant’s charge pool', () => {
    const { feature, grant, spellId } = grantOf(PLANETAR, 'Flame Strike')
    const casts = directCasts(PLANETAR, 'Flame Strike')
    expect(casts.map((capability) => capability.spellCast?.castLevel)).toEqual([5])
    expect(casts[0]?.ownerFeatureId).toBe(feature.id)
    expect(casts[0]?.spellSlotUse).toEqual({
      ownerFeatureId: feature.id,
      slotKey: grant.charges!.id,
      spellId
    })
    expect(casts[0]?.spellSaveDc).toBe(20)
    expect(directCasts(DJINNI, 'Thunderwave').map((capability) => capability.spellSlotUse)).toEqual(
      [null]
    )
  })

  it('stops offering the spell once its pool is spent, and refuses a cast issued before', () => {
    const { grant } = grantOf(PLANETAR, 'Flame Strike')
    const spent = { [grant.charges!.id]: 3 }
    expect(directCasts(PLANETAR, 'Flame Strike', { [grant.charges!.id]: 2 })).toHaveLength(1)
    expect(directCasts(PLANETAR, 'Flame Strike', spent)).toEqual([])
    const [flameStrike] = directCasts(PLANETAR, 'Flame Strike')
    expect(() =>
      assertEncounterFeatureActionCapabilityCurrent({
        actor: srdCreatureActor({ id: testUuid(0xe3), creature: PLANETAR, featureCharges: spent }),
        capability: flameStrike!,
        spells: SPELLS
      })
    ).toThrow('Spell cast is stale')
  })

  it('casts a limited-use cast-at-level grant at the grant’s level only, from its shared pool', () => {
    const { feature, grant } = grantOf(ACOLYTE, 'Cure Wounds')
    const pooled = ['Bless', 'Cure Wounds', 'Sanctuary'].flatMap((label) =>
      directCasts(ACOLYTE, label)
    )
    expect(pooled.map((capability) => capability.label)).toEqual([
      'Bless (1st level)',
      'Cure Wounds (1st level)',
      'Sanctuary (1st level)'
    ])
    expect(new Set(pooled.map((capability) => capability.spellSlotUse?.slotKey))).toEqual(
      new Set([grant.charges!.id])
    )
    expect(new Set(pooled.map((capability) => capability.spellSlotUse?.ownerFeatureId))).toEqual(
      new Set([feature.id])
    )
    expect(directCasts(ACOLYTE, 'Cure Wounds', { [grant.charges!.id]: 3 })).toEqual([])
  })

  it('casts a cast-at-level grant with no pool at its level for free', () => {
    const fixed = withGrant(ACOLYTE, 'Cure Wounds', ({ charges: _charges, ...grant }) => ({
      ...grant,
      attributes: ['PREPARED', 'CAST_AT_LEVEL'],
      castAtLevel: 3
    }))
    const casts = directCasts(fixed, 'Cure Wounds')
    expect(casts.map((capability) => [capability.label, capability.spellSlotUse])).toEqual([
      ['Cure Wounds (3rd level)', null]
    ])
  })

  it('recovers a spent pool on the rest its reset names, and an X/day pool on neither', () => {
    const acolytePool = grantOf(ACOLYTE, 'Cure Wounds').grant.charges!.id
    const djinniPool = grantOf(DJINNI, 'Tongues').grant.charges!.id
    const acolyte = srdCreatureActor({
      id: testUuid(0xe4),
      creature: ACOLYTE,
      featureCharges: { [acolytePool]: 2 }
    })
    expect(planCreatureRest(acolyte, 'SHORT').resets).toEqual([])
    expect(planCreatureRest(acolyte, 'LONG').resets).toEqual([{ key: acolytePool, beforeUsed: 2 }])
    const djinni = srdCreatureActor({
      id: testUuid(0xe5),
      creature: DJINNI,
      featureCharges: { [djinniPool]: 1 }
    })
    expect(planCreatureRest(djinni, 'LONG').resets).toEqual([])
  })

  it('offers no limited-use spell whose grant has no pool a Creature can count', () => {
    const unpooled = withGrant(PLANETAR, 'Flame Strike', ({ charges: _charges, ...grant }) => grant)
    expect(directCasts(unpooled, 'Flame Strike')).toEqual([])
  })
})
