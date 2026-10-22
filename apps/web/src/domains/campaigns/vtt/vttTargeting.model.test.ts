import { describe, expect, it } from 'vitest'
import type { EncounterActionTargetModifiersDto } from '@artificer-toolkit/schema/api/encounterActionTargetModifiers'
import { tabletopLiveScene } from './CampaignTabletop.stories.fixtures'
import type { VttActionPreview } from './vttSceneRenderer.model'
import {
  buildTargetEntries,
  describeTargetEntry,
  orderActorsForTargeting,
  targetableEncounterActors,
  targetableTokenIds
} from './vttTargeting.model'

const [sourceToken, template] = tabletopLiveScene.tokens
if (!sourceToken || !template) throw new Error('The fixture Scene needs two Tokens.')

// The fixture Scene is a square grid of 70-pixel cells worth 5 feet each.
const feet = (amount: number) => ({ amount, unit: 'FEET' as const })
const cell = 70
const tokenAt = (id: string, cells: number) => ({
  ...template,
  id,
  label: id,
  position: { x: sourceToken.position.x + cells * cell, y: sourceToken.position.y }
})
const actor = (id: string, defeated = false) => ({ defeated, id, label: `Creature ${id}` })
const unseen = (id: string, unseenReason: 'HIDDEN' | 'INVISIBLE') => ({
  ...actor(id),
  unseenReason
})

const near = tokenAt('near-token', 2)
const mirrorNear = tokenAt('mirror-token', -2)
const middle = tokenAt('middle-token', 6)
const far = tokenAt('far-token', 14)
const scene = {
  grid: tabletopLiveScene.grid,
  tokens: [sourceToken, near, mirrorNear, middle, far]
}
const actorIdByTokenId = new Map([
  [sourceToken.id, 'caster'],
  [near.id, 'near'],
  [mirrorNear.id, 'mirror'],
  [middle.id, 'middle'],
  [far.id, 'far']
])
const range: VttActionPreview['range'] = { kind: 'RANGED', normal: feet(20), long: feet(40) }

const build = (overrides: Partial<Parameters<typeof buildTargetEntries>[0]> = {}) =>
  buildTargetEntries({
    actorIdByTokenId,
    // Initiative order: the farthest creature acts first.
    actors: [
      actor('far'),
      actor('caster'),
      actor('middle'),
      actor('mirror'),
      actor('near'),
      actor('hidden-far')
    ],
    currentActorId: 'caster',
    modifiers: null,
    range,
    scene,
    selfRefused: false,
    sourceTokenId: sourceToken.id,
    ...overrides
  })

describe('target entries', () => {
  it('sorts nearest first, keeps initiative order at equal distance and puts a visible creature with no token last', () => {
    const entries = build()
    expect(entries.map(({ actorId }) => actorId)).toEqual([
      'caster',
      'mirror',
      'near',
      'middle',
      'far',
      'hidden-far'
    ])
    expect(entries.at(-1)).toMatchObject({
      band: null,
      distance: null,
      distanceLabel: null,
      tokenId: null
    })
    expect(describeTargetEntry(entries.at(-1)!)).toBe('Distance unknown')
  })

  // D131 replaces the shipped rule that sorted every creature without a distance last: a creature
  // the GM revealed but the player cannot see leads the list, marked and with no distance.
  it('lists revealed creatures the player cannot see first, marked Hidden or Invisible, then visible creatures nearest first (D131)', () => {
    const entries = build({
      actors: [
        actor('far'),
        unseen('ghost', 'INVISIBLE'),
        actor('caster'),
        actor('middle'),
        unseen('lurker', 'HIDDEN'),
        actor('mirror'),
        actor('near'),
        actor('hidden-far')
      ]
    })

    expect(entries.map(({ actorId }) => actorId)).toEqual([
      'ghost',
      'lurker',
      'caster',
      'mirror',
      'near',
      'middle',
      'far',
      'hidden-far'
    ])
    expect(entries.slice(0, 2)).toMatchObject([
      { band: null, distance: null, distanceLabel: null, tokenId: null, unseenReason: 'INVISIBLE' },
      { band: null, distance: null, distanceLabel: null, tokenId: null, unseenReason: 'HIDDEN' }
    ])
    expect(entries.slice(0, 2).map(describeTargetEntry)).toEqual([
      'Invisible · Distance unknown',
      'Hidden · Distance unknown'
    ])
    expect(entries.slice(2).every(({ unseenReason }) => unseenReason === null)).toBe(true)
  })

  it('never measures or offers on the map a creature the player cannot see', () => {
    const ghostToken = tokenAt('ghost-token', 1)
    const entries = build({
      actorIdByTokenId: new Map([...actorIdByTokenId, [ghostToken.id, 'ghost']]),
      actors: [unseen('ghost', 'INVISIBLE'), actor('near')],
      scene: { ...scene, tokens: [...scene.tokens, ghostToken] }
    })

    expect(entries[0]).toMatchObject({ actorId: 'ghost', distance: null, tokenId: null })
    expect(targetableTokenIds(entries).has(ghostToken.id)).toBe(false)
  })

  it('lists creatures in initiative order when there is no Scene to measure on', () => {
    expect(build({ scene: null, sourceTokenId: null }).map(({ actorId }) => actorId)).toEqual([
      'far',
      'caster',
      'middle',
      'mirror',
      'near',
      'hidden-far'
    ])
  })

  it('marks each creature in normal range, long range or out of range', () => {
    const bands = Object.fromEntries(build().map((entry) => [entry.actorId, entry.band]))
    expect(bands).toMatchObject({
      far: 'OUT',
      middle: 'LONG',
      near: 'NORMAL'
    })
  })

  it('lists a defeated creature nowhere and the acting creature only when the action allows itself', () => {
    const actors = [actor('caster'), actor('near'), actor('far', true)]
    expect(build({ actors, selfRefused: false }).map(({ actorId }) => actorId)).toEqual([
      'caster',
      'near'
    ])
    expect(build({ actors, selfRefused: true }).map(({ actorId }) => actorId)).toEqual(['near'])
    expect(targetableEncounterActors(actors, 'caster', true).map(({ id }) => id)).toEqual(['near'])
  })

  it('lists only the creatures a held-only action may target', () => {
    const actors = [actor('caster'), actor('near'), actor('far')]
    expect(targetableEncounterActors(actors, 'caster', false, ['far']).map(({ id }) => id)).toEqual(
      ['far']
    )
    expect(build({ actors, onlyActorIds: ['far'] }).map(({ actorId }) => actorId)).toEqual(['far'])
  })

  it('orders the turn-order list by target order and leaves unlisted creatures after it', () => {
    const actors = [actor('far'), actor('caster'), actor('near'), actor('gone', true)]
    const entries = build({ actors, selfRefused: true })
    expect(orderActorsForTargeting(actors, entries).map(({ id }) => id)).toEqual([
      'near',
      'far',
      'caster',
      'gone'
    ])
  })

  it('sets the targetable flag exactly on listed tokens in normal or long range', () => {
    expect([...targetableTokenIds(build())].sort()).toEqual(
      [sourceToken.id, near.id, mirrorNear.id, middle.id].sort()
    )
    // A creature the list leaves out is never targetable on the map.
    expect([...targetableTokenIds(build({ actors: [actor('near'), actor('far', true)] }))]).toEqual(
      [near.id]
    )
  })

  it('leaves every listed token targetable when the range cannot be measured', () => {
    for (const unmeasured of [
      { kind: 'UNLIMITED' as const },
      { kind: 'SELF' as const },
      undefined,
      {
        kind: 'WITHIN' as const,
        distance: {
          ...feet(5),
          scaling: {
            scalingKind: 'BREAKPOINTS' as const,
            scalingSource: 'CHARACTER_LEVEL' as const,
            breakpoints: []
          }
        }
      }
    ]) {
      const entries = build({ range: unmeasured as VttActionPreview['range'] })
      expect(entries.every(({ band }) => band === null)).toBe(true)
      expect(targetableTokenIds(entries).has(far.id)).toBe(true)
    }
  })

  it('shows the modifiers the Character believes beside the distance, never a mode the read left out', () => {
    const modifiers: EncounterActionTargetModifiersDto = {
      actionId: 'action',
      actorId: 'caster',
      encounterId: '00000000-0000-4000-8000-000000000001',
      encounterVersion: 3,
      targets: [
        {
          actorId: 'middle',
          attack: {
            rollMode: 'DISADVANTAGE',
            rollModeLabel: 'Disadvantage',
            keep: 'LOWER',
            reasons: ['Long range']
          }
        },
        {
          actorId: 'near',
          attack: { rollMode: 'NORMAL', rollModeLabel: 'Normal', keep: 'FIRST', reasons: [] }
        }
      ]
    }
    const entries = build({ modifiers })
    const described = Object.fromEntries(
      entries.map((entry) => [entry.actorId, describeTargetEntry(entry)])
    )
    expect(described.middle).toMatch(/In long range · Disadvantage \(Long range\)$/)
    expect(described.near).toMatch(/In range · Normal$/)
    // The read named no mode for the farthest creature, so none is invented.
    expect(described.far).toMatch(/Out of range$/)
    expect(entries.find(({ actorId }) => actorId === 'far')?.attack).toBeNull()
  })
})
