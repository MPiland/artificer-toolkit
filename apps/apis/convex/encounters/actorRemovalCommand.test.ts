import {
  createConvexEncounterStore,
  createConvexEncounterStoreReader
} from '../lib/convexEncounterStore'
import { readReceiptHeaders } from '../lib/receiptLedgers'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
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
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { sceneStoredInitialStateSchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import { setAutoRollDice, type FixtureRolls } from '../../tests/fixtures/rollPreferences'
import { internal } from '../_generated/api'
import { readCharacterRow } from '../characters/stateDocuments'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import {
  removeAccountCharacterActors,
  removeEncounterActor
} from '@artificer-toolkit/encounter-persistence/actorRemovalCommand'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  closeRoom,
  executeInRoom,
  expectRedactedRoomRefusal,
  RoomCommandRefusal,
  readEncounterHistory,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { definition, descriptor, lifecycle } from '../../tests/fixtures/maintainedEffects'
import { readFightingCharacters } from '../liveSessions/characterHolds'
import { readEncounterGmProjection } from '@artificer-toolkit/encounter-persistence/nativeProjection'
import { encounterReadTransaction, encounterWriteTransaction } from './encounterPorts'

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
      {
        cadence: 'ENCOUNTER_START',
        procedure: mode === 'AUTO_ROLL' ? 'SIDE_ROLL' : 'ACTOR_ROLL'
      }
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
  } = await base.owner.caller.query(getSettings, {
    campaignId: base.campaign.id
  })
  await base.owner.caller.mutation(saveSettings, {
    ...settings,
    expectedVersion: version,
    automationMode: mode === 'MANUAL' ? 'MANUAL' : 'ASSISTED',
    initiativePolicyDefinitionId,
    initiativeTieDefinitionId: null,
    ...(mode === 'MANUAL'
      ? { initiativePolicyDefinitionId: null, initiativeTieDefinitionId: null }
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
  await attachFixtureRoom(base.t, base.campaign.id)
  return { ...base, run }
}

type Fixture = Awaited<ReturnType<typeof setup>>
/** The rows Convex holds; while the room holds the Run, they are the checkpointed ones (D85). */
async function capture(base: Fixture) {
  await checkpointLiveRoom(base.campaign.id)
  return base.t.run(async (ctx) => ({
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    runs: await ctx.db.query('encounterRuns').collect(),
    actors: await ctx.db.query('encounterRunActors').collect(),
    rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
    participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
    sides: await ctx.db.query('encounterInitiativeSides').collect(),
    commands: await (await readEncounterHistory(ctx)).query('encounterRunCommands').collect(),
    occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
    receipts: await (await readEncounterHistory(ctx)).query('encounterRuleReceipts').collect(),
    bindings: await ctx.db.query('encounterActorTokenBindings').collect(),
    sceneBindings: await ctx.db.query('encounterSceneBindings').collect(),
    characters: await ctx.db.query('characters').collect(),
    characterPlayStates: await ctx.db.query('characterPlayStates').collect(),
    characterReceipts: await ctx.db
      .query('characterCommandReceipts')
      .collect()
      .then((headers) => readReceiptHeaders(ctx, 'characterCommandReceipts', headers)),
    effects: await ctx.db.query('encounterActiveRuleEffects').collect(),
    characterEffects: await ctx.db.query('characterActiveRuleEffects').collect(),
    states: await ctx.db.query('encounterMaintainedEffectStates').collect()
  }))
}

describe('native actor removal transaction', () => {
  useLocalRoomWorker()

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
    // Convex writes under a held Run need the room closed first; it re-hydrates on the next command.
    await closeRoom(base.campaign.id)
    await base.t.run(async (ctx) => {
      const now = new Date().toISOString()
      // The room's checkpoint accepts a binding only to a Scene of the Campaign.
      await ctx.db.insert(
        'campaignScenes',
        sceneStoredInitialStateSchema.parse({
          id: sceneId,
          campaignId: base.campaign.id,
          name: 'Removal Scene',
          ambientIllumination: 'BRIGHT',
          daylight: false,
          fogMode: 'SHARED_PARTY',
          visionRevealMode: 'ON_DRAG',
          grid: {
            kind: 'SQUARE',
            origin: { x: 0, y: 0 },
            cellSize: 100,
            distancePerCell: 5,
            diagonalPolicy: 'EQUAL',
            unit: 'FEET'
          },
          map: {
            assetId: crypto.randomUUID(),
            width: 800,
            height: 400,
            tileManifestAssetId: null
          },
          definitionId: crypto.randomUUID(),
          definitionVersion: 1,
          definitionSaveId: crypto.randomUUID(),
          version: 0,
          materializationCommandId: crypto.randomUUID(),
          materializationCommandFingerprint: '0'.repeat(64),
          createdAt: now,
          updatedAt: now
        })
      )
      await ctx.db.insert('encounterSceneBindings', {
        encounterId: base.run.id,
        campaignId: base.campaign.id,
        sceneId,
        commandId: crypto.randomUUID(),
        commandFingerprint: 'a'.repeat(64),
        createdAt: now
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
    await expect(executeInRoom(base.player.caller, { command })).rejects.toMatchObject({
      data: { code: 'DOMAIN_REJECTED', reason: 'GM_ONLY', message: 'Only the GM can do that.' }
    })
    await expect(executeInRoom(base.t, { command })).rejects.toThrow('Unauthenticated')
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
    const current = await executeInRoom(base.owner.caller, {
      command: {
        type: 'REMOVE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: result.projection.version,
        actorId: other.id
      }
    })
    const later = await capture(base)
    // A retry of a settled command is answered from the room's held history with the current state.
    expect(
      await executeInRoom(base.owner.caller, {
        command: {
          ...command,
          encounterId: command.encounterId.toUpperCase(),
          commandId: command.commandId.toUpperCase(),
          actorId: command.actorId.toUpperCase()
        }
      })
    ).toEqual({ ...result, projection: current.projection })
    expect(await capture(base)).toEqual(later)
    await expectRedactedRoomRefusal(
      executeInRoom(base.owner.caller, {
        command: { ...command, actorId: other.id }
      }),
      'already used for different input',
      'INVALID_COMMAND'
    )
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
    // A connected socket stays admitted until its token's next challenge (D89); a departed member is
    // refused when the room next admits them: the join ticket is refused as a plain Error.
    await closeRoom(base.campaign.id)
    await expect(executeInRoom(base.owner.caller, { command })).rejects.toThrow(
      'Campaign not found.'
    )
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
    const noncurrent = base.run.actors.find(
      (actor) => actor.id !== retainedCurrent && actor.kind !== 'CHARACTER'
    )!
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
    // D82: a removed Character stays in the Run, out of initiative, so no actor takes a turn.
    expect(result.projection.actors).toEqual([
      expect.objectContaining({ kind: 'CHARACTER', absence: 'GM_REMOVED' })
    ])
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
    expect(stored.participants.filter((p) => p.round === 3).map((p) => p.actorId)).toEqual([
      result.projection.actors[0]!.id
    ])
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
    expect(await executeInRoom(base.owner.caller, { command })).toEqual(result)
    expect(await capture(base)).toEqual(after)
  })

  // The room keeps a Run's rule receipts for the whole Run (D88), so the receipt this command
  // writes is observed where the producer writes it: in Convex, with no room holding the Run.
  it('writes the MAINTENANCE_COMPLETE receipt that supersedes a frozen Assisted initiative', async () => {
    const base = await setup('PROMPT')
    const started = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    const actorId = base.run.actors[0]!.id
    const command = {
      type: 'REMOVE_ACTOR' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: started.projection.version,
      actorId
    }
    await closeRoom(base.campaign.id)
    await base.t.run((ctx) =>
      removeEncounterActor(encounterWriteTransaction(ctx), command, base.owner.userId)
    )
    const after = await capture(base)
    const occurrence = after.occurrences.find((row) => row.id === started.occurrence!.occurrenceId)!
    expect(occurrence.state).toBe('COMPLETED')
    expect(occurrence.version).toBe(started.occurrence!.occurrenceVersion + 1)
    const receipt = after.receipts.find((row) => row.commandId === command.commandId)!
    expect(JSON.parse(receipt.resultJson)).toMatchObject({
      status: 'MAINTENANCE_COMPLETE',
      removedActorId: actorId
    })
  })

  it('takes a Character out of an automatic SIDE_ROLL round without moving it and preserves replay', async () => {
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
    await expect(executeInRoom(base.player.caller, { command })).rejects.toMatchObject({
      data: { code: 'DOMAIN_REJECTED', reason: 'GM_ONLY', message: 'Only the GM can do that.' }
    })
    expect(await capture(base)).toEqual(before)
    const removedResult = await executeInRoom(base.owner.caller, { command })
    const afterRemoval = await capture(base)
    // D82: the Character leaves initiative but keeps its actor, its place and every side.
    expect(afterRemoval.participants).toEqual(before.participants)
    expect(afterRemoval.sides).toEqual(before.sides)
    expect(removedResult.projection.actors.find((actor) => actor.id === removed.id)).toMatchObject({
      absence: 'GM_REMOVED'
    })
    expect(removedResult.projection.currentActorId).toBe(firstSurvivor.id)
    const [firstTurn, secondTurn] = afterRemoval.participants
      .filter((participant) => participant.actorId !== removed.id)
      .sort((left, right) => left.turnOrderOrdinal! - right.turnOrderOrdinal!)
    const corrected = await executeInRoom(base.owner.caller, {
      command: {
        type: 'SET_CURRENT_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: removedResult.projection.version,
        actorId: firstTurn!.actorId
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
    expect(advanced.projection).toMatchObject({
      status: 'ACTIVE',
      round: 1,
      currentActorId: secondTurn!.actorId
    })
    const afterLaterCommands = await capture(base)
    await expect(
      executeInRoom(base.owner.caller, {
        command: {
          ...command,
          encounterId: command.encounterId.toUpperCase(),
          commandId: command.commandId.toUpperCase(),
          actorId: command.actorId.toUpperCase()
        }
      })
    ).resolves.toEqual({ ...removedResult, projection: advanced.projection })
    expect(await capture(base)).toEqual(afterLaterCommands)
  }, 30000)

  it('keeps a GM-removed Character in the Run, held and running, out of initiative until the GM returns it (D82)', async () => {
    const base = await setup()
    const character = base.run.actors.find((actor) => actor.kind === 'CHARACTER')
    const [target, other] = base.run.actors.filter((actor) => actor.kind === 'CUSTOM')
    if (!character || !target || !other) throw new Error('Fixture Custom actor is unavailable.')
    let version = base.run.version
    for (const [index, actor] of [character, target, other].entries())
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
    const started = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: version++
      }
    })
    const stateId = crypto.randomUUID()
    const characterEffectId = crypto.randomUUID()
    const dependentEffectId = crypto.randomUUID()
    // Convex writes under a held Run need the room closed first; it re-hydrates on the next command.
    await closeRoom(base.campaign.id)
    await base.t.run(async (ctx) => {
      const effects = createActiveRuleEffectStore({
        db: createConvexEncounterStore(ctx)
      })
      await effects.createMaintainedState({
        id: stateId,
        encounterId: base.run.id,
        ownerActorId: character.id,
        descriptor: descriptor(character.id, 'TERMINATE_WHEN_EMPTY')
      })
      await effects.create({
        id: characterEffectId,
        owner: { kind: 'CHARACTER', characterId: base.character.id },
        definition: definition(base.run.id, character.id),
        lifecycle,
        maintainedEffectStateId: stateId
      })
      await effects.create({
        id: dependentEffectId,
        owner: {
          kind: 'ENCOUNTER_ACTOR',
          encounterId: base.run.id,
          targetActorId: target.id
        },
        definition: definition(base.run.id, character.id),
        lifecycle,
        maintainedEffectStateId: stateId
      })
    })
    const before = await capture(base)
    const removed = await executeInRoom(base.owner.caller, {
      command: {
        type: 'REMOVE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version,
        actorId: character.id
      }
    })
    expect(removed.projection.actors.find((actor) => actor.id === character.id)).toMatchObject({
      absence: 'GM_REMOVED'
    })
    expect(removed.projection.actors.find((actor) => actor.id === target.id)).toMatchObject({
      absence: null
    })
    const after = await capture(base)
    expect(after.characters).toEqual(before.characters)
    expect(after.characterPlayStates).toEqual(before.characterPlayStates)
    expect(after.characterEffects).toEqual(before.characterEffects)
    expect(after.effects).toEqual(before.effects)
    expect(after.states).toEqual(before.states)
    expect(after.actors.map((row) => row.id)).toContain(character.id)
    expect(
      await base.t.run(async (ctx) => {
        const run = await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
          .unique()
        return readFightingCharacters(ctx, base.campaign.id, [run])
      })
    ).toEqual([{ characterId: base.character.id, encounterId: base.run.id }])
    const current = await executeInRoom(base.owner.caller, {
      command: {
        type: 'SET_CURRENT_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: removed.projection.version,
        actorId: target.id
      }
    })
    const advance = (expectedVersion: number) =>
      executeInRoom(base.owner.caller, {
        command: {
          type: 'ADVANCE_TURN',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion
        }
      })
    // The Character's slot is first in order, yet the turn passes it by into the next round.
    const second = await advance(current.projection.version)
    expect(second.projection).toMatchObject({ round: 1, currentActorId: other.id })
    const advanced = await advance(second.projection.version)
    expect(advanced.projection).toMatchObject({ round: 2, currentActorId: target.id })
    const returned = await executeInRoom(base.owner.caller, {
      command: {
        type: 'UPDATE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: advanced.projection.version,
        actorId: character.id,
        returnToInitiative: true
      }
    })
    expect(returned.projection.actors.find((actor) => actor.id === character.id)).toMatchObject({
      absence: null
    })
    const afterTarget = await advance(returned.projection.version)
    const next = await advance(afterTarget.projection.version)
    expect(next.projection).toMatchObject({ round: 3, currentActorId: character.id })
    expect(await capture(base)).toMatchObject({
      characterEffects: before.characterEffects,
      effects: before.effects,
      states: before.states
    })
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
        await removeEncounterActor(encounterWriteTransaction(ctx), command, base.owner.userId)
        const run = await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
          .unique()
        if (
          !run ||
          (
            await readRunActors({ db: createConvexEncounterStoreReader(ctx) }, readRunState(run))
          ).some((actor) => actor.id === command.actorId)
        )
          throw new Error('Removal failed before rollback assertion')
        throw new Error('Abort after actor deletion')
      })
    ).rejects.toThrow('Abort after actor deletion')
    expect(await capture(base)).toEqual(before)
    await expect(
      executeInRoom(base.owner.caller, {
        command: { ...command, expectedVersion: 99 }
      })
    ).rejects.toThrow('Encounter version is stale.')
    expect(await capture(base)).toEqual(before)
    // Convex writes under a held Run need the room closed first; it re-hydrates on the next command.
    await closeRoom(base.campaign.id)
    await base.t.run(async (ctx) => {
      const actor = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', base.run.id).eq('id', command.actorId)
        )
        .unique()
      if (!actor) throw new Error('Missing fixture actor')
      await ctx.db.patch(actor._id, {
        stateChecksum: checksumCanonicalJson('corrupt')
      })
    })
    const corrupt = await capture(base)
    await expect(executeInRoom(base.owner.caller, { command })).rejects.toThrow(RoomCommandRefusal)
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
    const start = {
      type: 'START' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: version++
    }
    let result = await executeInRoom(base.owner.caller, { command: start })
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
    // Convex writes under a held Run need the room closed first; it re-hydrates on the next command.
    await closeRoom(base.campaign.id)
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
      removeAccountCharacterActors(
        encounterWriteTransaction(ctx),
        base.campaign.id,
        base.player.userId
      )
    )
    const after = await capture(base)
    const run = after.runs.find((candidate) => candidate.id === base.run.id)
    const projection = run
      ? await base.t.run((ctx) =>
          readEncounterGmProjection(encounterReadTransaction(ctx), readRunState(run))
        )
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
    // D88: the room holds the Run's history and merges Convex-side cleanup in when it re-hydrates, so
    // a retry of an earlier command is still answered from that history, not refused as stale.
    const retried = await executeInRoom(base.owner.caller, { command: start })
    expect(retried.projection.actors.some((actor) => actor.id === characterActor.id)).toBe(false)
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
      base.t.run((ctx) =>
        removeAccountCharacterActors(
          encounterWriteTransaction(ctx),
          base.campaign.id,
          base.owner.userId
        )
      )
    ).rejects.toThrow('player membership')
    expect(await capture(base)).toEqual(beforeScopeFailure)
    const command = {
      type: 'REMOVE_ACTOR' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.run.version,
      actorId: characterActor.id
    }
    // Convex writes under a held Run need the room closed first; it re-hydrates on the next command.
    await closeRoom(base.campaign.id)
    await base.t.run(async (ctx) => {
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique()
      if (!campaign) throw new Error('Missing lifecycle fixture documents.')
      await ctx.db.patch(campaign._id, { status: 'ARCHIVED' })
    })
    // The room's join ticket is refused for an archived Campaign, before any command reaches the Run.
    await expect(executeInRoom(base.owner.caller, { command })).rejects.toThrow(
      'Archived Campaigns are read-only.'
    )
    await closeRoom(base.campaign.id)
    await base.t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('userId', base.player.userId)
        )
        .unique()
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique()
      if (!membership || !run) throw new Error('Missing lifecycle fixture documents.')
      await ctx.db.patch(membership._id, { status: 'LEFT' })
      const completed = encounterRunStateSchema.parse({
        ...JSON.parse(run.stateJson),
        status: 'COMPLETED'
      })
      await ctx.db.patch(run._id, {
        status: 'COMPLETED',
        stateJson: JSON.stringify(completed),
        stateChecksum: checksumCanonicalJson(completed)
      })
    })
    // An archived Campaign cannot be joined by its departed player, and no command reaches its Run.
    await expect(executeInRoom(base.player.caller, { command })).rejects.toThrow(
      'Campaign not found.'
    )
    const before = await capture(base)
    const otherRun = before.runs.find((run) => run.id !== base.run.id && run.status !== 'COMPLETED')
    if (!otherRun) throw new Error('Missing non-completed Run for archived cleanup.')
    await base.t.run((ctx) =>
      removeAccountCharacterActors(
        encounterWriteTransaction(ctx),
        base.campaign.id,
        base.player.userId
      )
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
        await removeAccountCharacterActors(
          encounterWriteTransaction(ctx),
          base.campaign.id,
          base.player.userId
        )
        throw new Error('Abort after trusted actor cleanup')
      })
    ).rejects.toThrow('Abort after trusted actor cleanup')
    expect(await capture(base)).toEqual(before)
  }, 30000)

  it('fails closed when a Character actor source record is unavailable', async () => {
    const base = await setup()
    await base.t.run(async (ctx) => {
      const character = await readCharacterRow(ctx, base.character.id)
      if (!character) throw new Error('Missing Character source fixture.')
      await ctx.db.delete(character.play._id)
      await ctx.db.delete(character._id)
    })
    const before = await capture(base)
    await expect(
      base.t.run((ctx) =>
        removeAccountCharacterActors(
          encounterWriteTransaction(ctx),
          base.campaign.id,
          base.player.userId
        )
      )
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
      removeAccountCharacterActors(
        encounterWriteTransaction(ctx),
        base.campaign.id,
        base.player.userId
      )
    )
    expect(await characterActors()).toEqual([])
  }, 30000)
})
