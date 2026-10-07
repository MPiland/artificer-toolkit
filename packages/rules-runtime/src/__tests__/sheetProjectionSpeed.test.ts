import { describe, expect, it } from 'vitest'

import {
  prepareFixtureBuilder,
  prepareFixtureSheet,
  readyFighterFixture
} from '../testing/characterContextFixtures.js'

describe('Sheet overview Speed fact', () => {
  it("projects the SRD Human Fighter's walking speed from the rule evaluation", async () => {
    const fixture = readyFighterFixture()
    const { character } = await prepareFixtureBuilder(fixture)
    const { sheet, ruleEvaluation } = await prepareFixtureSheet({ ...fixture, character })

    const walking = ruleEvaluation.output.movement.speeds.find(
      (speed) => speed.speedId === ruleEvaluation.output.movement.primaryMovementSpeedId
    )
    expect(walking?.amount).toBe(30)
    expect(sheet.overview.facts.find((fact) => fact.label === 'Speed')).toEqual({
      label: 'Speed',
      value: '30 feet'
    })
  })
})
