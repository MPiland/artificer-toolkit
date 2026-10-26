import { describe, expect, it } from 'vitest'
import {
  encounterGmProjectionDtoSchema,
  type EncounterExecuteInput
} from '@artificer-toolkit/schema/api/encounters'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import {
  advance,
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
import {
  checkpointLiveRoom,
  executeInRoom,
  executeSheetInRoom,
  expectRedactedRoomRefusal,
  queueRoomRolls,
  readRoomRollCards,
  seedRoomContentSnapshots,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { expectReusedCommandRefusal, rejection } from '../../tests/fixtures/roomRefusals'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { api, internal } from '../_generated/api'

useLocalRoomWorker()

const injuries = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
  (definition) => definition.document.kind === 'INJURIES'
)
if (!injuries || injuries.document.parameters.kind !== 'INJURIES')
  throw new Error('Missing published Injuries.')
const injuryRows = injuries.document.parameters.table.rows

/** The raw draw that makes a d20 show `die`: the room's dice draw in `[0, 20)`. */
const draw = (die: number) => die - 1

function offersIn(fixture: Fixture, result: CommandResult) {
  const actor = encounterGmProjectionDtoSchema
    .parse(result.projection)
    .actors.find((candidate) => candidate.id === fixture.hero.id)
  if (!actor || !('consequenceRollOffers' in actor)) throw new Error('Missing projected hero.')
  return actor.consequenceRollOffers
}

/**
 * A started Run with Injuries on whose Creature has just dropped the Character from 1 hit point to
 * 0, at the Creature's turn. Initiative is pinned to Creature then Character.
 */
async function droppedCharacter() {
  const fixture = await setup()
  await fixture.owner.caller.mutation(api.account.updateProfile, { username: 'TheGm', bio: null })
  await fixture.player.caller.mutation(api.account.updateProfile, {
    username: 'DyingHero',
    bio: null
  })
  await fixture.owner.caller.mutation(api.campaigns.conversations.open, {
    campaignId: fixture.campaign.id,
    kind: 'TABLE'
  })
  await fixture.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: [injuries!]
  })
  await seedRoomContentSnapshots(fixture.campaign.id)
  const replaced = await execute(fixture, (base) => ({
    ...base,
    type: 'REPLACE_OPTIONAL_COMBAT_RULES',
    expectedVersion: fixture.run.version,
    definitionIds: [injuries!.id]
  }))
  await queueRoomRolls(fixture.campaign.id, {
    rolls: [...fixture.run.actors]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((actor) => draw(actor.id === fixture.hero.id ? 1 : 19))
  })
  const started = await start({
    ...fixture,
    run: { ...fixture.run, version: replaced.projection.version }
  })
  await queueRoomRolls(fixture.campaign.id, { rolls: [] })
  const { current } = (await storedCharacter(fixture)).state.hitpoints
  await sheetCommand(fixture, (base) => ({
    ...base,
    type: 'ADJUST_HIT_POINTS',
    mode: 'DAMAGE',
    amount: current - 1
  }))
  const bitten = await enemyBites(fixture, await toEnemyTurn(fixture, started))
  return { fixture, bitten }
}

type Resolve = Extract<EncounterExecuteInput['command'], { type: 'RESOLVE_CONSEQUENCE_ROLL_OFFER' }>

function resolve(
  fixture: Fixture,
  from: CommandResult,
  decision: Resolve['decision'],
  options: { commandId?: string; caller?: Fixture['owner']['caller'] } = {}
) {
  const [offer] = offersIn(fixture, from)
  if (!offer) throw new Error('Expected an open offer.')
  return executeInRoom(options.caller ?? fixture.owner.caller, {
    command: {
      type: 'RESOLVE_CONSEQUENCE_ROLL_OFFER',
      encounterId: fixture.run.id,
      commandId: options.commandId ?? crypto.randomUUID(),
      expectedVersion: from.projection.version,
      actorId: fixture.hero.id,
      sourceCommandId: offer.sourceCommandId,
      definitionId: offer.definitionId,
      decision,
      visibility: 'PUBLIC'
    }
  })
}

describe('Consequence roll offers through the room (ATTACK-15.1)', () => {
  it('offers the GM a roll when a Character drops to 0; accepting rolls the table on the server', async () => {
    const { fixture, bitten } = await droppedCharacter()
    expect(offersIn(fixture, bitten)).toEqual([
      expect.objectContaining({
        definitionId: injuries!.id,
        label: injuries!.label,
        triggers: [{ event: 'HIT_POINTS_ZERO' }]
      })
    ])
    const commandId = crypto.randomUUID()
    expect(
      await rejection(resolve(fixture, bitten, 'ACCEPT', { caller: fixture.player.caller }))
    ).toMatchObject({ reason: 'GM_ONLY' })

    await queueRoomRolls(fixture.campaign.id, { rolls: [draw(1)] })
    const accepted = await resolve(fixture, bitten, 'ACCEPT', { commandId })
    expect(offersIn(fixture, accepted)).toEqual([])
    expect(accepted.roll).toMatchObject({
      characterId: null,
      source: { kind: 'TABLE', label: injuries!.label },
      evidence: expect.objectContaining({ total: 1 })
    })
    const cards = await readRoomRollCards(fixture.owner.caller, fixture.campaign.id)
    expect(cards.filter((card) => card.source.kind === 'TABLE')).toHaveLength(1)

    // The same command ID replays without a second roll; another resolve of that offer is refused.
    await expect(resolve(fixture, bitten, 'ACCEPT', { commandId })).resolves.toEqual(accepted)
    expect(
      await rejection(
        executeInRoom(fixture.owner.caller, {
          command: {
            type: 'RESOLVE_CONSEQUENCE_ROLL_OFFER',
            encounterId: fixture.run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: accepted.projection.version,
            actorId: fixture.hero.id,
            sourceCommandId: offersIn(fixture, bitten)[0]!.sourceCommandId,
            definitionId: injuries!.id,
            decision: 'DECLINE',
            visibility: 'PUBLIC'
          }
        })
      )
    ).toMatchObject({ reason: 'TARGET_UNAVAILABLE' })
    await expectReusedCommandRefusal(resolve(fixture, bitten, 'DECLINE', { commandId }))
  }, 120000)

  it('removes a declined offer without a roll', async () => {
    const { fixture, bitten } = await droppedCharacter()
    const declined = await resolve(fixture, bitten, 'DECLINE')
    expect(offersIn(fixture, declined)).toEqual([])
    expect(declined.roll).toBeNull()
  }, 120000)

  it('withdraws the offer when the GM undoes the damaging action', async () => {
    const { fixture, bitten } = await droppedCharacter()
    const reverted = await execute(fixture, (base) => ({
      ...base,
      type: 'REVERT_LAST_ACTION',
      expectedVersion: bitten.projection.version
    }))
    expect(offersIn(fixture, reverted)).toEqual([])
  }, 120000)

  it('offers a roll for a death save failed by 5 or more at the Character’s turn start', async () => {
    const { fixture, bitten } = await droppedCharacter()
    await setAutoRollDice(fixture.t, fixture.player.userId, true)
    await queueRoomRolls(fixture.campaign.id, { rolls: [draw(5)] })
    const saved = await advance(fixture, bitten)
    expect(saved.projection.currentActorId).toBe(fixture.hero.id)
    expect(offersIn(fixture, saved).map(({ triggers }) => triggers)).toEqual([
      [{ event: 'HIT_POINTS_ZERO' }],
      [{ event: 'DEATH_SAVE_FAILED', byAtLeast: 5 }]
    ])
  }, 120000)
})

describe('Recorded consequences on the Character (ATTACK-15.2)', () => {
  /** The Character's Campaign Sheet as `viewer` reads it once the room has checkpointed its play. */
  async function sheetAs(fixture: Fixture, viewer: 'owner' | 'player') {
    await checkpointLiveRoom(fixture.campaign.id)
    const sheet = await fixture[viewer].caller.query(api.campaigns.characterSheet.get, {
      campaignId: fixture.campaign.id,
      characterId: fixture.character.id
    })
    if (!sheet) throw new Error('Missing journey Sheet.')
    return sheet
  }

  function removeAs(
    fixture: Fixture,
    viewer: 'owner' | 'player',
    consequenceId: string,
    expectedVersion: number
  ) {
    return executeSheetInRoom(fixture[viewer].caller, {
      scope: 'CHARACTER_SHEET',
      characterId: fixture.character.id,
      encounterId: fixture.run.id,
      command: {
        type: 'REMOVE_CONSEQUENCE',
        consequenceId,
        commandId: crypto.randomUUID(),
        expectedVersion
      }
    })
  }

  it('records the accepted row on the Character, shows it with its healing, and only the GM removes it', async () => {
    const { fixture, bitten } = await droppedCharacter()
    const commandId = crypto.randomUUID()
    await queueRoomRolls(fixture.campaign.id, { rolls: [draw(1)] })
    await resolve(fixture, bitten, 'ACCEPT', { commandId })

    const row = injuryRows.find(({ minimum, maximum }) => minimum <= 1 && 1 <= maximum)!
    const recorded = {
      id: commandId,
      definitionId: injuries!.id,
      rowId: row.id,
      tableLabel: injuries!.label,
      label: row.label,
      effect: row.effect,
      healing: row.healing,
      recordedAt: expect.any(String)
    }
    expect((await storedCharacter(fixture)).state.consequences).toEqual([recorded])

    const playerSheet = await sheetAs(fixture, 'player')
    expect(playerSheet.overview.consequences).toEqual([recorded])
    expect(playerSheet.meta.capabilities.removeConsequences).toBe(false)
    await expectRedactedRoomRefusal(
      removeAs(fixture, 'player', commandId, playerSheet.meta.streamVersion),
      'Only the GM removes a recorded consequence.',
      'DOMAIN_REJECTED'
    )
    expect((await storedCharacter(fixture)).state.consequences).toEqual([recorded])

    const gmSheet = await sheetAs(fixture, 'owner')
    expect(gmSheet.overview.consequences).toEqual([recorded])
    expect(gmSheet.meta.capabilities.removeConsequences).toBe(true)
    await removeAs(fixture, 'owner', commandId, gmSheet.meta.streamVersion)
    expect((await storedCharacter(fixture)).state.consequences).toBeUndefined()
    expect((await sheetAs(fixture, 'player')).overview.consequences).toEqual([])
  }, 120000)

  it('records nothing when the GM declines', async () => {
    const { fixture, bitten } = await droppedCharacter()
    await resolve(fixture, bitten, 'DECLINE')
    expect((await storedCharacter(fixture)).state.consequences).toBeUndefined()
  }, 120000)
})
