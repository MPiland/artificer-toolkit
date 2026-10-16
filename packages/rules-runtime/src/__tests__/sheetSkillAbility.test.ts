import { describe, expect, it } from 'vitest'

import {
  prepareFixtureBuilder,
  prepareFixtureSheet,
  readyFighterFixture,
  system
} from '../testing/characterContextFixtures.js'

describe('Sheet skill governing ability', () => {
  it("reads a System skill's governing ability from the System, not a built-in skill table", async () => {
    if (system.schemaVersion !== 4) throw new Error('Expected the SRD System at schema v4.')
    const wisdom = system.abilities.find((ability) => ability.code === 'WISDOM')
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
      gameSystem: { ...system, skills: [...system.skills, tumbling] }
    })

    expect(sheet.overview.skills.find((skill) => skill.skillId === tumbling.id)).toMatchObject({
      code: 'TUMBLING',
      label: 'Tumbling',
      ability: 'WISDOM'
    })
  })

  it('rejects a skill whose governing ability the System does not define, never defaulting it', async () => {
    if (system.schemaVersion !== 4) throw new Error('Expected the SRD System at schema v4.')
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
        gameSystem: { ...system, skills: [...system.skills, unmapped] }
      })
    ).rejects.toThrow(`System check definition "${unmapped.id}" has an invalid mapping.`)
  })

  it("rejects a skill governed by an ability the Sheet's six abilities do not include", async () => {
    if (system.schemaVersion !== 4) throw new Error('Expected the SRD System at schema v4.')
    const [strength] = system.abilities
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
          ...system,
          abilities: [...system.abilities, luck],
          skills: [...system.skills, unknownAbility]
        }
      })
    ).rejects.toThrow(`System check definition "${unknownAbility.id}"`)
  })
})
