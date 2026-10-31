import {
  reusableDefinitionDocumentDtoSchema,
  type ReusableDefinitionCurrentDto
} from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { creatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { CharacterState } from '@artificer-toolkit/shared/subjects/authored'
import { SRD_CONDITION_RULE_STATE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import {
  settleCharacterConditionMaximum,
  settleCreatureConditionMaximum
} from '../conditionMaximumSettlement.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import type { EncounterPersistenceTransaction } from '../ports.js'

const EXHAUSTION = SRD_CONDITION_TYPES.find(({ code }) => code === 'EXHAUSTION')!.id
const HOLDER_ID = '00000000-0000-4000-8000-0000000c0001'
const CHARACTER_ID = '00000000-0000-4000-8000-0000000c0002'
const OWNER_USER_ID = '00000000-0000-4000-8000-0000000c0003'
const HALF = { numerator: 1, denominator: 2 }

/** The seeded Exhaustion definition, read as the published current definition. */
async function readCurrentDefinition(
  id: string,
  ownerUserId: string
): Promise<ReusableDefinitionCurrentDto | null> {
  expect(ownerUserId).toBe(OWNER_USER_ID)
  const seed = SRD_CONDITION_RULE_STATE_DEFINITIONS.find((entry) => entry.id === id)
  if (!seed) return null
  return {
    id: seed.id,
    gameSystemId: SRD_SYSTEM_ID,
    contentSourceId: '44444444-4444-4444-8444-444444444444',
    definitionFamilyKey: seed.definitionFamilyKey,
    label: seed.label,
    description: null,
    document: reusableDefinitionDocumentDtoSchema.parse(seed.document),
    checksum: checksumRuleDocument(seed.document),
    contractVersion: 1,
    version: 1,
    publishedAt: '2026-10-07T00:00:00.000Z',
    publishedBy: '55555555-5555-4555-8555-555555555555'
  }
}

const ctx = {
  db: createMemoryEncounterStore().store,
  ports: { readCurrentDefinition }
} as unknown as Parameters<typeof settleCreatureConditionMaximum>[0] &
  EncounterPersistenceTransaction

const exhausted = (level: number) => [{ conditionTypeId: EXHAUSTION, level }]
const creature = (conditions: unknown[], currentHitPoints = 20) =>
  creatureActor({ id: HOLDER_ID, snapshot: {}, maxHitPoints: 20, currentHitPoints, conditions })

describe('settling a holder’s condition maximum (SPELLS-10.T1b)', () => {
  const settleCreature = (before: unknown[], after: unknown[], currentHitPoints = 20) =>
    settleCreatureConditionMaximum(ctx, {
      before: creature(before, currentHitPoints),
      actor: creature(after, currentHitPoints),
      ownerUserId: OWNER_USER_ID,
      gameSystemId: SRD_SYSTEM_ID
    })

  it('halves a Creature’s stored maximum and holds its hit points within it at the authored level', async () => {
    const settled = await settleCreature([], exhausted(4))
    expect(settled).toMatchObject({ maximumFraction: HALF, currentHitPoints: 10 })
  })

  it('leaves a Creature below the authored level, or already within the maximum, as it was', async () => {
    const below = creature(exhausted(3))
    expect(
      await settleCreatureConditionMaximum(ctx, {
        before: creature([]),
        actor: below,
        ownerUserId: OWNER_USER_ID,
        gameSystemId: SRD_SYSTEM_ID
      })
    ).toBe(below)
    expect(await settleCreature([], exhausted(4), 6)).toMatchObject({
      maximumFraction: HALF,
      currentHitPoints: 6
    })
  })

  it('clears the stored fraction when the level falls back, keeping the hit points it left', async () => {
    const halved = await settleCreature([], exhausted(4))
    const lifted = await settleCreatureConditionMaximum(ctx, {
      before: halved,
      actor: Object.assign(creature(exhausted(3), 10), { maximumFraction: HALF }),
      ownerUserId: OWNER_USER_ID,
      gameSystemId: SRD_SYSTEM_ID
    })
    expect(lifted.kind === 'CHARACTER' ? undefined : lifted.maximumFraction).toBeUndefined()
    expect(lifted).toMatchObject({ currentHitPoints: 10 })
  })

  it('reads no definition when the conditions did not change, and treats an absent list as empty', async () => {
    const unchanged = creature([])
    const throwing = {
      ...ctx,
      ports: {
        readCurrentDefinition: () => {
          throw new Error('read a definition')
        }
      }
    } as unknown as typeof ctx
    expect(
      await settleCreatureConditionMaximum(throwing, {
        before: { ...unchanged, conditions: undefined } as never,
        actor: unchanged,
        ownerUserId: OWNER_USER_ID,
        gameSystemId: SRD_SYSTEM_ID
      })
    ).toBe(unchanged)
  })

  const sheet = (level: number, current = 40): CharacterState =>
    ({
      equipment: { inventory: [], equipped: [], attuned: [] },
      currency: [],
      hitpoints: {
        current,
        temp: 0,
        hitDice: [],
        deathSaves: { successes: 0, failures: 0, stable: false }
      },
      ...(level > 0 ? { exhaustion: { level } } : {})
    }) as CharacterState
  const settleCharacter = (before: CharacterState, state: CharacterState) =>
    settleCharacterConditionMaximum(ctx, {
      characterId: CHARACTER_ID,
      systemId: SRD_SYSTEM_ID,
      before,
      state,
      maximumHitPoints: 40,
      ownerUserId: OWNER_USER_ID
    })

  it('halves a Character’s stored maximum at the authored level and lifts it again', async () => {
    const halved = await settleCharacter(sheet(0), sheet(4))
    expect(halved.hitpoints).toMatchObject({ maximumFraction: HALF, current: 20 })
    const lifted = await settleCharacter(halved, { ...halved, exhaustion: { level: 3 } })
    expect(lifted.hitpoints.maximumFraction).toBeUndefined()
    expect(lifted.hitpoints.current).toBe(20)
  })

  it('leaves a Character whose conditions did not change untouched', async () => {
    const same = sheet(4)
    expect(await settleCharacter(same, same)).toBe(same)
  })
})
