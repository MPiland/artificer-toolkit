// @vitest-environment node
import { createFunctionHandle } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  EncounterCommandInputDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { LIVE_SESSION_ROUTE_PATHS } from '@artificer-toolkit/schema/api/liveSessionRoutePaths'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { LiveCaptureCache } from '../../../session-worker/src/nativeCaptureCache'
import {
  commitNativeLiveEncounterAction,
  planNativeLiveEncounterAction
} from '../../../session-worker/src/nativeEncounterRules'
import { LiveSessionRouteError } from '../../../session-worker/src/liveSessionRoutes'
import { executeLiveEncounterCommand } from '../../../session-worker/src/nativeRoomEncounterCommand'
import { createNativeLiveRulesRuntime } from '../../../session-worker/src/nativeRulesRuntime'
import { seedActiveInitiative } from '../../tests/fixtures/activeInitiative'
import {
  concentrationAction,
  seedConcentration,
  setupConcentration
} from '../../tests/fixtures/concentration'
import {
  insertActiveLiveAuthority,
  stubLiveSessionFetch,
  workerEnvironment,
  executeInRoom
} from '../../tests/fixtures/liveSessionWorker'
import { input as characterInput } from '../../tests/fixtures/characters'
import { readBundleAndSeparateCaptures } from '../../tests/fixtures/captureBundleParity'
import { api, components, internal } from '../_generated/api'
import { withSceneVisionTracking } from '../lib/mutations'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { createEncounterRun } from '../encounters/runs'
import { readEncounterCaptureBundle } from './encounterCaptureBundle'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: vi.fn(() => 19) }))

const workerSecret = 'private-room-capture-cache-test-secret-at-least-32-bytes'
const environment = workerEnvironment(workerSecret)
const rules = LIVE_SESSION_ROUTE_PATHS.encounterRules
const characterRules = LIVE_SESSION_ROUTE_PATHS.characterRules
const bundle = LIVE_SESSION_ROUTE_PATHS.encounterBundle

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

/** A Wolf whose Bite forces a Dexterity save that the target's controller rolls. */
function saveCreature() {
  const bite = wolf.features?.find((feature) => feature.label === 'Bite')
  const dexterity = srdSystemRecord.abilities?.find((ability) => ability.code === 'DEXTERITY')
  const slashing = srdSystemRecord.damageTypes?.find((damageType) => damageType.code === 'SLASHING')
  if (!bite || !dexterity || !slashing) throw new Error('Save fixture requires Wolf Bite.')
  return {
    ...wolf,
    id: '00000000-0000-4000-8000-000000000cc0',
    label: 'Saving-throw Wolf',
    features: wolf.features?.map((feature) =>
      feature.id !== bite.id
        ? feature
        : {
            ...feature,
            id: '00000000-0000-4000-8000-000000000cc1',
            effects: feature.effects?.slice(0, 1).map((effect) => ({
              ...effect,
              id: '00000000-0000-4000-8000-000000000cc2',
              invocation: {
                ...effect.invocation,
                triggerCode: 'SAVING_THROW' as const,
                savingThrow: {
                  id: '00000000-0000-4000-8000-000000000cc3',
                  dcMethod: 'FIXED_DC' as const,
                  abilityDefinitionId: dexterity.id,
                  baseDc: 15
                },
                range: { id: effect.invocation.range.id, rangeKind: 'UNLIMITED' as const },
                targeting: {
                  selectionKind: 'SINGLE_TARGET' as const,
                  dispositionKind: 'ANY' as const
                }
              },
              paths: effect.paths?.slice(0, 1).map((path) =>
                !('resultBlock' in path)
                  ? path
                  : {
                      ...path,
                      pathCode: 'ON_SAVE_FAIL' as const,
                      resultBlock: {
                        ...path.resultBlock,
                        outcomes: [
                          {
                            id: '00000000-0000-4000-8000-000000000cc4',
                            effectKind: 'DAMAGE' as const,
                            damageTypeId: slashing.id,
                            valueKind: 'FIXED' as const,
                            scalingKind: 'NONE' as const,
                            amount: 1
                          }
                        ]
                      }
                    }
              )
            }))
          }
    )
  }
}

/** A Wolf and the player's Character in an active Assisted Encounter the room owns. */
async function roomFixture(...setup: Parameters<typeof setupConcentration>) {
  const fixture = await setupConcentration(...setup)
  await fixture.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', fixture.run.id))
      .unique()
    if (!row) throw new Error('Room fixture Run is unavailable.')
    await seedActiveInitiative(ctx, encounterRunStateSchema.parse(JSON.parse(row.stateJson)), [
      fixture.actor.id,
      ...fixture.run.actors.flatMap(({ id }) => (id === fixture.actor.id ? [] : [id]))
    ])
    await insertActiveLiveAuthority(ctx, {
      campaignId: fixture.campaign.id,
      epoch: fixture.run.id,
      createdAt: fixture.campaign.createdAt
    })
  })
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', workerSecret)
  const calls: string[] = []
  const hooks: { beforeRoute?: (route: string) => Promise<void> } = {}
  stubLiveSessionFetch(async (pathname, init) => {
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null
    const kind =
      body && typeof body === 'object' && 'request' in body
        ? (body.request as { kind: string }).kind
        : null
    calls.push(kind ? `${pathname}:${kind}` : pathname)
    await hooks.beforeRoute?.(pathname)
    const token = new Headers(init?.headers).get('authorization')
    const caller =
      token === 'Bearer fixture-player-token'
        ? fixture.player.caller
        : token === 'Bearer fixture-owner-token'
          ? fixture.owner.caller
          : null
    if (!caller) throw new Error('Unknown fixture access token.')
    return caller.fetch(pathname, init)
  })
  const runtime = await createNativeLiveRulesRuntime(process.env.RULES_CONTINUATION_SECRET!)
  const captureCache = new LiveCaptureCache()
  const actor = (role: 'OWNER' | 'PLAYER') => ({
    campaignId: fixture.campaign.id,
    authorityEpoch: fixture.run.id,
    expectedUserId: role === 'OWNER' ? fixture.owner.userId : fixture.player.userId,
    expectedRole: role
  })
  async function counted<T>(run: () => Promise<T>) {
    const start = calls.length
    const result = await run()
    return { result, routes: countRoutes(calls.slice(start)) }
  }
  /** Runs one command as the room does, with the room's capture cache. */
  function execute(command: EncounterCommandInputDto, role: 'OWNER' | 'PLAYER' = 'OWNER') {
    return counted(() =>
      executeLiveEncounterCommand({
        environment,
        accessToken: role === 'OWNER' ? 'fixture-owner-token' : 'fixture-player-token',
        actor: actor(role),
        command,
        runtime,
        random: () => 9,
        captureCache,
        movement: async () => {
          throw new Error('This command sequence opens no movement decision.')
        }
      })
    )
  }
  const scope = (command: ResolveEncounterActionInputDto) => ({
    ...actor('OWNER'),
    encounterId: command.encounterId,
    expectedVersion: command.expectedVersion
  })
  /** Plans without committing, as an earlier command in the room would have read. */
  function plan(command: ResolveEncounterActionInputDto, cache: LiveCaptureCache | null) {
    return counted(() =>
      planNativeLiveEncounterAction(environment, 'fixture-owner-token', scope(command), command, {
        runtime,
        random: () => 9,
        ...(cache ? { captures: cache.reads() } : {})
      })
    )
  }
  return { ...fixture, calls, hooks, captureCache, execute, plan, scope }
}

function countRoutes(routes: readonly string[]) {
  const counts: Record<string, number> = {}
  for (const route of routes) counts[route] = (counts[route] ?? 0) + 1
  return counts
}

/** Everything a completed action plan commits, plus the reads it depended on. */
function committed(plan: Awaited<ReturnType<typeof planNativeLiveEncounterAction>>) {
  if (plan.kind !== 'PLANNED') throw new Error('Expected a completed action plan.')
  return {
    command: plan.command,
    occurredAt: plan.occurredAt,
    revisions: plan.revisions,
    dependencies: plan.dependencies,
    initialDefinitionId: plan.execution.initialPublished.id,
    execution: plan.storedExecution,
    rules: plan.nextRules,
    resourceConsumption: plan.prepared.characterActionState?.resourceConsumption ?? null,
    ruleOverrides: plan.ruleOverrides,
    createdEffects: plan.settlement.createdEffects,
    maintainedState: plan.settlement.maintainedState,
    concentration: plan.concentration.completed,
    pendingConcentration: plan.concentration.pending,
    cleaving: plan.cleaving
  }
}

function total(routes: Record<string, number>) {
  return Object.values(routes).reduce((sum, count) => sum + count, 0)
}

async function bumpCampaignRevision(fixture: Awaited<ReturnType<typeof roomFixture>>) {
  await fixture.t.run(async (ctx) => {
    const row = await ctx.db
      .query('sceneVisionRevisions')
      .withIndex('by_scope_id', (query) =>
        query.eq('scope', 'CAMPAIGN').eq('id', fixture.campaign.id)
      )
      .unique()
    if (row) await ctx.db.patch(row._id, { revision: crypto.randomUUID() })
    else
      await ctx.db.insert('sceneVisionRevisions', {
        scope: 'CAMPAIGN',
        id: fixture.campaign.id,
        revision: crypto.randomUUID()
      })
  })
}

async function storedHitPoints(fixture: Awaited<ReturnType<typeof roomFixture>>) {
  return fixture.t.run(async (ctx) => {
    const row = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', fixture.character.id))
      .unique()
    if (!row) throw new Error('Missing room Character.')
    return characterAuthoredDtoSchema.parse(JSON.parse(row.documentJson)).state.hitpoints.current
  })
}

it('plans the same attack from cached and fresh captures and counts its round trips', async () => {
  const fixture = await roomFixture('AUTO_ROLL')
  const command = concentrationAction(fixture)
  // Pin the occurrence identity and time so cached and uncached plans compare exactly.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-00000000c0de')
  const uncached = await fixture.plan(command, null)
  const cold = await fixture.plan(command, fixture.captureCache)
  const warm = await fixture.plan(command, fixture.captureCache)
  vi.restoreAllMocks()
  vi.useRealTimers()
  expect(committed(cold.result)).toEqual(committed(uncached.result))
  expect(committed(warm.result)).toEqual(committed(uncached.result))
  // Before S4-b every read was its own round trip; the bundle takes the volatile ones (D32).
  expect(uncached.routes).toEqual({
    [`${rules}:ACTION_COMMAND`]: 1,
    [`${rules}:INPUTS`]: 1,
    [`${rules}:ACTOR`]: 2,
    [`${characterRules}:INPUTS`]: 1,
    [`${characterRules}:PUBLICATIONS`]: 1,
    [`${rules}:DEFINITION`]: 1,
    [`${rules}:MAINTENANCE_SLOT`]: 1
  })
  expect(cold.routes).toEqual({
    [`${bundle}:ACTION_COMMAND`]: 1,
    [`${characterRules}:PUBLICATIONS`]: 1,
    [`${rules}:DEFINITION`]: 1
  })
  expect(warm.routes).toEqual({ [`${bundle}:ACTION_COMMAND`]: 1 })

  // Before: 9 round trips for this attack and 6 for the turn end; warm now: 2 each.
  const attack = await fixture.execute(command)
  expect(attack.result.projection.version).toBe(fixture.run.version + 1)
  expect(attack.routes).toEqual({
    [`${bundle}:ACTION_COMMAND`]: 1,
    [LIVE_SESSION_ROUTE_PATHS.encounterActionCommit]: 1
  })
  const turnEnd = await fixture.execute({
    type: 'ADVANCE_TURN',
    encounterId: fixture.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: attack.result.projection.version
  })
  expect(turnEnd.result.projection.currentActorId).toBe(fixture.target.id)
  expect(turnEnd.routes).toEqual({
    [`${bundle}:TURN_COMMAND`]: 1,
    [LIVE_SESSION_ROUTE_PATHS.encounterTurnCommit]: 1
  })
}, 120_000)

it('misses the cache after a CAMPAIGN revision bump', async () => {
  const fixture = await roomFixture('AUTO_ROLL')
  const command = concentrationAction(fixture)
  const cold = await fixture.plan(command, fixture.captureCache)
  expect(total((await fixture.plan(command, fixture.captureCache)).routes)).toBe(
    total(cold.routes) - 2
  )
  await bumpCampaignRevision(fixture)
  expect((await fixture.plan(command, fixture.captureCache)).routes).toEqual(cold.routes)
}, 120_000)

it('reuses Character sources and System content for a Concentration answer', async () => {
  const fixture = await roomFixture('PROMPT')
  await seedConcentration(fixture)
  const attack = await fixture.execute(concentrationAction(fixture))
  // A cold attack: 12 round trips before S4-b; now the bundle, a source page, 3 definitions, the
  // vocabulary and the commit.
  expect(total(attack.routes)).toBe(7)
  const pending = await fixture.player.caller.query(
    api.encounters.pendingReads.pendingRuleOccurrence,
    { encounterId: fixture.run.id }
  )
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected a Concentration check.')
  await fixture.player.caller.mutation(api.account.updateProfile, {
    username: 'RoomCachePlayer',
    bio: null
  })
  const rolled = await executeInRoom(fixture.player.caller, {
    command: {
      type: 'ROLL_RULE_EVIDENCE',
      encounterId: fixture.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      requestId: pending.request.requestId,
      rollMode: pending.request.rollMode
    }
  })
  if (!rolled.evidenceRoll) throw new Error('Expected the responder app roll.')
  const answer = await fixture.execute(
    {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: fixture.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      correlationId: null,
      resolution: {
        kind: 'SYSTEM_ROLL',
        requestId: pending.request.requestId,
        rollId: rolled.evidenceRoll.rollId
      }
    },
    'PLAYER'
  )
  expect(answer.result.occurrence).toMatchObject({ status: 'COMPLETE' })
  // Before S4-b: 12 round trips.
  expect(answer.routes).toEqual({
    [LIVE_SESSION_ROUTE_PATHS.encounterRoute]: 1,
    [`${bundle}:CONCENTRATION_RESPONSE`]: 1,
    [LIVE_SESSION_ROUTE_PATHS.encounterConcentrationCommit]: 1
  })
}, 120_000)

it('reuses cached captures for an action that pauses on the target save', async () => {
  const fixture = await roomFixture('PROMPT', {
    creature: saveCreature(),
    triggerCode: 'SAVING_THROW'
  })
  const command = concentrationAction(fixture)
  const cold = await fixture.plan(command, fixture.captureCache)
  const saving = await fixture.execute(command)
  expect(saving.result.occurrence).toMatchObject({ status: 'PENDING' })
  // Before S4-b: 8 round trips (7 reads and the pending commit).
  expect(total(cold.routes)).toBe(3)
  expect(saving.routes).toEqual({
    [`${bundle}:ACTION_COMMAND`]: 1,
    [LIVE_SESSION_ROUTE_PATHS.encounterActionPending]: 1
  })
}, 120_000)

it('replans once from fresh Character inputs when the commit fence refuses a cached plan', async () => {
  const fixture = await roomFixture('AUTO_ROLL')
  const command = concentrationAction(fixture)
  await fixture.plan(command, fixture.captureCache)
  const before = await storedHitPoints(fixture)
  let commits = 0
  fixture.hooks.beforeRoute = async (route) => {
    if (route !== LIVE_SESSION_ROUTE_PATHS.encounterActionCommit || ++commits > 1) return
    // Hit points change between the plan and its commit; the CHARACTER fence refuses the plan.
    const sheet = await fixture.player.caller.query(api.characters.sheet.get, {
      id: fixture.character.id
    })
    if (!sheet) throw new Error('Missing room Sheet.')
    await fixture.player.caller.mutation(api.characters.sheetCommands.execute, {
      id: fixture.character.id,
      command: {
        type: 'ADJUST_HIT_POINTS',
        commandId: crypto.randomUUID(),
        expectedVersion: sheet.meta.streamVersion,
        mode: 'DAMAGE',
        amount: 2
      }
    })
  }
  const attack = await fixture.execute(command)
  expect(commits).toBe(2)
  expect(await storedHitPoints(fixture)).toBe(before - 3)
  expect(attack.result.projection.version).toBe(fixture.run.version + 1)
}, 120_000)

it('surfaces a refusal after exactly one replan, and never replans a plan with no cached reads', async () => {
  const fixture = await roomFixture('AUTO_ROLL')
  const command = concentrationAction(fixture)
  let commits = 0
  fixture.hooks.beforeRoute = async (route) => {
    if (route !== LIVE_SESSION_ROUTE_PATHS.encounterActionCommit) return
    commits += 1
    await bumpCampaignRevision(fixture)
  }
  const refusal = { name: 'LiveSessionRouteError', status: 409 }
  await expect(fixture.execute(command)).rejects.toMatchObject(refusal)
  expect(commits).toBe(1)

  await fixture.plan(command, fixture.captureCache)
  commits = 0
  const error: unknown = await fixture.execute(command).catch((reason: unknown) => reason)
  expect(error).toBeInstanceOf(LiveSessionRouteError)
  expect(error).toMatchObject(refusal)
  expect(commits).toBe(2)
}, 120_000)

it('refuses a stale plan and misses the cache when an import job changes visibility (D34)', async () => {
  const fixture = await roomFixture('AUTO_ROLL')
  const command = concentrationAction(fixture)
  const jobId = crypto.randomUUID()
  const previewId = crypto.randomUUID()
  const now = new Date().toISOString()
  // The Wolf's root belongs to a running import, so its System content changes on completion.
  await fixture.t.run(async (ctx) => {
    await ctx.db.insert('importJobs', {
      id: jobId,
      ownerUserId: fixture.owner.userId,
      previewId,
      command: {
        commandId: crypto.randomUUID(),
        previewId,
        selectedEntryIds: ['entry-1'],
        resolutions: [],
        customContentChoices: []
      },
      inputFingerprint: '0'.repeat(64),
      source: 'ARTIFICER_JSON',
      status: 'RUNNING',
      terminalStatus: null,
      phase: 'STAGING',
      entryIndex: 0,
      cursor: null,
      processedEntries: 0,
      totalEntries: 1,
      expectedStageCount: 1,
      stagedStageCount: 1,
      failureReason: null,
      summary: null,
      cleanupTableIndex: 0,
      cleanupCursor: null,
      expiresAt: Date.now() + 60_000,
      createdAt: now,
      updatedAt: now
    })
    const creatureId = fixture.actor.sourceId
    if (!creatureId) throw new Error('Missing the Wolf source.')
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (query) => query.eq('id', creatureId))
      .unique()
    if (!root) throw new Error('Missing the Wolf root.')
    await ctx.db.patch(root._id, { importJobId: jobId })
  })
  const stale = await fixture.plan(command, fixture.captureCache)
  if (stale.result.kind !== 'PLANNED') throw new Error('Expected a completed plan.')
  await fixture.t.run(async (rawCtx) => {
    const ctx = withSceneVisionTracking(rawCtx)
    const job = await ctx.db
      .query('importJobs')
      .withIndex('by_publicId', (query) => query.eq('id', jobId))
      .unique()
    if (!job) throw new Error('Missing the import job.')
    await ctx.db.patch(job._id, { status: 'COMPLETED', phase: 'PUBLISHING' })
  })
  await expect(
    commitNativeLiveEncounterAction(
      environment,
      'fixture-owner-token',
      fixture.scope(command),
      stale.result
    )
  ).rejects.toMatchObject({ status: 409 })
  // The SYSTEM stamp moved, so System-level reads go back to Convex.
  expect((await fixture.plan(command, fixture.captureCache)).routes).toEqual(stale.routes)
}, 120_000)

it('bundles exactly the responses the separate captures return, with the System once', async () => {
  const fixture = await roomFixture('AUTO_ROLL')
  const action = concentrationAction(fixture)
  const scope = fixture.scope(action)
  const admissions = [
    { kind: 'ACTION_COMMAND' as const, command: action },
    {
      kind: 'TURN_COMMAND' as const,
      command: {
        type: 'ADVANCE_TURN' as const,
        encounterId: fixture.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: fixture.run.version
      }
    }
  ]
  for (const request of admissions) {
    const { bundle, separate } = await fixture.owner.caller.run((ctx) =>
      readBundleAndSeparateCaptures(ctx, { ...scope, request }, fixture.run.actors)
    )
    expect(bundle.characters).toHaveLength(1)
    expect(bundle.encounter.length).toBe(request.kind === 'TURN_COMMAND' ? 7 : 6)
    expect(bundle).toEqual(separate)
  }
}, 120_000)
/**
 * Meters one transaction's reads as they execute: index ranges (each executed get or query),
 * documents, all bytes and distinct bytes. Building a query reads nothing.
 */
function meteredReads<Ctx extends QueryCtx | MutationCtx>(ctx: Ctx) {
  const usage = { ranges: 0, documents: 0, bytes: 0, distinctBytes: 0 }
  const distinct = new Set<string>()
  function record(value: unknown) {
    const documents =
      value === null || value === undefined
        ? []
        : Array.isArray(value)
          ? value
          : typeof value === 'object' && 'page' in value && Array.isArray(value.page)
            ? value.page
            : [value]
    usage.documents += documents.length
    usage.bytes += JSON.stringify(documents).length
    for (const document of documents) {
      const id =
        typeof document === 'object' && document !== null && '_id' in document
          ? String(document._id)
          : JSON.stringify(document)
      if (distinct.has(id)) continue
      distinct.add(id)
      usage.distinctBytes += JSON.stringify(document).length
    }
  }
  const terminals = new Set(['unique', 'first', 'collect', 'take', 'paginate'])
  function metered<T extends object>(target: T): T {
    return new Proxy(target, {
      get(object, property) {
        const value: unknown = Reflect.get(object, property)
        if (property === Symbol.asyncIterator && typeof value === 'function')
          return async function* () {
            usage.ranges += 1
            for await (const document of { [Symbol.asyncIterator]: () => value.call(object) }) {
              record(document)
              yield document
            }
          }
        if (typeof value !== 'function') return value
        return (...args: unknown[]) => {
          const result: unknown = value.apply(object, args)
          if (
            typeof property === 'string' &&
            terminals.has(property) &&
            result instanceof Promise
          ) {
            usage.ranges += 1
            return result.then((read: unknown) => (record(read), read))
          }
          return typeof result === 'object' && result !== null ? metered(result) : result
        }
      }
    })
  }
  const db = new Proxy(ctx.db, {
    get(object, property) {
      const value: unknown = Reflect.get(object, property)
      if (typeof value !== 'function') return value
      if (property === 'get')
        return async (...args: unknown[]) => {
          usage.ranges += 1
          const read: unknown = await value.apply(object, args)
          record(read)
          return read
        }
      if (property === 'query') return (...args: unknown[]) => metered(value.apply(object, args))
      return value.bind(object)
    }
  })
  const meteredCtx: Ctx = { ...ctx, db }
  return { ctx: meteredCtx, usage }
}

/** A new player with a copy of the fixture Character, admitted to and assigned in the Campaign. */
async function addPartyPlayer(fixture: Awaited<ReturnType<typeof roomFixture>>, index: number) {
  const now = Date.now()
  const user = await fixture.t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: `Party ${index}`,
          email: `party-${index}@example.invalid`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now
        }
      },
      onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
    })
  )
  const session = await fixture.t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: user._id,
          token: crypto.randomUUID(),
          expiresAt: now + 600_000,
          createdAt: now,
          updatedAt: now
        }
      }
    })
  )
  const caller = fixture.t.withIdentity({ subject: user._id, sessionId: session._id })
  const identity = await caller.query(api.account.identity, {})
  if (!identity) throw new Error('Missing party identity.')
  await fixture.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: fixture.campaign.id,
      userId: identity.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: fixture.campaign.createdAt,
      joinedAt: fixture.campaign.createdAt,
      leftAt: null
    })
  )
  const draft = await caller.mutation(api.characters.drafts.create, characterInput())
  const character = characterAuthoredDtoSchema.parse({
    ...fixture.character,
    id: draft.payload.character.id,
    userId: draft.payload.character.userId
  })
  await caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  await caller.mutation(api.campaigns.assignments.assign, {
    campaignId: fixture.campaign.id,
    characterId: character.id
  })
}

it('keeps the largest legal action bundle within the Convex transaction limits', async () => {
  // Legal maxima: MAX_ENCOUNTER_ACTORS actors, and one assigned Character per player seat (12 at
  // most, `readActiveCampaignMembers`), so 12 Characters and 88 Creatures.
  const players = 12
  const fixture = await roomFixture('AUTO_ROLL')
  const creatureId = fixture.actor.sourceId
  if (!creatureId) throw new Error('Missing the Wolf source.')
  for (let index = 1; index < players; index++) await addPartyPlayer(fixture, index)
  const blueprint = await fixture.owner.caller.mutation(api.encounters.blueprints.create, {
    gameSystemId: fixture.campaign.gameSystemId,
    name: 'Largest bundle',
    commandId: crypto.randomUUID(),
    enemies: Array.from({ length: MAX_ENCOUNTER_ACTORS - players }, () => ({
      kind: 'CREATURE' as const,
      sourceId: creatureId
    }))
  })
  const { run, created } = await fixture.owner.caller.run(async (ctx) => {
    const metered = meteredReads(ctx)
    const run = await createEncounterRun(withSceneVisionTracking(metered.ctx), {
      campaignId: fixture.campaign.id,
      blueprintId: blueprint.id,
      commandId: crypto.randomUUID()
    })
    return { run, created: metered.usage }
  })
  // Creating the largest Run read 20.3 MB (over the 16 MiB limit) when every actor insert's
  // trigger re-read the whole Run; measured now: 2.5 MB, 605 documents.
  expect(created.bytes).toBeLessThan((16 * 1024 * 1024) / 4)
  expect(created.documents).toBeLessThan(32_000 / 4)
  expect(run.actors).toHaveLength(MAX_ENCOUNTER_ACTORS)
  expect(run.actors.filter((actor) => actor.kind === 'CHARACTER')).toHaveLength(players)
  const attacker = run.actors.find((actor) => actor.kind === 'CREATURE')
  const hero = run.actors.find((actor) => actor.sourceId === fixture.character.id)
  if (!attacker || !hero) throw new Error('Missing the largest Run actors.')
  await fixture.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', run.id))
      .unique()
    if (!row) throw new Error('Missing the largest Run.')
    const state = encounterRunStateSchema.parse({
      ...JSON.parse(row.stateJson),
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: attacker.id
    })
    const projection = encounterGmProjectionDtoSchema.parse({
      ...JSON.parse(row.projectionJson),
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: attacker.id
    })
    await ctx.db.patch(row._id, {
      status: 'ACTIVE',
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state),
      projectionJson: JSON.stringify(projection),
      projectionChecksum: checksumCanonicalJson(projection)
    })
    await seedActiveInitiative(ctx, state, [
      attacker.id,
      ...run.actors.flatMap(({ id }) => (id === attacker.id ? [] : [id]))
    ])
  })
  if (!fixture.actionId.startsWith(fixture.actor.id))
    throw new Error('Unexpected fixture action identity.')
  const command = {
    ...concentrationAction(fixture),
    encounterId: run.id,
    expectedVersion: run.version,
    actorId: attacker.id,
    targetActorId: hero.id,
    actionId: attacker.id + fixture.actionId.slice(fixture.actor.id.length)
  }
  const { bundle, usage, returned } = await fixture.owner.caller.run(async (ctx) => {
    const metered = meteredReads(ctx)
    const bundle = await readEncounterCaptureBundle(metered.ctx, {
      ...fixture.scope(command),
      request: { kind: 'ACTION_COMMAND', command },
      maintenanceDefinitionIds: [DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID]
    })
    return { bundle, usage: metered.usage, returned: JSON.stringify(bundle).length }
  })
  expect(bundle.encounter).toHaveLength(1 + 2 * MAX_ENCOUNTER_ACTORS)
  expect(bundle.inputs).not.toBeNull()
  expect(bundle.characters).toHaveLength(players)
  // Convex limits per query: 4,096 index ranges, 32,000 documents, 16 MiB read, 16 MiB returned.
  // Each is asserted under a quarter of its limit. Measured with the read memo: 437 ranges, 307
  // documents, 1.4 MB read with repeats (0.85 MB distinct), 0.7 MB returned (1.1 MB before the System
  // travelled once). Without the memo: 2,922 ranges, 2,543 documents and 38.8 MB read, over the limit.
  expect(usage.ranges).toBeLessThan(4_096 / 4)
  expect(usage.documents).toBeLessThan(32_000 / 4)
  expect(usage.bytes).toBeLessThan((16 * 1024 * 1024) / 4)
  expect(usage.distinctBytes).toBeLessThan((16 * 1024 * 1024) / 4)
  expect(returned).toBeLessThan((16 * 1024 * 1024) / 4)
}, 300_000)
