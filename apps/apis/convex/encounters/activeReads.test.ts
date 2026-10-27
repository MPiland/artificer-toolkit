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
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto,
  EncounterSessionStateDto,
  PendingEncounterRuleOccurrenceSummaryDto
} from '@artificer-toolkit/schema/api/encounterData'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdWolf as wolf } from '../../tests/fixtures/srdCreatures'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture } from '../../tests/fixtures/characters'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { internal } from '../_generated/api'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import {
  attachFixtureRoom,
  closeRoom,
  executeInRoom,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { updateFixtureRunActors } from '../../tests/fixtures/activeInitiative'

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
const getSettings = makeFunctionReference<'query', { campaignId: string }, CampaignPlaySettingsDto>(
  'campaigns/playSettings:get'
)
const saveSettings = makeFunctionReference<
  'mutation',
  SaveCampaignPlaySettingsInput,
  CampaignPlaySettingsDto
>('campaigns/playSettings:save')
/** A creature's turn movement entry: one walking allowance, no move yet naming a speed type. */
const walking = (
  actorId: string | undefined,
  used: number,
  budget: number,
  teleport: readonly unknown[] = []
) => ({
  actorId,
  used,
  speedId: null,
  allowances: [expect.objectContaining({ code: 'WALK', budget })],
  teleport,
  fleeSourceActorIds: []
})

/** A Misty Step cast this turn, not yet spent by a move; and a Dimension Door a move already spent. */
const unspentMistyStep = {
  castCommandId: '00000000-0000-4000-8000-0000000000a1',
  maxFeet: 30,
  destinationKind: 'VISIBLE' as const,
  consumedByCommandId: null
}
const spentDimensionDoor = {
  castCommandId: '00000000-0000-4000-8000-0000000000a2',
  maxFeet: 500,
  destinationKind: 'SPECIFIED_POINT' as const,
  consumedByCommandId: '00000000-0000-4000-8000-0000000000b1'
}

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
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...wolf, subjectKind: 'CREATURE', document: wolf })]
  })
  const settings = await base.owner.caller.query(getSettings, { campaignId: campaign.id })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await base.owner.caller.mutation(saveSettings, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
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
    turnMovement: [],
    halfSpeedFields: [],
    auras: [],
    movementCostZones: [],
    placedZones: [],
    pendingZoneSightings: []
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

  await attachFixtureRoom(base.t, campaign.id)
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
  const hiddenActor = paused.projection.actors[1]
  if (!hiddenActor) throw new Error('Missing hidden actor.')
  // The room holds the Run: release it so the direct Convex patches below are the Run's state.
  await closeRoom(campaign.id)
  await base.t.run(async (ctx) => {
    await updateFixtureRunActors(ctx, run.id, (actor) =>
      actor.id === hiddenActor.id && actor.kind === 'CREATURE'
        ? { ...actor, public: false, gmNotes: 'private encounter note', currentHitPoints: 1 }
        : actor
    )
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!row) throw new Error('Missing Encounter Run.')
    const state = readRunState(row)
    if (!state.currentActorId) throw new Error('Missing current actor.')
    await ctx.db.insert('encounterTurnMovements', {
      encounterId: run.id,
      round: state.round,
      turnActorId: state.currentActorId,
      actorId: hiddenActor.id,
      usedFeet: 15,
      speedId: null,
      // One Dash this turn adds the walking speed to the budget once (D38).
      speedBonuses: 1,
      teleportAllowances: [unspentMistyStep, spentDimensionDoor]
    })
  })

  const ownerState = await base.owner.caller.query(activeState, input)
  const [visible, hidden] = ownerState.encounter?.actors ?? []
  expect(ownerState).toEqual({
    encounter: expect.objectContaining({ id: run.id, status: 'ACTIVE' }),
    pending: await base.owner.caller.query(pending, { encounterId: run.id }),
    waitingOn: null,
    // The GM sees every actor's movement this turn against its stat block's walking speed.
    turnMovement: expect.arrayContaining([
      walking(visible?.id, 0, 40),
      // Only the unspent allowance is offered; the spent one is a move's to give back.
      walking(hidden?.id, 15, 80, [
        { castCommandId: unspentMistyStep.castCommandId, maxFeet: 30, destinationKind: 'VISIBLE' }
      ])
    ]),
    halfSpeedFields: [],
    auras: [],
    movementCostZones: [],
    placedZones: [],
    pendingZoneSightings: []
  })
  expect(ownerState.turnMovement).toHaveLength(2)
  expect(ownerState.pending).toMatchObject({ encounterVersion: ownerState.encounter?.version })
  expect(ownerState.pending).not.toBeNull()
  const playerState = await base.other.caller.query(activeState, input)
  expect(playerState).toEqual({
    encounter: expect.objectContaining({ id: run.id, status: 'ACTIVE' }),
    pending: await base.other.caller.query(pending, { encounterId: run.id }),
    // The player can't answer the GM's pending turn step, and the signal survives a reload.
    waitingOn: 'GM',
    // A player sees movement only for actors they control.
    turnMovement: [],
    halfSpeedFields: [],
    auras: [],
    movementCostZones: [],
    placedZones: [],
    pendingZoneSightings: []
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
