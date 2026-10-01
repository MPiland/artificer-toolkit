import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput,
  archiveCampaignInputSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignClockDto,
  CampaignClockRecoveryPromptDto,
  DismissCampaignClockRecoveryPromptInput,
  InitializeCampaignClockInput,
  CampaignSessionDto,
  FinishCampaignSessionInput,
  createCampaignSessionInputSchema,
  startCampaignClockInputSchema,
  pauseCampaignClockInputSchema,
  configureCampaignClockInputSchema,
  initializeCampaignClockInputSchema,
  advanceCampaignClockInputSchema,
  rewindCampaignClockInputSchema,
  resetCampaignClockInputSchema,
  reconcileCampaignClockInputSchema
} from '@artificer-toolkit/schema/api/campaignSessions'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { cat } from '@artificer-toolkit/source-data/srd/creatures/cat.js'
import { api, internal } from '../_generated/api'
import { fixture } from '../../tests/fixtures/characters'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { withSceneVisionTracking } from '../lib/mutations'
import * as eventTransport from '@artificer-toolkit/schema/api/campaignEventTransport'
import * as builderContext from '../characters/builderContext'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const archive = makeFunctionReference<
  'mutation',
  z.input<typeof archiveCampaignInputSchema>,
  CampaignDetailDto
>('campaigns/archive:archive')
const createSession = makeFunctionReference<
  'mutation',
  z.input<typeof createCampaignSessionInputSchema>,
  CampaignSessionDto
>('campaigns/sessions:create')
const finishSession = makeFunctionReference<
  'mutation',
  FinishCampaignSessionInput,
  CampaignSessionDto
>('campaigns/sessionFinish:finish')
const get = makeFunctionReference<'query', { campaignId: string }, CampaignClockDto | null>(
  'campaigns/clock:get'
)
const initialize = makeFunctionReference<
  'mutation',
  z.input<typeof initializeCampaignClockInputSchema>,
  CampaignClockDto
>('campaigns/clock:initialize')
const configure = makeFunctionReference<
  'mutation',
  z.input<typeof configureCampaignClockInputSchema>,
  CampaignClockDto
>('campaigns/clock:configure')
const configureMalformed = makeFunctionReference<
  'mutation',
  Record<string, unknown>,
  CampaignClockDto
>('campaigns/clock:configure')
const start = makeFunctionReference<
  'mutation',
  z.input<typeof startCampaignClockInputSchema>,
  CampaignClockDto
>('campaigns/clock:start')
const pause = makeFunctionReference<
  'mutation',
  z.input<typeof pauseCampaignClockInputSchema>,
  CampaignClockDto
>('campaigns/clock:pause')
const advance = makeFunctionReference<
  'mutation',
  z.input<typeof advanceCampaignClockInputSchema>,
  CampaignClockDto
>('campaigns/clock:advance')
const rewind = makeFunctionReference<
  'mutation',
  z.input<typeof rewindCampaignClockInputSchema>,
  CampaignClockDto
>('campaigns/clock:rewind')
const reset = makeFunctionReference<
  'mutation',
  z.input<typeof resetCampaignClockInputSchema>,
  CampaignClockDto
>('campaigns/clock:reset')
const reconcile = makeFunctionReference<
  'mutation',
  z.input<typeof reconcileCampaignClockInputSchema>,
  CampaignClockDto
>('campaigns/clock:reconcile')

afterEach(() => vi.restoreAllMocks())

const campaignInput: CreateCampaignInput = {
  name: 'Clock tests',
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  contentMaturity: 'STANDARD',
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}

async function setup() {
  const base = await fixture()
  const campaign = await base.owner.caller.mutation(createCampaign, campaignInput)
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
  return { ...base, campaign }
}

function command(campaignId: string, expectedVersion: number) {
  return { campaignId, expectedVersion, commandId: crypto.randomUUID() }
}

describe('native Campaign clock', () => {
  it('runs the owner lifecycle, rotates segments, replays exactly, and enforces versions', async () => {
    const { t, owner, other, campaign } = await setup()
    const firstInput: InitializeCampaignClockInput = {
      ...command(campaign.id.toUpperCase(), 0),
      day: 1,
      minuteOfDay: 100,
      dawnMinute: 360,
      duskMinute: 1080
    }
    const first = await owner.caller.mutation(initialize, firstInput)
    expect(first).toMatchObject({
      campaignId: campaign.id,
      day: 1,
      minuteOfDay: 100,
      running: false,
      version: 0
    })
    expect(await owner.caller.mutation(initialize, firstInput)).toEqual(first)
    expect(await other.caller.query(get, { campaignId: campaign.id })).toEqual(first)
    expect(await other.caller.query(get, { campaignId: campaign.id.toUpperCase() })).toEqual(first)
    await expect(
      owner.caller.mutation(initialize, {
        ...firstInput,
        ...command(campaign.id, 0)
      })
    ).rejects.toThrow('Campaign clock is already initialized.')
    const beforeMalformedConfigure = await t.run(async (ctx) => ({
      clocks: await ctx.db.query('campaignClocks').collect(),
      commands: await ctx.db.query('campaignCommands').collect()
    }))
    await expect(
      owner.caller.mutation(configureMalformed, {
        ...command(campaign.id, 0),
        dawnMinute: 300
      })
    ).rejects.toThrow()
    expect(
      await t.run(async (ctx) => ({
        clocks: await ctx.db.query('campaignClocks').collect(),
        commands: await ctx.db.query('campaignCommands').collect()
      }))
    ).toEqual(beforeMalformedConfigure)
    await expect(
      owner.caller.mutation(configure, {
        ...command(campaign.id, 0),
        dawnMinute: 300,
        duskMinute: 1100
      })
    ).resolves.toMatchObject({ version: 1, dawnMinute: 300, duskMinute: 1100 })
    const started = await owner.caller.mutation(start, command(campaign.id, 1))
    expect(started).toMatchObject({ running: true, version: 2 })
    const advanced = await owner.caller.mutation(advance, {
      ...command(campaign.id, 2),
      minutes: 50
    })
    expect(advanced).toMatchObject({ minuteOfDay: 150, version: 3 })
    const paused = await owner.caller.mutation(pause, command(campaign.id, 3))
    expect(paused).toMatchObject({ running: false, version: 4 })
    const noOpPause = await owner.caller.mutation(pause, command(campaign.id, 4))
    expect(noOpPause).toMatchObject({ running: false, version: 5 })
    const rewound = await owner.caller.mutation(rewind, {
      ...command(campaign.id, 5),
      minutes: 25,
      correctionReason: 'Correction'
    })
    expect(rewound).toMatchObject({ minuteOfDay: 125, version: 6 })
    const resetClock = await owner.caller.mutation(reset, {
      ...command(campaign.id, 6),
      day: 2,
      minuteOfDay: 10,
      correctionReason: 'New scene'
    })
    expect(resetClock).toMatchObject({ day: 2, minuteOfDay: 10, version: 7 })
    const reconciled = await owner.caller.mutation(reconcile, command(campaign.id, 7))
    expect(reconciled.version).toBe(8)
    expect(await owner.caller.mutation(initialize, firstInput)).toEqual(first)
    await expect(owner.caller.mutation(initialize, { ...firstInput, day: 2 })).rejects.toThrow(
      'different input'
    )
    await expect(
      owner.caller.mutation(advance, {
        ...command(campaign.id, 0),
        minutes: 1
      })
    ).rejects.toThrow('Campaign clock changed')
    const rows = await t.run(async (ctx) => ({
      clocks: await ctx.db.query('campaignClocks').collect(),
      segments: await ctx.db.query('campaignClockSegments').collect(),
      commands: await ctx.db.query('campaignCommands').collect()
    }))
    expect(rows.clocks).toHaveLength(1)
    const segments = rows.segments.sort((a, b) => a.startAbsoluteMinute - b.startAbsoluteMinute)
    expect(segments).toHaveLength(2)
    expect(segments[0]).toMatchObject({
      startAbsoluteMinute: 100,
      endAbsoluteMinute: 100
    })
    expect(segments[0]!.stoppedAt).toEqual(expect.any(String))
    expect(segments[1]).toMatchObject({
      startAbsoluteMinute: 150,
      endAbsoluteMinute: 150
    })
    expect(segments[1]!.stoppedAt).toEqual(expect.any(String))
    expect(rows.commands).toHaveLength(9)
  })

  it('processes tied dawn and dusk boundaries during a forward jump without writing from reads', async () => {
    const { owner, campaign } = await setup()
    const initial = await owner.caller.mutation(initialize, {
      ...command(campaign.id, 0),
      day: 1,
      minuteOfDay: 359,
      dawnMinute: 360,
      duskMinute: 360
    })
    const jumped = await owner.caller.mutation(advance, {
      ...command(campaign.id, initial.version),
      minutes: 2
    })
    expect(jumped).toMatchObject({
      day: 1,
      minuteOfDay: 361,
      processedBoundaryAbsoluteMinute: 361
    })
  })

  it('rejects an unsafe forward target without changing the clock or command log', async () => {
    const { t, owner, campaign } = await setup()
    const nearLimitDay = Math.floor((Number.MAX_SAFE_INTEGER - 1439) / 1440) + 1
    const initial = await owner.caller.mutation(initialize, {
      ...command(campaign.id, 0),
      day: nearLimitDay,
      minuteOfDay: 1439,
      dawnMinute: 360,
      duskMinute: 1080
    })
    const before = await t.run(async (ctx) => ({
      clocks: await ctx.db.query('campaignClocks').collect(),
      commands: await ctx.db.query('campaignCommands').collect()
    }))
    await expect(
      owner.caller.mutation(advance, {
        ...command(campaign.id, initial.version),
        minutes: 33
      })
    ).rejects.toThrow()
    expect(
      await t.run(async (ctx) => ({
        clocks: await ctx.db.query('campaignClocks').collect(),
        commands: await ctx.db.query('campaignCommands').collect()
      }))
    ).toEqual(before)
  })

  it('keeps reads durable and denies player, anonymous, and archived writes', async () => {
    const { t, owner, other, campaign } = await setup()
    await owner.caller.mutation(initialize, {
      ...command(campaign.id, 0),
      day: 1,
      minuteOfDay: 0,
      dawnMinute: 360,
      duskMinute: 1080
    })
    const started = await owner.caller.mutation(start, command(campaign.id, 0))
    const before = await t.run(async (ctx) => ({
      clocks: await ctx.db.query('campaignClocks').collect(),
      segments: await ctx.db.query('campaignClockSegments').collect(),
      commands: await ctx.db.query('campaignCommands').collect()
    }))
    vi.useFakeTimers({ now: Date.parse(started.runningSince!) + 1_000 })
    expect(await other.caller.query(get, { campaignId: campaign.id })).toMatchObject({
      day: 1,
      minuteOfDay: 0,
      running: true
    })
    vi.useRealTimers()
    expect(
      await t.run(async (ctx) => ({
        clocks: await ctx.db.query('campaignClocks').collect(),
        segments: await ctx.db.query('campaignClockSegments').collect(),
        commands: await ctx.db.query('campaignCommands').collect()
      }))
    ).toEqual(before)
    await expect(other.caller.mutation(pause, command(campaign.id, 1))).rejects.toThrow(
      'Campaign not found'
    )
    await expect(t.query(get, { campaignId: campaign.id })).rejects.toThrow('Unauthenticated')
    await owner.caller.mutation(archive, {
      campaignId: campaign.id,
      expectedVersion: 0
    })
    await expect(owner.caller.mutation(reconcile, command(campaign.id, 1))).rejects.toThrow(
      'Archived Campaigns'
    )
    await expect(
      other.caller.mutation(reset, {
        ...command(campaign.id, 1),
        day: 1,
        minuteOfDay: 0,
        correctionReason: 'Archived'
      })
    ).rejects.toThrow('Campaign not found')
    await expect(owner.caller.query(get, { campaignId: campaign.id })).resolves.toMatchObject({
      day: 1
    })
  })

  it('rejects a clock command UUID already committed by FINISH_SESSION', async () => {
    const { owner, campaign } = await setup()
    const session = await owner.caller.mutation(createSession, {
      campaignId: campaign.id,
      title: 'Clock collision'
    })
    const commandId = crypto.randomUUID()
    await owner.caller.mutation(finishSession, {
      campaignId: campaign.id,
      sessionId: session.id,
      expectedVersion: 0,
      commandId
    })
    await expect(
      owner.caller.mutation(initialize, {
        campaignId: campaign.id,
        commandId,
        expectedVersion: 0,
        day: 1,
        minuteOfDay: 0,
        dawnMinute: 360,
        duskMinute: 1080
      })
    ).rejects.toThrow('different input')

    const reverseCommandId = crypto.randomUUID()
    await owner.caller.mutation(initialize, {
      campaignId: campaign.id,
      commandId: reverseCommandId,
      expectedVersion: 0,
      day: 1,
      minuteOfDay: 0,
      dawnMinute: 360,
      duskMinute: 1080
    })
    const secondSession = await owner.caller.mutation(createSession, {
      campaignId: campaign.id,
      title: 'Reverse collision'
    })
    await expect(
      owner.caller.mutation(finishSession, {
        campaignId: campaign.id,
        sessionId: secondSession.id,
        expectedVersion: 0,
        commandId: reverseCommandId
      })
    ).rejects.toThrow('different input')
  })

  it('recovers two assigned DAILY resources once at a boundary and rolls back all durable rows', async () => {
    const sourceFeature = cat.features?.[0]
    if (!sourceFeature) throw new Error('Expected a Cat feature.')
    const secondDailyFeature = {
      ...sourceFeature,
      id: crypto.randomUUID(),
      label: 'Second daily charge',
      charges: {
        id: crypto.randomUUID(),
        resetKind: 'DAILY' as const,
        limitKind: 'FIXED_AMOUNT' as const,
        scalingKind: 'NONE' as const,
        amount: 1
      }
    }
    const base = await readyCharacterFixture({
      resources: {
        id: crypto.randomUUID(),
        label: 'Daily charge',
        order: 0,
        availableAtLevel: 1,
        charges: {
          id: crypto.randomUUID(),
          resetKind: 'DAILY',
          limitKind: 'FIXED_AMOUNT',
          scalingKind: 'NONE',
          amount: 1
        }
      },
      features: [secondDailyFeature]
    })
    const campaign = await base.other.caller.mutation(createCampaign, campaignInput)
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
    const sheet = await base.owner.caller.query(api.characters.sheet.get, {
      id: character.id
    })
    const resource = sheet!.resources.items.find((entry) => entry.label === 'Daily charge')!
    const secondResource = sheet!.resources.items.find(
      (entry) => entry.label === 'Second daily charge'
    )!
    await base.owner.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command: {
        type: 'USE_RESOURCE',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        resourceGrantId: resource.id,
        amount: 1
      }
    })
    await base.owner.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command: {
        type: 'USE_RESOURCE',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        resourceGrantId: secondResource.id,
        amount: 1
      }
    })
    const initial = await base.other.caller.mutation(initialize, {
      ...command(campaign.id, 0),
      day: 1,
      minuteOfDay: 1439,
      dawnMinute: 360,
      duskMinute: 1080
    })
    const beforeFailure = await base.t.run(async (ctx) => ({
      characters: await ctx.db.query('characters').collect(),
      plays: await ctx.db.query('characterPlayStates').collect(),
      receipts: await ctx.db.query('characterCommandReceipts').collect(),
      clocks: await ctx.db.query('campaignClocks').collect(),
      events: await ctx.db.query('campaignEvents').collect(),
      recoveries: await ctx.db.query('campaignClockRecoveries').collect(),
      commands: await ctx.db.query('campaignCommands').collect()
    }))
    vi.spyOn(eventTransport, 'encodeCampaignEvent').mockImplementationOnce(() => {
      throw new Error('Injected post-Character-write projection failure')
    })
    await expect(
      base.other.caller.mutation(advance, {
        ...command(campaign.id, initial.version),
        minutes: 1
      })
    ).rejects.toThrow('Injected post-Character-write projection failure')
    expect(
      await base.t.run(async (ctx) => ({
        characters: await ctx.db.query('characters').collect(),
        plays: await ctx.db.query('characterPlayStates').collect(),
        receipts: await ctx.db.query('characterCommandReceipts').collect(),
        clocks: await ctx.db.query('campaignClocks').collect(),
        events: await ctx.db.query('campaignEvents').collect(),
        recoveries: await ctx.db.query('campaignClockRecoveries').collect(),
        commands: await ctx.db.query('campaignCommands').collect()
      }))
    ).toEqual(beforeFailure)
    vi.restoreAllMocks()
    const sourceLoads = vi.spyOn(builderContext, 'loadCharacterBuilderContext')
    const recovered = await base.other.caller.mutation(advance, {
      ...command(campaign.id, initial.version),
      minutes: 1
    })
    expect(sourceLoads).toHaveBeenCalledTimes(1)
    sourceLoads.mockRestore()
    expect(recovered).toMatchObject({ day: 2, minuteOfDay: 0 })
    const state = await base.owner.caller.query(api.characters.sheet.get, {
      id: character.id
    })
    expect(state!.resources.items.find((entry) => entry.id === resource.id)).toMatchObject({
      used: 0
    })
    expect(state!.resources.items.find((entry) => entry.id === secondResource.id)).toMatchObject({
      used: 0
    })
    const rows = await base.t.run(async (ctx) => ({
      events: await ctx.db.query('campaignEvents').collect(),
      recoveries: await ctx.db.query('campaignClockRecoveries').collect(),
      commands: await ctx.db.query('campaignCommands').collect()
    }))
    expect(rows.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          visibility: 'TABLE',
          type: 'CAMPAIGN_CLOCK_RESOURCE_RECOVERED'
        })
      ])
    )
    expect(rows.recoveries).toHaveLength(2)
    expect(rows.commands).toHaveLength(2)
    const rewound = await base.other.caller.mutation(rewind, {
      ...command(campaign.id, recovered.version),
      minutes: 1,
      correctionReason: 'Boundary check'
    })
    const readvanced = await base.other.caller.mutation(advance, {
      ...command(campaign.id, rewound.version),
      minutes: 1
    })
    expect(readvanced.day).toBe(2)
    expect(
      await base.t.run((ctx) => ctx.db.query('campaignClockRecoveries').collect())
    ).toHaveLength(2)
  })
})

const recoveryPrompts = makeFunctionReference<
  'query',
  { campaignId: string },
  CampaignClockRecoveryPromptDto[]
>('campaigns/clock:recoveryPrompts')
const dismissRecoveryPrompt = makeFunctionReference<
  'mutation',
  DismissCampaignClockRecoveryPromptInput,
  null
>('campaigns/clock:dismissRecoveryPrompt')

type CharacterRunFixture = Awaited<ReturnType<typeof setupCharacterRun>>

// Raw `t.run` writes skip the change tracking that pauses the clock, so Run writes go through it.
function activateRun({ t, run }: Pick<CharacterRunFixture, 't' | 'run'>) {
  return t.run((ctx) => activateFixtureRun(withSceneVisionTracking(ctx), run.id))
}

function setRunStatus(
  { t, run }: Pick<CharacterRunFixture, 't' | 'run'>,
  status: 'ACTIVE' | 'COMPLETED'
) {
  return t.run(async (ctx) => {
    const tracked = withSceneVisionTracking(ctx)
    const row = await tracked.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!row) throw new Error('Missing fixture Run.')
    await tracked.db.patch(row._id, { status })
  })
}

function openSegments({ t, campaign }: Pick<CharacterRunFixture, 't' | 'campaign'>) {
  return t.run((ctx) =>
    ctx.db
      .query('campaignClockSegments')
      .withIndex('by_campaignId_stoppedAt', (q) =>
        q.eq('campaignId', campaign.id).eq('stoppedAt', null)
      )
      .collect()
  )
}

describe('native Campaign clock and combat', () => {
  it('pauses a running clock for combat, resumes only that pause, and yields to GM commands', async () => {
    const base = await setupCharacterRun()
    const { owner, campaign } = base
    const initial = await owner.caller.mutation(initialize, {
      ...command(campaign.id, 0),
      day: 1,
      minuteOfDay: 600,
      dawnMinute: 360,
      duskMinute: 1080
    })
    const started = await owner.caller.mutation(start, command(campaign.id, initial.version))
    expect(started).toMatchObject({ running: true, pausedForCombat: false })
    await activateRun(base)
    const pausedByCombat = await owner.caller.query(get, { campaignId: campaign.id })
    expect(pausedByCombat).toMatchObject({
      running: false,
      runningSince: null,
      pausedForCombat: true,
      version: started.version + 1
    })
    expect(await openSegments(base)).toHaveLength(0)

    await setRunStatus(base, 'COMPLETED')
    const resumed = await owner.caller.query(get, { campaignId: campaign.id })
    expect(resumed).toMatchObject({
      running: true,
      pausedForCombat: false,
      version: started.version + 2
    })
    expect(await openSegments(base)).toHaveLength(1)

    const pausedByGm = await owner.caller.mutation(pause, command(campaign.id, started.version + 2))
    expect(pausedByGm).toMatchObject({ running: false, pausedForCombat: false })
    await setRunStatus(base, 'ACTIVE')
    await setRunStatus(base, 'COMPLETED')
    await expect(owner.caller.query(get, { campaignId: campaign.id })).resolves.toMatchObject({
      running: false,
      pausedForCombat: false,
      version: pausedByGm.version
    })

    await owner.caller.mutation(start, command(campaign.id, pausedByGm.version))
    await setRunStatus(base, 'ACTIVE')
    const pausedAgain = await owner.caller.query(get, { campaignId: campaign.id })
    expect(pausedAgain).toMatchObject({ running: false, pausedForCombat: true })
    const startedInCombat = await owner.caller.mutation(
      start,
      command(campaign.id, pausedAgain!.version)
    )
    expect(startedInCombat).toMatchObject({ running: true, pausedForCombat: false })
    await setRunStatus(base, 'COMPLETED')
    await expect(owner.caller.query(get, { campaignId: campaign.id })).resolves.toMatchObject({
      running: true,
      version: startedInCombat.version
    })
    expect(await openSegments(base)).toHaveLength(1)
  })

  it('leaves fighting Characters to a GM prompt at a boundary and recovers them once combat ends', async () => {
    const base = await setupCharacterRun({
      resources: {
        id: crypto.randomUUID(),
        label: 'Dawn charge',
        order: 0,
        availableAtLevel: 1,
        charges: {
          id: crypto.randomUUID(),
          resetKind: 'DAWN',
          limitKind: 'FIXED_AMOUNT',
          scalingKind: 'NONE',
          amount: 1
        }
      }
    })
    const { t, owner, player, campaign, character } = base
    const sheet = await player.caller.query(api.characters.sheet.get, { id: character.id })
    const resource = sheet!.resources.items.find((entry) => entry.label === 'Dawn charge')!
    await player.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command: {
        type: 'USE_RESOURCE',
        commandId: crypto.randomUUID(),
        expectedVersion: base.characterStreamVersion,
        resourceGrantId: resource.id,
        amount: 1
      }
    })
    const resourceUsed = async () =>
      (await player.caller.query(api.characters.sheet.get, { id: character.id }))!.resources.items.find(
        (entry) => entry.id === resource.id
      )!.used
    const readRows = () =>
      t.run(async (ctx) => ({
        prompts: await ctx.db.query('campaignClockRecoveryPrompts').collect(),
        recoveries: await ctx.db.query('campaignClockRecoveries').collect()
      }))
    await activateRun(base)
    const initial = await owner.caller.mutation(initialize, {
      ...command(campaign.id, 0),
      day: 1,
      minuteOfDay: 359,
      dawnMinute: 360,
      duskMinute: 1080
    })
    const crossed = await owner.caller.mutation(advance, {
      ...command(campaign.id, initial.version),
      minutes: 2
    })
    expect(crossed).toMatchObject({ day: 1, minuteOfDay: 361 })
    expect(await readRows()).toEqual({
      prompts: [
        expect.objectContaining({
          campaignId: campaign.id,
          characterId: character.id,
          boundaryAbsoluteMinute: 360,
          boundaryKind: 'DAWN'
        })
      ],
      recoveries: []
    })
    expect(await resourceUsed()).toBe(1)

    await owner.caller.mutation(internal.campaigns.clockRecovery.recover, {
      campaignId: campaign.id,
      actorUserId: owner.userId,
      absolute: 360,
      kind: 'DAWN',
      occurredAt: new Date().toISOString()
    })
    expect((await readRows()).prompts).toHaveLength(1)

    const prompts = await owner.caller.query(recoveryPrompts, { campaignId: campaign.id })
    expect(prompts).toEqual([
      expect.objectContaining({
        characterId: character.id,
        characterName: 'Aria',
        boundaryAbsoluteMinute: 360,
        boundaryKind: 'DAWN'
      })
    ])
    await expect(
      player.caller.query(recoveryPrompts, { campaignId: campaign.id })
    ).rejects.toThrow('Campaign not found')
    await expect(
      player.caller.mutation(dismissRecoveryPrompt, {
        campaignId: campaign.id,
        promptId: prompts[0]!.id
      })
    ).rejects.toThrow('Campaign not found')
    await owner.caller.mutation(dismissRecoveryPrompt, {
      campaignId: campaign.id,
      promptId: prompts[0]!.id
    })
    expect((await readRows()).prompts).toEqual([])
    await expect(owner.caller.query(recoveryPrompts, { campaignId: campaign.id })).resolves.toEqual(
      []
    )

    await setRunStatus(base, 'COMPLETED')
    await owner.caller.mutation(advance, {
      ...command(campaign.id, crossed.version),
      minutes: 1440
    })
    const afterCombat = await readRows()
    expect(afterCombat.prompts).toEqual([])
    expect(afterCombat.recoveries).toEqual([
      expect.objectContaining({ characterId: character.id, boundaryAbsoluteMinute: 1800 })
    ])
    expect(await resourceUsed()).toBe(0)
  })
})
