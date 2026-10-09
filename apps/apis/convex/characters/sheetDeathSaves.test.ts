import { afterEach, describe, expect, it, vi } from 'vitest'
import { NO_DEATH_SAVES } from '@artificer-toolkit/schema/subjects/characterState'
import { api } from '../_generated/api'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import {
  execute,
  setup,
  sheetCommand,
  start,
  storedCharacter
} from '../../tests/fixtures/liveCharacterRun'
import {
  checkpointLiveRoom,
  queueRoomRolls,
  readRoomRollCards,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

afterEach(() => vi.restoreAllMocks())

/** Makes the next Convex d20 show `die` (`nextRollInt(20)` reads the sample modulo 20). */
function rollsDie(die: number) {
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(((array: Uint32Array) => {
    array[0] = die - 1
    return array
  }) as typeof crypto.getRandomValues)
}

/** The GM's client opens the Table conversation; only its members read the cards posted to it. */
async function openTable(fixture: Awaited<ReturnType<typeof setup>>) {
  await fixture.owner.caller.mutation(api.campaigns.conversations.open, {
    campaignId: fixture.campaign.id,
    kind: 'TABLE'
  })
}

async function dyingFixture() {
  const fixture = await setup()
  // Table roll cards post to the chat, which needs a username.
  await fixture.player.caller.mutation(api.account.updateProfile, {
    username: 'DyingHero',
    bio: null
  })
  await openTable(fixture)
  await sheetCommand(fixture, (base) => ({ ...base, type: 'SET_HIT_POINTS', current: 0 }))
  return fixture
}

async function saves(fixture: Awaited<ReturnType<typeof dyingFixture>>) {
  return (await storedCharacter(fixture)).state.hitpoints.deathSaves
}

describe('Sheet death saves outside an Encounter (D96)', () => {
  it('sets marks, rolls to stable, and cards each roll for the GM', async () => {
    const fixture = await dyingFixture()
    expect(await saves(fixture)).toEqual(NO_DEATH_SAVES)

    await sheetCommand(fixture, (base) => ({
      ...base,
      type: 'SET_DEATH_SAVES',
      successes: 1,
      failures: 1
    }))
    expect(await saves(fixture)).toEqual({ successes: 1, failures: 1, stable: false })

    rollsDie(12)
    await sheetCommand(fixture, (base) => ({ ...base, type: 'ROLL_DEATH_SAVE' }))
    expect(await saves(fixture)).toEqual({ successes: 2, failures: 1, stable: false })
    rollsDie(12)
    await sheetCommand(fixture, (base) => ({ ...base, type: 'ROLL_DEATH_SAVE' }))
    expect(await saves(fixture)).toEqual({ successes: 0, failures: 0, stable: true })

    const cards = (await readRoomRollCards(fixture.owner.caller, fixture.campaign.id)).filter(
      (card) => card.source.label === 'Death save'
    )
    expect(cards).toHaveLength(2)
    expect(cards.every((card) => card.source.kind === 'DEATH_SAVE')).toBe(true)

    await expect(
      sheetCommand(fixture, (base) => ({ ...base, type: 'ROLL_DEATH_SAVE' }))
    ).rejects.toThrow()
  })

  it('kills on a third failure and refuses further rolls', async () => {
    const fixture = await dyingFixture()
    await sheetCommand(fixture, (base) => ({
      ...base,
      type: 'SET_DEATH_SAVES',
      successes: 0,
      failures: 2
    }))
    rollsDie(4)
    await sheetCommand(fixture, (base) => ({ ...base, type: 'ROLL_DEATH_SAVE' }))
    expect(await saves(fixture)).toEqual({ successes: 0, failures: 3, stable: false })
    await expect(
      sheetCommand(fixture, (base) => ({ ...base, type: 'ROLL_DEATH_SAVE' }))
    ).rejects.toThrow()
  })

  it('regains 1 hit point on a natural 20', async () => {
    const fixture = await dyingFixture()
    rollsDie(20)
    await sheetCommand(fixture, (base) => ({ ...base, type: 'ROLL_DEATH_SAVE' }))
    const stored = await storedCharacter(fixture)
    expect(stored.state.hitpoints).toMatchObject({ current: 1, deathSaves: NO_DEATH_SAVES })
  })

  it('rolls in the room for a Character held by a started Run and cards it for the GM', async () => {
    const fixture = await setup()
    await fixture.player.caller.mutation(api.account.updateProfile, {
      username: 'HeldHero',
      bio: null
    })
    await openTable(fixture)
    await start(fixture)
    const { current } = (await storedCharacter(fixture)).state.hitpoints
    await sheetCommand(fixture, (base) => ({
      ...base,
      type: 'ADJUST_HIT_POINTS',
      mode: 'DAMAGE',
      amount: current
    }))
    expect((await storedCharacter(fixture)).state.hitpoints.current).toBe(0)

    await queueRoomRolls(fixture.campaign.id, { rolls: [11] })
    await sheetCommand(fixture, (base) => ({ ...base, type: 'ROLL_DEATH_SAVE' }))
    expect(await saves(fixture)).toEqual({ successes: 1, failures: 0, stable: false })

    const cards = (await readRoomRollCards(fixture.owner.caller, fixture.campaign.id)).filter(
      (card) => card.source.label === 'Death save'
    )
    expect(cards).toEqual([
      expect.objectContaining({
        characterLabel: fixture.hero.label,
        source: expect.objectContaining({ kind: 'DEATH_SAVE' })
      })
    ])
  })

  it('keeps a dead Character dead in the finished Run after it is frozen', async () => {
    const fixture = await setup()
    await start(fixture)
    const { current } = (await storedCharacter(fixture)).state.hitpoints
    await sheetCommand(fixture, (base) => ({
      ...base,
      type: 'ADJUST_HIT_POINTS',
      mode: 'DAMAGE',
      amount: current
    }))
    await sheetCommand(fixture, (base) => ({
      ...base,
      type: 'SET_DEATH_SAVES',
      successes: 0,
      failures: 3
    }))
    await checkpointLiveRoom(fixture.campaign.id)
    const heroDefeated = async () => {
      const projection = await fixture.owner.caller.query(api.encounters.projectionReads.get, {
        encounterId: fixture.run.id
      })
      return {
        version: projection.version,
        defeated: projection.actors.find((actor) => actor.id === fixture.hero.id)?.defeated
      }
    }
    const live = await heroDefeated()
    expect(live.defeated).toBe(true)

    await execute(fixture, (base) => ({
      ...base,
      type: 'COMPLETE',
      expectedVersion: live.version
    }))
    await checkpointLiveRoom(fixture.campaign.id)
    const stored = await fixture.t.run(async (ctx) => {
      const rows = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', fixture.run.id))
        .collect()
      return rows.flatMap((row) => {
        const actor = readStoredRunActor(row)
        return actor.kind === 'CHARACTER' && actor.frozenState ? [actor.frozenState] : []
      })
    })
    expect(stored).toEqual([
      expect.objectContaining({ deathSaves: { successes: 0, failures: 3, stable: false } })
    ])
    expect((await heroDefeated()).defeated).toBe(true)
  }, 60_000)

  it('refuses a member who is not assigned to the Character', async () => {
    const fixture = await dyingFixture()
    const stranger = await fixture.addActor('Stranger')
    const sheet = await fixture.player.caller.query(api.characters.sheet.get, {
      id: fixture.character.id
    })
    const base = { commandId: crypto.randomUUID(), expectedVersion: sheet!.meta.streamVersion }
    await expect(
      stranger.caller.mutation(api.characters.sheetCommands.execute, {
        id: fixture.character.id,
        command: { ...base, type: 'ROLL_DEATH_SAVE' }
      })
    ).rejects.toThrow()
    await expect(
      stranger.caller.mutation(api.characters.sheetCommands.execute, {
        id: fixture.character.id,
        command: { ...base, commandId: crypto.randomUUID(), type: 'SET_DEATH_SAVES', successes: 1, failures: 0 }
      })
    ).rejects.toThrow()
    expect(await saves(fixture)).toEqual(NO_DEATH_SAVES)
  })
})
