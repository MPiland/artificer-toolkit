import { describe, expect, it } from 'vitest'

import {
  prepareFixtureBuilder,
  prepareFixtureSheet,
  readyFighterFixture,
  system
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

  describe('with an extra speed', () => {
    const extraSpeed = system.speeds.find((speed) => speed.code === 'SWIM')
    if (!extraSpeed) throw new Error('Expected the SRD Swimming Speed.')
    const prepareWithExtraSpeed = async (
      movementDisplayPreference: Parameters<
        typeof prepareFixtureSheet
      >[0]['movementDisplayPreference']
    ) => {
      const fixture = readyFighterFixture()
      const { character } = await prepareFixtureBuilder(fixture)
      const timestamp = new Date(0).toISOString()
      return prepareFixtureSheet({
        ...fixture,
        character,
        movementDisplayPreference,
        adjustments: [
          {
            id: crypto.randomUUID(),
            characterId: character.id,
            createdBy: character.userId,
            updatedBy: character.userId,
            createdAt: timestamp,
            updatedAt: timestamp,
            family: 'MOVEMENT',
            speedId: extraSpeed.id,
            field: 'SPEED_OVERRIDE',
            value: { amount: 40, unit: 'FEET' }
          }
        ]
      })
    }

    it('keeps walking as the primary Speed when the player has not chosen a movement', async () => {
      const { sheet, ruleEvaluation } = await prepareWithExtraSpeed({ mode: 'AUTO' })

      const { movement } = ruleEvaluation.output
      expect(movement.speeds.map((speed) => speed.speedId)).toContain(extraSpeed.id)
      const walking = movement.speeds.find(
        (speed) => speed.speedId === movement.primaryMovementSpeedId
      )
      expect(walking?.speedId).not.toBe(extraSpeed.id)
      expect(sheet.overview.facts.find((fact) => fact.label === 'Speed')?.value).toBe(
        `${walking?.amount} feet`
      )
    })

    it('shows the movement the player chose as the primary Speed', async () => {
      const { sheet, ruleEvaluation } = await prepareWithExtraSpeed({
        mode: 'EXPLICIT',
        speedId: extraSpeed.id
      })

      const { movement } = ruleEvaluation.output
      expect(movement.primaryMovementSpeedId).toBe(extraSpeed.id)
      const chosen = movement.speeds.find((speed) => speed.speedId === extraSpeed.id)
      expect(chosen?.amount).toBe(40)
      expect(sheet.overview.facts.find((fact) => fact.label === 'Speed')).toEqual({
        label: 'Speed',
        value: 'Swimming 40 feet'
      })
    })

    it("takes the System's default movement type as the primary Speed, labelled as the plain Speed", async () => {
      const fixture = readyFighterFixture()
      const { character } = await prepareFixtureBuilder(fixture)
      const timestamp = new Date(0).toISOString()
      const { sheet, ruleEvaluation } = await prepareFixtureSheet({
        ...fixture,
        character,
        gameSystem: { ...system, defaults: { ...system.defaults!, movementTypeId: extraSpeed.id } },
        adjustments: [
          {
            id: crypto.randomUUID(),
            characterId: character.id,
            createdBy: character.userId,
            updatedBy: character.userId,
            createdAt: timestamp,
            updatedAt: timestamp,
            family: 'MOVEMENT',
            speedId: extraSpeed.id,
            field: 'SPEED_OVERRIDE',
            value: { amount: 40, unit: 'FEET' }
          }
        ]
      })

      expect(ruleEvaluation.output.movement.primaryMovementSpeedId).toBe(extraSpeed.id)
      expect(sheet.overview.facts.find((fact) => fact.label === 'Speed')).toEqual({
        label: 'Speed',
        value: '40 feet'
      })
    })
  })
})
