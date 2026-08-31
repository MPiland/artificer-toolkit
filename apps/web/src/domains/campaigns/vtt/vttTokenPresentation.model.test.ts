import { describe, expect, it } from 'vitest'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { tabletopGmEncounter, tabletopLiveScene } from './CampaignTabletop.stories.fixtures'
import { buildVttTokenPresentations, deterministicTokenColour } from './vttTokenPresentation.model'

describe('VTT token presentation model', () => {
  it('uses projected System state, stable ordering, and explicit current-turn precedence', () => {
    const actor = {
      ...tabletopGmEncounter.actors[0]!,
      conditions: [
        { id: 'morale', kind: 'MORALE', label: 'Shaken' },
        { id: 'injury', kind: 'INJURY', label: 'Lingering wound' },
        { id: 'condition', kind: 'CONDITION', label: 'Restrained' }
      ],
      healthBand: 'CRITICAL' as const
    }
    const encounter = {
      ...tabletopGmEncounter,
      actors: [actor, ...tabletopGmEncounter.actors.slice(1)]
    }
    const scene = sceneForActor()
    const result = buildVttTokenPresentations({
      actorIdByTokenId: new Map([[scene.tokens[0]!.id, actor.id]]),
      currentUserId: scene.tokens[0]!.controlledByUserIds[0]!,
      encounter,
      pending: null,
      scene
    })[scene.tokens[0]!.id]!

    expect(result.fillColor).toBe(0xc92a2a)
    expect(result.outlineColor).toBe(0x22b8cf)
    expect(result.halo?.label).toBe('Current turn')
    expect(result.statuses.map((status) => status.kind)).toEqual([
      'INJURY',
      'MORALE',
      'CONDITION',
      'HEALTH'
    ])
    expect(result.accessibleDescription).toContain('Lingering wound')
  })

  it('uses exact pending reaction identity without exposing absent actor state', () => {
    const actor = tabletopGmEncounter.actors[0]!
    const scene = sceneForActor()
    const token = scene.tokens[0]!
    const result = buildVttTokenPresentations({
      actorIdByTokenId: new Map([[token.id, actor.id]]),
      currentUserId: token.controlledByUserIds[0]!,
      encounter: { ...tabletopGmEncounter, currentActorId: null },
      pending: {
        kind: 'MOVEMENT_REACTION',
        occurrenceId: '77777777-7777-4777-8777-777777777790',
        occurrenceVersion: 1,
        encounterVersion: tabletopGmEncounter.version,
        choice: {
          pathDistance: 5,
          reactorActorId: actor.id,
          reactorTokenId: token.id,
          options: [
            {
              actionId: 'reaction',
              actionSourceKind: 'CHARACTER_ACTION',
              optionId: 'a'.repeat(64)
            }
          ]
        },
        allowedResponses: ['DECLINE', 'OPTION']
      },
      scene
    })[token.id]!

    expect(result.halo?.label).toBe('Reaction available')
    expect(result.statuses[0]).toMatchObject({ kind: 'REACTION', label: 'Reaction available' })
  })

  it('derives fallback colours deterministically', () => {
    expect(deterministicTokenColour('same')).toBe(deterministicTokenColour('same'))
    expect(deterministicTokenColour('same')).not.toBe(deterministicTokenColour('other'))
  })
})

function sceneForActor(): CampaignSceneStateDto {
  return {
    ...tabletopLiveScene
  }
}
