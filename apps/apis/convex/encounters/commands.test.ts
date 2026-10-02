import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { readReceiptHeaders, readReceiptHeader } from '../lib/receiptLedgers'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignPlaySettingsDto,
  SaveCampaignPlaySettingsInput
} from '@artificer-toolkit/schema/api/campaignSettings'
import {
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
  type EncounterTimelineDto,
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
import { importedSubject } from '../../tests/fixtures/publication'
import { srdCreatureRecord, srdWolf as wolf } from '../../tests/fixtures/srdCreatures'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { api, internal } from '../_generated/api'
import { requireEncounterPolicySources } from './sourceDependencies'
import { projectPlayerEncounterProjection } from '@artificer-toolkit/rules-runtime/encounterProjection'
import {
  executeInRoom,
  expectRedactedRoomRefusal,
  insertActiveLiveAuthority,
  replayInRoom,
  RoomCommandRefusal
} from '../../tests/fixtures/liveSessionWorker'
import type { LiveSessionEncounterRollInput } from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'

// Content the room loads must be publishable, so Creatures carry the seed's ATTACK rolls.
const airElemental = srdCreatureRecord(rawAirElemental.id)

const rollDice = makeFunctionReference<'query', LiveSessionEncounterRollInput, { dice: number[] }>(
  'liveSessions/encounterRoll:dice'
)
const rollCommit = makeFunctionReference<
  'mutation',
  LiveSessionEncounterRollInput & { draws: number[] },
  EncounterCommandResultDto
>('liveSessions/encounterRoll:commit')
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
const getActiveEncounter = makeFunctionReference<
  'query',
  { campaignId: string },
  EncounterGmProjectionDto | EncounterPlayerProjectionDto | null
>('encounters/projectionReads:active')
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
const getTimeline = makeFunctionReference<
  'query',
  { encounterId: string; cursor?: string; limit?: number },
  EncounterTimelineDto
>('encounters/timelineReads:timeline')
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
  await t.mutation(internal.content.import.importSubjects, {
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
    await base.t.mutation(internal.content.import.importSubjects, {
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
      manualReminderMode: 'OFF',
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
    manualReminderMode: 'OFF',
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

async function receipts(t: Awaited<ReturnType<typeof setup>>['t']) {
  return t.run((ctx) =>
    ctx.db
      .query('encounterRunCommands')
      .collect()
      .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
  )
}

async function runs(t: Awaited<ReturnType<typeof setup>>['t']) {
  return t.run((ctx) => ctx.db.query('encounterRuns').collect())
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
      encounterRunActorStateSchema.parse({ ...JSON.parse(actor.stateJson), resources })
    )
  })
}

describe('native Encounter Run commands', () => {
  it('allows only one active Run per Campaign and preserves START replay', async () => {
    const { owner, campaign, blueprint, run } = await setup({ automatic: true })
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
    await expect(executeInRoom(owner.caller, siblingStart)).rejects.toThrow(
      'Campaign already has an active Encounter.'
    )
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
    await expect(replayInRoom(owner.caller, start)).resolves.toEqual({
      ...started,
      projection: completed.projection
    })
    expect(await owner.caller.query(getActiveEncounter, { campaignId: campaign.id })).toEqual(
      siblingStarted.projection
    )
  })

  it('rechecks Campaign activation when pending initiative settles and rolls back a rejected response', async () => {
    const { t, owner, campaign, blueprint, run } = await setup({ assisted: true })
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
    const before = await t.run(async (ctx) => ({
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      runs: await ctx.db.query('encounterRuns').collect(),
      actors: await ctx.db.query('encounterRunActors').collect(),
      rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
      participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
      occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
      receipts: await ctx.db
        .query('encounterRuleReceipts')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRuleReceipts', headers)),
      commands: await ctx.db
        .query('encounterRunCommands')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
    }))
    await expect(executeInRoom(owner.caller, response)).rejects.toThrow(
      'Campaign already has an active Encounter.'
    )
    const after = await t.run(async (ctx) => ({
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      runs: await ctx.db.query('encounterRuns').collect(),
      actors: await ctx.db.query('encounterRunActors').collect(),
      rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
      participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
      occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
      receipts: await ctx.db
        .query('encounterRuleReceipts')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRuleReceipts', headers)),
      commands: await ctx.db
        .query('encounterRunCommands')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
    }))
    expect(after).toEqual(before)
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
    await expect(replayInRoom(owner.caller, response)).resolves.toEqual(settled)
  })

  it('adjusts Creature feature resources from durable rule facts', async () => {
    const { t, owner, run } = await setup({ manual: true, resource: true })
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
    await expect(replayInRoom(owner.caller, use)).resolves.toEqual(used)
    const beforeBound = await t.run(async (ctx) => ({
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      run: await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', run.id))
        .unique(),
      actor: await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
        .unique(),
      commands: await ctx.db
        .query('encounterRunCommands')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
    }))
    await expect(
      executeInRoom(owner.caller, {
        command: {
          ...use.command,
          commandId: crypto.randomUUID(),
          expectedVersion: 1
        }
      })
    ).rejects.toThrow(RoomCommandRefusal)
    const afterBound = await t.run(async (ctx) => ({
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      run: await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', run.id))
        .unique(),
      actor: await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
        .unique(),
      commands: await ctx.db
        .query('encounterRunCommands')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
    }))
    expect(afterBound).toEqual(beforeBound)
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
    const stored = await t.run(async (ctx) => ({
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      actor: await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
        .unique(),
      commands: await ctx.db
        .query('encounterRunCommands')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers)),
      ruleReceipts: await ctx.db
        .query('encounterRuleReceipts')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRuleReceipts', headers))
    }))
    expect(JSON.parse(stored.actor!.stateJson)).toMatchObject({
      resources: { featureCharges: { [featureId]: 0 } }
    })
    expect(
      stored.commands.filter((command) => command.commandType === 'ADJUST_FEATURE_RESOURCE')
    ).toHaveLength(2)
    expect(stored.ruleReceipts).toHaveLength(1)
    const timeline = await owner.caller.query(getTimeline, {
      encounterId: run.id
    })
    expect(timeline.entries).toContainEqual(
      expect.objectContaining({
        commandType: 'ADJUST_FEATURE_RESOURCE',
        visibility: 'PRIVATE'
      })
    )
  }, 30000)

  it('rolls immutable enemy actions privately or to TABLE with atomic charge use and replay', async () => {
    const { t, owner, other, run } = await setup({ manual: true, resource: true })
    const actor = run.actors[0]!
    const featureId = airElemental.features?.[1]?.id
    if (!featureId) throw new Error('Missing Air Elemental Whirlwind feature.')
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
    const samples = [4, 15]
    const privateEntropy = vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      ;(array as Uint32Array)[0] = samples.shift() ?? 0
      return array
    })
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
    privateEntropy.mockRestore()
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
    expect(
      await t.run((ctx) => ctx.db.query('campaignConversationEntries').collect())
    ).toHaveLength(0)
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
        visibility: 'TABLE'
      }
    }
    const tableSamples = [3, 4]
    const tableEntropy = vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      ;(array as Uint32Array)[0] = tableSamples.shift() ?? 0
      return array
    })
    const tableResult = await executeInRoom(owner.caller, tableInput)
    tableEntropy.mockRestore()
    expect(tableResult).toMatchObject({
      projection: { status: 'ACTIVE', version: 4 },
      roll: {
        characterId: null,
        source: {
          kind: 'DAMAGE',
          label: 'Whirlwind (Recharge 4-6): Table gust'
        },
        normalizedExpression: '2d6',
        evidence: { mode: 'NORMAL', total: 9 }
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
    const stored = await t.run(async (ctx) => {
      const entry = await ctx.db.query('campaignConversationEntries').unique()
      if (!entry) throw new Error('Missing TABLE roll entry.')
      const payload = await ctx.db
        .query('campaignConversationEntryPayloads')
        .withIndex('by_entryId', (q) => q.eq('entryId', entry.id))
        .unique()
      return {
        actor: await ctx.db.query('encounterRunActors').unique(),
        entry,
        payload
      }
    })
    expect(stored.payload).toMatchObject({
      kind: 'ROLL',
      roll: tableResult.roll,
      characterId: null,
      characterLabel: actor.label
    })
    expect(JSON.parse(stored.actor!.stateJson)).toMatchObject({
      resources: { featureCharges: { [featureId]: 1 } }
    })
    const timeline = await owner.caller.query(getTimeline, {
      encounterId: run.id
    })
    expect(timeline.entries).toContainEqual(
      expect.objectContaining({
        commandType: 'ROLL_ENEMY_ACTION',
        visibility: 'TABLE'
      })
    )
    await t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: run.campaignId,
        userId: other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: run.createdAt,
        joinedAt: run.createdAt,
        leftAt: null
      })
    )
    const playerTimeline = await other.caller.query(getTimeline, { encounterId: run.id })
    expect(playerTimeline).toEqual({
      entries: timeline.entries.filter((entry) => entry.visibility === 'TABLE'),
      nextCursor: null
    })
    expect(playerTimeline.entries).toHaveLength(1)
    expect(playerTimeline.entries[0]?.roll).toEqual(tableResult.roll)
    let replayEntropy = 0
    const replayRandom = vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      replayEntropy += 1
      return array
    })
    await expect(replayInRoom(owner.caller, tableInput)).resolves.toEqual(tableResult)
    replayRandom.mockRestore()
    expect(replayEntropy).toBe(0)
    expect(
      await t.run(async (ctx) => ({
        receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
        receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
        actor: await ctx.db.query('encounterRunActors').unique(),
        entries: await ctx.db.query('campaignConversationEntries').collect(),
        commands: await ctx.db
          .query('encounterRunCommands')
          .collect()
          .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
      }))
    ).toEqual({
      actor: stored.actor,
      entries: [stored.entry],
      receiptLedgers: expect.any(Array),
      receiptLedgerParts: expect.any(Array),
      commands: expect.any(Array)
    })
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
    await expect(replayInRoom(owner.caller, boundaryInput)).resolves.toEqual(boundaryResult)
    expect(
      await t.run(async (ctx) => ({
        actor: await ctx.db.query('encounterRunActors').unique(),
        entries: await ctx.db.query('campaignConversationEntries').collect()
      }))
    ).toEqual({ actor: stored.actor, entries: [stored.entry] })
    const beforeExhausted = await t.run(async (ctx) => ({
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      run: await ctx.db.query('encounterRuns').unique(),
      actor: await ctx.db.query('encounterRunActors').unique(),
      entries: await ctx.db.query('campaignConversationEntries').collect(),
      commands: await ctx.db
        .query('encounterRunCommands')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
    }))
    await expect(
      executeInRoom(owner.caller, {
        command: {
          ...tableInput.command,
          commandId: crypto.randomUUID(),
          expectedVersion: 5
        }
      })
    ).rejects.toThrow(RoomCommandRefusal)
    expect(
      await t.run(async (ctx) => ({
        receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
        receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
        run: await ctx.db.query('encounterRuns').unique(),
        actor: await ctx.db.query('encounterRunActors').unique(),
        entries: await ctx.db.query('campaignConversationEntries').collect(),
        commands: await ctx.db
          .query('encounterRunCommands')
          .collect()
          .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
      }))
    ).toEqual(beforeExhausted)
  }, 30000)

  it('names the dice a room roll draws and refuses draws that do not match them', async () => {
    const { t, owner, run } = await setup({ manual: true, resource: true })
    const actor = run.actors[0]!
    const featureId = airElemental.features?.[1]?.id
    if (!featureId) throw new Error('Missing Air Elemental Whirlwind feature.')
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
    const epoch = crypto.randomUUID()
    await t.run((ctx) =>
      insertActiveLiveAuthority(ctx, {
        campaignId: run.campaignId,
        epoch,
        createdAt: new Date().toISOString()
      })
    )
    const scope = {
      campaignId: run.campaignId,
      authorityEpoch: epoch,
      expectedUserId: owner.userId,
      expectedRole: 'OWNER' as const
    }
    const initiative = {
      type: 'ROLL_ACTOR_INITIATIVE' as const,
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: 2,
      actorId: actor.id
    }
    expect(await owner.caller.query(rollDice, { ...scope, command: initiative })).toEqual({
      dice: [20]
    })
    // The private gust rolls with advantage: two d20s.
    expect(
      await owner.caller.query(rollDice, {
        ...scope,
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
      })
    ).toEqual({ dice: [20, 20] })
    const runs = () => t.run((ctx) => ctx.db.query('encounterRuns').collect())
    const before = await runs()
    for (const draws of [[], [20], [3, 4]])
      await expect(
        owner.caller.mutation(rollCommit, { ...scope, command: initiative, draws })
      ).rejects.toThrow('The roll changed; roll again.')
    expect(await runs()).toEqual(before)
    const rolled = await owner.caller.mutation(rollCommit, {
      ...scope,
      command: initiative,
      draws: [13]
    })
    expect(rolled.roll?.evidence.terms[0]?.rolls).toEqual([14])
    // A retry names no dice and replays the recorded roll.
    expect(await owner.caller.query(rollDice, { ...scope, command: initiative })).toEqual({
      dice: []
    })
    expect(
      await owner.caller.mutation(rollCommit, { ...scope, command: initiative, draws: [] })
    ).toEqual(rolled)
  })

  it('rejects enemy actions before activation, for Character actors, and for missing definitions', async () => {
    const prepared = await setup({ manual: true, resource: true })
    const preparedActor = prepared.run.actors[0]!
    const featureId = airElemental.features?.[1]?.id
    if (!featureId) throw new Error('Missing Air Elemental Whirlwind feature.')
    await expect(
      executeInRoom(prepared.owner.caller, {
        command: {
          type: 'ROLL_ENEMY_ACTION',
          encounterId: prepared.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 0,
          actorId: preparedActor.id,
          featureId,
          rollDefinitionId: 'whirlwind-private',
          visibility: 'PRIVATE'
        }
      })
    ).rejects.toThrow('Enemy actions require an active Encounter.')
    await executeInRoom(prepared.owner.caller, {
      command: {
        type: 'SET_INITIATIVE',
        encounterId: prepared.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0,
        actorId: preparedActor.id,
        initiative: 1,
        manualOrder: 0
      }
    })
    await executeInRoom(prepared.owner.caller, {
      command: {
        type: 'START',
        encounterId: prepared.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 1
      }
    })
    await expect(
      executeInRoom(prepared.owner.caller, {
        command: {
          type: 'ROLL_ENEMY_ACTION',
          encounterId: prepared.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 2,
          actorId: preparedActor.id,
          featureId,
          rollDefinitionId: 'missing',
          visibility: 'PRIVATE'
        }
      })
    ).rejects.toThrow(RoomCommandRefusal)
    await replaceActorResources(prepared.t, prepared.run.id, preparedActor.id, {
      featureCharges: { [featureId]: 0, stale: -1 }
    })
    const beforeMalformed = await prepared.t.run(async (ctx) => ({
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      run: await ctx.db.query('encounterRuns').unique(),
      actor: await ctx.db.query('encounterRunActors').unique(),
      commands: await ctx.db
        .query('encounterRunCommands')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
    }))
    await expect(
      executeInRoom(prepared.owner.caller, {
        command: {
          type: 'ROLL_ENEMY_ACTION',
          encounterId: prepared.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 2,
          actorId: preparedActor.id,
          featureId,
          rollDefinitionId: 'whirlwind-private',
          visibility: 'PRIVATE'
        }
      })
    ).rejects.toThrow(RoomCommandRefusal)
    expect(
      await prepared.t.run(async (ctx) => ({
        receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
        receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
        run: await ctx.db.query('encounterRuns').unique(),
        actor: await ctx.db.query('encounterRunActors').unique(),
        commands: await ctx.db
          .query('encounterRunCommands')
          .collect()
          .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
      }))
    ).toEqual(beforeMalformed)
    const character = await setupCharacterAutomatic()
    const characterActor = character.run.actors.find((candidate) => candidate.kind === 'CHARACTER')
    if (!characterActor) throw new Error('Missing Character actor.')
    await character.t.run((ctx) =>
      activateFixtureRun(ctx, character.run.id, { round: 1, currentActorId: characterActor.id })
    )
    await expect(
      executeInRoom(character.owner.caller, {
        command: {
          type: 'ROLL_ENEMY_ACTION',
          encounterId: character.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 0,
          actorId: characterActor.id,
          featureId,
          rollDefinitionId: 'whirlwind-private',
          visibility: 'PRIVATE'
        }
      })
    ).rejects.toThrow(RoomCommandRefusal)
  }, 30000)

  it('rejects Character feature resource changes', async () => {
    const { owner, run } = await setupCharacterAutomatic()
    const actor = run.actors.find((candidate) => candidate.kind === 'CHARACTER')
    if (!actor) throw new Error('Missing Character actor.')
    await expect(
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
      })
    ).rejects.toThrow(RoomCommandRefusal)
  })

  it('restores from reconciled feature usage after a maximum decreases', async () => {
    const { t, owner, run } = await setup({ resource: true })
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
    const stored = await t.run(async (ctx) =>
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
        .unique()
    )
    expect(JSON.parse(stored!.stateJson)).toMatchObject({
      resources: { featureCharges: { [featureId]: 0 } }
    })
  }, 30000)

  it('rejects malformed feature charge state without writes', async () => {
    const { t, owner, run } = await setup({ resource: true })
    const actor = run.actors[0]!
    const featureId = airElemental.features?.[1]?.id
    if (!featureId) throw new Error('Missing Air Elemental Whirlwind feature.')
    await replaceActorResources(t, run.id, actor.id, { featureCharges: [] })
    const before = await t.run(async (ctx) => ({
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      run: await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', run.id))
        .unique(),
      actor: await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
        .unique(),
      commands: await ctx.db
        .query('encounterRunCommands')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
    }))
    await expect(
      executeInRoom(owner.caller, {
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
    ).rejects.toThrow(RoomCommandRefusal)
    const after = await t.run(async (ctx) => ({
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      run: await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', run.id))
        .unique(),
      actor: await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
        .unique(),
      commands: await ctx.db
        .query('encounterRunCommands')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
    }))
    expect(after).toEqual(before)
    await replaceActorResources(t, run.id, actor.id, {
      featureCharges: { [featureId]: 0, stale: -1 }
    })
    const staleBefore = await t.run(async (ctx) => ({
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      run: await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', run.id))
        .unique(),
      actor: await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
        .unique(),
      commands: await ctx.db
        .query('encounterRunCommands')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
    }))
    await expect(
      executeInRoom(owner.caller, {
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
    ).rejects.toThrow(RoomCommandRefusal)
    const staleAfter = await t.run(async (ctx) => ({
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      run: await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', run.id))
        .unique(),
      actor: await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
        .unique(),
      commands: await ctx.db
        .query('encounterRunCommands')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
    }))
    expect(staleAfter).toEqual(staleBefore)
  }, 30000)

  it('pauses and resolves Assisted initiative without exposing partial Run state', async () => {
    const { t, owner, other, campaign, run } = await setup({ assisted: true })
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
    expect(await owner.caller.query(getEncounter, { encounterId: run.id })).toEqual(
      pending.projection
    )
    expect(await owner.caller.query(listEncounters, { campaignId: campaign.id })).toEqual([
      encounterSummaryOf(encounterGmProjectionDtoSchema.parse(pending.projection))
    ])
    expect(await owner.caller.query(getActiveEncounter, { campaignId: campaign.id })).toBeNull()
    expect(await owner.caller.query(getPendingOccurrence, { encounterId: run.id })).toEqual(
      pending.occurrence?.pending
    )
    await t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
    )
    expect(await other.caller.query(getEncounter, { encounterId: run.id })).toEqual(
      projectPlayerEncounterProjection(encounterGmProjectionDtoSchema.parse(pending.projection), {
        userId: other.userId,
        characters: new Map()
      })
    )
    expect(await other.caller.query(listEncounters, { campaignId: campaign.id })).toEqual([])
    expect(await other.caller.query(getPendingOccurrence, { encounterId: run.id })).toBeNull()
    const pendingStored = await t.run(async (ctx) => ({
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
      participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
      occurrence: await ctx.db.query('encounterRuleOccurrences').unique(),
      receipts: await ctx.db
        .query('encounterRuleReceipts')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRuleReceipts', headers)),
      commands: await ctx.db
        .query('encounterRunCommands')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
    }))
    expect(pendingStored.rounds).toEqual([])
    expect(pendingStored.participants).toEqual([])
    expect(pendingStored.receipts).toEqual([])
    expect(pendingStored.commands).toHaveLength(1)
    expect(pendingStored.occurrence).toMatchObject({
      rootCommandId: startInput.command.commandId,
      state: 'PENDING',
      version: 0,
      expectedEncounterVersion: 0,
      completedAt: null
    })
    await expect(replayInRoom(owner.caller, startInput)).resolves.toEqual(pending)

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
    const continuedStored = await t.run(async (ctx) => ({
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
      participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
      occurrence: await ctx.db.query('encounterRuleOccurrences').unique(),
      receipts: await ctx.db
        .query('encounterRuleReceipts')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRuleReceipts', headers)),
      commands: await ctx.db
        .query('encounterRunCommands')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
    }))
    expect(continuedStored).toMatchObject({
      rounds: [],
      participants: [],
      receipts: [],
      commands: expect.arrayContaining([expect.objectContaining({ commandType: 'CREATE' })]),
      occurrence: { state: 'PENDING', version: 1, expectedEncounterVersion: 0 }
    })
    await expect(replayInRoom(owner.caller, resolveInput)).resolves.toEqual(continued)
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
      outcome: null,
      pending: null
    })
    expect(await owner.caller.query(getActiveEncounter, { campaignId: campaign.id })).toEqual(
      settled.projection
    )
    expect(await owner.caller.query(getPendingOccurrence, { encounterId: run.id })).toBeNull()
    expect(await other.caller.query(getActiveEncounter, { campaignId: campaign.id })).toEqual(
      projectPlayerEncounterProjection(encounterGmProjectionDtoSchema.parse(settled.projection), {
        userId: other.userId,
        characters: new Map()
      })
    )
    const settledStored = await t.run(async (ctx) => ({
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      round: await ctx.db.query('encounterInitiativeRounds').unique(),
      participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
      occurrence: await ctx.db.query('encounterRuleOccurrences').unique(),
      receipt: await ctx.db
        .query('encounterRuleReceipts')
        .unique()
        .then((header) =>
          header ? readReceiptHeader(ctx, 'encounterRuleReceipts', header) : null
        ),
      commands: await ctx.db
        .query('encounterRunCommands')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
    }))
    expect(settledStored.round).toMatchObject({ status: 'ACTIVE', version: 1 })
    expect(settledStored.participants).toHaveLength(2)
    const activeParticipant = settledStored.participants.find(
      (participant) => participant.status === 'ACTIVE'
    )
    expect(activeParticipant).toMatchObject({
      actorId: settled.projection.currentActorId,
      initiativeScore: 14,
      turnOrderOrdinal: 0
    })
    expect(
      settledStored.participants.find((participant) => participant.status === 'READY')
    ).toMatchObject({ initiativeScore: 13, turnOrderOrdinal: 1 })
    expect(settledStored.occurrence).toMatchObject({
      state: 'COMPLETED',
      version: 2,
      expectedEncounterVersion: 1,
      pendingSnapshotChecksum: null,
      completedAt: expect.any(String)
    })
    expect(JSON.parse(settledStored.receipt?.commandMetadataJson ?? '')).toMatchObject({
      transition: 'TURN_EFFECTS',
      terminalOccurrenceVersion: 2,
      resolutionCommands: [
        {
          commandId: resolveInput.command.commandId,
          kind: 'ENTER_INTEGER',
          expectedOccurrenceVersion: 0
        },
        {
          commandId: finalResolveInput.command.commandId,
          kind: 'ENTER_INTEGER',
          expectedOccurrenceVersion: 1
        }
      ]
    })
    expect(settledStored.commands).toHaveLength(2)
    // The room journal replays each command's own receipt, shown over the current Run.
    await expect(replayInRoom(owner.caller, resolveInput)).resolves.toEqual({
      ...continued,
      projection: settled.projection
    })
    await expect(replayInRoom(owner.caller, finalResolveInput)).resolves.toEqual(settled)
    await expect(replayInRoom(owner.caller, startInput)).resolves.toEqual({
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
    await expect(executeInRoom(other.caller, firstAdvanceInput)).rejects.toThrow(
      'NOT_ACTOR_CONTROLLER'
    )
    const progressed = await executeInRoom(owner.caller, firstAdvanceInput)
    expect(progressed.projection).toMatchObject({
      status: 'ACTIVE',
      version: 2,
      round: 1
    })
    // A replay by command ID returns only to the user who issued it.
    await expect(executeInRoom(other.caller, firstAdvanceInput)).rejects.toThrow(
      'The command ID was already used for different input.'
    )
    expect(progressed.projection.currentActorId).not.toBe(settled.projection.currentActorId)
    const advancedStored = await t.run(async (ctx) => ({
      participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
      receipt: await ctx.db
        .query('encounterRuleReceipts')
        .withIndex('by_encounterId_commandId', (q) =>
          q.eq('encounterId', run.id).eq('commandId', firstAdvanceInput.command.commandId)
        )
        .unique()
        .then((header) =>
          header ? readReceiptHeader(ctx, 'encounterRuleReceipts', header) : null
        ),
      command: await ctx.db
        .query('encounterRunCommands')
        .withIndex('by_campaignId_commandId', (q) =>
          q.eq('campaignId', run.campaignId).eq('commandId', firstAdvanceInput.command.commandId)
        )
        .unique()
        .then((header) => (header ? readReceiptHeader(ctx, 'encounterRunCommands', header) : null))
    }))
    expect(advancedStored.participants).toEqual(
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
    expect(JSON.parse(advancedStored.receipt?.resultJson ?? '')).toMatchObject({
      status: 'INITIATIVE_COMPLETE',
      commandType: 'ADVANCE_TURN',
      initiative: null,
      initiativeAdvance: { kind: 'SAME_ROUND' }
    })
    expect(advancedStored.command).toMatchObject({
      commandType: 'ADVANCE_TURN',
      ruleOccurrenceId: expect.any(String),
      ruleResultChecksum: expect.stringMatching(/^[a-f0-9]{64}$/)
    })
    await expect(replayInRoom(owner.caller, resolveInput)).resolves.toEqual({
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
    const wrappedStored = await t.run(async (ctx) => ({
      rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
      participants: await ctx.db.query('encounterInitiativeParticipants').collect()
    }))
    expect(wrappedStored.rounds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ round: 1, status: 'COMPLETED' }),
        expect.objectContaining({ round: 2, status: 'ACTIVE' })
      ])
    )
    expect(
      wrappedStored.participants
        .filter((participant) => participant.round === 2)
        .sort((left, right) => (left.turnOrderOrdinal ?? -1) - (right.turnOrderOrdinal ?? -1))
        .map((participant) => participant.actorId)
    ).toEqual([settled.projection.currentActorId, progressed.projection.currentActorId])
    await expect(replayInRoom(owner.caller, firstAdvanceInput)).resolves.toEqual({
      ...progressed,
      projection: wrapped.projection
    })
    await expect(replayInRoom(owner.caller, secondAdvanceInput)).resolves.toEqual(wrapped)
    const firstTimelinePage = await owner.caller.query(getTimeline, {
      encounterId: run.id,
      limit: 2
    })
    expect(firstTimelinePage.entries.map((entry) => entry.commandType)).toEqual([
      'ADVANCE_TURN',
      'ADVANCE_TURN'
    ])
    expect(firstTimelinePage.nextCursor).toBe(firstTimelinePage.entries[1]!.id)
    await expect(
      owner.caller.query(getTimeline, {
        encounterId: run.id,
        cursor: firstTimelinePage.nextCursor!,
        limit: 2
      })
    ).resolves.toMatchObject({
      entries: [{ commandType: 'START' }, { commandType: 'CREATE' }],
      nextCursor: null
    })
    await expect(
      other.caller.query(getTimeline, { encounterId: run.id, limit: 50 })
    ).resolves.toEqual({ entries: [], nextCursor: null })
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
    expect(playerAdvanced.projection).toEqual(
      projectPlayerEncounterProjection(
        encounterGmProjectionDtoSchema.parse(
          await owner.caller.query(getEncounter, { encounterId: run.id })
        ),
        { userId: other.userId, characters: new Map() }
      )
    )
    const playerAdvanceRow = await t.run((ctx) =>
      ctx.db
        .query('encounterRunCommands')
        .withIndex('by_campaignId_commandId', (q) =>
          q.eq('campaignId', run.campaignId).eq('commandId', playerAdvanceInput.command.commandId)
        )
        .unique()
        .then((header) => (header ? readReceiptHeader(ctx, 'encounterRunCommands', header) : null))
    )
    expect(playerAdvanceRow).toMatchObject({
      commandType: 'ADVANCE_TURN',
      actorUserId: other.userId
    })
    await expect(replayInRoom(other.caller, playerAdvanceInput)).resolves.toEqual(playerAdvanced)
    await expect(executeInRoom(owner.caller, playerAdvanceInput)).rejects.toThrow(
      'The command ID was already used for different input.'
    )
  }, 30000)

  it('starts an Automatic Run through native sources, rules, and normalized initiative', async () => {
    const { t, owner, run } = await setup({ automatic: true })
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
    const stored = await t.run(async (ctx) => ({
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      round: await ctx.db.query('encounterInitiativeRounds').unique(),
      participant: await ctx.db.query('encounterInitiativeParticipants').unique(),
      occurrence: await ctx.db.query('encounterRuleOccurrences').unique(),
      receipt: await ctx.db
        .query('encounterRuleReceipts')
        .unique()
        .then((header) =>
          header ? readReceiptHeader(ctx, 'encounterRuleReceipts', header) : null
        ),
      commands: await ctx.db
        .query('encounterRunCommands')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
    }))
    expect(stored.round).toMatchObject({
      encounterId: run.id,
      procedure: 'ACTOR_ROLL',
      status: 'ACTIVE',
      nextTurnOrderOrdinal: 1,
      version: 1
    })
    expect(stored.participant).toMatchObject({
      actorId: run.actors[0]!.id,
      status: 'ACTIVE',
      turnOrderOrdinal: 0,
      version: 3
    })
    expect(stored.participant?.initiativeScore).toBeGreaterThanOrEqual(3)
    expect(stored.participant?.initiativeScore).toBeLessThanOrEqual(22)
    expect(stored.participant?.evaluation.occurrenceId).toMatch(/^[a-f0-9-]{36}$/)
    expect(stored.participant?.evaluation.resultChecksum).toMatch(/^[a-f0-9]{64}$/)
    expect(stored.occurrence).toMatchObject({
      encounterId: run.id,
      rootCommandId: input.command.commandId,
      state: 'COMPLETED',
      version: 0,
      expectedEncounterVersion: 1,
      pendingSnapshotChecksum: null,
      completedAt: expect.any(String)
    })
    expect(stored.receipt).toMatchObject({
      encounterId: run.id,
      occurrenceId: stored.occurrence?.id,
      commandId: input.command.commandId,
      commandType: 'START',
      encounterVersion: 1,
      resultChecksum: expect.stringMatching(/^[a-f0-9]{64}$/)
    })
    expect(JSON.parse(stored.receipt?.resultJson ?? '')).toMatchObject({
      status: 'INITIATIVE_COMPLETE',
      occurrenceId: stored.occurrence?.id,
      encounterId: run.id,
      commandType: 'START'
    })
    expect(stored.commands).toHaveLength(2)
    await expect(replayInRoom(owner.caller, input)).resolves.toEqual(started)
  })

  it('runs native SIDE_ROLL start, side transitions, correction, and both cadence wraps', async () => {
    for (const eachRound of [false, true]) {
      const { t, owner, run } = await setup({
        assisted: true,
        sideRoll: true,
        actorCount: 3,
        eachRound
      })
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
      const initial = await t.run(async (ctx) => ({
        sides: await ctx.db
          .query('encounterInitiativeSides')
          .withIndex('by_encounterId_round_sideId', (q) =>
            q.eq('encounterId', run.id).eq('round', 1)
          )
          .collect(),
        participants: await ctx.db
          .query('encounterInitiativeParticipants')
          .withIndex('by_encounterId_round_actorId', (q) =>
            q.eq('encounterId', run.id).eq('round', 1)
          )
          .collect()
      }))
      expect(initial.sides).toHaveLength(2)
      expect(initial.sides.map((side) => side.sideId)).toEqual([firstSide.id, secondSide.id].sort())
      expect(initial.sides.map((side) => side.sideOrderOrdinal).sort()).toEqual([0, 1])
      expect(
        initial.participants.map((participant) => participant.turnOrderOrdinal).sort()
      ).toEqual([0, 1, 2])
      expect(
        initial.participants.filter((participant) => participant.sideId === firstSide.id)
      ).toHaveLength(2)
      const orderedParticipants = [...initial.participants].sort(
        (left, right) => left.turnOrderOrdinal! - right.turnOrderOrdinal!
      )
      expect(started.projection.currentActorId).toBe(orderedParticipants[0]!.actorId)
      expect(initial.participants.filter((participant) => participant.status === 'ACTIVE')).toEqual(
        [orderedParticipants[0]]
      )
      expect(
        initial.sides.filter((side) => side.status === 'ACTIVE').map((side) => side.sideId)
      ).toEqual([orderedParticipants[0]!.sideId])
      const compactSides = orderedParticipants
        .map((participant) => participant.sideId)
        .filter((sideId, index, values) => index === 0 || values[index - 1] !== sideId)
      expect(compactSides).toEqual(
        [...initial.sides]
          .sort((left, right) => left.sideOrderOrdinal! - right.sideOrderOrdinal!)
          .map((side) => side.sideId)
      )
      expect([...initial.participants].map((participant) => participant.actorId)).toEqual(
        [...initial.participants].map((participant) => participant.actorId).sort()
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
      const roundTwo = await t.run((ctx) =>
        ctx.db
          .query('encounterInitiativeParticipants')
          .withIndex('by_encounterId_round_actorId', (q) =>
            q.eq('encounterId', run.id).eq('round', 2)
          )
          .collect()
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
        const pendingRun = await t.run((ctx) => ctx.db.query('encounterRuns').unique())
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
      await expect(replayInRoom(owner.caller, startInput)).resolves.toEqual({
        ...startedPending,
        projection: completed.projection
      })
      await expect(replayInRoom(owner.caller, correctionInput)).resolves.toEqual({
        ...corrected,
        projection: completed.projection
      })
    }
  }, 60000)

  it('resumes Automatic GM order choices at START and EACH_ROUND without manual score entry', async () => {
    const { t, owner, run } = await setup({
      automatic: true,
      eachRound: true,
      actorCount: 2
    })
    const random = vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      ;(array as Uint32Array)[0] = 4
      return array
    })
    const capture = () =>
      t.run(async (ctx) => ({
        receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
        receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
        runs: await ctx.db.query('encounterRuns').collect(),
        rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
        participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
        commands: await ctx.db
          .query('encounterRunCommands')
          .collect()
          .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers)),
        occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
        receipts: await ctx.db
          .query('encounterRuleReceipts')
          .collect()
          .then((headers) => readReceiptHeaders(ctx, 'encounterRuleReceipts', headers))
      }))
    try {
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
        const before = await capture()
        const resolution: EncounterExecuteInput = {
          command: {
            type: 'RESOLVE_RULE_OCCURRENCE',
            encounterId: run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: version,
            correlationId: null,
            occurrenceId: pending.occurrence.occurrenceId,
            expectedOccurrenceVersion: pending.occurrence.occurrenceVersion,
            resolution: {
              kind: 'INITIATIVE_ENTITY',
              requestId: summary.requestId,
              entityId: summary.optionIds[0]!
            }
          }
        }
        await expect(
          executeInRoom(owner.caller, {
            command: {
              ...resolution.command,
              type: 'RESOLVE_RULE_OCCURRENCE',
              occurrenceId: pending.occurrence.occurrenceId,
              expectedOccurrenceVersion: pending.occurrence.occurrenceVersion,
              correlationId: null,
              resolution: {
                kind: 'ENTER_INTEGER',
                requestId: summary.requestId,
                value: 0
              }
            }
          })
        ).rejects.toThrow(RoomCommandRefusal)
        await expect(replayInRoom(owner.caller, rootInput)).resolves.toEqual(pending)
        expect(await capture()).toEqual(before)
        const settled = await executeInRoom(owner.caller, resolution)
        expect(settled.projection).toMatchObject({
          version: version + 1,
          round: type === 'START' ? 1 : 2,
          currentActorId: summary.optionIds[0]
        })
        expect(settled.occurrence?.status).toBe('COMPLETE')
        version = settled.projection.version
        const after = await capture()
        await expect(replayInRoom(owner.caller, rootInput)).resolves.toEqual({
          ...pending,
          projection: settled.projection
        })
        await expect(replayInRoom(owner.caller, resolution)).resolves.toEqual(settled)
        expect(await capture()).toEqual(after)
      }
    } finally {
      random.mockRestore()
    }
  }, 30000)

  it('reevaluates an Automatic EACH_ROUND wrap and records both settlement and advance', async () => {
    const { t, owner, run } = await setup({ automatic: true, eachRound: true })
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
    const receipt = await t.run((ctx) =>
      ctx.db
        .query('encounterRuleReceipts')
        .order('desc')
        .first()
        .then((header) => (header ? readReceiptHeader(ctx, 'encounterRuleReceipts', header) : null))
    )
    expect(JSON.parse(receipt?.resultJson ?? '')).toMatchObject({
      commandType: 'ADVANCE_TURN',
      initiative: { round: 2, cadence: 'EACH_ROUND' },
      initiativeAdvance: {
        kind: 'ROUND_WRAP',
        cadence: 'EACH_ROUND',
        nextRound: 2
      }
    })
    const capture = () =>
      t.run(async (ctx) => ({
        receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
        receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
        run: await ctx.db.query('encounterRuns').unique(),
        rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
        participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
        sides: await ctx.db.query('encounterInitiativeSides').collect(),
        commands: await ctx.db
          .query('encounterRunCommands')
          .collect()
          .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers)),
        occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
        receipts: await ctx.db
          .query('encounterRuleReceipts')
          .collect()
          .then((headers) => readReceiptHeaders(ctx, 'encounterRuleReceipts', headers))
      }))
    const originalTarget = (await capture()).rounds.find((row) => row.round === 2)!
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
    const beforeRevisit = await capture()
    expect(await capture()).toEqual(beforeRevisit)
    const revisited = await executeInRoom(owner.caller, revisit)
    expect(revisited.projection).toMatchObject({ round: 2, version: 4 })
    const afterRevisit = await capture()
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
    await expect(replayInRoom(owner.caller, revisit)).resolves.toEqual(revisited)
    expect(await capture()).toEqual(afterRevisit)
  }, 30000)

  it('pauses an Assisted EACH_ROUND wrap without moving the source cursor, then resolves and replays', async () => {
    const { t, owner, run } = await setup({ assisted: true, eachRound: true })
    const startedPending = await executeInRoom(owner.caller, {
      command: {
        type: 'START',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0
      }
    })
    let started = startedPending
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
    const capture = () =>
      t.run(async (ctx) => ({
        receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
        receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
        run: await ctx.db.query('encounterRuns').unique(),
        rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
        participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
        sides: await ctx.db.query('encounterInitiativeSides').collect(),
        commands: await ctx.db
          .query('encounterRunCommands')
          .collect()
          .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers)),
        occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
        receipts: await ctx.db
          .query('encounterRuleReceipts')
          .collect()
          .then((headers) => readReceiptHeaders(ctx, 'encounterRuleReceipts', headers))
      }))
    const before = await capture()
    await expect(replayInRoom(owner.caller, wrapInput)).resolves.toEqual(pending)
    expect(await capture()).toEqual(before)
    const firstResolution = assistedResolution(pending, 2, 9)
    const source = before.rounds.find((row) => row.round === 1)!
    await t.run((ctx) => ctx.db.patch(source._id, { version: source.version + 1 }))
    const corrupt = await capture()
    await expectRedactedRoomRefusal(
      executeInRoom(owner.caller, firstResolution),
      'Initiative outgoing advancement is stale.'
    )
    expect(await capture()).toEqual(corrupt)
    await t.run((ctx) => ctx.db.patch(source._id, { version: source.version }))
    await expect(
      executeInRoom(owner.caller, {
        command: {
          type: 'SET_ROUND',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 2,
          round: 3
        }
      })
    ).rejects.toThrow('awaiting resolution')
    expect(await capture()).toEqual(before)
    const secondPending = await executeInRoom(owner.caller, firstResolution)
    const terminalInput = assistedResolution(secondPending, 2, 8)
    const beforeTerminal = await capture()
    expect(await capture()).toEqual(beforeTerminal)
    const settled = await executeInRoom(owner.caller, terminalInput)
    expect(settled.projection).toMatchObject({
      status: 'ACTIVE',
      version: 3,
      round: 2
    })
    await expect(replayInRoom(owner.caller, wrapInput)).resolves.toEqual({
      ...pending,
      projection: settled.projection
    })
    const after = await t.run(async (ctx) => ({
      run: await ctx.db.query('encounterRuns').unique(),
      rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
      participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
      receipt: await ctx.db
        .query('encounterRuleReceipts')
        .order('desc')
        .first()
        .then((header) => (header ? readReceiptHeader(ctx, 'encounterRuleReceipts', header) : null))
    }))
    expect(before.run?.version).toBe(2)
    expect(after.rounds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ round: 1, status: 'COMPLETED' }),
        expect.objectContaining({ round: 2, status: 'ACTIVE' })
      ])
    )
    expect(JSON.parse(after.receipt?.resultJson ?? '')).toMatchObject({
      commandType: 'ADVANCE_TURN',
      initiative: { round: 2, cadence: 'EACH_ROUND' },
      initiativeAdvance: { kind: 'ROUND_WRAP', cadence: 'EACH_ROUND' }
    })
    const corrected = await executeInRoom(owner.caller, {
      command: {
        type: 'SET_ROUND',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        round: 3
      }
    })
    const beforeReplay = await capture()
    await expect(replayInRoom(owner.caller, wrapInput)).resolves.toEqual({
      ...pending,
      projection: corrected.projection
    })
    await expect(replayInRoom(owner.caller, terminalInput)).resolves.toMatchObject({
      projection: corrected.projection,
      occurrence: settled.occurrence
    })
    expect(await capture()).toEqual(beforeReplay)
  }, 30000)

  it('rolls Creature initiative with its authoritative modifier and rejects stale source identity', async () => {
    const { t, owner, run } = await setup({ automatic: true })
    const actor = run.actors[0]!
    const getRandomValues = vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      ;(array as Uint32Array)[0] = 4
      return array
    })
    const rolled = await executeInRoom(owner.caller, {
      command: {
        type: 'ROLL_ACTOR_INITIATIVE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0,
        actorId: actor.id
      }
    })
    getRandomValues.mockRestore()
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
    const stored = await t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
        .unique()
      if (!row) throw new Error('Missing Creature actor.')
      return JSON.parse(row.stateJson) as { initiative: number }
    })
    expect(stored.initiative).toBe(7)

    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
        .unique()
      if (!row) throw new Error('Missing Creature actor.')
      const state = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
      const snapshot = state.snapshot as { sourceRevision: number }
      snapshot.sourceRevision += 1
      await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, state)
    })
    await expect(
      executeInRoom(owner.caller, {
        command: {
          type: 'ROLL_ACTOR_INITIATIVE',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 1,
          actorId: actor.id
        }
      })
    ).rejects.toThrow(RoomCommandRefusal)
  })

  it('rolls Character initiative with its effective modifier and rejects stale source identity', async () => {
    const { t, owner, run, character } = await setupCharacterAutomatic()
    const actor = run.actors.find((candidate) => candidate.kind === 'CHARACTER')
    if (!actor) throw new Error('Missing Character actor.')
    const getRandomValues = vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      ;(array as Uint32Array)[0] = 4
      return array
    })
    const rolled = await executeInRoom(owner.caller, {
      command: {
        type: 'ROLL_ACTOR_INITIATIVE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0,
        actorId: actor.id
      }
    })
    getRandomValues.mockRestore()
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
    const stored = await t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
        .unique()
      if (!row) throw new Error('Missing Character actor.')
      return JSON.parse(row.stateJson) as { initiative: number }
    })
    expect(stored.initiative).toBe(7)

    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
        .unique()
      if (!row) throw new Error('Missing Character actor.')
      const state = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
      const snapshot = state.snapshot as { id: string }
      snapshot.id = crypto.randomUUID()
      await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, state)
    })
    await expect(
      executeInRoom(owner.caller, {
        command: {
          type: 'ROLL_ACTOR_INITIATIVE',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 1,
          actorId: actor.id
        }
      })
    ).rejects.toThrow(RoomCommandRefusal)
  })

  it('rolls initiative with advantage for a Character with Feral Instinct', async () => {
    const feralInstinct = barbarian.features?.find((feature) => feature.label === 'Feral Instinct')
    if (!feralInstinct) throw new Error('Missing SRD Feral Instinct.')
    const { owner, run } = await setupCharacterAutomatic({
      features: [{ ...feralInstinct, availableAtLevel: 1, effects: [] }]
    })
    const actor = run.actors.find((candidate) => candidate.kind === 'CHARACTER')
    if (!actor) throw new Error('Missing Character actor.')
    const faces = [2, 15]
    const getRandomValues = vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      ;(array as Uint32Array)[0] = faces.shift() ?? 0
      return array
    })
    const rolled = await executeInRoom(owner.caller, {
      command: {
        type: 'ROLL_ACTOR_INITIATIVE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0,
        actorId: actor.id
      }
    })
    getRandomValues.mockRestore()
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
  })

  it('starts a Manual Run through normalized initiative and replays the terminal command', async () => {
    const { t, owner, run } = await setup({ manual: true })
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
    const commandId = crypto.randomUUID()
    const input: EncounterExecuteInput = {
      command: {
        type: 'START',
        encounterId: run.id,
        commandId,
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

    const stored = await t.run(async (ctx) => ({
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      rounds: await ctx.db.query('encounterInitiativeRounds').collect(),
      participants: await ctx.db.query('encounterInitiativeParticipants').collect(),
      sides: await ctx.db.query('encounterInitiativeSides').collect(),
      occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
      ruleReceipts: await ctx.db
        .query('encounterRuleReceipts')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRuleReceipts', headers)),
      commands: await ctx.db
        .query('encounterRunCommands')
        .collect()
        .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
    }))
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
    expect(stored.ruleReceipts).toHaveLength(1)
    expect(stored.commands).toHaveLength(3)

    await expect(replayInRoom(owner.caller, setInitiative)).resolves.toEqual({
      ...set,
      projection: started.projection
    })

    const rollCommandId = crypto.randomUUID()
    const getRandomValues = vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      ;(array as Uint32Array)[0] = 4
      return array
    })
    const rolled = await executeInRoom(owner.caller, {
      command: {
        type: 'ROLL_ACTOR_INITIATIVE',
        encounterId: run.id.toUpperCase(),
        commandId: rollCommandId.toUpperCase(),
        expectedVersion: 2,
        actorId: actorId.toUpperCase()
      }
    })
    getRandomValues.mockRestore()
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
    const afterRoll = await t.run(async (ctx) => ({
      actor: await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actorId))
        .unique(),
      participants: await ctx.db.query('encounterInitiativeParticipants').collect()
    }))
    expect(JSON.parse(afterRoll.actor!.stateJson)).toMatchObject({
      initiative: 5,
      manualOrder: 0
    })
    expect(afterRoll.participants[0]).toMatchObject({
      initiativeScore: null,
      turnOrderOrdinal: 0
    })
    const timeline = await owner.caller.query(getTimeline, {
      encounterId: run.id
    })
    expect(timeline.entries).toContainEqual(
      expect.objectContaining({
        commandType: 'ROLL_ACTOR_INITIATIVE',
        roll: rolled.roll
      })
    )
    let entropyDraws = 0
    const replayRandom = vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      entropyDraws += 1
      ;(array as Uint32Array)[0] = 19
      return array
    })
    await expect(
      replayInRoom(owner.caller, {
        command: {
          type: 'ROLL_ACTOR_INITIATIVE',
          encounterId: run.id,
          commandId: rollCommandId,
          expectedVersion: 2,
          actorId
        }
      })
    ).resolves.toEqual(rolled)
    replayRandom.mockRestore()
    expect(entropyDraws).toBe(0)

    const completeCommandId = crypto.randomUUID()
    const completeInput: EncounterExecuteInput = {
      command: {
        type: 'COMPLETE',
        encounterId: run.id,
        commandId: completeCommandId,
        expectedVersion: 3
      }
    }
    const completed = await executeInRoom(owner.caller, completeInput)
    expect(completed.projection).toMatchObject({
      status: 'COMPLETED',
      version: 4,
      currentActorId: null
    })
    const completedStored = await t.run(async (ctx) => ({
      round: await ctx.db.query('encounterInitiativeRounds').collect(),
      participants: await ctx.db.query('encounterInitiativeParticipants').collect()
    }))
    expect(completedStored.round[0]).toMatchObject({ status: 'COMPLETED' })
    expect(completedStored.participants[0]).toMatchObject({
      actorId,
      status: 'ACTED'
    })
    await expect(replayInRoom(owner.caller, completeInput)).resolves.toEqual(completed)

    await expect(
      replayInRoom(owner.caller, {
        command: {
          ...input.command,
          encounterId: run.id.toUpperCase(),
          commandId: commandId.toUpperCase()
        }
      })
    ).resolves.toEqual({ ...started, projection: completed.projection })
    await expect(
      executeInRoom(owner.caller, {
        command: { ...input.command, commandId: crypto.randomUUID() }
      })
    ).rejects.toThrow('Encounter version is stale.')
  })

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
    const { t, owner, campaign, run } = await setup()
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
    expect(await replayInRoom(owner.caller, command)).toEqual({
      ...original,
      projection: later.projection
    })
    await expect(
      executeInRoom(owner.caller, {
        command: { ...command.command, expectedVersion: 999 }
      })
    ).rejects.toThrow()
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
    await expect(executeInRoom(owner.caller, command)).rejects.toThrow(RoomCommandRefusal)
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
    const { t, owner, campaign, run } = await setup()
    const optional = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
      (definition) => definition.document.kind === 'DISARM'
    )
    if (!optional) throw new Error('Missing optional combat fixture.')
    await t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: [optional]
    })
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
    const stored = (await runs(t))[0]
    if (!stored) throw new Error('Missing Encounter Run.')
    const state = encounterRunStateSchema.parse(JSON.parse(stored.stateJson))
    expect(state.optionalCombatSnapshot.definitions[0]).toMatchObject({
      definitionId: optional.id
    })
    expect(state.optionalCombatSnapshotChecksum).toBe(
      checksumCanonicalJson(state.optionalCombatSnapshot)
    )
    const receiptCount = (await receipts(t)).length
    await expect(
      replayInRoom(owner.caller, {
        command: {
          ...command.command,
          encounterId: run.id,
          commandId: command.command.commandId.toLowerCase(),
          definitionIds: [optional.id]
        }
      })
    ).resolves.toEqual(result)
    expect((await receipts(t)).length).toBe(receiptCount)
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
    const { t, owner, run } = await setup({ automatic: true })
    const optional = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
      (definition) => definition.document.kind === 'DISARM'
    )
    if (!optional) throw new Error('Missing optional combat fixture.')
    await t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: [optional]
    })
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
    const startedState = encounterRunStateSchema.parse(JSON.parse((await runs(t))[0]!.stateJson))
    const evaluationGraphId = startedState.initiativePolicySnapshot?.evaluationGraph.definitionId
    if (!evaluationGraphId) throw new Error('Missing frozen initiative graph.')
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
    const replaced = await executeInRoom(owner.caller, {
      command: {
        type: 'REPLACE_OPTIONAL_COMBAT_RULES',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        definitionIds: [optional.id]
      }
    })
    expect(replaced.projection).toMatchObject({
      version: 2,
      optionalCombatRules: [{ definitionId: optional.id, kind: 'DISARM' }]
    })
    await expect(replayInRoom(owner.caller, startInput)).resolves.toEqual({
      ...started,
      projection: replaced.projection
    })
    const before = { receipts: await receipts(t), runs: await runs(t) }
    await expect(
      executeInRoom(owner.caller, {
        command: {
          type: 'REPLACE_OPTIONAL_COMBAT_RULES',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 2,
          definitionIds: [crypto.randomUUID()]
        }
      })
    ).rejects.toThrow(RoomCommandRefusal)
    await expect(
      executeInRoom(owner.caller, {
        command: {
          type: 'REPLACE_OPTIONAL_COMBAT_RULES',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: 1,
          definitionIds: []
        }
      })
    ).rejects.toThrow('Encounter version is stale.')
    expect({ receipts: await receipts(t), runs: await runs(t) }).toEqual(before)
  }, 30000)

  it('rejects conflicting shared command IDs across CREATE and Runs', async () => {
    const first = await setup()
    await expect(
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
    ).rejects.toThrow()
    const secondRun = await first.owner.caller.mutation(createRun, {
      campaignId: first.campaign.id,
      blueprintId: first.blueprint.id,
      commandId: crypto.randomUUID()
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
    await expect(
      executeInRoom(first.owner.caller, {
        command: { ...command.command, encounterId: secondRun.id }
      })
    ).rejects.toThrow()
  }, 30000)

  it('rejects stale, unknown-actor, and missing-reminder commands without writes', async () => {
    const { t, owner, run } = await setup()
    const before = await receipts(t)
    const runsBefore = await runs(t)
    await expect(
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
    ).rejects.toThrow()
    await expect(
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
      )
    ).rejects.toThrow()
    await expect(
      executeInRoom(owner.caller, remove(run.id, 0, crypto.randomUUID()))
    ).rejects.toThrow()
    expect(await receipts(t)).toEqual(before)
    expect(await runs(t)).toEqual(runsBefore)
  }, 30000)

  it('rejects anonymous, player, revoked, archived, and completed-run commands', async () => {
    const { t, owner, other, campaign, run } = await setup()
    const command = upsert(run.id, 0, {
      label: 'Denied',
      timing: 'ROUND_START',
      round: null,
      actorId: null,
      public: false,
      notes: null,
      order: 0
    })
    await expect(executeInRoom(t, command)).rejects.toThrow('Unauthenticated')
    await expect(executeInRoom(other.caller, command)).rejects.toThrow()
    const membershipId = await t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
    )
    await expect(executeInRoom(other.caller, command)).rejects.toThrow()
    await t.run((ctx) =>
      ctx.db.patch(membershipId, {
        status: 'LEFT',
        leftAt: new Date().toISOString()
      })
    )
    await expect(executeInRoom(other.caller, command)).rejects.toThrow()
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      if (!row) throw new Error('Missing Campaign.')
      await ctx.db.patch(row._id, { status: 'ARCHIVED' })
    })
    await expect(executeInRoom(owner.caller, command)).rejects.toThrow()
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      if (!row) throw new Error('Missing Campaign.')
      await ctx.db.patch(row._id, { status: 'ACTIVE' })
    })
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
    await expect(executeInRoom(owner.caller, command)).rejects.toThrow(
      'Completed Encounters are read-only.'
    )
  }, 30000)

  it('rejects corrupt Run state', async () => {
    const { t, owner, run } = await setup()
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
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', run.id))
        .unique()
      if (!row) throw new Error('Missing Run.')
      await ctx.db.patch(row._id, { stateChecksum: '0'.repeat(64) })
    })
    await expect(
      executeInRoom(owner.caller, {
        command: {
          ...command.command,
          commandId: crypto.randomUUID(),
          expectedVersion: 1
        }
      })
    ).rejects.toThrow(RoomCommandRefusal)
    // The room journal, not the Convex receipt record, serves an exact retry.
    await expect(executeInRoom(owner.caller, command)).resolves.toEqual(original)
    expect(original.projection.version).toBe(1)
  }, 30000)
})
