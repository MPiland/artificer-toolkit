import { describe, expect, it } from 'vitest'
import { compileSpellEffect } from '@artificer-toolkit/shared/compilers'
import { flamingSphere } from '@artificer-toolkit/source-data/srd/spells/flaming-sphere.js'
import { moonbeam } from '@artificer-toolkit/source-data/srd/spells/moonbeam.js'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { compileActionPlacement } from '../encounterActionEntryPointCompiler.js'
import { zoneMoveRam } from '../encounterZoneMove.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'

/** The zone a spell's cast places, compiled from the SRD spell as authored. */
function zonePlacementOf(spell: Pick<SpellAuthored, 'label' | 'attributes' | 'effects'>) {
  const [effect] = spell.effects ?? []
  if (!effect) throw new Error(`${spell.label} authors no Effect.`)
  const placement = compileActionPlacement(
    dnd5eCharacterRuleActionSystemAdapter,
    characterActionDescriptor(
      compileSpellEffect(
        { attributes: spell.attributes, effects: spell.effects ?? [] },
        { ...effect, id: ACTION_EFFECT_ID }
      ),
      2,
      20
    )
  )
  if (placement?.kind !== 'ZONE' || 'options' in placement.zonePlacement)
    throw new Error(`${spell.label} places no single zone.`)
  return placement.zonePlacement
}

describe('a zone its source moves (QUALITY-15.T3y8)', () => {
  it.each([
    {
      spell: flamingSphere,
      move: { activation: 'BONUS_ACTION', maxDistance: { amount: 30, unit: 'FEET' }, rams: true }
    },
    { spell: moonbeam, move: { activation: 'ACTION', maxDistance: { amount: 60, unit: 'FEET' } } }
  ])(
    'compiles $spell.label with its authored move, held by Concentration',
    ({ spell, move }) => {
      const zone = zonePlacementOf(spell)
      expect(zone.maintenance).not.toBeNull()
      expect(zone.move).toEqual(move)
    }
  )

  it('refuses a move on a zone its source does not maintain', () => {
    expect(() => zonePlacementOf({ ...flamingSphere, attributes: [] })).toThrow(
      'Only a zone its source maintains is moved by its source.'
    )
  })
})

describe('a zone moved into a creature (QUALITY-15.T3y8c)', () => {
  // A 50-pixel square per 5 feet: the sphere's 15-foot reach centered on the square at (125, 125).
  const reach = {
    kind: 'POLYGON' as const,
    points: [
      { x: 50, y: 50 },
      { x: 200, y: 50 },
      { x: 200, y: 200 },
      { x: 50, y: 200 }
    ]
  }
  const creature = (id: string, x: number, y: number) => ({
    id,
    position: { x, y },
    width: 50,
    height: 50
  })
  const ramOf = (
    spell: Pick<SpellAuthored, 'label' | 'attributes' | 'effects'>,
    destination: { x: number; y: number },
    tokens: ReturnType<typeof creature>[],
    actorIds: readonly string[] = tokens.map(({ id }) => id)
  ) => {
    const { move } = zonePlacementOf(spell)
    if (!move) throw new Error(`${spell.label} authors no move.`)
    return zoneMoveRam({
      shape: reach,
      move,
      destination,
      tokens,
      actorIdByTokenId: new Map(actorIds.map((id) => [id, `actor-${id}`]))
    })
  }

  it('stops Flaming Sphere where its center meets the first creature on the way', () => {
    expect(
      ramOf(flamingSphere, { x: 425, y: 125 }, [
        creature('far', 375, 125),
        creature('near', 225, 125)
      ])
    ).toEqual({ targetActorId: 'actor-near', tokenId: 'near', stop: { x: 200, y: 125 } })
  })

  it('rams the creature whose square the sphere is moved onto', () => {
    expect(ramOf(flamingSphere, { x: 325, y: 325 }, [creature('goblin', 325, 325)])).toEqual({
      targetActorId: 'actor-goblin',
      tokenId: 'goblin',
      stop: { x: 300, y: 300 }
    })
  })

  it.each([
    ['moved along the edge of a creature', { x: 275, y: 125 }, creature('beside', 225, 100)],
    ['stopped short of a creature', { x: 225, y: 125 }, creature('ahead', 275, 125)],
    ['moved away from a creature behind it', { x: 275, y: 125 }, creature('behind', 75, 125)]
  ])('rams no one when %s', (_, destination, token) => {
    expect(ramOf(flamingSphere, destination, [token])).toBeNull()
  })

  it('moves through a token bound to no creature', () => {
    expect(ramOf(flamingSphere, { x: 425, y: 125 }, [creature('crate', 275, 125)], [])).toBeNull()
  })

  it('leaves a move that does not ram (Moonbeam) to go all the way', () => {
    expect(ramOf(moonbeam, { x: 275, y: 125 }, [creature('goblin', 275, 125)])).toBeNull()
  })
})
