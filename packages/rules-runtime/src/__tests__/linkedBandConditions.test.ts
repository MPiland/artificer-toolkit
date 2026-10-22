import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { EFFECT_KIND } from '@artificer-toolkit/shared/core'
import type { FailureMarginRiderAuthored } from '@artificer-toolkit/shared/authored'

import { withLinkedDependents } from '../activeEffectLinks.js'
import { discoverEncounterEventHooks } from '../events/encounterEventHooks.js'
import {
  marginRiderPlan,
  timedBandConditions
} from '../systems/dnd5e/effectActionBandConditions.js'
import { ENCOUNTER_ID, srdCondition, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'

/**
 * SPELLS-33 T4i3e (D172): a timed condition of a gated band is its own active effect, and one that
 * lasts only while a sibling holds is linked to it, so whichever seam ends the sibling ends it.
 */

const POISONED = srdCondition('Poisoned')
const PARALYZED = srdCondition('Paralyzed')
const FIRST = testUuid(0x2700)
const SECOND = testUuid(0x2701)
const THIRD = testUuid(0x2702)
const FOURTH = testUuid(0x2704)
const hour = (id: string) => ({ id, durationKind: 'HOUR' as const, amount: 1 })

type Save = Parameters<typeof timedBandConditions>[0]
type Condition = Extract<
  Extract<Save['onFailure'], { kind: 'OUTCOMES' }>['outcomes'][number],
  { effectKind: 'CONDITION' }
>

const condition = (
  id: string,
  conditionId: string,
  timing: Pick<Condition, 'duration' | 'endsWithOutcomeId'>
): Condition => ({
  id,
  effectKind: 'CONDITION',
  conditionId,
  recordsSource: false,
  fleesSource: false,
  ...timing
})

const band = (outcomes: readonly Condition[]): Save => ({
  onSuccess: { kind: 'END' },
  onFailure: {
    kind: 'OUTCOMES',
    endCurrent: false,
    resultKind: 'SEQUENCE',
    outcomes: [...outcomes]
  }
})

describe('timedBandConditions (SPELLS-33 T4i3e)', () => {
  it('times nothing in a band that times no condition', () => {
    expect(timedBandConditions(band([condition(FIRST, POISONED, {})]))).toBeNull()
  })

  it('gives each condition its own duration, the linked one as the rider', () => {
    const timed = timedBandConditions(
      band([
        condition(FIRST, POISONED, { duration: hour(testUuid(0x2710)) }),
        condition(SECOND, PARALYZED, { duration: hour(testUuid(0x2711)), endsWithOutcomeId: FIRST })
      ])
    )
    expect(timed?.primary).toMatchObject({ condition: { id: FIRST }, turns: 600 })
    expect(timed?.riders).toMatchObject([
      {
        compiledEntryId: SECOND,
        frozenGraphNodeId: 'rider-condition-duration',
        initialRemaining: 600,
        endsWith: 'PRIMARY'
      }
    ])
  })

  it('holds three or more timed conditions, each rider ordered after the one it ends with', () => {
    // Authored out of order: the chain's last link first, a fan-out rider between.
    const timed = timedBandConditions(
      band([
        condition(THIRD, POISONED, { duration: hour(testUuid(0x2712)), endsWithOutcomeId: SECOND }),
        condition(FOURTH, PARALYZED, {
          duration: hour(testUuid(0x2713)),
          endsWithOutcomeId: FIRST
        }),
        condition(SECOND, PARALYZED, {
          duration: hour(testUuid(0x2711)),
          endsWithOutcomeId: FIRST
        }),
        condition(FIRST, POISONED, { duration: hour(testUuid(0x2710)) })
      ])
    )
    expect(timed?.primary.condition.id).toBe(FIRST)
    expect(
      timed?.riders.map(({ compiledEntryId, frozenGraphNodeId, endsWith }) => [
        compiledEntryId,
        frozenGraphNodeId,
        endsWith
      ])
    ).toEqual([
      [FOURTH, 'rider-condition-duration', 'PRIMARY'],
      [SECOND, 'rider-condition-duration-2', 'PRIMARY'],
      [THIRD, 'rider-condition-duration-3', 1]
    ])
  })

  const refusals: [string, Condition[], RegExp][] = [
    [
      'a condition that ends with itself',
      [condition(FIRST, POISONED, { duration: hour(testUuid(0x2710)), endsWithOutcomeId: FIRST })],
      /cannot end with itself/
    ],
    [
      'a link to an outcome that is not a timed sibling condition',
      [condition(FIRST, POISONED, { duration: hour(testUuid(0x2710)), endsWithOutcomeId: THIRD })],
      /ends with a timed sibling condition/
    ],
    [
      'two conditions that end with each other',
      [
        condition(FIRST, POISONED, { duration: hour(testUuid(0x2710)), endsWithOutcomeId: SECOND }),
        condition(SECOND, PARALYZED, { duration: hour(testUuid(0x2711)), endsWithOutcomeId: FIRST })
      ],
      /cannot end with each other/
    ],
    [
      'a link without a duration',
      [
        condition(FIRST, POISONED, { duration: hour(testUuid(0x2710)) }),
        condition(SECOND, PARALYZED, { endsWithOutcomeId: FIRST })
      ],
      /needs its own duration/
    ],
    [
      'a chain of conditions that ends with itself',
      [
        condition(FIRST, POISONED, { duration: hour(testUuid(0x2710)) }),
        condition(SECOND, PARALYZED, {
          duration: hour(testUuid(0x2711)),
          endsWithOutcomeId: THIRD
        }),
        condition(THIRD, POISONED, { duration: hour(testUuid(0x2712)), endsWithOutcomeId: SECOND })
      ],
      /cannot end with each other/
    ]
  ]
  it.each(refusals)('refuses %s by name', (_name, outcomes, message) => {
    expect(() => timedBandConditions(band(outcomes))).toThrow(message)
  })

  it('times only the conditions it names, leaving the rest to apply untimed', () => {
    const timed = timedBandConditions(
      band([
        condition(FIRST, POISONED, { duration: hour(testUuid(0x2710)) }),
        condition(SECOND, PARALYZED, {})
      ])
    )
    expect(timed?.primary).toMatchObject({ condition: { id: FIRST }, turns: 600 })
    expect(timed?.riders).toEqual([])
  })

  it('refuses a link to a sibling the band leaves untimed', () => {
    expect(() =>
      timedBandConditions(
        band([
          condition(FIRST, POISONED, {
            duration: hour(testUuid(0x2710)),
            endsWithOutcomeId: SECOND
          }),
          condition(SECOND, PARALYZED, {})
        ])
      )
    ).toThrow(/ends with a timed sibling condition/)
  })

  it('refuses a timing in the success band', () => {
    expect(() =>
      timedBandConditions({
        onFailure: { kind: 'END' },
        onSuccess: band([condition(FIRST, POISONED, { duration: hour(testUuid(0x2710)) })])
          .onFailure
      })
    ).toThrow(/belong to the band of the save/)
  })
})

describe('marginRiderPlan (SPELLS-33 T4i3f)', () => {
  const rider = (endsWithOutcomeId?: string): FailureMarginRiderAuthored => ({
    id: SECOND,
    failedBy: 5,
    ...(endsWithOutcomeId ? { endsWithOutcomeId } : {}),
    outcomes: [{ id: THIRD, effectKind: EFFECT_KIND.CONDITION, conditionId: PARALYZED }],
    lifecycle: {}
  })

  it('links a rider to the one condition it names, and leaves any other rider unlinked', () => {
    expect(marginRiderPlan(rider(FIRST), FIRST).endsWith).toBe('PRIMARY')
    expect(marginRiderPlan(rider(), FIRST).endsWith).toBeNull()
    expect(marginRiderPlan(rider()).endsWith).toBeNull()
  })

  it('refuses a link to anything but the save’s one condition, by name', () => {
    expect(() => marginRiderPlan(rider(THIRD), FIRST)).toThrow(/ends with the one condition/)
    expect(() => marginRiderPlan(rider(FIRST))).toThrow(/ends with the one condition/)
  })
})

describe('the rider-creation roots (SPELLS-33 T4i3e)', () => {
  const roots = [
    'apps/session-worker/src/nativeEncounterSettlement.ts',
    'apps/session-worker/src/nativeAreaCommitPlan.ts',
    'packages/rules-runtime/src/encounterTurnLegendaryAction.ts',
    'packages/rules-runtime/src/encounterMovementReactionEffects.ts'
  ]
  it.each(roots)('%s creates the riders through createLinkedRiders only', (path) => {
    const source = readFileSync(
      fileURLToPath(new URL(`../../../../${path}`, import.meta.url)),
      'utf8'
    )
    // A presence check on the planned effects is no creation.
    const uses = source.match(/(?<!\|\| )effects\.riderEffects/g) ?? []
    const linked = source.match(/createLinkedRiders\(\s*effects\.riderEffects/g) ?? []
    expect(linked.length).toBeGreaterThan(0)
    expect(uses.length).toBe(linked.length)
  })
})

describe('ending an effect ends the effects linked to it (SPELLS-33 T4i3e)', () => {
  const owner = {
    kind: 'ENCOUNTER_ACTOR' as const,
    encounterId: ENCOUNTER_ID,
    targetActorId: testUuid(0x2720)
  }
  const held = (id: string, createdOrdinal: number, linkedEffectId: string | null = null) =>
    activeEffect({
      id,
      owner,
      createdOrdinal,
      linkedEffectId,
      endOnEvents: linkedEffectId ? [] : ['ON_ATTACK_ROLL'],
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: POISONED, baselinePresent: false }
      ]
    })
  const primary = held(FIRST, 1)
  const rider = held(SECOND, 2, FIRST)
  const bystander = held(THIRD, 3)
  const attack = [
    { kind: 'ACTION' as const, attackRoll: true, spellCast: false, againstEnemy: false }
  ]

  it('adds dependents transitively, in held order', () => {
    const grandchild = held(testUuid(0x2703), 4, SECOND)
    const order = [grandchild, bystander, rider, primary]
    expect(withLinkedDependents([primary], order).map(({ id }) => id)).toEqual([
      grandchild.id,
      rider.id,
      primary.id
    ])
    expect(withLinkedDependents([], order)).toEqual([])
    expect(withLinkedDependents([bystander], order)).toEqual([bystander])
  })

  it('ends the rider with its primary in one discovery, and not the other way round', () => {
    const both = discoverEncounterEventHooks({
      effects: [primary, rider, bystander],
      events: attack
    })
    expect(both.ended.map(({ id }) => id)).toEqual([FIRST, SECOND, THIRD])
    expect(discoverEncounterEventHooks({ effects: [rider], events: attack }).ended).toEqual([])
  })
})
