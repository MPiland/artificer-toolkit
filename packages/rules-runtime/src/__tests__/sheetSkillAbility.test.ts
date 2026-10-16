import { describe, expect, it } from 'vitest'

import {
  prepareFixtureBuilder,
  prepareFixtureSheet,
  readyFighterFixture,
  system
} from '../testing/characterContextFixtures.js'

describe('Sheet skill governing ability', () => {
  it("reads a System skill's governing ability from the System, not a built-in skill table", async () => {
    const wisdom = system.abilities?.find((ability) => ability.code === 'WISDOM')
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
})
