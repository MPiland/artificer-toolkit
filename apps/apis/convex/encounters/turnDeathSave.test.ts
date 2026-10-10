import { describe, expect, it } from 'vitest'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { NO_DEATH_SAVES } from '@artificer-toolkit/schema/subjects/characterState'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { readCharacterSheetState } from '@artificer-toolkit/schema/projections/characterStoredState'
import {
  advance,
  enemyBites,
  execute,
  sheetCommand,
  start,
  storedCharacter,
  toActorTurn,
  toEnemyTurn,
  setup,
  type CommandResult,
  type Fixture
} from '../../tests/fixtures/liveCharacterRun'
import { SRD_BASIC_ACTION_IDS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import { healersKit } from '@artificer-toolkit/source-data/srd/equipment/healers-kit.js'
import { readCharacterRow } from '../characters/stateDocuments'
import { setAutoRollDice, type FixtureRolls } from '../../tests/fixtures/rollPreferences'
import { api } from '../_generated/api'
import {
  checkpointLiveRoom,
  executeInRoom,
  invalidateRoomInputs,
  queueRoomRolls,
  readRoomRollCards,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

/** The raw draw that makes a d20 show `die`: the room's dice draw in `[0, 20)` (see `RoomTestDice`). */
const draw = (die: number) => die - 1

async function saves(fixture: Fixture) {
  return (await storedCharacter(fixture)).state.hitpoints.deathSaves
}

/** The table's death-save cards as the GM reads them: the card the turn commit posts per save. */
async function deathSaveCards(fixture: Fixture) {
  const cards = await readRoomRollCards(fixture.owner.caller, fixture.campaign.id)
  return cards.filter((card) => card.source.label === 'Death save')
}

function heroIn(fixture: Fixture, result: CommandResult) {
  const actor = encounterGmProjectionDtoSchema
    .parse(result.projection)
    .actors.find((candidate) => candidate.id === fixture.hero.id)
  if (!actor) throw new Error('Missing projected Character actor.')
  return actor
}

/** A started Run whose Character the Creature has just dropped to 0 hit points, at the Creature's turn. */
async function dyingCharacter(rolls: FixtureRolls, withAlly = false) {
  const fixture = await setup({ withAlly })
  // Table roll cards post to the chat, which needs a username.
  await fixture.player.caller.mutation(api.account.updateProfile, {
    username: 'DyingHero',
    bio: null
  })
  const started = await start(fixture)
  const { current } = (await storedCharacter(fixture)).state.hitpoints
  await sheetCommand(fixture, (base) => ({
    ...base,
    type: 'ADJUST_HIT_POINTS',
    mode: 'DAMAGE',
    amount: current - 1
  }))
  const bitten = await enemyBites(fixture, await toEnemyTurn(fixture, started))
  expect((await storedCharacter(fixture)).state.hitpoints.current).toBe(0)
  expect(await saves(fixture)).toEqual(NO_DEATH_SAVES)
  // The Character's player is its roller; their preference decides whether the save is prompted.
  await setAutoRollDice(fixture.t, fixture.player.userId, rolls === 'AUTO_ROLL')
  await invalidateRoomInputs(fixture.campaign.id, ['PREFERENCES'])
  return { fixture, bitten }
}

function pendingRoll(result: CommandResult) {
  const occurrence = result.occurrence
  if (occurrence?.status !== 'PENDING' || occurrence.pending?.kind !== 'D20_EVIDENCE')
    throw new Error('Expected a d20 roll prompt.')
  return { occurrence, pending: occurrence.pending }
}

describe('a dying Character’s turn-start death save (D96)', () => {
  it('asks the Character’s player for a d20 before its turn starts, and a 10 is a success', async () => {
    const { fixture, bitten } = await dyingCharacter('PROMPT')
    const paused = await advance(fixture, bitten)
    const { occurrence, pending } = pendingRoll(paused)
    // The turn has not advanced: the save is a stage before the Character's turn starts.
    expect(paused.projection.currentActorId).toBe(fixture.enemy.id)
    expect(pending).toMatchObject({
      rollerActorId: fixture.hero.id,
      trigger: { kind: 'DEATH_SAVE', successes: 0, failures: 0 },
      request: { min: 1, max: 20, rollMode: 'NORMAL' }
    })
    await checkpointLiveRoom(fixture.campaign.id)
    for (const member of [fixture.owner, fixture.player])
      await expect(
        member.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
          encounterId: fixture.run.id
        })
      ).resolves.toEqual(pending)
    expect(await saves(fixture)).toEqual(NO_DEATH_SAVES)

    const settled = await executeInRoom(fixture.player.caller, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: fixture.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: paused.projection.version,
        occurrenceId: occurrence.occurrenceId,
        expectedOccurrenceVersion: occurrence.occurrenceVersion,
        correlationId: null,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: pending.request.requestId,
          rawFaces: [10],
          rollMode: 'NORMAL'
        }
      }
    })
    expect(settled).toMatchObject({
      projection: { currentActorId: fixture.hero.id },
      occurrence: { status: 'COMPLETE', pending: null }
    })
    expect(await saves(fixture)).toEqual({ successes: 1, failures: 0, stable: false })
    // An entered die has no app attempt, so the turn commit posts its one card (an action's entered
    // d20 is likewise carded once, at commit).
    expect(await deathSaveCards(fixture)).toEqual([
      expect.objectContaining({
        characterLabel: fixture.hero.label,
        evidence: expect.objectContaining({ total: 10 })
      })
    ])
  }, 60000)

  it('posts the player’s app roll to the table and settles the save with those faces', async () => {
    const { fixture, bitten } = await dyingCharacter('PROMPT')
    await queueRoomRolls(fixture.campaign.id, { rolls: [draw(9)] })
    const paused = await advance(fixture, bitten)
    const { occurrence, pending } = pendingRoll(paused)
    const rolled = await executeInRoom(fixture.player.caller, {
      command: {
        type: 'ROLL_RULE_EVIDENCE',
        encounterId: fixture.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: paused.projection.version,
        occurrenceId: occurrence.occurrenceId,
        expectedOccurrenceVersion: occurrence.occurrenceVersion,
        requestId: pending.request.requestId,
        rollMode: pending.request.rollMode
      }
    })
    if (!rolled.evidenceRoll) throw new Error('Expected a recorded app roll.')
    expect(rolled.evidenceRoll).toMatchObject({ faces: [9], value: 9 })
    // The Character is player-controlled, so its card is the table's.
    const cards = await readRoomRollCards(fixture.player.caller, fixture.campaign.id)
    expect(cards.filter((card) => card.source.kind === 'MANUAL')).toEqual([
      expect.objectContaining({ characterLabel: fixture.hero.label })
    ])

    const settled = await executeInRoom(fixture.player.caller, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: fixture.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: paused.projection.version,
        occurrenceId: occurrence.occurrenceId,
        expectedOccurrenceVersion: occurrence.occurrenceVersion,
        correlationId: null,
        resolution: {
          kind: 'SYSTEM_ROLL',
          requestId: pending.request.requestId,
          rollId: rolled.evidenceRoll.rollId
        }
      }
    })
    expect(settled.occurrence).toMatchObject({ status: 'COMPLETE' })
    // A 9 is one failure.
    expect(await saves(fixture)).toEqual({ successes: 0, failures: 1, stable: false })
    // The app attempt's card is the save's one card: the commit posts no second.
    const settledCards = await readRoomRollCards(fixture.player.caller, fixture.campaign.id)
    expect(settledCards.filter((card) => card.source.kind === 'MANUAL')).toHaveLength(1)
    expect(await deathSaveCards(fixture)).toEqual([])
  }, 60000)

  it('auto-rolls for a player who rolls automatically; a 1 is two failures, and a third failure kills the Character', async () => {
    const { fixture, bitten } = await dyingCharacter('AUTO_ROLL')
    await queueRoomRolls(fixture.campaign.id, { rolls: [], repeat: draw(1) })
    const first = await advance(fixture, bitten)
    expect(first.occurrence?.pending ?? null).toBeNull()
    expect(first.projection.currentActorId).toBe(fixture.hero.id)
    expect(await saves(fixture)).toEqual({ successes: 0, failures: 2, stable: false })
    expect(heroIn(fixture, first).defeated).toBe(false)
    // The GM sees the auto-rolled save as one card, the Character's own roll on the table.
    expect(await deathSaveCards(fixture)).toEqual([
      expect.objectContaining({
        characterLabel: fixture.hero.label,
        evidence: expect.objectContaining({ total: 1 })
      })
    ])

    // Dying at its next turn start, the Character dies on that turn and keeps it.
    const second = await advance(fixture, await toEnemyTurn(fixture, first))
    expect((await saves(fixture)).failures).toBeGreaterThanOrEqual(3)
    expect(second.projection.currentActorId).toBe(fixture.hero.id)
    expect(heroIn(fixture, second).defeated).toBe(true)

    // A dead Character loses every later turn.
    let result = second
    for (let turn = 0; turn < 3; turn += 1) {
      result = await advance(fixture, result)
      expect(result.projection.currentActorId).toBe(fixture.enemy.id)
    }
  }, 120000)

  it('brings the Character back at 1 hit point and resets its saves on a 20', async () => {
    const { fixture, bitten } = await dyingCharacter('AUTO_ROLL')
    await queueRoomRolls(fixture.campaign.id, { rolls: [draw(20)] })
    const revived = await advance(fixture, bitten)
    expect(revived.projection.currentActorId).toBe(fixture.hero.id)
    expect(heroIn(fixture, revived)).toMatchObject({ currentHitPoints: 1, defeated: false })
    expect((await storedCharacter(fixture)).state.hitpoints).toMatchObject({
      current: 1,
      deathSaves: NO_DEATH_SAVES
    })
  }, 60000)

  it('stabilises the Character at three successes and asks for no further saves', async () => {
    const { fixture, bitten } = await dyingCharacter('AUTO_ROLL')
    await queueRoomRolls(fixture.campaign.id, { rolls: [], repeat: draw(12) })
    let result = await advance(fixture, bitten)
    expect(await saves(fixture)).toEqual({ successes: 1, failures: 0, stable: false })
    result = await advance(fixture, await toEnemyTurn(fixture, result))
    expect(await saves(fixture)).toEqual({ successes: 2, failures: 0, stable: false })
    result = await advance(fixture, await toEnemyTurn(fixture, result))
    const stable = await saves(fixture)
    // Stable clears the tally.
    expect(stable).toEqual({ successes: 0, failures: 0, stable: true })

    // Stable at 0 hit points, a prompting player is not asked again.
    await setAutoRollDice(fixture.t, fixture.player.userId, false)
    await invalidateRoomInputs(fixture.campaign.id, ['PREFERENCES'])
    result = await advance(fixture, await toEnemyTurn(fixture, result))
    expect(result.occurrence?.pending ?? null).toBeNull()
    expect(result.projection.currentActorId).toBe(fixture.hero.id)
    expect(await saves(fixture)).toEqual(stable)
  }, 120000)
})

/**
 * The GM's own Character, the dying hero's ally, uses its Healer's Kit on the hero. The Run has no
 * Scene, so the kit's touch range cannot be checked, which the GM acknowledges.
 */
function useKit(
  fixture: Fixture,
  from: CommandResult,
  acknowledgedWarnings: EncounterRuleWarningCodeDto[] = []
) {
  const expectedVersion = from.projection.version
  const { ally } = fixture
  if (!ally || !fixture.actionIds.item) throw new Error('The Run has no ally with a Healer’s Kit.')
  const actionId = fixture.actionIds.item
  return execute(fixture, (base) => ({
    ...base,
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: ['TARGET_RANGE_UNCHECKED', ...acknowledgedWarnings],
    expectedVersion,
    actorId: ally.id,
    target: { kind: 'ACTOR', actorId: fixture.hero.id },
    actionId,
    optionalCombatIntent: null,
    sceneContext: null
  }))
}

/** The dying hero at the ally's turn, with a successful death save already rolled for it. */
async function dyingHeroAtAllyTurn() {
  const { fixture, bitten } = await dyingCharacter('AUTO_ROLL', true)
  await queueRoomRolls(fixture.campaign.id, { rolls: [], repeat: draw(12) })
  const atAlly = await toActorTurn(fixture, bitten, fixture.ally!.id)
  return { fixture, atAlly, dying: await saves(fixture) }
}

describe('a stabilize action on a dying Character (D96)', () => {
  it('lets an ally’s Healer’s Kit make it stable, a new hit make it dying again, and GM undo reverse that', async () => {
    const { fixture, atAlly, dying } = await dyingHeroAtAllyTurn()
    expect(dying.stable).toBe(false)

    const stabilized = await useKit(fixture, atAlly)
    expect(stabilized.occurrence?.status).toBe('COMPLETE')
    expect(await saves(fixture)).toEqual({ successes: 0, failures: 0, stable: true })
    expect((await storedCharacter(fixture)).state.hitpoints.current).toBe(0)

    // Stable, the Character makes no death save at its next turn.
    const heroTurn = await toActorTurn(fixture, stabilized, fixture.hero.id)
    expect(heroTurn.occurrence?.pending ?? null).toBeNull()
    expect(await saves(fixture)).toEqual({ successes: 0, failures: 0, stable: true })

    // Damage makes it dying again: stable clears and a failure is added.
    const hit = await enemyBites(fixture, await toEnemyTurn(fixture, heroTurn))
    expect(await saves(fixture)).toEqual({ successes: 0, failures: 1, stable: false })

    // GM undo of that damage restores the stable state.
    await execute(fixture, (base) => ({
      ...base,
      type: 'REVERT_LAST_ACTION',
      expectedVersion: hit.projection.version
    }))
    expect(await saves(fixture)).toEqual({ successes: 0, failures: 0, stable: true })
  }, 120000)

  it('spends one kit charge from the ally, and GM undo restores the hero’s prior death saves', async () => {
    const { fixture, atAlly, dying } = await dyingHeroAtAllyTurn()
    const allySourceId = fixture.ally?.sourceId
    if (!allySourceId) throw new Error('Missing ally Character source.')
    const usage = async () => {
      await checkpointLiveRoom(fixture.campaign.id)
      return fixture.t.run(async (ctx) => {
        const row = await readCharacterRow(ctx, allySourceId)
        if (!row) throw new Error('Missing ally Character.')
        return readCharacterSheetState(row).resourceUsage
      })
    }
    expect(await usage()).toEqual([])

    const stabilized = await useKit(fixture, atAlly)
    expect(await saves(fixture)).toEqual({ successes: 0, failures: 0, stable: true })
    expect(await usage()).toMatchObject([
      { owner: { kind: 'ITEM_INSTANCE', chargeId: healersKit.charges?.id }, used: 1 }
    ])

    await execute(fixture, (base) => ({
      ...base,
      type: 'REVERT_LAST_ACTION',
      expectedVersion: stabilized.projection.version
    }))
    expect(await saves(fixture)).toEqual(dying)
    expect(await usage()).toMatchObject([{ used: 0 }])
  }, 120000)

  it('warns, overridably, for a Character that is not dying, and changes nothing once acknowledged', async () => {
    const { fixture, bitten } = await dyingCharacter('AUTO_ROLL', true)
    // Revive the hero so it is a valid but not dying target.
    await sheetCommand(fixture, (base) => ({
      ...base,
      type: 'ADJUST_HIT_POINTS',
      mode: 'HEAL',
      amount: 5
    }))
    const atAlly = await toActorTurn(fixture, bitten, fixture.ally!.id)
    const before = (await storedCharacter(fixture)).state.hitpoints
    const refused = await useKit(fixture, atAlly).then(
      () => null,
      (caught: unknown) => caught
    )
    expect(JSON.stringify(refused)).toContain('TARGET_NOT_DYING')

    const applied = await useKit(fixture, atAlly, ['TARGET_NOT_DYING'])
    expect(applied.occurrence?.status).toBe('COMPLETE')
    expect((await storedCharacter(fixture)).state.hitpoints).toEqual(before)
  }, 120000)
})

function allyOf(fixture: Fixture) {
  const { ally } = fixture
  if (!ally) throw new Error('The Run has no ally.')
  return ally
}

/** The natural d20 a roll card shows: its total less the modifier. */
function naturalOf(card: { evidence: { total: number; modifier: number } }) {
  return card.evidence.total - card.evidence.modifier
}

/**
 * The ally gives First Aid to the dying hero. The Run has no Scene, so the touch range cannot be
 * checked, which the GM acknowledges.
 */
function useFirstAid(
  fixture: Fixture,
  from: CommandResult,
  acknowledgedWarnings: EncounterRuleWarningCodeDto[] = []
) {
  const ally = allyOf(fixture)
  return execute(fixture, (base) => ({
    ...base,
    type: 'USE_BASIC_ACTION',
    expectedVersion: from.projection.version,
    actorId: ally.id,
    definitionId: SRD_BASIC_ACTION_IDS.FIRST_AID,
    targetActorId: fixture.hero.id,
    acknowledgedWarnings: ['TARGET_RANGE_UNCHECKED', ...acknowledgedWarnings]
  }))
}

/** The GM answers the ally's pending First Aid check with the given resolution. */
function answerFirstAid(
  fixture: Fixture,
  paused: CommandResult,
  resolution: (requestId: string) => ResolveRuleOccurrenceInputDto['resolution']
) {
  const { occurrence, pending } = pendingRoll(paused)
  return execute(fixture, (base) => ({
    ...base,
    type: 'RESOLVE_RULE_OCCURRENCE',
    expectedVersion: paused.projection.version,
    occurrenceId: occurrence.occurrenceId,
    expectedOccurrenceVersion: occurrence.occurrenceVersion,
    correlationId: null,
    resolution: resolution(pending.request.requestId)
  }))
}

/** The table's First Aid cards: the card the commit posts for an entered or auto-rolled die. */
async function firstAidCards(fixture: Fixture) {
  const cards = await readRoomRollCards(fixture.owner.caller, fixture.campaign.id)
  return cards.filter((card) => card.source.label === 'First Aid: Wisdom (Medicine)')
}

/** The ally, a GM-controlled Character, rolls by hand or automatically, as its preference says. */
async function allyRollsAutomatically(fixture: Fixture, automatic: boolean) {
  await setAutoRollDice(fixture.t, fixture.owner.userId, automatic)
  await invalidateRoomInputs(fixture.campaign.id, ['PREFERENCES'])
}

describe('First Aid, a System basic action with a check (D98)', () => {
  it('asks the helper’s roller for a Wisdom (Medicine) d20, and the roll makes the hero stable', async () => {
    const { fixture, atAlly, dying } = await dyingHeroAtAllyTurn()
    await allyRollsAutomatically(fixture, false)
    const ally = allyOf(fixture)
    const paused = await useFirstAid(fixture, atAlly)
    const { occurrence, pending } = pendingRoll(paused)
    // The Action is spent and the helper's turn goes on, while the check waits.
    expect(paused.projection.currentActorId).toBe(ally.id)
    expect(pending).toMatchObject({
      rollerActorId: ally.id,
      trigger: {
        kind: 'BASIC_ACTION_CHECK',
        actionLabel: 'First Aid',
        checkLabel: 'Wisdom (Medicine)',
        dc: 10
      }
    })
    expect(await saves(fixture)).toEqual(dying)

    await queueRoomRolls(fixture.campaign.id, { rolls: [draw(20)] })
    const rolled = await execute(fixture, (base) => ({
      ...base,
      type: 'ROLL_RULE_EVIDENCE',
      expectedVersion: paused.projection.version,
      occurrenceId: occurrence.occurrenceId,
      expectedOccurrenceVersion: occurrence.occurrenceVersion,
      requestId: pending.request.requestId,
      rollMode: pending.request.rollMode
    }))
    if (!rolled.evidenceRoll) throw new Error('Expected a recorded app roll.')
    const { rollId } = rolled.evidenceRoll
    const settled = await answerFirstAid(fixture, paused, (requestId) => ({
      kind: 'SYSTEM_ROLL',
      requestId,
      rollId
    }))
    expect(settled.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    expect(await saves(fixture)).toEqual({ successes: 0, failures: 0, stable: true })
    expect((await storedCharacter(fixture)).state.hitpoints.current).toBe(0)

    // The app attempt's card is the check's one card, credited to the helper and read by the GM.
    const cards = await readRoomRollCards(fixture.owner.caller, fixture.campaign.id)
    expect(cards.filter((card) => card.source.kind === 'MANUAL')).toEqual([
      expect.objectContaining({ characterLabel: ally.label })
    ])
    expect(await firstAidCards(fixture)).toEqual([])

    // GM undo gives back the Action and the hero's death saves, and leaves the roll on the record.
    const reverted = await execute(fixture, (base) => ({
      ...base,
      type: 'REVERT_LAST_ACTION',
      expectedVersion: settled.projection.version
    }))
    expect(await saves(fixture)).toEqual(dying)
    // The Action is back: First Aid is offered again without an Action warning.
    const again = await useFirstAid(fixture, reverted)
    expect(again.occurrence?.status).toBe('PENDING')
    expect(
      (await readRoomRollCards(fixture.owner.caller, fixture.campaign.id)).filter(
        (card) => card.source.kind === 'MANUAL'
      )
    ).toHaveLength(1)
  }, 180000)

  it('settles with the die the helper’s roller types, posting the helper’s labelled card', async () => {
    const { fixture, atAlly } = await dyingHeroAtAllyTurn()
    await allyRollsAutomatically(fixture, false)
    const paused = await useFirstAid(fixture, atAlly)
    const settled = await answerFirstAid(fixture, paused, (requestId) => ({
      kind: 'ENTER_DICE',
      requestId,
      rawFaces: [14],
      rollMode: 'NORMAL'
    }))
    expect(settled.occurrence).toMatchObject({ status: 'COMPLETE' })
    expect(await saves(fixture)).toEqual({ successes: 0, failures: 0, stable: true })
    const cards = await firstAidCards(fixture)
    expect(cards).toEqual([expect.objectContaining({ characterLabel: allyOf(fixture).label })])
    expect(naturalOf(cards[0]!)).toBe(14)
  }, 120000)

  it('auto-rolls for a helper who rolls automatically: a miss changes nothing but spends the Action', async () => {
    const { fixture, atAlly, dying } = await dyingHeroAtAllyTurn()
    await allyRollsAutomatically(fixture, true)
    await queueRoomRolls(fixture.campaign.id, { rolls: [draw(1)] })
    const missed = await useFirstAid(fixture, atAlly)
    expect(missed.occurrence?.status).toBe('COMPLETE')
    expect(await saves(fixture)).toEqual(dying)
    const cards = await firstAidCards(fixture)
    expect(cards).toHaveLength(1)
    expect(naturalOf(cards[0]!)).toBe(1)
    // The Action is spent: a second First Aid this turn must be acknowledged as breaking the rule.
    const second = await useFirstAid(fixture, missed).then(
      () => null,
      (caught: unknown) => caught
    )
    expect(JSON.stringify(second)).toContain('RULE_WARNINGS')
  }, 120000)

  it('auto-rolls a success, and GM undo restores the Action and the death saves but keeps the roll', async () => {
    const { fixture, atAlly, dying } = await dyingHeroAtAllyTurn()
    await allyRollsAutomatically(fixture, true)
    await queueRoomRolls(fixture.campaign.id, { rolls: [draw(20)] })
    const stabilized = await useFirstAid(fixture, atAlly)
    expect(stabilized.occurrence?.status).toBe('COMPLETE')
    expect(await saves(fixture)).toEqual({ successes: 0, failures: 0, stable: true })
    expect(await firstAidCards(fixture)).toHaveLength(1)

    await execute(fixture, (base) => ({
      ...base,
      type: 'REVERT_LAST_ACTION',
      expectedVersion: stabilized.projection.version
    }))
    expect(await saves(fixture)).toEqual(dying)
    expect(await firstAidCards(fixture)).toHaveLength(1)
  }, 120000)

  it('warns, overridably, for a hero that is not dying, and then rolls nothing', async () => {
    const { fixture, bitten } = await dyingCharacter('AUTO_ROLL', true)
    await sheetCommand(fixture, (base) => ({
      ...base,
      type: 'ADJUST_HIT_POINTS',
      mode: 'HEAL',
      amount: 5
    }))
    const atAlly = await toActorTurn(fixture, bitten, allyOf(fixture).id)
    const before = (await storedCharacter(fixture)).state.hitpoints
    const refused = await useFirstAid(fixture, atAlly).then(
      () => null,
      (caught: unknown) => caught
    )
    expect(JSON.stringify(refused)).toContain('TARGET_NOT_DYING')

    const applied = await useFirstAid(fixture, atAlly, ['TARGET_NOT_DYING'])
    expect(applied.occurrence).toBeNull()
    expect((await storedCharacter(fixture)).state.hitpoints).toEqual(before)
    expect(await firstAidCards(fixture)).toEqual([])
  }, 120000)
})
