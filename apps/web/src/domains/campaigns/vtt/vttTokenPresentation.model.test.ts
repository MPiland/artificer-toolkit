import { describe, expect, it } from 'vitest'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { facingArcSectors } from '@artificer-toolkit/shared/vtt'
import { hideActiveGrantSources } from '@artificer-toolkit/rules-runtime/activeGrantListings'
import { srdMarkListing } from '@artificer-toolkit/rules-runtime/testing/srdMarkListing'
import { activeGrantTimeLeft } from '../../../components/activeGrants/activeGrantDisplay'
import type { EncounterGmProjectionDto } from '@artificer-toolkit/schema/api/encounters'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import {
  tabletopConditions,
  tabletopGmEncounter,
  tabletopLiveScene,
  tabletopPlayerEncounter
} from './CampaignTabletop.stories.fixtures'
import {
  buildVttTokenPresentations,
  deterministicTokenColour,
  dispositionRingColours
} from './vttTokenPresentation.model'

describe('VTT token presentation model', () => {
  it('uses projected System state, stable ordering, and explicit current-turn precedence', () => {
    const actor = {
      ...tabletopGmEncounter.actors[0]!,
      conditions: tabletopConditions('RESTRAINED'),
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
      conditionTypes: srdSystemRecord.conditionTypes,
      currentUserId: scene.tokens[0]!.controlledByUserIds[0]!,
      encounter,
      pending: null,
      scene
    })[scene.tokens[0]!.id]!

    expect(result.fillColor).toBe(0xc92a2a)
    expect(actor.disposition).toBe('FRIENDLY')
    expect(result.outlineColor).toBe(0x339af0)
    expect(result.halo?.label).toBe('Current turn')
    expect(result.statuses.map((status) => status.kind)).toEqual(['CONDITION', 'HEALTH'])
    expect(result.accessibleDescription).toContain('Restrained')
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

  it('draws an Encounter creature facing only while the Facing rule is active', () => {
    const actor = tabletopGmEncounter.actors[0]!
    const scene = sceneForActor()
    const token = scene.tokens[0]!
    const present = (facingStepDegrees: number | null) =>
      buildVttTokenPresentations({
        boundTokenControl: new Map(),
        actorIdByTokenId: new Map([[token.id, actor.id]]),
        conditionTypes: srdSystemRecord.conditionTypes,
        currentUserId: token.controlledByUserIds[0]!,
        encounter: { ...tabletopGmEncounter, facingStepDegrees },
        pending: null,
        scene
      })[token.id]!

    expect(present(45).facing).toBe(true)
    expect(present(null).facing).toBe(false)
  })

  it('gives the selected and current-turn tokens Facing arcs from the shared classifier', () => {
    const arcs = [
      { arc: 'FRONT', fromDegrees: -45, toDegrees: 45 },
      { arc: 'RIGHT_SIDE', fromDegrees: 45, toDegrees: 135 },
      { arc: 'REAR', fromDegrees: 135, toDegrees: 225 },
      { arc: 'LEFT_SIDE', fromDegrees: 225, toDegrees: 315 }
    ] as const
    const actor = tabletopGmEncounter.actors[0]!
    const scene = sceneForActor()
    const token = { ...scene.tokens[0]!, rotationDegrees: 90 }
    const present = (
      encounter: Partial<EncounterGmProjectionDto>,
      selectedTokenId: string | null
    ) =>
      buildVttTokenPresentations({
        boundTokenControl: new Map(),
        actorIdByTokenId: new Map([[token.id, actor.id]]),
        conditionTypes: srdSystemRecord.conditionTypes,
        currentUserId: token.controlledByUserIds[0]!,
        encounter: { ...tabletopGmEncounter, facingArcs: [...arcs], ...encounter },
        pending: null,
        scene: { ...scene, tokens: [token] },
        selectedTokenId
      })[token.id]!
    const notCurrent = { currentActorId: null }

    // Current turn: the arcs follow the token's facing.
    expect(present({}, null).facingArcs).toEqual(facingArcSectors({ arcs, rotationDegrees: 90 }))
    // Selected, though not the current turn.
    expect(present(notCurrent, token.id).facingArcs).toEqual(
      facingArcSectors({ arcs, rotationDegrees: 90 })
    )
    // Neither selected nor current, the rule off, or no rule arcs: nothing is drawn.
    expect(present(notCurrent, null).facingArcs).toBeNull()
    expect(present({ facingArcs: null }, token.id).facingArcs).toBeNull()
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

  it('shows everyone the GM’s cover tier by its System label (SPELLS-14.T3)', () => {
    const coverTiers = srdSystemRecord.cover!.tiers
    const half = coverTiers.find(({ code }) => code === 'HALF')!
    const cover = (tierCode: string | null, currentUserId: string) => {
      const scene = sceneForActor()
      const token = { ...scene.tokens[0]!, coverTierOverride: { tierCode } }
      return buildVttTokenPresentations({
        boundTokenControl: new Map(),
        actorIdByTokenId: new Map(),
        coverTiers,
        currentUserId,
        encounter: tabletopPlayerEncounter,
        pending: null,
        scene: { ...scene, tokens: [token, ...scene.tokens.slice(1)] }
      })[token.id]!.statuses.filter((status) => status.kind === 'COVER')
    }
    const player = tabletopLiveScene.tokens[0]!.controlledByUserIds[0]!

    expect(cover('HALF', player)).toEqual([expect.objectContaining({ label: half.label })])
    expect(cover('HALF', 'gm-user')).toEqual([expect.objectContaining({ label: half.label })])
    expect(cover(null, player)).toEqual([expect.objectContaining({ label: 'No cover' })])
    expect(cover('MISSING', player)).toEqual([])
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
        { category: 'OTHER', id: 'health:defeated', kind: 'HEALTH', label: 'Defeated' }
      ])
      expect(result.fillColor).toBe(0x495057)
      expect(result.accessibleDescription).toContain('Defeated')
    }
  })

  it('marks a defeated creature that has loot, only when given the loot actors (the GM view)', () => {
    const scene = sceneForActor()
    const token = scene.tokens[0]!
    const enemyId = tabletopGmEncounter.actors[1]!.id
    const present = (lootActorIds?: ReadonlySet<string>) =>
      buildVttTokenPresentations({
        boundTokenControl: new Map(),
        actorIdByTokenId: new Map([[token.id, enemyId]]),
        currentUserId: token.controlledByUserIds[0]!,
        encounter: {
          ...tabletopGmEncounter,
          currentActorId: null,
          actors: tabletopGmEncounter.actors.map((actor) =>
            actor.id === enemyId ? { ...actor, defeated: true } : actor
          )
        },
        lootActorIds,
        pending: null,
        scene
      })[token.id]!
    const marked = present(new Set([enemyId]))
    expect(marked.statuses.map((status) => status.kind)).toEqual(['LOOT', 'HEALTH'])
    expect(marked.accessibleDescription).toContain('Has loot')
    for (const result of [present(), present(new Set())])
      expect(result.statuses.map((status) => status.kind)).toEqual(['HEALTH'])
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
        { category: 'OTHER', id: 'health:defeated', kind: 'HEALTH', label: 'Dead' }
      ])
      expect(result.accessibleDescription).toContain('Dead')
    }
  })

  it('rings a token by its actor disposition, white without an actor, whoever controls it', () => {
    const scene = sceneForActor()
    const token = scene.tokens[0]!
    const actor = tabletopGmEncounter.actors[1]!
    const ring = (disposition: 'FRIENDLY' | 'HOSTILE' | 'NEUTRAL' | null, controlled: boolean) =>
      buildVttTokenPresentations({
        actorIdByTokenId: disposition ? new Map([[token.id, actor.id]]) : new Map(),
        boundTokenControl: new Map([[token.id, controlled]]),
        currentUserId: token.controlledByUserIds[0]!,
        encounter: {
          ...tabletopGmEncounter,
          actors: tabletopGmEncounter.actors.map((candidate) =>
            candidate.id === actor.id && disposition ? { ...candidate, disposition } : candidate
          )
        },
        pending: null,
        scene
      })[token.id]!.outlineColor

    const expectedRing = { FRIENDLY: 0x339af0, HOSTILE: 0xff6b6b, NEUTRAL: 0xcc5de8 } as const
    for (const disposition of ['FRIENDLY', 'HOSTILE', 'NEUTRAL'] as const) {
      expect(ring(disposition, false)).toBe(expectedRing[disposition])
      expect(ring(disposition, true)).toBe(ring(disposition, false))
    }
    expect(new Set(Object.values(dispositionRingColours)).size).toBe(3)
    expect(ring(null, true)).toBe(0xffffff)
    expect(ring(null, false)).toBe(0xffffff)
  })

  it('names the disposition in the label and the description, and none without an actor', () => {
    const scene = sceneForActor()
    const token = scene.tokens[0]!
    const actor = tabletopGmEncounter.actors[1]!
    const presentation = (disposition: 'FRIENDLY' | 'HOSTILE' | 'NEUTRAL' | null) =>
      buildVttTokenPresentations({
        actorIdByTokenId: disposition ? new Map([[token.id, actor.id]]) : new Map(),
        boundTokenControl: new Map(),
        currentUserId: token.controlledByUserIds[0]!,
        encounter: {
          ...tabletopGmEncounter,
          actors: tabletopGmEncounter.actors.map((candidate) =>
            candidate.id === actor.id && disposition ? { ...candidate, disposition } : candidate
          )
        },
        pending: null,
        scene
      })[token.id]!

    const expectedLabels = { FRIENDLY: 'Friendly', HOSTILE: 'Hostile', NEUTRAL: 'Neutral' } as const
    for (const disposition of ['FRIENDLY', 'HOSTILE', 'NEUTRAL'] as const) {
      const result = presentation(disposition)
      expect(result.dispositionLabel).toBe(expectedLabels[disposition])
      expect(result.accessibleDescription).toContain(expectedLabels[disposition])
      // The disposition says what the creature is, so it follows the label and kind.
      expect(result.accessibleDescription).toMatch(
        new RegExp(`^[^.]+\\. [^.]+\\. ${expectedLabels[disposition]}(\\.|$)`)
      )
    }
    const actorless = presentation(null)
    expect(actorless.dispositionLabel).toBeNull()
    expect(actorless.accessibleDescription).toContain('Scene token')
    expect(actorless.accessibleDescription).not.toMatch(/Friendly|Hostile|Neutral/)
  })

  it('reads as red for Hostile, blue for Friendly and purple for Neutral', () => {
    const channels = (colour: number) => ({
      blue: colour & 0xff,
      green: (colour >> 8) & 0xff,
      red: (colour >> 16) & 0xff
    })
    const hostile = channels(dispositionRingColours.HOSTILE)
    expect(hostile.red).toBeGreaterThan(hostile.green + 64)
    expect(hostile.red).toBeGreaterThan(hostile.blue + 64)
    const friendly = channels(dispositionRingColours.FRIENDLY)
    expect(friendly.blue).toBeGreaterThan(friendly.red + 64)
    expect(friendly.blue).toBeGreaterThan(friendly.green + 32)
    const neutral = channels(dispositionRingColours.NEUTRAL)
    expect(neutral.red).toBeGreaterThan(neutral.green + 64)
    expect(neutral.blue).toBeGreaterThan(neutral.green + 64)
  })

  it('says Yours in the description for a token the viewer controls through its actor', () => {
    const scene = sceneForActor()
    const token = scene.tokens[0]!
    const actor = tabletopGmEncounter.actors[1]!
    const description = (controlled: boolean) =>
      buildVttTokenPresentations({
        actorIdByTokenId: new Map([[token.id, actor.id]]),
        boundTokenControl: new Map([[token.id, controlled]]),
        currentUserId: token.controlledByUserIds[0]!,
        encounter: tabletopGmEncounter,
        pending: null,
        scene
      })[token.id]!.accessibleDescription

    expect(description(true)).toContain('Yours')
    expect(description(false)).not.toContain('Yours')
  })

  it('shows active grants on a token with their source and time left, naming a hidden source neutrally', () => {
    const actor = {
      ...tabletopGmEncounter.actors[0]!,
      activeGrants: [
        {
          effectId: '55555555-5555-4555-8555-555555555501',
          label: 'Aid',
          sourceHidden: false,
          sourceActorId: null,
          remainingTicks: 4,
          expiresAtCampaignMinute: null,
          polarity: 'BENEFICIAL' as const
        },
        {
          effectId: '55555555-5555-4555-8555-555555555502',
          label: null,
          sourceHidden: true,
          sourceActorId: null,
          remainingTicks: null,
          expiresAtCampaignMinute: null,
          polarity: 'NEUTRAL' as const
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

  // VTT_UI-1.3: a mark (ATTACK-13) is an ordinary grant, categorised by its derived polarity, that
  // names its marker; a hidden marker stays unnamed for players.
  it('lists a mark on the marked token with the name of the creature that made it', () => {
    const [ember, warden] = tabletopGmEncounter.actors
    const mark = srdMarkListing({ markerActorId: ember!.id, holderActorId: warden!.id })
    const scene = sceneForActor()
    const token = scene.tokens[0]!
    const present = (grant: typeof mark) =>
      buildVttTokenPresentations({
        actorIdByTokenId: new Map([[token.id, warden!.id]]),
        boundTokenControl: new Map(),
        currentUserId: token.controlledByUserIds[0]!,
        encounter: {
          ...tabletopGmEncounter,
          actors: [ember!, { ...warden!, activeGrants: [grant] }]
        },
        pending: null,
        scene
      })[token.id]!.statuses.find((status) => status.kind === 'EFFECT')

    expect(mark.sourceActorId).toBe(ember!.id)
    expect(present(mark)).toEqual({
      category: 'HARMFUL',
      id: `grant:${mark.effectId}`,
      kind: 'EFFECT',
      label: `${mark.label} from ${ember!.label}, ${activeGrantTimeLeft(mark)}`
    })
    expect(mark.polarity).toBe('HARMFUL')
    const [hidden] = hideActiveGrantSources(
      [{ ...mark, sourceHidden: true }],
      new Set([ember!.id, warden!.id])
    )
    expect(present(hidden!)?.label).toBe(`Hidden source, ${activeGrantTimeLeft(mark)}`)
  })

  it('categorises statuses by what the Encounter data says they are, with a grant read by its polarity and Concentration among them', () => {
    const actor = {
      ...tabletopGmEncounter.actors[0]!,
      activeGrants: [
        {
          effectId: '55555555-5555-4555-8555-555555555501',
          label: 'Aid',
          sourceHidden: false,
          sourceActorId: null,
          remainingTicks: 4,
          expiresAtCampaignMinute: null,
          polarity: 'BENEFICIAL' as const
        },
        {
          effectId: '55555555-5555-4555-8555-555555555502',
          label: 'Hex',
          sourceHidden: false,
          sourceActorId: null,
          remainingTicks: 4,
          expiresAtCampaignMinute: null,
          polarity: 'HARMFUL' as const
        },
        {
          effectId: '55555555-5555-4555-8555-555555555503',
          label: 'Mixed boon',
          sourceHidden: false,
          sourceActorId: null,
          remainingTicks: 4,
          expiresAtCampaignMinute: null,
          polarity: 'NEUTRAL' as const
        }
      ],
      concentration: { label: 'Bless', sourceHidden: false },
      conditions: tabletopConditions('RESTRAINED', 'BLINDED')
    }
    const scene = sceneForActor()
    const result = buildVttTokenPresentations({
      actorIdByTokenId: new Map([[scene.tokens[0]!.id, actor.id]]),
      boundTokenControl: new Map(),
      conditionTypes: srdSystemRecord.conditionTypes,
      currentUserId: scene.tokens[0]!.controlledByUserIds[0]!,
      encounter: {
        ...tabletopGmEncounter,
        actors: [actor, ...tabletopGmEncounter.actors.slice(1)]
      },
      pending: null,
      scene
    })[scene.tokens[0]!.id]!

    expect(result.statuses.map((status) => [status.label, status.category])).toEqual([
      ['Concentrating: Bless', 'CONCENTRATION'],
      ['Blinded', 'HARMFUL'],
      ['Restrained', 'HARMFUL'],
      ['Aid, 4 rounds left', 'BENEFICIAL'],
      ['Hex, 4 rounds left', 'HARMFUL'],
      ['Mixed boon, 4 rounds left', 'OTHER']
    ])
  })

  describe('condition names', () => {
    const actor = { ...tabletopGmEncounter.actors[0]!, conditions: tabletopConditions('BLINDED') }
    const scene = sceneForActor()
    const present = (conditionTypes?: typeof srdSystemRecord.conditionTypes) =>
      buildVttTokenPresentations({
        actorIdByTokenId: new Map([[scene.tokens[0]!.id, actor.id]]),
        boundTokenControl: new Map(),
        conditionTypes,
        currentUserId: scene.tokens[0]!.controlledByUserIds[0]!,
        encounter: { ...tabletopGmEncounter, actors: [actor] },
        pending: null,
        scene
      })[scene.tokens[0]!.id]!

    it('labels each condition ID with the System vocabulary label and description', () => {
      const blinded = srdSystemRecord.conditionTypes.find(({ code }) => code === 'BLINDED')!
      expect(present(srdSystemRecord.conditionTypes).statuses).toContainEqual(
        expect.objectContaining({
          id: blinded.id,
          kind: 'CONDITION',
          label: blinded.label,
          description: blinded.description
        })
      )
    })

    it('shows no condition while the vocabulary is loading', () => {
      expect(present().statuses.filter(({ kind }) => kind === 'CONDITION')).toEqual([])
    })

    it('refuses a condition type the vocabulary does not define', () => {
      expect(() => present([])).toThrow('is not defined by the System')
    })
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
