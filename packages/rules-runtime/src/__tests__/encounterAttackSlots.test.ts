import { adultRedDragon } from '@artificer-toolkit/source-data/srd/creatures/adult-red-dragon.js'
import { brownBear } from '@artificer-toolkit/source-data/srd/creatures/brown-bear.js'
import { chimera } from '@artificer-toolkit/source-data/srd/creatures/chimera.js'
import { drider } from '@artificer-toolkit/source-data/srd/creatures/drider.js'
import { describe, expect, it } from 'vitest'
import {
  attackSlotConditionHolds,
  attackSlotTotal,
  evaluateAttackSlots,
  isAttackSlotFiller,
  type AttackSlotAlternatives,
  type AttackSlotAttack
} from '../encounterAttackSlots.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'

const TARGET = '00000000-0000-4000-8000-0000000c0001'
const OTHER = '00000000-0000-4000-8000-0000000c0002'

/** The slot alternatives of a SRD Creature's Multiattack, as authored. */
function multiattack(creature: {
  features: ReadonlyArray<{ label: string; attackSlots?: { alternatives: AttackSlotAlternatives } }>
}) {
  const alternatives = creature.features.find(({ label }) => label === 'Multiattack')?.attackSlots
  if (!alternatives) throw new Error('The Creature authors no Multiattack slots.')
  return alternatives.alternatives
}

/** The attacks of the named Features, in order, against one target. */
function attacksOf(
  creature: { features: ReadonlyArray<{ id: string; label: string }> },
  ...labels: string[]
): AttackSlotAttack[] {
  return labels.map((label) => {
    const feature = creature.features.find((candidate) => candidate.label === label)
    if (!feature) throw new Error(`No Feature ${label}.`)
    return { featureId: feature.id, attack: true, targetIds: [TARGET], hit: true, targetSize: null }
  })
}

describe('a Brown Bear Multiattack', () => {
  const slots = multiattack(brownBear)

  it('takes one bite and one claws attack', () => {
    expect(evaluateAttackSlots(DND5E_SYSTEM_ID, slots, attacksOf(brownBear, 'Bite'))).toEqual({
      fits: true,
      incomplete: true
    })
    expect(
      evaluateAttackSlots(DND5E_SYSTEM_ID, slots, attacksOf(brownBear, 'Claws', 'Bite'))
    ).toEqual({
      fits: true,
      incomplete: false
    })
  })

  it("can't bite twice", () => {
    expect(
      evaluateAttackSlots(DND5E_SYSTEM_ID, slots, attacksOf(brownBear, 'Bite', 'Bite')).fits
    ).toBe(false)
  })
})

describe('a Drider Multiattack', () => {
  const slots = multiattack(drider)

  it('makes three weapon attacks with one weapon', () => {
    expect(
      evaluateAttackSlots(
        DND5E_SYSTEM_ID,
        slots,
        attacksOf(drider, 'Longsword', 'Longsword', 'Longsword')
      )
    ).toEqual({ fits: true, incomplete: false })
    expect(
      evaluateAttackSlots(
        DND5E_SYSTEM_ID,
        slots,
        attacksOf(drider, 'Longbow', 'Longbow', 'Longbow')
      ).fits
    ).toBe(true)
    expect(
      evaluateAttackSlots(DND5E_SYSTEM_ID, slots, attacksOf(drider, 'Longsword', 'Longbow')).fits
    ).toBe(false)
  })

  it('offers the Bite swap once, in place of one weapon attack', () => {
    expect(
      evaluateAttackSlots(
        DND5E_SYSTEM_ID,
        slots,
        attacksOf(drider, 'Longsword', 'Bite', 'Longsword')
      )
    ).toEqual({ fits: true, incomplete: false })
    expect(
      evaluateAttackSlots(DND5E_SYSTEM_ID, slots, attacksOf(drider, 'Longbow', 'Bite')).fits
    ).toBe(true)
    expect(
      evaluateAttackSlots(DND5E_SYSTEM_ID, slots, attacksOf(drider, 'Longsword', 'Bite', 'Bite'))
        .fits
    ).toBe(false)
    expect(
      evaluateAttackSlots(
        DND5E_SYSTEM_ID,
        slots,
        attacksOf(drider, 'Longsword', 'Longsword', 'Bite', 'Longsword')
      ).fits
    ).toBe(false)
  })
})

describe('an adult dragon Multiattack with Frightful Presence', () => {
  const slots = multiattack(adultRedDragon)

  it('uses Frightful Presence only first', () => {
    expect(
      evaluateAttackSlots(DND5E_SYSTEM_ID, slots, attacksOf(adultRedDragon, 'Frightful Presence'))
        .fits
    ).toBe(true)
    expect(
      evaluateAttackSlots(
        DND5E_SYSTEM_ID,
        slots,
        attacksOf(adultRedDragon, 'Bite', 'Frightful Presence')
      ).fits
    ).toBe(false)
    expect(
      evaluateAttackSlots(
        DND5E_SYSTEM_ID,
        slots,
        attacksOf(adultRedDragon, 'Frightful Presence', 'Frightful Presence')
      ).fits
    ).toBe(false)
  })

  it('needs no Frightful Presence to finish', () => {
    expect(
      evaluateAttackSlots(DND5E_SYSTEM_ID, slots, attacksOf(adultRedDragon, 'Bite', 'Claw', 'Claw'))
    ).toEqual({
      fits: true,
      incomplete: false
    })
    expect(
      evaluateAttackSlots(
        DND5E_SYSTEM_ID,
        slots,
        attacksOf(adultRedDragon, 'Frightful Presence', 'Claw', 'Claw', 'Bite')
      )
    ).toEqual({ fits: true, incomplete: false })
  })
})

describe('a Chimera Multiattack with a Recharge breath', () => {
  const slots = multiattack(chimera)

  it('breathes in place of the bite or the horns, never both', () => {
    expect(
      evaluateAttackSlots(
        DND5E_SYSTEM_ID,
        slots,
        attacksOf(chimera, 'Fire Breath (Recharge 5-6)', 'Horns', 'Claws')
      ).fits
    ).toBe(true)
    expect(
      evaluateAttackSlots(
        DND5E_SYSTEM_ID,
        slots,
        attacksOf(chimera, 'Bite', 'Fire Breath (Recharge 5-6)')
      ).fits
    ).toBe(true)
    expect(
      evaluateAttackSlots(
        DND5E_SYSTEM_ID,
        slots,
        attacksOf(chimera, 'Bite', 'Horns', 'Fire Breath (Recharge 5-6)')
      ).fits
    ).toBe(false)
  })

  it('names the breath as a slot filler, so its charge decides whether it is offered', () => {
    const breath = chimera.features.find(({ label }) => label === 'Fire Breath (Recharge 5-6)')
    expect(isAttackSlotFiller(slots, breath?.id ?? '')).toBe(true)
    expect(attackSlotTotal(slots)).toBe(3)
  })
})

describe('a conditional slot', () => {
  const attack = (overrides: Partial<AttackSlotAttack>): AttackSlotAttack => ({
    featureId: 'strike',
    attack: true,
    targetIds: [TARGET],
    hit: true,
    targetSize: null,
    ...overrides
  })
  const afterHits: AttackSlotAlternatives = [
    {
      slots: [
        { count: 2, fillers: [{ kind: 'FEATURE', featureId: 'strike' }] },
        {
          count: 1,
          fillers: [{ kind: 'FEATURE', featureId: 'crush' }],
          condition: { kind: 'EARLIER_SLOTS_HIT_SAME_TARGET' }
        }
      ]
    }
  ]

  it('is offered only while every earlier attack hit the same target', () => {
    const crush = attack({ featureId: 'crush' })
    expect(
      evaluateAttackSlots(DND5E_SYSTEM_ID, afterHits, [attack({}), attack({}), crush]).fits
    ).toBe(true)
    expect(
      evaluateAttackSlots(DND5E_SYSTEM_ID, afterHits, [attack({}), attack({ hit: false }), crush])
        .fits
    ).toBe(false)
    expect(
      evaluateAttackSlots(DND5E_SYSTEM_ID, afterHits, [
        attack({}),
        attack({ targetIds: [OTHER] }),
        crush
      ]).fits
    ).toBe(false)
    expect(evaluateAttackSlots(DND5E_SYSTEM_ID, afterHits, [crush]).fits).toBe(false)
  })

  it('checks the target size of the attack that takes the slot', () => {
    const small: AttackSlotAlternatives = [
      {
        slots: [
          {
            count: 1,
            fillers: [{ kind: 'FEATURE', featureId: 'swallow' }],
            condition: { kind: 'TARGET_SIZE_AT_MOST', size: 'MEDIUM' }
          }
        ]
      }
    ]
    const swallow = (targetSize: string | null) => attack({ featureId: 'swallow', targetSize })
    expect(evaluateAttackSlots(DND5E_SYSTEM_ID, small, [swallow('MEDIUM')]).fits).toBe(true)
    expect(evaluateAttackSlots(DND5E_SYSTEM_ID, small, [swallow('LARGE')]).fits).toBe(false)
  })
})

describe('a hold gate (appliesWhen)', () => {
  const made = (overrides: Partial<AttackSlotAttack>): AttackSlotAttack => ({
    featureId: 'slam',
    attack: true,
    targetIds: [TARGET],
    hit: true,
    targetSize: 'MEDIUM',
    ...overrides
  })
  const bothHit = { kind: 'EARLIER_SLOTS_HIT_SAME_TARGET' } as const

  it('never holds for a lone attack, so a Slam outside a Multiattack grapples nothing', () => {
    expect(attackSlotConditionHolds(DND5E_SYSTEM_ID, bothHit, made({}), [])).toBe(false)
  })

  it('holds when every earlier attack hit the same target', () => {
    expect(attackSlotConditionHolds(DND5E_SYSTEM_ID, bothHit, made({}), [made({})])).toBe(true)
  })

  it('does not hold after a miss or against another target', () => {
    expect(
      attackSlotConditionHolds(DND5E_SYSTEM_ID, bothHit, made({}), [made({ hit: false })])
    ).toBe(false)
    expect(
      attackSlotConditionHolds(DND5E_SYSTEM_ID, bothHit, made({}), [made({ targetIds: [OTHER] })])
    ).toBe(false)
  })

  it('reads the size of the attack it gates', () => {
    const small = { kind: 'TARGET_SIZE_AT_MOST', size: 'MEDIUM' } as const
    expect(
      attackSlotConditionHolds(DND5E_SYSTEM_ID, small, made({ targetSize: 'MEDIUM' }), [])
    ).toBe(true)
    expect(
      attackSlotConditionHolds(DND5E_SYSTEM_ID, small, made({ targetSize: 'LARGE' }), [])
    ).toBe(false)
  })
})
