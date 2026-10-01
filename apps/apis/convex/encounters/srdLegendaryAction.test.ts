import { readReceiptHeader } from '../lib/receiptLedgers'
import { describe, expect, it } from 'vitest'
import type {
  EncounterCommandResultDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { encounterLegendaryActionFeatureIds } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_CONCENTRATION_DEFINITIONS } from '@artificer-toolkit/source-data/srd/concentration.js'
import { SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/encounterLifecycle.js'
import { SRD_RULE_STATE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { SRD_DAMAGE_TYPES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { seedConcentration } from '../../tests/fixtures/concentration'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { executeInRoom } from '../../tests/fixtures/liveSessionWorker'
import { domainRejection } from '../../tests/fixtures/playerControl'
import { importedSubject } from '../../tests/fixtures/publication'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { seededSrdCreature, seededSrdLoadoutEquipment } from '../../tests/fixtures/srdCreatures'
import { api, internal } from '../_generated/api'
import { sourceImportBatches } from '../content/importBatches'

const bludgeoning = SRD_DAMAGE_TYPES.find((entry) => entry.code === 'BLUDGEONING')?.id

/** Every die the room rolls, as 0-based faces in request order. */
function scripted(faces: readonly number[]) {
  const queue = [...faces]
  return (maximum: number) => {
    const face = queue.shift()
    if (face === undefined || face >= maximum) throw new Error(`Unexpected roll (d${maximum}).`)
    return face
  }
}

/**
 * The seeded SRD Adult Red Dragon and the player's Character in an Assisted Run, at the end of the
 * Character's turn, so the dragon's Legendary Action window opens (D51 option B).
 */
async function setup(input: { gmAutoRoll: boolean; playerAutoRoll: boolean }) {
  const base = await setupCharacterRun()
  await setAutoRollDice(base.t, base.owner.userId, input.gmAutoRoll)
  await setAutoRollDice(base.t, base.player.userId, input.playerAutoRoll)
  const dragon = seededSrdCreature('Adult Red Dragon')

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
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ ...dragon, subjectKind: 'CREATURE', document: dragon }),
      ...seededSrdLoadoutEquipment(dragon).map(importedSubject)
    ]
  })
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
  return { ...base, run, dragonActor, characterActor }
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

/** The terminal turn receipt's executed Legendary Action. */
async function executedLegendaryAction(base: Fixture, commandId: string) {
  const receipt = await base.t.run((ctx) =>
    ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) =>
        q.eq('encounterId', base.run.id).eq('commandId', commandId)
      )
      .unique()
      .then((header) => (header ? readReceiptHeader(ctx, 'encounterRuleReceipts', header) : null))
  )
  if (!receipt) throw new Error('The terminal turn receipt is missing.')
  const result = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
  const [action] = 'legendaryActions' in result ? (result.legendaryActions ?? []) : []
  if (action?.resolution.kind !== 'EXECUTED')
    throw new Error('Expected an executed Legendary Action.')
  return action.resolution
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
    const advanceInput = advance(base)
    const choice = await executeInRoom(base.owner.caller, advanceInput)
    const { pending, option } = tailAttack(choice)
    // Detect has no executable effect and Wing Attack is an area save, so only the Tail runs.
    expect(pending.options.map((entry) => entry.label)).toEqual(['Tail Attack'])
    expect(option).toMatchObject({ featureCost: 1, targetActorIds: [base.characterActor.id] })
    // An ungranted Creature's choice stays with the GM.
    await expect(
      base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).resolves.toBeNull()
    // A natural 19 hits (+14); the Tail's 2d8 + 8 rolls 1 and 1.
    const done = await executeInRoom(
      base.owner.caller,
      respond(base, choice, {
        kind: 'LEGENDARY_OPTION',
        optionId: option.optionId,
        targetActorId: base.characterActor.id
      }),
      scripted([18, 0, 0])
    )
    expect(done.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    const executed = await executedLegendaryAction(base, advanceInput.command.commandId)
    expect(executed).toMatchObject({
      targetActorId: base.characterActor.id,
      application: {
        kind: 'CHARACTER_MECHANICS_BATCH',
        sourceActorId: base.dragonActor.id,
        targetActorId: base.characterActor.id,
        d20: { selectedNatural: 19, resultPath: 'ON_HIT' },
        featureResourceConsumption: { cost: 1, beforeUsed: 0, afterUsed: 1 },
        applications: [{ kind: 'DAMAGE', requestedAmount: 10, damageTypeId: bludgeoning }]
      }
    })
    // The Character's Sheet advances once for the damage.
    expect(executed.characterTransitions).toHaveLength(1)
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

  it('lets the granted controller pick its target and roll its dice, with GM override', async () => {
    for (const answerer of ['PLAYER', 'GM'] as const) {
      const base = await setup({ gmAutoRoll: false, playerAutoRoll: false })
      const granted = await executeInRoom(base.owner.caller, {
        command: {
          type: 'UPDATE_ACTOR',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: base.run.version,
          actorId: base.dragonActor.id,
          controllerUserIds: [base.player.userId]
        }
      })
      const advanceInput = {
        command: { ...advance(base).command, expectedVersion: granted.projection.version }
      }
      const choice = await executeInRoom(base.owner.caller, advanceInput)
      const { option } = tailAttack(choice)
      await expect(
        base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
          encounterId: base.run.id
        })
      ).resolves.toMatchObject({ kind: 'LEGENDARY_ACTION_CHOICE', options: [option] })
      const caller = answerer === 'PLAYER' ? base.player.caller : base.owner.caller
      const attack = await executeInRoom(
        caller,
        respond(base, choice, {
          kind: 'LEGENDARY_OPTION',
          optionId: option.optionId,
          targetActorId: base.characterActor.id
        })
      )
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
      for (const value of [8, 8]) {
        const die = result.occurrence?.pending
        if (die?.kind !== 'ACTION_OUTCOME_EVIDENCE') throw new Error('Expected a damage die.')
        expect(die).toMatchObject({ rollerActorId: base.dragonActor.id, request: { max: 8 } })
        result = await executeInRoom(
          caller,
          respond(base, result, { kind: 'ENTER_INTEGER', requestId: die.request.requestId, value })
        )
      }
      expect(result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
      expect(await executedLegendaryAction(base, advanceInput.command.commandId)).toMatchObject({
        targetActorId: base.characterActor.id,
        application: { applications: [{ kind: 'DAMAGE', requestedAmount: 8 + 8 + 8 }] }
      })
    }
  }, 120000)

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
      const actor = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
      const legendary = encounterLegendaryActionFeatureIds(actor)
      return discoverEncounterFeatureActionCapabilities({
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
            targetActorId: base.characterActor.id,
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
    const result = await executeInRoom(
      base.owner.caller,
      respond(base, choice, {
        kind: 'LEGENDARY_OPTION',
        optionId: option.optionId,
        targetActorId: base.characterActor.id
      }),
      scripted([18, 0, 0])
    )
    // The turn settles; the 10 bludgeoning damage asks the Character's player for a DC 10 check.
    const check = await base.player.caller.query(
      api.encounters.pendingReads.pendingRuleOccurrence,
      {
        encounterId: base.run.id
      }
    )
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
