import { ConvexError } from 'convex/values'
import { domainRejectionErrorDataSchema } from '@artificer-toolkit/schema/api/domainRejections'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { healthBand } from '@artificer-toolkit/rules-runtime/encounterPlayerProjection'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  advance,
  deafened,
  enemyBites,
  execute,
  setup,
  sheetCommand,
  start,
  storedCharacter,
  toEnemyTurn,
  type CommandResult,
  type Fixture
} from '../../tests/fixtures/liveCharacterRun'
import { api } from '../_generated/api'
import {
  checkpointLiveRoom,
  checkpointRoom,
  deliverQueuedRoomControl,
  executeInRoom,
  queueRoomRolls,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()
afterEach(() => {
  vi.unstubAllEnvs()
})

/** Advances to the Creature's next turn and has it bite the Character. */
async function enemyBitesHero(fixture: Fixture, from: CommandResult) {
  return enemyBites(fixture, await toEnemyTurn(fixture, from))
}

/** Commits a Builder edit of the current Character document, as its player would. */
async function builderEdit(
  fixture: Fixture,
  change: (character: CharacterAuthored) => CharacterAuthored
) {
  const current = await storedCharacter(fixture)
  const draft = await fixture.player.caller.mutation(api.characters.drafts.create, {
    id: current.id,
    systemId: srdSystemRecord.id
  })
  await fixture.player.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'edit',
    character: change(current)
  })
  await deliverQueuedRoomControl(fixture.t)
}

function projectedHero(fixture: Fixture, result: CommandResult) {
  const actor = encounterGmProjectionDtoSchema
    .parse(result.projection)
    .actors.find((candidate) => candidate.id === fixture.hero.id)
  if (!actor) throw new Error('Missing projected Character actor.')
  return actor
}

describe('Encounter reads of live Character state', () => {
  it('keeps Encounter commands and projections current after Sheet edits made after Run creation', async () => {
    // Sheet edits: damage, a spent slot, an equipped item and a condition, all after Run creation.
    const fixture = await setup()
    const sheet = await fixture.player.caller.query(api.characters.sheet.get, {
      id: fixture.character.id
    })
    const item = sheet?.inventory.items[0]
    if (!sheet || !item) throw new Error('Missing journey inventory.')
    await sheetCommand(fixture, (base) => ({
      ...base,
      type: 'ADJUST_HIT_POINTS',
      mode: 'DAMAGE',
      amount: 2
    }))
    await sheetCommand(fixture, (base) => ({
      ...base,
      type: 'USE_SPELL_SLOT',
      slotKey: 'STANDARD:1'
    }))
    await sheetCommand(fixture, (base) => ({ ...base, type: 'EQUIP_ITEM', itemId: item.id }))
    await sheetCommand(fixture, (base) => ({
      ...base,
      type: 'ADD_CONDITION',
      conditionTypeId: deafened.id
    }))
    const edited = await storedCharacter(fixture)
    expect(edited.state.hitpoints.current).toBe(fixture.hero.currentHitPoints - 2)

    await queueRoomRolls(fixture.campaign.id, { rolls: [], repeat: 10 })
    try {
      let result = await start(fixture)
      expect(projectedHero(fixture, result)).toMatchObject({
        currentHitPoints: edited.state.hitpoints.current,
        sourceRevision: null
      })

      const acted = new Set<string>()
      while (acted.size < 2) {
        const currentActorId = result.projection.currentActorId
        if (currentActorId === fixture.enemy.id && !acted.has(currentActorId)) {
          const expectedVersion = result.projection.version
          result = await execute(fixture, (base) => ({
            ...base,
            type: 'RESOLVE_ACTION',
            acceptedWieldConflict: null,
            acknowledgedWarnings: [],
            expectedVersion,
            actorId: fixture.enemy.id,
            target: { kind: 'ACTOR', actorId: fixture.hero.id },
            actionId: fixture.actionIds.enemy,
            optionalCombatIntent: null,
            sceneContext: null
          }))
          expect(result.occurrence?.status).toBe('COMPLETE')
          expect(projectedHero(fixture, result)).toMatchObject({
            currentHitPoints: edited.state.hitpoints.current - 1,
            conditions: [expect.objectContaining({ conditionTypeId: deafened.id })]
          })
          acted.add(currentActorId)
        } else if (currentActorId === fixture.hero.id && !acted.has(currentActorId)) {
          const expectedVersion = result.projection.version
          result = await execute(fixture, (base) => ({
            ...base,
            type: 'RESOLVE_ACTION',
            acceptedWieldConflict: null,
            acknowledgedWarnings: [],
            expectedVersion,
            actorId: fixture.hero.id,
            target: { kind: 'ACTOR', actorId: fixture.enemy.id },
            actionId: fixture.actionIds.hero,
            optionalCombatIntent: null,
            sceneContext: null
          }))
          expect(result.occurrence?.status).toBe('COMPLETE')
          // Creature hit points stay Run-owned.
          expect(
            result.projection.actors.find((actor) => actor.id === fixture.enemy.id)
          ).toMatchObject({ currentHitPoints: fixture.enemy.currentHitPoints - 1 })
          acted.add(currentActorId)
        }
        if (acted.size < 2) result = await advance(fixture, result)
      }
      const round = result.projection.round
      while (result.projection.round === round) result = await advance(fixture, result)
      expect(result.projection.round).toBe(round + 1)
    } finally {
      await queueRoomRolls(fixture.campaign.id, { rolls: [] })
    }

    const final = await storedCharacter(fixture)
    expect(final.state.hitpoints.current).toBe(edited.state.hitpoints.current - 1)
    expect(final.state.spellSlots).toEqual(edited.state.spellSlots)
    expect(final.state.equipment.equipped).toContainEqual(
      expect.objectContaining({ itemId: item.id })
    )
    await checkpointRoom(fixture.campaign.id)
    const gmView = await fixture.owner.caller.query(api.encounters.projectionReads.get, {
      encounterId: fixture.run.id
    })
    const gmHero = gmView.actors.find((actor) => actor.id === fixture.hero.id)
    expect(gmHero).toHaveProperty('healthBand')
    if (gmHero && 'currentHitPoints' in gmHero)
      expect(gmHero.currentHitPoints).toBe(final.state.hitpoints.current)
    // Every actor's health stays GM-only in the player projection.
    const playerView = await fixture.player.caller.query(api.encounters.projectionReads.get, {
      encounterId: fixture.run.id
    })
    const playerViewHero = playerView.actors.find((actor) => actor.id === fixture.hero.id)
    expect(playerViewHero).toBeDefined()
    expect(playerViewHero).not.toHaveProperty('healthBand')

    // A later Sheet change shows in the live read without another Encounter command.
    await sheetCommand(fixture, (base) => ({
      ...base,
      type: 'ADJUST_HIT_POINTS',
      mode: 'HEAL',
      amount: 1
    }))
    await checkpointRoom(fixture.campaign.id)
    const gm = await fixture.owner.caller.query(api.encounters.projectionReads.get, {
      encounterId: fixture.run.id
    })
    const healed = gm.actors.find((actor) => actor.id === fixture.hero.id)
    expect(healed && 'currentHitPoints' in healed ? healed.currentHitPoints : null).toBe(
      final.state.hitpoints.current + 1
    )
  }, 60000)

  it('shows a changed Character maximum without blocking Encounter commands on it', async () => {
    const fixture = await setup()
    await queueRoomRolls(fixture.campaign.id, { rolls: [], repeat: 10 })
    try {
      let result = await start(fixture)
      const initial = projectedHero(fixture, result)

      // Constitution 13 -> 15 through the Builder: +1 maximum at level 1.
      await builderEdit(fixture, (character) => {
        const abilities = character.intent.abilities
        if (abilities?.method !== 'STANDARD_ARRAY') throw new Error('Expected a standard array.')
        return {
          ...character,
          intent: {
            ...character.intent,
            abilities: {
              ...abilities,
              assignments: abilities.assignments.map((assignment) =>
                assignment.ability === 'STRENGTH'
                  ? { ...assignment, option: '13' as const }
                  : assignment.ability === 'CONSTITUTION'
                    ? { ...assignment, option: '15' as const }
                    : assignment
              )
            }
          }
        }
      })
      result = await enemyBitesHero(fixture, result)
      const constitution = projectedHero(fixture, result)
      expect(constitution.maxHitPoints).toBe(initial.maxHitPoints + 1)

      // A level-up through the Builder raises the maximum again.
      await builderEdit(fixture, (character) => {
        const [entry] = character.intent.classes ?? []
        const hitpoints = character.intent.hitpoints
        if (!entry || hitpoints?.method !== 'FIXED') throw new Error('Unexpected level fixture.')
        return {
          ...character,
          intent: {
            ...character.intent,
            classes: [{ ...entry, classLevel: 2 }],
            hitpoints: {
              ...hitpoints,
              levels: [
                ...hitpoints.levels,
                { level: 2, classId: entry.classId, classLevel: 2, value: 6 }
              ]
            }
          }
        }
      })
      result = await enemyBitesHero(fixture, result)
      const levelled = projectedHero(fixture, result)
      expect(levelled.maxHitPoints).toBe(constitution.maxHitPoints + 6 + 2)

      // A Sheet maximum adjustment; the health band uses current over the new maximum.
      await sheetCommand(fixture, (base) => ({
        ...base,
        type: 'UPSERT_SHEET_ADJUSTMENT',
        adjustment: {
          id: crypto.randomUUID(),
          family: 'HIT_POINTS',
          field: 'MAXIMUM_MODIFIER',
          value: 30
        }
      }))
      result = await enemyBitesHero(fixture, result)
      const adjusted = projectedHero(fixture, result)
      expect(adjusted.maxHitPoints).toBe(levelled.maxHitPoints + 30)
      expect(adjusted.healthBand).toBe(healthBand(adjusted.currentHitPoints, adjusted.maxHitPoints))
      expect(adjusted.healthBand).not.toBe('HEALTHY')
      await checkpointRoom(fixture.campaign.id)
      const live = await fixture.owner.caller.query(api.encounters.projectionReads.get, {
        encounterId: fixture.run.id
      })
      const hero = live.actors.find((actor) => actor.id === fixture.hero.id)
      expect(hero).toHaveProperty('healthBand', adjusted.healthBand)
      if (hero && 'maxHitPoints' in hero) expect(hero.maxHitPoints).toBe(adjusted.maxHitPoints)
      const playerLive = await fixture.player.caller.query(api.encounters.projectionReads.get, {
        encounterId: fixture.run.id
      })
      const playerLiveHero = playerLive.actors.find((actor) => actor.id === fixture.hero.id)
      expect(playerLiveHero).toBeDefined()
      expect(playerLiveHero).not.toHaveProperty('healthBand')
    } finally {
      await queueRoomRolls(fixture.campaign.id, { rolls: [] })
    }
  }, 60000)
})

async function revertRejection(fixture: Fixture, expectedVersion: number) {
  const error = await execute(fixture, (base) => ({
    ...base,
    type: 'REVERT_LAST_ACTION',
    expectedVersion
  })).then(
    () => null,
    (caught: unknown) => caught
  )
  if (!(error instanceof ConvexError)) throw new Error('Expected a domain rejection.')
  return domainRejectionErrorDataSchema.parse(error.data)
}

describe('GM undo against live Character state', () => {
  it('restores a Character the action damaged, then refuses once its Sheet changes', async () => {
    const fixture = await setup()
    const started = await start(fixture)
    const before = await storedCharacter(fixture)
    const bitten = await enemyBitesHero(fixture, started)
    expect((await storedCharacter(fixture)).state.hitpoints.current).toBe(
      before.state.hitpoints.current - 1
    )
    await expect(
      executeInRoom(fixture.player.caller, {
        command: {
          type: 'REVERT_LAST_ACTION',
          encounterId: fixture.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: bitten.projection.version
        }
      })
    ).rejects.toMatchObject({
      data: { reason: 'GM_ONLY', message: 'Only the GM can do that.' }
    })
    const undone = await execute(fixture, (base) => ({
      ...base,
      type: 'REVERT_LAST_ACTION',
      expectedVersion: bitten.projection.version
    }))
    expect(undone.projection.version).toBe(bitten.projection.version + 1)
    const restored = (await storedCharacter(fixture)).state.hitpoints
    expect(restored.current).toBe(before.state.hitpoints.current)
    expect(restored.temp).toBe(before.state.hitpoints.temp)
    expect(projectedHero(fixture, undone).currentHitPoints).toBe(before.state.hitpoints.current)

    const again = await enemyBitesHero(fixture, undone)
    await sheetCommand(fixture, (base) => ({
      ...base,
      type: 'ADJUST_HIT_POINTS',
      mode: 'HEAL',
      amount: 1
    }))
    expect(await revertRejection(fixture, again.projection.version)).toMatchObject({
      reason: 'REVERT_UNAVAILABLE',
      message: `${fixture.character.label}'s Sheet changed after this action; adjust manually.`
    })
  }, 60000)
})

describe('a Character dying and dead in the room (D96)', () => {
  it('dies at three failures, shows Dead to everyone, loses its turns, and Undo restores the saves', async () => {
    const fixture = await setup()
    let result = await start(fixture)
    // The Character's own turn-start death save rolls a 1, which is two failures (turnDeathSave.test.ts).
    await queueRoomRolls(fixture.campaign.id, { rolls: [], repeat: 0 })
    const hitPoints = (await storedCharacter(fixture)).state.hitpoints
    await sheetCommand(fixture, (base) => ({
      ...base,
      type: 'ADJUST_HIT_POINTS',
      mode: 'DAMAGE',
      amount: hitPoints.current - 1
    }))
    const saves = async () => (await storedCharacter(fixture)).state.hitpoints.deathSaves

    // Dropped to 0 the Character is dying: no failures yet, and still in play.
    result = await enemyBitesHero(fixture, result)
    expect((await storedCharacter(fixture)).state.hitpoints.current).toBe(0)
    expect(await saves()).toEqual({ successes: 0, failures: 0, stable: false })
    expect(projectedHero(fixture, result).defeated).toBe(false)

    // Its turn start adds the rolled failures; the Creature's next hit at 0 is one more.
    result = await toEnemyTurn(fixture, result)
    const dying = await saves()
    expect(dying).toEqual({ successes: 0, failures: 2, stable: false })

    // The third failure kills it; everyone sees it defeated.
    result = await enemyBites(fixture, result)
    expect(await saves()).toEqual({ successes: 0, failures: 3, stable: false })
    expect(projectedHero(fixture, result).defeated).toBe(true)
    await checkpointLiveRoom(fixture.campaign.id)
    const seen = await fixture.player.caller.query(api.encounters.projectionReads.get, {
      encounterId: fixture.run.id
    })
    expect(seen.actors.find((actor) => actor.id === fixture.hero.id)).toMatchObject({
      defeated: true
    })

    // Undo restores the previous saves exactly and the Character is back in play.
    const undone = await execute(fixture, (base) => ({
      ...base,
      type: 'REVERT_LAST_ACTION',
      expectedVersion: result.projection.version
    }))
    expect(await saves()).toEqual(dying)
    expect(projectedHero(fixture, undone).defeated).toBe(false)

    // Dead again, its turn is skipped for a full round.
    result = await enemyBites(fixture, undone)
    expect(projectedHero(fixture, result).defeated).toBe(true)
    const turns: Array<string | null> = []
    for (let turn = 0; turn < 4; turn += 1) {
      result = await advance(fixture, result)
      turns.push(result.projection.currentActorId)
    }
    expect(turns).not.toContain(fixture.hero.id)
    expect(turns).toContain(fixture.enemy.id)
  }, 120000)
})
