import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
  encounterPlayerProjectionDtoSchema,
  type CreateEncounterInputDto,
  type EncounterCommandResultDto,
  type EncounterGmProjectionDto,
  type EncounterExecuteInput,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  CampaignPlaySettingsDto,
  SaveCampaignPlaySettingsInput
} from '@artificer-toolkit/schema/api/campaignSettings'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { liveSessionCharacterRulesInputSchema } from '@artificer-toolkit/schema/api/liveSessionCharacterRules'
import {
  liveSessionEncounterTurnCommitInputSchema,
  liveSessionEncounterTurnPendingInputSchema,
  type LiveSessionEncounterTurnCommitInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterTurn'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { createPlatformRulesRuntime } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { automaticChargedBiteFeatureId } from '../../tests/fixtures/encounterAction'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import { api, internal } from '../_generated/api'
import { createActiveRuleEffectStore } from '../rules/effectStore'
import {
  seedTurnSaveEffect,
  turnActiveEffectFixture,
  turnCharacterEffectFixture
} from '../../tests/fixtures/turnActiveEffectFixtures'
import { planNativeLiveEncounterTurn } from '../../../session-worker/src/nativeEncounterTurn'
import {
  commitNativeLiveEncounterTurn,
  commitNativeLiveEncounterTurnPending
} from '../../../session-worker/src/nativeEncounterTurnCommit'

const getSettings = makeFunctionReference<'query', { campaignId: string }, CampaignPlaySettingsDto>(
  'campaigns/playSettings:get'
)
const saveSettings = makeFunctionReference<
  'mutation',
  SaveCampaignPlaySettingsInput,
  CampaignPlaySettingsDto
>('campaigns/playSettings:save')
const createRun = makeFunctionReference<
  'mutation',
  CreateEncounterInputDto,
  EncounterGmProjectionDto
>('encounters/runs:create')

async function stored(base: Awaited<ReturnType<typeof turnActiveEffectFixture>>) {
  const characterIds = base.run.actors.flatMap((actor) =>
    actor.kind === 'CHARACTER' && actor.sourceId ? [actor.sourceId] : []
  )
  return base.t.run(async (ctx) => ({
    characters: await Promise.all(
      characterIds.map((id) =>
        ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', id))
          .unique()
      )
    ),
    characterEffects: (
      await Promise.all(
        characterIds.map((id) =>
          ctx.db
            .query('characterActiveRuleEffects')
            .withIndex('by_characterId_createdOrdinal_id', (q) => q.eq('characterId', id))
            .collect()
        )
      )
    ).flat(),
    characterReceipts: (
      await Promise.all(
        characterIds.map((id) =>
          ctx.db
            .query('characterCommandReceipts')
            .withIndex('by_characterId_commandId', (q) => q.eq('characterId', id))
            .collect()
        )
      )
    ).flat(),
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id))
      .collect(),
    rounds: await ctx.db
      .query('encounterInitiativeRounds')
      .withIndex('by_encounterId_round', (q) => q.eq('encounterId', base.run.id))
      .collect(),
    participants: await ctx.db
      .query('encounterInitiativeParticipants')
      .withIndex('by_encounterId_round_actorId', (q) => q.eq('encounterId', base.run.id))
      .collect(),
    effects: await ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_encounterId_targetActorId_createdOrdinal_id', (q) =>
        q.eq('encounterId', base.run.id)
      )
      .collect(),
    occurrences: await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) => q.eq('encounterId', base.run.id))
      .collect(),
    receipts: await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', base.run.id))
      .collect(),
    commands: await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', base.run.id))
      .collect()
  }))
}

function unchangedMechanics(
  before: Awaited<ReturnType<typeof stored>>,
  after: Awaited<ReturnType<typeof stored>>
) {
  const { occurrences: _beforeOccurrences, ...beforeMechanics } = before
  const { occurrences: _afterOccurrences, ...afterMechanics } = after
  expect(afterMechanics).toEqual(beforeMechanics)
}

function response(
  encounterId: string,
  input: unknown,
  resolution: ResolveRuleOccurrenceInputDto['resolution']
) {
  const result = encounterCommandResultDtoSchema.parse(input)
  if (!result.occurrence) throw new Error('Expected a pending turn occurrence.')
  return {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: result.projection.version,
      occurrenceId: result.occurrence.occurrenceId,
      expectedOccurrenceVersion: result.occurrence.occurrenceVersion,
      correlationId: null,
      resolution
    }
  } satisfies EncounterExecuteInput
}

function diceResponse(encounterId: string, input: unknown, system = false) {
  const result = encounterCommandResultDtoSchema.parse(input)
  const pending = result.occurrence?.pending
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected turn-effect d20 evidence.')
  return response(
    encounterId,
    result,
    system
      ? { kind: 'SYSTEM_ROLL', requestId: pending.request.requestId }
      : {
          kind: 'ENTER_DICE',
          requestId: pending.request.requestId,
          rawFaces: [1]
        }
  )
}

async function resolveInitiative(
  base: Awaited<ReturnType<typeof turnActiveEffectFixture>>,
  input: unknown
) {
  const result = encounterCommandResultDtoSchema.parse(input)
  const pending = result.occurrence?.pending
  if (!pending || pending.kind !== 'INITIATIVE_EVIDENCE')
    throw new Error('Expected initiative before incoming turn effects.')
  return base.owner.caller.mutation(
    api.encounters.commands.execute,
    response(base.run.id, result, {
      kind: 'ENTER_INTEGER',
      requestId: pending.request.requestId,
      value: 10
    })
  )
}

async function pendingEffect(
  base: Awaited<ReturnType<typeof turnActiveEffectFixture>>,
  effectId: string,
  stage: 'START_OF_TURN' | 'END_OF_TURN'
) {
  const snapshot = await stored(base)
  const occurrence = snapshot.occurrences.find((row) => row.state === 'PENDING')
  if (!occurrence?.pendingSnapshotJson)
    throw new Error('Expected a retained turn-effect continuation.')
  const pending = serverRuleExecutionPendingSnapshotDtoSchema.parse(
    JSON.parse(occurrence.pendingSnapshotJson)
  )
  expect(pending.applicationContext).toMatchObject({
    kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS',
    currentCandidate: { activeEffectId: effectId, stage }
  })
  return snapshot
}

function effectReceipt(snapshot: Awaited<ReturnType<typeof stored>>, commandId: string) {
  const receipt = snapshot.receipts.find((row) => row.commandId === commandId)
  if (!receipt) throw new Error('Expected the root turn receipt.')
  return storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
}

const liveTurnSecret = 'private-turn-effect-test-secret-at-least-32-bytes'
const liveTurnEnvironment = {
  CONVEX_SITE_URL: 'https://convex.example.test',
  LIVE_SESSION_WORKER_SECRET: liveTurnSecret
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('private DO turn active-effect terminal', () => {
  it('commits outgoing and incoming Character effects atomically with native lifecycle parity and exact replay', async () => {
    const turn = await liveCharacterTurn('AUTOMATIC')
    const { base, started, command } = turn
    const outgoing = await seedTurnSaveEffect(base, {
      stage: 'END_OF_TURN',
      ticks: 1,
      damage: 2
    })
    const incoming = await seedTurnSaveEffect(base, {
      stage: 'START_OF_TURN',
      ticks: 2,
      damage: 1
    })
    bridgeLiveTurn(base)
    const before = await stored(base)
    const entropy = vi.spyOn(crypto, 'getRandomValues').mockImplementation((values) => {
      ;(values as Uint32Array)[0] = 0
      return values
    })
    try {
      const planned = await planLiveTurn(turn)
      expect(planned.prepared.root.outgoingTurn?.kind).toBe('STAGED')
      expect(planned.terminal.incomingTurn.kind).toBe('STAGED')
      expect(await stored(base)).toEqual(before)
      const previews: EncounterCommandResultDto[] = []
      await expect(
        base.owner.caller.run(async (ctx) => {
          previews.push(
            encounterCommandResultDtoSchema.parse(
              await ctx.runMutation(api.encounters.commands.execute, { command })
            )
          )
          throw new Error('Roll back native turn preview.')
        })
      ).rejects.toThrow('Roll back native turn preview.')
      const native = previews[0]
      if (!native) throw new Error('Missing native turn preview.')
      expect(await stored(base)).toEqual(before)
      const badIncoming = planned.terminal.incomingTurn
      if (badIncoming.kind !== 'STAGED') throw new Error('Expected staged incoming effects.')
      const first = badIncoming.plan.executions[0]
      if (!first) throw new Error('Expected incoming effect execution.')
      const rejected: LiveSessionEncounterTurnCommitInput = {
        ...planned.terminal,
        incomingTurn: {
          kind: 'STAGED',
          plan: {
            ...badIncoming.plan,
            executions: [
              {
                ...first,
                lifecycle: { ...first.lifecycle, beforeLifecycleChecksum: 'f'.repeat(64) }
              },
              ...badIncoming.plan.executions.slice(1)
            ]
          }
        }
      }
      const response = await base.owner.caller.fetch('/live-sessions/encounter-turn', {
        method: 'POST',
        headers: { 'x-artificer-live-session-secret': liveTurnSecret },
        body: JSON.stringify(rejected)
      })
      expect(response.status).toBe(409)
      expect(await stored(base)).toEqual(before)
      const result = await commitNativeLiveEncounterTurn(
        liveTurnEnvironment,
        'fixture-access-token',
        planned.terminal
      )
      expect(result.projection).toMatchObject({
        status: native.projection.status,
        round: native.projection.round,
        currentActorId: native.projection.currentActorId,
        version: native.projection.version
      })
      const hp = encounterGmProjectionDtoSchema.parse(started.projection).actors[0]!
        .currentHitPoints
      expect(
        encounterGmProjectionDtoSchema.parse(result.projection).actors[0]!.currentHitPoints
      ).toBe(hp - 3)
      const after = await stored(base)
      const characterBefore = before.characters[0]
      const characterAfter = after.characters[0]
      if (!characterBefore || !characterAfter) throw new Error('Expected Character rows.')
      expect(characterAfter.streamVersion).toBe(characterBefore.streamVersion + 2)
      expect(after.characterReceipts).toHaveLength(before.characterReceipts.length + 2)
      expect(after.characterEffects).toEqual([
        expect.objectContaining({
          id: incoming.id,
          version: 2,
          lifecycle: { schemaVersion: 1, remainingTicks: 1 }
        })
      ])
      const receipt = effectReceipt(after, command.commandId)
      if (
        receipt.status !== 'TURN_LIFECYCLE_COMPLETE' ||
        receipt.outgoingTurn.kind !== 'EXECUTED' ||
        receipt.incomingTurn.kind !== 'EXECUTED'
      )
        throw new Error('Expected two completed turn-effect phases.')
      expect(receipt.outgoingTurn.executions.map((execution) => execution.activeEffectId)).toEqual([
        outgoing.id
      ])
      expect(receipt.incomingTurn.executions.map((execution) => execution.activeEffectId)).toEqual([
        incoming.id
      ])
      expect(receipt.incomingTurn.executions[0]?.targetTransition.before.currentHitPoints).toBe(
        hp - 2
      )
      expect(
        await commitNativeLiveEncounterTurn(
          liveTurnEnvironment,
          'fixture-access-token',
          planned.terminal
        )
      ).toEqual(result)
      expect(await stored(base)).toEqual(after)
    } finally {
      entropy.mockRestore()
    }
  }, 60_000)

  it('commits the planner’s MANUAL phase with its fixed occurrence version', async () => {
    const turn = await liveCharacterTurn('MANUAL')
    const { base, command } = turn
    const effect = await seedTurnSaveEffect(base, {
      stage: 'END_OF_TURN',
      ticks: 1,
      damage: 2
    })
    bridgeLiveTurn(base)
    const before = await stored(base)
    const planned = await planLiveTurn(turn)
    expect(planned.prepared.root.outgoingTurn).toMatchObject({
      kind: 'MANUAL',
      result: { status: 'MANUAL', occurrenceVersion: 1 }
    })
    expect(await stored(base)).toEqual(before)
    const result = await commitNativeLiveEncounterTurn(
      liveTurnEnvironment,
      'fixture-access-token',
      planned.terminal
    )
    const after = await stored(base)
    expect(after.characterEffects).toEqual(before.characterEffects)
    expect(after.characterEffects.some((row) => row.id === effect.id)).toBe(true)
    expect(after.characterReceipts).toEqual(before.characterReceipts)
    const receipt = effectReceipt(after, command.commandId)
    if (receipt.status !== 'TURN_LIFECYCLE_COMPLETE')
      throw new Error('Expected completed manual turn receipt.')
    expect(receipt.outgoingTurn.kind).toBe('MANUAL')
    expect(
      await commitNativeLiveEncounterTurn(
        liveTurnEnvironment,
        'fixture-access-token',
        planned.terminal
      )
    ).toEqual(result)
    expect(await stored(base)).toEqual(after)
  }, 60_000)

  it('resolves private ASSISTED turn-effect evidence and commits its retained root exactly once', async () => {
    const turn = await liveCharacterTurn('ASSISTED', 'ENCOUNTER_START')
    const { base, started, command } = turn
    const effect = await seedTurnSaveEffect(base, {
      stage: 'END_OF_TURN',
      ticks: 1,
      damage: 2
    })
    bridgeLiveTurn(base)
    const before = await stored(base)
    const planned = await planNativeLiveEncounterTurn(
      liveTurnEnvironment,
      'fixture-access-token',
      turn.scope,
      command,
      { runtime: await liveTurnRuntime(), random: () => 0 }
    )
    if (planned.kind !== 'PLANNED' || planned.prepared.kind !== 'PENDING')
      throw new Error('Expected pending turn-effect evidence.')
    expect(planned.prepared.snapshot.applicationContext).toMatchObject({
      kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS',
      currentCandidate: { activeEffectId: effect.id, stage: 'END_OF_TURN' }
    })
    expect(await stored(base)).toEqual(before)
    const issued = await commitNativeLiveEncounterTurnPending(
      liveTurnEnvironment,
      'fixture-access-token',
      liveSessionEncounterTurnPendingInputSchema.parse({
        ...turn.scope,
        command,
        revisions: planned.revisions,
        scenes: planned.scenes,
        snapshot: planned.prepared.snapshot
      })
    )
    const evidence = issued.occurrence?.pending
    if (!issued.occurrence || !evidence || evidence.kind !== 'D20_EVIDENCE')
      throw new Error('Expected private turn-effect d20 evidence.')
    unchangedMechanics(before, await stored(base))
    const responseCommand = {
      type: 'RESOLVE_RULE_OCCURRENCE' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: command.expectedVersion,
      occurrenceId: issued.occurrence.occurrenceId,
      expectedOccurrenceVersion: issued.occurrence.occurrenceVersion,
      correlationId: null,
      resolution: {
        kind: 'ENTER_DICE' as const,
        requestId: evidence.request.requestId,
        rawFaces: [1]
      }
    }
    const resumed = await planNativeLiveEncounterTurn(
      liveTurnEnvironment,
      'fixture-access-token',
      turn.scope,
      responseCommand,
      { runtime: await liveTurnRuntime(), random: () => 0 }
    )
    if (resumed.kind !== 'PLANNED' || resumed.prepared.kind !== 'COMPLETE' || !resumed.terminal)
      throw new Error('Expected a completed private turn response.')
    expect(resumed.occurrenceId).toBe(issued.occurrence.occurrenceId)
    expect(resumed.prepared.root.resolutionCommands).toMatchObject([
      {
        commandId: responseCommand.commandId,
        expectedOccurrenceVersion: responseCommand.expectedOccurrenceVersion
      }
    ])
    const stale = await stored(base)
    const history = resumed.terminal.root.resolutionCommands[0]
    if (!history) throw new Error('Expected retained turn response history.')
    const tampered: LiveSessionEncounterTurnCommitInput = {
      ...resumed.terminal,
      root: {
        ...resumed.terminal.root,
        resolutionCommands: [{ ...history, commandFingerprint: 'f'.repeat(64) }]
      }
    }
    const rejected = await base.owner.caller.fetch('/live-sessions/encounter-turn', {
      method: 'POST',
      headers: { 'x-artificer-live-session-secret': liveTurnSecret },
      body: JSON.stringify(tampered)
    })
    expect(rejected.status).toBe(409)
    expect(await stored(base)).toEqual(stale)
    const result = await commitNativeLiveEncounterTurn(
      liveTurnEnvironment,
      'fixture-access-token',
      resumed.terminal
    )
    const hp = encounterGmProjectionDtoSchema.parse(started.projection).actors[0]!.currentHitPoints
    expect(
      encounterGmProjectionDtoSchema.parse(result.projection).actors[0]!.currentHitPoints
    ).toBe(hp - 2)
    const after = await stored(base)
    expect(after.characterEffects).toEqual([])
    expect(after.characterReceipts).toHaveLength(before.characterReceipts.length + 1)
    const receipt = after.receipts.find((row) => row.commandId === command.commandId)
    if (!receipt) throw new Error('Expected terminal turn receipt.')
    const resultReceipt = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    if (
      resultReceipt.status !== 'TURN_LIFECYCLE_COMPLETE' ||
      resultReceipt.outgoingTurn.kind !== 'EXECUTED'
    )
      throw new Error('Expected completed outgoing effect evidence.')
    expect(resultReceipt.occurrenceVersion).toBe(issued.occurrence.occurrenceVersion + 1)
    expect(resultReceipt.outgoingTurn.executions[0]?.activeEffectId).toBe(effect.id)
    expect(JSON.parse(receipt.commandMetadataJson).resolutionCommands).toMatchObject([
      {
        commandId: responseCommand.commandId,
        expectedOccurrenceVersion: responseCommand.expectedOccurrenceVersion
      }
    ])
    expect(
      await commitNativeLiveEncounterTurn(
        liveTurnEnvironment,
        'fixture-access-token',
        resumed.terminal
      )
    ).toEqual(result)
    expect(await stored(base)).toEqual(after)
  }, 60_000)
})

async function liveCharacterTurn(
  mode: 'AUTOMATIC' | 'ASSISTED' | 'MANUAL',
  cadence: 'EACH_ROUND' | 'ENCOUNTER_START' = 'EACH_ROUND'
) {
  const fixture = await turnCharacterEffectFixture()
  const initiative = createEncounterInitiativeDefinitions([{ procedure: 'ACTOR_ROLL', cadence }])
  await fixture.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: initiative.definitions
  })
  const settings = await fixture.owner.caller.query(getSettings, {
    campaignId: fixture.campaign.id
  })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await fixture.owner.caller.mutation(saveSettings, {
    ...fields,
    expectedVersion: version,
    automationMode: mode,
    initiativePolicyDefinitionId: initiative.policyIds[0]!,
    initiativeTieDefinitionId: null
  })
  const created = await fixture.owner.caller.mutation(createRun, {
    campaignId: fixture.campaign.id,
    sessionId: fixture.run.sessionId,
    blueprintId: fixture.run.blueprintId,
    commandId: crypto.randomUUID()
  })
  const opponent = created.actors.find((actor) => actor.kind === 'CUSTOM')
  if (!opponent) throw new Error('Expected the fixture opponent.')
  const removed = await fixture.owner.caller.mutation(api.encounters.commands.execute, {
    command: {
      type: 'REMOVE_ACTOR',
      encounterId: created.id,
      commandId: crypto.randomUUID(),
      expectedVersion: created.version,
      actorId: opponent.id
    }
  })
  const base = { ...fixture, run: encounterGmProjectionDtoSchema.parse(removed.projection) }
  let started = await base.owner.caller.mutation(api.encounters.commands.execute, {
    command: {
      type: 'START',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.run.version
    }
  })
  if (mode === 'ASSISTED') started = await resolveInitiative(base, started)
  if (started.projection.status !== 'ACTIVE') throw new Error('Expected an active Character Run.')
  const epoch = crypto.randomUUID()
  await base.t.run((ctx) =>
    ctx.db.insert('campaignLiveAuthorities', {
      campaignId: base.campaign.id,
      sessionId: base.run.sessionId,
      epoch,
      phase: 'DO_ACTIVE',
      activationFingerprint: '0'.repeat(64),
      persistedSequence: 0,
      persistedStateChecksum: '0'.repeat(64),
      createdAt: base.campaign.createdAt,
      updatedAt: base.campaign.createdAt
    })
  )
  const scope: Omit<LiveSessionEncounterRulesInput, 'request'> = {
    campaignId: base.campaign.id,
    sessionId: base.run.sessionId,
    authorityEpoch: epoch,
    expectedUserId: base.owner.userId,
    expectedRole: 'OWNER',
    encounterId: base.run.id,
    expectedVersion: started.projection.version
  }
  const command = {
    type: 'ADVANCE_TURN' as const,
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: started.projection.version
  }
  return { base, started, scope, command }
}

function bridgeLiveTurn(base: Awaited<ReturnType<typeof liveCharacterTurn>>['base']) {
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', liveTurnSecret)
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const pathname = new URL(url instanceof Request ? url.url : url.toString()).pathname
      if (
        pathname !== '/live-sessions/encounter-rules' &&
        pathname !== '/live-sessions/character-rules' &&
        pathname !== '/live-sessions/encounter-turn-pending' &&
        pathname !== '/live-sessions/encounter-turn'
      )
        throw new Error(`Unexpected private turn request: ${pathname}`)
      if (new Headers(init?.headers).get('authorization') !== 'Bearer fixture-access-token')
        throw new Error('Missing private turn bearer token.')
      if (new Headers(init?.headers).get('x-artificer-live-session-secret') !== liveTurnSecret)
        throw new Error('Missing private turn secret.')
      if (typeof init?.body !== 'string') throw new Error('Missing private turn body.')
      if (pathname === '/live-sessions/encounter-rules')
        liveSessionEncounterRulesInputSchema.parse(JSON.parse(init.body))
      else if (pathname === '/live-sessions/character-rules')
        liveSessionCharacterRulesInputSchema.parse(JSON.parse(init.body))
      else if (pathname === '/live-sessions/encounter-turn-pending')
        liveSessionEncounterTurnPendingInputSchema.parse(JSON.parse(init.body))
      else liveSessionEncounterTurnCommitInputSchema.parse(JSON.parse(init.body))
      return base.owner.caller.fetch(pathname, init)
    })
  )
}

async function liveTurnRuntime() {
  const runtimeSecret = process.env.BETTER_AUTH_SECRET
  if (!runtimeSecret) throw new Error('Missing fixture rule continuation secret.')
  return createPlatformRulesRuntime({
    continuationIntegrityKey: new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(
          `artificer-toolkit:session-host:rules-continuation:v1\0${runtimeSecret}`
        )
      )
    ),
    definitions: {
      async requireCurrent() {
        throw new Error('Turn graphs must use captured definitions.')
      }
    }
  })
}

async function planLiveTurn(turn: Awaited<ReturnType<typeof liveCharacterTurn>>) {
  const planned = await planNativeLiveEncounterTurn(
    liveTurnEnvironment,
    'fixture-access-token',
    turn.scope,
    turn.command,
    { runtime: await liveTurnRuntime(), random: () => 0 }
  )
  if (planned.kind !== 'PLANNED' || planned.prepared.kind !== 'COMPLETE' || !planned.terminal)
    throw new Error('Expected a completed DO turn plan.')
  return { ...planned, prepared: planned.prepared, terminal: planned.terminal }
}

describe('native public turn active-effect journeys', () => {
  it('uses staged Character damage facts for EACH_ROUND initiative while the turn remains pending', async () => {
    const fixture = await turnCharacterEffectFixture()
    const initiative = createEncounterInitiativeDefinitions([
      { procedure: 'ACTOR_ROLL', cadence: 'EACH_ROUND' }
    ])
    await fixture.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: initiative.definitions
    })
    const settings = await fixture.owner.caller.query(getSettings, {
      campaignId: fixture.campaign.id
    })
    const { version, updatedAt: _updatedAt, ...fields } = settings
    await fixture.owner.caller.mutation(saveSettings, {
      ...fields,
      expectedVersion: version,
      initiativePolicyDefinitionId: initiative.policyIds[0]!,
      initiativeTieDefinitionId: null
    })
    const created = await fixture.owner.caller.mutation(createRun, {
      campaignId: fixture.campaign.id,
      sessionId: fixture.run.sessionId,
      blueprintId: fixture.run.blueprintId,
      commandId: crypto.randomUUID()
    })
    const opponent = created.actors.find((actor) => actor.kind === 'CUSTOM')
    if (!opponent) throw new Error('Expected the fixture opponent.')
    const removed = await fixture.owner.caller.mutation(api.encounters.commands.execute, {
      command: {
        type: 'REMOVE_ACTOR',
        encounterId: created.id,
        commandId: crypto.randomUUID(),
        expectedVersion: created.version,
        actorId: opponent.id
      }
    })
    const base = { ...fixture, run: encounterGmProjectionDtoSchema.parse(removed.projection) }
    const actor = base.run.actors[0]!
    if (actor.kind !== 'CHARACTER') throw new Error('Expected a Character turn owner.')
    const starting = await base.owner.caller.mutation(api.encounters.commands.execute, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    const started = await resolveInitiative(base, starting)
    expect(started.occurrence?.status).toBe('COMPLETE')
    const effect = await seedTurnSaveEffect(base, {
      stage: 'END_OF_TURN',
      ticks: 1,
      damage: 1
    })
    const before = await stored(base)
    const advance: EncounterExecuteInput = {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version
      }
    }
    const pendingOutgoing = await base.owner.caller.mutation(
      api.encounters.commands.execute,
      advance
    )
    unchangedMechanics(before, await pendingEffect(base, effect.id, 'END_OF_TURN'))
    const pendingInitiative = await base.owner.caller.action(
      api.encounters.commandActions.execute,
      diceResponse(base.run.id, pendingOutgoing)
    )
    expect(pendingInitiative.occurrence?.pending?.kind).toBe('INITIATIVE_EVIDENCE')
    unchangedMechanics(before, await stored(base))
    const completed = await resolveInitiative(base, pendingInitiative)
    expect(completed.occurrence?.status).toBe('COMPLETE')
    const terminal = await stored(base)
    const characterBefore = before.characters[0]
    const characterAfter = terminal.characters[0]
    if (!characterBefore || !characterAfter) throw new Error('Expected the Character rows.')
    expect(characterAfter.streamVersion).toBe(characterBefore.streamVersion + 1)
    expect(
      characterAuthoredDtoSchema.parse(JSON.parse(characterAfter.documentJson)).state.hitpoints
        .current
    ).toBe(actor.currentHitPoints - 1)
    expect(terminal.characterEffects).toEqual([])
    expect(terminal.characterReceipts).toHaveLength(before.characterReceipts.length + 1)
    await expect(
      base.owner.caller.mutation(api.encounters.commands.execute, advance)
    ).resolves.toEqual(completed)
    expect(await stored(base)).toEqual(terminal)
  }, 30000)

  it('redacts accepted Character declaration replay while incoming turn-effect dice remain GM-only', async () => {
    const base = await turnCharacterEffectFixture()
    expect(base.run.actors).toHaveLength(1)
    const actor = base.run.actors[0]!
    expect(actor.kind).toBe('CHARACTER')
    const effect = await seedTurnSaveEffect(base, { stage: 'START_OF_TURN', ticks: 1, damage: 1 })
    const before = await stored(base)
    const start: EncounterExecuteInput = {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    }
    const issued = await base.owner.caller.mutation(api.encounters.commands.execute, start)
    const declaration = await base.player.caller.query(
      api.encounters.pendingReads.pendingRuleOccurrence,
      { encounterId: base.run.id }
    )
    if (!declaration || declaration.kind !== 'INITIATIVE_DECLARATION')
      throw new Error('Expected the controller-owned Character declaration.')
    expect(declaration.actorId).toBe(actor.id)
    const option = declaration.primaryOptions.find((entry) => entry.kind === 'CHARACTER_ACTION')
    if (!option) throw new Error('Expected the equipped Character action declaration.')
    const declarationCommand = response(base.run.id, issued, {
      kind: 'INITIATIVE_DECLARATION',
      requestId: declaration.requestId,
      primary: { kind: 'CHARACTER_ACTION', optionId: option.optionId },
      bonus: null
    })
    const accepted = await base.player.caller.action(
      api.encounters.commandActions.execute,
      declarationCommand
    )
    expect(encounterPlayerProjectionDtoSchema.safeParse(accepted.projection).success).toBe(true)
    expect(accepted.occurrence?.pending).toBeNull()
    const gmInitiative = await base.owner.caller.mutation(api.encounters.commands.execute, start)
    const pendingIncoming = await resolveInitiative(base, gmInitiative)
    const paused = await pendingEffect(base, effect.id, 'START_OF_TURN')
    unchangedMechanics(before, paused)
    expect(
      await base.player.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).toBeNull()
    expect(
      await base.player.caller.query(api.encounters.projectionReads.pendingPrepared, {
        campaignId: base.campaign.id
      })
    ).toEqual([])
    const playerProjection = encounterPlayerProjectionDtoSchema.parse(
      await base.player.caller.query(api.encounters.projectionReads.get, {
        encounterId: base.run.id
      })
    )
    const expectedReplay = {
      ...pendingIncoming,
      projection: playerProjection,
      occurrence: pendingIncoming.occurrence && { ...pendingIncoming.occurrence, pending: null }
    }
    const replay = await base.player.caller.action(
      api.encounters.commandActions.execute,
      declarationCommand
    )
    expect(replay).toEqual(expectedReplay)
    expect(replay.projection.actors.every((entry) => !('currentHitPoints' in entry))).toBe(true)
    await expect(
      base.player.caller.mutation(api.encounters.commands.execute, declarationCommand)
    ).resolves.toEqual(expectedReplay)
    const dice = diceResponse(base.run.id, pendingIncoming)
    await expect(
      base.player.caller.action(api.encounters.commandActions.execute, dice)
    ).rejects.toThrow()
    expect(await stored(base)).toEqual(paused)
    const settled = await base.owner.caller.action(api.encounters.commandActions.execute, dice)
    expect(settled.occurrence?.status).toBe('COMPLETE')
    const terminal = await stored(base)
    const characterBefore = before.characters[0]
    const characterAfter = terminal.characters[0]
    if (!characterBefore || !characterAfter)
      throw new Error('Expected the authoritative Character rows.')
    expect(characterAfter.streamVersion).toBe(characterBefore.streamVersion + 1)
    expect(
      characterAuthoredDtoSchema.parse(JSON.parse(characterAfter.documentJson)).state.hitpoints
        .current
    ).toBe(actor.currentHitPoints - 1)
    expect(
      encounterGmProjectionDtoSchema.parse(settled.projection).actors[0]!.currentHitPoints
    ).toBe(actor.currentHitPoints - 1)
    expect(terminal.characterEffects).toEqual([])
    expect(terminal.characterReceipts).toHaveLength(before.characterReceipts.length + 1)
    const terminalReplay = await base.player.caller.action(
      api.encounters.commandActions.execute,
      declarationCommand
    )
    expect(terminalReplay.occurrence?.pending).toBeNull()
    expect(encounterPlayerProjectionDtoSchema.safeParse(terminalReplay.projection).success).toBe(
      true
    )
    await expect(
      base.player.caller.action(api.encounters.commandActions.execute, declarationCommand)
    ).resolves.toEqual(terminalReplay)
    expect(await stored(base)).toEqual(terminal)
  }, 30000)

  it('replays an accepted initiative declaration while START awaits incoming effect dice', async () => {
    const base = await turnActiveEffectFixture('ASSISTED', 'DECLARED_ACTION_ROLL')
    const effect = await seedTurnSaveEffect(base, {
      stage: 'START_OF_TURN',
      ticks: 1,
      damage: 1
    })
    const before = await stored(base)
    const start: EncounterExecuteInput = {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    }
    const pendingDeclaration = await base.owner.caller.mutation(
      api.encounters.commands.execute,
      start
    )
    const declaration = pendingDeclaration.occurrence?.pending
    if (!declaration || declaration.kind !== 'INITIATIVE_DECLARATION')
      throw new Error('Expected a Creature initiative declaration.')
    const option = declaration.primaryOptions.find(
      (entry) => entry.kind === 'CREATURE_FEATURE_ACTION'
    )
    if (!option) throw new Error('Expected the issued Creature Feature option.')
    const acceptedDeclaration = response(base.run.id, pendingDeclaration, {
      kind: 'INITIATIVE_DECLARATION',
      requestId: declaration.requestId,
      primary: { kind: 'CREATURE_FEATURE_ACTION', optionId: option.optionId },
      bonus: null
    })
    const pendingInitiative = await base.owner.caller.action(
      api.encounters.commandActions.execute,
      acceptedDeclaration
    )
    const pendingIncoming = await resolveInitiative(base, pendingInitiative)
    const paused = await pendingEffect(base, effect.id, 'START_OF_TURN')
    unchangedMechanics(before, paused)
    await expect(
      base.owner.caller.action(api.encounters.commandActions.execute, acceptedDeclaration)
    ).resolves.toEqual(pendingIncoming)
    await expect(
      base.owner.caller.mutation(api.encounters.commands.execute, start)
    ).resolves.toEqual(pendingIncoming)
    expect(await stored(base)).toEqual(paused)
    expect(
      await base.other.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).toBeNull()
    const settled = await base.owner.caller.action(
      api.encounters.commandActions.execute,
      diceResponse(base.run.id, pendingIncoming)
    )
    expect(settled.occurrence?.status).toBe('COMPLETE')
    expect(
      encounterGmProjectionDtoSchema.parse(settled.projection).actors[0]!.currentHitPoints
    ).toBe(base.run.actors[0]!.currentHitPoints - 1)
    const terminal = await stored(base)
    expect(terminal.effects).toEqual([])
    await expect(
      base.owner.caller.action(api.encounters.commandActions.execute, acceptedDeclaration)
    ).resolves.toEqual(settled)
    expect(await stored(base)).toEqual(terminal)
  }, 30000)

  it('START rolls incoming effects, updates and expires their lifecycles, and exactly replays without writes or dice', async () => {
    const base = await turnActiveEffectFixture('AUTOMATIC')
    const tick = await seedTurnSaveEffect(base, {
      stage: 'START_OF_TURN',
      ticks: 2,
      damage: 1
    })
    const expire = await seedTurnSaveEffect(base, {
      stage: 'START_OF_TURN',
      ticks: 1,
      damage: 2
    })
    const start: EncounterExecuteInput = {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    }
    const entropy = vi.spyOn(crypto, 'getRandomValues').mockImplementation((values) => {
      ;(values as Uint32Array)[0] = 0
      return values
    })
    try {
      const result = await base.owner.caller.mutation(api.encounters.commands.execute, start)
      expect(result).toMatchObject({
        projection: {
          status: 'ACTIVE',
          round: 1,
          version: base.run.version + 1,
          currentActorId: base.run.actors[0]!.id
        },
        occurrence: { status: 'COMPLETE', pending: null }
      })
      expect(
        encounterGmProjectionDtoSchema.parse(result.projection).actors[0]!.currentHitPoints
      ).toBe(base.run.actors[0]!.currentHitPoints - 3)
      const terminal = await stored(base)
      expect(terminal.effects).toEqual([
        expect.objectContaining({
          id: tick.id,
          version: 2,
          lifecycle: { schemaVersion: 1, remainingTicks: 1 }
        })
      ])
      const receipt = effectReceipt(terminal, start.command.commandId)
      if (
        receipt.status !== 'BATCH_COMPLETE' ||
        receipt.batchKind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
      )
        throw new Error('Expected the START active-effect batch receipt.')
      expect(receipt.executions).toEqual([
        expect.objectContaining({
          activeEffectId: tick.id,
          stage: 'START_OF_TURN',
          lifecycle: expect.objectContaining({
            kind: 'UPDATE',
            beforeRemainingTicks: 2,
            afterRemainingTicks: 1
          })
        }),
        expect.objectContaining({
          activeEffectId: expire.id,
          stage: 'START_OF_TURN',
          lifecycle: expect.objectContaining({
            kind: 'EXPIRE',
            beforeRemainingTicks: 1,
            afterRemainingTicks: 0
          })
        })
      ])
      expect(receipt.executions.map((execution) => execution.d20?.rawFaces)).toEqual([[1], [1]])
      expect(terminal.receipts).toHaveLength(1)
      expect(terminal.occurrences).toHaveLength(1)
      entropy.mockClear()
      await expect(
        base.owner.caller.mutation(api.encounters.commands.execute, start)
      ).resolves.toEqual(result)
      expect(entropy).not.toHaveBeenCalled()
      expect(await stored(base)).toEqual(terminal)
    } finally {
      entropy.mockRestore()
    }
  }, 30000)

  it('ADVANCE_TURN applies outgoing then incoming effects to the same actor across the round boundary', async () => {
    const base = await turnActiveEffectFixture('AUTOMATIC')
    const started = await base.owner.caller.mutation(api.encounters.commands.execute, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    const outgoing = await seedTurnSaveEffect(base, {
      stage: 'END_OF_TURN',
      ticks: 1,
      damage: 2
    })
    const incoming = await seedTurnSaveEffect(base, {
      stage: 'START_OF_TURN',
      ticks: 2,
      damage: 1
    })
    const advance: EncounterExecuteInput = {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version
      }
    }
    const result = await base.owner.caller.mutation(api.encounters.commands.execute, advance)
    const hp = encounterGmProjectionDtoSchema.parse(started.projection).actors[0]!.currentHitPoints
    expect(result).toMatchObject({
      projection: {
        round: 2,
        version: started.projection.version + 1,
        currentActorId: base.run.actors[0]!.id
      },
      occurrence: { status: 'COMPLETE' }
    })
    expect(
      encounterGmProjectionDtoSchema.parse(result.projection).actors[0]!.currentHitPoints
    ).toBe(hp - 3)
    const terminal = await stored(base)
    const receipt = effectReceipt(terminal, advance.command.commandId)
    if (
      receipt.status !== 'TURN_LIFECYCLE_COMPLETE' ||
      receipt.outgoingTurn.kind !== 'EXECUTED' ||
      receipt.incomingTurn.kind !== 'EXECUTED'
    )
      throw new Error('Expected both completed turn-effect phases.')
    expect([...receipt.outgoingTurn.executions, ...receipt.incomingTurn.executions]).toEqual([
      expect.objectContaining({
        activeEffectId: outgoing.id,
        stage: 'END_OF_TURN',
        targetTransition: expect.objectContaining({
          before: expect.objectContaining({ currentHitPoints: hp }),
          after: expect.objectContaining({ currentHitPoints: hp - 2 })
        })
      }),
      expect.objectContaining({
        activeEffectId: incoming.id,
        stage: 'START_OF_TURN',
        targetTransition: expect.objectContaining({
          before: expect.objectContaining({ currentHitPoints: hp - 2 }),
          after: expect.objectContaining({ currentHitPoints: hp - 3 })
        })
      })
    ])
    expect(terminal.effects).toEqual([
      expect.objectContaining({
        id: incoming.id,
        version: 2,
        lifecycle: { schemaVersion: 1, remainingTicks: 1 }
      })
    ])
    expect(terminal.rounds.map((round) => round.round)).toEqual([1, 2])
    await expect(
      base.owner.caller.mutation(api.encounters.commands.execute, advance)
    ).resolves.toEqual(result)
    expect(await stored(base)).toEqual(terminal)
  }, 30000)

  it('retains outgoing effects through initiative, Recharge, and incoming dice; only terminal completion publishes the whole turn', async () => {
    const base = await turnActiveEffectFixture('ASSISTED')
    const starting = await base.owner.caller.mutation(api.encounters.commands.execute, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    const started = await resolveInitiative(base, starting)
    expect(started.occurrence?.status).toBe('COMPLETE')
    const spent = await base.owner.caller.mutation(api.encounters.commands.execute, {
      command: {
        type: 'ADJUST_FEATURE_RESOURCE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version,
        actorId: base.run.actors[0]!.id,
        featureId: automaticChargedBiteFeatureId,
        direction: 'USE',
        amount: 1
      }
    })
    const outgoing = await seedTurnSaveEffect(base, {
      stage: 'END_OF_TURN',
      ticks: 1,
      damage: 2
    })
    const incoming = await seedTurnSaveEffect(base, {
      stage: 'START_OF_TURN',
      ticks: 1,
      damage: 1
    })
    const advance: EncounterExecuteInput = {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: spent.projection.version
      }
    }
    const before = await stored(base)
    const pendingOutgoing = await base.owner.caller.mutation(
      api.encounters.commands.execute,
      advance
    )
    unchangedMechanics(before, await pendingEffect(base, outgoing.id, 'END_OF_TURN'))
    const outgoingResponse = diceResponse(base.run.id, pendingOutgoing)
    const pendingInitiative = await base.owner.caller.action(
      api.encounters.commandActions.execute,
      outgoingResponse
    )
    expect(pendingInitiative.occurrence?.pending?.kind).toBe('INITIATIVE_EVIDENCE')
    unchangedMechanics(before, await stored(base))
    await expect(
      base.owner.caller.action(api.encounters.commandActions.execute, outgoingResponse)
    ).resolves.toEqual(pendingInitiative)
    const retainedInitiative = await stored(base)
    await expect(
      base.owner.caller.action(api.encounters.commandActions.execute, {
        command: { ...outgoingResponse.command, correlationId: crypto.randomUUID() }
      })
    ).rejects.toThrow('Rule occurrence is unavailable.')
    expect(await stored(base)).toEqual(retainedInitiative)
    const pendingRecharge = await resolveInitiative(base, pendingInitiative)
    const recharge = pendingRecharge.occurrence?.pending
    if (!recharge || recharge.kind !== 'RECHARGE_EVIDENCE')
      throw new Error('Expected Recharge between initiative and incoming effects.')
    unchangedMechanics(before, await stored(base))
    const rechargeResponse = response(base.run.id, pendingRecharge, {
      kind: 'ENTER_INTEGER',
      requestId: recharge.request.requestId,
      value: 5
    })
    const pendingIncoming = await base.owner.caller.action(
      api.encounters.commandActions.execute,
      rechargeResponse
    )
    unchangedMechanics(before, await pendingEffect(base, incoming.id, 'START_OF_TURN'))
    expect(
      await base.other.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).toBeNull()
    expect(
      await base.owner.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).toEqual(pendingIncoming.occurrence!.pending)
    const terminalResponse = diceResponse(base.run.id, pendingIncoming, true)
    const entropy = vi.spyOn(crypto, 'getRandomValues').mockImplementation((values) => {
      ;(values as Uint32Array)[0] = 0
      return values
    })
    try {
      const result = await base.owner.caller.action(
        api.encounters.commandActions.execute,
        terminalResponse
      )
      expect(result).toMatchObject({
        projection: { round: 2, version: spent.projection.version + 1 },
        occurrence: { status: 'COMPLETE', pending: null }
      })
      const terminal = await stored(base)
      const actor = encounterRunActorStateSchema.parse(JSON.parse(terminal.actors[0]!.stateJson))
      expect(actor.currentHitPoints).toBe(
        encounterGmProjectionDtoSchema.parse(spent.projection).actors[0]!.currentHitPoints - 3
      )
      expect(actor.resources).toMatchObject({
        featureCharges: { [automaticChargedBiteFeatureId]: 0 }
      })
      expect(terminal.effects).toEqual([])
      expect(terminal.rounds.map((round) => round.round)).toEqual([1, 2])
      const receipt = effectReceipt(terminal, advance.command.commandId)
      if (
        receipt.status !== 'TURN_LIFECYCLE_COMPLETE' ||
        receipt.outgoingTurn.kind !== 'EXECUTED' ||
        receipt.incomingTurn.kind !== 'EXECUTED'
      )
        throw new Error('Expected both completed turn-effect phases.')
      expect(
        [...receipt.outgoingTurn.executions, ...receipt.incomingTurn.executions].map(
          (execution) => [execution.activeEffectId, execution.stage, execution.d20?.rawFaces]
        )
      ).toEqual([
        [outgoing.id, 'END_OF_TURN', [1]],
        [incoming.id, 'START_OF_TURN', [1]]
      ])
      expect(receipt.rechargeExecutions).toEqual([
        expect.objectContaining({ rawDie: 5, recharged: true })
      ])
      entropy.mockClear()
      await expect(
        base.owner.caller.action(api.encounters.commandActions.execute, terminalResponse)
      ).resolves.toEqual(result)
      await expect(
        base.owner.caller.mutation(api.encounters.commands.execute, advance)
      ).resolves.toEqual(result)
      expect(entropy).not.toHaveBeenCalled()
      expect(await stored(base)).toEqual(terminal)
    } finally {
      entropy.mockRestore()
    }
  }, 30000)

  it('START retains the first effect while the second awaits dice and rejects stale retained lifecycle without writes', async () => {
    const base = await turnActiveEffectFixture('ASSISTED')
    const first = await seedTurnSaveEffect(base, {
      stage: 'START_OF_TURN',
      ticks: 2,
      damage: 1
    })
    const second = await seedTurnSaveEffect(base, {
      stage: 'START_OF_TURN',
      ticks: 1,
      damage: 1
    })
    const before = await stored(base)
    const start = await base.owner.caller.mutation(api.encounters.commands.execute, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    const pendingFirst = await resolveInitiative(base, start)
    const firstResponse = diceResponse(base.run.id, pendingFirst)
    const pendingSecond = await base.owner.caller.action(
      api.encounters.commandActions.execute,
      firstResponse
    )
    const paused = await pendingEffect(base, second.id, 'START_OF_TURN')
    unchangedMechanics(before, paused)
    await expect(
      base.owner.caller.action(api.encounters.commandActions.execute, firstResponse)
    ).resolves.toEqual(pendingSecond)
    expect(await stored(base)).toEqual(paused)
    await base.t.run((ctx) =>
      createActiveRuleEffectStore(ctx).updateLifecycleCas({
        id: first.id,
        owner: first.owner,
        expectedVersion: first.version,
        lifecycle: { schemaVersion: 1, remainingTicks: 1 }
      })
    )
    const stale = await stored(base)
    const final = diceResponse(base.run.id, pendingSecond, true)
    const entropy = vi.spyOn(crypto, 'getRandomValues')
    try {
      await expect(
        base.owner.caller.action(api.encounters.commandActions.execute, final)
      ).rejects.toThrow()
      expect(entropy).not.toHaveBeenCalled()
      expect(await stored(base)).toEqual(stale)
    } finally {
      entropy.mockRestore()
    }
  }, 30000)

  it('rejects player evidence, wrong requests, stale target/source and rolls back an induced terminal failure', async () => {
    const base = await turnActiveEffectFixture('ASSISTED')
    const effect = await seedTurnSaveEffect(base, {
      stage: 'START_OF_TURN',
      ticks: 1,
      damage: 1
    })
    const start = await base.owner.caller.mutation(api.encounters.commands.execute, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    const pending = await resolveInitiative(base, start)
    const final = diceResponse(base.run.id, pending)
    const before = await stored(base)
    const rollback = makeFunctionReference<
      'action',
      {
        ownerUserId: string
        campaignId: string
        encounterId: string
        operation: { kind: 'COMMAND'; input: EncounterExecuteInput }
      },
      { rolledBack: true }
    >('encounters/developmentLifecycle:verifyRollback')
    await expect(
      base.owner.caller.action(rollback, {
        ownerUserId: base.owner.userId,
        campaignId: base.campaign.id,
        encounterId: base.run.id,
        operation: { kind: 'COMMAND', input: final }
      })
    ).resolves.toEqual({ rolledBack: true })
    expect(await stored(base)).toEqual(before)
    expect(
      await base.other.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).toBeNull()
    await expect(
      base.other.caller.action(api.encounters.commandActions.execute, final)
    ).rejects.toThrow()
    await expect(
      base.owner.caller.action(api.encounters.commandActions.execute, {
        command: {
          ...final.command,
          commandId: crypto.randomUUID(),
          resolution: {
            kind: 'ENTER_DICE',
            requestId: crypto.randomUUID(),
            rawFaces: [1]
          }
        }
      })
    ).rejects.toThrow()
    expect(await stored(base)).toEqual(before)
    const actorRow = before.actors[0]!
    const actor = encounterRunActorStateSchema.parse(JSON.parse(actorRow.stateJson))
    const alteredActor = {
      ...actor,
      currentHitPoints: actor.currentHitPoints - 1
    }
    await base.t.run((ctx) =>
      ctx.db.patch(actorRow._id, {
        stateJson: JSON.stringify(alteredActor),
        stateChecksum: checksumCanonicalJson(alteredActor)
      })
    )
    const staleTarget = await stored(base)
    await expect(
      base.owner.caller.action(api.encounters.commandActions.execute, final)
    ).rejects.toThrow()
    expect(await stored(base)).toEqual(staleTarget)
    await base.t.run(async (ctx) => {
      await ctx.db.patch(actorRow._id, {
        stateJson: actorRow.stateJson,
        stateChecksum: actorRow.stateChecksum
      })
      const row = await ctx.db
        .query('encounterActiveRuleEffects')
        .withIndex('by_publicId', (q) => q.eq('id', effect.id))
        .unique()
      if (!row) throw new Error('Missing source effect.')
      const definition = activeRuleEffectDefinitionDtoSchema.parse(JSON.parse(row.definitionJson))
      const changed = {
        ...definition,
        frozenGraph: {
          ...definition.frozenGraph,
          source: {
            ...definition.frozenGraph.source,
            checksum: 'f'.repeat(64)
          }
        }
      }
      await ctx.db.patch(row._id, {
        definitionJson: JSON.stringify(changed),
        definitionChecksum: checksumCanonicalJson(changed)
      })
    })
    const staleSource = await stored(base)
    await expect(
      base.owner.caller.action(api.encounters.commandActions.execute, final)
    ).rejects.toThrow()
    expect(await stored(base)).toEqual(staleSource)
  }, 30000)
})
