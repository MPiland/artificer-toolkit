import { describe, expect, it } from 'vitest'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { parseRollExpression } from '@artificer-toolkit/shared/rolls'
import {
  executeInRoom,
  executeSheetInRoom,
  queueRoomRolls,
  readRoomRollCards,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import {
  barbarianState,
  BARBARIANS,
  rages,
  setupBarbarianRun,
  type BarbarianRun,
  type RunResult
} from '../../tests/fixtures/barbarianRun'
import { createPartyPlayer } from '../../tests/fixtures/partyPlayer'
import { expectUnavailableRefusal, rejection } from '../../tests/fixtures/roomRefusals'
import { actOnRun, executeOnRun } from '../../tests/fixtures/srdWolfRun'
import { readCharacterRow } from '../characters/stateDocuments'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'

useLocalRoomWorker()

describe.each(BARBARIANS)('$name rages in an Encounter (ATTACK-9.T1)', ({ source }) => {
  it('compiles Rage as a bonus action that spends one Rage charge', async () => {
    const { actions } = await setupBarbarianRun(source)
    expect(actions.rage.activation).toMatchObject({ kind: 'BONUS_ACTION' })
    expect(actions.rage.entry).toMatchObject({
      compilation: {
        kind: 'COMPILED',
        resourceBinding: { chargeId: source.resources?.charges?.id, cost: 1 }
      }
    })
  }, 60000)

  it('spends a charge, adds the Rage damage to the Greataxe hit, and halves the damage the Barbarian takes', async () => {
    const fixture = await setupBarbarianRun(source)
    const before = await barbarianState(fixture)
    expect(before).toMatchObject({ rageChargesUsed: 0, grantIds: [] })

    const raged = await rages(fixture)
    expect(raged.occurrence?.status).toBe('COMPLETE')
    const afterRage = await barbarianState(fixture)
    expect(afterRage.rageChargesUsed).toBe(1)
    expect(afterRage.grantIds).toHaveLength(1)

    // d20 15 hits the Wolf; the d12 rolls 5.
    await queueRoomRolls(fixture.campaign.id, { rolls: [14, 4] })
    const hit = await actOnRun(fixture,raged, {
      actorId: fixture.actor.id,
      actionId: fixture.actions.axe.actionId,
      targetActorId: fixture.wolf.id
    })
    expect(hit.occurrence?.status).toBe('COMPLETE')
    const cards = await readRoomRollCards(fixture.owner.caller, fixture.campaign.id)
    const { modifier } = parseRollExpression(fixture.actions.axe.expression)
    expect(
      cards.filter((card) => card.source.kind === 'DAMAGE').map((card) => card.evidence.total)
    ).toEqual([5 + modifier + 2])

    // The Wolf's turn: d20 15 hits the Barbarian; 2d4 rolls 1 and 4, so 5 + 2 = 7 piercing, halved to 3.
    const wolfTurn = await executeOnRun(fixture, (base) => ({
      ...base,
      type: 'ADVANCE_TURN',
      expectedVersion: hit.projection.version
    }))
    expect(wolfTurn.projection.currentActorId).toBe(fixture.wolf.id)
    await queueRoomRolls(fixture.campaign.id, { rolls: [14, 0, 3] })
    const bitten = await actOnRun(fixture,wolfTurn, {
      actorId: fixture.wolf.id,
      actionId: fixture.biteActionId,
      targetActorId: fixture.actor.id
    })
    expect(bitten.occurrence?.status).toBe('COMPLETE')
    const afterBite = await barbarianState(fixture)
    expect(afterRage.hitPoints - afterBite.hitPoints).toBe(3)
    expect(afterBite.rageChargesUsed).toBe(1)
  }, 120000)

  describe('ending the Rage as its holder', () => {
    /** The Barbarian rages, then the turn passes to the Wolf and back, so its bonus action is fresh. */
    async function ragingOnItsNextTurn(fixture: BarbarianRun) {
      const raged = await rages(fixture)
      const [grantId] = (await barbarianState(fixture)).grantIds
      if (!grantId) throw new Error('Rage granted nothing.')
      const wolfTurn = await executeOnRun(fixture, (base) => ({
        ...base,
        type: 'ADVANCE_TURN',
        expectedVersion: raged.projection.version
      }))
      const barbarianTurn = await executeOnRun(fixture, (base) => ({
        ...base,
        type: 'ADVANCE_TURN',
        expectedVersion: wolfTurn.projection.version
      }))
      return { raged, wolfTurn, barbarianTurn, grantId }
    }

    /** The Barbarian's own player ends the grant. */
    function endsRage(
      fixture: BarbarianRun,
      from: { projection: Pick<RunResult['projection'], 'version'> },
      grantId: string,
      acknowledgedWarnings: EncounterRuleWarningCodeDto[] = []
    ) {
      return executeInRoom(fixture.player.caller, {
        command: {
          type: 'END_HELD_GRANT',
          encounterId: fixture.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: from.projection.version,
          actorId: fixture.actor.id,
          activeEffectId: grantId,
          acknowledgedWarnings
        }
      })
    }

    it('ends the Rage on the holder turn, spending the bonus action; the charge stays spent', async () => {
      const fixture = await setupBarbarianRun(source)
      const { barbarianTurn, grantId } = await ragingOnItsNextTurn(fixture)

      const ended = await endsRage(fixture, barbarianTurn, grantId)
      expect(await barbarianState(fixture)).toMatchObject({ rageChargesUsed: 1, grantIds: [] })

      // The end spent the bonus action, so a second Rage this turn has none left.
      const second = await rejection(
        actOnRun(fixture, ended, {
          actorId: fixture.actor.id,
          actionId: fixture.actions.rage.actionId,
          targetActorId: fixture.actor.id
        })
      )
      expect(second).toMatchObject({
        reason: 'RULE_WARNINGS',
        warnings: [{ code: 'ACTION_ECONOMY_UNAVAILABLE' }]
      })
    }, 120000)

    it('refuses to end a Rage that has already ended', async () => {
      const fixture = await setupBarbarianRun(source)
      const { barbarianTurn, grantId } = await ragingOnItsNextTurn(fixture)
      const ended = await endsRage(fixture, barbarianTurn, grantId)
      expect((await barbarianState(fixture)).grantIds).toEqual([])

      await expectUnavailableRefusal(
        endsRage(fixture, ended, grantId),
        'The creature holds no effect it can end.'
      )
      expect((await barbarianState(fixture)).grantIds).toEqual([])
    }, 120000)

    it('ends the Rage at the Sheet in a Manual Run, which resolves no Encounter commands', async () => {
      const fixture = await setupBarbarianRun(source, 'MANUAL')
      // A Manual Run resolves no actions, so the Barbarian already holds the Rage the table granted.
      const effect = source.features?.[0]?.effects?.[0]
      const grant = await fixture.t.run((ctx) =>
        createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).create({
          id: crypto.randomUUID(),
          owner: { kind: 'CHARACTER', characterId: fixture.character.id },
          definition: plannedModifierGrant({
            encounterId: fixture.run.id,
            sourceActorId: fixture.actor.id,
            holderActorId: fixture.actor.id,
            lifecycle: {},
            effect,
            rounds: 10,
            lifetimeScope: 'OWNER'
          }).definition,
          lifecycle: { schemaVersion: 1, remainingTicks: 10 }
        })
      )
      expect(
        await rejection(
          endsRage(fixture, { projection: { version: fixture.run.version } }, grant.id)
        )
      ).toMatchObject({ reason: 'ASSISTED_ONLY' })
      expect((await barbarianState(fixture)).grantIds).toEqual([grant.id])

      // With no economy to spend, the holder's own player ends it from the Sheet, for free.
      await executeSheetInRoom(fixture.player.caller, {
        scope: 'CHARACTER_SHEET',
        characterId: fixture.character.id,
        encounterId: fixture.run.id,
        command: {
          type: 'END_ACTIVE_EFFECT',
          commandId: crypto.randomUUID(),
          expectedVersion: await fixture.t.run(async (ctx) => {
            const row = await readCharacterRow(ctx, fixture.character.id)
            if (!row) throw new Error('The Barbarian is missing.')
            return row.play.streamVersion
          }),
          effectId: grant.id
        }
      })
      expect((await barbarianState(fixture)).grantIds).toEqual([])
    }, 120000)

    it('refuses to end the Rage off the holder turn', async () => {
      const fixture = await setupBarbarianRun(source)
      const raged = await rages(fixture)
      const [grantId] = (await barbarianState(fixture)).grantIds
      if (!grantId) throw new Error('Rage granted nothing.')
      const wolfTurn = await executeOnRun(fixture, (base) => ({
        ...base,
        type: 'ADVANCE_TURN',
        expectedVersion: raged.projection.version
      }))
      expect(wolfTurn.projection.currentActorId).toBe(fixture.wolf.id)
      expect(await rejection(endsRage(fixture, wolfTurn, grantId))).toMatchObject({
        reason: 'NOT_CURRENT_ACTOR'
      })
      expect((await barbarianState(fixture)).grantIds).toEqual([grantId])
    }, 120000)

    it('refuses to end the Rage for a player who does not control the Barbarian', async () => {
      const fixture = await setupBarbarianRun(source)
      // The room closes its sockets when membership changes, so the third member joins first.
      const party = await createPartyPlayer(fixture.t, fixture.campaign)
      await party.join()
      const { barbarianTurn, grantId } = await ragingOnItsNextTurn(fixture)
      expect(
        await rejection(
          executeInRoom(party.caller, {
            command: {
              type: 'END_HELD_GRANT',
              encounterId: fixture.run.id,
              commandId: crypto.randomUUID(),
              expectedVersion: barbarianTurn.projection.version,
              actorId: fixture.actor.id,
              activeEffectId: grantId,
              acknowledgedWarnings: []
            }
          })
        )
      ).toMatchObject({ reason: 'NOT_ACTOR_CONTROLLER' })
      expect((await barbarianState(fixture)).grantIds).toEqual([grantId])
    }, 120000)

    it('refuses to end the Rage once the bonus action is spent unless the warning is acknowledged', async () => {
      const fixture = await setupBarbarianRun(source)
      const raged = await rages(fixture)
      const [grantId] = (await barbarianState(fixture)).grantIds
      if (!grantId) throw new Error('Rage granted nothing.')
      expect(await rejection(endsRage(fixture, raged, grantId))).toMatchObject({
        reason: 'RULE_WARNINGS',
        warnings: [{ code: 'ACTION_ECONOMY_UNAVAILABLE' }]
      })
      expect((await barbarianState(fixture)).grantIds).toEqual([grantId])
    }, 120000)
  })

  describe('ending early when the Barbarian is idle (ATTACK-9.T6)', () => {
    const advance = (fixture: BarbarianRun, from: { projection: Pick<RunResult['projection'], 'version'> }) =>
      executeOnRun(fixture, (base) => ({
        ...base,
        type: 'ADVANCE_TURN',
        expectedVersion: from.projection.version
      }))

    const undo = (fixture: BarbarianRun, from: { projection: Pick<RunResult['projection'], 'version'> }) =>
      executeOnRun(fixture, (base) => ({
        ...base,
        type: 'REVERT_LAST_ACTION',
        expectedVersion: from.projection.version
      }))

    const grantCount = async (fixture: BarbarianRun) => (await barbarianState(fixture)).grantIds.length

    /** The Barbarian rages and passes the turn; the Wolf holds the turn and the Rage is not yet at risk. */
    async function ragedAndPassed(fixture: BarbarianRun) {
      const wolfTurn = await advance(fixture, await rages(fixture))
      expect(wolfTurn.projection.currentActorId).toBe(fixture.wolf.id)
      return wolfTurn
    }

    const bites = async (fixture: BarbarianRun, wolfTurn: RunResult) => {
      await queueRoomRolls(fixture.campaign.id, { rolls: [14, 0, 3] })
      return actOnRun(fixture, wolfTurn, {
        actorId: fixture.wolf.id,
        actionId: fixture.biteActionId,
        targetActorId: fixture.actor.id
      })
    }

    const swings = async (fixture: BarbarianRun, turn: RunResult) => {
      await queueRoomRolls(fixture.campaign.id, { rolls: [14, 4] })
      return actOnRun(fixture, turn, {
        actorId: fixture.actor.id,
        actionId: fixture.actions.axe.actionId,
        targetActorId: fixture.wolf.id
      })
    }

    it('keeps a Rage through the end of the turn it began on, then ends it after a turn with no attack and no damage', async () => {
      const fixture = await setupBarbarianRun(source)
      const secondTurn = await advance(fixture, await ragedAndPassed(fixture))
      expect(secondTurn.projection.currentActorId).toBe(fixture.actor.id)
      expect(await grantCount(fixture)).toBe(1)

      await advance(fixture, secondTurn)
      expect(await barbarianState(fixture)).toMatchObject({ rageChargesUsed: 1, grantIds: [] })
    }, 180000)

    it('keeps the Rage after a turn with an attack on a hostile creature, which counts for that turn only', async () => {
      const fixture = await setupBarbarianRun(source)
      const secondTurn = await advance(fixture, await ragedAndPassed(fixture))
      const hit = await swings(fixture, secondTurn)
      expect(hit.occurrence?.status).toBe('COMPLETE')

      const thirdTurn = await advance(fixture, await advance(fixture, hit))
      expect(await grantCount(fixture)).toBe(1)

      await advance(fixture, thirdTurn)
      expect(await grantCount(fixture)).toBe(0)
    }, 240000)

    it('keeps the Rage after damage taken on another creature turn', async () => {
      const fixture = await setupBarbarianRun(source)
      const bitten = await bites(fixture, await ragedAndPassed(fixture))
      expect(bitten.occurrence?.status).toBe('COMPLETE')

      const secondTurn = await advance(fixture, bitten)
      await advance(fixture, secondTurn)
      expect(await grantCount(fixture)).toBe(1)
    }, 240000)

    /** The Barbarian's player takes `amount` damage at the Sheet, a path that resolves no Encounter action. */
    const takesSheetDamage = async (fixture: BarbarianRun, amount: number) =>
      executeSheetInRoom(fixture.player.caller, {
        scope: 'CHARACTER_SHEET',
        characterId: fixture.character.id,
        encounterId: fixture.run.id,
        command: {
          type: 'ADJUST_HIT_POINTS',
          mode: 'DAMAGE',
          amount,
          commandId: crypto.randomUUID(),
          expectedVersion: await fixture.t.run(async (ctx) => {
            const row = await readCharacterRow(ctx, fixture.character.id)
            if (!row) throw new Error('The Barbarian is missing.')
            return row.play.streamVersion
          })
        }
      })

    it('keeps the Rage after damage the player records at the Sheet', async () => {
      const fixture = await setupBarbarianRun(source)
      const secondTurn = await advance(fixture, await ragedAndPassed(fixture))
      const before = await barbarianState(fixture)
      await takesSheetDamage(fixture, 1)
      expect((await barbarianState(fixture)).hitPoints).toBeLessThan(before.hitPoints)

      await advance(fixture, secondTurn)
      expect(await grantCount(fixture)).toBe(1)
    }, 240000)

    it('ends the Rage after an idle turn once the GM undoes the attack that kept it', async () => {
      const fixture = await setupBarbarianRun(source)
      const secondTurn = await advance(fixture, await ragedAndPassed(fixture))
      const undone = await undo(fixture, await swings(fixture, secondTurn))

      await advance(fixture, undone)
      expect(await grantCount(fixture)).toBe(0)
    }, 240000)

    it('ends the Rage after an idle turn once the GM undoes the bite that kept it', async () => {
      const fixture = await setupBarbarianRun(source)
      const bitten = await bites(fixture, await ragedAndPassed(fixture))
      const secondTurn = await advance(fixture, await undo(fixture, bitten))

      await advance(fixture, secondTurn)
      expect(await grantCount(fixture)).toBe(0)
    }, 240000)
  })

  it('gives the charge back and removes the grant when the GM undoes the Rage', async () => {
    const fixture = await setupBarbarianRun(source)
    const raged = await rages(fixture)
    expect((await barbarianState(fixture)).rageChargesUsed).toBe(1)

    await executeOnRun(fixture, (base) => ({
      ...base,
      type: 'REVERT_LAST_ACTION',
      expectedVersion: raged.projection.version
    }))
    expect(await barbarianState(fixture)).toMatchObject({ rageChargesUsed: 0, grantIds: [] })
  }, 120000)
})
