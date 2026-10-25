import { describe, expect, it } from 'vitest'
import { DEFAULT_CHARACTER_PARTY_VISIBILITY } from '@artificer-toolkit/schema/api/healthDisplay'
import { characterSheetStateSchema } from '@artificer-toolkit/schema/projections/characterSheetState'
import { NO_DEATH_SAVES } from '@artificer-toolkit/schema/subjects/characterState'
import {
  createCharacterResourceOwnerKey,
  createEmptyCharacterAuthored
} from '@artificer-toolkit/shared/character'
import type { CharacterResourceUsage } from '@artificer-toolkit/shared/core'
import { RAGE_EFFECT_ID } from '@artificer-toolkit/source-data/srd/classes/barbarian.js'
import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import type { CharacterRuleActionApplication } from '../characterRuleActionSystemAdapter.js'
import {
  characterHeldDamageInterceptions,
  interceptionChargesSpent,
  type HeldDamageInterception
} from '../encounterDamageInterception.js'
import { getRestRecoveryTriggers } from '../character/sheetRest.js'
import { planEncounterMechanicsBatch } from '../encounterMechanicsBatchPlan.js'
import { evaluateSrdCharacter, srdFeature } from '../testing/dnd5eSrdCharacter.js'
import { characterActor, ENCOUNTER_ID, TIMESTAMP, testUuid } from '../testing/dnd5eSrdEncounter.js'

/**
 * SPELLS-31.T5f3: a Character's feature holds a damage interception bound to its own active effect.
 * Relentless Rage holds only while raging, asks a CON save at 10 plus 5 per use so far, and counts a
 * use on every attempt (`spendsUseOnFailure`); the plan writes the use to the Character's Sheet pool.
 */

const ACTOR_ID = testUuid(0xf301)
const CHARACTER_ID = testUuid(0xf302)
const USER_ID = testUuid(0xf303)
const STREAM_VERSION = 7

function relentlessRageOutput(resourceUsage: readonly CharacterResourceUsage[] = []) {
  return evaluateSrdCharacter({
    classes: [{ label: 'Barbarian', level: 11 }],
    resourceUsage,
    features: [
      srdFeature({
        owner: 'CLASS',
        classLabel: 'Barbarian',
        featureLabel: 'Relentless Rage',
        level: 11
      })
    ]
  }).output
}

function ragingInterception(
  resourceUsage?: readonly CharacterResourceUsage[]
): HeldDamageInterception {
  const [held] = characterHeldDamageInterceptions(relentlessRageOutput(resourceUsage), [
    RAGE_EFFECT_ID
  ])
  if (!held?.charge?.owner)
    throw new Error('Expected Relentless Rage to hold a charged interception.')
  return held
}

const lethal: CharacterRuleActionApplication = {
  sourceNodeId: 'outcome',
  sourceOperationKey: 'dnd5e.damage',
  authoredPath: null,
  resolvedPath: 'ON_HIT',
  kind: 'DAMAGE',
  targetActorId: ACTOR_ID,
  damageTypeId: testUuid(0xf307),
  damageDisposition: 'NORMAL',
  requestedAmount: 14,
  resolvedAmount: 14,
  appliedAmount: 10,
  beforeCurrentHitPoints: 10,
  afterCurrentHitPoints: 0,
  beforeTemporaryHitPoints: 0,
  afterTemporaryHitPoints: 0,
  maximumHitPoints: 120,
  critical: false
}

function plan(
  interception: HeldDamageInterception,
  rawDie: number,
  resourceUsage: CharacterResourceUsage[] = []
) {
  const empty = createEmptyCharacterAuthored({
    id: CHARACTER_ID,
    systemId: SRD_SYSTEM_ID,
    userId: USER_ID
  })
  return planEncounterMechanicsBatch({
    batch: {
      encounterId: ENCOUNTER_ID,
      targetActorId: ACTOR_ID,
      expectedEncounterVersion: 3,
      occurrenceId: testUuid(0xf304),
      sourceCommandId: testUuid(0xf305),
      commandId: testUuid(0xf306),
      occurredAt: TIMESTAMP,
      applications: [lethal],
      expectedCharacterStreamVersion: STREAM_VERSION,
      effectiveMaximumHitPoints: 120,
      forceVersionAdvance: false,
      damageInterceptions: [{ ...interception, saveRoll: { rawDie, addedTotal: 3 } }]
    },
    actor: characterActor({ id: ACTOR_ID, characterId: CHARACTER_ID }),
    userId: USER_ID,
    characterFacts: {
      active: { id: CHARACTER_ID, play: { streamVersion: STREAM_VERSION } },
      character: {
        ...empty,
        state: {
          ...empty.state,
          hitpoints: { current: 10, temp: 0, hitDice: [], deathSaves: NO_DEATH_SAVES }
        }
      },
      sheetState: {
        ...characterSheetStateSchema.parse({
          adjustments: [],
          movementDisplayPreference: { mode: 'AUTO' },
          partyVisibility: DEFAULT_CHARACTER_PARTY_VISIBILITY
        }),
        resourceUsage
      },
      campaignContext: { conditions: [] }
    }
  })
}

describe('Relentless Rage held by a Character feature (SPELLS-31.T5f3)', () => {
  it('holds the interception only while the Character rages', () => {
    const output = relentlessRageOutput()
    expect(characterHeldDamageInterceptions(output, [])).toEqual([])
    expect(characterHeldDamageInterceptions(output, [testUuid(0xf3ff)])).toEqual([])
    expect(ragingInterception()).toMatchObject({
      dropToHitPoints: 1,
      negatesKill: false,
      save: {
        ability: 'CONSTITUTION',
        dc: { base: 10, plusDamageTaken: false, plusPerChargeUsed: 5 },
        spendsUseOnFailure: true
      },
      charge: { amount: 6, used: 0, cost: 1 }
    })
  })

  it('returns its uses on a short or a long rest', () => {
    const pool = relentlessRageOutput().resources.find(
      (resource) =>
        resource.ownerKind === 'AUTHORED_SOURCE' &&
        resource.chargeId === ragingInterception().charge?.chargeId
    )
    expect(pool).toMatchObject({ state: 'RESOLVED', maximum: 6, resetKind: 'SHORT_REST' })
    for (const rest of ['SHORT', 'LONG'] as const)
      expect(getRestRecoveryTriggers(rest).has('SHORT_REST')).toBe(true)
  })

  it('drops the raging Character to 1 on a DC 10 save and writes the first use to its Sheet', () => {
    const held = ragingInterception()
    const poolId = createCharacterResourceOwnerKey(held.charge!.owner!)
    const result = plan(held, 7)
    expect(result.characterUpdate?.character.state.hitpoints.current).toBe(1)
    expect(result.receiptApplications).toMatchObject([
      {
        interceptedBy: held.effectId,
        interceptionSaves: [{ dc: 10, passed: true }],
        interceptionCharge: { poolId, beforeUsed: 0, afterUsed: 1 }
      }
    ])
    const [usage] = result.characterUpdate?.sheetState?.resourceUsage ?? []
    expect(usage).toMatchObject({ characterId: CHARACTER_ID, owner: held.charge!.owner, used: 1 })
    // The row id is derived, so a replay of the same batch writes the same row.
    expect(plan(held, 7).characterUpdate?.sheetState?.resourceUsage[0]?.id).toBe(usage?.id)
  })

  it('raises the DC by 5 per use and counts a failed attempt as a use', () => {
    const first = plan(ragingInterception(), 7).characterUpdate!.sheetState!.resourceUsage[0]!
    const twice = [{ ...first, used: 2 }]
    // The Sheet's two uses so far reach the interception through the Character's resolved pool.
    const used = ragingInterception(twice)
    expect(used.charge?.used).toBe(2)
    const result = plan(used, 7, twice)
    expect(result.characterUpdate?.character.state.hitpoints.current).toBe(0)
    expect(result.receiptApplications).toMatchObject([
      { interceptionSaves: [{ dc: 20, passed: false, spent: true }] }
    ])
    expect(result.receiptApplications[0]).not.toHaveProperty('interceptedBy')
    expect(interceptionChargesSpent(result.receiptApplications)).toMatchObject([
      { beforeUsed: 2, afterUsed: 3 }
    ])
    expect(result.characterUpdate?.sheetState?.resourceUsage).toMatchObject([
      { id: first.id, used: 3 }
    ])
  })

  it('refuses a use when the Sheet pool moved since the interception was listed', () => {
    const held = ragingInterception()
    const first = plan(held, 7).characterUpdate!.sheetState!.resourceUsage[0]!
    expect(() => plan(held, 7, [{ ...first, used: 1 }])).toThrow(
      'Encounter Character resource usage is stale.'
    )
  })
})
