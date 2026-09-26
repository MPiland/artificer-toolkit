import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  EncounterExecuteInput,
  EncounterCommandResultDto,
  EncounterGmProjectionDto,
  CreateEncounterInputDto,
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  CampaignPlaySettingsDto,
  SaveCampaignPlaySettingsInput
} from '@artificer-toolkit/schema/api/campaignSettings'
import type {
  CampaignSessionDto,
  FinishCampaignSessionInput
} from '@artificer-toolkit/schema/api/campaignSessions'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import { setAutoRollDice, type FixtureRolls } from '../../tests/fixtures/rollPreferences'
import { internal } from '../_generated/api'
import { readRunActors, readRunState } from './documents'
import { removeAccountCharacterActors, removeEncounterActor } from './actorRemovalCommand'
import { executeInRoom, replayInRoom } from '../../tests/fixtures/liveSessionWorker'
import { LiveSessionRouteError } from '../../../session-worker/src/liveSessionRoutes'

const execute = makeFunctionReference<'mutation', EncounterExecuteInput, EncounterCommandResultDto>(
  'encounters/commands:execute'
)
const getSettings = makeFunctionReference<'query', { campaignId: string }, CampaignPlaySettingsDto>(
  'campaigns/playSettings:get'
)
const saveSettings = makeFunctionReference<
  'mutation',
  SaveCampaignPlaySettingsInput,
  CampaignPlaySettingsDto
>('campaigns/playSettings:save')
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
const createSession = makeFunctionReference<'mutation', { campaignId: string }, CampaignSessionDto>(
  'campaigns/sessions:create'
)
const finishSession = makeFunctionReference<
  'mutation',
  FinishCampaignSessionInput,
  CampaignSessionDto
>('campaigns/sessionFinish:finish')

async function setup(mode: 'MANUAL' | FixtureRolls = 'MANUAL') {
  const base = await setupCharacterRun()
  if (mode === 'PROMPT') await setAutoRollDice(base.t, base.owner.userId, false)
  let initiativePolicyDefinitionId: string | null = null
  if (mode !== 'MANUAL') {
    const { definitions, policyIds } = createEncounterInitiativeDefinitions([
      { cadence: 'ENCOUNTER_START', procedure: mode === 'AUTO_ROLL' ? 'SIDE_ROLL' : 'ACTOR_ROLL' }
    ])
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions
    })
    initiativePolicyDefinitionId = policyIds[0]!
  }
  const {
    version,
    updatedAt: _updatedAt,
    ...settings
  } = await base.owner.caller.query(getSettings, { campaignId: base.campaign.id })
  await base.owner.caller.mutation(saveSettings, {
    ...settings,
    expectedVersion: version,
    automationMode: mode === 'MANUAL' ? 'MANUAL' : 'ASSISTED',
    initiativePolicyDefinitionId,
    initiativeTieDefinitionId: null,
    ...(mode === 'MANUAL'
      ? {
          manualReminderMode: 'OFF',
          initiativePolicyDefinitionId: null,
          initiativeTieDefinitionId: null
        }
      : {})
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Actor removal',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CUSTOM', label: 'First', maxHitPoints: 3 },
      { kind: 'CUSTOM', label: 'Second', maxHitPoints: 3 }
    ]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  return { ...base, run }
}

type Fixture = Awaited<ReturnType<typeof setup>>
async function capture(base: Fixture) {
  return base.t.run(async (ctx) => ({
    runs: await ctx.db.query('encounterRuns').collect(),
    actors: await ctx.db.query('encounterRunActors').collect(),
    rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
    participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
    sides: await ctx.db.query('encounterInitiativeSides').collect(),
    commands: await ctx.db.query('encounterRunCommands').collect(),
    occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
    receipts: await ctx.db.query('encounterRuleReceipts').collect(),
    bindings: await ctx.db.query('encounterActorTokenBindings').collect(),
    sceneBindings: await ctx.db.query('encounterSceneBindings').collect(),
    characters: await ctx.db.query('characters').collect(),
    characterReceipts: await ctx.db.query('characterCommandReceipts').collect(),
    effects: await ctx.db.query('encounterActiveRuleEffects').collect(),
    characterEffects: await ctx.db.query('characterActiveRuleEffects').collect(),
    states: await ctx.db.query('encounterMaintainedEffectStates').collect()
  }))
}

describe('native actor removal transaction', () => {
  it('removes prepared actors and exact bindings/reminders, preserves Scene identity, and replays historically with current authority', async () => {
    const base = await setup()
    const actor = base.run.actors.find((candidate) => candidate.kind === 'CUSTOM')!
    const other = base.run.actors.find((candidate) => candidate.id !== actor.id)!
    let version = base.run.version
    for (const actorId of [actor.id, other.id, null]) {
      await executeInRoom(base.owner.caller, {
        command: {
          type: 'UPSERT_REMINDER',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: version++,
          reminder: {
            actorId,
            label: 'Keep exact scope',
            timing: actorId === null ? 'ROUND_START' : 'TURN_START',
            round: null,
            public: false,
            notes: null,
            order: 0
          }
        }
      })
    }
    const sceneId = crypto.randomUUID()
    const tokenId = crypto.randomUUID()
    await base.t.run(async (ctx) => {
      await ctx.db.insert('encounterSceneBindings', {
        encounterId: base.run.id,
        campaignId: base.campaign.id,
        sceneId,
        commandId: crypto.randomUUID(),
        commandFingerprint: 'a'.repeat(64),
        createdAt: new Date().toISOString()
      })
      await ctx.db.insert('encounterActorTokenBindings', {
        encounterId: base.run.id,
        actorId: actor.id,
        sceneId,
        tokenId
      })
      await ctx.db.insert('encounterActorTokenBindings', {
        encounterId: base.run.id,
        actorId: other.id,
        sceneId,
        tokenId: crypto.randomUUID()
      })
    })
    const command = {
      type: 'REMOVE_ACTOR' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: version,
      actorId: actor.id
    }
    const before = await capture(base)
    await expect(executeInRoom(base.player.caller, { command })).rejects.toThrow()
    await expect(executeInRoom(base.t, { command })).rejects.toThrow('Unauthenticated')
    await expect(
      base.player.caller.run(async (ctx) => {
        const membership = await ctx.db
          .query('campaignMemberships')
          .withIndex('by_campaignId_userId', (q) =>
            q.eq('campaignId', base.campaign.id).eq('userId', base.player.userId)
          )
          .unique()
        if (!membership) throw new Error('Missing player membership fixture.')
        await ctx.db.delete(membership._id)
        await expect(ctx.runMutation(execute, { command })).rejects.toThrow('Campaign not found')
        throw new Error('Restore the authenticated outsider fixture')
      })
    ).rejects.toThrow('Restore the authenticated outsider fixture')
    expect(await capture(base)).toEqual(before)
    const result = await executeInRoom(base.owner.caller, { command })
    expect(result.projection.actors.map((candidate) => candidate.id)).not.toContain(actor.id)
    expect(encounterGmProjectionDtoSchema.parse(result.projection).reminders).toHaveLength(2)
    const after = await capture(base)
    expect(after.bindings).toHaveLength(1)
    expect(after.bindings[0]!.actorId).toBe(other.id)
    expect(after.sceneBindings).toEqual(before.sceneBindings)
    expect(after.characters).toEqual(before.characters)
    expect(after.characterReceipts).toEqual(before.characterReceipts)
    await executeInRoom(base.owner.caller, {
      command: {
        type: 'REMOVE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: result.projection.version,
        actorId: other.id
      }
    })
    const later = await capture(base)
    expect(
      await replayInRoom(base.owner.caller, {
        command: {
          ...command,
          encounterId: command.encounterId.toUpperCase(),
          commandId: command.commandId.toUpperCase(),
          actorId: command.actorId.toUpperCase()
        }
      })
    ).toEqual(result)
    expect(await capture(base)).toEqual(later)
    await expect(
      executeInRoom(base.owner.caller, { command: { ...command, actorId: other.id } })
    ).rejects.toThrow('Command ID was already used with different input.')
    await base.t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('userId', base.owner.userId)
        )
        .unique()
      if (!membership) throw new Error('Missing fixture membership')
      await ctx.db.patch(membership._id, { status: 'LEFT' })
    })
    await expect(executeInRoom(base.owner.caller, { command })).rejects.toThrow()
  })

  it('reconciles active initiative across historical rounds and permits an empty Run to change round', async () => {
    const base = await setup()
    let version = base.run.version
    for (const [index, actor] of base.run.actors.entries())
      await executeInRoom(base.owner.caller, {
        command: {
          type: 'SET_INITIATIVE',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: version++,
          actorId: actor.id,
          initiative: 20 - index,
          manualOrder: index
        }
      })
    let result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: version++
      }
    })
    const retainedCurrent = result.projection.currentActorId
    result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'SET_ROUND',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: version++,
        round: 2
      }
    })
    const noncurrent = base.run.actors.find((actor) => actor.id !== retainedCurrent)!
    result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'REMOVE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: version++,
        actorId: noncurrent.id
      }
    })
    expect(result.projection.currentActorId).toBe(retainedCurrent)
    expect((await capture(base)).participants.some((p) => p.actorId === noncurrent.id)).toBe(false)
    for (const actor of result.projection.actors) {
      result = await executeInRoom(base.owner.caller, {
        command: {
          type: 'REMOVE_ACTOR',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: version++,
          actorId: actor.id
        }
      })
    }
    expect(result.projection.actors).toEqual([])
    expect(result.projection.currentActorId).toBeNull()
    result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'SET_ROUND',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: version++,
        round: 3
      }
    })
    expect(result.projection.round).toBe(3)
    const stored = await capture(base)
    expect(stored.participants).toEqual([])
    expect(stored.sides).toEqual([])
  })

  it('supersedes a frozen Assisted initiative and preserves its maintenance receipt on retry', async () => {
    const base = await setup('PROMPT')
    const started = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    expect(started.occurrence?.pending).not.toBeNull()
    const actorId = base.run.actors[0]!.id
    const command = {
      type: 'REMOVE_ACTOR' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: started.projection.version,
      actorId
    }
    const result = await executeInRoom(base.owner.caller, { command })
    const after = await capture(base)
    const occurrence = after.occurrences.find((row) => row.id === started.occurrence!.occurrenceId)!
    expect(occurrence.state).toBe('COMPLETED')
    expect(occurrence.version).toBe(started.occurrence!.occurrenceVersion + 1)
    const receipt = after.receipts.find((row) => row.commandId === command.commandId)!
    expect(JSON.parse(receipt.resultJson)).toMatchObject({
      status: 'MAINTENANCE_COMPLETE',
      removedActorId: actorId
    })
    expect(await replayInRoom(base.owner.caller, { command })).toEqual(result)
    expect(await capture(base)).toEqual(after)
    await base.t.run(async (ctx) => {
      await ctx.db.patch(receipt._id, { resultChecksum: 'b'.repeat(64) })
    })
    await expect(executeInRoom(base.owner.caller, { command })).rejects.toThrow(
      LiveSessionRouteError
    )
  })

  it('reconciles an empty automatic SIDE_ROLL side and preserves historical removal replay', async () => {
    const base = await setup('AUTO_ROLL')
    const removed = base.run.actors.find((actor) => actor.kind === 'CHARACTER')
    const [firstSurvivor, secondSurvivor] = base.run.actors.filter(
      (actor) => actor.kind === 'CUSTOM'
    )
    const run = await base.t.run((ctx) =>
      ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique()
    )
    const firstSide = readRunState(run!).sides.find(
      (side) => side.id !== readRunState(run!).sides[0]!.id
    )
    if (!removed || !firstSurvivor || !secondSurvivor || !firstSide)
      throw new Error('Missing SIDE_ROLL fixture identities.')
    for (const [expectedVersion, actorId] of [
      [0, firstSurvivor.id],
      [1, secondSurvivor.id]
    ] as const)
      await executeInRoom(base.owner.caller, {
        command: {
          type: 'UPDATE_ACTOR',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion,
          actorId,
          sideId: firstSide.id
        }
      })
    let started = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 2
      }
    })
    for (let choices = 0; started.occurrence?.status === 'PENDING'; choices++) {
      expect(choices).toBeLessThan(6)
      const pending = started.occurrence.pending
      if (pending?.kind !== 'INITIATIVE_ORDER')
        throw new Error('Expected automatic side order choice')
      started = await executeInRoom(base.owner.caller, {
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: started.projection.version,
          correlationId: null,
          occurrenceId: started.occurrence.occurrenceId,
          expectedOccurrenceVersion: started.occurrence.occurrenceVersion,
          resolution: {
            kind: 'INITIATIVE_ENTITY',
            requestId: pending.requestId,
            entityId: pending.optionIds[0]!
          }
        }
      })
    }
    expect(started.projection.status).toBe('ACTIVE')
    started = await executeInRoom(base.owner.caller, {
      command: {
        type: 'SET_CURRENT_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version,
        actorId: firstSurvivor.id
      }
    })
    const command = {
      type: 'REMOVE_ACTOR' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: started.projection.version,
      actorId: removed.id
    }
    const before = await capture(base)
    await expect(executeInRoom(base.player.caller, { command })).rejects.toThrow()
    expect(await capture(base)).toEqual(before)
    const removedResult = await executeInRoom(base.owner.caller, { command })
    const afterRemoval = await capture(base)
    const survivingParticipants = afterRemoval.participants
      .filter((participant) => participant.actorId !== removed.id)
      .sort((left, right) => left.turnOrderOrdinal! - right.turnOrderOrdinal!)
    expect(
      afterRemoval.participants.some((participant) => participant.actorId === removed.id)
    ).toBe(false)
    expect(afterRemoval.sides).toHaveLength(1)
    expect(survivingParticipants.map((participant) => participant.turnOrderOrdinal)).toEqual([0, 1])
    expect(survivingParticipants.filter((participant) => participant.status === 'ACTIVE')).toEqual([
      expect.objectContaining({ actorId: removedResult.projection.currentActorId })
    ])
    const otherActorId = survivingParticipants[0]?.actorId
    if (!otherActorId) throw new Error('Missing surviving Actor for cursor correction.')
    const corrected = await executeInRoom(base.owner.caller, {
      command: {
        type: 'SET_CURRENT_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: removedResult.projection.version,
        actorId: otherActorId
      }
    })
    const advanced = await executeInRoom(base.owner.caller, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: corrected.projection.version
      }
    })
    expect(advanced.projection).toMatchObject({ status: 'ACTIVE', round: 1 })
    const afterLaterCommands = await capture(base)
    await expect(
      replayInRoom(base.owner.caller, {
        command: {
          ...command,
          encounterId: command.encounterId.toUpperCase(),
          commandId: command.commandId.toUpperCase(),
          actorId: command.actorId.toUpperCase()
        }
      })
    ).resolves.toEqual(removedResult)
    expect(await capture(base)).toEqual(afterLaterCommands)
  }, 30000)

  it('rolls back after successful actor deletion and rejects stale versions or corrupt state without writes', async () => {
    const base = await setup()
    const command = {
      type: 'REMOVE_ACTOR' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.run.version,
      actorId: base.run.actors[0]!.id
    }
    const before = await capture(base)
    await expect(
      base.t.run(async (ctx) => {
        await removeEncounterActor(ctx, command, base.owner.userId)
        const run = await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
          .unique()
        if (
          !run ||
          (await readRunActors(ctx, readRunState(run))).some(
            (actor) => actor.id === command.actorId
          )
        )
          throw new Error('Removal failed before rollback assertion')
        throw new Error('Abort after actor deletion')
      })
    ).rejects.toThrow('Abort after actor deletion')
    expect(await capture(base)).toEqual(before)
    await expect(
      executeInRoom(base.owner.caller, { command: { ...command, expectedVersion: 99 } })
    ).rejects.toThrow('Encounter version is stale.')
    expect(await capture(base)).toEqual(before)
    await base.t.run(async (ctx) => {
      const actor = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', base.run.id).eq('id', command.actorId)
        )
        .unique()
      if (!actor) throw new Error('Missing fixture actor')
      await ctx.db.patch(actor._id, { stateChecksum: checksumCanonicalJson('corrupt') })
    })
    const corrupt = await capture(base)
    await expect(executeInRoom(base.owner.caller, { command })).rejects.toThrow(
      LiveSessionRouteError
    )
    expect(await capture(base)).toEqual(corrupt)
  })

  it('cleans a deleting player Character from active initiative while retaining exact prior history', async () => {
    const base = await setup()
    const characterActor = base.run.actors.find((actor) => actor.kind === 'CHARACTER')
    if (!characterActor) throw new Error('Missing Character actor fixture.')
    let version = base.run.version
    for (const [index, actor] of base.run.actors.entries())
      await executeInRoom(base.owner.caller, {
        command: {
          type: 'SET_INITIATIVE',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: version++,
          actorId: actor.id,
          initiative: 20 - index,
          manualOrder: index
        }
      })
    let result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: version++
      }
    })
    result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'SET_CURRENT_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: result.projection.version,
        actorId: characterActor.id
      }
    })
    result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'UPSERT_REMINDER',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: result.projection.version,
        reminder: {
          actorId: characterActor.id,
          label: 'Character turn',
          timing: 'TURN_START',
          round: null,
          public: false,
          notes: null,
          order: 0
        }
      }
    })
    await base.t.run((ctx) =>
      ctx.db.insert('encounterActorTokenBindings', {
        encounterId: base.run.id,
        actorId: characterActor.id,
        sceneId: crypto.randomUUID(),
        tokenId: crypto.randomUUID()
      })
    )
    const before = await capture(base)
    await base.t.run((ctx) =>
      removeAccountCharacterActors(ctx, base.campaign.id, base.player.userId)
    )
    const after = await capture(base)
    const run = after.runs.find((candidate) => candidate.id === base.run.id)
    const projection = run
      ? encounterGmProjectionDtoSchema.parse(JSON.parse(run.projectionJson))
      : null
    expect(projection?.actors.some((actor) => actor.id === characterActor.id)).toBe(false)
    expect(projection?.currentActorId).not.toBe(characterActor.id)
    expect(projection?.reminders.some((reminder) => reminder.actorId === characterActor.id)).toBe(
      false
    )
    expect(
      after.participants.some((participant) => participant.actorId === characterActor.id)
    ).toBe(false)
    expect(after.bindings.some((binding) => binding.actorId === characterActor.id)).toBe(false)
    expect(after.actors.some((actor) => actor.id === characterActor.id)).toBe(false)
    expect(after.commands).toEqual(expect.arrayContaining(before.commands))
    expect(after.characterReceipts).toEqual(before.characterReceipts)
    expect(
      after.commands.find(
        (command) =>
          command.encounterId === base.run.id && command.actorUserId === base.player.userId
      )
    ).toMatchObject({ commandType: 'REMOVE_ACTOR' })
    expect(projection?.actors.filter((actor) => actor.kind === 'CUSTOM')).toHaveLength(2)
  }, 30000)

  it('allows trusted cleanup for a departed player in an archived Campaign and skips completed Runs', async () => {
    const base = await setup()
    const characterActor = base.run.actors.find((actor) => actor.kind === 'CHARACTER')
    if (!characterActor) throw new Error('Missing Character actor fixture.')
    const beforeScopeFailure = await capture(base)
    await expect(
      base.t.run((ctx) => removeAccountCharacterActors(ctx, base.campaign.id, base.owner.userId))
    ).rejects.toThrow('player membership')
    expect(await capture(base)).toEqual(beforeScopeFailure)
    await base.t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('userId', base.player.userId)
        )
        .unique()
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique()
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique()
      if (!membership || !campaign || !run) throw new Error('Missing lifecycle fixture documents.')
      await ctx.db.patch(membership._id, { status: 'LEFT' })
      await ctx.db.patch(campaign._id, { status: 'ARCHIVED' })
      await ctx.db.patch(run._id, { status: 'COMPLETED' })
    })
    const command = {
      type: 'REMOVE_ACTOR' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.run.version,
      actorId: characterActor.id
    }
    await expect(executeInRoom(base.player.caller, { command })).rejects.toThrow(
      LiveSessionRouteError
    )
    await expect(executeInRoom(base.owner.caller, { command })).rejects.toThrow(
      'Archived Campaigns are read-only'
    )
    const before = await capture(base)
    const otherRun = before.runs.find((run) => run.id !== base.run.id && run.status !== 'COMPLETED')
    if (!otherRun) throw new Error('Missing non-completed Run for archived cleanup.')
    await base.t.run((ctx) =>
      removeAccountCharacterActors(ctx, base.campaign.id, base.player.userId)
    )
    const after = await capture(base)
    expect(after.actors.some((actor) => actor.id === characterActor.id)).toBe(true)
    expect(
      after.actors.some(
        (actor) =>
          actor.encounterId === otherRun.id &&
          JSON.parse(actor.stateJson).kind === 'CHARACTER' &&
          JSON.parse(actor.stateJson).sourceId === base.character.id
      )
    ).toBe(false)
  }, 30000)

  it('rolls back trusted cleanup when a later account-deletion step fails', async () => {
    const base = await setup()
    const before = await capture(base)
    await expect(
      base.t.run(async (ctx) => {
        await removeAccountCharacterActors(ctx, base.campaign.id, base.player.userId)
        throw new Error('Abort after trusted actor cleanup')
      })
    ).rejects.toThrow('Abort after trusted actor cleanup')
    expect(await capture(base)).toEqual(before)
  }, 30000)

  it('fails closed when a Character actor source record is unavailable', async () => {
    const base = await setup()
    await base.t.run(async (ctx) => {
      const character = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
        .unique()
      if (!character) throw new Error('Missing Character source fixture.')
      await ctx.db.delete(character._id)
    })
    const before = await capture(base)
    await expect(
      base.t.run((ctx) => removeAccountCharacterActors(ctx, base.campaign.id, base.player.userId))
    ).rejects.toThrow('Character source is unavailable')
    expect(await capture(base)).toEqual(before)
  }, 30000)

  it('still removes Character actors from unfinished Runs after a Campaign Session finishes', async () => {
    const base = await setup()
    const session = await base.owner.caller.mutation(createSession, {
      campaignId: base.campaign.id
    })
    const finished = await base.owner.caller.mutation(finishSession, {
      campaignId: base.campaign.id,
      sessionId: session.id,
      commandId: crypto.randomUUID(),
      expectedVersion: session.version
    })
    expect(finished.status).toBe('FINISHED')
    const characterActors = async () =>
      (await capture(base)).actors.filter(
        (actor) => JSON.parse(actor.stateJson).sourceId === base.character.id
      )
    expect(await characterActors()).not.toEqual([])
    await base.t.run((ctx) =>
      removeAccountCharacterActors(ctx, base.campaign.id, base.player.userId)
    )
    expect(await characterActors()).toEqual([])
  }, 30000)
})
