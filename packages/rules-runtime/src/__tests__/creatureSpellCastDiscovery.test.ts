import { SRD_ABILITIES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { compileSpell } from '@artificer-toolkit/shared/subjects/compilers'
import { describe, expect, it } from 'vitest'

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
      assertEncounterFeatureActionCapabilityCurrent({ actor, capability: cast! })
    ).not.toThrow()
    expect(() =>
      assertEncounterFeatureActionCapabilityCurrent({
        actor,
        capability: { ...cast!, authoredEffectChecksum: 'tampered' }
      })
    ).toThrow('Spell cast is stale')
  })
})
