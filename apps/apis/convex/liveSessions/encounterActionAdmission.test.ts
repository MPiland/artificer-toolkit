import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterCommandResultDto,
  EncounterGmProjectionDto,
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  liveSessionEncounterActionCommitInputSchema,
  liveSessionEncounterActionPendingInputSchema,
  type LiveSessionEncounterActionCommitInput,
  type LiveSessionEncounterActionPendingInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput,
  type LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import {
  commitNativeLiveEncounterAction,
  commitNativeLiveEncounterActionPending,
  planNativeLiveEncounterAction
} from '../../../session-worker/src/nativeEncounterRules'
import { createPlatformRulesRuntime } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import {
  automaticChargedCreature,
  automaticChargedCreatureId
} from '../../tests/fixtures/encounterAction'
import { fixture } from '../../tests/fixtures/characters'
import { importedSubject } from '../../tests/fixtures/publication'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { api, internal } from '../_generated/api'
import { readRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import {
  insertActiveLiveAuthority,
  stubLiveSessionFetch,
  workerEnvironment,
  executeInRoom
} from '../../tests/fixtures/liveSessionWorker'
import { playerControlFixture, setActorControllers } from '../../tests/fixtures/playerControl'

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
const capture = makeFunctionReference<
  'query',
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse
>('liveSessions/encounterRulesCapture:capture')
const commitAction = makeFunctionReference<
  'mutation',
  LiveSessionEncounterActionCommitInput,
  EncounterCommandResultDto
>('liveSessions/encounterActionCommit:commit')
const secret = 'private-action-admission-test-secret-at-least-32-bytes'
const environment = workerEnvironment(secret)
const path = '/live-sessions/encounter-rules'
const pendingPath = '/live-sessions/encounter-action-pending'

function testRuntime() {
  return createPlatformRulesRuntime({
    continuationIntegrityKey: new Uint8Array(32).fill(1),
    definitions: {
      async requireCurrent() {
        throw new Error('Sealed action graphs must not load current definitions.')
      }
    }
  })
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

async function setup(pending = false, fresh = false, diceDamage = false) {
  const base = await fixture()
  const authoredDamage = wolf.features
    ?.find((feature) => feature.label === 'Bite')
    ?.effects?.[0]?.paths?.flatMap((path) =>
      'resultBlock' in path
        ? path.resultBlock.outcomes.filter((outcome) => outcome.effectKind === 'DAMAGE')
        : []
    )[0]
  if (diceDamage && !authoredDamage) throw new Error('Missing authored Wolf Bite damage.')
  const actionCreature = pending
    ? {
        ...automaticChargedCreature,
        features: automaticChargedCreature.features?.map((feature) => ({
          ...feature,
          rollDefinitions: [
            {
              id: crypto.randomUUID(),
              label: 'Bite attack',
              kind: 'ATTACK' as const,
              expression: { count: 1, die: 20, modifier: 4 },
              rollMode: 'NORMAL' as const,
              chargeCost: null,
              order: 1
            }
          ],
          effects: feature.effects?.map((effect) => ({
            ...effect,
            invocation: { ...effect.invocation, triggerCode: 'MELEE_WEAPON_ATTACK' as const },
            paths: effect.paths?.map((path) =>
              'resultBlock' in path
                ? {
                    ...path,
                    pathCode: 'ON_HIT' as const,
                    resultBlock: diceDamage
                      ? {
                          ...path.resultBlock,
                          outcomes: path.resultBlock.outcomes.map((outcome) =>
                            outcome.effectKind === 'DAMAGE'
                              ? { ...authoredDamage!, id: outcome.id }
                              : outcome
                          )
                        }
                      : path.resultBlock
                  }
                : path
            )
          }))
        }))
      }
    : automaticChargedCreature
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: SRD_RULE_STATE_DEFINITIONS.filter(
      (definition) => definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID
    )
  })
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ ...actionCreature, subjectKind: 'CREATURE', document: actionCreature })
    ]
  })
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Action admission fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Action admission fixture',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CREATURE', sourceId: automaticChargedCreatureId },
      pending
        ? { kind: 'CREATURE', sourceId: automaticChargedCreatureId }
        : { kind: 'CUSTOM', label: 'Target', maxHitPoints: 100 }
    ]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const actor = run.actors.find((candidate) => candidate.kind === 'CREATURE')
  const target = run.actors.find((candidate) => candidate.id !== actor?.id)
  if (!actor || !target) throw new Error('Missing action fixture actors.')
  const actionId = await base.t.run(async (ctx) => {
    const state = await activateFixtureRun(
      ctx,
      run.id,
      { automationMode: 'ASSISTED', round: 1, currentActorId: actor.id },
      [actor.id, target.id]
    )
    const current = await readRunActor(ctx, state, actor.id)
    const capability = discoverEncounterFeatureActionCapabilities({
      actor: current,
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
      abilityDefinitions: (srdSystemRecord.abilities ?? []).map((ability) => ({
        id: ability.id,
        code: ability.code
      }))
    }).find(
      (candidate) =>
        candidate.mechanicFacts.invocation.triggerCode ===
        (pending ? 'MELEE_WEAPON_ATTACK' : 'ACTIVATED')
    )
    if (!capability) throw new Error('Missing action fixture capability.')
    return capability.actionId
  })
  if (pending) await setAutoRollDice(base.t, base.owner.userId, false)
  const command: ResolveEncounterActionInputDto = {
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    encounterId: run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: run.version,
    actorId: actor.id,
    targetActorId: target.id,
    actionId,
    optionalCombatIntent: null,
    sceneContext: null
  }
  const result = fresh ? null : await executeInRoom(base.owner.caller, { command })
  if (!fresh) {
    if (!result) throw new Error('Missing executed action fixture result.')
    expect(result.occurrence?.status).toBe(pending ? 'PENDING' : 'COMPLETE')
    expect(result.projection.version).toBe(run.version + (pending ? 0 : 1))
  }
  const authorityEpoch = crypto.randomUUID()
  await base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: campaign.id,
      epoch: authorityEpoch,
      createdAt: campaign.createdAt
    })
  )
  const scope = {
    campaignId: campaign.id,
    authorityEpoch,
    expectedUserId: base.owner.userId,
    expectedRole: 'OWNER' as const,
    encounterId: run.id,
    expectedVersion: command.expectedVersion
  }
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret)
  return { ...base, campaign, run, command, result, scope }
}

async function storedActionState(base: Awaited<ReturnType<typeof setup>>) {
  return base.t.run(async (ctx) => {
    const [run, actor, target, command, occurrence, receipt] = await Promise.all([
      ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique(),
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', base.run.id).eq('id', base.command.actorId)
        )
        .unique(),
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', base.run.id).eq('id', base.command.targetActorId)
        )
        .unique(),
      ctx.db
        .query('encounterRunCommands')
        .withIndex('by_campaignId_commandId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('commandId', base.command.commandId)
        )
        .unique(),
      ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_campaignId_rootCommandId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('rootCommandId', base.command.commandId)
        )
        .unique(),
      ctx.db
        .query('encounterRuleReceipts')
        .withIndex('by_campaignId_commandId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('commandId', base.command.commandId)
        )
        .unique()
    ])
    return {
      run: run?.stateChecksum,
      actor: actor?.stateChecksum,
      target: target?.stateChecksum,
      command: command?._id ?? null,
      occurrence: occurrence?._id ?? null,
      receipt: receipt?._id ?? null
    }
  })
}

it('replays the exact committed action before reading mutable rules inputs', async () => {
  const base = await setup()
  const requests: string[] = []
  stubLiveSessionFetch(async (pathname, init) => {
    requests.push(pathname)
    expect(pathname).toBe(path)
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer fixture-access-token')
    if (typeof init?.body !== 'string') throw new Error('Missing capture body.')
    const input = liveSessionEncounterRulesInputSchema.parse(JSON.parse(init.body))
    expect(input.request.kind).toBe('ACTION_COMMAND')
    if (input.request.kind === 'ACTION_COMMAND') {
      expect(input.request.command.commandId.toLowerCase()).toBe(base.command.commandId)
      expect(input.request.command.expectedVersion).toBe(base.command.expectedVersion)
    }
    return base.owner.caller.fetch(pathname, init)
  })
  const runtime = testRuntime()
  const executeResolved = vi.spyOn(runtime, 'executeResolved')
  const resume = vi.spyOn(runtime, 'resume')
  const random = vi.fn(() => 0)
  const replay = await planNativeLiveEncounterAction(
    environment,
    'fixture-access-token',
    base.scope,
    base.command,
    { runtime, random }
  )
  expect(replay).toEqual({ kind: 'REPLAY', result: base.result })
  expect(requests).toEqual([path])
  requests.length = 0
  const uppercase = {
    ...base.command,
    encounterId: base.command.encounterId.toUpperCase(),
    actorId: base.command.actorId.toUpperCase(),
    targetActorId: base.command.targetActorId.toUpperCase(),
    commandId: base.command.commandId.toUpperCase()
  }
  expect(
    await planNativeLiveEncounterAction(
      environment,
      'fixture-access-token',
      base.scope,
      uppercase,
      { runtime, random }
    )
  ).toEqual(replay)
  expect(requests).toEqual([path])
  expect(executeResolved).not.toHaveBeenCalled()
  expect(resume).not.toHaveBeenCalled()
  expect(random).not.toHaveBeenCalled()
})

it('replays a stored Assisted pending result without preparing or rolling again', async () => {
  const base = await setup(true)
  const requests: string[] = []
  stubLiveSessionFetch((pathname, init) => {
    requests.push(pathname)
    return base.owner.caller.fetch(pathname, init)
  })
  const runtime = testRuntime()
  const executeResolved = vi.spyOn(runtime, 'executeResolved')
  const resume = vi.spyOn(runtime, 'resume')
  const random = vi.fn(() => 0)
  expect(
    await planNativeLiveEncounterAction(
      environment,
      'fixture-access-token',
      base.scope,
      base.command,
      { runtime, random }
    )
  ).toEqual({ kind: 'REPLAY', result: base.result })
  expect(requests).toEqual([path])
  expect(executeResolved).not.toHaveBeenCalled()
  expect(resume).not.toHaveBeenCalled()
  expect(random).not.toHaveBeenCalled()
})

it('plans a fresh Automatic action with damage and feature charge without publishing', async () => {
  const base = await setup(false, true)
  const before = await storedActionState(base)
  const requests: string[] = []
  stubLiveSessionFetch((pathname, init) => {
    requests.push(pathname)
    if (pathname !== path) throw new Error(`Unexpected capture: ${pathname}`)
    return base.owner.caller.fetch(pathname, init)
  })
  const runtime = testRuntime()
  const executeResolved = vi.spyOn(runtime, 'executeResolved')
  const uppercase = {
    ...base.command,
    encounterId: base.command.encounterId.toUpperCase(),
    commandId: base.command.commandId.toUpperCase(),
    actorId: base.command.actorId.toUpperCase(),
    targetActorId: base.command.targetActorId.toUpperCase()
  }
  const planned = await planNativeLiveEncounterAction(
    environment,
    'fixture-access-token',
    base.scope,
    uppercase,
    { runtime, random: () => 0 }
  )
  expect(planned.kind).toBe('PLANNED')
  if (planned.kind !== 'PLANNED') throw new Error('Expected planned Automatic action.')
  expect(planned.command).toEqual(base.command)
  expect(planned.fingerprint).toBe(checksumCanonicalJson(base.command))
  expect(planned.execution.kind).toBe('COMPLETE')
  expect(executeResolved).toHaveBeenCalled()
  const target = base.run.actors.find((actor) => actor.id === base.command.targetActorId)
  if (!target) throw new Error('Missing action target.')
  const updatedTarget = planned.mechanics.targetPlan.updatedActor
  if (updatedTarget.kind === 'CHARACTER') throw new Error('Expected a non-Character target.')
  expect(updatedTarget.currentHitPoints).toBe(target.currentHitPoints - 1)
  expect(planned.mechanics.featureResourceReceipt).toMatchObject({
    cost: 1,
    beforeUsed: 0,
    afterUsed: 1
  })
  expect(requests.length).toBeGreaterThan(1)
  expect(requests.every((request) => request === path)).toBe(true)
  expect(await storedActionState(base)).toEqual(before)
})

it('plans a sealed Assisted pending action without mechanics, spending, or writes', async () => {
  const base = await setup(true, true)
  const before = await storedActionState(base)
  stubLiveSessionFetch((pathname, init) => {
    if (pathname !== path) throw new Error(`Unexpected capture: ${pathname}`)
    return base.owner.caller.fetch(pathname, init)
  })
  const runtime = testRuntime()
  const planned = await planNativeLiveEncounterAction(
    environment,
    'fixture-access-token',
    base.scope,
    base.command,
    { runtime, random: () => 0 }
  )
  expect(planned.kind).toBe('PENDING')
  if (planned.kind !== 'PENDING') throw new Error('Expected pending Assisted action.')
  expect(planned.command).toEqual(base.command)
  expect(planned.fingerprint).toBe(checksumCanonicalJson(base.command))
  expect('mechanics' in planned).toBe(false)
  expect('preparedEffects' in planned).toBe(false)
  expect(planned.execution.continuation.seal).toMatch(/^[0-9a-f]{64}$/)
  const { continuation } = planned.execution
  const resumed = await runtime.resume({
    continuation,
    response: { requestId: continuation.request.requestId, value: continuation.request.min }
  })
  expect(['PAUSED', 'COMPLETE']).toContain(resumed.status)
  expect(await storedActionState(base)).toEqual(before)
})

it('commits one sealed Assisted pending root and replays before stale revisions', async () => {
  const base = await setup(true, true)
  const before = await storedActionState(base)
  const pendingBodies: LiveSessionEncounterActionPendingInput[] = []
  const requests: string[] = []
  stubLiveSessionFetch((pathname, init) => {
    requests.push(pathname)
    if (pathname === pendingPath) {
      if (typeof init?.body !== 'string') throw new Error('Missing pending commit body.')
      pendingBodies.push(liveSessionEncounterActionPendingInputSchema.parse(JSON.parse(init.body)))
    } else if (pathname !== path) {
      throw new Error(`Unexpected capture: ${pathname}`)
    }
    return base.owner.caller.fetch(pathname, init)
  })
  const runtime = testRuntime()
  const executeResolved = vi.spyOn(runtime, 'executeResolved')
  const resume = vi.spyOn(runtime, 'resume')
  const random = vi.fn(() => 0)
  const plan = await planNativeLiveEncounterAction(
    environment,
    'fixture-access-token',
    base.scope,
    base.command,
    { runtime, random }
  )
  if (plan.kind !== 'PENDING') throw new Error('Expected pending Assisted action.')
  const callsAfterPlan = executeResolved.mock.calls.length
  const result = await commitNativeLiveEncounterActionPending(
    environment,
    'fixture-access-token',
    base.scope,
    plan
  )
  expect(requests.at(-1)).toBe(pendingPath)
  expect(requests.filter((request) => request === pendingPath)).toHaveLength(1)
  const pendingBody = pendingBodies[0]
  if (!pendingBody) throw new Error('Missing private pending commit input.')
  expect(pendingBody.maintenanceOwners).toEqual([])
  expect(result.projection.version).toBe(base.run.version)
  expect(result.occurrence?.status).toBe('PENDING')
  const after = await storedActionState(base)
  expect(after).toMatchObject({
    run: before.run,
    actor: before.actor,
    target: before.target,
    command: null,
    receipt: null
  })
  expect(after.occurrence).not.toBeNull()
  const stored = await base.t.run((ctx) =>
    ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_campaignId_rootCommandId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('rootCommandId', base.command.commandId)
      )
      .unique()
  )
  if (!stored?.pendingSnapshotJson) throw new Error('Missing stored pending snapshot.')
  const snapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse(
    JSON.parse(stored.pendingSnapshotJson)
  )
  if (
    snapshot.snapshotKind !== 'KERNEL_EVIDENCE' ||
    pendingBody.snapshot.snapshotKind !== 'KERNEL_EVIDENCE'
  )
    throw new Error('Expected a sealed kernel pending snapshot.')
  expect(snapshot).toEqual(pendingBody.snapshot)
  expect(stored.pendingSnapshotChecksum).toBe(checksumCanonicalJson(snapshot))
  expect(JSON.stringify(result)).not.toContain(snapshot.seal)
  expect(JSON.stringify(result)).not.toContain('"facts"')

  const stale = {
    ...pendingBody,
    revisions: pendingBody.revisions.map((revision, index) =>
      index === 0 ? { ...revision, revision: crypto.randomUUID() } : revision
    )
  }
  const retry = await base.owner.caller.fetch(pendingPath, {
    method: 'POST',
    headers: { 'x-artificer-live-session-secret': secret },
    body: JSON.stringify(stale)
  })
  expect(retry.status).toBe(200)
  expect(await retry.json()).toEqual(result)
  expect(await storedActionState(base)).toEqual(after)
  expect(executeResolved).toHaveBeenCalledTimes(callsAfterPlan)
  expect(resume).not.toHaveBeenCalled()
  expect(random).not.toHaveBeenCalled()
})

it('resumes each Assisted evidence through the Worker and commits only the completed action', async () => {
  const base = await setup(true, true, true)
  const before = await storedActionState(base)
  const requests: string[] = []
  let captureTerminal = false
  const terminalCapture: { body?: LiveSessionEncounterActionCommitInput } = {}
  stubLiveSessionFetch((pathname, init) => {
    requests.push(pathname)
    if (captureTerminal && pathname === '/live-sessions/encounter-action') {
      if (typeof init?.body !== 'string') throw new Error('Missing terminal commit body.')
      terminalCapture.body = liveSessionEncounterActionCommitInputSchema.parse(
        JSON.parse(init.body)
      )
      return Promise.resolve(new Response('Captured terminal input.', { status: 503 }))
    }
    return base.owner.caller.fetch(pathname, init)
  })
  const runtime = testRuntime()
  const random = vi.fn(() => 0)
  const options = { runtime, random }
  const responses: ResolveRuleOccurrenceInputDto[] = []
  const root = await planNativeLiveEncounterAction(
    environment,
    'fixture-access-token',
    base.scope,
    base.command,
    options
  )
  if (root.kind !== 'PENDING') throw new Error('Expected initial Assisted evidence.')
  let publicResult = await commitNativeLiveEncounterActionPending(
    environment,
    'fixture-access-token',
    base.scope,
    root
  )
  expect(publicResult.occurrence?.status).toBe('PENDING')
  expect(
    await commitNativeLiveEncounterActionPending(
      environment,
      'fixture-access-token',
      base.scope,
      root
    )
  ).toEqual(publicResult)
  expect(await storedActionState(base)).toMatchObject({
    run: before.run,
    actor: before.actor,
    target: before.target,
    command: null,
    receipt: null
  })

  for (let step = 0; publicResult.occurrence?.status === 'PENDING'; step++) {
    expect(step).toBeLessThan(8)
    const occurrence = publicResult.occurrence
    const pending = occurrence.pending
    if (!pending || (pending.kind !== 'D20_EVIDENCE' && pending.kind !== 'ACTION_OUTCOME_EVIDENCE'))
      throw new Error('Expected bounded Assisted action evidence.')
    const response: ResolveRuleOccurrenceInputDto = {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.run.version,
      correlationId: null,
      occurrenceId: occurrence.occurrenceId,
      expectedOccurrenceVersion: occurrence.occurrenceVersion,
      resolution:
        pending.kind === 'D20_EVIDENCE'
          ? {
              kind: 'ENTER_DICE',
              requestId: pending.request.requestId,
              rawFaces: pending.request.rollMode === 'NORMAL' ? [20] : [20, 20],
              rollMode: pending.request.rollMode
            }
          : {
              kind: 'ENTER_INTEGER',
              requestId: pending.request.requestId,
              value: pending.request.max
            }
    }
    if (step === 0) {
      await expect(
        planNativeLiveEncounterAction(
          environment,
          'fixture-access-token',
          base.scope,
          {
            ...response,
            expectedOccurrenceVersion: response.expectedOccurrenceVersion + 1
          },
          options
        )
      ).rejects.toThrow()
      await expect(
        planNativeLiveEncounterAction(
          environment,
          'fixture-access-token',
          {
            ...base.scope,
            authorityEpoch: crypto.randomUUID()
          },
          response,
          options
        )
      ).rejects.toThrow()
      await expect(
        base.other.caller.query(capture, {
          ...base.scope,
          expectedUserId: base.other.userId,
          request: { kind: 'ACTION_RESPONSE', response }
        })
      ).rejects.toThrow()
      expect(await storedActionState(base)).toMatchObject({
        run: before.run,
        actor: before.actor,
        target: before.target,
        command: null,
        receipt: null
      })
    }
    const next = await planNativeLiveEncounterAction(
      environment,
      'fixture-access-token',
      base.scope,
      response,
      options
    )
    if (next.kind === 'REPLAY') throw new Error('Fresh Assisted evidence replayed unexpectedly.')
    if (next.kind === 'PENDING') {
      publicResult = await commitNativeLiveEncounterActionPending(
        environment,
        'fixture-access-token',
        base.scope,
        next
      )
      expect(publicResult.occurrence?.occurrenceVersion).toBe(occurrence.occurrenceVersion + 1)
      expect(
        await commitNativeLiveEncounterActionPending(
          environment,
          'fixture-access-token',
          base.scope,
          next
        )
      ).toEqual(publicResult)
      expect(await storedActionState(base)).toMatchObject({
        run: before.run,
        actor: before.actor,
        target: before.target,
        command: null,
        receipt: null
      })
    } else {
      captureTerminal = true
      await expect(
        commitNativeLiveEncounterAction(environment, 'fixture-access-token', base.scope, next)
      ).rejects.toThrow('Live Session route request failed.')
      captureTerminal = false
      const capturedTerminalBody = terminalCapture.body
      if (!capturedTerminalBody) throw new Error('Missing captured terminal input.')
      const beforeAbort = await storedActionState(base)
      const occurrenceBeforeAbort = await base.t.run((ctx) =>
        ctx.db
          .query('encounterRuleOccurrences')
          .withIndex('by_campaignId_rootCommandId', (q) =>
            q.eq('campaignId', base.campaign.id).eq('rootCommandId', base.command.commandId)
          )
          .unique()
      )
      await expect(
        base.owner.caller.run(async (ctx) => {
          await ctx.runMutation(commitAction, capturedTerminalBody)
          throw new Error('Roll back completed Assisted action.')
        })
      ).rejects.toThrow('Roll back completed Assisted action.')
      expect(await storedActionState(base)).toEqual(beforeAbort)
      expect(
        await base.t.run((ctx) =>
          ctx.db
            .query('encounterRuleOccurrences')
            .withIndex('by_campaignId_rootCommandId', (q) =>
              q.eq('campaignId', base.campaign.id).eq('rootCommandId', base.command.commandId)
            )
            .unique()
        )
      ).toEqual(occurrenceBeforeAbort)
      publicResult = await commitNativeLiveEncounterAction(
        environment,
        'fixture-access-token',
        base.scope,
        next
      )
      expect(publicResult.projection.version).toBe(base.run.version + 1)
      expect(
        await base.owner.caller.query(api.encounters.projectionReads.get, {
          encounterId: base.run.id
        })
      ).toEqual(publicResult.projection)
      expect(
        await commitNativeLiveEncounterAction(environment, 'fixture-access-token', base.scope, next)
      ).toEqual(publicResult)
    }
    const randomCalls = random.mock.calls.length
    const replay = await planNativeLiveEncounterAction(
      environment,
      'fixture-access-token',
      base.scope,
      response,
      options
    )
    expect(replay).toEqual({ kind: 'REPLAY', result: publicResult })
    expect(random).toHaveBeenCalledTimes(randomCalls)
    responses.push(response)
    await expect(
      planNativeLiveEncounterAction(
        environment,
        'fixture-access-token',
        base.scope,
        {
          ...response,
          resolution: {
            kind: 'SYSTEM_ROLL',
            requestId: 'altered-request',
            rollId: crypto.randomUUID()
          }
        },
        options
      )
    ).rejects.toThrow()
  }
  // The natural 20 is a critical hit, so each damage die is rolled twice (D58).
  expect(responses).toHaveLength(5)
  expect(publicResult.occurrence?.status).toBe('COMPLETE')
  const after = await storedActionState(base)
  expect(after.run).not.toEqual(before.run)
  expect(after.actor).not.toEqual(before.actor)
  expect(after.command).not.toBeNull()
  expect(after.receipt).not.toBeNull()
  const settled = await base.t.run(async (ctx) => {
    const occurrence = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_campaignId_rootCommandId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('rootCommandId', base.command.commandId)
      )
      .unique()
    const receipts = await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', base.run.id))
      .collect()
    return { occurrence, receipts }
  })
  expect(settled.occurrence).toMatchObject({ state: 'COMPLETED', version: responses.length })
  expect(settled.receipts.map((receipt) => receipt.commandId)).toEqual(
    expect.arrayContaining([
      base.command.commandId,
      ...responses.map((response) => response.commandId)
    ])
  )
  expect(settled.receipts).toHaveLength(1 + responses.length)
  for (const response of responses) {
    const replay = await planNativeLiveEncounterAction(
      environment,
      'fixture-access-token',
      base.scope,
      response,
      options
    )
    expect(replay).toEqual({ kind: 'REPLAY', result: publicResult })
  }
  expect(
    await planNativeLiveEncounterAction(
      environment,
      'fixture-access-token',
      base.scope,
      base.command,
      options
    )
  ).toEqual({ kind: 'REPLAY', result: publicResult })
  expect(await storedActionState(base)).toEqual(after)
  expect(requests).toContain('/live-sessions/encounter-action')
}, 60_000)

it('rejects unauthorized and altered pending commits before writing an occurrence', async () => {
  const base = await setup(true, true)
  const before = await storedActionState(base)
  const pendingBodies: LiveSessionEncounterActionPendingInput[] = []
  stubLiveSessionFetch((pathname, init) => {
    if (pathname === pendingPath) {
      if (typeof init?.body !== 'string') throw new Error('Missing pending commit body.')
      pendingBodies.push(liveSessionEncounterActionPendingInputSchema.parse(JSON.parse(init.body)))
      return Promise.resolve(new Response('Captured pending input.', { status: 503 }))
    }
    if (pathname !== path) throw new Error(`Unexpected capture: ${pathname}`)
    return base.owner.caller.fetch(pathname, init)
  })
  const plan = await planNativeLiveEncounterAction(
    environment,
    'fixture-access-token',
    base.scope,
    base.command,
    { runtime: testRuntime(), random: () => 0 }
  )
  if (plan.kind !== 'PENDING') throw new Error('Expected pending Assisted action.')
  await expect(
    commitNativeLiveEncounterActionPending(environment, 'fixture-access-token', base.scope, plan)
  ).rejects.toThrow('Live Session route request failed.')
  const body = pendingBodies[0]
  if (!body) throw new Error('Missing captured pending input.')
  const post = (
    input: LiveSessionEncounterActionPendingInput,
    headers: Record<string, string> = { 'x-artificer-live-session-secret': secret }
  ) =>
    base.owner.caller.fetch(pendingPath, {
      method: 'POST',
      headers,
      body: JSON.stringify(input)
    })
  expect((await post(body, {})).status).toBe(401)
  expect((await post(body, { 'x-artificer-live-session-secret': secret + '-wrong' })).status).toBe(
    401
  )
  expect(
    (
      await base.other.caller.fetch(pendingPath, {
        method: 'POST',
        headers: { 'x-artificer-live-session-secret': secret },
        body: JSON.stringify(body)
      })
    ).status
  ).toBe(409)
  expect((await post({ ...body, expectedUserId: base.other.userId })).status).toBe(409)
  expect((await post({ ...body, authorityEpoch: crypto.randomUUID() })).status).toBe(409)
  expect(
    (
      await post({
        ...body,
        revisions: body.revisions.map((revision, index) =>
          index === 0 ? { ...revision, revision: crypto.randomUUID() } : revision
        )
      })
    ).status
  ).toBe(409)
  if (
    body.snapshot.snapshotKind !== 'KERNEL_EVIDENCE' ||
    body.snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION'
  )
    throw new Error('Expected an Encounter action snapshot.')
  expect(
    (
      await post(
        liveSessionEncounterActionPendingInputSchema.parse({
          ...body,
          snapshot: {
            ...body.snapshot,
            applicationContext: {
              ...body.snapshot.applicationContext,
              commandFingerprint: '0'.repeat(64)
            }
          }
        })
      )
    ).status
  ).toBe(409)
  expect(await storedActionState(base)).toEqual(before)
})
it('rejects reused IDs, stale new commands, unauthorized replay, and a corrupt real receipt', async () => {
  const base = await setup()
  stubLiveSessionFetch((pathname, init) => {
    if (pathname !== path) throw new Error(`Unexpected capture: ${pathname}`)
    return base.owner.caller.fetch(pathname, init)
  })
  const admit = (command: ResolveEncounterActionInputDto, scope = base.scope) =>
    base.owner.caller.query(capture, { ...scope, request: { kind: 'ACTION_COMMAND', command } })
  const unauthorized = await base.other.caller.fetch(path, {
    method: 'POST',
    headers: { 'x-artificer-live-session-secret': secret },
    body: JSON.stringify({
      ...base.scope,
      request: { kind: 'ACTION_COMMAND', command: base.command }
    })
  })
  expect(unauthorized.status).toBe(409)
  await expect(admit({ ...base.command, targetActorId: base.command.actorId })).rejects.toThrow(
    /different input/i
  )
  const stale = { ...base.command, commandId: crypto.randomUUID() }
  await expect(admit(stale)).rejects.toThrow(/version|stale/i)
  await expect(
    admit(base.command, { ...base.scope, authorityEpoch: crypto.randomUUID() })
  ).rejects.toThrow(/stale|authority/i)
  await expect(
    admit(base.command, { ...base.scope, campaignId: crypto.randomUUID() })
  ).rejects.toThrow()
  await expect(
    admit(base.command, { ...base.scope, expectedUserId: base.other.userId })
  ).rejects.toThrow(/identity/i)
  await base.t.run(async (ctx) => {
    const receipt = await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) =>
        q.eq('encounterId', base.run.id).eq('commandId', base.command.commandId)
      )
      .unique()
    if (!receipt) throw new Error('Missing real action receipt.')
    await ctx.db.patch(receipt._id, { resultChecksum: '0'.repeat(64) })
  })
  await expect(admit(base.command)).rejects.toThrow(/receipt mismatch/i)
})
it('returns an expected rejection as structured data and keeps other failures redacted', async () => {
  const base = await setup()
  const post = (scope: typeof base.scope, command: ResolveEncounterActionInputDto) =>
    base.owner.caller.fetch(path, {
      method: 'POST',
      headers: { 'x-artificer-live-session-secret': secret },
      body: JSON.stringify({ ...scope, request: { kind: 'ACTION_COMMAND', command } })
    })
  const reused = await post(base.scope, { ...base.command, targetActorId: base.command.actorId })
  expect(reused.status).toBe(422)
  expect(await reused.json()).toEqual({
    code: 'DOMAIN_REJECTED',
    reason: 'COMMAND_ID_REUSED',
    message: 'Command ID was already used with different input.'
  })
  const mismatched = await post({ ...base.scope, expectedUserId: base.other.userId }, base.command)
  expect(mismatched.status).toBe(409)
  expect(await mismatched.text()).toBe('Live Session Encounter inputs unavailable.')

  // ConvexError data survives the forwarded action and its nested mutation.
  const { encounterId, expectedVersion, ...actor } = base.scope
  const staleRound = await base.owner.caller.fetch('/live-sessions/encounter-command', {
    method: 'POST',
    headers: { 'x-artificer-live-session-secret': secret },
    body: JSON.stringify({
      ...actor,
      command: {
        type: 'SET_ROUND',
        encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion,
        round: 2
      }
    })
  })
  expect(staleRound.status).toBe(422)
  expect(await staleRound.json()).toEqual({
    code: 'DOMAIN_REJECTED',
    reason: 'VERSION_STALE',
    message: 'Encounter version is stale.'
  })
})
it('admits a controlling player action capture and refuses a player who does not control the actor', async () => {
  const base = await playerControlFixture()
  const authorityEpoch = crypto.randomUUID()
  await base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: base.campaign.id,
      epoch: authorityEpoch,
      createdAt: base.campaign.createdAt
    })
  )
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret)
  const post = (command: ResolveEncounterActionInputDto) =>
    base.other.caller.fetch(path, {
      method: 'POST',
      headers: { 'x-artificer-live-session-secret': secret },
      body: JSON.stringify({
        campaignId: base.campaign.id,
        authorityEpoch,
        expectedUserId: base.other.userId,
        expectedRole: 'PLAYER',
        encounterId: base.run.id,
        expectedVersion: command.expectedVersion,
        action: { kind: 'ACTION_COMMAND', command },
        request: { kind: 'ACTION_COMMAND', command }
      })
    })
  const refused = await post(await base.bite(base.companion.id, base.enemy.id))
  expect(refused.status).toBe(422)
  expect(await refused.json()).toMatchObject({
    code: 'DOMAIN_REJECTED',
    reason: 'NOT_ACTOR_CONTROLLER'
  })
  await setActorControllers(base, base.companion.id, [base.other.userId])
  const command = await base.bite(base.companion.id, base.enemy.id)
  const admitted = await post(command)
  expect(admitted.status).toBe(200)
  expect(await admitted.json()).toMatchObject({ kind: 'ACTION_COMMAND', command })
}, 30000)
