import { describe, expect, it } from 'vitest'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { readMovementTargets } from '../../tests/fixtures/movementTargets'
import { buildMovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'

describe('movement target projection', () => {
  it('rebuilds loaded Character targets from projected hit points without persistence', async () => {
    const fixture = await setupCharacterRun()
    await fixture.owner.caller.run(async (ctx) => {
      const target = (
        await readMovementTargets(ctx, {
          encounterId: fixture.run.id,
          expectedEncounterVersion: fixture.run.version,
          targetActorIds: [fixture.actor.id],
          includeReactionSources: true
        })
      ).get(fixture.actor.id)!
      if (!target.characterFacts) throw new Error('Fixture Character facts missing.')
      const input = {
        actor: target.actor,
        activeEffects: target.activeEffects,
        gameSystemId: fixture.campaign.gameSystemId,
        campaignId: fixture.campaign.id,
        characterFacts: target.characterFacts,
        includeReactionSources: true
      }
      expect(buildMovementTarget(input)).toEqual(target)
      const projectedFacts = {
        ...target.characterFacts,
        character: {
          ...target.characterFacts.character,
          state: {
            ...target.characterFacts.character.state,
            hitpoints: {
              ...target.characterFacts.character.state.hitpoints,
              current: target.state.current - 1
            }
          }
        }
      }
      expect(buildMovementTarget({ ...input, characterFacts: projectedFacts }).state.current).toBe(
        target.state.current - 1
      )
      expect(target.characterFacts.character.state.hitpoints.current).toBe(target.state.current)
    })
  })
})
