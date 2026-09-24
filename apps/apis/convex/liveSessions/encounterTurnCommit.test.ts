import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignSessionDto,
  createCampaignSessionInputSchema
} from '@artificer-toolkit/schema/api/campaignSessions'
import type {
  CampaignPlaySettingsDto,
  SaveCampaignPlaySettingsInput
} from '@artificer-toolkit/schema/api/campaignSettings'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterCommandResultDto,
  EncounterExecuteInput,
  EncounterGmProjectionDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import {
  liveSessionEncounterTurnCommitInputSchema,
  liveSessionEncounterTurnPendingInputSchema,
  type LiveSessionEncounterTurnCommitInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterTurn'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import {
  createPlatformRulesRuntime,
  deriveRulesContinuationKey
} from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture } from '../../tests/fixtures/characters'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import { importedSubject } from '../../tests/fixtures/publication'
import { internal } from '../_generated/api'
import { planNativeLiveEncounterTurn } from '../../../session-worker/src/nativeEncounterTurn'
import { callLiveSessionRoute } from '../../../session-worker/src/liveSessionRoutes'
import {
  insertActiveLiveAuthority,
  stubLiveSessionFetch,
  workerEnvironment
} from '../../tests/fixtures/liveSessionWorker'

const secret = 'private-turn-commit-test-secret-at-least-32-bytes'
const environment = workerEnvironment(secret)
const capturePath = '/live-sessions/encounter-rules'
const commitPath = '/live-sessions/encounter-turn'
const pendingPath = '/live-sessions/encounter-turn-pending'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createSession = makeFunctionReference<
  'mutation',
  z.input<typeof createCampaignSessionInputSchema>,
  CampaignSessionDto
>('campaigns/sessions:create')
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
const execute = makeFunctionReference<'mutation', EncounterExecuteInput, EncounterCommandResultDto>(
  'encounters/commands:execute'
)

async function setup() {
  const base = await fixture()
  const initiative = createEncounterInitiativeDefinitions([
    { procedure: 'ACTOR_ROLL', cadence: 'EACH_ROUND' }
  ])
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: initiative.definitions
  })
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...wolf, subjectKind: 'CREATURE', document: wolf })]
  })
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Turn commit fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
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
  const session = await base.owner.caller.mutation(createSession, { campaignId: campaign.id })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Turn commit target',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CREATURE', sourceId: wolf.id },
      { kind: 'CREATURE', sourceId: wolf.id }
    ]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    sessionId: session.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  let started = await base.owner.caller.mutation(execute, {
    command: {
      type: 'START',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: run.version
    }
  })
  for (const value of [12, 11]) {
    const pending = started.occurrence?.pending
    if (!started.occurrence || !pending || pending.kind !== 'INITIATIVE_EVIDENCE')
      throw new Error('Missing Assisted initiative evidence.')
    started = await base.owner.caller.mutation(execute, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: run.version,
        occurrenceId: started.occurrence.occurrenceId,
        expectedOccurrenceVersion: started.occurrence.occurrenceVersion,
        correlationId: null,
        resolution: { kind: 'ENTER_INTEGER', requestId: pending.request.requestId, value }
      }
    })
  }
  if (started.projection.status !== 'ACTIVE') throw new Error('Assisted Run did not start.')
  const epoch = crypto.randomUUID()
  await base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: campaign.id,
      sessionId: session.id,
      epoch,
      createdAt: campaign.createdAt
    })
  )
  const scope: Omit<LiveSessionEncounterRulesInput, 'request'> = {
    campaignId: campaign.id,
    sessionId: session.id,
    authorityEpoch: epoch,
    expectedUserId: base.owner.userId,
    expectedRole: 'OWNER',
    encounterId: run.id,
    expectedVersion: started.projection.version
  }
  const command = {
    type: 'ADVANCE_TURN' as const,
    encounterId: run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: started.projection.version
  }
  return { ...base, campaign, session, run, started, scope, command }
}

async function turnRuntime() {
  const runtimeSecret = process.env.BETTER_AUTH_SECRET
  if (!runtimeSecret) throw new Error('Missing fixture rule continuation secret.')
  return createPlatformRulesRuntime({
    continuationIntegrityKey: await deriveRulesContinuationKey(
      process.env.RULES_CONTINUATION_SECRET
    ),
    definitions: {
      async requireCurrent() {
        throw new Error('Turn graphs must use captured definitions.')
      }
    }
  })
}

function bridge(base: Awaited<ReturnType<typeof setup>>) {
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret)
  const requests: string[] = []
  stubLiveSessionFetch((pathname, init) => {
    if (pathname !== capturePath && pathname !== commitPath && pathname !== pendingPath)
      throw new Error(`Unexpected private turn request: ${pathname}`)
    if (new Headers(init?.headers).get('authorization') !== 'Bearer fixture-access-token')
      throw new Error('Missing private turn bearer token.')
    if (new Headers(init?.headers).get('x-artificer-live-session-secret') !== secret)
      throw new Error('Missing private turn secret.')
    if (typeof init?.body !== 'string') throw new Error('Missing private turn body.')
    if (pathname === capturePath) liveSessionEncounterRulesInputSchema.parse(JSON.parse(init.body))
    else if (pathname === commitPath)
      liveSessionEncounterTurnCommitInputSchema.parse(JSON.parse(init.body))
    else liveSessionEncounterTurnPendingInputSchema.parse(JSON.parse(init.body))
    requests.push(pathname)
    return base.owner.caller.fetch(pathname, init)
  })
  return requests
}

async function storedTurnState(base: Awaited<ReturnType<typeof setup>>) {
  return base.t.run(async (ctx) => ({
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id))
      .take(8),
    rounds: await ctx.db
      .query('encounterInitiativeRounds')
      .withIndex('by_encounterId_round', (q) => q.eq('encounterId', base.run.id))
      .take(8),
    participants: await ctx.db
      .query('encounterInitiativeParticipants')
      .withIndex('by_encounterId_round_actorId', (q) => q.eq('encounterId', base.run.id))
      .take(8),
    command: await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('commandId', base.command.commandId)
      )
      .unique(),
    occurrence: await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_campaignId_rootCommandId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('rootCommandId', base.command.commandId)
      )
      .unique(),
    receipt: await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) =>
        q.eq('encounterId', base.run.id).eq('commandId', base.command.commandId)
      )
      .unique()
  }))
}

async function nativePreview(base: Awaited<ReturnType<typeof setup>>) {
  const previews: EncounterCommandResultDto[] = []
  await expect(
    base.owner.caller.run(async (ctx) => {
      previews.push(await ctx.runMutation(execute, { command: base.command }))
      throw new Error('Roll back native turn preview.')
    })
  ).rejects.toThrow('Roll back native turn preview.')
  const preview = previews[0]
  if (!preview) throw new Error('Missing native turn preview.')
  return preview
}

async function plan(base: Awaited<ReturnType<typeof setup>>) {
  const planned = await planNativeLiveEncounterTurn(
    environment,
    'fixture-access-token',
    base.scope,
    base.command,
    { runtime: await turnRuntime(), random: () => 0 }
  )
  if (planned.kind !== 'PLANNED' || planned.prepared.kind !== 'COMPLETE' || !planned.terminal)
    throw new Error('Expected a complete same-round DO turn plan.')
  return { ...planned, terminal: planned.terminal }
}

it('commits a complete DO turn through private HTTP and replays its original receipt', async () => {
  const base = await setup()
  const requests = bridge(base)
  const before = await storedTurnState(base)
  const planned = await plan(base)
  expect(await storedTurnState(base)).toEqual(before)
  const native = await nativePreview(base)
  expect(await storedTurnState(base)).toEqual(before)
  const result = await callLiveSessionRoute(
    environment,
    'fixture-access-token',
    'encounterTurnCommit',
    planned.terminal
  )
  expect(requests.at(-1)).toBe(commitPath)
  expect(result.projection).toMatchObject({
    status: native.projection.status,
    round: native.projection.round,
    currentActorId: native.projection.currentActorId,
    version: native.projection.version
  })
  expect(result.projection.actors).toEqual(native.projection.actors)
  expect(result.projection.version).toBe(base.command.expectedVersion + 1)
  const after = await storedTurnState(base)
  expect(after.run).not.toEqual(before.run)
  expect(after.command).not.toBeNull()
  expect(after.receipt).not.toBeNull()
  expect(after.occurrence).not.toBeNull()
  const consumed = planned.terminal.revisions[0]
  if (!consumed) throw new Error('Expected captured rules revision.')
  await base.t.run(async (ctx) => {
    const marker = await ctx.db
      .query('sceneVisionRevisions')
      .withIndex('by_scope_id', (q) => q.eq('scope', consumed.scope).eq('id', consumed.id))
      .unique()
    if (marker) await ctx.db.patch(marker._id, { revision: crypto.randomUUID() })
    else await ctx.db.insert('sceneVisionRevisions', { ...consumed, revision: crypto.randomUUID() })
  })
  expect(
    await callLiveSessionRoute(
      environment,
      'fixture-access-token',
      'encounterTurnCommit',
      planned.terminal
    )
  ).toEqual(result)
  expect(await storedTurnState(base)).toEqual(after)
}, 60_000)

it('rejects stale and altered terminal turn inputs without partial aggregate writes', async () => {
  const base = await setup()
  bridge(base)
  const planned = await plan(base)
  const input = planned.terminal
  const before = await storedTurnState(base)
  const post = (
    body: LiveSessionEncounterTurnCommitInput,
    headers: Record<string, string> = { 'x-artificer-live-session-secret': secret }
  ) => base.owner.caller.fetch(commitPath, { method: 'POST', headers, body: JSON.stringify(body) })
  expect((await post(input, { 'x-artificer-live-session-secret': secret + '-wrong' })).status).toBe(
    401
  )
  expect(
    (await post({ ...input, command: { ...input.command, commandId: crypto.randomUUID() } })).status
  ).toBe(409)
  expect(
    (await post({ ...input, root: { ...input.root, rootCommandId: crypto.randomUUID() } })).status
  ).toBe(409)
  expect(
    (
      await post({
        ...input,
        revisions: input.revisions.map((revision, index) =>
          index === 0 ? { ...revision, revision: crypto.randomUUID() } : revision
        )
      })
    ).status
  ).toBe(409)
  const firstRule = input.rules.actors[0]
  if (!firstRule) throw new Error('Expected turn actor rule output.')
  expect(
    (
      await post({
        ...input,
        rules: {
          actors: [{ ...firstRule, actorId: crypto.randomUUID() }, ...input.rules.actors.slice(1)]
        }
      })
    ).status
  ).toBe(409)
  expect(await storedTurnState(base)).toEqual(before)
}, 60_000)

it('settles a private round-wrap initiative tie through retained responses and one terminal turn', async () => {
  const base = await setup()
  const requests = bridge(base)
  const firstPlan = await plan(base)
  const first = await callLiveSessionRoute(
    environment,
    'fixture-access-token',
    'encounterTurnCommit',
    firstPlan.terminal
  )
  expect(first.projection.round).toBe(1)
  base.scope = { ...base.scope, expectedVersion: first.projection.version }
  base.command = {
    type: 'ADVANCE_TURN',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: first.projection.version
  }
  const before = await storedTurnState(base)
  const beforeRows = await base.t.run(async (ctx) => ({
    commands: await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', base.run.id))
      .take(16),
    receipts: await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', base.run.id))
      .take(16)
  }))
  const originalRound = before.rounds.find((round) => round.round === 1)
  if (!originalRound) throw new Error('Missing original initiative round.')
  const runtime = await turnRuntime()
  let rolls = 0
  const random = (maximum: number) => {
    expect(maximum).toBe(20)
    rolls += 1
    return 8
  }
  const rootPlan = await planNativeLiveEncounterTurn(
    environment,
    'fixture-access-token',
    base.scope,
    base.command,
    { runtime, random }
  )
  if (rootPlan.kind !== 'PLANNED' || rootPlan.prepared.kind !== 'PENDING')
    throw new Error('Expected a pending round-wrap initiative plan.')
  const rootInput = liveSessionEncounterTurnPendingInputSchema.parse({
    ...base.scope,
    command: rootPlan.command,
    revisions: rootPlan.revisions,
    scenes: rootPlan.scenes,
    snapshot: rootPlan.prepared.snapshot
  })
  const firstPending = await callLiveSessionRoute(
    environment,
    'fixture-access-token',
    'encounterTurnPending',
    rootInput
  )
  if (
    !firstPending.occurrence?.pending ||
    firstPending.occurrence.pending.kind !== 'INITIATIVE_EVIDENCE'
  )
    throw new Error('Expected first initiative evidence.')
  const occurrenceId = firstPending.occurrence.occurrenceId
  expect(firstPending.occurrence.occurrenceVersion).toBe(0)
  expect(firstPending.projection.version).toBe(base.command.expectedVersion)
  const afterRoot = await storedTurnState(base)
  expect(afterRoot).toMatchObject({
    run: before.run,
    actors: before.actors,
    rounds: before.rounds,
    participants: before.participants,
    command: null,
    receipt: null
  })
  expect(afterRoot.occurrence).toMatchObject({ id: occurrenceId, version: 0, state: 'PENDING' })
  const noRoll = () => {
    throw new Error('A replay must not roll initiative.')
  }
  expect(
    await planNativeLiveEncounterTurn(
      environment,
      'fixture-access-token',
      base.scope,
      base.command,
      {
        runtime,
        random: noRoll
      }
    )
  ).toEqual({ kind: 'REPLAY', result: firstPending })
  expect(
    await callLiveSessionRoute(
      environment,
      'fixture-access-token',
      'encounterTurnPending',
      rootInput
    )
  ).toEqual(firstPending)
  expect(await storedTurnState(base)).toEqual(afterRoot)

  let current = firstPending
  let terminal: EncounterCommandResultDto | null = null
  const responseCommands: ResolveRuleOccurrenceInputDto[] = []
  let evidenceCount = 0
  let orderCount = 0
  for (let step = 0; step < 6; step += 1) {
    const pending = current.occurrence?.pending
    if (!current.occurrence || !pending) throw new Error('Missing round-wrap response request.')
    let resolution: ResolveRuleOccurrenceInputDto['resolution']
    if (pending.kind === 'INITIATIVE_EVIDENCE') {
      evidenceCount += 1
      resolution =
        evidenceCount === 1
          ? { kind: 'ENTER_INTEGER', requestId: pending.request.requestId, value: 9 }
          : { kind: 'SYSTEM_ROLL', requestId: pending.request.requestId }
    } else if (pending.kind === 'INITIATIVE_ORDER') {
      orderCount += 1
      resolution = {
        kind: 'INITIATIVE_ENTITY',
        requestId: pending.requestId,
        entityId: pending.optionIds[0]!
      }
    } else throw new Error('Unexpected round-wrap request.')
    const command: ResolveRuleOccurrenceInputDto = {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.command.expectedVersion,
      occurrenceId,
      expectedOccurrenceVersion: current.occurrence.occurrenceVersion,
      correlationId: null,
      resolution
    }
    if (evidenceCount === 1 && orderCount === 0) {
      await expect(
        planNativeLiveEncounterTurn(
          environment,
          'fixture-access-token',
          base.scope,
          {
            ...command,
            resolution: { kind: 'ENTER_INTEGER', requestId: crypto.randomUUID(), value: 9 }
          },
          { runtime, random: noRoll }
        )
      ).rejects.toThrow()
      await expect(
        planNativeLiveEncounterTurn(
          environment,
          'fixture-access-token',
          {
            ...base.scope,
            expectedUserId: base.other.userId
          },
          command,
          { runtime, random: noRoll }
        )
      ).rejects.toThrow()
    }
    if (current.occurrence.occurrenceVersion > 0) {
      await expect(
        planNativeLiveEncounterTurn(
          environment,
          'fixture-access-token',
          base.scope,
          {
            ...command,
            expectedOccurrenceVersion: current.occurrence.occurrenceVersion - 1
          },
          { runtime, random: noRoll }
        )
      ).rejects.toThrow()
    }
    expect(await storedTurnState(base)).toMatchObject({
      run: before.run,
      actors: before.actors,
      rounds: before.rounds,
      participants: before.participants,
      command: null,
      receipt: null
    })
    const planned = await planNativeLiveEncounterTurn(
      environment,
      'fixture-access-token',
      base.scope,
      command,
      { runtime, random }
    )
    if (planned.kind !== 'PLANNED') throw new Error('Expected a planned initiative response.')
    responseCommands.push(command)
    const previousVersion = current.occurrence.occurrenceVersion
    if (planned.prepared.kind === 'PENDING') {
      const input = liveSessionEncounterTurnPendingInputSchema.parse({
        ...base.scope,
        command: planned.command,
        revisions: planned.revisions,
        scenes: planned.scenes,
        snapshot: planned.prepared.snapshot
      })
      current = await callLiveSessionRoute(
        environment,
        'fixture-access-token',
        'encounterTurnPending',
        input
      )
      expect(current.occurrence).toMatchObject({
        occurrenceId,
        occurrenceVersion: previousVersion + 1,
        status: 'PENDING'
      })
      expect(await storedTurnState(base)).toMatchObject({
        run: before.run,
        actors: before.actors,
        rounds: before.rounds,
        participants: before.participants,
        command: null,
        receipt: null
      })
      expect(
        await planNativeLiveEncounterTurn(
          environment,
          'fixture-access-token',
          base.scope,
          command,
          {
            runtime,
            random: noRoll
          }
        )
      ).toEqual({ kind: 'REPLAY', result: current })
      expect(
        await planNativeLiveEncounterTurn(
          environment,
          'fixture-access-token',
          base.scope,
          base.command,
          {
            runtime,
            random: noRoll
          }
        )
      ).toEqual({ kind: 'REPLAY', result: current })
    } else {
      if (!planned.terminal) throw new Error('Missing terminal initiative turn.')
      terminal = await callLiveSessionRoute(
        environment,
        'fixture-access-token',
        'encounterTurnCommit',
        planned.terminal
      )
      expect(terminal.occurrence).toMatchObject({
        occurrenceId,
        occurrenceVersion: previousVersion + 1,
        status: 'COMPLETE'
      })
      expect(
        await callLiveSessionRoute(
          environment,
          'fixture-access-token',
          'encounterTurnCommit',
          planned.terminal
        )
      ).toEqual(terminal)
      break
    }
  }
  if (!terminal) throw new Error('Initiative tie did not settle.')
  expect(evidenceCount).toBe(4)
  expect(orderCount).toBe(1)
  expect(rolls).toBe(3)
  expect(requests).toContain(pendingPath)
  expect(requests.at(-1)).toBe(commitPath)
  expect(terminal.projection).toMatchObject({
    status: 'ACTIVE',
    round: 2,
    version: base.command.expectedVersion + 1
  })
  const after = await storedTurnState(base)
  expect(after.rounds).toHaveLength(before.rounds.length + 1)
  expect(after.rounds.find((round) => round.round === 1)).toEqual({
    ...originalRound,
    status: 'COMPLETED',
    version: originalRound.version + 1,
    updatedAt: expect.any(String)
  })
  expect(after.participants.length).toBeGreaterThan(before.participants.length)
  expect(after.command).not.toBeNull()
  expect(after.receipt).not.toBeNull()
  if (!after.receipt) throw new Error('Missing terminal initiative receipt.')
  const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
    JSON.parse(after.receipt.commandMetadataJson)
  )
  if (metadata.transition !== 'TURN_EFFECTS') throw new Error('Missing response history.')
  expect(metadata.resolutionCommands.map((entry) => entry.commandId)).toEqual(
    responseCommands.map((command) => command.commandId)
  )
  const afterRows = await base.t.run(async (ctx) => ({
    commands: await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', base.run.id))
      .take(16),
    receipts: await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', base.run.id))
      .take(16)
  }))
  expect(afterRows.commands).toHaveLength(beforeRows.commands.length + 1)
  expect(afterRows.receipts).toHaveLength(beforeRows.receipts.length + 1)
  expect(afterRows.commands.filter((row) => row.commandId === base.command.commandId)).toHaveLength(
    1
  )
  expect(afterRows.receipts.filter((row) => row.commandId === base.command.commandId)).toHaveLength(
    1
  )
  for (const command of responseCommands) {
    expect(
      await planNativeLiveEncounterTurn(environment, 'fixture-access-token', base.scope, command, {
        runtime,
        random: noRoll
      })
    ).toEqual({ kind: 'REPLAY', result: terminal })
  }
  expect(
    await planNativeLiveEncounterTurn(
      environment,
      'fixture-access-token',
      base.scope,
      base.command,
      {
        runtime,
        random: noRoll
      }
    )
  ).toEqual({ kind: 'REPLAY', result: terminal })
  expect(await storedTurnState(base)).toEqual(after)
}, 90_000)
