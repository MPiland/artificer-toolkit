import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { sanctuary } from '@artificer-toolkit/source-data/srd/spells/sanctuary.js'
import { describe, expect, it } from 'vitest'

import { sourceImmunityEffect } from '../encounterActionEffectPlans.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { heldIncomingGate, incomingGateSaveDc } from '../encounterIncomingAttackGate.js'
import { incomingGateImmunityPlan } from '../systems/dnd5e/effectActionCompiler.js'
import { ENCOUNTER_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { plannedModifierGrant } from '../testing/modifierGrantFixture.js'

const CASTER_ID = testUuid(0xe001)
const HOLDER_ID = testUuid(0xe002)
const ATTACKER_ID = testUuid(0xe004)
const attacker = { actorId: ATTACKER_ID, characterId: null }
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
    attackerCreatureTypeId: null,
    attacker
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
  const heldByFold = (
    payload: Record<string, unknown>,
    attackerCreatureTypeId: string | null,
    effects: readonly ActiveRuleEffectRecord[] = [],
    who = attacker
  ) =>
    heldIncomingGate({
      holderActorId: HOLDER_ID,
      effects,
      grantFold: holderFold(payload),
      attackerCreatureTypeId,
      attacker: who
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

  // The immunity a creature that passed the ward leaves on its holder, as the planner stores it.
  const successImmunity = { duration: { id: 'immunity', durationKind: 'HOUR', amount: 24 } }
  const passedWard = (): ActiveRuleEffectRecord => {
    const plan = incomingGateImmunityPlan({
      wardId: grantId,
      duration: { durationKind: 'HOUR', amount: 24 } as Parameters<
        typeof incomingGateImmunityPlan
      >[0]['duration']
    })
    if (!plan) throw new Error('A 24 hour success immunity must be countable.')
    const { definition, lifecycle } = sourceImmunityEffect({
      ...plan,
      origin: {
        encounterId: ENCOUNTER_ID,
        occurrenceId: testUuid(0xe040),
        commandId: testUuid(0xe041),
        sourceActorId: ATTACKER_ID
      },
      sourceCharacterId: null,
      sourceLabel: 'Ward',
      lifetimeScope: 'OWNER'
    })
    return {
      ...heldSanctuary(testUuid(0xe042)),
      definition,
      lifecycle
    }
  }

  it('stops asking an attacker that passed the ward, for the length of the immunity', () => {
    const payload = { savingThrow, successImmunity }
    expect(heldByFold(payload, null)?.wardId).toBe(grantId)
    expect(heldByFold(payload, null, [passedWard()])).toBeNull()
  })

  it('still asks every other attacker', () => {
    const other = { actorId: testUuid(0xe043), characterId: null }
    expect(heldByFold({ savingThrow, successImmunity }, null, [passedWard()], other)?.wardId).toBe(
      grantId
    )
  })

  it('keeps the immunity to the attacker for 24 hours, counted on the holder’s turns', () => {
    const { definition, lifecycle } = passedWard()
    expect(definition.recurrence.expiration).toEqual(
      expect.objectContaining({ kind: 'TICKS', initialRemaining: 14_400, anchor: 'HOLDER' })
    )
    expect(lifecycle.remainingTicks).toBe(14_400)
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
  } as unknown as Parameters<typeof incomingGateSaveDc>[2]
  const base = { id: 'dc', abilityDefinitionId: ability }

  it('uses the owner’s spell save DC for SOURCE_SAVE_DC', () => {
    expect(
      incomingGateSaveDc(DND5E_SYSTEM_ID, { ...base, dcMethod: 'SOURCE_SAVE_DC' }, owner)
    ).toBe(15)
  })

  it('adds the owner’s ability modifier, proficiency bonus and static bonus to a derived DC', () => {
    expect(
      incomingGateSaveDc(
        DND5E_SYSTEM_ID,
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
        DND5E_SYSTEM_ID,
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
