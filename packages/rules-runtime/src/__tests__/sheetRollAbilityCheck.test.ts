import { describe, expect, it } from 'vitest'

import { resolveCharacterSheetRoll } from '../character/sheetRoll.js'
import { halfProficiencyRace } from '../testing/abilityCheckBonusRace.js'
import {
  prepareFixtureBuilder,
  prepareFixtureSheet,
  readyFighterFixture
} from '../testing/characterContextFixtures.js'

describe('the Sheet ability check roll', () => {
  it('rolls the ability check modifier, which carries the check bonus', async () => {
    const fixture = readyFighterFixture()
    const documents = { ...fixture.documents, RACE: [halfProficiencyRace] }
    const { character } = await prepareFixtureBuilder({ character: fixture.character, documents })
    const { sheet } = await prepareFixtureSheet({ character, documents })
    const strength = sheet.overview.abilities.find((ability) => ability.ability === 'STRENGTH')
    if (!strength) throw new Error('The fixture Character has no Strength.')
    // A level 1 proficiency bonus of +2 gives the half bonus, +1.
    expect(strength.checkModifier).toBe(strength.modifier + 1)

    const resolved = resolveCharacterSheetRoll(
      {
        characterId: sheet.meta.characterId,
        expression: `1d20 + ${strength.checkModifier}`,
        rollMode: strength.rollMode,
        source: { kind: 'ABILITY_CHECK', label: `${strength.label} check` }
      },
      sheet
    )

    expect(resolved.abilityCode).toBe('STRENGTH')
    expect(resolved.expression).toBe(`1d20 + ${strength.checkModifier}`)
  })

  it('refuses the ability modifier as an ability check roll once a bonus applies', async () => {
    const fixture = readyFighterFixture()
    const documents = { ...fixture.documents, RACE: [halfProficiencyRace] }
    const { character } = await prepareFixtureBuilder({ character: fixture.character, documents })
    const { sheet } = await prepareFixtureSheet({ character, documents })
    const strength = sheet.overview.abilities.find((ability) => ability.ability === 'STRENGTH')
    if (!strength) throw new Error('The fixture Character has no Strength.')

    expect(() =>
      resolveCharacterSheetRoll(
        {
          characterId: sheet.meta.characterId,
          expression: `1d20 + ${strength.modifier}`,
          rollMode: strength.rollMode,
          source: { kind: 'ABILITY_CHECK', label: `${strength.label} check` }
        },
        sheet
      )
    ).toThrow('This roll is not available on the current character sheet.')
  })
})
