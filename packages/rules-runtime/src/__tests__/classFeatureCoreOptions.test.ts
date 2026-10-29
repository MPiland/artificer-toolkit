import { describe, expect, it } from 'vitest'
import { compileCharge } from '@artificer-toolkit/shared/compilers'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { buildCharacterChargeRuleFact } from '../character/characterChargeRuleFacts.js'
import { buildCharacterSpellSlotRuleFacts } from '../character/characterSpellSlotRuleFacts.js'
import { evaluateDnd5e2014CharacterPolicy } from '../systems/dnd5e/characterPolicy.js'
import { evaluateDnd5eCharacterSpellSlots } from '../systems/dnd5e/characterSpellSlots.js'
import {
  SRD,
  evaluateSrdCharacter,
  srdByLabel,
  srdFeature,
  srdRegistry
} from '../testing/dnd5eSrdCharacter.js'

/**
 * SPELLS-31.T3b and T3c (D156): Divine Sense, Empty Body, Gaze of Two Minds and Divine
 * Intervention resolve from the core options a Builder author has on a class feature, with no
 * closed rule.
 */

const condition = (code: string) => SRD_CONDITION_TYPES.find((entry) => entry.code === code)!.id

function featureAction(input: {
  classLabel: string
  level: number
  featureLabel: string
  actionLabel: string
  optionLabels?: string[]
  abilities?: { CHARISMA: number }
}) {
  const character = evaluateSrdCharacter({
    ...(input.abilities ? { abilities: input.abilities } : {}),
    classes: [{ label: input.classLabel, level: input.level }],
    features: [
      srdFeature({
        owner: 'CLASS',
        classLabel: input.classLabel,
        featureLabel: input.featureLabel,
        level: input.level,
        ...(input.optionLabels ? { optionLabels: input.optionLabels } : {})
      })
    ]
  })
  const candidates = character.facts.actionCandidates.filter(
    ({ label }) => label === input.actionLabel
  )
  expect(candidates).toHaveLength(1)
  return { character, candidate: candidates[0]! }
}

describe('Paladin Divine Sense (SPELLS-31.T3b)', () => {
  it('has 1 + Charisma modifier uses per long rest', () => {
    const divineSense = srdByLabel(SRD.classes, 'Paladin').features?.find(
      ({ label }) => label === 'Divine Sense'
    )
    const charges = divineSense && 'charges' in divineSense ? divineSense.charges : undefined
    if (!charges || charges.limitKind === 'SOURCE_CHARGES')
      throw new Error('Divine Sense must author its own charges.')
    const charge = compileCharge(charges)
    expect(charge.resetKind).toBe('LONG_REST')
    const maximum = (charisma: number) => {
      const { facts } = evaluateSrdCharacter({
        abilities: { CHARISMA: charisma },
        classes: [{ label: 'Paladin', level: 1 }]
      })
      const output = evaluateDnd5e2014CharacterPolicy({
        ...facts,
        chargeCalculations: [buildCharacterChargeRuleFact(charge, 'divine-sense')]
      })
      return output.chargeMaximums.find(({ calculationId }) => calculationId === 'divine-sense')
        ?.maximum
    }
    expect(maximum(16)).toBe(4)
    expect(maximum(10)).toBe(1)
  })

  it('spends one use as an action and leaves the detection to the table', () => {
    const { candidate } = featureAction({
      classLabel: 'Paladin',
      level: 1,
      featureLabel: 'Divine Sense',
      actionLabel: 'Divine Sense',
      abilities: { CHARISMA: 16 }
    })
    expect(candidate.resourceUse).toEqual(expect.objectContaining({ cost: 1 }))
    expect(candidate.mechanicFacts.invocation.activation?.code).toBe('ACTION')
    expect(candidate.mechanicFacts.outcomes).toEqual([
      expect.objectContaining({ kind: 'EFFECT', effectKind: 'MANUAL_ADJUDICATION' })
    ])
  })
})

describe('Monk Empty Body (SPELLS-31.T3b)', () => {
  it('spends 4 ki to become invisible and resistant to all but force damage for 1 minute', () => {
    const { candidate } = featureAction({
      classLabel: 'Monk',
      level: 18,
      featureLabel: 'Empty Body',
      actionLabel: 'Empty Body'
    })
    expect(candidate.resourceUse).toEqual(expect.objectContaining({ cost: 4 }))
    expect(candidate.mechanicFacts.outcomes).toEqual([
      expect.objectContaining({ kind: 'CONDITION', conditionId: condition('INVISIBLE') }),
      expect.objectContaining({ kind: 'EFFECT', effectKind: 'APPLY_GRANT' })
    ])
  })
})

describe('Warlock Gaze of Two Minds (SPELLS-31.T3b)', () => {
  it('leaves the warlock blinded and deafened until the end of their next turn', () => {
    const { candidate } = featureAction({
      classLabel: 'Warlock',
      level: 15,
      featureLabel: 'Eldritch Invocations',
      actionLabel: 'Gaze of Two Minds',
      optionLabels: ['Gaze of Two Minds']
    })
    expect(candidate.mechanicFacts.invocation.activation?.code).toBe('ACTION')
    expect(candidate.mechanicFacts.outcomes).toEqual([
      expect.objectContaining({ kind: 'CONDITION', conditionId: condition('BLINDED') }),
      expect.objectContaining({ kind: 'CONDITION', conditionId: condition('DEAFENED') })
    ])
  })
})

describe('Cleric Divine Intervention (SPELLS-31.T3c)', () => {
  it('spends its one long-rest use as an action and hands the roll and lockout to the table', () => {
    const intervention = srdByLabel(SRD.classes, 'Cleric').features?.find(
      ({ label }) => label === 'Divine Intervention'
    )
    expect(intervention?.charges).toEqual(
      expect.objectContaining({ limitKind: 'FIXED_AMOUNT', amount: 1, resetKind: 'LONG_REST' })
    )
    const { candidate } = featureAction({
      classLabel: 'Cleric',
      level: 10,
      featureLabel: 'Divine Intervention',
      actionLabel: 'Divine Intervention'
    })
    expect(candidate.resourceUse).toEqual(expect.objectContaining({ cost: 1 }))
    expect(candidate.mechanicFacts.invocation.activation?.code).toBe('ACTION')
    expect(candidate.mechanicFacts.outcomes).toEqual([
      expect.objectContaining({ kind: 'EFFECT', effectKind: 'MANUAL_ADJUDICATION' })
    ])
    const path = intervention?.effects?.[0]?.paths[0]
    const [outcome] = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []
    if (outcome?.effectKind !== 'MANUAL_ADJUDICATION')
      throw new Error('Divine Intervention must stay a manual adjudication.')
    expect(outcome.reasonCode).toBe('GM_CHOICE')
    expect(outcome.instructions).toMatch(/percentile dice/)
    expect(outcome.instructions).toMatch(/cleric level/)
    expect(outcome.instructions).toMatch(/7 days/)
  })
})

describe("Thief's Reflexes (SPELLS-31.T5o2, D187a)", () => {
  it('is a passive GM ruling for the extra round-one turn, with no closed rule', () => {
    const reflexes = srdByLabel(SRD.classes, 'Thief').features?.find(
      ({ label }) => label === "Thief's Reflexes"
    )
    const [effect] = reflexes?.effects ?? []
    expect(effect?.invocation.kind).toBe('PASSIVE')
    const path = effect?.paths[0]
    const outcomes = path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []
    expect(outcomes).toHaveLength(1)
    const [outcome] = outcomes
    if (outcome?.effectKind !== 'MANUAL_ADJUDICATION')
      throw new Error("Thief's Reflexes must stay a manual adjudication.")
    expect(outcome.instructions).toMatch(/two turns/)
    expect(outcome.instructions).toMatch(/initiative minus 10/)
    expect(outcome.instructions).toMatch(/surprised/)
  })

  it('evaluates on a level 17 thief without producing an action', () => {
    const character = evaluateSrdCharacter({
      classes: [{ label: 'Rogue', level: 17, subclass: 'Thief' }],
      features: [
        srdFeature({
          owner: 'SUBCLASS',
          classLabel: 'Rogue',
          subclassLabel: 'Thief',
          featureLabel: "Thief's Reflexes",
          level: 17
        })
      ]
    })
    expect(
      character.facts.actionCandidates.filter(({ label }) => label === "Thief's Reflexes")
    ).toHaveLength(0)
  })
})

describe('Dragon Wings, Unarmored Movement Improvement and Second-Story Work (SPELLS-31.T4o)', () => {
  const featureOf = (recordLabel: string, label: string) => {
    const found = srdByLabel(SRD.classes, recordLabel).features?.find(
      (entry) => entry.label === label
    )
    if (!found) throw new Error(`${recordLabel} has no ${label}.`)
    return found
  }
  const outcomesOf = (found: ReturnType<typeof featureOf>) => {
    const path = found.effects?.[0]?.paths[0]
    return path?.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []
  }

  it('Dragon Wings grants a fly speed equal to the walking speed, with no closed rule', () => {
    const outcomes = outcomesOf(featureOf('Draconic Bloodline', 'Dragon Wings'))
    expect(outcomes.some(({ effectKind }) => effectKind === 'CLOSED_RULE')).toBe(false)
    const grant = outcomes.find((outcome) => outcome.effectKind === 'APPLY_GRANT')
    if (grant?.effectKind !== 'APPLY_GRANT') throw new Error('Dragon Wings must apply a grant.')
    expect(grant.grants?.modifiers?.[0]).toMatchObject({
      valueDomainCode: 'SPEED',
      modifierKind: 'SET_VALUE',
      payload: { equalsSpeedId: expect.any(String) }
    })
    expect(outcomes).toHaveLength(1)
  })

  it.each([
    ['Monk', 'Unarmored Movement Improvement', /vertical surfaces and across liquids/],
    ['Thief', 'Second-Story Work', /Dexterity modifier/]
  ] as const)('%s %s is a passive GM ruling with no closed rule', (owner, label, text) => {
    const found = featureOf(owner, label)
    expect(found.effects?.[0]?.invocation.kind).toBe('PASSIVE')
    const [outcome, ...rest] = outcomesOf(found)
    expect(rest).toHaveLength(0)
    if (outcome?.effectKind !== 'MANUAL_ADJUDICATION')
      throw new Error(`${label} must stay a manual adjudication.`)
    expect(outcome.instructions).toMatch(text)
  })
})

describe('Oath of Devotion Channel Divinity (SPELLS-31.T4e)', () => {
  const oathFeature = (featureLabel: string) =>
    evaluateSrdCharacter({
      classes: [{ label: 'Paladin', level: 3, subclass: 'Oath of Devotion' }],
      features: [
        srdFeature({
          owner: 'SUBCLASS',
          classLabel: 'Paladin',
          subclassLabel: 'Oath of Devotion',
          featureLabel,
          level: 3
        })
      ]
    })
  const channelDivinity = srdByLabel(SRD.classes, 'Oath of Devotion').resources

  it.each(['Channel Divinity: Sacred Weapon', 'Channel Divinity: Turn the Unholy'])(
    '%s spends the Channel Divinity charge, not Holy Nimbus',
    (actionLabel) => {
      const candidates = oathFeature(actionLabel).facts.actionCandidates.filter(
        ({ label }) => label === actionLabel
      )
      expect(candidates).toHaveLength(1)
      expect(candidates[0]!.resourceUse).toEqual(
        expect.objectContaining({ chargeId: channelDivinity?.charges.id, cost: 1 })
      )
    }
  )

  it('imbues a held weapon for 1 minute and ends when it is released or the holder is unconscious', () => {
    const [candidate] = oathFeature(
      'Channel Divinity: Sacred Weapon'
    ).facts.actionCandidates.filter(({ label }) => label === 'Channel Divinity: Sacred Weapon')
    expect(candidate!.mechanicFacts.invocation.activation?.code).toBe('ACTION')
    expect(candidate!.mechanicFacts.outcomes).toEqual([
      expect.objectContaining({ kind: 'EFFECT', effectKind: 'APPLY_GRANT' })
    ])
  })
})

describe('spell slot recovery and conversion (SPELLS-31.T5j)', () => {
  function exchanges(input: {
    classLabel: string
    level: number
    subclass?: string
    featureLabel: string
  }) {
    const character = evaluateSrdCharacter({
      classes: [
        {
          label: input.classLabel,
          level: input.level,
          ...(input.subclass ? { subclass: input.subclass } : {})
        }
      ],
      features: [
        srdFeature({
          owner: input.subclass ? 'SUBCLASS' : 'CLASS',
          classLabel: input.classLabel,
          ...(input.subclass ? { subclassLabel: input.subclass } : {}),
          featureLabel: input.featureLabel,
          level: input.level
        })
      ],
      resourceUsage: []
    })
    return character.facts.actionCandidates
      .filter(({ label }) => label === input.featureLabel)
      .map((candidate) => ({
        candidate,
        exchange: character.output.actionDecisions
          .find(({ actionId }) => actionId === candidate.actionId)
          ?.mechanic?.outcomes.flatMap((outcome) =>
            outcome.kind === 'EFFECT' && outcome.spellSlotExchange
              ? [outcome.spellSlotExchange]
              : []
          ),
        pools: character.facts.resourcePoolCandidates
      }))
  }

  it.each([
    { classLabel: 'Wizard', level: 5, featureLabel: 'Arcane Recovery', budget: 3 },
    {
      classLabel: 'Druid',
      level: 6,
      subclass: 'Circle of the Land',
      featureLabel: 'Natural Recovery',
      budget: 3
    },
    { classLabel: 'Wizard', level: 1, featureLabel: 'Arcane Recovery', budget: 1 }
  ])(
    '$featureLabel at level $level spends its free use to recover $budget slot levels up to 5th',
    ({ budget, ...input }) => {
      const [action, ...others] = exchanges(input)
      expect(others).toEqual([])
      expect(action!.candidate.mechanicFacts.invocation.activation?.code).toBe('FREE')
      expect(action!.candidate.resourceUse).toEqual(expect.objectContaining({ cost: 1 }))
      expect(action!.exchange).toEqual([
        { mode: 'RECOVER_SLOTS', levelBudget: budget, maximumSlotLevel: 5 }
      ])
    }
  )

  it('Font of Magic converts slots into sorcery points and back as bonus actions', () => {
    const actions = exchanges({ classLabel: 'Sorcerer', level: 5, featureLabel: 'Font of Magic' })
    expect(actions).toHaveLength(2)
    const poolIds = actions[0]!.pools.map(({ poolId }) => poolId)
    expect(poolIds).toHaveLength(1)
    for (const { candidate } of actions) {
      expect(candidate.mechanicFacts.invocation.activation?.code).toBe('BONUS_ACTION')
      expect(candidate.resourceUse).toBeNull()
    }
    expect(actions.map(({ exchange }) => exchange)).toEqual([
      [{ mode: 'SLOT_TO_RESOURCE', resourcePoolId: poolIds[0], maximumSlotLevel: null }],
      [
        {
          mode: 'RESOURCE_TO_SLOT',
          resourcePoolId: poolIds[0],
          costs: [
            { slotLevel: 1, cost: 2 },
            { slotLevel: 2, cost: 3 },
            { slotLevel: 3, cost: 5 },
            { slotLevel: 4, cost: 6 },
            { slotLevel: 5, cost: 7 }
          ]
        }
      ]
    ])
  })

  it('adds a created slot to its level until the usage is cleared', () => {
    const { facts } = evaluateSrdCharacter({ classes: [{ label: 'Sorcerer', level: 3 }] })
    const slots = (created?: number) =>
      evaluateDnd5eCharacterSpellSlots({
        ...facts,
        spellcastingClasses: buildCharacterSpellSlotRuleFacts(
          evaluateSrdCharacter({ classes: [{ label: 'Sorcerer', level: 3 }] }).snapshot,
          srdRegistry
        ),
        spellSlotUsageFacts: created
          ? [
              { kind: 'STANDARD', spellLevel: 2, rawUsed: 0, created },
              { kind: 'STANDARD', spellLevel: 3, rawUsed: 1, created }
            ]
          : []
      }).maxByLevel.map(({ spellLevel, slotCount, remaining }) => ({
        spellLevel,
        slotCount,
        remaining
      }))
    expect(slots()).toEqual([
      { spellLevel: 1, slotCount: 4, remaining: 4 },
      { spellLevel: 2, slotCount: 2, remaining: 2 }
    ])
    expect(slots(1)).toEqual([
      { spellLevel: 1, slotCount: 4, remaining: 4 },
      { spellLevel: 2, slotCount: 3, remaining: 3 },
      { spellLevel: 3, slotCount: 1, remaining: 0 }
    ])
  })
})
