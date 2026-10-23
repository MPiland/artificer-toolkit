import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { readTestActor } from '../../tests/fixtures/storedActors'
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
import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'
import {
  encounterExecuteInputSchema,
  encounterGmProjectionDtoSchema,
  type CreateEncounterBlueprintInputDto,
  type CreateEncounterInputDto,
  type EncounterBlueprintDto,
  type EncounterCommandInputDto,
  type EncounterCommandResultDto,
  type EncounterGmProjectionDto,
  type EncounterExecuteInput,
  type EncounterPlayerProjectionDto,
  type EncounterSummaryDto,
  type PendingEncounterRuleOccurrenceSummaryDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import { airElemental as rawAirElemental } from '@artificer-toolkit/source-data/srd/creatures/air-elemental.js'
import { barbarian } from '@artificer-toolkit/source-data/srd/classes/barbarian.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { encounterSummaryOf } from '../../tests/fixtures/encounterSummaries'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { fixture } from '../../tests/fixtures/characters'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { srdCreatureRecord, srdWolf as wolf } from '../../tests/fixtures/srdCreatures'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { api, internal } from '../_generated/api'
import { requireEncounterPolicySources } from './sourceDependencies'
import { projectPlayerEncounterProjection } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { executeEncounterCommand } from '../../tests/developmentClient'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  closeRoom,
  executeInRoom,
  invalidateRoomInputs,
  queueRoomRolls,
  readRoomRollCards,
  readRoomTimeline,
  roomDevelopmentClient,
  seedRoomContentSnapshots,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import {
  expectOtherMembersCommandRefusal,
  expectReusedCommandRefusal,
  expectUnavailableRefusal,
  rejection
} from '../../tests/fixtures/roomRefusals'

useLocalRoomWorker()

// Content the room loads must be publishable, so Creatures carry the seed's ATTACK rolls.
const airElemental = srdCreatureRecord(rawAirElemental.id)

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
const getEncounter = makeFunctionReference<
  'query',
  { encounterId: string },
  EncounterGmProjectionDto | EncounterPlayerProjectionDto
>('encounters/projectionReads:get')
const getActiveSession = makeFunctionReference<
  'query',
  { campaignId: string },
  EncounterSessionStateDto
>('encounters/activeReads:active')
const listEncounters = makeFunctionReference<
  'query',
  { campaignId: string },
  EncounterSummaryDto[]
>('encounters/projectionReads:list')
const getPendingOccurrence = makeFunctionReference<
  'query',
  { encounterId: string },
  PendingEncounterRuleOccurrenceSummaryDto | null
>('encounters/pendingReads:pendingRuleOccurrence')
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

async function configureAutomaticInitiative(
  t: Awaited<ReturnType<typeof fixture>>['t'],
  cadence: 'ENCOUNTER_START' | 'EACH_ROUND' = 'ENCOUNTER_START',
  procedure: 'ACTOR_ROLL' | 'SIDE_ROLL' = 'ACTOR_ROLL'
) {
  const { definitions, policyIds } = createEncounterInitiativeDefinitions([{ cadence, procedure }])
  await t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions
  })
  await importSeededSubjects(t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...wolf, subjectKind: 'CREATURE', document: wolf })]
  })
  return policyIds[0]!
}

async function setup(
  options: {
    manual?: boolean
    automatic?: boolean
    assisted?: boolean
    resource?: boolean
    eachRound?: boolean
    sideRoll?: boolean
    actorCount?: 2 | 3
  } = {}
) {
  const base = await fixture()
  if (options.resource) {
    const whirlwind = airElemental.features?.[1]
    const boundaryFeature = airElemental.features?.[0]
    if (!whirlwind || !boundaryFeature)
      throw new Error('Missing Air Elemental roll feature fixtures.')
    await importSeededSubjects(base.t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        importedSubject({
          ...airElemental,
          subjectKind: 'CREATURE',
          document: {
            ...airElemental,
            features: airElemental.features?.map((feature) =>
              feature.id === whirlwind.id
                ? {
                    ...feature,
                    rollDefinitions: [
                      {
                        id: 'whirlwind-private',
                        label: 'Private gust',
                        kind: 'ATTACK',
                        expression: { count: 1, die: 20, modifier: 3 },
                        rollMode: 'ADVANTAGE',
                        chargeCost: null,
                        order: 0
                      },
                      {
                        id: 'whirlwind-table',
                        label: 'Table gust',
                        kind: 'DAMAGE',
                        expression: { count: 2, die: 6, modifier: 0 },
                        rollMode: 'NORMAL',
                        chargeCost: 1,
                        order: 1
                      }
                    ]
                  }
                : feature.id === boundaryFeature.id
                  ? {
                      ...feature,
                      label: 'x'.repeat(78),
                      rollDefinitions: [
                        {
                          id: 'boundary-roll',
                          label: 'Boundary',
                          kind: 'ABILITY_CHECK',
                          expression: { count: 1, die: 20, modifier: 0 },
                          rollMode: 'NORMAL',
                          chargeCost: null,
                          order: 0
                        }
                      ]
                    }
                  : feature
            )
          }
        })
      ]
    })
  }
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Encounter commands',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const initiativePolicyDefinitionId =
    options.automatic || options.assisted
      ? await configureAutomaticInitiative(
          base.t,
          options.eachRound ? 'EACH_ROUND' : 'ENCOUNTER_START',
          options.sideRoll ? 'SIDE_ROLL' : 'ACTOR_ROLL'
        )
      : null
  if (options.assisted) await setAutoRollDice(base.t, base.owner.userId, false)
  if (options.manual || options.automatic || options.assisted) {
    const settings = await base.owner.caller.query(getPlaySettings, {
      campaignId: campaign.id
    })
    const { version, updatedAt: _updatedAt, ...fields } = settings
    await base.owner.caller.mutation(savePlaySettings, {
      ...fields,
      expectedVersion: version,
      automationMode: options.manual ? 'MANUAL' : 'ASSISTED',
      initiativePolicyDefinitionId,
      initiativeTieDefinitionId: null
    })
  }
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Command fixture',
    commandId: crypto.randomUUID(),
    enemies:
      options.actorCount === 3
        ? [
            { kind: 'CREATURE', sourceId: wolf.id },
            { kind: 'CREATURE', sourceId: wolf.id },
            { kind: 'CREATURE', sourceId: wolf.id }
          ]
        : options.assisted || options.actorCount === 2
          ? [
              { kind: 'CREATURE', sourceId: wolf.id },
              { kind: 'CREATURE', sourceId: wolf.id }
            ]
          : options.automatic
            ? [{ kind: 'CREATURE', sourceId: wolf.id }]
            : options.resource
              ? [{ kind: 'CREATURE', sourceId: airElemental.id }]
              : [{ kind: 'CUSTOM', label: 'Dummy', maxHitPoints: 1 }]
  })
  const createCommandId = crypto.randomUUID()
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: createCommandId
  })
  await attachFixtureRoom(base.t, campaign.id)
  return { ...base, campaign, blueprint, run, createCommandId }
}

function assistedResolution(
  current: EncounterCommandResultDto,
  expectedVersion: number,
  value: number
): EncounterExecuteInput {
  const pendingRequest = current.occurrence?.pending
  if (!current.occurrence || !pendingRequest || pendingRequest.kind !== 'INITIATIVE_EVIDENCE')
    throw new Error('Missing Assisted initiative request.')
  return {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: current.projection.id,
      commandId: crypto.randomUUID(),
      expectedVersion,
      correlationId: null,
      occurrenceId: current.occurrence.occurrenceId,
      expectedOccurrenceVersion: current.occurrence.occurrenceVersion,
      resolution: {
        kind: 'ENTER_INTEGER',
        requestId: pendingRequest.request.requestId,
        value
      }
    }
  }
}

async function resolveAssistedSideRoll(
  owner: Awaited<ReturnType<typeof fixture>>['owner'],
  current: EncounterCommandResultDto,
  expectedVersion: number
) {
  let value = 20
  for (const kind of ['INITIATIVE_EVIDENCE', 'INITIATIVE_EVIDENCE', 'INITIATIVE_ORDER']) {
    if (current.occurrence?.status !== 'PENDING')
      throw new Error('Expected pending Assisted side initiative.')
    const pending = current.occurrence.pending
    if (!pending) throw new Error('Missing Assisted side initiative request.')
    expect(pending.kind).toBe(kind)
    const resolution =
      pending.kind === 'INITIATIVE_EVIDENCE'
        ? {
            kind: 'ENTER_INTEGER' as const,
            requestId: pending.request.requestId,
            value: value--
          }
        : pending.kind === 'INITIATIVE_ORDER'
          ? {
              kind: 'INITIATIVE_ENTITY' as const,
              requestId: pending.requestId,
              entityId: pending.optionIds[0]!
            }
          : null
    if (!resolution) throw new Error('Unexpected Assisted side initiative request.')
    current = await executeInRoom(owner.caller, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: current.projection.id,
        commandId: crypto.randomUUID(),
        expectedVersion,
        correlationId: null,
        occurrenceId: current.occurrence.occurrenceId,
        expectedOccurrenceVersion: current.occurrence.occurrenceVersion,
        resolution
      }
    })
  }
  expect(current.occurrence?.status).toBe('COMPLETE')
  return current
}

/** Starts an Assisted EACH_ROUND Run and ends its first turn, leaving the wrap's initiative pending. */
async function pauseAssistedWrap(base: RoomFixture) {
  const { owner, run } = base
  let started = await executeInRoom(owner.caller, {
    command: {
      type: 'START',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: 0
    }
  })
  for (const value of [12, 11])
    started = await executeInRoom(owner.caller, assistedResolution(started, 0, value))
  expect(started.projection).toMatchObject({ version: 1, status: 'ACTIVE' })
  const first = await executeInRoom(owner.caller, {
    command: {
      type: 'ADVANCE_TURN',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: 1
    }
  })
  const wrapInput: EncounterExecuteInput = {
    command: {
      type: 'ADVANCE_TURN',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: 2
    }
  }
  const pending = await executeInRoom(owner.caller, wrapInput)
  expect(pending).toMatchObject({
    projection: {
      version: 2,
      round: 1,
      currentActorId: first.projection.currentActorId
    },
    occurrence: { status: 'PENDING' }
  })
  return { first, wrapInput, pending }
}

async function setupCharacterAutomatic(classOptions?: Parameters<typeof readyCharacterFixture>[0]) {
  const base = await readyCharacterFixture(classOptions)
  const campaign = await base.other.caller.mutation(createCampaign, {
    name: 'Character initiative commands',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const { draft, character } = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
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
      characterId: character.id,
      assignedAt: campaign.createdAt
    })
  })
  const initiativePolicyDefinitionId = await configureAutomaticInitiative(base.t)
  const settings = await base.other.caller.query(getPlaySettings, {
    campaignId: campaign.id
  })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await base.other.caller.mutation(savePlaySettings, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId,
    initiativeTieDefinitionId: null
  })
  const blueprint = await base.other.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Character initiative fixture',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CUSTOM', label: 'Dummy', maxHitPoints: 1 }]
  })
  const run = await base.other.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  await attachFixtureRoom(base.t, campaign.id)
  return {
    ...base,
    owner: base.other,
    campaign,
    blueprint,
    run,
    character
  }
}

function upsert(
  encounterId: string,
  expectedVersion: number,
  reminder: Extract<EncounterCommandInputDto, { type: 'UPSERT_REMINDER' }>['reminder'],
  commandId: string = crypto.randomUUID()
): { command: Extract<EncounterCommandInputDto, { type: 'UPSERT_REMINDER' }> } {
  return {
    command: {
      encounterId,
      commandId,
      expectedVersion,
      type: 'UPSERT_REMINDER',
      reminder
    }
  }
}

function remove(
  encounterId: string,
  expectedVersion: number,
  reminderId: string,
  commandId: string = crypto.randomUUID()
): { command: Extract<EncounterCommandInputDto, { type: 'REMOVE_REMINDER' }> } {
  return {
    command: {
      encounterId,
      commandId,
      expectedVersion,
      type: 'REMOVE_REMINDER',
      reminderId
    }
  }
}

type RoomFixture = {
  t: Awaited<ReturnType<typeof fixture>>['t']
  campaign: { id: string; createdAt: string }
  run: { id: string; version: number }
  owner: Awaited<ReturnType<typeof fixture>>['owner']
}

/** What Convex holds once the room checkpoints: the Run's rows, never the history the room keeps until the Run ends (D85). */
async function rows({ t, campaign }: Pick<RoomFixture, 't' | 'campaign'>) {
  await checkpointLiveRoom(campaign.id)
  return t.run(async (ctx) => ({
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    runs: await ctx.db.query('encounterRuns').collect(),
    actors: await ctx.db.query('encounterRunActors').collect(),
    rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
    participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
    sides: await ctx.db.query('encounterInitiativeSides').collect(),
    occurrences: await ctx.db.query('encounterRuleOccurrences').collect()
  }))
}

/** The command types the room committed past the Run's setup version, oldest first, as it sends them to the GM (D85). */
async function committedTypes({ owner, campaign, run }: RoomFixture) {
  return (await readRoomTimeline(owner.caller, campaign.id))
    .filter((entry) => entry.version > run.version)
    .sort((left, right) => left.version - right.version)
    .map((entry) => entry.commandType)
}

async function actorState(base: RoomFixture, actorId: string) {
  await checkpointLiveRoom(base.campaign.id)
  return base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id).eq('id', actorId))
      .unique()
    if (!row) throw new Error('Missing Encounter actor.')
    return readTestActor(ctx, row)
  })
}

async function addPlayer({ t, campaign }: Pick<RoomFixture, 't' | 'campaign'>, userId: string) {
  return t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
}

async function replaceActorResources(
  t: Awaited<ReturnType<typeof setup>>['t'],
  encounterId: string,
  actorId: string,
  resources: unknown
) {
  await t.run(async (ctx) => {
    const actor = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId).eq('id', actorId))
      .unique()
    if (!actor) throw new Error('Missing Encounter resource fixture.')
    await writeRunActor(
      { db: createConvexEncounterStore(ctx) },
      actor._id,
      encounterRunActorStateSchema.parse({ ...(await readTestActor(ctx, actor)), resources })
    )
  })
}

describe('native Encounter Run commands', () => {
  it('allows only one active Run per Campaign and preserves START replay', async () => {
    const { t, owner, campaign, blueprint, run } = await setup({ automatic: true })
    const sibling = await owner.caller.mutation(createRun, {
      campaignId: campaign.id,
      blueprintId: blueprint.id,
      commandId: crypto.randomUUID()
    })
    const start: EncounterExecuteInput = {
      command: {
        type: 'START',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0
      }
    }
    const siblingStart: EncounterExecuteInput = {
      command: { ...start.command, encounterId: sibling.id, commandId: crypto.randomUUID() }
    }
    const started = await executeInRoom(owner.caller, start)
    expect(await rejection(executeInRoom(owner.caller, siblingStart))).toMatchObject({
      reason: 'ACTIVE_ENCOUNTER_EXISTS',
      message: 'Campaign already has an active Encounter.'
    })
    await checkpointLiveRoom(campaign.id)
    expect(await owner.caller.query(getEncounter, { encounterId: sibling.id })).toEqual(sibling)
    const completed = await executeInRoom(owner.caller, {
      command: {
        type: 'COMPLETE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version
      }
    })
    const siblingStarted = await executeInRoom(owner.caller, siblingStart)
    expect(siblingStarted.projection.status).toBe('ACTIVE')
    await expect(executeInRoom(owner.caller, start)).resolves.toEqual({
      ...started,
      projection: completed.projection
    })
    await checkpointLiveRoom(campaign.id)
    expect(
      (await owner.caller.query(getActiveSession, { campaignId: campaign.id })).encounter
    ).toEqual(siblingStarted.projection)
    expect((await rows({ t, campaign })).runs.map((row) => row.status).sort()).toEqual([
      'ACTIVE',
      'COMPLETED'
    ])
  }, 30000)

  it('rechecks Campaign activation when pending initiative settles and rolls back a rejected response', async () => {
    const base = await setup({ assisted: true })
    const { owner, campaign, blueprint, run } = base
    const sibling = await owner.caller.mutation(createRun, {
      campaignId: campaign.id,
      blueprintId: blueprint.id,
      commandId: crypto.randomUUID()
    })
    const start = (encounterId: string): EncounterExecuteInput => ({
      command: { type: 'START', encounterId, commandId: crypto.randomUUID(), expectedVersion: 0 }
    })
    let first = await executeInRoom(owner.caller, start(run.id))
    let second = await executeInRoom(owner.caller, start(sibling.id))
    first = await executeInRoom(owner.caller, assistedResolution(first, 0, 15))
    first = await executeInRoom(owner.caller, assistedResolution(first, 0, 10))
    expect(first.projection.status).toBe('ACTIVE')
    second = await executeInRoom(owner.caller, assistedResolution(second, 0, 15))
    const response = assistedResolution(second, 0, 10)
    const before = await rows(base)
    expect(await rejection(executeInRoom(owner.caller, response))).toMatchObject({
      reason: 'ACTIVE_ENCOUNTER_EXISTS',
      message: 'Campaign already has an active Encounter.'
    })
    expect(await rows(base)).toEqual(before)
    await executeInRoom(owner.caller, {
      command: {
        type: 'COMPLETE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: first.projection.version
      }
    })
    const settled = await executeInRoom(owner.caller, response)
    expect(settled.projection.status).toBe('ACTIVE')
    await expect(executeInRoom(owner.caller, response)).resolves.toEqual(settled)
  }, 30000)

  it('adjusts Creature feature resources from durable rule facts', async () => {
    const base = await setup({ manual: true, resource: true })
    const { owner, campaign, run } = base
    const actor = run.actors[0]!
    const featureId = airElemental.features?.[1]?.id
    if (!featureId) throw new Error('Missing Air Elemental Whirlwind feature.')
    const use: EncounterExecuteInput = {
      command: {
        type: 'ADJUST_FEATURE_RESOURCE',
        encounterId: run.id.toUpperCase(),
        commandId: crypto.randomUUID().toUpperCase(),
        expectedVersion: 0,
        actorId: actor.id.toUpperCase(),
        featureId,
        direction: 'USE',
        amount: 1
      }
    }
    const used = await executeInRoom(owner.caller, use)
    expect(used).toMatchObject({
      roll: null,
      occurrence: null
    })
    expect(
      encounterGmProjectionDtoSchema
        .parse(used.projection)
        .actors[0]?.features.find((feature) => feature.id === featureId)?.resource
    ).toEqual(
      expect.objectContaining({
        used: 1,
        remaining: 0,
        maximum: 1,
        resetKind: 'MANUAL'
      })
    )
    await expect(executeInRoom(owner.caller, use)).resolves.toEqual(used)
    const beforeBound = await rows(base)
    await expectUnavailableRefusal(
      executeInRoom(owner.caller, {
        command: {
          ...use.command,
          commandId: crypto.randomUUID(),
          expectedVersion: 1
        }
      }),
      'Encounter feature resource usage is outside its available range.'
    )
    expect(await rows(base)).toEqual(beforeBound)
    await executeInRoom(owner.caller, {
      command: {
        type: 'SET_INITIATIVE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        actorId: actor.id,
        initiative: 1,
        manualOrder: 0
      }
    })
    await executeInRoom(owner.caller, {
      command: {
        type: 'START',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 2
      }
    })
    const restored = await executeInRoom(owner.caller, {
      command: {
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        actorId: actor.id,
        featureId,
        type: 'ADJUST_FEATURE_RESOURCE',
        direction: 'RESTORE',
        amount: 1
      }
    })
    expect(restored.projection).toMatchObject({ status: 'ACTIVE', version: 4 })
    expect((await actorState(base, actor.id)).resources).toMatchObject({
      featureCharges: { [featureId]: 0 }
    })
    // The room keeps each command's receipt until the Run ends (D85), so the timeline is where both adjustments show.
    const timeline = await readRoomTimeline(owner.caller, campaign.id)
    expect(
      timeline.filter((entry) => entry.commandType === 'ADJUST_FEATURE_RESOURCE')
    ).toHaveLength(2)
    expect(timeline).toContainEqual(
      expect.objectContaining({
        commandType: 'ADJUST_FEATURE_RESOURCE',
        visibility: 'PRIVATE'
      })
    )
  }, 30000)

  it('rolls immutable enemy actions privately or to TABLE with atomic charge use and replay', async () => {
    const base = await setup({ manual: true, resource: true })
    const { owner, other, campaign, run } = base
    const actor = run.actors[0]!
    const featureId = airElemental.features?.[1]?.id
    if (!featureId) throw new Error('Missing Air Elemental Whirlwind feature.')
    await addPlayer(base, other.userId)
    await executeInRoom(owner.caller, {
      command: {
        type: 'SET_INITIATIVE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0,
        actorId: actor.id,
        initiative: 1,
        manualOrder: 0
      }
    })
    await executeInRoom(owner.caller, {
      command: {
        type: 'START',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 1
      }
    })
    await queueRoomRolls(campaign.id, { rolls: [4, 15] })
    const privateResult = await executeInRoom(owner.caller, {
      command: {
        type: 'ROLL_ENEMY_ACTION',
        encounterId: run.id.toUpperCase(),
        commandId: crypto.randomUUID().toUpperCase(),
        expectedVersion: 2,
        actorId: actor.id.toUpperCase(),
        featureId,
        rollDefinitionId: 'whirlwind-private',
        visibility: 'PRIVATE'
      }
    })
    expect(privateResult).toMatchObject({
      projection: { status: 'ACTIVE', version: 3 },
      roll: {
        characterId: null,
        characterLabel: actor.label,
        source: {
          kind: 'ATTACK',
          label: 'Whirlwind (Recharge 4-6): Private gust'
        },
        ruleset: { systemId: srdSystemRecord.id },
        normalizedExpression: '1d20 + 3',
        evidence: { mode: 'ADVANTAGE', total: 19 }
      }
    })
    // A private roll posts no card: the table chat was never opened.
    await expect(readRoomRollCards(owner.caller, campaign.id)).rejects.toThrow(
      'Conversation not found.'
    )
    const privateActor = encounterGmProjectionDtoSchema
      .parse(privateResult.projection)
      .actors.find((candidate) => candidate.id === actor.id)
    if (!privateActor) throw new Error('Missing private enemy actor.')
    expect(
      privateActor.features.find((feature) => feature.id === featureId)?.resource
    ).toMatchObject({
      used: 0,
      remaining: 1
    })
    await owner.caller.mutation(api.account.updateProfile, {
      username: 'EncounterOwner',
      bio: null
    })
    const commandId = crypto.randomUUID()
    const tableInput: EncounterExecuteInput = {
      command: {
        type: 'ROLL_ENEMY_ACTION',
        encounterId: run.id,
        commandId,
        expectedVersion: 3,
        actorId: actor.id,
        featureId,
        rollDefinitionId: 'whirlwind-table',
        visibility: 'PUBLIC'
      }
    }
    await queueRoomRolls(campaign.id, { rolls: [3, 4] })
    const tableResult = await executeInRoom(owner.caller, tableInput)
    expect(tableResult).toMatchObject({
      projection: { status: 'ACTIVE', version: 4 },
      roll: {
        characterId: null,
        source: {
          kind: 'DAMAGE',
          label: 'Whirlwind (Recharge 4-6): Table gust'
        },
        normalizedExpression: '2d6',
        evidence: { keep: 'FIRST', total: 9 }
      }
    })
    const tableActor = encounterGmProjectionDtoSchema
      .parse(tableResult.projection)
      .actors.find((candidate) => candidate.id === actor.id)
    if (!tableActor) throw new Error('Missing TABLE enemy actor.')
    expect(tableActor.features.find((feature) => feature.id === featureId)?.resource).toMatchObject(
      {
        used: 1,
        remaining: 0,
        maximum: 1
      }
    )
    expect(await readRoomRollCards(owner.caller, campaign.id)).toEqual([tableResult.roll])
    expect((await actorState(base, actor.id)).resources).toMatchObject({
      featureCharges: { [featureId]: 1 }
    })
    const timeline = await readRoomTimeline(owner.caller, campaign.id)
    expect(timeline).toContainEqual(
      expect.objectContaining({
        commandType: 'ROLL_ENEMY_ACTION',
        visibility: 'TABLE'
      })
    )
    const playerTimeline = await readRoomTimeline(other.caller, campaign.id)
    expect(playerTimeline).toEqual(timeline.filter((entry) => entry.visibility === 'TABLE'))
    expect(playerTimeline).toHaveLength(1)
    expect(playerTimeline[0]?.roll).toEqual(tableResult.roll)
    // After the room releases the Run its history is gone, yet the retry still answers with the recorded
    // roll (rebuilt from the TABLE roll card in the conversation): no reroll (the queue holds 19) and no
    // second charge.
    const charged = await rows(base)
    await closeRoom(campaign.id)
    await queueRoomRolls(campaign.id, { rolls: [19], repeat: 19 })
    await expect(executeInRoom(owner.caller, tableInput)).resolves.toEqual(tableResult)
    expect(await rows(base)).toEqual(charged)
    expect(await readRoomRollCards(owner.caller, campaign.id)).toEqual([tableResult.roll])
    await queueRoomRolls(campaign.id, { rolls: [] })
    const boundaryFeatureId = airElemental.features?.[0]?.id
    if (!boundaryFeatureId) throw new Error('Missing Air Elemental boundary feature.')
    const boundaryInput: EncounterExecuteInput = {
      command: {
        type: 'ROLL_ENEMY_ACTION',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 4,
        actorId: actor.id,
        featureId: boundaryFeatureId,
        rollDefinitionId: 'boundary-roll',
        visibility: 'PRIVATE'
      }
    }
    const boundaryResult = await executeInRoom(owner.caller, boundaryInput)
    expect(boundaryResult.roll?.source.label).toBe(`${'x'.repeat(78)}:`)
    await expect(executeInRoom(owner.caller, boundaryInput)).resolves.toEqual(boundaryResult)
    expect((await rows(base)).actors).toEqual(charged.actors)
    expect(await readRoomRollCards(owner.caller, campaign.id)).toEqual([tableResult.roll])
    const beforeExhausted = await rows(base)
    await expectUnavailableRefusal(
      executeInRoom(owner.caller, {
        command: {
          ...tableInput.command,
          commandId: crypto.randomUUID(),
          expectedVersion: 5
        }
      }),
      'The enemy feature does not have enough charges.'
    )
    expect(await rows(base)).toEqual(beforeExhausted)
    expect(await readRoomRollCards(owner.caller, campaign.id)).toEqual([tableResult.roll])
  }, 30000)

  it('rolls an actor initiative in the room from its own dice and replays the recorded roll', async () => {
    const { owner, campaign, run } = await setup({ manual: true, resource: true })
    const actor = run.actors[0]!
    await executeInRoom(owner.caller, {
      command: {
        type: 'SET_INITIATIVE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0,
        actorId: actor.id,
        initiative: 1,
        manualOrder: 0
      }
    })
    await executeInRoom(owner.caller, {
      command: {
        type: 'START',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 1
      }
    })
    const command = {
      type: 'ROLL_ACTOR_INITIATIVE' as const,
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: 2,
      actorId: actor.id
    }
    // Every later die is a 1, so a retry that rolled again would differ from the recorded 14.
    await queueRoomRolls(campaign.id, { rolls: [13], repeat: 0 })
    const rolled = await executeInRoom(owner.caller, { command })
    expect(rolled.roll?.evidence.terms[0]?.rolls).toEqual([14])
    expect(await executeInRoom(owner.caller, { command })).toEqual(rolled)
  }, 30000)

  it('rejects enemy actions before activation and for missing or malformed definitions', async () => {
    const base = await setup({ manual: true, resource: true })
    const { owner, campaign, run } = base
    const actor = run.actors[0]!
    const featureId = airElemental.features?.[1]?.id
    if (!featureId) throw new Error('Missing Air Elemental Whirlwind feature.')
    expect(
      await rejection(
        executeInRoom(owner.caller, {
          command: {
            type: 'ROLL_ENEMY_ACTION',
            encounterId: run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: 0,
            actorId: actor.id,
            featureId,
            rollDefinitionId: 'whirlwind-private',
            visibility: 'PRIVATE'
          }
        })
      )
    ).toMatchObject({
      reason: 'ENCOUNTER_NOT_ACTIVE',
      message: 'Enemy actions require an active Encounter.'
    })
    await executeInRoom(owner.caller, {
      command: {
        type: 'SET_INITIATIVE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0,
        actorId: actor.id,
        initiative: 1,
        manualOrder: 0
      }
    })
    await executeInRoom(owner.caller, {
      command: {
        type: 'START',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 1
      }
    })
    await expectUnavailableRefusal(
      executeInRoom(owner.caller, {
        command: {
          type: 'ROLL_ENEMY_ACTION',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 2,
          actorId: actor.id,
          featureId,
          rollDefinitionId: 'missing',
          visibility: 'PRIVATE'
        }
      }),
      'Encounter enemy action is unavailable.'
    )
    // The room holds the Run, so Convex's copy is written only after the room releases it.
    await closeRoom(campaign.id)
    await replaceActorResources(base.t, run.id, actor.id, {
      featureCharges: { [featureId]: 0, stale: -1 }
    })
    const beforeMalformed = await rows(base)
    await expectUnavailableRefusal(
      executeInRoom(owner.caller, {
        command: {
          type: 'ROLL_ENEMY_ACTION',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 2,
          actorId: actor.id,
          featureId,
          rollDefinitionId: 'whirlwind-private',
          visibility: 'PRIVATE'
        }
      }),
      'Encounter feature resource state is invalid.'
    )
    expect(await rows(base)).toEqual(beforeMalformed)
  }, 30000)

  it('rejects enemy actions for Character actors', async () => {
    const { t, owner, run } = await setupCharacterAutomatic()
    const featureId = airElemental.features?.[1]?.id
    if (!featureId) throw new Error('Missing Air Elemental Whirlwind feature.')
    const actor = run.actors.find((candidate) => candidate.kind === 'CHARACTER')
    if (!actor) throw new Error('Missing Character actor.')
    // The room has not loaded the Run yet, so Convex's copy is the one it will read.
    await t.run((ctx) => activateFixtureRun(ctx, run.id, { round: 1, currentActorId: actor.id }))
    await expectUnavailableRefusal(
      executeInRoom(owner.caller, {
        command: {
          type: 'ROLL_ENEMY_ACTION',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 0,
          actorId: actor.id,
          featureId,
          rollDefinitionId: 'whirlwind-private',
          visibility: 'PRIVATE'
        }
      }),
      'Character actions must be rolled through the Character Sheet.'
    )
  }, 30000)

  it('rejects Character feature resource changes', async () => {
    const { owner, run } = await setupCharacterAutomatic()
    const actor = run.actors.find((candidate) => candidate.kind === 'CHARACTER')
    if (!actor) throw new Error('Missing Character actor.')
    await expectUnavailableRefusal(
      executeInRoom(owner.caller, {
        command: {
          type: 'ADJUST_FEATURE_RESOURCE',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 0,
          actorId: actor.id,
          featureId: 'feature',
          direction: 'USE',
          amount: 1
        }
      }),
      'Character resources must be changed through the Character Sheet.'
    )
  }, 30000)

  it('rejects creature rests for Character actors', async () => {
    const { t, owner, run } = await setupCharacterAutomatic()
    const actor = run.actors.find((candidate) => candidate.kind === 'CHARACTER')
    if (!actor) throw new Error('Missing Character actor.')
    await t.run((ctx) => activateFixtureRun(ctx, run.id, { round: 1, currentActorId: actor.id }))
    await expect(
      executeInRoom(owner.caller, {
        command: {
          type: 'CREATURE_REST',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 0,
          restKind: 'LONG',
          actorIds: [actor.id]
        }
      })
    ).rejects.toMatchObject({
      data: {
        code: 'DOMAIN_REJECTED',
        reason: 'TARGET_UNAVAILABLE',
        message: 'A Character rests through its Character Sheet.'
      }
    })
  }, 30000)

  it('restores from reconciled feature usage after a maximum decreases', async () => {
    const base = await setup({ resource: true })
    const { t, owner, run } = base
    const actor = run.actors[0]!
    const featureId = airElemental.features?.[1]?.id
    if (!featureId) throw new Error('Missing Air Elemental Whirlwind feature.')
    await replaceActorResources(t, run.id, actor.id, {
      featureCharges: { [featureId]: 2 }
    })
    const result = await executeInRoom(owner.caller, {
      command: {
        type: 'ADJUST_FEATURE_RESOURCE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0,
        actorId: actor.id,
        featureId,
        direction: 'RESTORE',
        amount: 1
      }
    })
    expect(
      encounterGmProjectionDtoSchema
        .parse(result.projection)
        .actors[0]?.features.find((feature) => feature.id === featureId)?.resource
    ).toMatchObject({ used: 0, remaining: 1, maximum: 1 })
    expect((await actorState(base, actor.id)).resources).toMatchObject({
      featureCharges: { [featureId]: 0 }
    })
  }, 30000)

  it('rejects malformed feature charge state without writes', async () => {
    const base = await setup({ resource: true })
    const { t, owner, campaign, run } = base
    const actor = run.actors[0]!
    const featureId = airElemental.features?.[1]?.id
    if (!featureId) throw new Error('Missing Air Elemental Whirlwind feature.')
    const use = (): EncounterExecuteInput => ({
      command: {
        type: 'ADJUST_FEATURE_RESOURCE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0,
        actorId: actor.id,
        featureId,
        direction: 'USE',
        amount: 1
      }
    })
    await replaceActorResources(t, run.id, actor.id, { featureCharges: [] })
    const before = await rows(base)
    await expectUnavailableRefusal(
      executeInRoom(owner.caller, use()),
      'Encounter feature resource state is invalid.'
    )
    expect(await rows(base)).toEqual(before)
    // The refused command loaded the Run into the room, so Convex's copy is rewritten after it releases the Run.
    await closeRoom(campaign.id)
    await replaceActorResources(t, run.id, actor.id, {
      featureCharges: { [featureId]: 0, stale: -1 }
    })
    const staleBefore = await rows(base)
    await expectUnavailableRefusal(
      executeInRoom(owner.caller, use()),
      'Encounter feature resource state is invalid.'
    )
    expect(await rows(base)).toEqual(staleBefore)
  }, 30000)

  it('pauses and resolves Assisted initiative without exposing partial Run state', async () => {
    const base = await setup({ assisted: true })
    const { owner, other, campaign, run } = base
    await addPlayer(base, other.userId)
    const startInput: EncounterExecuteInput = {
      command: {
        type: 'START',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0
      }
    }

    const pending = await executeInRoom(owner.caller, startInput)
    expect(pending.projection).toMatchObject({
      id: run.id,
      status: 'PREPARED',
      version: 0,
      round: 0,
      currentActorId: null
    })
    expect(pending.occurrence).toMatchObject({
      occurrenceVersion: 0,
      status: 'PENDING',
      pending: {
        kind: 'INITIATIVE_EVIDENCE',
        encounterVersion: 0,
        request: { min: 1, max: 20 }
      }
    })
    const pendingRows = await rows(base)
    expect(await owner.caller.query(getEncounter, { encounterId: run.id })).toEqual(
      pending.projection
    )
    expect(await owner.caller.query(listEncounters, { campaignId: campaign.id })).toEqual([
      encounterSummaryOf(encounterGmProjectionDtoSchema.parse(pending.projection))
    ])
    expect(
      (await owner.caller.query(getActiveSession, { campaignId: campaign.id })).encounter
    ).toBeNull()
    expect(await owner.caller.query(getPendingOccurrence, { encounterId: run.id })).toEqual(
      pending.occurrence?.pending
    )
    // D87: a PREPARED Run paused on a GM decision is unavailable to a player.
    await expect(other.caller.query(getEncounter, { encounterId: run.id })).rejects.toThrow(
      'Encounter is unavailable.'
    )
    expect(await other.caller.query(listEncounters, { campaignId: campaign.id })).toEqual([])
    await expect(other.caller.query(getPendingOccurrence, { encounterId: run.id })).rejects.toThrow(
      'Encounter is unavailable.'
    )
    expect(pendingRows.rounds).toEqual([])
    expect(pendingRows.participants).toEqual([])
    expect(pendingRows.occurrences).toMatchObject([
      {
        rootCommandId: startInput.command.commandId,
        state: 'PENDING',
        version: 0,
        expectedEncounterVersion: 0,
        completedAt: null
      }
    ])
    // A paused START commits nothing: the room's timeline holds no command past setup.
    expect(await committedTypes(base)).toEqual([])
    await expect(executeInRoom(owner.caller, startInput)).resolves.toEqual(pending)

    if (!pending.occurrence?.pending || pending.occurrence.pending.kind !== 'INITIATIVE_EVIDENCE')
      throw new Error('Missing Assisted initiative request.')
    const resolveInput: EncounterExecuteInput = {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0,
        correlationId: null,
        occurrenceId: pending.occurrence.occurrenceId,
        expectedOccurrenceVersion: 0,
        resolution: {
          kind: 'ENTER_INTEGER',
          requestId: pending.occurrence.pending.request.requestId,
          value: 12
        }
      }
    }
    const continued = await executeInRoom(owner.caller, resolveInput)
    expect(continued.projection).toMatchObject({
      status: 'PREPARED',
      version: 0,
      round: 0
    })
    expect(continued.occurrence).toMatchObject({
      occurrenceId: pending.occurrence.occurrenceId,
      occurrenceVersion: 1,
      status: 'PENDING',
      pending: { kind: 'INITIATIVE_EVIDENCE', encounterVersion: 0 }
    })
    expect(await rows(base)).toMatchObject({
      rounds: [],
      participants: [],
      occurrences: [{ state: 'PENDING', version: 1, expectedEncounterVersion: 0 }]
    })
    await expect(executeInRoom(owner.caller, resolveInput)).resolves.toEqual(continued)
    if (
      !continued.occurrence?.pending ||
      continued.occurrence.pending.kind !== 'INITIATIVE_EVIDENCE'
    )
      throw new Error('Missing second Assisted initiative request.')
    const finalResolveInput: EncounterExecuteInput = {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0,
        correlationId: null,
        occurrenceId: pending.occurrence.occurrenceId,
        expectedOccurrenceVersion: 1,
        resolution: {
          kind: 'ENTER_INTEGER',
          requestId: continued.occurrence.pending.request.requestId,
          value: 11
        }
      }
    }
    const settled = await executeInRoom(owner.caller, finalResolveInput)
    expect(settled.projection).toMatchObject({
      id: run.id,
      status: 'ACTIVE',
      version: 1,
      round: 1,
      currentActorId: expect.any(String)
    })
    expect(settled.occurrence).toEqual({
      occurrenceId: pending.occurrence.occurrenceId,
      occurrenceVersion: 2,
      status: 'COMPLETE',
      pending: null
    })
    const settledRows = await rows(base)
    expect(
      (await owner.caller.query(getActiveSession, { campaignId: campaign.id })).encounter
    ).toEqual(settled.projection)
    expect(await owner.caller.query(getPendingOccurrence, { encounterId: run.id })).toBeNull()
    expect(
      (await other.caller.query(getActiveSession, { campaignId: campaign.id })).encounter
    ).toEqual(
      projectPlayerEncounterProjection(encounterGmProjectionDtoSchema.parse(settled.projection), {
        userId: other.userId,
        characters: new Map(),
        unseenActorIds: new Set<string>(),
        unseenConditionTypeIds: new Set<string>()
      })
    )
    expect(settledRows.rounds).toMatchObject([{ status: 'ACTIVE', version: 1 }])
    expect(settledRows.participants).toHaveLength(2)
    expect(
      settledRows.participants.find((participant) => participant.status === 'ACTIVE')
    ).toMatchObject({
      actorId: settled.projection.currentActorId,
      initiativeScore: 14,
      turnOrderOrdinal: 0
    })
    expect(
      settledRows.participants.find((participant) => participant.status === 'READY')
    ).toMatchObject({ initiativeScore: 13, turnOrderOrdinal: 1 })
    expect(settledRows.occurrences).toMatchObject([
      {
        state: 'COMPLETED',
        version: 2,
        expectedEncounterVersion: 1,
        pendingSnapshotChecksum: null,
        completedAt: expect.any(String)
      }
    ])
    expect(await committedTypes(base)).toEqual(['START'])
    // The room journal replays each command's own receipt, shown over the current Run. Each retry is
    // checked against the stored receipt (terminal occurrence version, the resolution commands, the
    // initiative checksums) by `commandReplay.ts:180-210` and `turnResponseReplay.ts:60-95`, so the
    // receipt fields are exercised here rather than read.
    await expect(executeInRoom(owner.caller, resolveInput)).resolves.toEqual({
      ...continued,
      projection: settled.projection
    })
    await expect(executeInRoom(owner.caller, finalResolveInput)).resolves.toEqual(settled)
    await expect(executeInRoom(owner.caller, startInput)).resolves.toEqual({
      ...pending,
      projection: settled.projection
    })
    const firstAdvanceInput: EncounterExecuteInput = {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 1
      }
    }
    // A player ends only a turn they control; the GM's actors stay the GM's.
    expect(await rejection(executeInRoom(other.caller, firstAdvanceInput))).toMatchObject({
      reason: 'NOT_ACTOR_CONTROLLER'
    })
    const progressed = await executeInRoom(owner.caller, firstAdvanceInput)
    expect(progressed.projection).toMatchObject({
      status: 'ACTIVE',
      version: 2,
      round: 1
    })
    // A replay by command ID returns only to the user who issued it.
    await expectOtherMembersCommandRefusal(other.caller, campaign.id, firstAdvanceInput)
    expect(progressed.projection.currentActorId).not.toBe(settled.projection.currentActorId)
    // The receipt's `initiativeAdvance` for this same-round advance (`SAME_ROUND`, no new
    // initiative) is asserted in `apps/session-worker/src/roomEncounterTurns.test.ts:426-442`.
    expect((await rows(base)).participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: settled.projection.currentActorId,
          status: 'ACTED'
        }),
        expect.objectContaining({
          actorId: progressed.projection.currentActorId,
          status: 'ACTIVE'
        })
      ])
    )
    await expect(executeInRoom(owner.caller, resolveInput)).resolves.toEqual({
      ...continued,
      projection: progressed.projection
    })
    const secondAdvanceInput: EncounterExecuteInput = {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 2
      }
    }
    const wrapped = await executeInRoom(owner.caller, secondAdvanceInput)
    expect(wrapped.projection).toMatchObject({
      status: 'ACTIVE',
      version: 3,
      round: 2,
      currentActorId: settled.projection.currentActorId
    })
    const wrappedRows = await rows(base)
    expect(wrappedRows.rounds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ round: 1, status: 'COMPLETED' }),
        expect.objectContaining({ round: 2, status: 'ACTIVE' })
      ])
    )
    expect(
      wrappedRows.participants
        .filter((participant) => participant.round === 2)
        .sort((left, right) => (left.turnOrderOrdinal ?? -1) - (right.turnOrderOrdinal ?? -1))
        .map((participant) => participant.actorId)
    ).toEqual([settled.projection.currentActorId, progressed.projection.currentActorId])
    await expect(executeInRoom(owner.caller, firstAdvanceInput)).resolves.toEqual({
      ...progressed,
      projection: wrapped.projection
    })
    await expect(executeInRoom(owner.caller, secondAdvanceInput)).resolves.toEqual(wrapped)
    expect(
      (await readRoomTimeline(owner.caller, campaign.id))
        .map((entry) => entry.commandType)
        .filter((type) => type === 'ADVANCE_TURN')
    ).toEqual(['ADVANCE_TURN', 'ADVANCE_TURN'])
    expect(await readRoomTimeline(other.caller, campaign.id)).toEqual([])
    const currentActorId = wrapped.projection.currentActorId
    if (!currentActorId) throw new Error('Expected a current actor.')
    const granted = await executeInRoom(owner.caller, {
      command: {
        type: 'UPDATE_ACTOR',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: wrapped.projection.version,
        actorId: currentActorId,
        controllerUserIds: [other.userId]
      }
    })
    const playerAdvanceInput: EncounterExecuteInput = {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: granted.projection.version
      }
    }
    const playerAdvanced = await executeInRoom(other.caller, playerAdvanceInput)
    expect(playerAdvanced.projection).toMatchObject({
      status: 'ACTIVE',
      version: granted.projection.version + 1,
      currentActorId: progressed.projection.currentActorId
    })
    await checkpointLiveRoom(campaign.id)
    expect(playerAdvanced.projection).toEqual(
      projectPlayerEncounterProjection(
        encounterGmProjectionDtoSchema.parse(
          await owner.caller.query(getEncounter, { encounterId: run.id })
        ),
        {
          userId: other.userId,
          characters: new Map(),
          unseenActorIds: new Set<string>(),
          unseenConditionTypeIds: new Set<string>()
        }
      )
    )
    // The room alone holds the command rows and receipts (D85, D88). The ADVANCE_TURN row's player
    // actor, its `ruleOccurrenceId` and `ruleResultChecksum`, the receipt's `commandMetadataJson`
    // (`TURN_EFFECTS`, `terminalOccurrenceVersion`, `resolutionCommands`) and START's `commandType`
    // and `resultChecksum` are asserted in `apps/session-worker/src/roomEncounterTurns.test.ts:360-466`.
    await expect(executeInRoom(other.caller, playerAdvanceInput)).resolves.toEqual(playerAdvanced)
    await expectOtherMembersCommandRefusal(owner.caller, campaign.id, playerAdvanceInput)
  }, 30000)

  it('starts an Automatic Run through native sources, rules, and normalized initiative', async () => {
    const base = await setup({ automatic: true })
    const { owner, run } = base
    const input: EncounterExecuteInput = {
      command: {
        type: 'START',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0
      }
    }

    const started = await executeInRoom(owner.caller, input)
    expect(started.projection).toMatchObject({
      id: run.id,
      status: 'ACTIVE',
      version: 1,
      round: 1,
      currentActorId: run.actors[0]!.id
    })
    const stored = await rows(base)
    expect(stored.rounds).toMatchObject([
      {
        encounterId: run.id,
        procedure: 'ACTOR_ROLL',
        status: 'ACTIVE',
        nextTurnOrderOrdinal: 1,
        version: 1
      }
    ])
    expect(stored.participants).toMatchObject([
      {
        actorId: run.actors[0]!.id,
        status: 'ACTIVE',
        turnOrderOrdinal: 0,
        version: 3
      }
    ])
    const participant = stored.participants[0]!
    expect(participant.initiativeScore).toBeGreaterThanOrEqual(3)
    expect(participant.initiativeScore).toBeLessThanOrEqual(22)
    expect(participant.evaluation.occurrenceId).toMatch(/^[a-f0-9-]{36}$/)
    expect(participant.evaluation.resultChecksum).toMatch(/^[a-f0-9]{64}$/)
    expect(stored.occurrences).toMatchObject([
      {
        encounterId: run.id,
        rootCommandId: input.command.commandId,
        state: 'COMPLETED',
        version: 0,
        expectedEncounterVersion: 1,
        pendingSnapshotChecksum: null,
        completedAt: expect.any(String)
      }
    ])
    // The START receipt (its occurrence, version 1 and result checksum) lives in the room until the Run
    // ends: `apps/session-worker/src/roomEncounterTurns.test.ts:364-466` asserts its command row
    // (actor, `ruleOccurrenceId`, `ruleResultChecksum`), `commandMetadataJson` and result checksum, and the retry below is validated against it by `commandReplay.ts:180-210`.
    expect(await committedTypes(base)).toEqual(['START'])
    await expect(executeInRoom(owner.caller, input)).resolves.toEqual(started)
  }, 30000)

  it.each([false, true])(
    'runs native SIDE_ROLL start, side transitions, correction, and the %s EACH_ROUND wrap',
    async (eachRound) => {
      const base = await setup({
        assisted: true,
        sideRoll: true,
        actorCount: 3,
        eachRound
      })
      const { t, owner, run } = base
      const [first, second, third] = run.actors
      const storedRun = await t.run((ctx) => ctx.db.query('encounterRuns').unique())
      const [firstSide, secondSide] = encounterRunStateSchema.parse(
        JSON.parse(storedRun?.stateJson ?? '')
      ).sides
      if (!first || !second || !third || !firstSide || !secondSide)
        throw new Error('Missing SIDE_ROLL fixture identities.')
      await executeInRoom(owner.caller, {
        command: {
          type: 'UPDATE_ACTOR',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 0,
          actorId: second.id,
          sideId: firstSide.id
        }
      })
      await executeInRoom(owner.caller, {
        command: {
          type: 'UPDATE_ACTOR',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 1,
          actorId: third.id,
          sideId: firstSide.id
        }
      })
      const startInput: EncounterExecuteInput = {
        command: {
          type: 'START',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 2
        }
      }
      const startedPending = await executeInRoom(owner.caller, startInput)
      const started = await resolveAssistedSideRoll(owner, startedPending, 2)
      const initial = await rows(base)
      const initialSides = initial.sides.filter((side) => side.round === 1)
      const initialParticipants = initial.participants.filter(
        (participant) => participant.round === 1
      )
      expect(initialSides).toHaveLength(2)
      expect(initialSides.map((side) => side.sideId)).toEqual([firstSide.id, secondSide.id].sort())
      expect(initialSides.map((side) => side.sideOrderOrdinal).sort()).toEqual([0, 1])
      expect(initialParticipants.map((participant) => participant.turnOrderOrdinal).sort()).toEqual(
        [0, 1, 2]
      )
      expect(
        initialParticipants.filter((participant) => participant.sideId === firstSide.id)
      ).toHaveLength(2)
      const orderedParticipants = [...initialParticipants].sort(
        (left, right) => left.turnOrderOrdinal! - right.turnOrderOrdinal!
      )
      expect(started.projection.currentActorId).toBe(orderedParticipants[0]!.actorId)
      expect(initialParticipants.filter((participant) => participant.status === 'ACTIVE')).toEqual([
        orderedParticipants[0]
      ])
      expect(
        initialSides.filter((side) => side.status === 'ACTIVE').map((side) => side.sideId)
      ).toEqual([orderedParticipants[0]!.sideId])
      const compactSides = orderedParticipants
        .map((participant) => participant.sideId)
        .filter((sideId, index, values) => index === 0 || values[index - 1] !== sideId)
      expect(compactSides).toEqual(
        [...initialSides]
          .sort((left, right) => left.sideOrderOrdinal! - right.sideOrderOrdinal!)
          .map((side) => side.sideId)
      )
      let current = started
      for (let version = 3; version <= 4; version += 1) {
        current = await executeInRoom(owner.caller, {
          command: {
            type: 'ADVANCE_TURN',
            encounterId: run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: version
          }
        })
        expect(current.projection).toMatchObject({
          round: 1,
          currentActorId: orderedParticipants[version - 2]!.actorId
        })
      }
      current = await executeInRoom(owner.caller, {
        command: {
          type: 'ADVANCE_TURN',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 5
        }
      })
      if (eachRound) current = await resolveAssistedSideRoll(owner, current, 5)
      expect(current.projection).toMatchObject({
        round: 2,
        status: 'ACTIVE',
        version: 6
      })
      const roundTwo = (await rows(base)).participants.filter(
        (participant) => participant.round === 2
      )
      const lastActorId = [...roundTwo].sort(
        (left, right) => right.turnOrderOrdinal! - left.turnOrderOrdinal!
      )[0]?.actorId
      if (!lastActorId) throw new Error('Missing final SIDE_ROLL actor.')
      const correctionInput: EncounterExecuteInput = {
        command: {
          type: 'SET_CURRENT_ACTOR',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: current.projection.version,
          actorId: lastActorId
        }
      }
      const corrected = await executeInRoom(owner.caller, correctionInput)
      const afterCorrection = await executeInRoom(owner.caller, {
        command: {
          type: 'ADVANCE_TURN',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: corrected.projection.version
        }
      })
      let terminal = afterCorrection
      if (eachRound) {
        expect(afterCorrection).toMatchObject({
          projection: { round: 2, version: corrected.projection.version },
          occurrence: { status: 'PENDING' }
        })
        const [pendingRun] = (await rows(base)).runs
        expect(
          encounterRunStateSchema.parse(JSON.parse(pendingRun?.stateJson ?? ''))
        ).toMatchObject({
          round: 2,
          version: corrected.projection.version,
          currentActorId: lastActorId
        })
        terminal = await resolveAssistedSideRoll(
          owner,
          afterCorrection,
          corrected.projection.version
        )
      }
      expect(terminal.projection).toMatchObject({ round: 3, status: 'ACTIVE' })
      const completed = await executeInRoom(owner.caller, {
        command: {
          type: 'COMPLETE',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: terminal.projection.version
        }
      })
      expect(completed.projection).toMatchObject({
        status: 'COMPLETED',
        currentActorId: null
      })
      await expect(executeInRoom(owner.caller, startInput)).resolves.toEqual({
        ...startedPending,
        projection: completed.projection
      })
      await expect(executeInRoom(owner.caller, correctionInput)).resolves.toEqual({
        ...corrected,
        projection: completed.projection
      })
    },
    60000
  )

  it('resumes Automatic GM order choices at START and EACH_ROUND without manual score entry', async () => {
    const base = await setup({
      automatic: true,
      eachRound: true,
      actorCount: 2
    })
    const { owner, campaign, run } = base
    // Every initiative d20 lands on 5, so the two Creatures tie and the GM chooses the order.
    await queueRoomRolls(campaign.id, { rolls: [4], repeat: 4 })
    let version = 0
    for (const type of ['START', 'ADVANCE_TURN'] as const) {
      if (type === 'ADVANCE_TURN') {
        const sameRound = await executeInRoom(owner.caller, {
          command: {
            type,
            encounterId: run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: version
          }
        })
        version = sameRound.projection.version
      }
      const rootInput: EncounterExecuteInput = {
        command: {
          type,
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: version
        }
      }
      const pending = await executeInRoom(owner.caller, rootInput)
      const summary = pending.occurrence?.pending
      if (!pending.occurrence || !summary || summary.kind !== 'INITIATIVE_ORDER')
        throw new Error('Expected Automatic GM ordering choice.')
      expect(summary.optionIds).toHaveLength(2)
      const before = await rows(base)
      const resolution = {
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE' as const,
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: version,
          correlationId: null,
          occurrenceId: pending.occurrence.occurrenceId,
          expectedOccurrenceVersion: pending.occurrence.occurrenceVersion,
          resolution: {
            kind: 'INITIATIVE_ENTITY' as const,
            requestId: summary.requestId,
            entityId: summary.optionIds[0]!
          }
        }
      }
      await expectUnavailableRefusal(
        executeInRoom(owner.caller, {
          command: {
            ...resolution.command,
            resolution: {
              kind: 'ENTER_INTEGER',
              requestId: summary.requestId,
              value: 0
            }
          }
        }),
        'Initiative evidence is unavailable.'
      )
      await expect(executeInRoom(owner.caller, rootInput)).resolves.toEqual(pending)
      expect(await rows(base)).toEqual(before)
      const settled = await executeInRoom(owner.caller, resolution)
      expect(settled.projection).toMatchObject({
        version: version + 1,
        round: type === 'START' ? 1 : 2,
        currentActorId: summary.optionIds[0]
      })
      expect(settled.occurrence?.status).toBe('COMPLETE')
      version = settled.projection.version
      const after = await rows(base)
      await expect(executeInRoom(owner.caller, rootInput)).resolves.toEqual({
        ...pending,
        projection: settled.projection
      })
      await expect(executeInRoom(owner.caller, resolution)).resolves.toEqual(settled)
      expect(await rows(base)).toEqual(after)
    }
  }, 30000)

  it('reevaluates an Automatic EACH_ROUND wrap and records both settlement and advance', async () => {
    const base = await setup({ automatic: true, eachRound: true })
    const { owner, run } = base
    const started = await executeInRoom(owner.caller, {
      command: {
        type: 'START',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0
      }
    })
    const advanced = await executeInRoom(owner.caller, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version
      }
    })
    expect(advanced.projection).toMatchObject({ status: 'ACTIVE', round: 2 })
    // The wrap's receipt lives in the room until the Run ends. Its ROUND_WRAP `initiativeAdvance`
    // (next round, first actor) and the command row are asserted in the real room by
    // `apps/session-worker/test/nativeRoomTurnEffects.test.ts` ("a room ADVANCE_TURN that ends the
    // round", ENCOUNTER_START cadence); the plan is also asserted where the turn is chosen
    // (`packages/rules-runtime/src/__tests__/encounterTurnPreparation.test.ts:210-220`). Only the
    // EACH_ROUND receipt itself is not asserted anywhere; here the new round is rolled and stored
    // under that cadence.
    const originalTarget = (await rows(base)).rounds.find((row) => row.round === 2)!
    expect(originalTarget).toMatchObject({ cadence: 'EACH_ROUND', status: 'ACTIVE' })
    await executeInRoom(owner.caller, {
      command: {
        type: 'SET_ROUND',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        round: 1
      }
    })
    const revisit: EncounterExecuteInput = {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 3
      }
    }
    const beforeRevisit = await rows(base)
    expect(await rows(base)).toEqual(beforeRevisit)
    const revisited = await executeInRoom(owner.caller, revisit)
    expect(revisited.projection).toMatchObject({ round: 2, version: 4 })
    const afterRevisit = await rows(base)
    expect(afterRevisit.rounds.find((row) => row.round === 2)).toMatchObject({
      _id: originalTarget._id,
      createdAt: originalTarget.createdAt,
      version: originalTarget.version + 1,
      status: 'ACTIVE'
    })
    for (const previous of beforeRevisit.participants.filter((row) => row.round === 2))
      expect(afterRevisit.participants.find((row) => row._id === previous._id)).toMatchObject({
        createdAt: previous.createdAt,
        version: previous.version + 1
      })
    await expect(executeInRoom(owner.caller, revisit)).resolves.toEqual(revisited)
    expect(await rows(base)).toEqual(afterRevisit)
  }, 30000)

  it('pauses an Assisted EACH_ROUND wrap without moving the source cursor, then resolves and replays', async () => {
    const base = await setup({ assisted: true, eachRound: true })
    const { owner, run } = base
    const { first, wrapInput, pending } = await pauseAssistedWrap(base)
    const before = await rows(base)
    await expect(executeInRoom(owner.caller, wrapInput)).resolves.toEqual(pending)
    expect(await rows(base)).toEqual(before)
    const firstResolution = assistedResolution(pending, 2, 9)
    expect(
      await rejection(
        executeInRoom(owner.caller, {
          command: {
            type: 'SET_ROUND',
            encounterId: run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: 2,
            round: 3
          }
        })
      )
    ).toMatchObject({
      reason: 'PENDING_DECISION',
      message: 'An Encounter rule occurrence is awaiting resolution.'
    })
    expect(await rows(base)).toEqual(before)
    const secondPending = await executeInRoom(owner.caller, firstResolution)
    const terminalInput = assistedResolution(secondPending, 2, 8)
    const settled = await executeInRoom(owner.caller, terminalInput)
    expect(settled.projection).toMatchObject({
      status: 'ACTIVE',
      version: 3,
      round: 2
    })
    expect(first.projection.currentActorId).not.toBe(settled.projection.currentActorId)
    await expect(executeInRoom(owner.caller, wrapInput)).resolves.toEqual({
      ...pending,
      projection: settled.projection
    })
    const after = await rows(base)
    expect(before.runs[0]?.version).toBe(2)
    expect(after.rounds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ round: 1, status: 'COMPLETED' }),
        expect.objectContaining({ round: 2, status: 'ACTIVE', cadence: 'EACH_ROUND' })
      ])
    )
    const corrected = await executeInRoom(owner.caller, {
      command: {
        type: 'SET_ROUND',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        round: 3
      }
    })
    const beforeReplay = await rows(base)
    await expect(executeInRoom(owner.caller, wrapInput)).resolves.toEqual({
      ...pending,
      projection: corrected.projection
    })
    await expect(executeInRoom(owner.caller, terminalInput)).resolves.toMatchObject({
      projection: corrected.projection,
      occurrence: settled.occurrence
    })
    expect(await rows(base)).toEqual(beforeReplay)
  }, 30000)

  it('refuses a paused Assisted wrap whose source round moved, then resolves once it is restored', async () => {
    const base = await setup({ assisted: true, eachRound: true })
    const { t, owner } = base
    const { pending } = await pauseAssistedWrap(base)
    const before = await rows(base)
    const firstResolution = assistedResolution(pending, 2, 9)
    const source = before.rounds.find((row) => row.round === 1)!
    // The room holds the Run, so Convex's copy is changed only after the room releases it.
    await closeRoom(base.campaign.id)
    await t.run((ctx) => ctx.db.patch(source._id, { version: source.version + 1 }))
    const corrupt = await rows(base)
    await expectUnavailableRefusal(
      executeInRoom(owner.caller, firstResolution),
      'Initiative outgoing advancement is stale.'
    )
    expect(await rows(base)).toEqual(corrupt)
    await t.run((ctx) => ctx.db.patch(source._id, { version: source.version }))
    const secondPending = await executeInRoom(owner.caller, firstResolution)
    const settled = await executeInRoom(owner.caller, assistedResolution(secondPending, 2, 8))
    expect(settled.projection).toMatchObject({ status: 'ACTIVE', version: 3, round: 2 })
  }, 30000)

  it('rolls Creature initiative with its authoritative modifier and rejects stale source identity', async () => {
    const base = await setup({ automatic: true })
    const { t, owner, campaign, run } = base
    const actor = run.actors[0]!
    await queueRoomRolls(campaign.id, { rolls: [4] })
    const rolled = await executeInRoom(owner.caller, {
      command: {
        type: 'ROLL_ACTOR_INITIATIVE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0,
        actorId: actor.id
      }
    })
    // The log records the roll as made: 1d20 plus the initiative modifier.
    expect(rolled.roll).toMatchObject({
      characterId: null,
      characterLabel: actor.label,
      source: { kind: 'INITIATIVE', label: 'Initiative' },
      evidence: { total: 7, modifier: 2 }
    })
    expect(rolled.projection).toMatchObject({ version: 1 })
    expect(rolled.projection.actors).toContainEqual(
      expect.objectContaining({ id: actor.id, initiative: 7 })
    )
    expect((await actorState(base, actor.id)).initiative).toBe(7)

    // The room holds the Run, so Convex's copy is changed only after the room releases it.
    await closeRoom(campaign.id)
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
        .unique()
      if (!row) throw new Error('Missing Creature actor.')
      const state = structuredClone(await readTestActor(ctx, row))
      const snapshot = state.snapshot as { sourceRevision: number }
      snapshot.sourceRevision += 1
      await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, state)
    })
    await expectUnavailableRefusal(
      executeInRoom(owner.caller, {
        command: {
          type: 'ROLL_ACTOR_INITIATIVE',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 1,
          actorId: actor.id
        }
      }),
      'Encounter initiative actor source identity is stale.'
    )
  }, 30000)

  it('rolls Character initiative with its effective modifier and rejects stale source identity', async () => {
    const base = await setupCharacterAutomatic()
    const { t, owner, campaign, run, character } = base
    const actor = run.actors.find((candidate) => candidate.kind === 'CHARACTER')
    if (!actor) throw new Error('Missing Character actor.')
    await queueRoomRolls(campaign.id, { rolls: [4] })
    const rolled = await executeInRoom(owner.caller, {
      command: {
        type: 'ROLL_ACTOR_INITIATIVE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0,
        actorId: actor.id
      }
    })
    expect(rolled.roll).toMatchObject({
      characterId: character.id,
      characterLabel: actor.label,
      source: { kind: 'INITIATIVE', label: 'Initiative' },
      evidence: { total: 7, modifier: 2 }
    })
    expect(rolled.projection).toMatchObject({ version: 1 })
    expect(rolled.projection.actors).toContainEqual(
      expect.objectContaining({ id: actor.id, initiative: 7 })
    )
    expect((await actorState(base, actor.id)).initiative).toBe(7)

    await closeRoom(campaign.id)
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
        .unique()
      if (!row) throw new Error('Missing Character actor.')
      const state = structuredClone(await readTestActor(ctx, row))
      const snapshot = state.snapshot as { id: string }
      snapshot.id = crypto.randomUUID()
      await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, state)
    })
    await expectUnavailableRefusal(
      executeInRoom(owner.caller, {
        command: {
          type: 'ROLL_ACTOR_INITIATIVE',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 1,
          actorId: actor.id
        }
      }),
      'Encounter initiative actor source identity is stale.'
    )
  }, 30000)

  it('rolls initiative with advantage for a Character with Feral Instinct', async () => {
    const feralInstinct = barbarian.features?.find((feature) => feature.label === 'Feral Instinct')
    if (!feralInstinct) throw new Error('Missing SRD Feral Instinct.')
    const { owner, campaign, run } = await setupCharacterAutomatic({
      features: [{ ...feralInstinct, availableAtLevel: 1, effects: [] }]
    })
    const actor = run.actors.find((candidate) => candidate.kind === 'CHARACTER')
    if (!actor) throw new Error('Missing Character actor.')
    await queueRoomRolls(campaign.id, { rolls: [2, 15] })
    const rolled = await executeInRoom(owner.caller, {
      command: {
        type: 'ROLL_ACTOR_INITIATIVE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0,
        actorId: actor.id
      }
    })
    // Two d20s (3 and 16), keeping the higher, plus the +2 initiative modifier.
    expect(rolled.roll?.evidence).toMatchObject({
      mode: 'ADVANTAGE',
      terms: [{ rolls: [3, 16], subtotal: 16 }],
      modifier: 2,
      total: 18
    })
    expect(rolled.projection.actors).toContainEqual(
      expect.objectContaining({ id: actor.id, initiative: 18 })
    )
  }, 30000)

  it('starts a Manual Run through normalized initiative and replays the terminal command', async () => {
    const base = await setup({ manual: true })
    const { owner, campaign, run } = base
    const actorId = run.actors[0]!.id
    const setInitiative: EncounterExecuteInput = {
      command: {
        type: 'SET_INITIATIVE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0,
        actorId,
        initiative: 15,
        manualOrder: 0
      }
    }
    const set = await executeInRoom(owner.caller, setInitiative)
    expect(set.projection).toMatchObject({
      version: 1,
      actors: [{ id: actorId, initiative: 15, manualOrder: 0 }]
    })
    const input: EncounterExecuteInput = {
      command: {
        type: 'START',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 1
      }
    }

    const started = await executeInRoom(owner.caller, input)
    expect(started).toMatchObject({
      projection: {
        id: run.id,
        status: 'ACTIVE',
        version: 2,
        round: 1,
        currentActorId: run.actors[0]!.id
      },
      roll: null,
      occurrence: null
    })

    const stored = await rows(base)
    expect(stored.rounds).toHaveLength(1)
    expect(stored.rounds[0]).toMatchObject({
      encounterId: run.id,
      round: 1,
      procedure: 'MANUAL',
      cadence: 'ENCOUNTER_START',
      status: 'ACTIVE',
      nextTurnOrderOrdinal: 1,
      version: 1
    })
    expect(stored.participants).toHaveLength(1)
    expect(stored.participants[0]).toMatchObject({
      encounterId: run.id,
      actorId: run.actors[0]!.id,
      status: 'ACTIVE',
      initiativeScore: null,
      turnOrderOrdinal: 0,
      version: 2
    })
    expect(stored.sides).toHaveLength(0)
    expect(stored.occurrences).toHaveLength(1)
    // The receipt and command rows live in the room; the room committed both commands.
    expect(await committedTypes(base)).toEqual(['SET_INITIATIVE', 'START'])

    await expect(executeInRoom(owner.caller, setInitiative)).resolves.toEqual({
      ...set,
      projection: started.projection
    })

    const rollInput = {
      command: {
        type: 'ROLL_ACTOR_INITIATIVE' as const,
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        actorId
      }
    }
    await queueRoomRolls(campaign.id, { rolls: [4], repeat: 0 })
    // The wire schema lowercases ids before the room sees them, so mixed-case ids reach it normalized.
    const rolled = await executeInRoom(owner.caller, {
      command: {
        ...rollInput.command,
        encounterId: run.id.toUpperCase(),
        commandId: rollInput.command.commandId.toUpperCase(),
        actorId: actorId.toUpperCase()
      }
    })
    expect(rolled.roll).toMatchObject({
      characterId: null,
      characterLabel: run.actors[0]!.label,
      source: { kind: 'INITIATIVE', label: 'Initiative' },
      ruleset: { systemId: srdSystemRecord.id }
    })
    expect(rolled.roll).toMatchObject({
      normalizedExpression: '1d20',
      evidence: { total: 5 }
    })
    expect(rolled.projection).toMatchObject({
      version: 3,
      actors: [{ id: actorId, initiative: 5, manualOrder: 0 }]
    })
    expect((await actorState(base, actorId)).initiative).toBe(5)
    expect((await actorState(base, actorId)).manualOrder).toBe(0)
    expect((await rows(base)).participants[0]).toMatchObject({
      initiativeScore: null,
      turnOrderOrdinal: 0
    })
    expect(await readRoomTimeline(owner.caller, campaign.id)).toContainEqual(
      expect.objectContaining({
        commandType: 'ROLL_ACTOR_INITIATIVE',
        roll: rolled.roll
      })
    )
    // The retry answers from the receipt: a re-rolled die (19) would differ from the recorded 5.
    await queueRoomRolls(campaign.id, { rolls: [19], repeat: 19 })
    await expect(executeInRoom(owner.caller, rollInput)).resolves.toEqual(rolled)

    const completeInput: EncounterExecuteInput = {
      command: {
        type: 'COMPLETE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 3
      }
    }
    const completed = await executeInRoom(owner.caller, completeInput)
    expect(completed.projection).toMatchObject({
      status: 'COMPLETED',
      version: 4,
      currentActorId: null
    })
    // COMPLETE drops the initiative rows with the rest of the Run's children (Amendment 30).
    const afterComplete = await rows(base)
    expect({
      rounds: afterComplete.rounds,
      participants: afterComplete.participants
    }).toEqual({ rounds: [], participants: [] })
    await expect(executeInRoom(owner.caller, completeInput)).resolves.toEqual(completed)

    await expect(executeInRoom(owner.caller, input)).resolves.toEqual({
      ...started,
      projection: completed.projection
    })
    expect(
      await rejection(
        executeInRoom(owner.caller, {
          command: { ...input.command, commandId: crypto.randomUUID() }
        })
      )
    ).toMatchObject({
      reason: 'ENCOUNTER_NOT_ACTIVE',
      message: 'Completed Encounters are read-only.'
    })
  }, 30000)

  it('adds, edits, removes, and orders reminders while advancing once per command', async () => {
    const { owner, run } = await setup()
    const first = await executeInRoom(
      owner.caller,
      upsert(run.id, 0, {
        label: 'Later',
        timing: 'ROUND_NUMBER',
        round: 2,
        actorId: null,
        public: false,
        notes: null,
        order: 2
      })
    )
    const firstReminder = encounterGmProjectionDtoSchema.parse(first.projection).reminders[0]!
    const second = await executeInRoom(
      owner.caller,
      upsert(run.id, 1, {
        label: 'Earlier',
        timing: 'ROUND_START',
        round: null,
        actorId: null,
        public: true,
        notes: null,
        order: 1
      })
    )
    expect(
      encounterGmProjectionDtoSchema
        .parse(second.projection)
        .reminders.map((reminder) => reminder.label)
    ).toEqual(['Earlier', 'Later'])
    const edited = await executeInRoom(
      owner.caller,
      upsert(run.id, 2, {
        id: firstReminder.id,
        label: 'Edited',
        timing: 'ROUND_END',
        round: null,
        actorId: null,
        public: false,
        notes: 'changed',
        order: 0
      })
    )
    expect(edited.projection.version).toBe(3)
    expect(
      encounterGmProjectionDtoSchema
        .parse(edited.projection)
        .reminders.map((reminder) => reminder.label)
    ).toEqual(['Edited', 'Earlier'])
    const removed = await executeInRoom(owner.caller, remove(run.id, 3, firstReminder.id))
    expect(removed.projection.version).toBe(4)
    expect(
      encounterGmProjectionDtoSchema
        .parse(removed.projection)
        .reminders.map((reminder) => reminder.label)
    ).toEqual(['Earlier'])
  }, 30000)

  it('replays a receipt after later reminder writes and rejects changed expectedVersion', async () => {
    const base = await setup()
    const { t, owner, campaign, run } = base
    const command = upsert(run.id, 0, {
      label: 'Replay me',
      timing: 'ROUND_START',
      round: null,
      actorId: null,
      public: false,
      notes: null,
      order: 0
    })
    const original = await executeInRoom(owner.caller, command)
    const later = await executeInRoom(
      owner.caller,
      upsert(run.id, 1, {
        label: 'Later',
        timing: 'ROUND_END',
        round: null,
        actorId: null,
        public: false,
        notes: null,
        order: 0
      })
    )
    expect(await executeInRoom(owner.caller, command)).toEqual({
      ...original,
      projection: later.projection
    })
    // The same command ID with another expected version is different input, not a stale write.
    await expectReusedCommandRefusal(
      executeInRoom(owner.caller, {
        command: { ...command.command, expectedVersion: 999 }
      })
    )
    // The room holds the Run and its members, so Convex's membership is changed only after it releases them.
    await closeRoom(campaign.id)
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', campaign.id).eq('userId', owner.userId)
        )
        .unique()
      if (!membership) throw new Error('Missing owner membership.')
      await ctx.db.patch(membership._id, {
        status: 'LEFT',
        leftAt: new Date().toISOString()
      })
    })
    await expect(executeInRoom(owner.caller, command)).rejects.toThrow('Campaign not found.')
  }, 30000)

  it('treats UUID casing as equivalent for the Run, command, reminder, and actor IDs', async () => {
    const { owner, run } = await setup()
    const actorId = run.actors[0]!.id
    const reminderId = crypto.randomUUID()
    const commandId = crypto.randomUUID()
    const command = upsert(
      run.id.toUpperCase(),
      0,
      {
        id: reminderId.toUpperCase(),
        label: 'Case stable',
        timing: 'TURN_START',
        round: null,
        actorId: actorId.toUpperCase(),
        public: false,
        notes: null,
        order: 0
      },
      commandId.toUpperCase()
    )
    const original = await executeInRoom(owner.caller, command)
    const replay = await executeInRoom(owner.caller, {
      command: {
        ...command.command,
        encounterId: run.id,
        commandId,
        reminder: { ...command.command.reminder, id: reminderId, actorId }
      }
    })
    expect(replay).toEqual(original)
  }, 30000)

  it('replaces the prepared Run optional-combat snapshot without changing Campaign settings', async () => {
    const base = await setup()
    const { t, owner, campaign, run } = base
    const optional = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
      (definition) => definition.document.kind === 'DISARM'
    )
    if (!optional) throw new Error('Missing optional combat fixture.')
    await t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: [optional]
    })
    // The room reads the content snapshots that are current when it first activates.
    await seedRoomContentSnapshots(campaign.id)
    const settings = await owner.caller.query(getPlaySettings, {
      campaignId: campaign.id
    })
    const command = {
      command: {
        type: 'REPLACE_OPTIONAL_COMBAT_RULES',
        encounterId: run.id.toUpperCase(),
        commandId: crypto.randomUUID().toUpperCase(),
        expectedVersion: 0,
        definitionIds: [optional.id.toUpperCase()]
      }
    } satisfies EncounterExecuteInput
    const result = await executeInRoom(owner.caller, command)
    expect(result.projection).toMatchObject({
      version: 1,
      optionalCombatRules: [{ definitionId: optional.id, label: optional.label, kind: 'DISARM' }]
    })
    expect(await owner.caller.query(getPlaySettings, { campaignId: campaign.id })).toEqual(settings)
    const stored = await rows(base)
    const storedRun = stored.runs[0]
    if (!storedRun) throw new Error('Missing Encounter Run.')
    const state = encounterRunStateSchema.parse(JSON.parse(storedRun.stateJson))
    expect(state.optionalCombatSnapshot.definitions[0]).toMatchObject({
      definitionId: optional.id
    })
    expect(state.optionalCombatSnapshotChecksum).toBe(
      checksumCanonicalJson(state.optionalCombatSnapshot)
    )
    await expect(
      executeInRoom(owner.caller, {
        command: {
          ...command.command,
          encounterId: run.id,
          commandId: command.command.commandId.toLowerCase(),
          definitionIds: [optional.id]
        }
      })
    ).resolves.toEqual(result)
    expect(await rows(base)).toEqual(stored)
    // Convex owns this policy-source check, so it stays a direct call.
    await expect(
      t.run(async (ctx) => {
        const row = await ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
          .unique()
        if (!row) throw new Error('Missing Campaign.')
        return requireEncounterPolicySources(ctx, row, new Set([SRD_CONTENT_SOURCE.id]))
      })
    ).rejects.toThrow('active combat-policy dependency')
  }, 30000)

  it('replaces optional combat rules while active and rejects invalid or stale replacements', async () => {
    const base = await setup({ automatic: true })
    const { t, owner, campaign, run } = base
    const optional = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
      (definition) => definition.document.kind === 'DISARM'
    )
    if (!optional) throw new Error('Missing optional combat fixture.')
    await t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: [optional]
    })
    await seedRoomContentSnapshots(campaign.id)
    const startInput: EncounterExecuteInput = {
      command: {
        type: 'START',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0
      }
    }
    const started = await executeInRoom(owner.caller, startInput)
    expect(started.projection.status).toBe('ACTIVE')
    await expect(executeInRoom(owner.caller, startInput)).resolves.toEqual(started)
    const startedState = encounterRunStateSchema.parse(
      JSON.parse((await rows(base)).runs[0]!.stateJson)
    )
    const evaluationGraphId = startedState.initiativePolicySnapshot?.evaluationGraph.definitionId
    if (!evaluationGraphId) throw new Error('Missing frozen initiative graph.')
    // The room holds the Run and its content, so the new revision is published once it releases them.
    await closeRoom(campaign.id)
    await t.run(async (ctx) => {
      const graph = await ctx.db
        .query('reusableDefinitions')
        .withIndex('by_publicId', (q) => q.eq('id', evaluationGraphId))
        .unique()
      if (!graph) throw new Error('Missing current initiative graph.')
      // A published revision, which the room reads with the complete definition inventory.
      await ctx.db.patch(graph._id, {
        version: graph.version + 1,
        contractVersion: 1,
        publishedAt: new Date().toISOString(),
        publishedBy: srdSystemRecord.userId
      })
    })
    await seedRoomContentSnapshots(campaign.id)
    const replaceInput: EncounterExecuteInput = {
      command: {
        type: 'REPLACE_OPTIONAL_COMBAT_RULES',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        definitionIds: [optional.id]
      }
    }
    const replaced = await executeInRoom(owner.caller, replaceInput)
    expect(replaced.projection).toMatchObject({
      version: 2,
      optionalCombatRules: [{ definitionId: optional.id, kind: 'DISARM' }]
    })
    await expect(executeInRoom(owner.caller, replaceInput)).resolves.toEqual(replaced)
    const before = await rows(base)
    await expectUnavailableRefusal(
      executeInRoom(owner.caller, {
        command: {
          type: 'REPLACE_OPTIONAL_COMBAT_RULES',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 2,
          definitionIds: [crypto.randomUUID()]
        }
      }),
      'Optional combat definition is not currently available.'
    )
    expect(
      await rejection(
        executeInRoom(owner.caller, {
          command: {
            type: 'REPLACE_OPTIONAL_COMBAT_RULES',
            encounterId: run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: 1,
            definitionIds: []
          }
        })
      )
    ).toMatchObject({ reason: 'VERSION_STALE', message: 'Encounter version is stale.' })
    expect(await rows(base)).toEqual(before)
  }, 30000)

  it('rejects conflicting shared command IDs across CREATE and Runs', async () => {
    const first = await setup()
    // The second Run exists before the room's first command, so the room hydrates both.
    const secondRun = await first.owner.caller.mutation(createRun, {
      campaignId: first.campaign.id,
      blueprintId: first.blueprint.id,
      commandId: crypto.randomUUID()
    })
    expect(
      await rejection(
        executeInRoom(first.owner.caller, {
          command: {
            ...upsert(first.run.id, 0, {
              label: 'Conflict',
              timing: 'ROUND_START',
              round: null,
              actorId: null,
              public: false,
              notes: null,
              order: 0
            }).command,
            commandId: first.createCommandId
          }
        })
      )
    ).toMatchObject({
      reason: 'COMMAND_ID_REUSED',
      message: 'Command ID was already used with different input.'
    })
    const command = upsert(
      first.run.id,
      0,
      {
        label: 'Cross run',
        timing: 'ROUND_START',
        round: null,
        actorId: null,
        public: false,
        notes: null,
        order: 0
      },
      crypto.randomUUID()
    )
    await executeInRoom(first.owner.caller, command)
    await expectReusedCommandRefusal(
      executeInRoom(first.owner.caller, {
        command: { ...command.command, encounterId: secondRun.id }
      })
    )
  }, 30000)

  it('rejects stale, unknown-actor, and missing-reminder commands without writes', async () => {
    const base = await setup()
    const { owner, run } = base
    const before = await rows(base)
    expect(
      await rejection(
        executeInRoom(
          owner.caller,
          upsert(run.id, 1, {
            label: 'Stale',
            timing: 'ROUND_START',
            round: null,
            actorId: null,
            public: false,
            notes: null,
            order: 0
          })
        )
      )
    ).toMatchObject({ reason: 'VERSION_STALE', message: 'Encounter version is stale.' })
    await expectUnavailableRefusal(
      executeInRoom(
        owner.caller,
        upsert(run.id, 0, {
          label: 'Unknown actor',
          timing: 'TURN_START',
          round: null,
          actorId: crypto.randomUUID(),
          public: false,
          notes: null,
          order: 0
        })
      ),
      'Encounter actor was not found.'
    )
    await expectUnavailableRefusal(
      executeInRoom(owner.caller, remove(run.id, 0, crypto.randomUUID())),
      'Encounter reminder was not found.'
    )
    expect(await rows(base)).toEqual(before)
  }, 30000)

  it('rejects anonymous, player, revoked, archived, and completed-run commands', async () => {
    const base = await setup()
    const { t, owner, other, campaign, run } = base
    const command = upsert(run.id, 0, {
      label: 'Denied',
      timing: 'ROUND_START',
      round: null,
      actorId: null,
      public: false,
      notes: null,
      order: 0
    })
    await expect(
      roomDevelopmentClient(null).mutation(
        executeEncounterCommand,
        encounterExecuteInputSchema.parse(command)
      )
    ).rejects.toThrow('Unauthenticated')
    // Not a member yet: the Campaign is hidden from this caller.
    await expect(executeInRoom(other.caller, command)).rejects.toThrow('Campaign not found.')
    const membershipId = await addPlayer(base, other.userId)
    await invalidateRoomInputs(campaign.id, ['CAMPAIGN'])
    await expect(executeInRoom(other.caller, command)).rejects.toThrow('Encounter is unavailable.')
    await t.run((ctx) =>
      ctx.db.patch(membershipId, {
        status: 'LEFT',
        leftAt: new Date().toISOString()
      })
    )
    await invalidateRoomInputs(campaign.id, ['CAMPAIGN'])
    await expect(executeInRoom(other.caller, command)).rejects.toThrow('Campaign not found.')
    const setCampaignStatus = (status: 'ARCHIVED' | 'ACTIVE') =>
      t.run(async (ctx) => {
        const row = await ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
          .unique()
        if (!row) throw new Error('Missing Campaign.')
        await ctx.db.patch(row._id, { status })
      })
    await setCampaignStatus('ARCHIVED')
    await invalidateRoomInputs(campaign.id, ['CAMPAIGN'])
    await expect(executeInRoom(owner.caller, command)).rejects.toThrow(
      'Archived Campaigns are read-only.'
    )
    await setCampaignStatus('ACTIVE')
    await invalidateRoomInputs(campaign.id, ['CAMPAIGN'])
    await closeRoom(campaign.id)
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', run.id))
        .unique()
      if (!row) throw new Error('Missing Run.')
      const state = encounterRunStateSchema.parse(JSON.parse(row.stateJson))
      const completed = encounterRunStateSchema.parse({
        ...state,
        status: 'COMPLETED'
      })
      await ctx.db.patch(row._id, {
        status: 'COMPLETED',
        stateJson: JSON.stringify(completed),
        stateChecksum: checksumCanonicalJson(completed)
      })
    })
    expect(await rejection(executeInRoom(owner.caller, command))).toMatchObject({
      reason: 'ENCOUNTER_NOT_ACTIVE',
      message: 'Completed Encounters are read-only.'
    })
  }, 30000)

  it('rejects corrupt Run state', async () => {
    const { t, owner, campaign, run } = await setup()
    const command = upsert(run.id, 0, {
      label: 'Corrupt',
      timing: 'ROUND_START',
      round: null,
      actorId: null,
      public: false,
      notes: null,
      order: 0
    })
    const original = await executeInRoom(owner.caller, command)
    expect(original.projection.version).toBe(1)
    // The room serves an exact retry from its history while the Run is unchanged.
    await expect(executeInRoom(owner.caller, command)).resolves.toEqual(original)
    // The room holds the Run, so Convex's copy is corrupted only after it releases it.
    await closeRoom(campaign.id)
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', run.id))
        .unique()
      if (!row) throw new Error('Missing Run.')
      await ctx.db.patch(row._id, { stateChecksum: '0'.repeat(64) })
    })
    await expectUnavailableRefusal(
      executeInRoom(owner.caller, {
        command: {
          ...command.command,
          commandId: crypto.randomUUID(),
          expectedVersion: 1
        }
      }),
      'Stored Encounter policy snapshot mismatch.'
    )
  }, 30000)
})
