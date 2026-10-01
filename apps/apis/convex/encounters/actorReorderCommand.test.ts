import { replaceReceiptRecord } from '../../tests/fixtures/receiptRecords'
import { readReceiptHeaders, readReceiptHeader } from '../lib/receiptLedgers'
import { describe, expect, it } from 'vitest'
import type {
  EncounterCommandInputDto,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { api, internal } from '../_generated/api'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import { setAutoRollDice, type FixtureRolls } from '../../tests/fixtures/rollPreferences'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { executeInRoom, replayInRoom } from '../../tests/fixtures/liveSessionWorker'
import { LiveSessionRouteError } from '../../../session-worker/src/liveSessionRoutes'

async function fixture(mode: 'MANUAL' | FixtureRolls = 'MANUAL') {
  const base = await setupCharacterRun()
  if (mode === 'PROMPT') await setAutoRollDice(base.t, base.owner.userId, false)
  let definitionId: string | null = null
  if (mode !== 'MANUAL') {
    const { definitions, policyIds } = createEncounterInitiativeDefinitions([
      { cadence: 'ENCOUNTER_START', procedure: mode === 'AUTO_ROLL' ? 'SIDE_ROLL' : 'ACTOR_ROLL' }
    ])
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions
    })
    definitionId = policyIds[0]!
  }
  const {
    version,
    updatedAt: _updatedAt,
    ...settings
  } = await base.owner.caller.query(api.campaigns.playSettings.get, {
    campaignId: base.campaign.id
  })
  await base.owner.caller.mutation(api.campaigns.playSettings.save, {
    ...settings,
    expectedVersion: version,
    automationMode: mode === 'MANUAL' ? 'MANUAL' : 'ASSISTED',
    initiativePolicyDefinitionId: definitionId,
    initiativeTieDefinitionId: null,
    manualReminderMode: 'OFF'
  })
  const blueprint = await base.owner.caller.mutation(api.encounters.blueprints.create, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Reorder proof',
    commandId: crypto.randomUUID(),
    enemies: ['First', 'Second', 'Third'].map((label) => ({
      kind: 'CUSTOM' as const,
      label,
      maxHitPoints: 3
    }))
  })
  let projection = await base.owner.caller.mutation(api.encounters.runs.create, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const execute = async (
    details: Omit<
      Extract<EncounterCommandInputDto, { type: 'REORDER' }>,
      'commandId' | 'encounterId' | 'expectedVersion'
    >
  ) => {
    const request = {
      command: {
        ...details,
        encounterId: projection.id,
        commandId: crypto.randomUUID(),
        expectedVersion: projection.version
      }
    }
    const result = await executeInRoom(base.owner.caller, request)
    projection = result.projection as EncounterGmProjectionDto
    return { request, result }
  }
  const start = async () => {
    if (mode === 'MANUAL') {
      for (const [index, actor] of projection.actors.entries()) {
        const result = await executeInRoom(base.owner.caller, {
          command: {
            type: 'SET_INITIATIVE',
            encounterId: projection.id,
            commandId: crypto.randomUUID(),
            expectedVersion: projection.version,
            actorId: actor.id,
            initiative: 30 - index
          }
        })
        projection = result.projection as EncounterGmProjectionDto
      }
    }
    let result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: projection.id,
        commandId: crypto.randomUUID(),
        expectedVersion: projection.version
      }
    })
    if (mode === 'AUTO_ROLL') {
      for (let count = 0; result.occurrence?.status === 'PENDING'; count++) {
        if (count >= 8) throw new Error('Side fixture failed to settle')
        const pending = result.occurrence.pending
        if (!pending || pending.kind !== 'INITIATIVE_ORDER' || !pending.optionIds[0])
          throw new Error('Unexpected automatic side decision')
        result = await executeInRoom(base.owner.caller, {
          command: {
            type: 'RESOLVE_RULE_OCCURRENCE',
            encounterId: projection.id,
            commandId: crypto.randomUUID(),
            expectedVersion: projection.version,
            correlationId: null,
            occurrenceId: result.occurrence.occurrenceId,
            expectedOccurrenceVersion: result.occurrence.occurrenceVersion,
            resolution: {
              kind: 'INITIATIVE_ENTITY',
              requestId: pending.requestId,
              entityId: pending.optionIds[0]
            }
          }
        })
      }
    }
    projection = result.projection as EncounterGmProjectionDto
    return result
  }
  const advance = async () => {
    const result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: projection.id,
        commandId: crypto.randomUUID(),
        expectedVersion: projection.version
      }
    })
    projection = result.projection as EncounterGmProjectionDto
  }
  const capture = () =>
    base.t.run(async (ctx) => ({
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      runs: await ctx.db.query('encounterRuns').collect(),
      actors: await ctx.db.query('encounterRunActors').collect(),
      rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
      participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
      sides: await ctx.db.query('encounterInitiativeSides').collect(),
      commands: await ctx.db
        .query('encounterRunCommands')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers)),
      occurrences: await ctx.db.query('encounterRuleOccurrences').collect()
    }))
  return { ...base, execute, start, advance, capture, projection: () => projection }
}

describe('native Encounter reorder', () => {
  it('reads complete current side bindings for the owner only and refuses a stale UI version', async () => {
    const base = await fixture()
    const input = { encounterId: base.projection().id, expectedVersion: base.projection().version }
    const before = await base.capture()
    const sides = await base.owner.caller.query(api.encounters.projectionReads.actorSides, input)
    expect(sides?.actors.map((actor) => actor.id).sort()).toEqual(
      base
        .projection()
        .actors.map((actor) => actor.id)
        .sort()
    )
    expect(new Set(sides?.actors.map((actor) => actor.sideId)).size).toBe(2)
    expect(sides?.sides.map((side) => side.label)).toEqual(['Party', 'Opposition'])
    expect(
      sides?.actors.every((actor) => sides.sides.some((side) => side.id === actor.sideId))
    ).toBe(true)
    expect(
      await base.owner.caller.query(api.encounters.projectionReads.actorSides, {
        ...input,
        encounterId: input.encounterId.toUpperCase()
      })
    ).toEqual(sides)
    expect(
      await base.owner.caller.query(api.encounters.projectionReads.actorSides, {
        ...input,
        expectedVersion: 99
      })
    ).toBeNull()
    await expect(
      base.player.caller.query(api.encounters.projectionReads.actorSides, input)
    ).rejects.toThrow('Campaign not found')
    expect(await base.capture()).toEqual(before)
  }, 30_000)

  it('reorders prepared actors, replays its receipt, and rejects altered receipt/input', async () => {
    const base = await fixture()
    const actorIds = base
      .projection()
      .actors.map((actor) => actor.id)
      .reverse()
    const { request, result } = await base.execute({ type: 'REORDER', actorIds })
    expect(result.projection.actors.map((actor) => actor.id)).toEqual(actorIds)
    const later = await base.execute({ type: 'REORDER', actorIds: [...actorIds].reverse() })
    const beforeReplay = await base.capture()
    expect(await replayInRoom(base.owner.caller, request)).toEqual({
      ...result,
      projection: later.result.projection
    })
    expect(await base.capture()).toEqual(beforeReplay)
    await expect(
      executeInRoom(base.owner.caller, {
        command: { ...request.command, actorIds: [...actorIds].reverse() }
      })
    ).rejects.toThrow('Command ID was already used with different input.')
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunCommands')
        .withIndex('by_campaignId_commandId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('commandId', request.command.commandId)
        )
        .unique()
        .then((header) => (header ? readReceiptHeader(ctx, 'encounterRunCommands', header) : null))
      if (!row || row.commandType !== 'REORDER') throw new Error('Missing reorder receipt')
      await replaceReceiptRecord(ctx, 'encounterRunCommands', row._id, {
        replayReceiptChecksum: 'a'.repeat(64)
      })
    })
    const corrupt = await base.capture()
    await expect(executeInRoom(base.owner.caller, request)).rejects.toThrow(LiveSessionRouteError)
    expect(await base.capture()).toEqual(corrupt)
  }, 30_000)

  it('changes remaining turns immediately while preserving current/completed turns, scores and older rounds', async () => {
    const base = await fixture()
    await base.start()
    for (let turn = 0; turn < 4; turn++) await base.advance()
    await base.advance()
    const before = await base.capture()
    const ids = base.projection().actors.map((actor) => actor.id)
    const actorIds = [ids[0]!, ids[1]!, ids[3]!, ids[2]!]
    const current = base.projection().currentActorId
    await base.execute({ type: 'REORDER', actorIds })
    expect(base.projection().currentActorId).toBe(current)
    const after = await base.capture()
    expect(
      after.rounds.filter((row) => row.encounterId === base.projection().id && row.round === 1)
    ).toEqual(
      before.rounds.filter((row) => row.encounterId === base.projection().id && row.round === 1)
    )
    expect(
      after.participants.filter(
        (row) => row.encounterId === base.projection().id && row.round === 1
      )
    ).toEqual(
      before.participants.filter(
        (row) => row.encounterId === base.projection().id && row.round === 1
      )
    )
    const currentRows = after.participants
      .filter((row) => row.encounterId === base.projection().id && row.round === 2)
      .sort((a, b) => a.turnOrderOrdinal! - b.turnOrderOrdinal!)
    expect(currentRows.map((row) => row.actorId)).toEqual(actorIds)
    expect(currentRows.map((row) => row.status)).toEqual(['ACTED', 'ACTIVE', 'READY', 'READY'])
    for (const row of currentRows) {
      const prior = before.participants.find(
        (candidate) => candidate.actorId === row.actorId && candidate.round === 2
      )!
      expect({
        score: row.initiativeScore,
        evaluation: row.evaluation,
        tie: row.tie,
        declaration: row.declaration
      }).toEqual({
        score: prior.initiativeScore,
        evaluation: prior.evaluation,
        tie: prior.tie,
        declaration: prior.declaration
      })
    }
    await base.advance()
    expect(base.projection().currentActorId).toBe(actorIds[2])
  }, 30_000)

  it('rejects missing/duplicate/outsider cohorts, stale versions, unauthorized callers and current-turn movement atomically', async () => {
    const base = await fixture()
    await base.start()
    const ids = base.projection().actors.map((actor) => actor.id)
    const before = await base.capture()
    const request = {
      command: {
        type: 'REORDER' as const,
        actorIds: ids,
        encounterId: base.projection().id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.projection().version
      }
    }
    for (const actorIds of [
      ids.slice(1),
      [ids[0]!, ids[0]!, ...ids.slice(2)],
      [...ids.slice(0, -1), crypto.randomUUID()],
      [ids[1]!, ids[0]!, ...ids.slice(2)]
    ]) {
      await expect(
        executeInRoom(base.owner.caller, {
          command: { ...request.command, actorIds }
        })
      ).rejects.toThrow(LiveSessionRouteError)
      expect(await base.capture()).toEqual(before)
    }
    await expect(executeInRoom(base.player.caller, request)).rejects.toMatchObject({
      data: { reason: 'GM_ONLY', message: 'Only the GM can do that.' }
    })
    await expect(
      executeInRoom(base.owner.caller, {
        command: { ...request.command, expectedVersion: request.command.expectedVersion - 1 }
      })
    ).rejects.toThrow(/stale/)
    expect(await base.capture()).toEqual(before)
  }, 30_000)

  it('preserves contiguous SIDE_ROLL order and refuses a pending Assisted decision', async () => {
    const side = await fixture('AUTO_ROLL')
    const result = await side.start()
    expect(result.occurrence?.status).not.toBe('PENDING')
    const ids = side.projection().actors.map((actor) => actor.id)
    const capture = await side.capture()
    const currentRows = capture.participants
      .filter((row) => row.encounterId === side.projection().id)
      .sort((a, b) => a.turnOrderOrdinal! - b.turnOrderOrdinal!)
    expect(ids).toEqual(currentRows.map((row) => row.actorId))
    const sameSide = currentRows.filter((row) => row.sideId === currentRows[0]!.sideId)
    if (sameSide.length > 1) {
      const actorIds = [
        ids[0]!,
        ...ids.slice(1, sameSide.length).reverse(),
        ...ids.slice(sameSide.length)
      ]
      await side.execute({ type: 'REORDER', actorIds })
      expect(side.projection().actors.map((actor) => actor.id)).toEqual(actorIds)
    } else {
      await side.execute({ type: 'REORDER', actorIds: [ids[0]!, ...ids.slice(1).reverse()] })
    }
    const assisted = await fixture('PROMPT')
    const pending = await assisted.start()
    expect(pending.occurrence?.status).toBe('PENDING')
    const before = await assisted.capture()
    await expect(
      assisted.execute({
        type: 'REORDER',
        actorIds: assisted.projection().actors.map((actor) => actor.id)
      })
    ).rejects.toThrow(LiveSessionRouteError)
    expect(await assisted.capture()).toEqual(before)
    expect(checksumCanonicalJson(before)).toBe(checksumCanonicalJson(await assisted.capture()))
  }, 60_000)
})
