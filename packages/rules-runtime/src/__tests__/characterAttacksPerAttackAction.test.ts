import { describe, expect, it } from 'vitest'

import { evaluateSrdCharacter, srdFeature } from './dnd5eSrdCharacter.js'

const fighterFeature = (featureLabel: string, level: number) =>
  srdFeature({ owner: 'CLASS', classLabel: 'Fighter', featureLabel, level })

/** The attacks per Attack action the installed D&D policy outputs for an SRD Character. */
function attacksPerAttackAction(input: Parameters<typeof evaluateSrdCharacter>[0]) {
  return evaluateSrdCharacter(input).output.attacksPerAttackAction
}

describe('attacks per Attack action', () => {
  it('is one without an Extra Attack source', () => {
    expect(attacksPerAttackAction({ classes: [{ label: 'Fighter', level: 4 }] })).toBe(1)
  })

  it('grows with the Fighter’s Extra Attack Features', () => {
    expect(
      attacksPerAttackAction({
        classes: [{ label: 'Fighter', level: 5 }],
        features: [fighterFeature('Extra Attack', 5)]
      })
    ).toBe(2)
    expect(
      attacksPerAttackAction({
        classes: [{ label: 'Fighter', level: 11 }],
        features: [fighterFeature('Extra Attack', 5), fighterFeature('Extra Attack (2)', 11)]
      })
    ).toBe(3)
    expect(
      attacksPerAttackAction({
        classes: [{ label: 'Fighter', level: 20 }],
        features: [
          fighterFeature('Extra Attack', 5),
          fighterFeature('Extra Attack (2)', 11),
          fighterFeature('Extra Attack (3)', 20)
        ]
      })
    ).toBe(4)
  })

  it('takes the highest source across classes instead of adding them', () => {
    const paladinExtraAttack = srdFeature({
      owner: 'CLASS',
      classLabel: 'Paladin',
      featureLabel: 'Extra Attack',
      level: 5
    })
    const rangerExtraAttack = srdFeature({
      owner: 'CLASS',
      classLabel: 'Ranger',
      featureLabel: 'Extra Attack',
      level: 5
    })
    expect(
      attacksPerAttackAction({
        classes: [
          { label: 'Fighter', level: 11 },
          { label: 'Paladin', level: 5 }
        ],
        features: [
          fighterFeature('Extra Attack', 5),
          fighterFeature('Extra Attack (2)', 11),
          paladinExtraAttack
        ]
      })
    ).toBe(3)
    expect(
      attacksPerAttackAction({
        classes: [
          { label: 'Fighter', level: 5 },
          { label: 'Ranger', level: 5 }
        ],
        features: [fighterFeature('Extra Attack', 5), rangerExtraAttack]
      })
    ).toBe(2)
  })

  it('counts a Warlock’s Thirsting Blade invocation', () => {
    expect(
      attacksPerAttackAction({
        classes: [{ label: 'Warlock', level: 5 }],
        features: [
          srdFeature({
            owner: 'CLASS',
            classLabel: 'Warlock',
            featureLabel: 'Pact Boon',
            level: 3,
            optionLabels: ['Pact of the Blade']
          }),
          srdFeature({
            owner: 'CLASS',
            classLabel: 'Warlock',
            featureLabel: 'Eldritch Invocations',
            level: 5,
            optionLabels: ['Thirsting Blade']
          })
        ]
      })
    ).toBe(2)
  })
})
