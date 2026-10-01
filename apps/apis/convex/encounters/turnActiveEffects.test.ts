import {
  createConvexEncounterStoreReader,
  createConvexEncounterStore
} from '../lib/convexEncounterStore'
import { readReceiptHeaders } from '../lib/receiptLedgers'
import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
  encounterPlayerProjectionDtoSchema,
  type CreateEncounterInputDto,
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
import {
  createPlatformRulesRuntime,
  deriveRulesContinuationKey
} from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { automaticChargedBiteFeatureId } from '../../tests/fixtures/encounterAction'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import { setAutoRollDice, type FixtureRolls } from '../../tests/fixtures/rollPreferences'
import { api, internal } from '../_generated/api'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import {
  seedTurnSaveEffect,
  turnActiveEffectFixture,
  turnCharacterEffectFixture
} from '../../tests/fixtures/turnActiveEffectFixtures'
import { planNativeLiveEncounterTurn } from '../../../session-worker/src/nativeEncounterTurn'
import { callLiveSessionRoute } from '../../../session-worker/src/liveSessionRoutes'
import {
  insertActiveLiveAuthority,
  stubLiveSessionFetch,
  workerEnvironment,
  executeInRoom,
  replayInRoom
} from '../../tests/fixtures/liveSessionWorker'
import { LiveSessionRouteError } from '../../../session-worker/src/liveSessionRoutes'

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
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    characters: await Promise.all(characterIds.map((id) => readCharacterRow(ctx, id))),
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
            .then((headers) => readReceiptHeaders(ctx, 'characterCommandReceipts', headers))
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
      .collect()
      .then((headers) => readReceiptHeaders(ctx, 'encounterRuleReceipts', headers)),
    commands: await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', base.run.id))
      .collect()
      .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
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

function d20Pending(input: unknown) {
  const result = encounterCommandResultDtoSchema.parse(input)
  const pending = result.occurrence?.pending
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected turn-effect d20 evidence.')
  return { result, pending }
}

function diceResponse(encounterId: string, input: unknown) {
  const { result, pending } = d20Pending(input)
  return response(encounterId, result, {
    kind: 'ENTER_DICE',
    requestId: pending.request.requestId,
    rawFaces: [1],
    rollMode: pending.request.rollMode
  })
}

/** "Roll dice" as the GM, then answer with that app roll. */
async function appRollResponse(
  base: Awaited<ReturnType<typeof turnActiveEffectFixture>>,
  input: unknown
) {
  const { result, pending } = d20Pending(input)
  // App rolls post to the table chat, which needs a username.
  await base.owner.caller.mutation(api.account.updateProfile, { username: 'TurnGm', bio: null })
  const rolled = await executeInRoom(base.owner.caller, {
    command: {
      type: 'ROLL_RULE_EVIDENCE',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: result.projection.version,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      requestId: pending.request.requestId,
      rollMode: pending.request.rollMode
    }
  })
  if (!rolled.evidenceRoll) throw new Error('Expected a recorded app roll.')
  return response(base.run.id, result, {
    kind: 'SYSTEM_ROLL',
    requestId: pending.request.requestId,
    rollId: rolled.evidenceRoll.rollId
  })
}

async function resolveInitiative(
  base: Awaited<ReturnType<typeof turnActiveEffectFixture>>,
  input: unknown
) {
  const result = encounterCommandResultDtoSchema.parse(input)
  const pending = result.occurrence?.pending
  if (!pending || pending.kind !== 'INITIATIVE_EVIDENCE')
    throw new Error('Expected initiative before incoming turn effects.')
  return executeInRoom(
    base.owner.caller,
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
  if (!occurrence) throw new Error('Expected a retained turn-effect continuation.')
  const pending = await base.t.run((ctx) =>
    readPendingSnapshot({ db: createConvexEncounterStoreReader(ctx) }, occurrence)
  )
  expect(pending?.applicationContext).toMatchObject({
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
const liveTurnEnvironment = workerEnvironment(liveTurnSecret)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('private DO turn active-effect terminal', () => {
  it('commits outgoing and incoming Character effects atomically with native lifecycle parity and exact replay', async () => {
    const turn = await liveCharacterTurn('AUTO_ROLL')
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
      const result = await callLiveSessionRoute(
        liveTurnEnvironment,
        'fixture-access-token',
        'encounterTurnCommit',
        planned.terminal
      )
      expect(result.projection).toMatchObject({
        ...planned.prepared.root.proposedTerminalTransition,
        version: before.run!.version + 1
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
      expect(characterAfter.play.streamVersion).toBe(characterBefore.play.streamVersion + 2)
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
        await callLiveSessionRoute(
          liveTurnEnvironment,
          'fixture-access-token',
          'encounterTurnCommit',
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
    const result = await callLiveSessionRoute(
      liveTurnEnvironment,
      'fixture-access-token',
      'encounterTurnCommit',
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
      await callLiveSessionRoute(
        liveTurnEnvironment,
        'fixture-access-token',
        'encounterTurnCommit',
        planned.terminal
      )
    ).toEqual(result)
    expect(await stored(base)).toEqual(after)
  }, 60_000)

  it('resolves private ASSISTED turn-effect evidence and commits its retained root exactly once', async () => {
    const turn = await liveCharacterTurn('PROMPT', 'ENCOUNTER_START')
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
    const issued = await callLiveSessionRoute(
      liveTurnEnvironment,
      'fixture-access-token',
      'encounterTurnPending',
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
        rawFaces: [1],
        rollMode: evidence.request.rollMode
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
    const result = await callLiveSessionRoute(
      liveTurnEnvironment,
      'fixture-access-token',
      'encounterTurnCommit',
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
      await callLiveSessionRoute(
        liveTurnEnvironment,
        'fixture-access-token',
        'encounterTurnCommit',
        resumed.terminal
      )
    ).toEqual(result)
    expect(await stored(base)).toEqual(after)
  }, 60_000)
})

async function liveCharacterTurn(
  mode: FixtureRolls | 'MANUAL',
  cadence: 'EACH_ROUND' | 'ENCOUNTER_START' = 'EACH_ROUND'
) {
  const fixture = await turnCharacterEffectFixture()
  // The GM rolls turn steps; the Character's player rolls its turn-effect saves.
  if (mode === 'PROMPT')
    for (const userId of [fixture.owner.userId, fixture.player.userId])
      await setAutoRollDice(fixture.t, userId, false)
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
    automationMode: mode === 'MANUAL' ? 'MANUAL' : 'ASSISTED',
    initiativePolicyDefinitionId: initiative.policyIds[0]!,
    initiativeTieDefinitionId: null
  })
  const created = await fixture.owner.caller.mutation(createRun, {
    campaignId: fixture.campaign.id,
    blueprintId: fixture.run.blueprintId,
    commandId: crypto.randomUUID()
  })
  const opponent = created.actors.find((actor) => actor.kind === 'CUSTOM')
  if (!opponent) throw new Error('Expected the fixture opponent.')
  const removed = await executeInRoom(fixture.owner.caller, {
    command: {
      type: 'REMOVE_ACTOR',
      encounterId: created.id,
      commandId: crypto.randomUUID(),
      expectedVersion: created.version,
      actorId: opponent.id
    }
  })
  const base = { ...fixture, run: encounterGmProjectionDtoSchema.parse(removed.projection) }
  let started = await executeInRoom(base.owner.caller, {
    command: {
      type: 'START',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.run.version
    }
  })
  if (mode === 'PROMPT') started = await resolveInitiative(base, started)
  if (started.projection.status !== 'ACTIVE') throw new Error('Expected an active Character Run.')
  const epoch = crypto.randomUUID()
  await base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: base.campaign.id,
      epoch,
      createdAt: base.campaign.createdAt
    })
  )
  const scope: Omit<LiveSessionEncounterRulesInput, 'request'> = {
    campaignId: base.campaign.id,
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
  stubLiveSessionFetch((pathname, init) => {
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
}

async function liveTurnRuntime() {
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
    for (const userId of [fixture.owner.userId, fixture.player.userId])
      await setAutoRollDice(fixture.t, userId, false)
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
      blueprintId: fixture.run.blueprintId,
      commandId: crypto.randomUUID()
    })
    const opponent = created.actors.find((actor) => actor.kind === 'CUSTOM')
    if (!opponent) throw new Error('Expected the fixture opponent.')
    const removed = await executeInRoom(fixture.owner.caller, {
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
    const starting = await executeInRoom(base.owner.caller, {
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
    const pendingOutgoing = await executeInRoom(base.owner.caller, advance)
    unchangedMechanics(before, await pendingEffect(base, effect.id, 'END_OF_TURN'))
    const pendingInitiative = await executeInRoom(
      base.owner.caller,
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
    expect(characterAfter.play.streamVersion).toBe(characterBefore.play.streamVersion + 1)
    expect(
      characterAuthoredDtoSchema.parse(readCharacterRecord(characterAfter)).state.hitpoints.current
    ).toBe(actor.currentHitPoints - 1)
    expect(terminal.characterEffects).toEqual([])
    expect(terminal.characterReceipts).toHaveLength(before.characterReceipts.length + 1)
    await expect(replayInRoom(base.owner.caller, advance)).resolves.toEqual(completed)
    expect(await stored(base)).toEqual(terminal)
  }, 30000)

  it('redacts accepted Character declaration replay while its controller sees the incoming turn-effect save', async () => {
    const base = await turnCharacterEffectFixture()
    for (const userId of [base.owner.userId, base.player.userId])
      await setAutoRollDice(base.t, userId, false)
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
    const issued = await executeInRoom(base.owner.caller, start)
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
    const accepted = await executeInRoom(base.player.caller, declarationCommand)
    expect(encounterPlayerProjectionDtoSchema.safeParse(accepted.projection).success).toBe(true)
    expect(accepted.occurrence?.pending).toBeNull()
    const gmInitiative = await executeInRoom(base.owner.caller, start)
    const pendingIncoming = await resolveInitiative(base, gmInitiative)
    const paused = await pendingEffect(base, effect.id, 'START_OF_TURN')
    unchangedMechanics(before, paused)
    // The save belongs to the player's Character, so its controller sees and may answer it.
    const playerPending = await base.player.caller.query(
      api.encounters.pendingReads.pendingRuleOccurrence,
      { encounterId: base.run.id }
    )
    expect(playerPending).toMatchObject({
      kind: 'D20_EVIDENCE',
      rollerActorId: actor.id,
      occurrenceId: pendingIncoming.occurrence?.occurrenceId
    })
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
      occurrence: pendingIncoming.occurrence && {
        ...pendingIncoming.occurrence,
        pending: playerPending
      }
    }
    const replay = await executeInRoom(base.player.caller, declarationCommand)
    expect(replay).toEqual(expectedReplay)
    expect(replay.projection.actors.every((entry) => !('currentHitPoints' in entry))).toBe(true)
    await expect(replayInRoom(base.player.caller, declarationCommand)).resolves.toEqual(
      expectedReplay
    )
    const dice = diceResponse(base.run.id, pendingIncoming)
    expect(await stored(base)).toEqual(paused)
    // The GM may answer any prompt, including the player's save.
    const settled = await executeInRoom(base.owner.caller, dice)
    expect(settled.occurrence?.status).toBe('COMPLETE')
    const terminal = await stored(base)
    const characterBefore = before.characters[0]
    const characterAfter = terminal.characters[0]
    if (!characterBefore || !characterAfter)
      throw new Error('Expected the authoritative Character rows.')
    expect(characterAfter.play.streamVersion).toBe(characterBefore.play.streamVersion + 1)
    expect(
      characterAuthoredDtoSchema.parse(readCharacterRecord(characterAfter)).state.hitpoints.current
    ).toBe(actor.currentHitPoints - 1)
    expect(
      encounterGmProjectionDtoSchema.parse(settled.projection).actors[0]!.currentHitPoints
    ).toBe(actor.currentHitPoints - 1)
    expect(terminal.characterEffects).toEqual([])
    expect(terminal.characterReceipts).toHaveLength(before.characterReceipts.length + 1)
    const terminalReplay = await replayInRoom(base.player.caller, declarationCommand)
    expect(terminalReplay.occurrence?.pending).toBeNull()
    expect(encounterPlayerProjectionDtoSchema.safeParse(terminalReplay.projection).success).toBe(
      true
    )
    await expect(replayInRoom(base.player.caller, declarationCommand)).resolves.toEqual(
      terminalReplay
    )
    expect(await stored(base)).toEqual(terminal)
  }, 30000)

  it('replays an accepted initiative declaration while START awaits incoming effect dice', async () => {
    const base = await turnActiveEffectFixture('PROMPT', 'DECLARED_ACTION_ROLL')
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
    const pendingDeclaration = await executeInRoom(base.owner.caller, start)
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
    const pendingInitiative = await executeInRoom(base.owner.caller, acceptedDeclaration)
    const pendingIncoming = await resolveInitiative(base, pendingInitiative)
    const paused = await pendingEffect(base, effect.id, 'START_OF_TURN')
    unchangedMechanics(before, paused)
    await expect(replayInRoom(base.owner.caller, acceptedDeclaration)).resolves.toEqual(
      pendingIncoming
    )
    await expect(replayInRoom(base.owner.caller, start)).resolves.toEqual(pendingIncoming)
    expect(await stored(base)).toEqual(paused)
    expect(
      await base.other.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).toBeNull()
    const settled = await executeInRoom(
      base.owner.caller,
      diceResponse(base.run.id, pendingIncoming)
    )
    expect(settled.occurrence?.status).toBe('COMPLETE')
    expect(
      encounterGmProjectionDtoSchema.parse(settled.projection).actors[0]!.currentHitPoints
    ).toBe(base.run.actors[0]!.currentHitPoints - 1)
    const terminal = await stored(base)
    expect(terminal.effects).toEqual([])
    await expect(replayInRoom(base.owner.caller, acceptedDeclaration)).resolves.toEqual(settled)
    expect(await stored(base)).toEqual(terminal)
  }, 30000)

  it('START rolls incoming effects, updates and expires their lifecycles, and exactly replays without writes or dice', async () => {
    const base = await turnActiveEffectFixture('AUTO_ROLL')
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
      const result = await executeInRoom(base.owner.caller, start)
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
      await expect(replayInRoom(base.owner.caller, start)).resolves.toEqual(result)
      expect(entropy).not.toHaveBeenCalled()
      expect(await stored(base)).toEqual(terminal)
    } finally {
      entropy.mockRestore()
    }
  }, 30000)

  it('ADVANCE_TURN applies outgoing then incoming effects to the same actor across the round boundary', async () => {
    const base = await turnActiveEffectFixture('AUTO_ROLL')
    const started = await executeInRoom(base.owner.caller, {
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
    const result = await executeInRoom(base.owner.caller, advance)
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
    await expect(replayInRoom(base.owner.caller, advance)).resolves.toEqual(result)
    expect(await stored(base)).toEqual(terminal)
  }, 30000)

  it('retains outgoing effects through initiative, Recharge, and incoming dice; only terminal completion publishes the whole turn', async () => {
    const base = await turnActiveEffectFixture('PROMPT')
    const starting = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    const started = await resolveInitiative(base, starting)
    expect(started.occurrence?.status).toBe('COMPLETE')
    const spent = await executeInRoom(base.owner.caller, {
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
    const pendingOutgoing = await executeInRoom(base.owner.caller, advance)
    unchangedMechanics(before, await pendingEffect(base, outgoing.id, 'END_OF_TURN'))
    const outgoingResponse = diceResponse(base.run.id, pendingOutgoing)
    const pendingInitiative = await executeInRoom(base.owner.caller, outgoingResponse)
    expect(pendingInitiative.occurrence?.pending?.kind).toBe('INITIATIVE_EVIDENCE')
    unchangedMechanics(before, await stored(base))
    await expect(replayInRoom(base.owner.caller, outgoingResponse)).resolves.toEqual(
      pendingInitiative
    )
    const retainedInitiative = await stored(base)
    await expect(
      executeInRoom(base.owner.caller, {
        command: { ...outgoingResponse.command, correlationId: crypto.randomUUID() }
      })
    ).rejects.toThrow(LiveSessionRouteError)
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
    const pendingIncoming = await executeInRoom(base.owner.caller, rechargeResponse)
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
    const entropy = vi.spyOn(crypto, 'getRandomValues').mockImplementation((values) => {
      ;(values as Uint32Array)[0] = 0
      return values
    })
    try {
      const terminalResponse = await appRollResponse(base, pendingIncoming)
      const result = await executeInRoom(base.owner.caller, terminalResponse)
      expect(result).toMatchObject({
        projection: { round: 2, version: spent.projection.version + 1 },
        occurrence: { status: 'COMPLETE', pending: null }
      })
      const terminal = await stored(base)
      const actor = encounterRunActorStateSchema.parse(JSON.parse(terminal.actors[0]!.stateJson))
      if (actor.kind === 'CHARACTER') throw new Error('Expected a non-Character fixture actor.')
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
      await expect(replayInRoom(base.owner.caller, terminalResponse)).resolves.toEqual(result)
      await expect(replayInRoom(base.owner.caller, advance)).resolves.toEqual(result)
      expect(entropy).not.toHaveBeenCalled()
      expect(await stored(base)).toEqual(terminal)
    } finally {
      entropy.mockRestore()
    }
  }, 30000)

  it('START retains the first effect while the second awaits dice and rejects stale retained lifecycle without writes', async () => {
    const base = await turnActiveEffectFixture('PROMPT')
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
    const start = await executeInRoom(base.owner.caller, {
      command: {
        type: 'START',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.run.version
      }
    })
    const pendingFirst = await resolveInitiative(base, start)
    const firstResponse = diceResponse(base.run.id, pendingFirst)
    const pendingSecond = await executeInRoom(base.owner.caller, firstResponse)
    const paused = await pendingEffect(base, second.id, 'START_OF_TURN')
    unchangedMechanics(before, paused)
    await expect(replayInRoom(base.owner.caller, firstResponse)).resolves.toEqual(pendingSecond)
    expect(await stored(base)).toEqual(paused)
    await base.t.run((ctx) =>
      createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).updateLifecycleCas({
        id: first.id,
        owner: first.owner,
        expectedVersion: first.version,
        lifecycle: { schemaVersion: 1, remainingTicks: 1 }
      })
    )
    const stale = await stored(base)
    const final = await appRollResponse(base, pendingSecond)
    const entropy = vi.spyOn(crypto, 'getRandomValues')
    try {
      await expect(executeInRoom(base.owner.caller, final)).rejects.toThrow()
      expect(entropy).not.toHaveBeenCalled()
      expect(await stored(base)).toEqual(stale)
    } finally {
      entropy.mockRestore()
    }
  }, 30000)

  it('rejects player evidence, wrong requests, stale target/source and rolls back an induced terminal failure', async () => {
    const base = await turnActiveEffectFixture('PROMPT')
    const effect = await seedTurnSaveEffect(base, {
      stage: 'START_OF_TURN',
      ticks: 1,
      damage: 1
    })
    const start = await executeInRoom(base.owner.caller, {
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
    expect(
      await base.other.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).toBeNull()
    await expect(executeInRoom(base.other.caller, final)).rejects.toThrow()
    const wrongRequest: EncounterExecuteInput = {
      command: {
        ...final.command,
        commandId: crypto.randomUUID(),
        resolution: {
          kind: 'ENTER_DICE',
          requestId: crypto.randomUUID(),
          rawFaces: [1],
          rollMode: 'NORMAL'
        }
      }
    }
    await expect(executeInRoom(base.owner.caller, wrongRequest)).rejects.toThrow()
    expect(await stored(base)).toEqual(before)
    const actorRow = before.actors[0]!
    const actor = encounterRunActorStateSchema.parse(JSON.parse(actorRow.stateJson))
    if (actor.kind === 'CHARACTER') throw new Error('Expected a non-Character fixture actor.')
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
    await expect(executeInRoom(base.owner.caller, final)).rejects.toThrow()
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
    await expect(executeInRoom(base.owner.caller, final)).rejects.toThrow()
    expect(await stored(base)).toEqual(staleSource)
  }, 30000)
})
