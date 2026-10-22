import { describe, expect, it } from 'vitest'
import { readCharacterSheetState } from '@artificer-toolkit/schema/projections/characterStoredState'
import { discoverCharacterActionCapabilities } from '@artificer-toolkit/rules-runtime/characterActionCapabilityDiscovery'
import { compileCharacterActionEntryPoints } from '@artificer-toolkit/rules-runtime/encounterActionEntryPointCompiler'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { greataxe } from '@artificer-toolkit/source-data/srd/equipment/greataxe.js'
import {
  checkpointLiveRoom,
  queueRoomRolls,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { homebrewCopy } from '../../tests/fixtures/homebrewCopy'
import { rejection } from '../../tests/fixtures/roomRefusals'
import { actOnRun, executeOnRun, setupWolfRun } from '../../tests/fixtures/srdWolfRun'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'

useLocalRoomWorker()

/**
 * The two Fighters every journey runs: the SRD Class, and the same document as a homebrew author
 * owns it (fresh ids, different copy; D113's authored parity). Behavior must not tell them apart.
 */
const srdFighter = {
  ...fighter,
  features: fighter.features?.filter(
    ({ label }) => label === 'Second Wind' || label === 'Action Surge'
  )
}
const FIGHTERS = [
  { name: 'an SRD Fighter', source: srdFighter },
  { name: 'a homebrew Fighter with the same options', source: homebrewCopy(srdFighter) }
]

/**
 * A level-2 Fighter with an equipped Greataxe, acting first in an Assisted Run against the seeded
 * SRD Wolf. Second Wind and Action Surge are the real SRD Features, compiled from the seeded Class.
 */
async function setup(source: typeof srdFighter) {
  const base = await setupWolfRun({
    character: { base: source, features: source.features, classLevel: 2 },
    equipment: greataxe,
    name: 'Fighter journey fixture'
  })
  const chargeIds = {
    secondWind: source.features?.find(({ label }) => label.endsWith('Second Wind'))?.charges?.id,
    actionSurge: source.features?.find(({ label }) => label.endsWith('Action Surge'))?.charges?.id
  }
  const actions = await base.t.run(async (ctx) => {
    const facts = await loadCharacterSheetFacts(
      ctx,
      base.player.userId,
      base.character.id,
      base.campaign.id
    )
    if (!facts) throw new Error('The Fighter fixture Character facts are missing.')
    const { actionCandidates } = facts.ruleEvaluation.facts
    const byCharge = (chargeId: string | undefined) =>
      actionCandidates.find((candidate) => candidate.resourceUse?.chargeId === chargeId)
    const secondWind = byCharge(chargeIds.secondWind)
    const actionSurge = byCharge(chargeIds.actionSurge)
    const axe = actionCandidates.find((candidate) => candidate.equipment?.grip === 'TWO_HANDED')
    if (!secondWind || !actionSurge || !axe)
      throw new Error('The Fighter offers no Second Wind, Action Surge or Greataxe action.')
    const entries = compileCharacterActionEntryPoints({
      gameSystemId: base.character.systemId,
      candidates: actionCandidates,
      descriptors: discoverCharacterActionCapabilities({
        gameSystemId: base.character.systemId,
        candidates: actionCandidates,
        conditionDefinitionIds: (facts.prepared.context.registry.system?.conditionTypes ?? []).map(
          ({ id }) => id
        ),
        abilityDefinitions: facts.ruleEvaluation.facts.abilityDefinitions,
        entryPoints: facts.ruleEvaluation.actionEntryPoints
      })
    })
    const describeAction = (action: (typeof actionCandidates)[number]) => ({
      actionId: action.actionId,
      entry: entries.find(
        (value) => value.kind === 'CHARACTER_ACTION' && value.actionId === action.actionId
      ),
      activation: action.mechanicFacts.invocation.activation
    })
    return {
      secondWind: describeAction(secondWind),
      actionSurge: describeAction(actionSurge),
      axeActionId: axe.actionId
    }
  })
  return { ...base, chargeIds, actions }
}

type Fixture = Awaited<ReturnType<typeof setup>>
type Result = Awaited<ReturnType<typeof executeOnRun>>

function advanceTurn(fixture: Fixture, from: Pick<Result, 'projection'> | null) {
  return executeOnRun(fixture, (base) => ({
    ...base,
    type: 'ADVANCE_TURN',
    expectedVersion: from?.projection.version ?? fixture.run.version
  }))
}

function useOnSelf(fixture: Fixture, from: Pick<Result, 'projection'> | null, actionId: string) {
  return actOnRun(fixture, from, {
    actorId: fixture.actor.id,
    actionId,
    targetActorId: fixture.actor.id
  })
}

function swingAtWolf(fixture: Fixture, from: Pick<Result, 'projection'> | null) {
  return actOnRun(fixture, from, {
    actorId: fixture.actor.id,
    actionId: fixture.actions.axeActionId,
    targetActorId: fixture.wolf.id
  })
}

/** A swing the dice miss with (a natural 1), so only the action economy is under test. */
async function missesTheWolf(fixture: Fixture, from: Pick<Result, 'projection'> | null) {
  await queueRoomRolls(fixture.campaign.id, { rolls: [0] })
  const result = await swingAtWolf(fixture, from)
  expect(result.occurrence?.status).toBe('COMPLETE')
  return result
}

/** What the Fighter holds after the room publishes: each feature's charges spent and its hit points. */
async function fighterState(fixture: Fixture) {
  await checkpointLiveRoom(fixture.campaign.id)
  return fixture.t.run(async (ctx) => {
    const row = await readCharacterRow(ctx, fixture.character.id)
    if (!row) throw new Error('The Fighter is missing.')
    const usedOf = (chargeId: string | undefined) =>
      readCharacterSheetState(row)
        .resourceUsage.filter(
          ({ owner }) => owner.kind === 'AUTHORED_SOURCE' && owner.chargeId === chargeId
        )
        .reduce((total, { used }) => total + used, 0)
    return {
      secondWindChargesUsed: usedOf(fixture.chargeIds.secondWind),
      actionSurgeChargesUsed: usedOf(fixture.chargeIds.actionSurge),
      hitPoints: readCharacterRecord(row).state.hitpoints.current
    }
  })
}

const ACTION_ECONOMY_UNAVAILABLE = {
  reason: 'RULE_WARNINGS',
  warnings: expect.arrayContaining([
    expect.objectContaining({ code: 'ACTION_ECONOMY_UNAVAILABLE' })
  ])
}

describe.each(FIGHTERS)('$name uses class features in an Encounter (ATTACK-9.T3)', ({ source }) => {
  it('compiles Second Wind as a bonus action and Action Surge as a free action, each spending a charge', async () => {
    const { actions, chargeIds } = await setup(source)
    expect(actions.secondWind.activation).toMatchObject({ code: 'BONUS_ACTION' })
    expect(actions.secondWind.entry).toMatchObject({
      compilation: {
        kind: 'COMPILED',
        resourceBinding: { chargeId: chargeIds.secondWind, cost: 1 }
      }
    })
    expect(actions.actionSurge.activation).toMatchObject({ code: 'FREE' })
    expect(actions.actionSurge.entry).toMatchObject({
      compilation: {
        kind: 'COMPILED',
        resourceBinding: { chargeId: chargeIds.actionSurge, cost: 1 }
      }
    })
  }, 60000)

  describe('Second Wind', () => {
    /** The Wolf bites the Fighter for 7, and the turn comes back to the Fighter. */
    async function bittenOnItsNextTurn(fixture: Fixture) {
      const wolfTurn = await advanceTurn(fixture, null)
      expect(wolfTurn.projection.currentActorId).toBe(fixture.wolf.id)
      // d20 15 hits; 2d4 rolls 1 and 4, so 5 + 2 = 7 piercing.
      await queueRoomRolls(fixture.campaign.id, { rolls: [14, 0, 3] })
      const bitten = await actOnRun(fixture, wolfTurn, {
        actorId: fixture.wolf.id,
        actionId: fixture.biteActionId,
        targetActorId: fixture.actor.id
      })
      expect(bitten.occurrence?.status).toBe('COMPLETE')
      const fighterTurn = await advanceTurn(fixture, bitten)
      expect(fighterTurn.projection.currentActorId).toBe(fixture.actor.id)
      return { fighterTurn, afterBite: await fighterState(fixture) }
    }

    it('heals 1d10 + the Fighter level and spends the charge', async () => {
      const fixture = await setup(source)
      const { fighterTurn, afterBite } = await bittenOnItsNextTurn(fixture)
      expect(afterBite.secondWindChargesUsed).toBe(0)

      // The d10 rolls 3, plus the Fighter level of 2.
      await queueRoomRolls(fixture.campaign.id, { rolls: [2] })
      const healed = await useOnSelf(fixture, fighterTurn, fixture.actions.secondWind.actionId)
      expect(healed.occurrence?.status).toBe('COMPLETE')
      const afterWind = await fighterState(fixture)
      expect(afterWind.hitPoints - afterBite.hitPoints).toBe(5)
      expect(afterWind.secondWindChargesUsed).toBe(1)

      // The charge and the bonus action are spent, so a second Second Wind is refused.
      expect(
        await rejection(useOnSelf(fixture, healed, fixture.actions.secondWind.actionId))
      ).toMatchObject({ reason: 'RULE_WARNINGS' })
      expect((await fighterState(fixture)).secondWindChargesUsed).toBe(1)
    }, 120000)

    it('gives the charge and the hit points back when the GM undoes it', async () => {
      const fixture = await setup(source)
      const { fighterTurn, afterBite } = await bittenOnItsNextTurn(fixture)
      await queueRoomRolls(fixture.campaign.id, { rolls: [2] })
      const healed = await useOnSelf(fixture, fighterTurn, fixture.actions.secondWind.actionId)

      await executeOnRun(fixture, (base) => ({
        ...base,
        type: 'REVERT_LAST_ACTION',
        expectedVersion: healed.projection.version
      }))
      expect(await fighterState(fixture)).toEqual(afterBite)
    }, 120000)
  })

  describe('Action Surge', () => {
    it('is free, spends a charge, and allows exactly one more Action this turn', async () => {
      const fixture = await setup(source)
      const surged = await useOnSelf(fixture, null, fixture.actions.actionSurge.actionId)
      expect(surged.occurrence?.status).toBe('COMPLETE')
      expect((await fighterState(fixture)).actionSurgeChargesUsed).toBe(1)

      const first = await missesTheWolf(fixture, surged)
      const second = await missesTheWolf(fixture, first)
      expect(await rejection(swingAtWolf(fixture, second))).toMatchObject(
        ACTION_ECONOMY_UNAVAILABLE
      )
    }, 120000)

    it('ends with the turn: the next turn has its one Action again', async () => {
      const fixture = await setup(source)
      const surged = await useOnSelf(fixture, null, fixture.actions.actionSurge.actionId)
      const first = await missesTheWolf(fixture, surged)
      const second = await missesTheWolf(fixture, first)

      const wolfTurn = await advanceTurn(fixture, second)
      const fighterTurn = await advanceTurn(fixture, wolfTurn)
      expect(fighterTurn.projection.currentActorId).toBe(fixture.actor.id)
      // Both Actions were spent, so the new turn's refresh had to clear a count above the base maximum.
      const nextFirst = await missesTheWolf(fixture, fighterTurn)
      expect(await rejection(swingAtWolf(fixture, nextFirst))).toMatchObject(
        ACTION_ECONOMY_UNAVAILABLE
      )
    }, 120000)

    it('gives the charge back and removes the extra Action when the GM undoes it', async () => {
      const fixture = await setup(source)
      const surged = await useOnSelf(fixture, null, fixture.actions.actionSurge.actionId)
      const reverted = await executeOnRun(fixture, (base) => ({
        ...base,
        type: 'REVERT_LAST_ACTION',
        expectedVersion: surged.projection.version
      }))
      expect((await fighterState(fixture)).actionSurgeChargesUsed).toBe(0)

      const first = await missesTheWolf(fixture, reverted)
      expect(await rejection(swingAtWolf(fixture, first))).toMatchObject(ACTION_ECONOMY_UNAVAILABLE)
    }, 120000)
  })
})
