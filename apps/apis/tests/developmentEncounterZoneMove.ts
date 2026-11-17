import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import type {
  EncounterCommandResultDto,
  MoveZoneInputDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { DevelopmentClient } from './developmentClient'
import { startPlayerEncounterJourney } from './developmentEncounterPlayerJourney'

/** The Scene is 600 by 300 units, 50 units to a 5 foot square (see startPlayerEncounterJourney). */
const MAP = { width: 600, height: 300 }
/** Where the Character casts the zone, 40 feet from the Character and clear of the creature. */
const CAST_AT = { x: 500, y: 200 }
/** Where the Character moves it: 10 feet west, inside the 30 foot move. */
const MOVE_TO = { x: 400, y: 200 }

export type EncounterZoneMoveBrowserFixture = {
  scene: { id: string; name: string }
  map: typeof MAP
  hero: { label: string }
  /** The spell the Character casts to place the zone, as its action's label begins. */
  spellLabel: string
  castAt: typeof CAST_AT
  moveTo: typeof MOVE_TO
}

type Step<TCommand> = { command: TCommand; result: EncounterCommandResultDto }

/** The zone row the Actions drawer lists: the label, what moving it costs and how far it may move. */
export type ZoneMoveRow = { label: string; activationLabel: string; distanceLabel: string }

/** Everything the player does in their own browser; the dice go through the owner's API. */
export type EncounterZoneMoveBrowserControls = {
  /** Picks the spell, picks the cast point on the map and resolves the cast. */
  castZone: () => Promise<Step<ResolveEncounterActionInputDto>>
  /** The Actions drawer lists the zone with its move cost and range. */
  assertZoneRow: (row: ZoneMoveRow) => Promise<void>
  /** Chooses the zone, picks its new center on the map and moves it. */
  moveZone: (row: ZoneMoveRow) => Promise<Step<MoveZoneInputDto>>
}

export type EncounterZoneMoveBrowserRunner = (
  fixture: EncounterZoneMoveBrowserFixture,
  verify: (controls: EncounterZoneMoveBrowserControls) => Promise<void>
) => Promise<void>

/**
 * A Character casts Flaming Sphere, then on the same turn moves the sphere from the Actions drawer by a
 * point picked on the map: the move costs the Bonus Action, and the drawer afterwards warns that it is
 * spent. The dice go through the owner's API as stand-ins: the proof is the player's own surface.
 */
export async function verifyEncounterZoneMove({
  owner,
  player,
  campaignId,
  characterId,
  playerUserId,
  creatureSourceId,
  spellSubjectIds,
  classId,
  initiativePolicyDefinitionId,
  initiativePolicyCatalogueId,
  checkpoint,
  browser
}: {
  owner: DevelopmentClient & Pick<ConvexHttpClient, 'action'>
  player: DevelopmentClient
  campaignId: string
  characterId: string
  playerUserId: string
  creatureSourceId: string
  /** The Flaming Sphere copy the Character may know, by source id. */
  spellSubjectIds: readonly string[]
  classId: string
  initiativePolicyDefinitionId: string
  initiativePolicyCatalogueId: string
  /** Publishes what the room holds to Convex: a running table saves only at save points (D90). */
  checkpoint: () => Promise<void>
  browser: EncounterZoneMoveBrowserRunner
}) {
  const { hero, scene, readProjection, readChoices, settle } = await startPlayerEncounterJourney({
    name: 'Zone move',
    owner,
    player,
    campaignId,
    characterId,
    playerUserId,
    creatureSourceId,
    spellSubjectIds,
    classId,
    initiativePolicyDefinitionId,
    initiativePolicyCatalogueId,
    checkpoint
  })
  const readZoneMoves = async () => (await readChoices(hero.id)).zoneMoves

  await browser(
    {
      scene,
      map: MAP,
      hero: { label: hero.label },
      spellLabel: 'Flaming Sphere',
      castAt: CAST_AT,
      moveTo: MOVE_TO
    },
    async (controls) => {
      assert.equal((await readProjection()).currentActorId, hero.id)
      assert.deepEqual(await readZoneMoves(), [], 'No zone is movable before the cast.')

      // 1. The Character casts the sphere on the map; the action settles through the owner's API.
      const cast = await controls.castZone()
      assert.equal(cast.command.actorId, hero.id)
      const settled = await settle(cast.result, 10)
      assert.equal(settled.occurrence?.status ?? 'COMPLETE', 'COMPLETE')

      // 2. The contract lists the sphere with its authored move; the drawer shows it.
      const [offered, ...rest] = await readZoneMoves()
      assert.deepEqual(rest, [])
      if (!offered) throw new Error('The cast sphere is not offered as a zone move.')
      assert.equal(offered.activation, 'BONUS_ACTION')
      assert.deepEqual(offered.maxDistance, { amount: 30, unit: 'FEET' })
      assert.deepEqual(offered.warnings, [], 'The Bonus Action is free before the move.')
      const row: ZoneMoveRow = {
        label: offered.label,
        activationLabel: 'Bonus Action',
        distanceLabel: '30 feet'
      }
      await controls.assertZoneRow(row)

      // 3. The Character moves the sphere to the picked point.
      const moved = await controls.moveZone(row)
      assert.equal(moved.command.actorId, hero.id)
      assert.equal(moved.command.spatialEffectId, offered.spatialEffectId)
      assert.deepEqual(moved.command.acknowledgedWarnings, [])
      assert.ok(
        Math.hypot(
          moved.command.destination.x - MOVE_TO.x,
          moved.command.destination.y - MOVE_TO.y
        ) <
          MAP.width / 12,
        'The move lands where the Character picked on the map.'
      )

      // 4. The move spent the Bonus Action, so the zone is offered again with the warning.
      const [after, ...others] = await readZoneMoves()
      assert.deepEqual(others, [])
      assert.equal(after?.spatialEffectId, offered.spatialEffectId)
      assert.ok((after?.warnings.length ?? 0) > 0, 'The spent Bonus Action is warned about.')
    }
  )
  console.log('Native zone move journey passed.')
}
