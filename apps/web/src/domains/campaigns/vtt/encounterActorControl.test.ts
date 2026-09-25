import { describe, expect, it } from 'vitest'
import {
  createTabletopCampaign,
  tabletopCurrentUserId,
  tabletopPlayerEncounter
} from './CampaignTabletop.stories.fixtures'
import { isEncounterActorMine } from './encounterActorControl'

const [character, creature] = tabletopPlayerEncounter.actors

describe('isEncounterActorMine', () => {
  it('gives the GM every actor', () => {
    expect(
      isEncounterActorMine(createTabletopCampaign('OWNER'), tabletopCurrentUserId, creature)
    ).toBe(true)
  })

  it('gives a player their assigned Character and actors granted to them only', () => {
    const player = createTabletopCampaign('PLAYER')
    expect(isEncounterActorMine(player, tabletopCurrentUserId, character)).toBe(true)
    expect(isEncounterActorMine(player, tabletopCurrentUserId, creature)).toBe(false)
    expect(
      isEncounterActorMine(player, tabletopCurrentUserId, {
        ...creature,
        controllerUserIds: [tabletopCurrentUserId]
      })
    ).toBe(true)
    expect(
      isEncounterActorMine({ ...player, assignedCharacter: null }, tabletopCurrentUserId, character)
    ).toBe(false)
  })
})
