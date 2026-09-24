// @vitest-environment node
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
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import {
  liveSessionEncounterTurnPendingInputSchema,
  type LiveSessionEncounterTurnCommitInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterTurn'
import { createPlatformRulesRuntime } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
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
import {
  commitNativeLiveEncounterTurn,
  commitNativeLiveEncounterTurnPending
} from '../../../session-worker/src/nativeEncounterTurnCommit'

const workerSecret = 'private-start-worker-test-secret-at-least-32-bytes'
const authSecret = 'private-start-continuation-test-secret-at-least-32-bytes'
const environment = {
  CONVEX_SITE_URL: 'https://convex.example.test',
  LIVE_SESSION_WORKER_SECRET: workerSecret
}
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
const commitTurn = makeFunctionReference<
  'mutation',
  LiveSessionEncounterTurnCommitInput,
  EncounterCommandResultDto
>('liveSessions/encounterTurnCommit:commit')
const getSettings = makeFunctionReference<'query', { campaignId: string }, CampaignPlaySettingsDto>(
  'campaigns/playSettings:get'
)
const saveSettings = makeFunctionReference<
  'mutation',
  SaveCampaignPlaySettingsInput,
  CampaignPlaySettingsDto
>('campaigns/playSettings:save')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

async function preparedRun(mode: 'MANUAL' | 'ASSISTED') {
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
    name: 'Private START fixture',
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
    automationMode: mode,
    manualReminderMode: 'OFF',
    initiativePolicyDefinitionId: mode === 'MANUAL' ? null : initiative.policyIds[0]!,
    initiativeTieDefinitionId: null
  })
  const session = await base.owner.caller.mutation(createSession, { campaignId: campaign.id })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Private START actors',
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
  const epoch = crypto.randomUUID()
  await base.t.run((ctx) =>
    ctx.db.insert('campaignLiveAuthorities', {
      campaignId: campaign.id,
      sessionId: session.id,
      epoch,
      phase: 'DO_ACTIVE',
      activationFingerprint: '0'.repeat(64),
      persistedSequence: 0,
      persistedStateChecksum: '0'.repeat(64),
      createdAt: campaign.createdAt,
      updatedAt: campaign.createdAt
    })
  )
  const scope: Omit<LiveSessionEncounterRulesInput, 'request'> = {
    campaignId: campaign.id,
    sessionId: session.id,
    authorityEpoch: epoch,
    expectedUserId: base.owner.userId,
    expectedRole: 'OWNER',
    encounterId: run.id,
    expectedVersion: run.version
  }
  const command = {
    type: 'START' as const,
    encounterId: run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: run.version,
    ...(mode === 'MANUAL' ? { systemId: srdSystemRecord.id } : {})
  }
  vi.stubEnv('BETTER_AUTH_SECRET', authSecret)
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', workerSecret)
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const pathname = new URL(url instanceof Request ? url.url : url.toString()).pathname
      if (
        ![
          '/live-sessions/encounter-rules',
          '/live-sessions/encounter-turn',
          '/live-sessions/encounter-turn-pending'
        ].includes(pathname)
      )
        throw new Error(`Unexpected private START request: ${pathname}`)
      if (typeof init?.body !== 'string') throw new Error('Private START body is missing.')
      if (pathname === '/live-sessions/encounter-rules')
        liveSessionEncounterRulesInputSchema.parse(JSON.parse(init.body))
      return base.owner.caller.fetch(pathname, init)
    })
  )
  const runtime = createPlatformRulesRuntime({
    continuationIntegrityKey: new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(
          `artificer-toolkit:session-host:rules-continuation:v1\0${authSecret}`
        )
      )
    ),
    definitions: {
      async requireCurrent() {
        throw new Error('START graphs must use captured definitions.')
      }
    }
  })
  const state = () =>
    base.t.run(async (ctx) => ({
      run: await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', run.id))
        .unique(),
      actors: await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id))
        .collect(),
      rounds: await ctx.db
        .query('encounterInitiativeRounds')
        .withIndex('by_encounterId_round', (q) => q.eq('encounterId', run.id))
        .collect(),
      participants: await ctx.db
        .query('encounterInitiativeParticipants')
        .withIndex('by_encounterId_round_actorId', (q) => q.eq('encounterId', run.id))
        .collect(),
      commands: await ctx.db
        .query('encounterRunCommands')
        .withIndex('by_campaignId_commandId', (q) =>
          q.eq('campaignId', campaign.id).eq('commandId', command.commandId)
        )
        .collect(),
      occurrences: await ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_campaignId_rootCommandId', (q) =>
          q.eq('campaignId', campaign.id).eq('rootCommandId', command.commandId)
        )
        .collect(),
      receipts: await ctx.db
        .query('encounterRuleReceipts')
        .withIndex('by_encounterId_commandId', (q) =>
          q.eq('encounterId', run.id).eq('commandId', command.commandId)
        )
        .collect()
    }))
  return { base, scope, command, runtime, state }
}

it('prepares an initial Manual turn without publishing its Run', async () => {
  const value = await preparedRun('MANUAL')
  const before = await value.state()
  const plan = await planNativeLiveEncounterTurn(
    environment,
    'fixture-access-token',
    value.scope,
    value.command,
    { runtime: value.runtime, random: () => 0 }
  )
  if (plan.kind !== 'PLANNED' || plan.prepared.kind !== 'COMPLETE' || !plan.terminal)
    throw new Error('Expected immediate Manual START preparation.')
  const terminal = plan.terminal
  expect(plan.prepared.root.initiative).toMatchObject({ round: 1, procedure: 'MANUAL' })
  expect(plan.prepared.root.startSystemId).toBe(srdSystemRecord.id)
  expect(plan.prepared.root.stagedInitiative?.beforePin).toMatchObject({ kind: 'INITIAL_START' })
  expect(terminal.root.proposedTerminalTransition).toMatchObject({
    status: 'ACTIVE',
    round: 1,
    currentActorId: plan.prepared.root.initiative?.orderedActorIds[0]
  })
  expect(await value.state()).toEqual(before)
  if (!terminal.root.initiative || !terminal.root.stagedInitiative)
    throw new Error('Expected complete initial initiative settlement.')
  const altered = {
    ...terminal,
    root: {
      ...terminal.root,
      initiative: { ...terminal.root.initiative, round: 2 },
      stagedInitiative: {
        ...terminal.root.stagedInitiative,
        stagedRoundState: {
          ...terminal.root.stagedInitiative.stagedRoundState,
          round: { ...terminal.root.stagedInitiative.stagedRoundState.round, round: 2 },
          participants: terminal.root.stagedInitiative.stagedRoundState.participants.map(
            (participant) => ({ ...participant, round: 2 })
          )
        }
      },
      proposedTerminalTransition: {
        ...terminal.root.proposedTerminalTransition,
        round: 2
      }
    }
  }
  const rejected = await value.base.owner.caller.fetch('/live-sessions/encounter-turn', {
    method: 'POST',
    headers: { 'x-artificer-live-session-secret': workerSecret },
    body: JSON.stringify(altered)
  })
  expect(rejected.status).toBe(409)
  expect(await value.state()).toEqual(before)
  await expect(
    value.base.owner.caller.run(async (ctx) => {
      await ctx.runMutation(commitTurn, terminal)
      throw new Error('Roll back complete initial START.')
    })
  ).rejects.toThrow('Roll back complete initial START.')
  expect(await value.state()).toEqual(before)
  const committed = await commitNativeLiveEncounterTurn(
    environment,
    'fixture-access-token',
    terminal
  )
  expect(committed.projection).toMatchObject({
    status: 'ACTIVE',
    round: 1,
    version: value.command.expectedVersion + 1,
    currentActorId: plan.prepared.root.initiative?.orderedActorIds[0]
  })
  const after = await value.state()
  expect(after.rounds).toHaveLength(1)
  expect(after.participants).toHaveLength(before.actors.length)
  expect(after.commands).toHaveLength(1)
  expect(after.receipts).toHaveLength(1)
  expect(
    await commitNativeLiveEncounterTurn(environment, 'fixture-access-token', terminal)
  ).toEqual(committed)
  expect(await value.state()).toEqual(after)
}, 60_000)

it('prepares initial Assisted initiative evidence without advancing the Run', async () => {
  const value = await preparedRun('ASSISTED')
  const before = await value.state()
  const plan = await planNativeLiveEncounterTurn(
    environment,
    'fixture-access-token',
    value.scope,
    value.command,
    { runtime: value.runtime, random: () => 0 }
  )
  if (plan.kind !== 'PLANNED' || plan.prepared.kind !== 'PENDING')
    throw new Error('Expected initial Assisted initiative evidence.')
  expect(plan.prepared.snapshot).toMatchObject({
    snapshotKind: 'KERNEL_EVIDENCE',
    applicationContext: {
      kind: 'ENCOUNTER_INITIATIVE',
      root: { commandType: 'START', initiativeBeforePin: { kind: 'INITIAL_START' } }
    }
  })
  expect(plan.terminal).toBeNull()
  expect(plan.revisions.length).toBeGreaterThan(0)
  expect(await value.state()).toEqual(before)
  const snapshot = plan.prepared.snapshot
  if (snapshot.applicationContext.kind !== 'ENCOUNTER_INITIATIVE')
    throw new Error('Expected initial initiative context.')
  const pendingInput = liveSessionEncounterTurnPendingInputSchema.parse({
    ...value.scope,
    command: value.command,
    revisions: plan.revisions,
    scenes: plan.scenes,
    snapshot
  })
  const participants = snapshot.applicationContext.root.stagedInitiativeRoundState.participants
  const altered = {
    ...pendingInput,
    snapshot: {
      ...snapshot,
      applicationContext: {
        ...snapshot.applicationContext,
        root: {
          ...snapshot.applicationContext.root,
          stagedInitiativeRoundState: {
            ...snapshot.applicationContext.root.stagedInitiativeRoundState,
            participants: participants.map((participant, index) =>
              index === 0 ? { ...participant, actorId: crypto.randomUUID() } : participant
            )
          }
        }
      }
    }
  }
  const rejected = await value.base.owner.caller.fetch('/live-sessions/encounter-turn-pending', {
    method: 'POST',
    headers: { 'x-artificer-live-session-secret': workerSecret },
    body: JSON.stringify(altered)
  })
  expect(rejected.status).toBe(409)
  expect(await value.state()).toEqual(before)
  const committed = await commitNativeLiveEncounterTurnPending(
    environment,
    'fixture-access-token',
    pendingInput
  )
  expect(committed.projection).toMatchObject({
    status: 'PREPARED',
    version: value.command.expectedVersion
  })
  expect(committed.occurrence?.pending?.kind).toBe('INITIATIVE_EVIDENCE')
  const after = await value.state()
  expect(after.run?.version).toBe(before.run?.version)
  expect(after.actors).toEqual(before.actors)
  expect(after.rounds).toEqual(before.rounds)
  expect(after.participants).toEqual(before.participants)
  expect(
    await commitNativeLiveEncounterTurnPending(environment, 'fixture-access-token', pendingInput)
  ).toEqual(committed)
  expect(await value.state()).toEqual(after)
  let current = committed
  let integerResponses = 0
  let orderResponses = 0
  let completed = false
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const pending = current.occurrence?.pending
    if (!pending || (pending.kind !== 'INITIATIVE_EVIDENCE' && pending.kind !== 'INITIATIVE_ORDER'))
      throw new Error('Expected private initiative response evidence.')
    const response = {
      type: 'RESOLVE_RULE_OCCURRENCE' as const,
      encounterId: value.command.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: value.command.expectedVersion,
      occurrenceId: current.occurrence!.occurrenceId,
      expectedOccurrenceVersion: current.occurrence!.occurrenceVersion,
      correlationId: null,
      resolution:
        pending.kind === 'INITIATIVE_EVIDENCE'
          ? { kind: 'ENTER_INTEGER' as const, requestId: pending.request.requestId, value: 20 }
          : {
              kind: 'INITIATIVE_ENTITY' as const,
              requestId: pending.requestId,
              entityId: pending.optionIds[0]!
            }
    }
    if (pending.kind === 'INITIATIVE_EVIDENCE') integerResponses += 1
    else orderResponses += 1
    const continued = await planNativeLiveEncounterTurn(
      environment,
      'fixture-access-token',
      value.scope,
      response,
      {
        runtime: value.runtime,
        random: () => {
          throw new Error('Entered initiative evidence must not reroll.')
        }
      }
    )
    if (continued.kind !== 'PLANNED') throw new Error('Expected planned initiative response.')
    if (continued.prepared.kind === 'PENDING') {
      const input = liveSessionEncounterTurnPendingInputSchema.parse({
        ...value.scope,
        command: response,
        revisions: continued.revisions,
        scenes: continued.scenes,
        snapshot: continued.prepared.snapshot
      })
      current = await commitNativeLiveEncounterTurnPending(
        environment,
        'fixture-access-token',
        input
      )
      expect(
        await commitNativeLiveEncounterTurnPending(environment, 'fixture-access-token', input)
      ).toEqual(current)
      expect(current.projection).toMatchObject({
        status: 'PREPARED',
        version: value.command.expectedVersion
      })
      continue
    }
    if (!continued.terminal) throw new Error('Expected complete initiative terminal.')
    current = await commitNativeLiveEncounterTurn(
      environment,
      'fixture-access-token',
      continued.terminal
    )
    expect(
      await commitNativeLiveEncounterTurn(environment, 'fixture-access-token', continued.terminal)
    ).toEqual(current)
    completed = true
    break
  }
  expect(completed).toBe(true)
  expect(integerResponses).toBe(4)
  expect(orderResponses).toBe(1)
  expect(current.projection).toMatchObject({
    status: 'ACTIVE',
    round: 1,
    version: value.command.expectedVersion + 1
  })
  const final = await value.state()
  expect(final.rounds).toHaveLength(1)
  expect(final.participants).toHaveLength(before.actors.length)
  expect(final.commands).toHaveLength(1)
  expect(final.receipts).toHaveLength(1)
}, 120_000)
