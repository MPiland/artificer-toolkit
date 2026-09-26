// @vitest-environment node
import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
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
  type EncounterGmProjectionDto,
  type EncounterPlayerProjectionDto,
  type EncounterSessionStateDto,
  type PendingEncounterRuleOccurrenceSummaryDto
} from '@artificer-toolkit/schema/api/encounterData'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture } from '../../tests/fixtures/characters'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import { importedSubject } from '../../tests/fixtures/publication'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { internal } from '../_generated/api'
import { readRunState } from './documents'
import { executeInRoom } from '../../tests/fixtures/liveSessionWorker'

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
const getSettings = makeFunctionReference<'query', { campaignId: string }, CampaignPlaySettingsDto>(
  'campaigns/playSettings:get'
)
const saveSettings = makeFunctionReference<
  'mutation',
  SaveCampaignPlaySettingsInput,
  CampaignPlaySettingsDto
>('campaigns/playSettings:save')
const active = makeFunctionReference<
  'query',
  { campaignId: string },
  EncounterGmProjectionDto | EncounterPlayerProjectionDto | null
>('encounters/projectionReads:active')
const pending = makeFunctionReference<
  'query',
  { encounterId: string },
  PendingEncounterRuleOccurrenceSummaryDto | null
>('encounters/pendingReads:pendingRuleOccurrence')
const activeState = makeFunctionReference<
  'query',
  { campaignId: string },
  EncounterSessionStateDto
>('encounters/activeReads:active')

it('reads the active projection and pending decision together with existing visibility and membership rules', async () => {
  const base = await fixture()
  await setAutoRollDice(base.t, base.owner.userId, false)
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Campaign encounter read',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const initiative = createEncounterInitiativeDefinitions([
    { cadence: 'EACH_ROUND', procedure: 'ACTOR_ROLL' }
  ])
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: initiative.definitions
  })
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...wolf, subjectKind: 'CREATURE', document: wolf })]
  })
  const settings = await base.owner.caller.query(getSettings, { campaignId: campaign.id })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await base.owner.caller.mutation(saveSettings, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    manualReminderMode: 'OFF',
    initiativePolicyDefinitionId: initiative.policyIds[0]!,
    initiativeTieDefinitionId: null
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Campaign encounter read',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CREATURE', sourceId: wolf.id },
      { kind: 'CREATURE', sourceId: wolf.id }
    ]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const input = { campaignId: campaign.id }
  expect(await base.owner.caller.query(activeState, input)).toEqual({
    encounter: null,
    pending: null,
    waitingOn: null,
    turnMovement: []
  })
  await expect(base.t.query(activeState, input)).rejects.toThrow('Unauthenticated')
  await expect(base.other.caller.query(activeState, input)).rejects.toThrow('Campaign not found')
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )

  let result = await executeInRoom(base.owner.caller, {
    command: {
      type: 'START',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: 0
    }
  })
  for (const value of [12, 11]) {
    const occurrence = result.occurrence
    const request = occurrence?.pending
    if (!occurrence || request?.kind !== 'INITIATIVE_EVIDENCE')
      throw new Error('Expected assisted initiative evidence.')
    result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: 0,
        correlationId: null,
        occurrenceId: occurrence.occurrenceId,
        expectedOccurrenceVersion: occurrence.occurrenceVersion,
        resolution: { kind: 'ENTER_INTEGER', requestId: request.request.requestId, value }
      }
    })
  }
  expect(result.projection.status).toBe('ACTIVE')
  const first = await executeInRoom(base.owner.caller, {
    command: {
      type: 'ADVANCE_TURN',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: 1
    }
  })
  const paused = await executeInRoom(base.owner.caller, {
    command: {
      type: 'ADVANCE_TURN',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: first.projection.version
    }
  })
  expect(paused.occurrence?.status).toBe('PENDING')
  expect(paused.projection.status).toBe('ACTIVE')
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!row) throw new Error('Missing Encounter Run.')
    const projection = encounterGmProjectionDtoSchema.parse(JSON.parse(row.projectionJson))
    const hidden = projection.actors[1]
    if (!hidden) throw new Error('Missing hidden actor.')
    const changed = encounterGmProjectionDtoSchema.parse({
      ...projection,
      actors: projection.actors.map((actor) =>
        actor.id === hidden.id
          ? { ...actor, public: false, gmNotes: 'private encounter note', currentHitPoints: 1 }
          : actor
      )
    })
    await ctx.db.patch(row._id, {
      projectionJson: JSON.stringify(changed),
      projectionChecksum: checksumCanonicalJson(changed)
    })
    const state = readRunState(row)
    if (!state.currentActorId) throw new Error('Missing current actor.')
    await ctx.db.insert('encounterTurnMovements', {
      encounterId: run.id,
      round: state.round,
      turnActorId: state.currentActorId,
      actorId: hidden.id,
      usedFeet: 15
    })
  })

  const ownerState = await base.owner.caller.query(activeState, input)
  const [visible, hidden] = ownerState.encounter?.actors ?? []
  expect(ownerState).toEqual({
    encounter: await base.owner.caller.query(active, { campaignId: campaign.id }),
    pending: await base.owner.caller.query(pending, { encounterId: run.id }),
    waitingOn: null,
    // The GM sees every actor's movement this turn against its stat block's walking speed.
    turnMovement: expect.arrayContaining([
      { actorId: visible?.id, used: 0, budget: 40 },
      { actorId: hidden?.id, used: 15, budget: 40 }
    ])
  })
  expect(ownerState.turnMovement).toHaveLength(2)
  expect(ownerState.pending).toMatchObject({ encounterVersion: ownerState.encounter?.version })
  expect(ownerState.pending).not.toBeNull()
  const playerState = await base.other.caller.query(activeState, input)
  expect(playerState).toEqual({
    encounter: await base.other.caller.query(active, { campaignId: campaign.id }),
    pending: await base.other.caller.query(pending, { encounterId: run.id }),
    // The player can't answer the GM's pending turn step, and the signal survives a reload.
    waitingOn: 'GM',
    // A player sees movement only for actors they control.
    turnMovement: []
  })
  expect(playerState.pending).toBeNull()
  expect(playerState.encounter?.actors).toHaveLength(1)
  expect(JSON.stringify(playerState)).not.toContain('private encounter note')
  expect(JSON.stringify(playerState)).not.toContain(ownerState.encounter?.actors[1]?.id)
  await base.t.run(async (ctx) => {
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    if (!membership) throw new Error('Missing membership.')
    await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: campaign.createdAt })
  })
  await expect(base.other.caller.query(activeState, input)).rejects.toThrow('Campaign not found')
}, 60000)
