import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { ABILITY_CODE, CLOSED_RULE_KIND } from '@artificer-toolkit/shared'
import { describe, expect, it } from 'vitest'
import { srdSpells } from './spells/index.js'
import { conditionTypeId } from './spells/shared.js'
import { SRD_DAMAGE_TYPES } from './vocabulary.js'

const plainText = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')

/**
 * D156 T2a3 and T2k1: spells whose closed rule converted to core options. What the product
 * resolves is authored; the clauses it does not are the GM's ruling, quoted from the description.
 */
describe.each([
  { label: 'Blur', ruleKind: 'BLUR', effectKinds: ['APPLY_GRANT'] },
  { label: 'Death Ward', ruleKind: 'DEATH_WARD', effectKinds: ['APPLY_GRANT'] },
  { label: 'Enthrall', ruleKind: 'ENTHRALL', effectKinds: ['APPLY_GRANT'] },
  { label: 'Guiding Bolt', ruleKind: 'GUIDING_BOLT', effectKinds: ['DAMAGE', 'APPLY_GRANT'] },
  { label: 'Light', ruleKind: 'LIGHT', effectKinds: ['MANIFEST', 'MANUAL_ADJUDICATION'] },
  { label: 'Mage Armor', ruleKind: 'MAGE_ARMOR', effectKinds: ['APPLY_GRANT'] },
  {
    label: 'Mind Blank',
    ruleKind: 'MIND_BLANK',
    effectKinds: ['APPLY_GRANT', 'MANUAL_ADJUDICATION']
  },
  { label: 'Mirror Image', ruleKind: 'MIRROR_IMAGE', effectKinds: ['APPLY_GRANT'] },
  {
    label: 'Pass without Trace',
    ruleKind: 'PASS_WITHOUT_TRACE',
    effectKinds: ['APPLY_GRANT', 'MANUAL_ADJUDICATION']
  },
  { label: 'Shillelagh', ruleKind: 'SHILLELAGH', effectKinds: ['APPLY_GRANT'] },
  { label: 'Magic Weapon', ruleKind: 'MAGIC_WEAPON', effectKinds: ['APPLY_GRANT'] },
  {
    label: 'Heat Metal',
    ruleKind: 'HEAT_METAL',
    effectKinds: [
      'DAMAGE',
      'RELEASE_CHOSEN_ITEM',
      'APPLY_GRANT',
      'DAMAGE',
      'APPLY_GRANT',
      // The repeat offer's carrier, one per save result (D166).
      'APPLY_GRANT',
      'APPLY_GRANT'
    ]
  },
  { label: 'True Strike', ruleKind: 'TRUE_STRIKE', effectKinds: ['APPLY_GRANT'] },
  { label: 'Lesser Restoration', ruleKind: 'LESSER_RESTORATION', effectKinds: ['END_EFFECTS'] },
  {
    label: 'Greater Restoration',
    ruleKind: 'GREATER_RESTORATION',
    effectKinds: ['END_EFFECTS', 'MANUAL_ADJUDICATION']
  },
  {
    label: 'Protection from Poison',
    ruleKind: 'PROTECTION_FROM_POISON',
    effectKinds: ['END_EFFECTS', 'MANUAL_ADJUDICATION']
  }
])('SRD $label (D156 T2a3, T2k1)', ({ label, ruleKind, effectKinds }) => {
  const spell = srdSpells.find((entry) => entry.label === label)
  if (!spell) throw new Error(`SRD spell "${label}" is missing.`)
  const outcomes = (spell.effects ?? [])
    .flatMap((effect) => effect.paths)
    .flatMap((path) => (path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []))

  it('authors its outcomes from core options, with no closed rule left', () => {
    expect(outcomes.map(({ effectKind }) => effectKind)).toEqual(effectKinds)
    expect(Object.keys(CLOSED_RULE_KIND)).not.toContain(ruleKind)
  })

  it('quotes its description in every GM ruling', () => {
    const description = plainText(spell.description ?? '')
    for (const outcome of outcomes)
      if (outcome.effectKind === 'MANUAL_ADJUDICATION')
        expect(description).toContain(plainText(outcome.instructions))
  })
})

/**
 * SPELLS-4.T2i: Power Word Kill runs from data. Its 100 hit point limit is the result block's
 * hit-point gate and its death is the generic KILL outcome.
 */
describe('SRD Power Word Kill (SPELLS-4.T2i)', () => {
  const spell = srdSpells.find((entry) => entry.label === 'Power Word Kill')
  const path = spell?.effects?.flatMap((effect) => effect.paths)[0]

  it('authors a hit-point gate of 100 around a kill, with no closed rule left', () => {
    if (path?.selectionKind !== 'FIXED') throw new Error('Expected one fixed path.')
    expect(path.resultBlock.gate).toEqual({ kind: 'TARGET_HIT_POINTS_AT_MOST', amount: 100 })
    expect(path.resultBlock.outcomes.map(({ effectKind }) => effectKind)).toEqual(['KILL'])
    expect(Object.keys(CLOSED_RULE_KIND)).not.toContain('POWER_WORD_KILL')
  })

  it('states the limit its gate carries in its description', () => {
    expect(plainText(spell?.description ?? '')).toContain('100 hit points or fewer')
  })
})

/**
 * SPELLS-4.T2i3: Power Word Stun runs from data. Its 150 hit point limit is the result block's
 * hit-point gate, its stun is the generic condition, and the Constitution save the target repeats
 * at the end of each of its turns is the generic follow-up save.
 */
describe('SRD Power Word Stun (SPELLS-4.T2i3)', () => {
  const spell = srdSpells.find((entry) => entry.label === 'Power Word Stun')
  const path = spell?.effects?.flatMap((effect) => effect.paths)[0]

  it('authors a hit-point gate of 150 around a stun and its repeated save, with no closed rule left', () => {
    if (path?.selectionKind !== 'FIXED') throw new Error('Expected one fixed path.')
    expect(path.resultBlock.gate).toEqual({ kind: 'TARGET_HIT_POINTS_AT_MOST', amount: 150 })
    expect(path.resultBlock.duration).toMatchObject({ durationKind: 'MINUTE', amount: 1 })
    expect(path.resultBlock.outcomes.map(({ effectKind }) => effectKind)).toEqual([
      'CONDITION',
      'FOLLOW_UP_SAVE'
    ])
    expect(path.resultBlock.outcomes[1]).toMatchObject({
      timing: 'TARGET_TURN_END',
      attempts: { kind: 'ONCE', repeatOnFailure: true },
      onSuccess: { kind: 'END' },
      onFailure: { kind: 'CONTINUE' }
    })
    expect(Object.keys(CLOSED_RULE_KIND)).not.toContain('POWER_WORD_STUN')
  })

  it('states the limit its gate carries in its description', () => {
    expect(plainText(spell?.description ?? '')).toContain('150 hit points or fewer')
  })
})

/**
 * SPELLS-4.T2i4b2: Divine Word runs from data. Its four hit point bands are the tier rows of one
 * failed-save path: generic conditions with their own durations, and the generic KILL.
 */
describe('SRD Divine Word (SPELLS-4.T2i4b2)', () => {
  const spell = srdSpells.find((entry) => entry.label === 'Divine Word')
  const path = spell?.effects?.flatMap((effect) => effect.paths)[0]

  it('authors the 50, 40, 30 and 20 hit point tiers, with no closed rule left', () => {
    if (path?.selectionKind !== 'HIT_POINT_TIERS') throw new Error('Expected hit point tiers.')
    expect(
      path.rows.map(({ atMost, resultBlock }) => [
        atMost,
        resultBlock.duration && 'amount' in resultBlock.duration
          ? resultBlock.duration.amount
          : null,
        resultBlock.outcomes.map((outcome) =>
          outcome.effectKind === 'CONDITION' ? outcome.conditionId : outcome.effectKind
        )
      ])
    ).toEqual([
      [50, 1, [conditionTypeId('DEAFENED')]],
      [40, 10, [conditionTypeId('DEAFENED'), conditionTypeId('BLINDED')]],
      [
        30,
        60,
        [conditionTypeId('BLINDED'), conditionTypeId('DEAFENED'), conditionTypeId('STUNNED')]
      ],
      [20, null, ['KILL']]
    ])
    expect(Object.keys(CLOSED_RULE_KIND)).not.toContain('DIVINE_WORD')
  })

  it('states each tier its rows carry in its description', () => {
    const description = plainText(spell?.description ?? '')
    for (const limit of [50, 40, 30, 20])
      expect(description).toContain(`${limit} hit points or fewer`)
  })
})

/**
 * SPELLS-4.T2i2b: Death Ward runs from data. One use of a damage interception that drops the ward's
 * holder to 1 hit point and negates instant death; the use ends the spell.
 */
describe('SRD Death Ward (SPELLS-4.T2i2b)', () => {
  const spell = srdSpells.find((entry) => entry.label === 'Death Ward')
  const path = spell?.effects?.flatMap((effect) => effect.paths)[0]

  it('authors one damage interception use, with no closed rule left', () => {
    if (path?.selectionKind !== 'FIXED') throw new Error('Expected one fixed path.')
    expect(path.resultBlock.lifecycle).toEqual({ uses: 1 })
    expect(path.resultBlock.duration).toMatchObject({ durationKind: 'HOUR', amount: 8 })
    const [outcome] = path.resultBlock.outcomes
    if (outcome?.effectKind !== 'APPLY_GRANT') throw new Error('Expected a grant outcome.')
    expect(outcome.grants.modifiers).toMatchObject([
      {
        valueDomainCode: 'DAMAGE_INTERCEPTION',
        modifierKind: 'ENABLE',
        payload: { dropToHitPoints: 1, negatesKill: true }
      }
    ])
    expect(Object.keys(CLOSED_RULE_KIND)).not.toContain('DEATH_WARD')
  })
})

/**
 * SPELLS-4.T2n4: Warding Bond runs from data. The +1 AC and saves, resistance to every damage type
 * and the damage mirror are one grant bundle; the bond ends when its source is incapacitated or
 * left beyond 60 feet. A homebrew variant with another range and bundle validates through the same
 * authoring schema, so nothing about the bond is spell-specific.
 */
describe('SRD Warding Bond (SPELLS-4.T2n4)', () => {
  const spell = srdSpells.find((entry) => entry.label === 'Warding Bond')
  const path = spell?.effects?.flatMap((effect) => effect.paths)[0]
  if (path?.selectionKind !== 'FIXED') throw new Error('Expected one fixed path.')
  const [outcome] = path.resultBlock.outcomes
  if (outcome?.effectKind !== 'APPLY_GRANT') throw new Error('Expected a grant outcome.')
  const modifiers = outcome.grants.modifiers ?? []
  const valid = (candidate: typeof spell) => spellAuthoredDtoSchema.safeParse(candidate).success

  it('authors the bonuses, every resistance and the mirror, with no closed rule left', () => {
    expect(path.resultBlock.duration).toMatchObject({ durationKind: 'HOUR', amount: 1 })
    expect(path.resultBlock.lifecycle).toEqual({
      endOnTriggers: [
        { event: 'INCAPACITATED', of: 'SOURCE' },
        { event: 'SEPARATED', from: 'SOURCE', beyondFeet: 60 }
      ]
    })
    expect(modifiers.map(({ valueDomainCode }) => valueDomainCode)).toEqual([
      'ARMOR_CLASS',
      ...Object.values(ABILITY_CODE).map(() => 'SAVING_THROW_MODIFIER'),
      ...SRD_DAMAGE_TYPES.map(() => 'DAMAGE_RESISTANCE'),
      'DAMAGE_MIRROR'
    ])
    expect(Object.keys(CLOSED_RULE_KIND)).not.toContain('WARDING_BOND')
    expect(valid(spell)).toBe(true)
  })

  it('accepts a homebrew variant written from the same options', () => {
    const homebrew = {
      ...spell!,
      effects: spell!.effects!.map((effect) => ({
        ...effect,
        paths: effect.paths.map((entry) =>
          entry.selectionKind !== 'FIXED'
            ? entry
            : {
                ...entry,
                resultBlock: {
                  ...entry.resultBlock,
                  lifecycle: {
                    endOnTriggers: [
                      { event: 'SEPARATED' as const, from: 'SOURCE' as const, beyondFeet: 30 }
                    ]
                  },
                  outcomes: [{ ...outcome, grants: { modifiers: [modifiers.at(-1)!] } }]
                }
              }
        )
      }))
    }
    expect(valid(homebrew)).toBe(true)
  })
})

/**
 * SPELLS-4.T2m1b1b: Hideous Laughter runs from data. Prone and Incapacitated are generic
 * conditions held for the minute, and the Wisdom save the target repeats at the end of each of its
 * turns (with advantage when damage triggers it) is the generic follow-up save. Standing up and the
 * Intelligence 4 limit stay with the description.
 */
describe('SRD Hideous Laughter (SPELLS-4.T2m1b1b)', () => {
  const spell = srdSpells.find((entry) => entry.label === 'Hideous Laughter')
  const path = spell?.effects?.flatMap((effect) => effect.paths)[0]

  it('authors two conditions and a repeated save from core options, with no closed rule left', () => {
    if (path?.selectionKind !== 'FIXED') throw new Error('Expected one fixed path.')
    expect(path.resultBlock.duration).toMatchObject({ durationKind: 'MINUTE', amount: 1 })
    expect(path.resultBlock.outcomes.map(({ effectKind }) => effectKind)).toEqual([
      'CONDITION',
      'CONDITION',
      'FOLLOW_UP_SAVE'
    ])
    expect(path.resultBlock.outcomes[2]).toMatchObject({
      timing: 'TARGET_TURN_END',
      repeatTriggers: [{ kind: 'DAMAGE_TAKEN', by: 'ANYONE', rollInfluence: 'ADVANTAGE' }],
      attempts: { kind: 'ONCE', repeatOnFailure: true },
      onSuccess: { kind: 'END' },
      onFailure: { kind: 'CONTINUE' }
    })
    expect(Object.keys(CLOSED_RULE_KIND)).not.toContain('HIDEOUS_LAUGHTER')
  })

  it('states the clauses its data does not carry in its description', () => {
    const description = plainText(spell?.description ?? '')
    expect(description).toContain('unable to stand up')
    expect(description).toContain('Intelligence score of 4 or less')
  })
})
