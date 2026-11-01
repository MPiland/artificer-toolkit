import { describe, expect, it } from 'vitest'
import {
  addedDieEntries,
  decisionTitle,
  onHitChoiceTitle,
  onHitOptionLabel,
  rollPromptText
} from './CampaignTabletopDecisionDrawer.model'

describe('decisionTitle', () => {
  it('titles a pending area as its saves', () => {
    expect(decisionTitle('AREA_SAVES')).toBe('Area saves')
  })
})

describe('on-hit choice text', () => {
  const rider = '11111111-1111-4111-8111-111111111111'
  const stun = {
    kind: 'RESOURCE_POOL',
    optionId: 'a'.repeat(64),
    riderId: rider,
    riderLabel: 'Stunning Strike',
    poolId: 'CLASS:monk:ki',
    cost: 1
  } as const
  const smite = {
    kind: 'SPELL_SLOT',
    optionId: 'b'.repeat(64),
    riderId: '22222222-2222-4222-8222-222222222222',
    riderLabel: 'Divine Smite',
    slotLevel: 2
  } as const

  it('titles one offered rider by its name and each option by name and cost', () => {
    expect(onHitChoiceTitle([stun])).toBe('Stunning Strike?')
    expect(onHitOptionLabel(stun)).toBe('Stunning Strike: spend 1 from a resource pool')
    expect(onHitOptionLabel(smite)).toBe('Divine Smite: spend a level 2 slot')
  })

  it('titles several different riders generically so each option names its own', () => {
    expect(onHitChoiceTitle([stun, smite])).toBe('Add an on-hit effect')
  })
})

describe('rollPromptText', () => {
  it('titles a pending retarget as choosing a new target', () => {
    expect(decisionTitle('ATTACK_RETARGET_CHOICE')).toBe('Choose a new target')
  })

  it('names a death save with the saves already held', () => {
    expect(rollPromptText('Aria', { kind: 'DEATH_SAVE', successes: 1, failures: 2 })).toBe(
      'Death save for Aria (1 success, 2 failures, no modifiers)'
    )
  })

  it('names a basic action check with its action, check and DC', () => {
    expect(
      rollPromptText('Aria', {
        kind: 'BASIC_ACTION_CHECK',
        actionLabel: 'First Aid',
        checkLabel: 'Wisdom (Medicine)',
        dc: 10
      })
    ).toBe('First Aid: Wisdom (Medicine) DC 10')
  })

  it('names a massive damage save with the damage that prompted it and its DC', () => {
    expect(
      rollPromptText('Aria', {
        kind: 'MASSIVE_DAMAGE',
        damage: { amount: 18, typeLabel: 'Fire' },
        sourceLabel: 'Fire Bolt',
        dc: 15
      })
    ).toBe('Massive damage save for Aria: took 18 fire from Fire Bolt (DC 15)')
  })

  it('falls back to naming the roller', () => {
    expect(rollPromptText('Aria', undefined)).toBe('Roll for Aria')
  })
})

describe('addedDieEntries', () => {
  it('labels each added die with its sign, size and source, in order', () => {
    expect(
      addedDieEntries([
        { label: 'Bane', count: 1, faces: 4, sign: 'SUBTRACT' },
        { label: 'Bless', count: 2, faces: 4, sign: 'ADD' }
      ])
    ).toEqual([
      { label: '−d4 Bane', faces: 4 },
      { label: '+d4 Bless', faces: 4 },
      { label: '+d4 Bless', faces: 4 }
    ])
  })
})
