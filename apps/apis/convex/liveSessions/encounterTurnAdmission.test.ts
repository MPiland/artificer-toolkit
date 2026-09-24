import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
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
  EncounterCommandResultDto,
  EncounterExecuteInput,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { liveSessionEncounterRulesInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import {
  liveSessionEncounterTurnPendingInputSchema,
  type LiveSessionEncounterTurnPendingInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterTurn'
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

const secret = 'private-turn-planning-test-secret-at-least-32-bytes'
const environment = workerEnvironment(secret)
const path = '/live-sessions/encounter-rules'
const pendingPath = '/live-sessions/encounter-turn-pending'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

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
const execute = makeFunctionReference<'mutation', EncounterExecuteInput, EncounterCommandResultDto>(
  'encounters/commands:execute'
)
const capture = makeFunctionReference<
  'query',
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse
>('liveSessions/encounterRulesCapture:capture')

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
    name: 'Turn admission fixture',
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
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Turn admission target',
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
      epoch,
      createdAt: campaign.createdAt
    })
  )
  const scope: Omit<LiveSessionEncounterRulesInput, 'request'> = {
    campaignId: campaign.id,
    authorityEpoch: epoch,
    expectedUserId: base.owner.userId,
    expectedRole: 'OWNER',
    encounterId: run.id,
    expectedVersion: started.projection.version
  }
  return { ...base, campaign, run, started, scope }
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
    if (pathname !== path && pathname !== pendingPath)
      throw new Error(`Unexpected turn request: ${pathname}`)
    if (new Headers(init?.headers).get('authorization') !== 'Bearer fixture-access-token')
      throw new Error('Missing private capture bearer token.')
    if (new Headers(init?.headers).get('x-artificer-live-session-secret') !== secret)
      throw new Error('Missing private capture secret.')
    if (typeof init?.body !== 'string') throw new Error('Missing turn capture body.')
    requests.push(
      pathname === path
        ? liveSessionEncounterRulesInputSchema.parse(JSON.parse(init.body)).request.kind
        : liveSessionEncounterTurnPendingInputSchema.parse(JSON.parse(init.body)).command.type
    )
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
    pending: await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) =>
        q.eq('encounterId', base.run.id).eq('state', 'PENDING')
      )
      .take(8),
    commands: await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', base.run.id))
      .take(16),
    receipts: await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', base.run.id))
      .take(16)
  }))
}

it('admits only the current owner, epoch, and Run', async () => {
  const base = await setup()
  const command = {
    type: 'ADVANCE_TURN' as const,
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: base.scope.expectedVersion
  }
  const input: LiveSessionEncounterRulesInput = {
    ...base.scope,
    request: { kind: 'TURN_COMMAND', command }
  }
  await expect(base.owner.caller.query(capture, input)).resolves.toMatchObject({
    kind: 'TURN_COMMAND',
    command,
    snapshot: null,
    result: null
  })
  await expect(
    base.other.caller.query(capture, {
      ...input,
      expectedUserId: base.other.userId,
      expectedRole: 'PLAYER'
    })
  ).rejects.toThrow('scope mismatch')
  await expect(
    base.owner.caller.query(capture, { ...input, expectedUserId: base.other.userId })
  ).rejects.toThrow('scope mismatch')
  await expect(
    base.owner.caller.query(capture, { ...input, authorityEpoch: crypto.randomUUID() })
  ).rejects.toThrow('stale')
  await expect(
    base.owner.caller.query(capture, {
      ...input,
      expectedVersion: command.expectedVersion + 1
    })
  ).rejects.toThrow('scope mismatch')
  await expect(
    base.owner.caller.query(capture, {
      ...input,
      encounterId: crypto.randomUUID()
    })
  ).rejects.toThrow('scope mismatch')
}, 60_000)

it('returns exact native pending and terminal turn replays while blocking unrelated roots', async () => {
  const base = await setup()
  const first = {
    command: {
      type: 'ADVANCE_TURN' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.started.projection.version
    }
  } satisfies EncounterExecuteInput
  const advanced = await base.owner.caller.mutation(execute, first)
  expect(advanced).toMatchObject({ projection: { version: first.command.expectedVersion + 1 } })
  const wrap = {
    command: {
      type: 'ADVANCE_TURN' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: advanced.projection.version
    }
  } satisfies EncounterExecuteInput
  const pending = await base.owner.caller.mutation(execute, wrap)
  if (!pending.occurrence?.pending || pending.occurrence.pending.kind !== 'INITIATIVE_EVIDENCE')
    throw new Error('Expected native pending turn root.')
  const pendingCapture = await base.owner.caller.query(capture, {
    ...base.scope,
    expectedVersion: wrap.command.expectedVersion,
    request: { kind: 'TURN_COMMAND', command: wrap.command }
  })
  if (pendingCapture.kind !== 'TURN_COMMAND') throw new Error('Missing turn capture.')
  expect(pendingCapture.snapshot).not.toBeNull()
  expect(pendingCapture.result).toEqual(pending)
  await expect(
    base.owner.caller.query(capture, {
      ...base.scope,
      expectedVersion: wrap.command.expectedVersion,
      request: {
        kind: 'TURN_COMMAND',
        command: { ...wrap.command, commandId: crypto.randomUUID() }
      }
    })
  ).rejects.toThrow('awaiting resolution')
  await expect(
    base.owner.caller.query(capture, {
      ...base.scope,
      expectedVersion: wrap.command.expectedVersion + 1,
      request: {
        kind: 'TURN_COMMAND',
        command: { ...wrap.command, expectedVersion: wrap.command.expectedVersion + 1 }
      }
    })
  ).rejects.toThrow('different input')
  let settled = pending
  for (const value of [9, 8]) {
    const evidence = settled.occurrence?.pending
    if (!settled.occurrence || !evidence || evidence.kind !== 'INITIATIVE_EVIDENCE')
      throw new Error('Missing pending round-wrap evidence.')
    settled = await base.owner.caller.mutation(execute, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: wrap.command.expectedVersion,
        occurrenceId: settled.occurrence.occurrenceId,
        expectedOccurrenceVersion: settled.occurrence.occurrenceVersion,
        correlationId: null,
        resolution: { kind: 'ENTER_INTEGER', requestId: evidence.request.requestId, value }
      }
    })
  }
  expect(settled.projection.version).toBe(wrap.command.expectedVersion + 1)
  const replay = await base.owner.caller.query(capture, {
    ...base.scope,
    expectedVersion: wrap.command.expectedVersion,
    request: { kind: 'TURN_COMMAND', command: wrap.command }
  })
  expect(replay).toMatchObject({ kind: 'TURN_COMMAND', snapshot: null, result: settled })
  const earlierReplay = await base.owner.caller.query(capture, {
    ...base.scope,
    expectedVersion: first.command.expectedVersion,
    request: { kind: 'TURN_COMMAND', command: first.command }
  })
  expect(earlierReplay).toMatchObject({ kind: 'TURN_COMMAND', snapshot: null, result: advanced })
}, 60_000)

it('plans a same-round turn through private raw captures without writing Convex state', async () => {
  const base = await setup()
  const requests = bridge(base)
  const command = {
    type: 'ADVANCE_TURN' as const,
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: base.scope.expectedVersion
  }
  const before = await storedTurnState(base)
  const planned = await planNativeLiveEncounterTurn(
    environment,
    'fixture-access-token',
    base.scope,
    command,
    { runtime: await turnRuntime(), random: () => 0 }
  )
  if (planned.kind !== 'PLANNED' || planned.prepared.kind !== 'COMPLETE')
    throw new Error('Expected a complete same-round turn plan.')
  expect(planned.prepared.root.initiativeAdvance?.kind).toBe('SAME_ROUND')
  expect(requests).toContain('TURN_COMMAND')
  expect(requests).toContain('INITIATIVE_ROUND')
  expect(await storedTurnState(base)).toEqual(before)
  const native = await base.owner.caller.mutation(execute, { command })
  expect(planned.prepared.root.proposedTerminalTransition).toMatchObject({
    status: native.projection.status,
    round: native.projection.round,
    currentActorId: native.projection.currentActorId
  })
}, 60_000)

it('plans a round-wrap pause and restores the exact pending root without dice or writes', async () => {
  const base = await setup()
  const first = await base.owner.caller.mutation(execute, {
    command: {
      type: 'ADVANCE_TURN',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.scope.expectedVersion
    }
  })
  const command = {
    type: 'ADVANCE_TURN' as const,
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: first.projection.version
  }
  const scope = { ...base.scope, expectedVersion: command.expectedVersion }
  const requests = bridge(base)
  const before = await storedTurnState(base)
  const planned = await planNativeLiveEncounterTurn(
    environment,
    'fixture-access-token',
    scope,
    command,
    { runtime: await turnRuntime(), random: () => 0 }
  )
  if (planned.kind !== 'PLANNED' || planned.prepared.kind !== 'PENDING')
    throw new Error('Expected a pending round-wrap turn plan.')
  const context = planned.prepared.snapshot.applicationContext
  if (context.kind !== 'ENCOUNTER_INITIATIVE')
    throw new Error('Expected pending initiative evidence.')
  const advance = context.root.initiativeAdvance
  if (advance?.kind !== 'ROUND_WRAP') throw new Error('Expected round-wrap transition.')
  expect(await storedTurnState(base)).toEqual(before)
  const pending = await base.owner.caller.mutation(execute, { command })
  const nativePending = await base.owner.caller.query(capture, {
    ...scope,
    request: { kind: 'TURN_COMMAND', command }
  })
  if (nativePending.kind !== 'TURN_COMMAND' || !nativePending.snapshot)
    throw new Error('Missing native pending turn snapshot.')
  const nativeContext = nativePending.snapshot.applicationContext
  if (nativeContext.kind !== 'ENCOUNTER_INITIATIVE')
    throw new Error('Native turn did not pause for initiative.')
  expect(advance).toEqual(nativeContext.root.initiativeAdvance)
  const pendingState = await storedTurnState(base)
  requests.length = 0
  const random = vi.fn(() => 0)
  const replay = await planNativeLiveEncounterTurn(
    environment,
    'fixture-access-token',
    scope,
    command,
    { runtime: await turnRuntime(), random }
  )
  expect(replay).toEqual({ kind: 'REPLAY', result: pending })
  expect(requests).toContain('INPUTS')
  expect(random).not.toHaveBeenCalled()
  expect(await storedTurnState(base)).toEqual(pendingState)
  await expect(
    planNativeLiveEncounterTurn(
      environment,
      'fixture-access-token',
      scope,
      { ...command, commandId: crypto.randomUUID() },
      { runtime: await turnRuntime(), random }
    )
  ).rejects.toThrow()
  await expect(
    planNativeLiveEncounterTurn(
      environment,
      'fixture-access-token',
      { ...scope, authorityEpoch: crypto.randomUUID() },
      command,
      { runtime: await turnRuntime(), random }
    )
  ).rejects.toThrow()
  expect(random).not.toHaveBeenCalled()
  let settled = pending
  for (const value of [9, 8]) {
    const evidence = settled.occurrence?.pending
    if (!settled.occurrence || !evidence || evidence.kind !== 'INITIATIVE_EVIDENCE')
      throw new Error('Missing pending native round-wrap evidence.')
    settled = await base.owner.caller.mutation(execute, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: command.expectedVersion,
        occurrenceId: settled.occurrence.occurrenceId,
        expectedOccurrenceVersion: settled.occurrence.occurrenceVersion,
        correlationId: null,
        resolution: { kind: 'ENTER_INTEGER', requestId: evidence.request.requestId, value }
      }
    })
  }
  expect(advance.nextRound).toBe(settled.projection.round)
  expect(settled.projection.status).toBe('ACTIVE')
}, 60_000)

it('commits a DO round-wrap pause once and resolves it through native initiative evidence', async () => {
  const base = await setup()
  const first = await base.owner.caller.mutation(execute, {
    command: {
      type: 'ADVANCE_TURN',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.scope.expectedVersion
    }
  })
  const command = {
    type: 'ADVANCE_TURN' as const,
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: first.projection.version
  }
  const scope = { ...base.scope, expectedVersion: command.expectedVersion }
  const requests = bridge(base)
  const planned = await planNativeLiveEncounterTurn(
    environment,
    'fixture-access-token',
    scope,
    command,
    { runtime: await turnRuntime(), random: () => 0 }
  )
  if (planned.kind !== 'PLANNED' || planned.prepared.kind !== 'PENDING')
    throw new Error('Expected a pending DO turn plan.')
  const snapshot = planned.prepared.snapshot
  if (
    snapshot.snapshotKind !== 'KERNEL_EVIDENCE' ||
    snapshot.applicationContext.kind !== 'ENCOUNTER_INITIATIVE'
  )
    throw new Error('Expected pending DO initiative evidence.')
  const context = snapshot.applicationContext
  const input = liveSessionEncounterTurnPendingInputSchema.parse({
    ...scope,
    command: planned.command,
    revisions: planned.revisions,
    scenes: planned.scenes,
    snapshot
  })
  if (!input.revisions[0]) throw new Error('Expected a captured turn rules revision.')
  const before = await storedTurnState(base)
  const post = (
    pendingInput: LiveSessionEncounterTurnPendingInput,
    headers: Record<string, string> = { 'x-artificer-live-session-secret': secret }
  ) =>
    base.owner.caller.fetch(pendingPath, {
      method: 'POST',
      headers,
      body: JSON.stringify(pendingInput)
    })
  expect((await post(input, { 'x-artificer-live-session-secret': secret + '-wrong' })).status).toBe(
    401
  )
  expect(
    (
      await post({
        ...input,
        snapshot: {
          ...snapshot,
          applicationContext: {
            ...context,
            root: { ...context.root, rootCommandId: crypto.randomUUID() }
          }
        }
      })
    ).status
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
  expect(await storedTurnState(base)).toEqual(before)

  const pending = await callLiveSessionRoute(
    environment,
    'fixture-access-token',
    'encounterTurnPending',
    input
  )
  expect(requests.at(-1)).toBe('ADVANCE_TURN')
  expect(pending.occurrence?.status).toBe('PENDING')
  expect(pending.occurrence?.occurrenceId).toBe(input.snapshot.occurrenceId)
  expect(pending.projection.version).toBe(command.expectedVersion)
  const after = await storedTurnState(base)
  expect(after).toMatchObject({
    run: before.run,
    actors: before.actors,
    rounds: before.rounds,
    participants: before.participants,
    commands: before.commands,
    receipts: before.receipts
  })
  expect(after.pending).toHaveLength(before.pending.length + 1)
  expect(after.pending[0]).toMatchObject({
    id: input.snapshot.occurrenceId,
    rootCommandId: command.commandId,
    expectedEncounterVersion: command.expectedVersion,
    pendingSnapshotJson: JSON.stringify(input.snapshot)
  })
  const consumed = input.revisions[0]!
  const advancedRevision = crypto.randomUUID()
  await base.t.run(async (ctx) => {
    const marker = await ctx.db
      .query('sceneVisionRevisions')
      .withIndex('by_scope_id', (q) => q.eq('scope', consumed.scope).eq('id', consumed.id))
      .unique()
    if (marker) await ctx.db.patch(marker._id, { revision: advancedRevision })
    else await ctx.db.insert('sceneVisionRevisions', { ...consumed, revision: advancedRevision })
  })
  expect(advancedRevision).not.toBe(consumed.revision)
  expect(
    await callLiveSessionRoute(environment, 'fixture-access-token', 'encounterTurnPending', input)
  ).toEqual(pending)
  expect(await storedTurnState(base)).toEqual(after)

  let settled = pending
  for (const value of [9, 8]) {
    const evidence = settled.occurrence?.pending
    if (!settled.occurrence || !evidence || evidence.kind !== 'INITIATIVE_EVIDENCE')
      throw new Error('Missing DO-issued initiative evidence.')
    settled = await base.owner.caller.mutation(execute, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: command.expectedVersion,
        occurrenceId: settled.occurrence.occurrenceId,
        expectedOccurrenceVersion: settled.occurrence.occurrenceVersion,
        correlationId: null,
        resolution: { kind: 'ENTER_INTEGER', requestId: evidence.request.requestId, value }
      }
    })
  }
  expect(settled.projection.version).toBe(command.expectedVersion + 1)
  expect(settled.projection.status).toBe('ACTIVE')
  const replay = await base.owner.caller.query(capture, {
    ...scope,
    request: { kind: 'TURN_COMMAND', command }
  })
  expect(replay).toMatchObject({ kind: 'TURN_COMMAND', snapshot: null, result: settled })
}, 60_000)
