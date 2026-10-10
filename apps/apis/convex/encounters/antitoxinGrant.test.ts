import { describe, expect, it } from 'vitest'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { antitoxinVial } from '@artificer-toolkit/source-data/srd/equipment/antitoxin-vial.js'
import {
  execute,
  setup,
  start,
  storedCharacter,
  toActorTurn,
  type CommandResult,
  type Fixture
} from '../../tests/fixtures/liveCharacterRun'
import { invalidateRoomInputs, useLocalRoomWorker } from '../../tests/fixtures/localRoomWorker'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'

useLocalRoomWorker()

/** The Run has no Scene, so the vial's touch range cannot be checked, which the GM acknowledges. */
const RANGE: EncounterRuleWarningCodeDto = 'TARGET_RANGE_UNCHECKED'

function allyOf(fixture: Fixture) {
  const { ally } = fixture
  if (!ally) throw new Error('The Run has no ally.')
  return ally
}

/** The GM's own Character (the ally) drinks-gives its Antitoxin to the enemy Creature. */
function useAntitoxin(
  fixture: Fixture,
  from: CommandResult,
  acknowledgedWarnings: EncounterRuleWarningCodeDto[] = []
) {
  const actionId = fixture.actionIds.item
  if (!actionId) throw new Error('The ally has no Antitoxin action.')
  return execute(fixture, (base) => ({
    ...base,
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: [RANGE, ...acknowledgedWarnings],
    expectedVersion: from.projection.version,
    actorId: allyOf(fixture).id,
    targetActorId: fixture.enemy.id,
    actionId,
    optionalCombatIntent: null,
    sceneContext: null
  }))
}

/** The hero's poison save action at the enemy: the enemy rolls a Constitution save against poison. */
function heroPoisons(fixture: Fixture, from: CommandResult) {
  return execute(fixture, (base) => ({
    ...base,
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    expectedVersion: from.projection.version,
    actorId: fixture.hero.id,
    targetActorId: fixture.enemy.id,
    actionId: fixture.actionIds.hero,
    optionalCombatIntent: null,
    sceneContext: null
  }))
}

function pendingSave(result: CommandResult) {
  const pending = result.occurrence?.pending
  if (result.occurrence?.status !== 'PENDING' || pending?.kind !== 'D20_EVIDENCE')
    throw new Error('Expected the enemy’s saving throw.')
  return pending
}

function antitoxinFixture(enemyCreatureTypeCode?: string) {
  return setup({
    withAlly: true,
    allyItem: antitoxinVial,
    heroSave: { ability: 'CONSTITUTION', poison: true },
    enemyCreatureTypeCode
  })
}

/**
 * The ally's turn, from a started Run. Initiative rolls itself; afterwards the GM rolls the
 * Creature's saves by hand, so a save shows as a pending d20 request.
 */
async function atAllyTurn(fixture: Fixture) {
  const started = await start(fixture)
  await setAutoRollDice(fixture.t, fixture.owner.userId, false)
  await invalidateRoomInputs(fixture.campaign.id, ['PREFERENCES'])
  return toActorTurn(fixture, started, allyOf(fixture).id)
}

describe('an Antitoxin used in an Assisted Run (SPELLS-5.1)', () => {
  it('gives the Creature advantage on its saves against poison, with Antitoxin as the reason', async () => {
    const fixture = await antitoxinFixture()
    const used = await useAntitoxin(fixture, await atAllyTurn(fixture))
    expect(used.occurrence?.status).toBe('COMPLETE')

    const saving = await heroPoisons(fixture, await toActorTurn(fixture, used, fixture.hero.id))
    expect(pendingSave(saving)).toMatchObject({
      rollerActorId: fixture.enemy.id,
      request: { rollMode: 'ADVANTAGE', derivedRollModeReasons: [antitoxinVial.label] }
    })
  }, 180000)

  it('warns, overridably, for an undead Creature, and applies nothing until it is overridden', async () => {
    const fixture = await antitoxinFixture('UNDEAD')
    const atAlly = await atAllyTurn(fixture)
    const refused = await useAntitoxin(fixture, atAlly).then(
      () => null,
      (caught: unknown) => caught
    )
    expect(JSON.stringify(refused)).toContain('TARGET_CREATURE_TYPE_EXCLUDED')

    const used = await useAntitoxin(fixture, atAlly, ['TARGET_CREATURE_TYPE_EXCLUDED'])
    expect(used.occurrence?.status).toBe('COMPLETE')
    const saving = await heroPoisons(fixture, await toActorTurn(fixture, used, fixture.hero.id))
    expect(pendingSave(saving)).toMatchObject({ request: { rollMode: 'ADVANTAGE' } })
  }, 180000)
})

describe('a GM undo of an Antitoxin use (SPELLS-5.2)', () => {
  it('removes the grant and gives the Action back', async () => {
    const fixture = await antitoxinFixture()
    const atAlly = await atAllyTurn(fixture)
    const used = await useAntitoxin(fixture, atAlly)
    const reverted = await execute(fixture, (base) => ({
      ...base,
      type: 'REVERT_LAST_ACTION',
      expectedVersion: used.projection.version
    }))

    // The Action is back: the same use needs no allowance override, and the grant returns.
    const again = await useAntitoxin(fixture, reverted)
    expect(again.occurrence?.status).toBe('COMPLETE')
    const reUndone = await execute(fixture, (base) => ({
      ...base,
      type: 'REVERT_LAST_ACTION',
      expectedVersion: again.projection.version
    }))

    // With the grant gone, the enemy's save against poison has no advantage and no reason.
    const saving = await heroPoisons(fixture, await toActorTurn(fixture, reUndone, fixture.hero.id))
    const { request } = pendingSave(saving)
    expect(request.rollMode).toBe('NORMAL')
    expect(request.derivedRollModeReasons).toEqual([])
  }, 240000)
})

describe('a single-use item is used up in an Assisted Run (SPELLS-11)', () => {
  const carriedAntitoxinCount = async (fixture: Fixture) => {
    const { sourceId } = allyOf(fixture)
    if (!sourceId) throw new Error('The ally has no Character.')
    return (await storedCharacter(fixture, sourceId)).state.equipment.inventory
      .filter((item) => item.equipmentId === antitoxinVial.id)
      .reduce((total, item) => total + item.quantity, 0)
  }

  it('takes one Antitoxin from the holder, and a GM undo gives it back (11.1, 11.3)', async () => {
    const fixture = await antitoxinFixture()
    const carried = await carriedAntitoxinCount(fixture)
    expect(carried).toBeGreaterThan(1)
    const atAlly = await atAllyTurn(fixture)
    const used = await useAntitoxin(fixture, atAlly)
    expect(await carriedAntitoxinCount(fixture)).toBe(carried - 1)

    await execute(fixture, (base) => ({
      ...base,
      type: 'REVERT_LAST_ACTION',
      expectedVersion: used.projection.version
    }))
    expect(await carriedAntitoxinCount(fixture)).toBe(carried)
  }, 240000)

  it('removes the last one and refuses a request for it afterwards (11.2)', async () => {
    const fixture = await antitoxinFixture()
    const carried = await carriedAntitoxinCount(fixture)
    let latest = await atAllyTurn(fixture)
    for (let used = 0; used < carried; used += 1) {
      latest = await useAntitoxin(fixture, latest)
      // The next round returns the turn to the ally with a fresh Action.
      latest = await toActorTurn(fixture, latest, allyOf(fixture).id)
    }
    expect(await carriedAntitoxinCount(fixture)).toBe(0)

    const refused = await useAntitoxin(fixture, latest).then(
      () => null,
      (caught: unknown) => caught
    )
    expect(JSON.stringify(refused)).toContain('VERSION_STALE')
    expect(JSON.stringify(refused)).toContain('That action is no longer available')
  }, 360000)
})
