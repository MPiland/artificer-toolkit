import { describe, expect, it } from 'vitest'
import {
  createTabletopCampaign,
  tabletopCurrentUserId,
  tabletopPlayerEncounter
} from './CampaignTabletop.stories.fixtures'
import { isEncounterActorMine } from './encounterActorControl'

const { actors } = tabletopPlayerEncounter
const [character, creature] = actors

describe('isEncounterActorMine', () => {
  it('gives the GM every actor', () => {
    expect(
      isEncounterActorMine(createTabletopCampaign('OWNER'), tabletopCurrentUserId, creature, actors)
    ).toBe(true)
  })

  it('gives a player their assigned Character and actors granted to them only', () => {
    const player = createTabletopCampaign('PLAYER')
    expect(isEncounterActorMine(player, tabletopCurrentUserId, character, actors)).toBe(true)
    expect(isEncounterActorMine(player, tabletopCurrentUserId, creature, actors)).toBe(false)
    expect(
      isEncounterActorMine(
        player,
        tabletopCurrentUserId,
        {
          ...creature,
          controllerUserIds: [tabletopCurrentUserId]
        },
        actors
      )
    ).toBe(true)
    expect(
      isEncounterActorMine(
        { ...player, assignedCharacter: null },
        tabletopCurrentUserId,
        character,
        actors
      )
    ).toBe(false)
  })

  it('gives a player the summon owned, through the chain, by an actor they control', () => {
    const player = createTabletopCampaign('PLAYER')
    const summon = { ...creature, id: 'summon', owner: { ownerActorId: character.id } }
    const nested = { ...creature, id: 'nested', owner: { ownerActorId: summon.id } }
    const chain = [...actors, summon, nested]
    expect(isEncounterActorMine(player, tabletopCurrentUserId, summon, chain)).toBe(true)
    expect(isEncounterActorMine(player, tabletopCurrentUserId, nested, chain)).toBe(true)
    expect(isEncounterActorMine(player, tabletopCurrentUserId, summon, [summon])).toBe(false)
    expect(
      isEncounterActorMine(
        { ...player, assignedCharacter: null },
        tabletopCurrentUserId,
        summon,
        chain
      )
    ).toBe(false)
  })
})
