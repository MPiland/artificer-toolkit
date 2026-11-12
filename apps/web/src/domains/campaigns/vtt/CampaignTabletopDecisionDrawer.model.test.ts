import { describe, expect, it } from 'vitest'
import { pendingEncounterRuleOccurrenceSummaryDtoSchema } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { validated } from '../../../test/validatedFixture'
import {
  addedDieEntries,
  decisionTitle,
  onHitChoiceTitle,
  onHitOptionLabel,
  rollPromptText,
  timedReactionOffer
} from './CampaignTabletopDecisionDrawer.model'

describe('timedReactionOffer (D207)', () => {
  const answerBy = '2026-11-02T12:00:05.000Z'
  const head = {
    occurrenceId: '11111111-1111-4111-8111-111111111111',
    occurrenceVersion: 2,
    encounterVersion: 4
  }
  const reaction = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
    ...head,
    kind: 'REACTION_CHOICE',
    targetActorId: '22222222-2222-4222-8222-222222222222',
    options: [
      { optionId: 'a'.repeat(64), actionId: 'shield' },
      { optionId: 'b'.repeat(64), actionId: 'counterspell' }
    ],
    allowedResponses: ['DECLINE', 'OPTION']
  })
  const window = validated(pendingEncounterRuleOccurrenceSummaryDtoSchema)({
    ...head,
    kind: 'ROLL_WINDOW',
    rollerActorId: '33333333-3333-4333-8333-333333333333',
    requestId: 'window-1',
    d20: { selectedNatural: 10, total: 14 },
    options: [
      { optionId: 'c'.repeat(64), label: 'Cutting Words', count: 1, faces: 6, sign: 'SUBTRACT' }
    ],
    allowedResponses: ['ROLL_WINDOW_DECLINE', 'ROLL_WINDOW_USE']
  })

  it('takes the first offered reaction on Enter and declines on Esc, by the server deadline', () => {
    expect(timedReactionOffer({ ...reaction, answerBy })).toEqual({
      answerBy: Date.parse(answerBy),
      take: { kind: 'OPTION', optionId: 'a'.repeat(64) },
      decline: { kind: 'DECLINE' }
    })
  })

  it('uses a reactor’s first held die in a d20 window, without faces', () => {
    expect(timedReactionOffer({ ...window, answerBy })).toEqual({
      answerBy: Date.parse(answerBy),
      take: { kind: 'ROLL_WINDOW_USE', requestId: 'window-1', optionId: 'c'.repeat(64) },
      decline: { kind: 'ROLL_WINDOW_DECLINE', requestId: 'window-1' }
    })
  })

  it('leaves untimed: a roller’s own window and a reaction offer with no deadline', () => {
    expect(timedReactionOffer(window)).toBeNull()
    expect(timedReactionOffer(reaction)).toBeNull()
  })
})

describe('decisionTitle', () => {
  it('titles a pending area as its saves', () => {
    expect(decisionTitle('AREA_SAVES')).toBe('Area saves')
  })

  it('titles a committed attack’s reaction offer as a reaction', () => {
    expect(decisionTitle('REACTION_OFFER')).toBe('Reaction available')
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
