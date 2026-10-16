import { describe, expect, it } from 'vitest'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { readCharacterSheetState } from '@artificer-toolkit/schema/projections/characterStoredState'
import { discoverCharacterActionCapabilities } from '@artificer-toolkit/rules-runtime/characterActionCapabilityDiscoveryRegistry'
import { compileCharacterActionEntryPoints } from '@artificer-toolkit/rules-runtime/encounterActionEntryPointCompiler'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { parseRollExpression } from '@artificer-toolkit/shared/rolls'
import { barbarian } from '@artificer-toolkit/source-data/srd/classes/barbarian.js'
import { greataxe } from '@artificer-toolkit/source-data/srd/equipment/greataxe.js'
import {
  checkpointLiveRoom,
  executeInRoom,
  executeSheetInRoom,
  queueRoomRolls,
  readRoomRollCards,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { createPartyPlayer } from '../../tests/fixtures/partyPlayer'
import { homebrewCopy } from '../../tests/fixtures/homebrewCopy'
import { expectUnavailableRefusal, rejection } from '../../tests/fixtures/roomRefusals'
import { actOnRun, executeOnRun, setupWolfRun } from '../../tests/fixtures/srdWolfRun'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'

useLocalRoomWorker()

/**
 * The two Barbarians every journey runs: the SRD Class, and the same document as a homebrew author
 * owns it (fresh ids, different copy; D113's authored parity). Behavior must not tell them apart.
 */
const srdBarbarian = {
  ...barbarian,
  features: barbarian.features?.filter(({ label }) => label === 'Rage')
}
const BARBARIANS = [
  { name: 'an SRD Barbarian', source: srdBarbarian },
  { name: 'a homebrew Barbarian with the same options', source: homebrewCopy(srdBarbarian) }
]

/**
 * A level-1 SRD Barbarian with an equipped Greataxe, acting first in an Assisted (or Manual) Run
 * against the seeded SRD Wolf. Its Rage is the real SRD Feature, compiled from the seeded
 * Barbarian Class.
 */
async function setup(
  source: typeof srdBarbarian,
  automationMode: 'ASSISTED' | 'MANUAL' = 'ASSISTED'
) {
  const base = await setupWolfRun({
    character: { base: source, features: source.features },
    equipment: greataxe,
    name: 'Rage journey fixture',
    automationMode
  })
  const { actor } = base
  const actions = await base.t.run(async (ctx) => {
    const facts = await loadCharacterSheetFacts(
      ctx,
      base.player.userId,
      base.character.id,
      base.campaign.id
    )
    if (!facts) throw new Error('The Rage fixture Character facts are missing.')
    const { actionCandidates } = facts.ruleEvaluation.facts
    const rage = actionCandidates.find(
      (candidate) => candidate.resourceUse?.chargeId === source.resources?.charges?.id
    )
    const axe = actionCandidates.find((candidate) => candidate.equipment?.grip === 'TWO_HANDED')
    if (!rage || !axe) throw new Error('The Barbarian offers no Rage or Greataxe action.')
    const entry = compileCharacterActionEntryPoints({
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
    }).find((value) => value.kind === 'CHARACTER_ACTION' && value.actionId === rage.actionId)
    const damage = facts.ruleEvaluation.output.actionDecisions
      .find((decision) => decision.actionId === axe.actionId)
      ?.mechanic.outcomes.find((outcome) => outcome.kind === 'DAMAGE')
    const rageDecision = facts.ruleEvaluation.output.actionDecisions.find(
      (decision) => decision.actionId === rage.actionId
    )
    if (damage?.kind !== 'DAMAGE') throw new Error('The Greataxe attack has no damage.')
    return {
      rage: {
        actionId: rage.actionId,
        entry,
        activation: rageDecision?.mechanic.activation
      },
      axe: { actionId: axe.actionId, expression: damage.expression }
    }
  })
  return { ...base, actions }
}

type Fixture = Awaited<ReturnType<typeof setup>>

type Result = Awaited<ReturnType<typeof executeOnRun>>

function rages(fixture: Fixture) {
  return actOnRun(fixture, null, {
    actorId: fixture.actor.id,
    actionId: fixture.actions.rage.actionId,
    targetActorId: fixture.actor.id
  })
}

/** What the Barbarian holds after the room publishes: the Rage charge spent, its grants, its hit points. */
async function barbarianState(fixture: Fixture) {
  await checkpointLiveRoom(fixture.campaign.id)
  return fixture.t.run(async (ctx) => {
    const row = await readCharacterRow(ctx, fixture.character.id)
    if (!row) throw new Error('The Barbarian is missing.')
    const grants = await ctx.db
      .query('characterActiveRuleEffects')
      .withIndex('by_characterId_createdOrdinal_id', (q) =>
        q.eq('characterId', fixture.character.id)
      )
      .collect()
    return {
      rageChargesUsed: readCharacterSheetState(row).resourceUsage.reduce(
        (total, { used }) => total + used,
        0
      ),
      hitPoints: readCharacterRecord(row).state.hitpoints.current,
      grantIds: grants.map(({ id }) => id)
    }
  })
}

describe.each(BARBARIANS)('$name rages in an Encounter (ATTACK-9.T1)', ({ source }) => {
  it('compiles Rage as a bonus action that spends one Rage charge', async () => {
    const { actions } = await setup(source)
    expect(actions.rage.activation).toMatchObject({ kind: 'BONUS_ACTION' })
    expect(actions.rage.entry).toMatchObject({
      compilation: {
        kind: 'COMPILED',
        resourceBinding: { chargeId: source.resources?.charges?.id, cost: 1 }
      }
    })
  }, 60000)

  it('spends a charge, adds the Rage damage to the Greataxe hit, and halves the damage the Barbarian takes', async () => {
    const fixture = await setup(source)
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
    async function ragingOnItsNextTurn(fixture: Fixture) {
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
      fixture: Fixture,
      from: { projection: Pick<Result['projection'], 'version'> },
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
      const fixture = await setup(source)
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
      const fixture = await setup(source)
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
      const fixture = await setup(source, 'MANUAL')
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
      const fixture = await setup(source)
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
      const fixture = await setup(source)
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
      const fixture = await setup(source)
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

  it('gives the charge back and removes the grant when the GM undoes the Rage', async () => {
    const fixture = await setup(source)
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
