import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CharacterSheetCommandResponseDto,
  CharacterSheetExecuteInput
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterExecuteInput,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_CONDITION_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { activateFixtureRun, updateFixtureRunActors } from '../../tests/fixtures/activeInitiative'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import {
  attachRoomWorker,
  checkpointLiveRoom,
  checkpointRoom,
  closeRoom,
  executeInRoom,
  readRoomTimeline,
  RoomCommandRefusal,
  seedRoomContentSnapshots,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

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
const personalExecute = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')

async function setup() {
  const base = await readySheetFixture()
  const campaign = await base.other.caller.mutation(createCampaign, {
    name: 'Actor commands',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await base.t.run(async (ctx) => {
    await ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
    await ctx.db.insert('campaignCharacterAssignments', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      characterId: base.character.id,
      assignedAt: campaign.createdAt
    })
  })
  const blueprint = await base.other.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Actor command fixture',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CUSTOM', label: 'Dummy', maxHitPoints: 10 }]
  })
  const run = await base.other.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  await attachRoomWorker(base.t)
  await seedRoomContentSnapshots(campaign.id)
  const characterActor = run.actors.find((actor) => actor.kind === 'CHARACTER')
  const customActor = run.actors.find((actor) => actor.kind === 'CUSTOM')
  if (!characterActor || !customActor) throw new Error('Missing fixture actors.')
  return { ...base, campaign, run, characterActor, customActor }
}

function update(command: Extract<EncounterExecuteInput['command'], { type: 'UPDATE_ACTOR' }>) {
  return { command }
}

// Publishes the room-held Run first. The room keeps command history until the Run ends (D85), so
// the stored command rows are not readable here.
async function stored(
  base: Awaited<ReturnType<typeof setup>>,
  encounterId: string,
  actorId: string
) {
  await checkpointLiveRoom(base.campaign.id)
  return base.t.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', encounterId))
      .unique()
    const actor = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId).eq('id', actorId))
      .unique()
    return {
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      run,
      actor
    }
  })
}

describe('native Encounter UPDATE_ACTOR commands', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('persists direct CUSTOM updates, derives health, and leaves snapshots and cursor intact', async () => {
    const base = await setup()
    const { t, other: gm, run, customActor } = base
    await t.run(async (ctx) => {
      await updateFixtureRunActors(ctx, run.id, (actor) =>
        actor.id === customActor.id ? { ...actor, initiative: 12, manualOrder: 0 } : actor
      )
      await activateFixtureRun(ctx, run.id, { round: 1, currentActorId: customActor.id })
    })
    const before = await stored(base, run.id, customActor.id)
    const sideId = encounterRunStateSchema.parse(JSON.parse(before.run!.stateJson)).sides[0]!.id
    const result = await executeInRoom(
      gm.caller,
      update({
        type: 'UPDATE_ACTOR',
        encounterId: run.id.toUpperCase(),
        commandId: crypto.randomUUID().toUpperCase(),
        expectedVersion: 0,
        actorId: customActor.id.toUpperCase(),
        sideId: sideId.toUpperCase(),
        currentHitPoints: 2,
        tempHitPoints: 3,
        conditions: [{ conditionTypeId: crypto.randomUUID(), label: 'Prone' }],
        gmNotes: 'Pinned',
        public: false
      })
    )
    const actor = result.projection.actors.find((candidate) => candidate.id === customActor.id)!
    expect(actor).toMatchObject({
      currentHitPoints: 2,
      tempHitPoints: 3,
      gmNotes: 'Pinned',
      public: false,
      healthBand: 'CRITICAL'
    })
    const after = await stored(base, run.id, customActor.id)
    const actorState = readStoredRunActor(after.actor!)
    expect(actorState).toMatchObject({
      currentHitPoints: 2,
      tempHitPoints: 3,
      conditions: [{ label: 'Prone' }],
      sideId
    })
    expect(after.actor!.snapshotChecksum).toBe(before.actor!.snapshotChecksum)
    expect(actorState.initiative).toBe(12)
    expect(actorState.manualOrder).toBe(0)
    expect(result.projection.currentActorId).toBe(customActor.id)
    expect(encounterRunStateSchema.parse(JSON.parse(after.run!.stateJson)).currentActorId).toBe(
      encounterRunStateSchema.parse(JSON.parse(before.run!.stateJson)).currentActorId
    )
  }, 30000)

  it('sets a leveled condition’s level on a Creature and refuses levels the System does not author', async () => {
    const base = await setup()
    const { other: gm, run, customActor } = base
    const conditionId = (code: string) => SRD_CONDITION_TYPES.find((type) => type.code === code)!.id
    const exhaustion = srdSystemRecord.conditionTypes.find((type) => type.code === 'EXHAUSTION')!
    const setConditions = (
      conditions: { conditionTypeId: string; level?: number }[],
      expectedVersion: number
    ) =>
      executeInRoom(
        gm.caller,
        update({
          type: 'UPDATE_ACTOR',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion,
          actorId: customActor.id,
          conditions
        })
      )

    const result = await setConditions([{ conditionTypeId: exhaustion.id, level: 3 }], 0)
    expect(
      result.projection.actors.find((actor) => actor.id === customActor.id)?.conditions
    ).toEqual([{ conditionTypeId: exhaustion.id, level: 3 }])
    for (const conditions of [
      [{ conditionTypeId: exhaustion.id, level: exhaustion.maximumLevel! + 1 }],
      [{ conditionTypeId: exhaustion.id, level: 0 }],
      [{ conditionTypeId: conditionId('PRONE'), level: 2 }]
    ])
      await expect(setConditions(conditions, result.projection.version)).rejects.toThrow()
    expect(
      readStoredRunActor((await stored(base, run.id, customActor.id)).actor!).conditions
    ).toEqual([{ conditionTypeId: exhaustion.id, level: 3 }])
  }, 30000)
  it('bridges a Character Sheet command, retains max override, and replays its original Encounter result', async () => {
    const base = await setup()
    const { t, owner, other: gm, character, run, characterActor, readState } = base
    await owner.caller.mutation(personalExecute, {
      id: character.id,
      command: {
        type: 'ADD_CONDITION',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        conditionTypeId: SRD_CONDITION_TYPES[0]!.id
      }
    })
    await owner.caller.mutation(personalExecute, {
      id: character.id,
      command: {
        type: 'SET_HIT_POINTS',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        current: 12,
        maxOverride: 15
      }
    })
    const commandId = crypto.randomUUID()
    const nestedCommandId = crypto.randomUUID()
    const sheetCommand = {
      type: 'ADJUST_HIT_POINTS',
      commandId: nestedCommandId,
      expectedVersion: 3,
      mode: 'DAMAGE',
      amount: 3
    } as const
    // A Run that is not ACTIVE holds no play: its GM edits the Character from the Sheet.
    await expect(
      executeInRoom(
        gm.caller,
        update({
          type: 'UPDATE_ACTOR',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 0,
          actorId: characterActor.id,
          characterCommand: sheetCommand
        })
      )
    ).rejects.toThrow('Make this change from the Character Sheet.')
    // The fixture activates the Run in Convex, so the room must not hold the prepared Run.
    await closeRoom(base.campaign.id)
    await t.run((ctx) =>
      activateFixtureRun(ctx, run.id, { round: 1, currentActorId: characterActor.id })
    )
    const command = update({
      type: 'UPDATE_ACTOR',
      encounterId: run.id.toUpperCase(),
      commandId: commandId.toUpperCase(),
      expectedVersion: 0,
      actorId: characterActor.id.toUpperCase(),
      characterCommand: sheetCommand
    })
    const first = await executeInRoom(gm.caller, command)
    expect(first.projection.actors.find((actor) => actor.id === characterActor.id)).toMatchObject({
      currentHitPoints: 9,
      maxHitPoints: 15,
      sourceRevision: null
    })
    expect(
      first.projection.actors.find((actor) => actor.id === characterActor.id)?.conditions
    ).toHaveLength(1)
    const after = await stored(base, run.id, characterActor.id)
    expect(readStoredRunActor(after.actor!).kind).toBe('CHARACTER')
    const storedCharacter = await t.run((ctx) => readCharacterRow(ctx, character.id))
    expect(storedCharacter!.play.maximumHitPoints).toBe(15)
    expect(readCharacterRecord(storedCharacter!).state.conditions).toHaveLength(1)
    // The room holds the command's receipt until the Run ends; its timeline entry is the member-visible record.
    expect(await readRoomTimeline(gm.caller, base.campaign.id)).toEqual([
      expect.objectContaining({
        commandType: 'UPDATE_ACTOR',
        version: first.projection.version
      }),
      expect.objectContaining({ commandType: 'CREATE', version: 0 })
    ])
    expect((await readState()).receipts).toHaveLength(3)
    const later = await executeInRoom(
      gm.caller,
      update({
        type: 'UPDATE_ACTOR',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        actorId: characterActor.id
      })
    )
    expect(
      await executeInRoom(gm.caller, {
        command: { ...command.command, encounterId: run.id, commandId }
      })
    ).toEqual({ ...first, projection: later.projection })
    await checkpointRoom(base.campaign.id)
    expect((await readState()).receipts).toHaveLength(3)

    // A new outer command reusing the settled nested Sheet command never applies its damage again.
    const settledSheet = await t.run((ctx) => readCharacterRow(ctx, character.id))
    const reused = await executeInRoom(
      gm.caller,
      update({
        ...command.command,
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 2
      })
    )
    expect(reused.projection.actors.find((actor) => actor.id === characterActor.id)).toMatchObject({
      currentHitPoints: 9
    })
    await checkpointRoom(base.campaign.id)
    expect(await t.run((ctx) => readCharacterRow(ctx, character.id))).toEqual(settledSheet)
    // A settled nested Sheet command id reused with the same input replays (above); reusing it, or an
    // outer command id, with different input is refused. Both are asserted against the real room in
    // `apps/session-worker/test/nativeRoomTurnEvidence.test.ts` ("a Sheet command nested in a GM UPDATE_ACTOR").
  }, 30000)

  it('rejects character direct state, invalid sides, failed Sheet commands, and corrupt actor state without writes', async () => {
    const base = await setup()
    const { t, other: gm, run, characterActor, customActor, readState } = base
    const before = await stored(base, run.id, characterActor.id)
    const beforeSheet = await readState()
    const rejected = [
      update({
        type: 'UPDATE_ACTOR',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0,
        actorId: characterActor.id,
        currentHitPoints: 1
      }),
      update({
        type: 'UPDATE_ACTOR',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0,
        actorId: customActor.id,
        sideId: crypto.randomUUID()
      }),
      update({
        type: 'UPDATE_ACTOR',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0,
        actorId: characterActor.id,
        characterCommand: {
          type: 'CREATE_NOTE',
          commandId: crypto.randomUUID(),
          expectedVersion: 1,
          title: 'Nope',
          groupId: 'session-notes'
        }
      })
    ]
    for (const request of rejected)
      await expect(executeInRoom(gm.caller, request)).rejects.toThrow()
    expect(await stored(base, run.id, characterActor.id)).toEqual(before)
    expect(await readState()).toEqual(beforeSheet)
    // The room holds the Run after the rejected commands; release it before editing Convex rows.
    await closeRoom(base.campaign.id)
    await t.run(async (ctx) => {
      const actor = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', customActor.id))
        .unique()
      if (!actor) throw new Error('Missing actor.')
      await ctx.db.patch(actor._id, { stateChecksum: '0'.repeat(64) })
    })
    await expect(
      executeInRoom(
        gm.caller,
        update({
          type: 'UPDATE_ACTOR',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 0,
          actorId: customActor.id
        })
      )
    ).rejects.toThrow(RoomCommandRefusal)
  }, 30000)
})
