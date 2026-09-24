import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { api } from '../_generated/api'
import type {
  EncounterCommandResultDto,
  EncounterExecuteInput,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { reinforceEncounterActors } from './actorReinforcementCommand'

const execute = makeFunctionReference<'mutation', EncounterExecuteInput, EncounterCommandResultDto>(
  'encounters/commands:execute'
)
async function manualFixture() {
  const base = await setupCharacterRun()
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
    automationMode: 'MANUAL',
    initiativePolicyDefinitionId: null,
    initiativeTieDefinitionId: null,
    manualReminderMode: 'OFF'
  })
  const blueprint = await base.owner.caller.mutation(api.encounters.blueprints.create, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Reinforcement initiative fixture',
    commandId: crypto.randomUUID(),
    enemies: ['First', 'Second', 'Third'].map((label) => ({
      kind: 'CUSTOM' as const,
      label,
      maxHitPoints: 3
    }))
  })
  let projection = (await base.owner.caller.mutation(api.encounters.runs.create, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })) as EncounterGmProjectionDto
  const executeCommand = async (command: EncounterExecuteInput['command']) => {
    const result = await base.owner.caller.mutation(execute, { command })
    projection = result.projection as EncounterGmProjectionDto
    return result
  }
  return { ...base, executeCommand, projection: () => projection }
}
async function capture(base: Awaited<ReturnType<typeof setupCharacterRun>>) {
  return base.t.run(async (ctx) => ({
    runs: await ctx.db.query('encounterRuns').collect(),
    actors: await ctx.db.query('encounterRunActors').collect(),
    commands: await ctx.db.query('encounterRunCommands').collect(),
    rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
    participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
    sides: await ctx.db.query('encounterInitiativeSides').collect()
  }))
}

describe('native actor reinforcement transaction', () => {
  it('adds a prepared custom actor to the default Opposition side and replays the sealed actor snapshot', async () => {
    const base = await setupCharacterRun()
    const command = {
      type: 'REINFORCE' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.run.version,
      enemy: { kind: 'CUSTOM' as const, label: 'Late scout', maxHitPoints: 7 },
      public: false
    }
    const before = await capture(base)
    await expect(base.player.caller.mutation(execute, { command })).rejects.toThrow()
    expect(await capture(base)).toEqual(before)
    const result = await base.owner.caller.mutation(execute, { command })
    const actor = result.projection.actors.find((candidate) => candidate.label === 'Late scout')
    expect(actor).toMatchObject({
      kind: 'CUSTOM',
      sourceId: null,
      sourceRevision: null,
      currentHitPoints: 7,
      maxHitPoints: 7,
      tempHitPoints: 0,
      public: false
    })
    const stored = await capture(base)
    expect(stored.actors).toHaveLength(before.actors.length + 1)
    expect(stored.commands.some((entry) => entry.commandId === command.commandId)).toBe(true)
    await base.owner.caller
      .mutation(execute, {
        command: {
          ...command,
          encounterId: command.encounterId.toUpperCase(),
          commandId: command.commandId.toUpperCase()
        }
      })
      .then((replay) => expect(replay).toEqual(result))
    expect(await capture(base)).toEqual(stored)
  }, 30_000)

  it('rejects stale versions and pending occurrences without writes', async () => {
    const base = await setupCharacterRun()
    const command = {
      type: 'REINFORCE' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: 99,
      public: true,
      enemy: { kind: 'CUSTOM' as const, label: 'Late scout', maxHitPoints: 7 }
    }
    const before = await capture(base)
    await expect(base.owner.caller.mutation(execute, { command })).rejects.toThrow(
      'version is stale'
    )
    expect(await capture(base)).toEqual(before)
    await base.t.run(async (ctx) => {
      await ctx.db.insert('encounterRuleOccurrences', {
        id: crypto.randomUUID(),
        campaignId: base.campaign.id,
        encounterId: base.run.id,
        rootCommandId: crypto.randomUUID(),
        state: 'PENDING',
        version: 0,
        expectedEncounterVersion: base.run.version,
        pendingSnapshotJson: '{}',
        pendingSnapshotChecksum: 'a'.repeat(64),
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    })
    const pending = await capture(base)
    await expect(
      base.owner.caller.mutation(execute, {
        command: {
          ...command,
          expectedVersion: base.run.version,
          commandId: crypto.randomUUID()
        }
      })
    ).rejects.toThrow('pending Encounter occurrence')
    expect(await capture(base)).toEqual(pending)
  }, 30_000)
  it('inserts before and after the current actor while preserving settled manual participants', async () => {
    const base = await manualFixture()
    for (const [index, actor] of base.projection().actors.entries()) {
      await base.executeCommand({
        type: 'SET_INITIATIVE',
        encounterId: base.projection().id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.projection().version,
        actorId: actor.id,
        initiative: 30 - index,
        manualOrder: index
      })
    }
    await base.executeCommand({
      type: 'START',
      encounterId: base.projection().id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.projection().version
    })
    await base.executeCommand({
      type: 'ADVANCE_TURN',
      encounterId: base.projection().id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.projection().version
    })
    const before = await capture(base)
    const beforeRows = before.participants
      .filter((row) => row.encounterId === base.projection().id && row.round === 1)
      .sort((left, right) => left.turnOrderOrdinal! - right.turnOrderOrdinal!)
    const beforeCurrentActorId = base.projection().currentActorId
    const first = await base.executeCommand({
      type: 'REINFORCE',
      encounterId: base.projection().id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.projection().version,
      enemy: { kind: 'CUSTOM', label: 'Before current', maxHitPoints: 5 },
      initiative: 35,
      public: true
    })
    expect(first.projection.currentActorId).toBe(beforeCurrentActorId)
    const second = await base.executeCommand({
      type: 'REINFORCE',
      encounterId: base.projection().id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.projection().version,
      enemy: { kind: 'CUSTOM', label: 'After current', maxHitPoints: 5 },
      initiative: 26,
      public: true
    })
    const after = await capture(base)
    const afterRows = after.participants
      .filter((row) => row.encounterId === base.projection().id && row.round === 1)
      .sort((left, right) => left.turnOrderOrdinal! - right.turnOrderOrdinal!)
    expect(afterRows.map((row) => row.actorId).slice(1, -1)).toEqual(
      beforeRows.map((row) => row.actorId)
    )
    for (const prior of beforeRows) {
      const current = afterRows.find((row) => row.actorId === prior.actorId)
      expect(current).toMatchObject({
        status: prior.status,
        initiativeScore: prior.initiativeScore,
        evaluation: prior.evaluation,
        tie: prior.tie,
        declaration: prior.declaration
      })
    }
    expect(afterRows[0]).toMatchObject({
      status: 'ACTED',
      initiativeScore: 35
    })
    expect(afterRows.at(-1)).toMatchObject({
      status: 'READY',
      initiativeScore: 26
    })
    expect(base.projection().currentActorId).toBe(beforeCurrentActorId)
    expect(
      second.projection.actors
        .map((actor) => actor.manualOrder)
        .sort((left, right) => left! - right!)
    ).toEqual([0, 1, 2, 3, 4, 5])
    while (base.projection().round === 1) {
      await base.executeCommand({
        type: 'ADVANCE_TURN',
        encounterId: base.projection().id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.projection().version
      })
    }
    const nextRound = (await capture(base)).participants.find(
      (row) =>
        row.encounterId === base.projection().id && row.round === 2 && row.initiativeScore === 35
    )
    expect(nextRound).toBeDefined()
    expect(nextRound?.status).not.toBe('ACTED')
  }, 60_000)

  it('rejects a tampered retained reinforcement actor snapshot and rolls back an injected post-write failure', async () => {
    const base = await setupCharacterRun()
    const command = {
      type: 'REINFORCE' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.run.version,
      enemy: {
        kind: 'CUSTOM' as const,
        label: 'Receipt guard',
        maxHitPoints: 5
      },
      public: true
    }
    const result = await base.owner.caller.mutation(execute, { command })
    await base.t.run(async (ctx) => {
      const receipt = await ctx.db
        .query('encounterRunCommands')
        .withIndex('by_campaignId_commandId', (query) =>
          query.eq('campaignId', base.campaign.id).eq('commandId', command.commandId)
        )
        .unique()
      if (!receipt || receipt.commandType !== 'REINFORCE')
        throw new Error('Missing reinforcement receipt.')
      await ctx.db.patch(receipt._id, {
        reinforcedActorStateChecksum: 'b'.repeat(64)
      })
    })
    const tampered = await capture(base)
    await expect(base.owner.caller.mutation(execute, { command })).rejects.toThrow(
      'receipt mismatch'
    )
    expect(await capture(base)).toEqual(tampered)
    const rollback = {
      ...command,
      commandId: crypto.randomUUID(),
      expectedVersion: result.projection.version
    }
    const before = await capture(base)
    await expect(
      base.t.run(async (ctx) => {
        await reinforceEncounterActors(ctx, rollback, base.owner.userId)
        throw new Error('Abort after reinforcement projection')
      })
    ).rejects.toThrow('Abort after reinforcement projection')
    expect(await capture(base)).toEqual(before)
  }, 30_000)
})
