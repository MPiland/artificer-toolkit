import { describe, expect, it } from 'vitest'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import {
  tabletopGmEncounter,
  tabletopLiveScene,
  tabletopPlayerEncounter
} from './CampaignTabletop.stories.fixtures'
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
      boundTokenControl: new Map(),
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
      boundTokenControl: new Map(),
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

  it('shows players no health for any actor', () => {
    const scene = sceneForActor()
    const token = scene.tokens[0]!
    const actor = tabletopPlayerEncounter.actors[1]!
    const result = buildVttTokenPresentations({
      boundTokenControl: new Map(),
      actorIdByTokenId: new Map([[token.id, actor.id]]),
      currentUserId: token.controlledByUserIds[0]!,
      encounter: tabletopPlayerEncounter,
      pending: null,
      scene
    })[token.id]!

    expect(result.statuses.some((status) => status.kind === 'HEALTH')).toBe(false)
    expect(result.fillColor).toBe(deterministicTokenColour(actor.id))
  })

  it('marks a defeated creature for the GM and players alike, in place of its health band', () => {
    const scene = sceneForActor()
    const token = scene.tokens[0]!
    const enemyId = tabletopGmEncounter.actors[1]!.id
    const present = (encounter: Parameters<typeof buildVttTokenPresentations>[0]['encounter']) =>
      buildVttTokenPresentations({
        boundTokenControl: new Map(),
        actorIdByTokenId: new Map([[token.id, enemyId]]),
        currentUserId: token.controlledByUserIds[0]!,
        encounter,
        pending: null,
        scene
      })[token.id]!
    const gm = present({
      ...tabletopGmEncounter,
      currentActorId: null,
      actors: tabletopGmEncounter.actors.map((actor) =>
        actor.id === enemyId ? { ...actor, defeated: true } : actor
      )
    })
    const player = present({
      ...tabletopPlayerEncounter,
      currentActorId: null,
      actors: tabletopPlayerEncounter.actors.map((actor) =>
        actor.id === enemyId ? { ...actor, defeated: true } : actor
      )
    })

    for (const result of [gm, player]) {
      expect(result.statuses.filter((status) => status.kind === 'HEALTH')).toEqual([
        { id: 'health:defeated', kind: 'HEALTH', label: 'Defeated', shortLabel: '×' }
      ])
      expect(result.fillColor).toBe(0x495057)
      expect(result.accessibleDescription).toContain('Defeated')
    }
  })

  it('labels a defeated Character Dead for the GM and players alike (D96)', () => {
    const scene = sceneForActor()
    const token = scene.tokens[0]!
    const hero = tabletopGmEncounter.actors.find((actor) => actor.kind === 'CHARACTER')
    if (!hero) throw new Error('Missing Character fixture.')
    const present = (encounter: Parameters<typeof buildVttTokenPresentations>[0]['encounter']) =>
      buildVttTokenPresentations({
        boundTokenControl: new Map(),
        actorIdByTokenId: new Map([[token.id, hero.id]]),
        currentUserId: token.controlledByUserIds[0]!,
        encounter,
        pending: null,
        scene
      })[token.id]!
    const gm = present({
      ...tabletopGmEncounter,
      currentActorId: null,
      actors: tabletopGmEncounter.actors.map((actor) =>
        actor.id === hero.id ? { ...actor, defeated: true } : actor
      )
    })
    const player = present({
      ...tabletopPlayerEncounter,
      currentActorId: null,
      actors: tabletopPlayerEncounter.actors.map((actor) =>
        actor.id === hero.id ? { ...actor, defeated: true } : actor
      )
    })
    for (const result of [gm, player]) {
      expect(result.statuses.filter((status) => status.kind === 'HEALTH')).toEqual([
        { id: 'health:defeated', kind: 'HEALTH', label: 'Dead', shortLabel: '×' }
      ])
      expect(result.accessibleDescription).toContain('Dead')
    }
  })

  it('outlines bound tokens by actor control, not Scene token controllers', () => {
    const scene = sceneForActor()
    const token = scene.tokens[0]!
    const actor = tabletopGmEncounter.actors[1]!
    const outline = (controlled: boolean) =>
      buildVttTokenPresentations({
        actorIdByTokenId: new Map([[token.id, actor.id]]),
        boundTokenControl: new Map([[token.id, controlled]]),
        currentUserId: token.controlledByUserIds[0]!,
        encounter: tabletopGmEncounter,
        pending: null,
        scene
      })[token.id]!.outlineColor

    expect(outline(false)).toBe(0xffffff)
    expect(outline(true)).toBe(0x51cf66)
  })

  it('shows active grants on a token with their source and time left, naming a hidden source neutrally', () => {
    const actor = {
      ...tabletopGmEncounter.actors[0]!,
      activeGrants: [
        {
          effectId: '55555555-5555-4555-8555-555555555501',
          label: 'Aid',
          sourceHidden: false,
          remainingTicks: 4,
          expiresAtCampaignMinute: null
        },
        {
          effectId: '55555555-5555-4555-8555-555555555502',
          label: null,
          sourceHidden: true,
          remainingTicks: null,
          expiresAtCampaignMinute: null
        }
      ]
    }
    const scene = sceneForActor()
    const result = buildVttTokenPresentations({
      boundTokenControl: new Map(),
      actorIdByTokenId: new Map([[scene.tokens[0]!.id, actor.id]]),
      currentUserId: scene.tokens[0]!.controlledByUserIds[0]!,
      encounter: {
        ...tabletopGmEncounter,
        actors: [actor, ...tabletopGmEncounter.actors.slice(1)]
      },
      pending: null,
      scene
    })[scene.tokens[0]!.id]!

    expect(result.statuses.filter((status) => status.kind === 'EFFECT')).toEqual([
      expect.objectContaining({ label: 'Aid, 4 rounds left' }),
      expect.objectContaining({ label: 'Hidden source, Until ended' })
    ])
    expect(result.accessibleDescription).toContain('Aid, 4 rounds left')
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
