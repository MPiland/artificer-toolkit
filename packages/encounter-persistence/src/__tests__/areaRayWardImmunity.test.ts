import { prepareActiveRuleEffectRecord } from '@artificer-toolkit/rules-runtime/activeRuleEffectRecords'
import { sourceImmunityEffect } from '@artificer-toolkit/rules-runtime/encounterActionEffectPlans'
import { passedWardImmunityPlan } from '@artificer-toolkit/rules-runtime/encounterWardImmunity'
import {
  ENCOUNTER_ID,
  characterActor,
  testUuid
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import {
  plannedModifierGrant,
  withGateSuccessImmunity
} from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { sanctuary } from '@artificer-toolkit/source-data/srd/spells/sanctuary.js'
import { describe, expect, it } from 'vitest'

import { requireRayWardImmunities } from '../areaRayWardImmunity.js'

/**
 * Each ray of an area list that passes a ward owes the ward's success immunity once per holder, and
 * the commit proves the immunities it is asked to write against the ward the holder stores, not the
 * plan the room sent: a forged one, a second one and a missing one are refused.
 */

const CASTER_ACTOR_ID = testUuid(0xa01)
const CASTER_ID = testUuid(0xa02)
const HOLDER_ID = testUuid(0xa03)
const OTHER_HOLDER_ID = testUuid(0xa04)
const WARDER_ID = testUuid(0xa05)
const WARD_ID = testUuid(0xa06)
const OTHER_WARD_ID = testUuid(0xa07)
const REFUSAL = 'Live Session ray ward immunity mismatch.'

const caster = characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID })
const [srdWarding] = sanctuary.effects ?? []

/** The ward `holderActorId` stores: the authored `effect` as the real planner records it. */
function ward(id: string, holderActorId: string, effect: typeof srdWarding) {
  const { definition, lifecycle } = plannedModifierGrant({
    encounterId: ENCOUNTER_ID,
    sourceActorId: WARDER_ID,
    holderActorId,
    lifecycle: {},
    effect
  })
  return prepareActiveRuleEffectRecord({
    id,
    owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: holderActorId },
    definition,
    lifecycle,
    currentEffects: [],
    occurredAt: '2026-01-01T00:00:00.000Z'
  })
}

/** The immunity a ray passing `wardId` leaves on `holderActorId`, as the commit plans it. */
function immunity(wardId: string, holderActorId: string, sourceActorId = CASTER_ACTOR_ID) {
  const plan = passedWardImmunityPlan({
    gameSystemId: SRD_SYSTEM_ID,
    ward: {
      wardId,
      payload: {
        successImmunity: { duration: { id: testUuid(0xa08), durationKind: 'HOUR', amount: 24 } }
      }
    }
  })
  if (!plan) throw new Error('The ward owes an immunity.')
  const { definition, lifecycle } = sourceImmunityEffect({
    ...plan,
    origin: {
      encounterId: ENCOUNTER_ID,
      occurrenceId: testUuid(0xa09),
      commandId: testUuid(0xa0a),
      sourceActorId
    },
    sourceCharacterId: CASTER_ID,
    sourceLabel: 'Ward',
    lifetimeScope: 'ENCOUNTER'
  })
  return prepareActiveRuleEffectRecord({
    id: crypto.randomUUID(),
    owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: holderActorId },
    definition,
    lifecycle,
    currentEffects: [],
    occurredAt: '2026-01-01T00:00:00.000Z'
  })
}

const passes = (wardId: string, holderActorId: string) => ({
  origin: { kind: 'WARD' as const, effectId: wardId, holderActorId }
})

const immuneWards = () => ({
  [HOLDER_ID]: [ward(WARD_ID, HOLDER_ID, withGateSuccessImmunity(srdWarding))],
  [OTHER_HOLDER_ID]: [ward(OTHER_WARD_ID, OTHER_HOLDER_ID, withGateSuccessImmunity(srdWarding))]
})

function check(
  entries: {
    actorId: string
    passedGate?: ReturnType<typeof passes>
    immunities?: ReturnType<typeof immunity>[]
  }[],
  stored: Record<string, ReturnType<typeof ward>[]> = immuneWards()
) {
  return requireRayWardImmunities({
    caster,
    entries: entries.map(({ actorId, passedGate, immunities = [] }) => ({
      actorId,
      passedGate,
      immunities
    })),
    readHolderEffects: async (actorId) => stored[actorId] ?? []
  })
}

const freed = (wardId = WARD_ID, holderActorId = HOLDER_ID) => ({
  actorId: holderActorId,
  passedGate: passes(wardId, holderActorId),
  immunities: [immunity(wardId, holderActorId)]
})

describe('requireRayWardImmunities', () => {
  it('accepts one immunity for a ray that passed, and one for two rays on the same holder', async () => {
    await expect(check([freed()])).resolves.toBeUndefined()
    await expect(
      check([freed(), { actorId: HOLDER_ID, passedGate: passes(WARD_ID, HOLDER_ID) }])
    ).resolves.toBeUndefined()
  })

  it('accepts a list where only the rays that passed carry an immunity', async () => {
    await expect(
      check([{ actorId: HOLDER_ID }, freed(OTHER_WARD_ID, OTHER_HOLDER_ID)])
    ).resolves.toBeUndefined()
  })

  it('refuses a passed ray whose immunity is missing', async () => {
    await expect(
      check([{ actorId: HOLDER_ID, passedGate: passes(WARD_ID, HOLDER_ID) }])
    ).rejects.toThrow(REFUSAL)
  })

  it('refuses an immunity for a ray that passed no ward', async () => {
    await expect(
      check([{ actorId: HOLDER_ID, immunities: [immunity(WARD_ID, HOLDER_ID)] }])
    ).rejects.toThrow(REFUSAL)
  })

  it('refuses a second immunity on a holder whose ward an earlier ray already freed the caster of', async () => {
    await expect(check([freed(), freed()])).rejects.toThrow(REFUSAL)
  })

  it('refuses an immunity keyed to another ward, or written by another source', async () => {
    await expect(
      check([
        {
          actorId: HOLDER_ID,
          passedGate: passes(WARD_ID, HOLDER_ID),
          immunities: [immunity(OTHER_WARD_ID, HOLDER_ID)]
        }
      ])
    ).rejects.toThrow(REFUSAL)
    await expect(
      check([
        {
          actorId: HOLDER_ID,
          passedGate: passes(WARD_ID, HOLDER_ID),
          immunities: [immunity(WARD_ID, HOLDER_ID, WARDER_ID)]
        }
      ])
    ).rejects.toThrow(REFUSAL)
  })

  it('refuses a pass naming another holder than the ray’s creature', async () => {
    await expect(
      check([
        {
          actorId: HOLDER_ID,
          passedGate: passes(OTHER_WARD_ID, OTHER_HOLDER_ID),
          immunities: [immunity(OTHER_WARD_ID, OTHER_HOLDER_ID)]
        }
      ])
    ).rejects.toThrow('Live Session ray ward holder mismatch.')
  })

  it('refuses an immunity for a stored ward that authors none, and owes none for it', async () => {
    const plain = { [HOLDER_ID]: [ward(WARD_ID, HOLDER_ID, srdWarding)] }
    await expect(check([freed()], plain)).rejects.toThrow(REFUSAL)
    await expect(
      check([{ actorId: HOLDER_ID, passedGate: passes(WARD_ID, HOLDER_ID) }], plain)
    ).resolves.toBeUndefined()
  })
})
