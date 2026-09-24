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
import {
  encounterGmProjectionDtoSchema,
  type CreateEncounterBlueprintInputDto,
  type CreateEncounterInputDto,
  type EncounterBlueprintDto,
  type EncounterCommandResultDto,
  type EncounterExecuteInput,
  type EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_CONDITION_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import * as sheetCommands from '../characters/sheetCommands'

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
  const characterActor = run.actors.find((actor) => actor.kind === 'CHARACTER')
  const customActor = run.actors.find((actor) => actor.kind === 'CUSTOM')
  if (!characterActor || !customActor) throw new Error('Missing fixture actors.')
  return { ...base, campaign, run, characterActor, customActor }
}

function update(command: Extract<EncounterExecuteInput['command'], { type: 'UPDATE_ACTOR' }>) {
  return { command }
}

async function stored(
  t: Awaited<ReturnType<typeof setup>>['t'],
  encounterId: string,
  actorId: string
) {
  return t.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', encounterId))
      .unique()
    const actor = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId).eq('id', actorId))
      .unique()
    return { run, actor, receipts: await ctx.db.query('encounterRunCommands').collect() }
  })
}

describe('native Encounter UPDATE_ACTOR commands', () => {
  afterEach(() => vi.restoreAllMocks())
  it('persists direct CUSTOM updates, derives health, and leaves snapshots and cursor intact', async () => {
    const { t, other: gm, run, customActor } = await setup()
    const prepared = await stored(t, run.id, customActor.id)
    const activeState = encounterRunStateSchema.parse({
      ...JSON.parse(prepared.run!.stateJson),
      status: 'ACTIVE',
      round: 1,
      currentActorId: customActor.id
    })
    const activeActor = encounterRunActorStateSchema.parse({
      ...JSON.parse(prepared.actor!.stateJson),
      initiative: 12,
      manualOrder: 0
    })
    const activeProjection = encounterGmProjectionDtoSchema.parse({
      ...run,
      status: 'ACTIVE',
      round: 1,
      currentActorId: customActor.id,
      actors: run.actors.map((actor) =>
        actor.id === customActor.id ? { ...actor, initiative: 12, manualOrder: 0 } : actor
      )
    })
    await t.run(async (ctx) => {
      await ctx.db.patch(prepared.run!._id, {
        status: 'ACTIVE',
        stateJson: JSON.stringify(activeState),
        stateChecksum: checksumCanonicalJson(activeState),
        projectionJson: JSON.stringify(activeProjection),
        projectionChecksum: checksumCanonicalJson(activeProjection)
      })
      await ctx.db.patch(prepared.actor!._id, {
        stateJson: JSON.stringify(activeActor),
        stateChecksum: checksumCanonicalJson(activeActor)
      })
    })
    const before = await stored(t, run.id, customActor.id)
    const sideId = encounterRunStateSchema.parse(JSON.parse(before.run!.stateJson)).sides[0]!.id
    const result = await gm.caller.mutation(
      execute,
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
    const after = await stored(t, run.id, customActor.id)
    const actorState = encounterRunActorStateSchema.parse(JSON.parse(after.actor!.stateJson))
    expect(actorState).toMatchObject({
      currentHitPoints: 2,
      tempHitPoints: 3,
      conditions: [{ label: 'Prone' }],
      sideId
    })
    expect(actorState.snapshot).toEqual(
      encounterRunActorStateSchema.parse(JSON.parse(before.actor!.stateJson)).snapshot
    )
    expect(actorState.initiative).toBe(12)
    expect(actorState.manualOrder).toBe(0)
    expect(result.projection.currentActorId).toBe(customActor.id)
    expect(encounterRunStateSchema.parse(JSON.parse(after.run!.stateJson)).currentActorId).toBe(
      encounterRunStateSchema.parse(JSON.parse(before.run!.stateJson)).currentActorId
    )
    expect(
      after.receipts.find((receipt) => receipt.commandType === 'UPDATE_ACTOR')?.characterReceiptId
    ).toBeNull()
  }, 30000)

  it('bridges a Character Sheet command, retains max override, and replays its original Encounter result', async () => {
    const { t, owner, other: gm, character, run, characterActor, readState } = await setup()
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
    const command = update({
      type: 'UPDATE_ACTOR',
      encounterId: run.id.toUpperCase(),
      commandId: commandId.toUpperCase(),
      expectedVersion: 0,
      actorId: characterActor.id.toUpperCase(),
      characterCommand: {
        type: 'ADJUST_HIT_POINTS',
        commandId: nestedCommandId,
        expectedVersion: 3,
        mode: 'DAMAGE',
        amount: 3
      }
    })
    const first = await gm.caller.mutation(execute, command)
    expect(first.projection.actors.find((actor) => actor.id === characterActor.id)).toMatchObject({
      currentHitPoints: 9,
      maxHitPoints: 15,
      sourceRevision: 4
    })
    expect(
      first.projection.actors.find((actor) => actor.id === characterActor.id)?.conditions
    ).toHaveLength(1)
    const after = await stored(t, run.id, characterActor.id)
    expect(
      encounterRunActorStateSchema.parse(JSON.parse(after.actor!.stateJson)).snapshot
    ).toMatchObject({
      sourceRevision: 4
    })
    const receipt = after.receipts.find((candidate) => candidate.commandId === commandId)!
    if (receipt.commandType !== 'UPDATE_ACTOR') throw new Error('Missing UPDATE_ACTOR receipt.')
    const nestedReceipt = (await readState()).receipts.find(
      (candidate) => candidate.commandId === nestedCommandId
    )
    expect(receipt.characterReceiptId).toBe(nestedReceipt?.id)
    expect((await readState()).receipts).toHaveLength(3)
    await gm.caller.mutation(
      execute,
      update({
        type: 'UPDATE_ACTOR',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        actorId: characterActor.id
      })
    )
    expect(
      await gm.caller.mutation(execute, {
        command: { ...command.command, encounterId: run.id, commandId }
      })
    ).toEqual(first)
    expect((await readState()).receipts).toHaveLength(3)

    await owner.caller.mutation(personalExecute, {
      id: character.id,
      command: {
        type: 'SET_HIT_POINTS',
        commandId: crypto.randomUUID(),
        expectedVersion: 4,
        current: 6
      }
    })
    const currentOuterCommandId = crypto.randomUUID()
    const replayedSheet = await gm.caller.mutation(
      execute,
      update({
        ...command.command,
        encounterId: run.id,
        commandId: currentOuterCommandId,
        expectedVersion: 2
      })
    )
    expect(
      replayedSheet.projection.actors.find((actor) => actor.id === characterActor.id)
    ).toMatchObject({ currentHitPoints: 6, maxHitPoints: 15, sourceRevision: 5 })
    const replayedReceipt = (await stored(t, run.id, characterActor.id)).receipts.find(
      (candidate) => candidate.commandId === currentOuterCommandId
    )
    if (replayedReceipt?.commandType !== 'UPDATE_ACTOR')
      throw new Error('Missing replayed UPDATE_ACTOR receipt.')
    expect(replayedReceipt.characterReceiptId).toBe(nestedReceipt?.id)
  }, 30000)

  it('rolls back Sheet, actor, Run, and both receipt streams when the bridge fails after Sheet execution', async () => {
    const { t, other: gm, run, characterActor, readState } = await setup()
    const before = await stored(t, run.id, characterActor.id)
    const beforeSheet = await readState()
    const original = sheetCommands.executeCharacterSheetCommand
    let sheetCompleted = false
    vi.spyOn(sheetCommands, 'executeCharacterSheetCommand').mockImplementation(async (...args) => {
      const result = await original(...args)
      sheetCompleted = true
      return result
    })
    const parseActor = encounterRunActorStateSchema.parse.bind(encounterRunActorStateSchema)
    vi.spyOn(encounterRunActorStateSchema, 'parse').mockImplementation((...args) => {
      if (sheetCompleted) throw new Error('Injected post-Sheet bridge failure')
      return parseActor(...args)
    })
    await expect(
      gm.caller.mutation(
        execute,
        update({
          type: 'UPDATE_ACTOR',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 0,
          actorId: characterActor.id,
          characterCommand: {
            type: 'ADJUST_HIT_POINTS',
            commandId: crypto.randomUUID(),
            expectedVersion: 1,
            mode: 'DAMAGE',
            amount: 1
          }
        })
      )
    ).rejects.toThrow('Injected post-Sheet bridge failure')
    expect(sheetCompleted).toBe(true)
    vi.restoreAllMocks()
    expect(await stored(t, run.id, characterActor.id)).toEqual(before)
    expect(await readState()).toEqual(beforeSheet)
  }, 30000)

  it('rejects character direct state, invalid sides, failed Sheet commands, and corrupt actor state without writes', async () => {
    const { t, other: gm, run, characterActor, customActor, readState } = await setup()
    const before = await stored(t, run.id, characterActor.id)
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
      await expect(gm.caller.mutation(execute, request)).rejects.toThrow()
    expect(await stored(t, run.id, characterActor.id)).toEqual(before)
    expect(await readState()).toEqual(beforeSheet)
    await t.run(async (ctx) => {
      const actor = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', customActor.id))
        .unique()
      if (!actor) throw new Error('Missing actor.')
      await ctx.db.patch(actor._id, { stateChecksum: '0'.repeat(64) })
    })
    await expect(
      gm.caller.mutation(
        execute,
        update({
          type: 'UPDATE_ACTOR',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 0,
          actorId: customActor.id
        })
      )
    ).rejects.toThrow('Stored Encounter actor mismatch.')
  }, 30000)
})
