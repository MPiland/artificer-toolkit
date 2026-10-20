import { describe, expect, it } from 'vitest'

import type { EncounterAttackActionStateDto } from '@artificer-toolkit/schema/projections/encounterAttackAction'
import type { FacetDto } from '@artificer-toolkit/schema/shared/facet'

import { encounterActionRequirementsHold } from '../encounterActionRequirements.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'

const TURN = 3
const TARGET_ID = testUuid(0xf501)
const MAIN_HAND_ITEM = testUuid(0xf502)
const OFF_HAND_ITEM = testUuid(0xf503)
const LIGHT_MELEE = ['LIGHT', 'MELEE']

/** "Took the Attack action this turn with a weapon having `properties`, other than this item." */
function requirementFor(properties: string[]) {
  return {
    id: testUuid(0xf510),
    groups: [
      {
        id: testUuid(0xf511),
        order: 1,
        contexts: [
          {
            id: testUuid(0xf512),
            order: 1,
            subject: 'CHARACTER' as const,
            conditions: [
              {
                id: testUuid(0xf513),
                order: 1,
                kind: 'PREDICATE' as const,
                constraint: 'INCLUDE' as const,
                predicateCode: 'ATTACK_ACTION_OTHER_WEAPON',
                authoringModeKind: 'SELECTED',
                properties
              }
            ]
          }
        ]
      }
    ]
  } as FacetDto
}

function attackActionWith(
  attacks: { itemInstanceId?: string; properties?: string[] }[],
  turnSequence = TURN
): EncounterAttackActionStateDto {
  return {
    kind: 'ATTACK_ACTION',
    turnSequence,
    alternatives: [{ slots: [{ count: 2, fillers: [{ kind: 'ANY_ATTACK' }] }] }],
    attacks: attacks.map(({ itemInstanceId, properties }) => ({
      actionId: 'source:ACTION:attack',
      attack: true,
      targetIds: [TARGET_ID],
      ...(itemInstanceId ? { item: { itemInstanceId, properties: properties ?? [] } } : {})
    }))
  }
}

const holds = (
  requirements: FacetDto | null | undefined,
  attackAction: EncounterAttackActionStateDto | null,
  turnSequence = TURN
) =>
  encounterActionRequirementsHold(requirements, {
    attackAction,
    turnSequence,
    actingItemInstanceId: OFF_HAND_ITEM
  })

describe('an item action that requires an Attack-action weapon attack with another item', () => {
  const requirement = requirementFor(LIGHT_MELEE)

  it('holds for an action that authors no requirement', () => {
    expect(holds(undefined, null)).toBe(true)
    expect(holds(null, null)).toBe(true)
  })

  it('holds after an Attack-action attack this turn with a different weapon that has the properties', () => {
    expect(
      holds(
        requirement,
        attackActionWith([
          { itemInstanceId: MAIN_HAND_ITEM, properties: ['LIGHT', 'MELEE', 'FINESSE'] }
        ])
      )
    ).toBe(true)
  })

  it('fails when no Attack action is open', () => {
    expect(holds(requirement, null)).toBe(false)
  })

  it('fails when the open Attack action is from an earlier turn', () => {
    expect(
      holds(
        requirement,
        attackActionWith([{ itemInstanceId: MAIN_HAND_ITEM, properties: LIGHT_MELEE }], TURN - 1)
      )
    ).toBe(false)
  })

  it('fails when the only qualifying attack was made with this very item', () => {
    expect(
      holds(
        requirement,
        attackActionWith([{ itemInstanceId: OFF_HAND_ITEM, properties: LIGHT_MELEE }])
      )
    ).toBe(false)
  })

  it('fails when the Attack-action weapon lacks one of the properties', () => {
    expect(
      holds(
        requirement,
        attackActionWith([{ itemInstanceId: MAIN_HAND_ITEM, properties: ['MELEE'] }])
      )
    ).toBe(false)
  })

  it('fails when the attack named no item (an unarmed strike)', () => {
    expect(holds(requirement, attackActionWith([{}]))).toBe(false)
  })

  it('holds when any one attack of the Attack action qualifies', () => {
    expect(
      holds(
        requirement,
        attackActionWith([
          { itemInstanceId: OFF_HAND_ITEM, properties: LIGHT_MELEE },
          { itemInstanceId: MAIN_HAND_ITEM, properties: LIGHT_MELEE }
        ])
      )
    ).toBe(true)
  })
})
