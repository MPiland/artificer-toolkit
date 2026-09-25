// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import type {
  EncounterCommandInputDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { LIVE_SESSION_ROUTE_PATHS } from '@artificer-toolkit/schema/api/liveSessionRoutePaths'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { LiveCaptureCache } from '../../../session-worker/src/nativeCaptureCache'
import { planNativeLiveEncounterAction } from '../../../session-worker/src/nativeEncounterRules'
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
  workerEnvironment
} from '../../tests/fixtures/liveSessionWorker'
import { executeEncounterCommand } from '../../tests/fixtures/playerControl'
import { api } from '../_generated/api'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: vi.fn(() => 19) }))

const workerSecret = 'private-room-capture-cache-test-secret-at-least-32-bytes'
const environment = workerEnvironment(workerSecret)
const rules = LIVE_SESSION_ROUTE_PATHS.encounterRules
const characterRules = LIVE_SESSION_ROUTE_PATHS.characterRules

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
      fixture.target.id
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
        captureCache
      })
    )
  }
  /** Plans without committing, as an earlier command in the room would have read. */
  function plan(command: ResolveEncounterActionInputDto, cache: LiveCaptureCache | null) {
    return counted(() =>
      planNativeLiveEncounterAction(
        environment,
        'fixture-owner-token',
        {
          ...actor('OWNER'),
          encounterId: command.encounterId,
          expectedVersion: command.expectedVersion
        },
        command,
        { runtime, random: () => 9, ...(cache ? { captures: cache.reads() } : {}) }
      )
    )
  }
  return { ...fixture, calls, hooks, captureCache, execute, plan }
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
  expect(cold.routes).toEqual(uncached.routes)
  expect(warm.routes).toEqual({
    [`${rules}:ACTION_COMMAND`]: 1,
    [`${rules}:INPUTS`]: 1,
    [`${rules}:ACTOR`]: 2,
    [`${characterRules}:INPUTS`]: 1,
    [`${rules}:MAINTENANCE_SLOT`]: 1
  })

  // Before the cache the room made 9 round trips for this attack and 6 for the turn end.
  const attack = await fixture.execute(command)
  expect(attack.result.projection.version).toBe(fixture.run.version + 1)
  expect(total(uncached.routes) + 1).toBe(9)
  expect(total(attack.routes)).toBe(7)
  const turnEnd = await fixture.execute({
    type: 'ADVANCE_TURN',
    encounterId: fixture.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: attack.result.projection.version
  })
  expect(turnEnd.result.projection.currentActorId).toBe(fixture.target.id)
  expect(turnEnd.routes).toEqual({
    [`${rules}:TURN_COMMAND`]: 1,
    [`${rules}:INPUTS`]: 1,
    [`${rules}:ACTOR`]: 2,
    [`${rules}:INITIATIVE_ROUND`]: 1,
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
  // The attack reads everything once (12 round trips before and after the cache).
  expect(total(attack.routes)).toBe(12)
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
  const rolled = await fixture.player.caller.mutation(executeEncounterCommand, {
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
  // Before the cache: 12 round trips, including 2 definitions, the vocabulary and a source page.
  expect(answer.routes).toEqual({
    [LIVE_SESSION_ROUTE_PATHS.encounterRoute]: 1,
    [`${rules}:CONCENTRATION_RESPONSE`]: 1,
    [`${rules}:INPUTS`]: 1,
    [`${rules}:ACTOR`]: 2,
    [`${characterRules}:INPUTS`]: 1,
    [`${rules}:MAINTENANCE_SLOT`]: 1,
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
  // Before the cache: 8 round trips (the plan's 7 reads and the pending commit).
  expect(total(cold.routes) + 1).toBe(8)
  expect(saving.routes).toEqual({
    [`${rules}:ACTION_COMMAND`]: 1,
    [`${rules}:INPUTS`]: 1,
    [`${rules}:ACTOR`]: 2,
    [`${characterRules}:INPUTS`]: 1,
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
