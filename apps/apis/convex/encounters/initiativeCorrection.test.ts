import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignPlaySettingsDto,
  SaveCampaignPlaySettingsInput
} from '@artificer-toolkit/schema/api/campaignSettings'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterExecuteInput,
  EncounterCommandResultDto,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterInitiativeRoundStateDtoSchema } from '@artificer-toolkit/schema/shared/initiativeState'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

import { fixture } from '../../tests/fixtures/characters'

import { validateInitiativeCursor } from '@artificer-toolkit/rules-runtime/encounterInitiativeCursor'
import { executeInRoom, replayInRoom } from '../../tests/fixtures/liveSessionWorker'
import { LiveSessionRouteError } from '../../../session-worker/src/liveSessionRoutes'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createBlueprint = makeFunctionReference<
  'mutation',
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto
>('encounters/blueprints:create')
const createRun = makeFunctionReference<
  'mutation',
  CreateEncounterInputDto,
  EncounterGmProjectionDto
>('encounters/runs:create')
const execute = makeFunctionReference<'mutation', EncounterExecuteInput, EncounterCommandResultDto>(
  'encounters/commands:execute'
)
const getPlaySettings = makeFunctionReference<
  'query',
  { campaignId: string },
  CampaignPlaySettingsDto
>('campaigns/playSettings:get')
const savePlaySettings = makeFunctionReference<
  'mutation',
  SaveCampaignPlaySettingsInput,
  CampaignPlaySettingsDto
>('campaigns/playSettings:save')

const encounterId = '11111111-1111-4111-8111-111111111111'
const actorA = '22222222-2222-4222-8222-222222222222'
const actorB = '33333333-3333-4333-8333-333333333333'
const sideA = '44444444-4444-4444-8444-444444444444'
const sideB = '55555555-5555-4555-8555-555555555555'
const timestamp = '2026-01-01T00:00:00.000Z'

function state(currentActorId: string | null) {
  return encounterInitiativeRoundStateDtoSchema.parse({
    round: {
      encounterId,
      round: 1,
      procedure: 'SIDE_ROLL',
      cadence: 'ENCOUNTER_START',
      policySnapshotChecksum: 'a'.repeat(64),
      status: 'ACTIVE',
      nextTurnOrderOrdinal: 2,
      version: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    participants: [
      {
        encounterId,
        round: 1,
        actorId: actorA,
        sideId: sideA,
        status: currentActorId === null ? 'READY' : 'ACTED',
        initiativeScore: 20,
        evaluation: { occurrenceId: null, resultChecksum: null },
        tie: { occurrenceId: null, resultChecksum: null },
        declaration: null,
        declarationChecksum: null,
        turnOrderOrdinal: 0,
        version: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        encounterId,
        round: 1,
        actorId: actorB,
        sideId: sideB,
        status: currentActorId === null ? 'READY' : 'ACTIVE',
        initiativeScore: 10,
        evaluation: { occurrenceId: null, resultChecksum: null },
        tie: { occurrenceId: null, resultChecksum: null },
        declaration: null,
        declarationChecksum: null,
        turnOrderOrdinal: 1,
        version: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    sides: [
      {
        encounterId,
        round: 1,
        sideId: sideA,
        status: currentActorId === null ? 'READY' : 'COMPLETED',
        initiativeScore: 20,
        evaluation: { occurrenceId: null, resultChecksum: null },
        tie: { occurrenceId: null, resultChecksum: null },
        sideOrderOrdinal: 0,
        version: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        encounterId,
        round: 1,
        sideId: sideB,
        status: currentActorId === null ? 'READY' : 'ACTIVE',
        initiativeScore: 10,
        evaluation: { occurrenceId: null, resultChecksum: null },
        tie: { occurrenceId: null, resultChecksum: null },
        sideOrderOrdinal: 1,
        version: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ]
  })
}

describe('validateInitiativeCursor', () => {
  it('accepts cleared and side-roll cursor snapshots, and rejects mismatched active rows', () => {
    const allowedSideIds = [sideA, sideB]
    expect(() =>
      validateInitiativeCursor({
        state: state(null),
        currentActorId: null,
        actorIds: [actorA, actorB],
        allowedSideIds
      })
    ).not.toThrow()
    expect(() =>
      validateInitiativeCursor({
        state: state(actorB),
        currentActorId: actorB,
        actorIds: [actorA, actorB],
        allowedSideIds
      })
    ).not.toThrow()
    expect(() =>
      validateInitiativeCursor({
        state: state(actorB),
        currentActorId: actorA,
        actorIds: [actorA, actorB],
        allowedSideIds
      })
    ).toThrow('current Encounter actor')
    const reversed = state(actorB)
    for (const participant of reversed.participants)
      participant.sideId = participant.sideId === sideA ? sideB : sideA
    for (const side of reversed.sides) side.sideId = side.sideId === sideA ? sideB : sideA
    reversed.sides.sort((a, b) => a.sideId.localeCompare(b.sideId))
    expect(() =>
      validateInitiativeCursor({
        state: reversed,
        currentActorId: actorB,
        actorIds: [actorA, actorB],
        allowedSideIds
      })
    ).not.toThrow()
  })
})

describe('native initiative corrections', () => {
  it('rewinds, clears, reselects, and revisits a manually-settled round without new rolls', async () => {
    const base = await fixture()
    const campaign = await base.owner.caller.mutation(createCampaign, {
      name: 'Manual correction',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    const settings = await base.owner.caller.query(getPlaySettings, { campaignId: campaign.id })
    const { version, updatedAt: _updatedAt, ...settingsFields } = settings
    await base.owner.caller.mutation(savePlaySettings, {
      ...settingsFields,
      expectedVersion: version,
      automationMode: 'MANUAL',
      manualReminderMode: 'OFF',
      initiativePolicyDefinitionId: null,
      initiativeTieDefinitionId: null
    })
    const blueprint = await base.owner.caller.mutation(createBlueprint, {
      gameSystemId: campaign.gameSystemId,
      name: 'Two actors',
      commandId: crypto.randomUUID(),
      enemies: [
        { kind: 'CUSTOM', label: 'First', maxHitPoints: 1 },
        { kind: 'CUSTOM', label: 'Second', maxHitPoints: 1 }
      ]
    })
    const run = await base.owner.caller.mutation(createRun, {
      campaignId: campaign.id,
      blueprintId: blueprint.id,
      commandId: crypto.randomUUID()
    })
    const [first, second] = [...run.actors].sort((left, right) => right.id.localeCompare(left.id))
    if (!first || !second) throw new Error('Missing correction fixture actors.')
    let versionCursor = 0
    for (const [actor, initiative, manualOrder] of [
      [first, 20, 0],
      [second, 10, 1]
    ] as const) {
      await executeInRoom(base.owner.caller, {
        command: {
          type: 'SET_INITIATIVE',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: versionCursor++,
          actorId: actor.id,
          initiative,
          manualOrder
        }
      })
    }
    let result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: versionCursor++
      }
    })
    expect(result.projection.currentActorId).toBe(first.id)
    const capture = () =>
      base.t.run(async (ctx) => ({
        runs: await ctx.db.query('encounterRuns').collect(),
        actors: await ctx.db.query('encounterRunActors').collect(),
        rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
        participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
        sides: await ctx.db.query('encounterInitiativeSides').collect(),
        commands: await ctx.db.query('encounterRunCommands').collect(),
        occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
        ruleReceipts: await ctx.db.query('encounterRuleReceipts').collect()
      }))
    const beforeCorrection = await capture()
    const correction: EncounterExecuteInput = {
      command: {
        type: 'SET_CURRENT_ACTOR',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: versionCursor,
        actorId: second.id
      }
    }
    await expect(
      base.owner.caller.run(async (ctx) => {
        await ctx.runMutation(execute, correction)
        throw new Error('Injected correction rollback')
      })
    ).rejects.toThrow('Injected correction rollback')
    expect(await capture()).toEqual(beforeCorrection)
    const pendingId = await base.t.run((ctx) =>
      ctx.db.insert('encounterRuleOccurrences', {
        id: crypto.randomUUID(),
        campaignId: campaign.id,
        encounterId: run.id,
        rootCommandId: crypto.randomUUID(),
        state: 'PENDING',
        version: 0,
        expectedEncounterVersion: versionCursor,
        pendingSnapshotChecksum: '0'.repeat(64),
        completedAt: null,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt
      })
    )
    const beforePending = await capture()
    await expect(executeInRoom(base.owner.caller, correction)).rejects.toThrow()
    expect(await capture()).toEqual(beforePending)
    await base.t.run((ctx) => ctx.db.delete(pendingId))
    const participant = beforeCorrection.participants[0]!
    await base.t.run((ctx) => ctx.db.patch(participant._id, { turnOrderOrdinal: 999 }))
    const corruptCursor = await capture()
    await expect(executeInRoom(base.owner.caller, correction)).rejects.toThrow()
    expect(await capture()).toEqual(corruptCursor)
    await base.t.run((ctx) =>
      ctx.db.patch(participant._id, { turnOrderOrdinal: participant.turnOrderOrdinal })
    )
    const setRound: EncounterExecuteInput = {
      command: {
        type: 'SET_ROUND',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: versionCursor++,
        round: 2
      }
    }
    result = await executeInRoom(base.owner.caller, setRound)
    const setRoundResult = result
    expect(result.projection).toMatchObject({ round: 2, currentActorId: first.id })
    result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'SET_CURRENT_ACTOR',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: versionCursor++,
        actorId: second.id
      }
    })
    result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'PREVIOUS_TURN',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: versionCursor++
      }
    })
    expect(result.projection).toMatchObject({ round: 2, currentActorId: first.id })
    result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'PREVIOUS_TURN',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: versionCursor++
      }
    })
    expect(result.projection).toMatchObject({ round: 1, currentActorId: second.id })
    result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'SET_CURRENT_ACTOR',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: versionCursor++,
        actorId: null
      }
    })
    expect(result.projection.currentActorId).toBeNull()
    await expect(
      executeInRoom(base.owner.caller, {
        command: {
          type: 'ADVANCE_TURN',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: versionCursor
        }
      })
    ).rejects.toThrow('current actor can advance')
    result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'SET_CURRENT_ACTOR',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: versionCursor++,
        actorId: second.id
      }
    })
    result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: versionCursor++
      }
    })
    expect(result.projection).toMatchObject({ round: 2, currentActorId: first.id })
    await expect(
      executeInRoom(base.other.caller, {
        command: {
          type: 'SET_CURRENT_ACTOR',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: versionCursor,
          actorId: first.id
        }
      })
    ).rejects.toThrow()
    await expect(
      executeInRoom(base.owner.caller, {
        command: {
          type: 'SET_CURRENT_ACTOR',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 0,
          actorId: first.id
        }
      })
    ).rejects.toThrow('Encounter version is stale')
    const replayedSetRound = { ...setRoundResult, projection: result.projection }
    await expect(replayInRoom(base.owner.caller, setRound)).resolves.toEqual(replayedSetRound)
    await expect(
      replayInRoom(base.owner.caller, {
        command: {
          ...setRound.command,
          commandId: setRound.command.commandId.toUpperCase(),
          encounterId: run.id.toUpperCase()
        }
      })
    ).resolves.toEqual(replayedSetRound)
    await expect(
      executeInRoom(base.owner.caller, {
        command: {
          type: 'SET_ROUND',
          encounterId: run.id,
          commandId: setRound.command.commandId,
          expectedVersion: versionCursor,
          round: 9
        }
      })
    ).rejects.toThrow('Command ID was already used with different input.')
    const correctionReceipt = (await capture()).commands.find(
      (command) => command.commandId === setRound.command.commandId
    )
    if (!correctionReceipt || correctionReceipt.commandType !== 'SET_ROUND')
      throw new Error('Missing correction receipt')
    await base.t.run((ctx) =>
      ctx.db.patch(correctionReceipt._id, { initiativeStateChecksum: '0'.repeat(64) })
    )
    await expect(executeInRoom(base.owner.caller, setRound)).rejects.toThrow(LiveSessionRouteError)
    await base.t.run((ctx) =>
      ctx.db.patch(correctionReceipt._id, {
        initiativeStateChecksum: correctionReceipt.initiativeStateChecksum
      })
    )
    result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'COMPLETE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: versionCursor++
      }
    })
    expect(result.projection).toMatchObject({ status: 'COMPLETED', currentActorId: null })
    await expect(
      executeInRoom(base.owner.caller, {
        command: {
          type: 'SET_ROUND',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: versionCursor,
          round: 3
        }
      })
    ).rejects.toThrow('Completed Encounters are read-only')
    const stored = await base.t.run(async (ctx) => ({
      commands: await ctx.db.query('encounterRunCommands').collect(),
      rounds: await ctx.db.query('encounterInitiativeRounds').collect()
    }))
    const corrections = stored.commands.filter((command) =>
      ['PREVIOUS_TURN', 'SET_CURRENT_ACTOR', 'SET_ROUND'].includes(command.commandType)
    )
    expect(corrections).toHaveLength(6)
    expect(corrections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          initiativeStateChecksum: expect.stringMatching(/^[a-f0-9]{64}$/)
        })
      ])
    )
    expect(stored.rounds).toHaveLength(2)
    for (const command of corrections) {
      if (
        command.commandType !== 'SET_ROUND' &&
        command.commandType !== 'SET_CURRENT_ACTOR' &&
        command.commandType !== 'PREVIOUS_TURN'
      )
        throw new Error('Wrong correction command')
      expect(checksumCanonicalJson(JSON.parse(command.initiativeStateJson))).toBe(
        command.initiativeStateChecksum
      )
    }
    const afterCorrection = await capture()
    expect(afterCorrection.actors).toEqual(beforeCorrection.actors)
    expect(
      afterCorrection.ruleReceipts.some((receipt) =>
        ['SET_ROUND', 'SET_CURRENT_ACTOR', 'PREVIOUS_TURN'].includes(receipt.commandType)
      )
    ).toBe(false)
  }, 30000)
})
