import { readTestActor } from '../../tests/fixtures/storedActors'
import { describe, expect, it } from 'vitest'
import {
  encounterGmProjectionDtoSchema,
  type EncounterCommandResultDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { encounterLegendaryActionFeatureIds } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_CONCENTRATION_DEFINITIONS } from '@artificer-toolkit/source-data/srd/concentration.js'
import { SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/encounterLifecycle.js'
import { SRD_RULE_STATE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { seedConcentration } from '../../tests/fixtures/concentration'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  executeInRoom,
  queueRoomRolls,
  type RoomCaller,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { createPartyPlayer } from '../../tests/fixtures/partyPlayer'
import { domainRejection } from '../../tests/fixtures/playerControl'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import {
  importSeededSrdCreatureSenses,
  seededSrdCreature,
  seededSrdPinnedSources
} from '../../tests/fixtures/srdCreatures'
import { api, internal } from '../_generated/api'
import { readCharacterRow } from '../characters/stateDocuments'
import { sourceImportBatches } from '../content/importBatches'

useLocalRoomWorker()

/**
 * The seeded SRD Adult Red Dragon and the player's Character in an Assisted Run, at the end of the
 * Character's turn, so the dragon's Legendary Action window opens (D51 option B).
 */
async function setup(input: { gmAutoRoll: boolean; playerAutoRoll: boolean; creature?: string }) {
  const base = await setupCharacterRun()
  await setAutoRollDice(base.t, base.owner.userId, input.gmAutoRoll)
  await setAutoRollDice(base.t, base.player.userId, input.playerAutoRoll)
  const dragon = seededSrdCreature(input.creature ?? 'Adult Red Dragon')

  // The dragon's Legendary Action, Legendary Resistance and Recharge policies, and Concentration.
  for (const definitions of sourceImportBatches([
    ...SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS.map((definition) => ({
      ...definition,
      document: jsonValueSchema.parse(definition.document)
    })),
    ...SRD_RULE_STATE_DEFINITIONS,
    ...SRD_CONCENTRATION_DEFINITIONS
  ]))
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions
    })
  await importSeededSrdCreatureSenses(base.t, dragon)
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ ...dragon, subjectKind: 'CREATURE', document: dragon }),
      ...seededSrdPinnedSources(dragon).map(importedSubject)
    ]
  })
  // A second player, who owns no Character: the controller a GM can grant the dragon.
  const dragonController = await createPartyPlayer(base.t, base.campaign)
  await dragonController.join()
  await setAutoRollDice(base.t, dragonController.userId, input.playerAutoRoll)
  await attachFixtureRoom(base.t, base.campaign.id)
  const blueprint = await base.owner.caller.mutation(api.encounters.blueprints.create, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Legendary dragon fixture',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CREATURE', sourceId: dragon.id }]
  })
  const run = await base.owner.caller.mutation(api.encounters.runs.create, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const dragonActor = run.actors.find((candidate) => candidate.kind === 'CREATURE')
  const characterActor = run.actors.find((candidate) => candidate.kind === 'CHARACTER')
  if (!dragonActor || !characterActor) throw new Error('The Legendary fixture actors are missing.')
  await base.t.run((ctx) =>
    activateFixtureRun(
      ctx,
      run.id,
      { automationMode: 'ASSISTED', round: 1, currentActorId: characterActor.id },
      [characterActor.id, dragonActor.id]
    )
  )
  return { ...base, run, dragonActor, characterActor, dragonController }
}

type Fixture = Awaited<ReturnType<typeof setup>>

function advance(base: Fixture) {
  return {
    command: {
      type: 'ADVANCE_TURN' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.run.version
    }
  }
}

function respond(
  base: Fixture,
  result: EncounterCommandResultDto,
  resolution: ResolveRuleOccurrenceInputDto['resolution']
) {
  if (!result.occurrence) throw new Error('Expected a pending turn occurrence.')
  return {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: result.projection.version,
      occurrenceId: result.occurrence.occurrenceId,
      expectedOccurrenceVersion: result.occurrence.occurrenceVersion,
      correlationId: null,
      resolution
    }
  }
}

/**
 * What the Legendary Action did to the Character, as the room published it: the room holds the
 * turn receipt until the Run ends (D85), so the hit points and Sheet stream version show it.
 */
async function characterAfter(base: Fixture) {
  await checkpointLiveRoom(base.campaign.id)
  const projection = encounterGmProjectionDtoSchema.parse(
    await base.owner.caller.query(api.encounters.projectionReads.get, {
      encounterId: base.run.id
    })
  )
  const actor = projection.actors.find((candidate) => candidate.id === base.characterActor.id)
  if (!actor) throw new Error('The projected Character is missing.')
  const row = await base.t.run((ctx) => readCharacterRow(ctx, base.character.id))
  if (!row) throw new Error('The Character row is missing.')
  return { currentHitPoints: actor.currentHitPoints, streamVersion: row.play.streamVersion }
}

/** The decision Convex serves a member, current only after the room checkpoints. */
async function pendingFor(base: Fixture, caller: RoomCaller) {
  await checkpointLiveRoom(base.campaign.id)
  return caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
    encounterId: base.run.id
  })
}

function tailAttack(result: EncounterCommandResultDto) {
  const pending = result.occurrence?.pending
  if (pending?.kind !== 'LEGENDARY_ACTION_CHOICE')
    throw new Error('Expected the dragon’s Legendary Action choice.')
  const option = pending.options.find((entry) => entry.label === 'Tail Attack')
  if (!option) throw new Error('Expected the Tail Attack option.')
  return { pending, option }
}

describe('seeded SRD Legendary Actions in the room (D51 option B)', () => {
  it('runs the Adult Red Dragon’s Tail against the Character the GM picks', async () => {
    const base = await setup({ gmAutoRoll: true, playerAutoRoll: true })
    const before = await characterAfter(base)
    const choice = await executeInRoom(base.owner.caller, advance(base))
    const { pending, option } = tailAttack(choice)
    // Detect has no executable effect, and Wing Attack's area centers on a token the dragon lacks
    // here, so only the Tail runs.
    expect(pending.options.map((entry) => entry.label)).toEqual(['Tail Attack'])
    expect(option).toMatchObject({ featureCost: 1, targetActorIds: [base.characterActor.id] })
    // An ungranted Creature's choice stays with the GM.
    await expect(pendingFor(base, base.player.caller)).resolves.toBeNull()
    // A natural 19 hits (+14); the Tail's 2d8 + 8 rolls 1 and 1.
    await queueRoomRolls(base.campaign.id, { rolls: [18, 0, 0] })
    const done = await executeInRoom(
      base.owner.caller,
      respond(base, choice, {
        kind: 'LEGENDARY_OPTION',
        optionId: option.optionId,
        targetActorId: base.characterActor.id
      })
    )
    expect(done.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    // The room holds the turn receipt (D85; `nativeRoomLegendary.test.ts` asserts the executed
    // action and its Character transition) and posts no roll card for a Legendary Action, so the
    // hit (a natural 19) and the damage dice (1 and 1) show as the Character's 10 damage and one
    // Sheet advance on the checkpointed Character.
    const after = await characterAfter(base)
    expect(before.currentHitPoints - after.currentHitPoints).toBe(10)
    expect(after.streamVersion).toBe(before.streamVersion + 1)
    // On its own turn the dragon's drawer offers its Tail, but no Legendary option (SRD 5.1).
    expect(done.projection.currentActorId).toBe(base.dragonActor.id)
    const choices = await base.owner.caller.query(api.encounters.actionChoices.get, {
      encounterId: base.run.id,
      expectedVersion: done.projection.version,
      actorId: base.dragonActor.id
    })
    const labels = [
      ...(choices?.actions ?? []).map((action) => action.label),
      ...(choices?.unavailableActions ?? []).map((action) => action.label)
    ]
    expect(labels).toContain('Tail')
    expect(labels).not.toContain('Tail Attack')
    expect(labels).not.toContain('Wing Attack (Costs 2 Actions)')
  }, 60000)

  it.each(['PLAYER', 'GM'] as const)(
    'lets the granted controller pick its target and roll its dice, with GM override (%s answers)',
    async (answerer) => {
      const base = await setup({ gmAutoRoll: false, playerAutoRoll: false })
      const before = await characterAfter(base)
      const granted = await executeInRoom(base.owner.caller, {
        command: {
          type: 'UPDATE_ACTOR',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: base.run.version,
          actorId: base.dragonActor.id,
          controllerUserIds: [base.dragonController.userId]
        }
      })
      const advanceInput = {
        command: { ...advance(base).command, expectedVersion: granted.projection.version }
      }
      const choice = await executeInRoom(base.owner.caller, advanceInput)
      const { option } = tailAttack(choice)
      const pick = respond(base, choice, {
        kind: 'LEGENDARY_OPTION',
        optionId: option.optionId,
        targetActorId: base.characterActor.id
      })
      // The grant is the dragon's controller's alone: the Character's own player is neither shown
      // the choice nor allowed to answer it, and the refusal leaves the choice pending.
      await expect(pendingFor(base, base.dragonController.caller)).resolves.toMatchObject({
        kind: 'LEGENDARY_ACTION_CHOICE',
        options: [option]
      })
      await expect(pendingFor(base, base.player.caller)).resolves.toBeNull()
      await expect(executeInRoom(base.player.caller, pick)).rejects.toThrow()
      await expect(pendingFor(base, base.dragonController.caller)).resolves.toMatchObject({
        kind: 'LEGENDARY_ACTION_CHOICE'
      })
      const caller = answerer === 'PLAYER' ? base.dragonController.caller : base.owner.caller
      const attack = await executeInRoom(caller, pick)
      const d20 = attack.occurrence?.pending
      if (d20?.kind !== 'D20_EVIDENCE') throw new Error('Expected the dragon’s attack roll.')
      expect(d20.rollerActorId).toBe(base.dragonActor.id)
      let result = await executeInRoom(
        caller,
        respond(base, attack, {
          kind: 'ENTER_DICE',
          requestId: d20.request.requestId,
          rawFaces: [15],
          rollMode: d20.request.rollMode
        })
      )
      // The Tail's damage dice wait on the same controllers.
      for (const value of [1, 1]) {
        const die = result.occurrence?.pending
        if (die?.kind !== 'ACTION_OUTCOME_EVIDENCE') throw new Error('Expected a damage die.')
        expect(die).toMatchObject({ rollerActorId: base.dragonActor.id, request: { max: 8 } })
        result = await executeInRoom(
          caller,
          respond(base, result, { kind: 'ENTER_INTEGER', requestId: die.request.requestId, value })
        )
      }
      expect(result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
      // The room holds the turn receipt (D85): the entered dice show as the Character's damage
      // (2d8 + 8 with both dice entered as 1; larger dice would take the Character to 0).
      const after = await characterAfter(base)
      expect(before.currentHitPoints - after.currentHitPoints).toBe(1 + 1 + 8)
    },
    120000
  )

  it('refuses a Legendary option sent as the dragon’s own action (D63)', async () => {
    const base = await setup({ gmAutoRoll: true, playerAutoRoll: true })
    const current = await executeInRoom(base.owner.caller, {
      command: {
        type: 'SET_CURRENT_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version,
        actorId: base.dragonActor.id
      }
    })
    const legendaryActionId = await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', base.run.id).eq('id', base.dragonActor.id)
        )
        .unique()
      if (!row) throw new Error('The Legendary fixture dragon is missing.')
      const actor = await readTestActor(ctx, row)
      const legendary = encounterLegendaryActionFeatureIds(actor)
      return discoverEncounterFeatureActionCapabilities({
        spells: new Map(),
        actor,
        conditionDefinitionIds: srdSystemRecord.conditionTypes.map(({ id }) => id),
        abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
      }).find((capability) => legendary.has(capability.ownerFeatureId))?.actionId
    })
    if (!legendaryActionId) throw new Error('Expected a Legendary option.')
    expect(
      await domainRejection(
        executeInRoom(base.owner.caller, {
          command: {
            type: 'RESOLVE_ACTION',
            acceptedWieldConflict: null,
            acknowledgedWarnings: ['TARGET_RANGE_UNCHECKED'],
            encounterId: base.run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: current.projection.version,
            actorId: base.dragonActor.id,
            target: { kind: 'ACTOR', actorId: base.characterActor.id },
            actionId: legendaryActionId,
            optionalCombatIntent: null,
            sceneContext: null
          }
        })
      )
    ).toMatchObject({ reason: 'LEGENDARY_WINDOW_ONLY' })
  }, 60000)

  it('makes the Character whose Concentration the Tail breaks roll for it (D50.4)', async () => {
    const base = await setup({ gmAutoRoll: true, playerAutoRoll: false })
    await seedConcentration({
      t: base.t,
      run: base.run,
      target: base.characterActor,
      character: base.character
    })
    const choice = await executeInRoom(base.owner.caller, advance(base))
    const { option } = tailAttack(choice)
    await queueRoomRolls(base.campaign.id, { rolls: [18, 0, 0] })
    const result = await executeInRoom(
      base.owner.caller,
      respond(base, choice, {
        kind: 'LEGENDARY_OPTION',
        optionId: option.optionId,
        targetActorId: base.characterActor.id
      })
    )
    // The turn settles; the 10 bludgeoning damage asks the Character's player for a DC 10 check.
    const check = await pendingFor(base, base.player.caller)
    expect(result.projection.currentActorId).toBe(base.dragonActor.id)
    expect(check).toMatchObject({
      kind: 'D20_EVIDENCE',
      rollerActorId: base.characterActor.id,
      trigger: {
        kind: 'CONCENTRATION',
        damage: { amount: 10 },
        sourceLabel: 'Tail Attack',
        dc: 10
      }
    })
  }, 60000)
})

describe('seeded SRD Unicorn Shimmering Shield in the room (SPELLS-5.3)', () => {
  it('puts a +2 AC grant on the Character the GM picks, held on the Character’s Sheet', async () => {
    const base = await setup({ gmAutoRoll: true, playerAutoRoll: true, creature: 'Unicorn' })
    const before = await characterAfter(base)
    const choice = await executeInRoom(base.owner.caller, advance(base))
    const pending = choice.occurrence?.pending
    if (pending?.kind !== 'LEGENDARY_ACTION_CHOICE')
      throw new Error('Expected the unicorn’s Legendary Action choice.')
    const option = pending.options.find((entry) => entry.label.startsWith('Shimmering Shield'))
    if (!option) throw new Error('Expected the Shimmering Shield option.')
    expect(option).toMatchObject({
      featureCost: 2,
      targetActorIds: expect.arrayContaining([base.characterActor.id, base.dragonActor.id])
    })
    const done = await executeInRoom(
      base.owner.caller,
      respond(base, choice, {
        kind: 'LEGENDARY_OPTION',
        optionId: option.optionId,
        targetActorId: base.characterActor.id
      })
    )
    expect(done.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    // The grant lands on the Character's Sheet, which advances once for it.
    const after = await characterAfter(base)
    expect(after.streamVersion).toBe(before.streamVersion + 1)
    const effects = await base.t.run((ctx) => ctx.db.query('characterActiveRuleEffects').collect())
    expect(effects).toHaveLength(1)
  }, 60000)
})
