import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { sanctuary } from '@artificer-toolkit/source-data/srd/spells/sanctuary.js'
import { describe, expect, it } from 'vitest'

import { heldIncomingGate, incomingGateSaveDc } from '../encounterIncomingAttackGate.js'
import { ENCOUNTER_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { plannedModifierGrant } from '../testing/modifierGrantFixture.js'

const CASTER_ID = testUuid(0xe001)
const HOLDER_ID = testUuid(0xe002)
const [warding] = sanctuary.effects ?? []

/** Sanctuary as the real planner stores it on its holder, under `id`. */
function heldSanctuary(id: string, sourceActorId: string = CASTER_ID): ActiveRuleEffectRecord {
  if (!warding) throw new Error('The SRD Sanctuary has no effect.')
  const planned = plannedModifierGrant({
    encounterId: ENCOUNTER_ID,
    sourceActorId,
    holderActorId: HOLDER_ID,
    lifecycle: {},
    effect: warding
  })
  return {
    ...planned,
    id,
    owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: HOLDER_ID },
    sourceEncounterId: ENCOUNTER_ID,
    maintainedEffectStateId: null,
    createdOrdinal: 1,
    version: 1,
    definitionChecksum: 'a'.repeat(64),
    lifecycleChecksum: 'b'.repeat(64),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

function heldBy(effects: readonly ActiveRuleEffectRecord[]) {
  return heldIncomingGate({
    holderActorId: HOLDER_ID,
    effects,
    grantFold: null,
    attackerCreatureTypeId: null
  })
}

describe('incoming attack gate (Sanctuary)', () => {
  it('finds the ward on its holder with the caster whose save DC it uses', () => {
    const effect = heldSanctuary(testUuid(0xe010))
    const held = heldBy([effect])
    expect(held?.ownerActorId).toBe(CASTER_ID)
    expect(held?.wardId).toBe(effect.id)
    expect(held?.payload.savingThrow.dcMethod).toBe('SOURCE_SAVE_DC')
  })

  it('holds no ward for a holder without the effect', () => {
    expect(heldBy([])).toBeNull()
  })

  it('answers to the ward with the lowest id when a holder carries several', () => {
    const low = heldSanctuary(testUuid(0xe011), testUuid(0xe003))
    const high = heldSanctuary(testUuid(0xe012), testUuid(0xe004))
    expect(heldBy([high, low])?.wardId).toBe(low.id)
    expect(heldBy([low, high])?.wardId).toBe(low.id)
  })
})

describe('holder-owned incoming attack gate', () => {
  const grantId = testUuid(0xe030)
  const holderFold = (payload: Record<string, unknown>) =>
    ({
      modifiers: [
        { valueDomainCode: 'INCOMING_ATTACK_GATE', source: { kind: 'CLASS_FEATURE' }, payload }
      ],
      modifierGroups: [{ contributions: [{ acceptedModifierIndex: 0, grantId }] }]
    }) as unknown as NonNullable<Parameters<typeof heldIncomingGate>[0]['grantFold']>
  const savingThrow = {
    id: 'save',
    dcMethod: 'SOURCE_SAVE_DC',
    abilityDefinitionId: testUuid(0xe031)
  }
  const BEAST = testUuid(0xe032)
  const heldByFold = (payload: Record<string, unknown>, attackerCreatureTypeId: string | null) =>
    heldIncomingGate({
      holderActorId: HOLDER_ID,
      effects: [],
      grantFold: holderFold(payload),
      attackerCreatureTypeId
    })

  it('makes the holder the owner of a feature grant, keyed by the grant', () => {
    const held = heldByFold({ savingThrow }, null)
    expect(held?.ownerActorId).toBe(HOLDER_ID)
    expect(held?.wardId).toBe(grantId)
  })

  it('covers only the listed Creature types, and never a Character', () => {
    const payload = { savingThrow, attackerCreatureTypeIds: [BEAST] }
    expect(heldByFold(payload, BEAST)?.wardId).toBe(grantId)
    expect(heldByFold(payload, testUuid(0xe033))).toBeNull()
    expect(heldByFold(payload, null)).toBeNull()
  })

  // Success immunity is authored but not enforced until T4k2c adds the Character-target SOURCE_IMMUNITY
  // receipt; until then a ward that carries it is owed exactly as one that does not.
  it('accepts a success immunity without yet acting on it (T4k2c)', () => {
    const successImmunity = { duration: { id: 'immunity', durationKind: 'HOUR', amount: 24 } }
    expect(heldByFold({ savingThrow, successImmunity }, null)).toEqual(
      expect.objectContaining({ wardId: grantId, ownerActorId: HOLDER_ID })
    )
  })
})

describe('incoming gate save DC', () => {
  const ability = testUuid(0xe020)
  const owner = {
    effectiveRulePolicyOutput: {
      derivedStats: {
        proficiencyBonus: { effective: 4 },
        spellcasting: { saveDc: { effective: 15 } }
      }
    },
    effectiveScalarValues: { [ability]: 18 }
  } as unknown as Parameters<typeof incomingGateSaveDc>[1]
  const base = { id: 'dc', abilityDefinitionId: ability }

  it('uses the owner’s spell save DC for SOURCE_SAVE_DC', () => {
    expect(incomingGateSaveDc({ ...base, dcMethod: 'SOURCE_SAVE_DC' }, owner)).toBe(15)
  })

  it('adds the owner’s ability modifier, proficiency bonus and static bonus to a derived DC', () => {
    expect(
      incomingGateSaveDc(
        {
          ...base,
          dcMethod: 'DERIVED_DC',
          baseDc: 8,
          bonuses: [
            { id: 'a', bonusKind: 'ABILITY_MODIFIER', abilityDefinitionId: ability },
            { id: 'p', bonusKind: 'PROFICIENCY_BONUS' },
            { id: 's', bonusKind: 'STATIC_BONUS', amount: 1 }
          ]
        },
        owner
      )
    ).toBe(8 + 4 + 4 + 1)
  })

  it('has no DC when the owner lacks the ability the DC reads', () => {
    expect(
      incomingGateSaveDc(
        {
          ...base,
          dcMethod: 'DERIVED_DC',
          baseDc: 8,
          bonuses: [
            { id: 'a', bonusKind: 'ABILITY_MODIFIER', abilityDefinitionId: testUuid(0xe021) }
          ]
        },
        owner
      )
    ).toBeNull()
  })
})
