import { describe, expect, it } from 'vitest'

import { createSkillReference } from '../character/characterSheetVocabulary.js'
import {
  prepareFixtureBuilder,
  prepareFixtureSheet,
  readyFighterFixture,
  system
} from '../testing/characterContextFixtures.js'

function srdSystemV4() {
  if (!('schemaVersion' in system) || system.schemaVersion !== 4) {
    throw new Error('Expected the SRD System at schema v4.')
  }
  return system
}

describe('Sheet skill governing ability', () => {
  it("reads a System skill's governing ability from the System, not a built-in skill table", async () => {
    const v4 = srdSystemV4()
    const wisdom = v4.abilities.find((ability) => ability.code === 'WISDOM')
    if (!wisdom) throw new Error('Expected the SRD Wisdom ability.')
    const tumbling = {
      id: crypto.randomUUID(),
      code: 'TUMBLING',
      label: 'Tumbling',
      governingAbilityDefinitionId: wisdom.id
    }
    const fixture = readyFighterFixture()
    const { character } = await prepareFixtureBuilder(fixture)

    const { sheet } = await prepareFixtureSheet({
      ...fixture,
      character,
      gameSystem: { ...v4, skills: [...v4.skills, tumbling] }
    })

    expect(sheet.overview.skills.find((skill) => skill.skillId === tumbling.id)).toMatchObject({
      code: 'TUMBLING',
      label: 'Tumbling',
      ability: 'WISDOM'
    })
  })

  // QUALITY-1.T1: the Sheet kept its own alias map, which let the later skill silently take the alias.
  it('refuses a System whose skill id is another skill’s code, as the rule facts do', () => {
    const v4 = srdSystemV4()
    const wisdom = v4.abilities.find((ability) => ability.code === 'WISDOM')
    if (!wisdom) throw new Error('Expected the SRD Wisdom ability.')
    const juggling = {
      id: 'ACROBATICS',
      code: 'JUGGLING',
      label: 'Juggling',
      governingAbilityDefinitionId: wisdom.id
    }

    expect(() => createSkillReference({ ...v4, skills: [...v4.skills, juggling] })).toThrow(
      'System check alias "ACROBATICS" is ambiguous.'
    )
  })

  it('rejects a skill whose governing ability the System does not define, never defaulting it', async () => {
    const v4 = srdSystemV4()
    const unmapped = {
      id: crypto.randomUUID(),
      code: 'TUMBLING',
      label: 'Tumbling',
      governingAbilityDefinitionId: crypto.randomUUID()
    }
    const fixture = readyFighterFixture()
    const { character } = await prepareFixtureBuilder(fixture)

    await expect(
      prepareFixtureSheet({
        ...fixture,
        character,
        gameSystem: { ...v4, skills: [...v4.skills, unmapped] }
      })
    ).rejects.toThrow(`System check definition "${unmapped.id}" has an invalid mapping.`)
  })

  it("rejects a skill governed by an ability the Sheet's six abilities do not include", async () => {
    const v4 = srdSystemV4()
    const [strength] = v4.abilities
    if (!strength) throw new Error('Expected the SRD abilities.')
    const luck = { ...strength, id: crypto.randomUUID(), code: 'LUCK', label: 'Luck' }
    const unknownAbility = {
      id: crypto.randomUUID(),
      code: 'TUMBLING',
      label: 'Tumbling',
      governingAbilityDefinitionId: luck.id
    }
    const fixture = readyFighterFixture()
    const { character } = await prepareFixtureBuilder(fixture)

    await expect(
      prepareFixtureSheet({
        ...fixture,
        character,
        gameSystem: {
          ...v4,
          abilities: [...v4.abilities, luck],
          skills: [...v4.skills, unknownAbility]
        }
      })
    ).rejects.toThrow(`System check definition "${unknownAbility.id}"`)
  })
})
