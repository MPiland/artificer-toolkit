import { describe, expect, it } from 'vitest'
import type { EncounterExecuteInput } from '@artificer-toolkit/schema/api/encounters'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { readCharacterSheetState } from '@artificer-toolkit/schema/projections/characterStoredState'
import { discoverCharacterActionCapabilities } from '@artificer-toolkit/rules-runtime/characterActionCapabilityDiscoveryRegistry'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { compileCharacterActionEntryPoints } from '@artificer-toolkit/rules-runtime/encounterActionEntryPointCompiler'
import { readRunActor, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { parseRollExpression } from '@artificer-toolkit/shared/rolls'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { barbarian } from '@artificer-toolkit/source-data/srd/classes/barbarian.js'
import { greataxe } from '@artificer-toolkit/source-data/srd/equipment/greataxe.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
  SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { equipAllCharacterItems, setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import {
  attachRoomWorker,
  checkpointLiveRoom,
  executeInRoom,
  queueRoomRolls,
  readRoomRollCards,
  seedRoomContentSnapshots,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { importedSubject } from '../../tests/fixtures/publication'
import { rejection } from '../../tests/fixtures/roomRefusals'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { srdWolf } from '../../tests/fixtures/srdCreatures'
import { api, internal } from '../_generated/api'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'

useLocalRoomWorker()

const RAGE_CHARGE_ID = barbarian.resources?.charges?.id

/**
 * A level-1 SRD Barbarian with an equipped Greataxe, acting first in an Assisted Run against the
 * seeded SRD Wolf. Its Rage is the real SRD Feature, compiled from the seeded Barbarian Class.
 */
async function setup() {
  const base = await setupCharacterRun(
    { base: barbarian, features: barbarian.features?.filter(({ label }) => label === 'Rage') },
    greataxe
  )
  await attachRoomWorker(base.t)
  await equipAllCharacterItems(base)
  // Table roll cards post to the opened Table chat, which needs a username.
  await base.player.caller.mutation(api.account.updateProfile, {
    username: 'RagingHero',
    bio: null
  })
  await base.owner.caller.mutation(api.account.updateProfile, { username: 'RageGm', bio: null })
  await base.owner.caller.mutation(api.campaigns.conversations.open, {
    campaignId: base.campaign.id,
    kind: 'TABLE'
  })
  for (const { userId } of [base.player, base.owner]) await setAutoRollDice(base.t, userId, true)
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: SRD_RULE_STATE_DEFINITIONS.filter(
      (definition) =>
        definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID ||
        definition.id === SRD_ACTOR_ACTION_CAPABILITY_DEFINITION_ID ||
        definition.id === SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID
    )
  })
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...srdWolf, subjectKind: 'CREATURE', document: srdWolf })]
  })
  await seedRoomContentSnapshots(base.campaign.id)
  const blueprint = await base.owner.caller.mutation(api.encounters.blueprints.create, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Rage journey fixture',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CREATURE', sourceId: srdWolf.id }]
  })
  const run = await base.owner.caller.mutation(api.encounters.runs.create, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const actor = run.actors.find((candidate) => candidate.kind === 'CHARACTER')
  const wolf = run.actors.find((candidate) => candidate.kind === 'CREATURE')
  if (!actor || !wolf) throw new Error('The Rage fixture actors are missing.')
  const actions = await base.t.run(async (ctx) => {
    await activateFixtureRun(
      ctx,
      run.id,
      { automationMode: 'ASSISTED', round: 1, currentActorId: actor.id },
      [actor.id, wolf.id]
    )
    const facts = await loadCharacterSheetFacts(
      ctx,
      base.player.userId,
      base.character.id,
      base.campaign.id
    )
    if (!facts) throw new Error('The Rage fixture Character facts are missing.')
    const { actionCandidates } = facts.ruleEvaluation.facts
    const rage = actionCandidates.find(
      (candidate) => candidate.resourceUse?.chargeId === RAGE_CHARGE_ID
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
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!row) throw new Error('The Rage fixture Run is missing.')
    const bite = discoverEncounterFeatureActionCapabilities({
      actor: await readRunActor(
        { db: createConvexEncounterStoreReader(ctx) },
        readRunState(row),
        wolf.id
      ),
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map(({ id }) => id),
      abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
    }).find(
      (capability) => capability.mechanicFacts.invocation.triggerCode === 'MELEE_WEAPON_ATTACK'
    )
    if (!bite) throw new Error('The Wolf offers no Bite.')
    return {
      rage: {
        actionId: rage.actionId,
        entry,
        activation: rageDecision?.mechanic.activation
      },
      axe: { actionId: axe.actionId, expression: damage.expression },
      biteActionId: bite.actionId
    }
  })
  return { ...base, run, actor, wolf, actions }
}

type Fixture = Awaited<ReturnType<typeof setup>>

function execute(
  fixture: Fixture,
  command: (base: { encounterId: string; commandId: string }) => EncounterExecuteInput['command']
) {
  return executeInRoom(fixture.owner.caller, {
    command: command({ encounterId: fixture.run.id, commandId: crypto.randomUUID() })
  })
}

type Result = Awaited<ReturnType<typeof execute>>

/** The actor uses one of its actions on the target; the Run has no Scene, so reach is unchecked (D11). */
function act(
  fixture: Fixture,
  from: Pick<Result, 'projection'> | null,
  input: { actorId: string; actionId: string; targetActorId: string }
) {
  return execute(fixture, (base) => ({
    ...base,
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: ['TARGET_RANGE_UNCHECKED'],
    expectedVersion: from?.projection.version ?? fixture.run.version,
    actorId: input.actorId,
    target: { kind: 'ACTOR', actorId: input.targetActorId },
    actionId: input.actionId,
    optionalCombatIntent: null,
    sceneContext: null
  }))
}

function rages(fixture: Fixture) {
  return act(fixture, null, {
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

describe('a Barbarian rages in an Encounter (ATTACK-9.T1)', () => {
  it('compiles Rage as a bonus action that spends one Rage charge', async () => {
    const { actions } = await setup()
    expect(actions.rage.activation).toMatchObject({ kind: 'BONUS_ACTION' })
    expect(actions.rage.entry).toMatchObject({
      compilation: {
        kind: 'COMPILED',
        resourceBinding: { chargeId: RAGE_CHARGE_ID, cost: 1 }
      }
    })
  }, 60000)

  it('spends a charge, adds the Rage damage to the Greataxe hit, and halves the damage the Barbarian takes', async () => {
    const fixture = await setup()
    const before = await barbarianState(fixture)
    expect(before).toMatchObject({ rageChargesUsed: 0, grantIds: [] })

    const raged = await rages(fixture)
    expect(raged.occurrence?.status).toBe('COMPLETE')
    const afterRage = await barbarianState(fixture)
    expect(afterRage.rageChargesUsed).toBe(1)
    expect(afterRage.grantIds).toHaveLength(1)

    // d20 15 hits the Wolf; the d12 rolls 5.
    await queueRoomRolls(fixture.campaign.id, { rolls: [14, 4] })
    const hit = await act(fixture, raged, {
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
    const wolfTurn = await execute(fixture, (base) => ({
      ...base,
      type: 'ADVANCE_TURN',
      expectedVersion: hit.projection.version
    }))
    expect(wolfTurn.projection.currentActorId).toBe(fixture.wolf.id)
    await queueRoomRolls(fixture.campaign.id, { rolls: [14, 0, 3] })
    const bitten = await act(fixture, wolfTurn, {
      actorId: fixture.wolf.id,
      actionId: fixture.actions.biteActionId,
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
      const wolfTurn = await execute(fixture, (base) => ({
        ...base,
        type: 'ADVANCE_TURN',
        expectedVersion: raged.projection.version
      }))
      const barbarianTurn = await execute(fixture, (base) => ({
        ...base,
        type: 'ADVANCE_TURN',
        expectedVersion: wolfTurn.projection.version
      }))
      return { raged, wolfTurn, barbarianTurn, grantId }
    }

    /** The Barbarian's own player ends the grant. */
    function endsRage(
      fixture: Fixture,
      from: Pick<Result, 'projection'>,
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
      const fixture = await setup()
      const { barbarianTurn, grantId } = await ragingOnItsNextTurn(fixture)

      const ended = await endsRage(fixture, barbarianTurn, grantId)
      expect(await barbarianState(fixture)).toMatchObject({ rageChargesUsed: 1, grantIds: [] })

      // The end spent the bonus action, so a second Rage this turn has none left.
      const second = await rejection(
        act(fixture, ended, {
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

    it('refuses to end the Rage off the holder turn', async () => {
      const fixture = await setup()
      const raged = await rages(fixture)
      const [grantId] = (await barbarianState(fixture)).grantIds
      if (!grantId) throw new Error('Rage granted nothing.')
      const wolfTurn = await execute(fixture, (base) => ({
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

    it('refuses to end the Rage once the bonus action is spent unless the warning is acknowledged', async () => {
      const fixture = await setup()
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
    const fixture = await setup()
    const raged = await rages(fixture)
    expect((await barbarianState(fixture)).rageChargesUsed).toBe(1)

    await execute(fixture, (base) => ({
      ...base,
      type: 'REVERT_LAST_ACTION',
      expectedVersion: raged.projection.version
    }))
    expect(await barbarianState(fixture)).toMatchObject({ rageChargesUsed: 0, grantIds: [] })
  }, 120000)
})
