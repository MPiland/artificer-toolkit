import { MANUAL_ADJUDICATION_REASON } from '@artificer-toolkit/shared/core'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import { gmRulingEffect } from '@artificer-toolkit/source-data/srd/classes/mechanics.js'
import { sorceryPointsCharge } from '@artificer-toolkit/source-data/srd/classes/sorcerer.js'
import { describe, expect, it } from 'vitest'

import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import { SRD, evaluateSrdCharacter, srdByLabel, srdFeature } from '../testing/dnd5eSrdCharacter.js'

const SORCERER = srdByLabel(SRD.classes, 'Sorcerer')
const METAMAGIC = srdByLabel(SORCERER.features ?? [], 'Metamagic')
const SUBTLE = srdByLabel(METAMAGIC.options ?? [], 'Subtle Spell')

const sorcerer = (optionLabels: readonly string[]) =>
  evaluateSrdCharacter({
    classes: [{ label: 'Sorcerer', level: 3 }],
    features: [
      srdFeature({
        owner: 'CLASS',
        classLabel: 'Sorcerer',
        featureLabel: 'Metamagic',
        level: 3,
        optionLabels
      })
    ]
  })

describe('the costs a Character may pay on casting a spell (SPELLS-31.T5g)', () => {
  it('projects the cast modifier of a Metamagic option the Character chose', () => {
    expect(sorcerer(['Subtle Spell']).castModifiers).toEqual([
      {
        modifierId: SUBTLE.effects?.[0]?.id,
        label: 'Subtle Spell',
        cost: { chargeId: sorceryPointsCharge.id, cost: 1 }
      }
    ])
  })

  it('projects none for an option the Character did not choose', () => {
    expect(sorcerer(['Quickened Spell']).castModifiers).toEqual([])
  })

  /** The authoring-parity proof: a Builder author writes the same option from core options alone. */
  it('projects the same cost from a homebrew feature authored with the core option', () => {
    const chargeId = testUuid(0xc01)
    const homebrew: FeatureAuthored = {
      id: testUuid(0xc02),
      label: 'Quiet Casting',
      description: 'Pay one use to cast without components.',
      availableAtLevel: 1,
      order: 1,
      effects: [
        gmRulingEffect({
          ids: {
            effect: testUuid(0xc03),
            range: testUuid(0xc04),
            path: testUuid(0xc05),
            result: testUuid(0xc06),
            outcome: testUuid(0xc07)
          },
          label: 'Quiet Casting',
          instructions: 'The spell is cast without components.',
          reasonCode: MANUAL_ADJUDICATION_REASON.GM_CHOICE,
          castModifier: { chargeId, cost: 1 }
        })
      ]
    }
    const character = evaluateSrdCharacter({
      classes: [{ label: 'Fighter', level: 1 }],
      extraFeatures: [homebrew],
      features: [
        {
          acquisitionId: 'acquired:quiet-casting',
          featureId: homebrew.id,
          source: { kind: 'CLASS', classId: srdByLabel(SRD.classes, 'Fighter').id, classLevel: 1 },
          timing: { kind: 'IMMEDIATE' }
        }
      ]
    })
    expect(character.castModifiers).toEqual([
      { modifierId: testUuid(0xc03), label: 'Quiet Casting', cost: { chargeId, cost: 1 } }
    ])
  })
})
