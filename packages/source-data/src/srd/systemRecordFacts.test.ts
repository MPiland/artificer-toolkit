import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import { describe, expect, it } from 'vitest'
import { SRD_ABILITY_DEFINITION_IDS, srdSystemRecord } from './vocabulary.js'

const system = systemAuthoredDtoSchema.parse(srdSystemRecord)
const byCode = <T extends { code: string }>(entries: readonly T[], code: string) =>
  entries.find((entry) => entry.code === code)

describe('SRD System record facts', () => {
  it('parses against the System contract', () => {
    expect(system.challengeRatings).toHaveLength(34)
  })

  it('orders challenge ratings by an explicit ascending rank', () => {
    expect(system.challengeRatings.map(({ rank }) => rank)).toEqual(
      system.challengeRatings.map((_, index) => index)
    )
    expect(byCode(system.challengeRatings, 'CR_1_8')?.rank).toBeLessThan(
      byCode(system.challengeRatings, 'CR_1_4')!.rank
    )
  })

  it.each([
    { code: 'CR_0', xp: 0, proficiencyBonus: 2 },
    { code: 'CR_1_2', xp: 100, proficiencyBonus: 2 },
    { code: 'CR_5', xp: 1800, proficiencyBonus: 3 },
    { code: 'CR_17', xp: 18000, proficiencyBonus: 6 },
    { code: 'CR_30', xp: 155000, proficiencyBonus: 9 }
  ])('gives $code $xp XP and a +$proficiencyBonus proficiency bonus', ({ code, ...expected }) => {
    expect(byCode(system.challengeRatings, code)).toMatchObject(expected)
  })

  it('expresses currency values in copper pieces', () => {
    expect(
      Object.fromEntries(system.currencies.map(({ code, baseValue }) => [code, baseValue]))
    ).toEqual({
      CP: 1,
      SP: 10,
      EP: 50,
      GP: 100,
      PP: 1000
    })
  })

  it('names the ability each passive uses', () => {
    expect(byCode(system.passives, 'PASSIVE_INVESTIGATION')?.abilityDefinitionId).toBe(
      SRD_ABILITY_DEFINITION_IDS.INTELLIGENCE
    )
    expect(byCode(system.passives, 'PASSIVE_PERCEPTION')?.abilityDefinitionId).toBe(
      SRD_ABILITY_DEFINITION_IDS.WISDOM
    )
  })

  it('agrees with the skill a passive builds on', () => {
    for (const passive of system.passives) {
      const skill = system.skills.find(({ id }) => id === passive.skillDefinitionId)
      if (skill) expect(passive.abilityDefinitionId).toBe(skill.governingAbilityDefinitionId)
    }
  })

  it('rejects a System whose challenge rating lacks its rules facts', () => {
    const [first, ...rest] = srdSystemRecord.challengeRatings
    const { rank: _rank, ...unranked } = first!
    expect(
      systemAuthoredDtoSchema.safeParse({
        ...srdSystemRecord,
        challengeRatings: [unranked, ...rest]
      }).success
    ).toBe(false)
  })

  it('names the default damage type, condition and movement type by definition ID', () => {
    expect(system.defaults).toEqual({
      damageTypeId: byCode(system.damageTypes, 'FIRE')?.id,
      conditionTypeId: byCode(system.conditionTypes, 'POISONED')?.id,
      movementTypeId: byCode(system.speeds, 'WALK')?.id
    })
  })

  it('marks Exhaustion as the only levelled condition', () => {
    expect(
      system.conditionTypes.filter(({ levelled }) => levelled).map(({ code }) => code)
    ).toEqual(['EXHAUSTION'])
  })

  it('marks Invisible as the only unseen condition', () => {
    expect(system.conditionTypes.filter(({ unseen }) => unseen).map(({ code }) => code)).toEqual([
      'INVISIBLE'
    ])
  })

  it('rejects a default naming a definition outside the System', () => {
    expect(
      systemAuthoredDtoSchema.safeParse({
        ...srdSystemRecord,
        defaults: { ...srdSystemRecord.defaults, damageTypeId: 'not-a-damage-type' }
      }).success
    ).toBe(false)
  })

  it('rejects a passive naming an ability outside the System', () => {
    const [first, ...rest] = srdSystemRecord.passives
    expect(
      systemAuthoredDtoSchema.safeParse({
        ...srdSystemRecord,
        passives: [
          { ...first!, abilityDefinitionId: '00000000-0000-0000-0000-00000000dead' },
          ...rest
        ]
      }).success
    ).toBe(false)
  })
})
