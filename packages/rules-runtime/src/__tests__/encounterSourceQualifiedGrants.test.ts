import { describe, expect, it } from 'vitest'
import { gaseousForm } from '@artificer-toolkit/source-data/srd/spells/gaseous-form.js'
import { SRD_DAMAGE_TYPES, SRD_SPEEDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  conditionTypeId,
  creatureTypeId,
  damageTypeId
} from '@artificer-toolkit/source-data/srd/spells/shared.js'

import {
  conditionImmunityIdsAgainstSource,
  sourceQualifierAdmits
} from '../encounterActiveGrants.js'
import { withEncounterHolderDefense } from '../encounterHolderDefense.js'
import { buildMovementTarget, type MovementTarget } from '../encounterMovementTargets.js'
import { dnd5eAttackDamageDefenses } from '../systems/dnd5e/attackDamageDefenses.js'
import {
  CAMPAIGN_ID,
  SRD_SYSTEM_ID,
  srdCreatureActor,
  srdDefinitions,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import {
  plannedGrantEffect,
  protectionFromEvilAndGoodEffect,
  stoneskinEffect
} from './antitoxinEffectFixture.js'

const HOLDER_ID = testUuid(0xd6a1)
const WARD_ID = testUuid(0xd6a2)
const ogre = srdByLabel(SRD.creatures, 'Ogre')
const WARDED_TYPES = ['ABERRATION', 'CELESTIAL', 'ELEMENTAL', 'FEY', 'FIEND', 'UNDEAD'] as const

const holder = (activeEffects: MovementTarget['activeEffects']) =>
  buildMovementTarget({
    actor: srdCreatureActor({ id: HOLDER_ID, creature: ogre }),
    activeEffects,
    gameSystemId: SRD_SYSTEM_ID,
    campaignId: CAMPAIGN_ID,
    characterFacts: null
  })

const defend = (target: MovementTarget) =>
  withEncounterHolderDefense({
    target,
    gameSystemId: SRD_SYSTEM_ID,
    definitions: srdDefinitions,
    speedDefinitions: SRD_SPEEDS,
    runEffectsByActorId: new Map(),
    readTurnMovedFeet: async () => 0
  })

describe('Protection from Evil and Good as source-qualified grants', () => {
  const warded = () =>
    defend(holder([protectionFromEvilAndGoodEffect({ id: WARD_ID, holderActorId: HOLDER_ID })]))

  it("gives only the warded creature types' attacks disadvantage", async () => {
    const { attackAgainstContributors } = await warded()
    expect(attackAgainstContributors.length).toBeGreaterThan(0)
    for (const { sourceQualifier, contributor } of attackAgainstContributors) {
      expect(contributor?.influence).toBe('DISADVANTAGE')
      for (const code of WARDED_TYPES)
        expect(
          sourceQualifierAdmits(sourceQualifier, { creatureTypeIds: [creatureTypeId(code)] })
        ).toBe(true)
      expect(
        sourceQualifierAdmits(sourceQualifier, { creatureTypeIds: [creatureTypeId('HUMANOID')] })
      ).toBe(false)
      expect(sourceQualifierAdmits(sourceQualifier, { creatureTypeIds: [] })).toBe(false)
    }
  })

  it('makes the holder immune to charm and fright from those types only', async () => {
    const target = await warded()
    expect(target.conditionImmunityIds).toEqual([])
    const charmed = conditionTypeId('CHARMED')
    const frightened = conditionTypeId('FRIGHTENED')
    expect(target.sourceConditionImmunities.map(({ conditionTypeId: id }) => id).sort()).toEqual(
      [charmed, frightened].sort()
    )
    const against = (code: string) =>
      conditionImmunityIdsAgainstSource(
        target.conditionImmunityIds,
        target.sourceConditionImmunities,
        { creatureTypeIds: [creatureTypeId(code)] }
      )
    expect([...against('FIEND')].sort()).toEqual([charmed, frightened].sort())
    expect(against('HUMANOID')).toEqual([])
  })

  it('applies nothing for a holder without the spell', async () => {
    const bare = holder([])
    expect(await defend(bare)).toBe(bare)
  })
})

describe('Stoneskin as a qualified damage resistance', () => {
  const stoned = () => holder([stoneskinEffect({ id: WARD_ID, holderActorId: HOLDER_ID })])
  const resisted = (
    traits: { magical: boolean; silvered: boolean; adamantine: boolean } | null
  ) => {
    const target = stoned()
    return dnd5eAttackDamageDefenses(target.defenses, target.qualifiedDefenses, traits, null)
      .filter(({ kind }) => kind === 'RESISTANCE')
      .map(({ damageTypeId: id }) => id)
  }
  const physical = ['BLUDGEONING', 'PIERCING', 'SLASHING'].map(damageTypeId).sort()

  it('resists bludgeoning, piercing and slashing from a nonmagical attack', () => {
    expect(resisted({ magical: false, silvered: false, adamantine: false }).sort()).toEqual(
      expect.arrayContaining(physical)
    )
  })

  it('does not resist them from a magical attack or from damage that is not an attack', () => {
    for (const id of physical) {
      expect(resisted({ magical: true, silvered: false, adamantine: false })).not.toContain(id)
      expect(resisted(null)).not.toContain(id)
    }
  })

  it('holds no unqualified defense for them', () => {
    expect(stoned().defenses.filter(({ damageTypeId: id }) => physical.includes(id))).toEqual([])
  })
})

describe('Gaseous Form as a qualified resistance to all damage (SPELLS-4.T2p)', () => {
  const misty = () =>
    holder([
      plannedGrantEffect({
        id: WARD_ID,
        holderActorId: HOLDER_ID,
        effect: gaseousForm.effects?.[0],
        sourceLabel: gaseousForm.label
      })
    ])
  const resisted = (
    traits: { magical: boolean; silvered: boolean; adamantine: boolean } | null
  ) => {
    const target = misty()
    return dnd5eAttackDamageDefenses(target.defenses, target.qualifiedDefenses, traits, null)
      .filter(({ kind }) => kind === 'RESISTANCE')
      .map(({ damageTypeId: id }) => id)
  }
  const every = SRD_DAMAGE_TYPES.map(({ id }) => id)

  it('resists every damage type from a nonmagical attack', () => {
    expect(resisted({ magical: false, silvered: false, adamantine: false })).toEqual(
      expect.arrayContaining(every)
    )
  })

  it('does not resist a magical attack or damage that is not an attack', () => {
    const magical = resisted({ magical: true, silvered: false, adamantine: false })
    const notAttack = resisted(null)
    for (const id of every) {
      expect(magical).not.toContain(id)
      expect(notAttack).not.toContain(id)
    }
  })
})
