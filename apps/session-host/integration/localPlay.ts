import assert from 'node:assert/strict'
import { createServer as createNetServer } from 'node:net'
import { randomUUID } from 'node:crypto'

import { Client } from '@colyseus/sdk'
import { createClient } from '@supabase/supabase-js'
import {
  createCampaignRepository,
  createCharacterRepository,
  createCreatureRepository,
  createEncounterRepository,
  createDb
} from '@artificer-toolkit/db'
import {
  assignCampaignCharacter,
  createCampaign,
  createCampaignSession,
  createEncounter,
  createEncounterTemplate,
  dispatchCommandForUser,
  executeEncounterCommand,
  deleteCampaign,
  getCampaign
} from '@artificer-toolkit/functions/services'
import {
  LIVE_SESSION_COMMAND_MESSAGE,
  LIVE_SESSION_COMMITTED_MESSAGE,
  LIVE_SESSION_READY_MESSAGE,
  LIVE_SESSION_REJECTED_MESSAGE,
  LIVE_SESSION_RESULT_MESSAGE,
  LIVE_SESSION_ROOM_NAME,
  liveSessionCommittedDtoSchema,
  liveSessionReadyDtoSchema,
  liveSessionRejectedDtoSchema,
  liveSessionResultDtoSchema,
  type LiveSessionCommandDto,
  type LiveSessionJoinOptionsDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { z, type ZodType } from 'zod'

import {
  findFixtureCatalog,
  requireLocalDatabaseUrl,
  type BuilderResolutionTiming,
  type CharacterLifecycleFixture,
  type CharacterRuleEvaluationTiming,
  type SheetReadTiming
} from '../../../packages/functions/src/scripts/characterLifecycleIntegrationFixtures.js'
import { proveFixtureLifecycle } from '../../../packages/functions/src/scripts/characterLifecycleIntegrationBuilderProof.js'
import { createSessionHostServer } from '../src/app.js'
import {
  createLiveSessionRoomDependencies,
  type LiveSessionCharacterCommandTiming,
  type LiveSessionEncounterCommandTiming
} from '../src/dependencies.js'
import type { LiveSessionState } from '../src/liveSessionRoom.js'

const MESSAGE_TIMEOUT_MS = 15_000
const WARM_COMMAND_P95_LIMIT_MS = 500

interface DisposableUser {
  email: string
  id: string
  password: string
}

interface CommandMeasurement {
  commandId: string
  durationMs: number
  replayed: boolean
  streamVersion: number
}

function localSupabaseConfig() {
  const url = process.env.SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!url || !secretKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required.')
  }
  if (!url.includes('127.0.0.1') && !url.includes('localhost')) {
    throw new Error('The local live-session integration gate only runs against local Supabase.')
  }
  return { secretKey, url }
}

function externalSessionHostEndpoint(): string | null {
  const rawEndpoint = process.env.SESSION_HOST_INTEGRATION_ENDPOINT?.trim()
  if (!rawEndpoint) return null
  const endpoint = new URL(rawEndpoint)
  if (
    endpoint.protocol !== 'http:' ||
    (endpoint.hostname !== '127.0.0.1' && endpoint.hostname !== 'localhost')
  ) {
    throw new Error('SESSION_HOST_INTEGRATION_ENDPOINT must be a loopback HTTP endpoint.')
  }
  return endpoint.origin
}

function percentile(values: readonly number[], quantile: number): number {
  assert.ok(values.length > 0)
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.ceil(sorted.length * quantile) - 1] as number
}

async function availablePort(): Promise<number> {
  const server = createNetServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )
  return address.port
}

async function waitForLeaseRelease(
  db: ReturnType<typeof createDb>,
  sessionId: string
): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const lease = await db
      .selectFrom('live_session_command_leases')
      .select('session_id')
      .where('session_id', '=', sessionId)
      .executeTakeFirst()
    if (!lease) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert.fail('The live-session command authority lease was not released with the room.')
}

async function createDisposableUser(
  admin: ReturnType<typeof createClient>['auth']['admin'],
  runId: string,
  role: 'gm' | 'player'
): Promise<DisposableUser> {
  const password = `Local-${randomUUID()}-Aa1!`
  const email = `live-session-${role}-${runId}@example.test`
  const username = `live${role}${runId.replaceAll('-', '').slice(0, 12)}`
  const { data, error } = await admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: { username }
  })
  if (error) throw error
  if (!data.user) throw new Error(`Supabase did not create the ${role} integration user.`)
  return { email, id: data.user.id, password }
}

async function accessToken(url: string, secretKey: string, user: DisposableUser): Promise<string> {
  const client = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false }
  })
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password
  })
  if (error) throw error
  if (!data.session?.access_token) throw new Error('Supabase did not return an access token.')
  return data.session.access_token
}

async function joinLiveRoom(endpoint: string, token: string, options: LiveSessionJoinOptionsDto) {
  const client = new Client(endpoint)
  client.auth.token = token
  const startedAt = performance.now()
  const room = await client.joinOrCreate<LiveSessionState>(LIVE_SESSION_ROOM_NAME, options)
  return { durationMs: performance.now() - startedAt, room }
}

type LocalLiveRoom = Awaited<ReturnType<typeof joinLiveRoom>>['room']

function waitForMessage<T>(
  room: LocalLiveRoom,
  type: string,
  schema: ZodType<T>,
  predicate: (message: T) => boolean = () => true
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let unsubscribe: () => void = () => undefined
    const timer = setTimeout(() => {
      unsubscribe()
      reject(new Error(`Timed out waiting for live-session message "${type}".`))
    }, MESSAGE_TIMEOUT_MS)
    unsubscribe = room.onMessage(type, (raw: unknown) => {
      const parsed = schema.safeParse(raw)
      if (!parsed.success) {
        clearTimeout(timer)
        unsubscribe()
        reject(parsed.error)
        return
      }
      if (!predicate(parsed.data)) return
      clearTimeout(timer)
      unsubscribe()
      resolve(parsed.data)
    })
  })
}

function waitForCommandOutcome(
  room: LocalLiveRoom,
  commandId: string
): Promise<z.infer<typeof liveSessionResultDtoSchema>> {
  return new Promise((resolve, reject) => {
    let unsubscribeResult: () => void = () => undefined
    let unsubscribeRejected: () => void = () => undefined
    const cleanup = () => {
      clearTimeout(timer)
      unsubscribeResult()
      unsubscribeRejected()
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out waiting for command "${commandId}".`))
    }, MESSAGE_TIMEOUT_MS)
    unsubscribeResult = room.onMessage(LIVE_SESSION_RESULT_MESSAGE, (raw: unknown) => {
      const parsed = liveSessionResultDtoSchema.safeParse(raw)
      if (!parsed.success) {
        cleanup()
        reject(parsed.error)
        return
      }
      if (parsed.data.commandId !== commandId) return
      cleanup()
      resolve(parsed.data)
    })
    unsubscribeRejected = room.onMessage(LIVE_SESSION_REJECTED_MESSAGE, (raw: unknown) => {
      const parsed = liveSessionRejectedDtoSchema.safeParse(raw)
      if (!parsed.success) {
        cleanup()
        reject(parsed.error)
        return
      }
      if (parsed.data.commandId !== commandId) return
      cleanup()
      reject(new Error(`${parsed.data.code}: ${parsed.data.message}`))
    })
  })
}

async function waitForAggregateVersion(
  room: LocalLiveRoom,
  aggregateKey: string,
  version: number
): Promise<void> {
  const deadline = Date.now() + MESSAGE_TIMEOUT_MS
  while (room.state?.aggregateVersions?.get(aggregateKey)?.version !== version) {
    if (Date.now() >= deadline) {
      throw new Error(`State did not reach ${aggregateKey} version ${version}.`)
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

async function sendCharacterCommand(
  room: LocalLiveRoom,
  observer: LocalLiveRoom,
  characterId: string,
  command: Extract<LiveSessionCommandDto, { aggregateKind: 'CHARACTER' }>['command'],
  expectCommit: boolean
): Promise<CommandMeasurement> {
  const outcome = waitForCommandOutcome(room, command.commandId)
  const committed = expectCommit
    ? Promise.all(
        [room, observer].map((target) =>
          waitForMessage(
            target,
            LIVE_SESSION_COMMITTED_MESSAGE,
            liveSessionCommittedDtoSchema,
            (message) => message.commandId === command.commandId
          )
        )
      )
    : null
  const startedAt = performance.now()
  room.send(LIVE_SESSION_COMMAND_MESSAGE, {
    aggregateKind: 'CHARACTER',
    characterId,
    command
  } satisfies LiveSessionCommandDto)
  const result = await outcome
  if (committed) await committed
  assert.equal(result.aggregateKind, 'CHARACTER')
  return {
    commandId: command.commandId,
    durationMs: performance.now() - startedAt,
    replayed: result.replayed,
    streamVersion: result.response.streamVersion
  }
}

async function sendEncounterCommand(
  room: LocalLiveRoom,
  observer: LocalLiveRoom,
  command: Extract<LiveSessionCommandDto, { aggregateKind: 'ENCOUNTER' }>['command']
): Promise<CommandMeasurement> {
  const outcome = waitForCommandOutcome(room, command.commandId)
  const committed = Promise.all(
    [room, observer].map((target) =>
      waitForMessage(
        target,
        LIVE_SESSION_COMMITTED_MESSAGE,
        liveSessionCommittedDtoSchema,
        (message) => message.commandId === command.commandId
      )
    )
  )
  const startedAt = performance.now()
  room.send(LIVE_SESSION_COMMAND_MESSAGE, {
    aggregateKind: 'ENCOUNTER',
    command
  } satisfies LiveSessionCommandDto)
  const result = await outcome
  await committed
  assert.equal(result.aggregateKind, 'ENCOUNTER')
  return {
    commandId: command.commandId,
    durationMs: performance.now() - startedAt,
    replayed: result.replayed,
    streamVersion: result.response.projection.version
  }
}

async function main(): Promise<void> {
  const connectionString = requireLocalDatabaseUrl()
  const { secretKey, url } = localSupabaseConfig()
  const db = createDb({ connectionString })
  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false }
  })
  const runId = randomUUID()
  const characterId = randomUUID()
  let campaignId: string | null = null
  let gm: DisposableUser | null = null
  let player: DisposableUser | null = null
  let sessionHost: ReturnType<typeof createSessionHostServer> | null = null
  let playerRoom: LocalLiveRoom | null = null
  let gmRoom: LocalLiveRoom | null = null
  let runError: unknown
  let cleanupError: unknown
  const captureCleanup = async (operation: () => Promise<unknown>) => {
    try {
      await operation()
    } catch (error) {
      cleanupError ??= error
    }
  }

  try {
    gm = await createDisposableUser(admin.auth.admin, runId, 'gm')
    player = await createDisposableUser(admin.auth.admin, runId, 'player')
    const catalog = await findFixtureCatalog(db)
    const fixture: CharacterLifecycleFixture = {
      ...catalog,
      userId: player.id,
      characterId,
      classes: [
        {
          classId: catalog.clericId,
          classLabel: 'Cleric',
          classLevel: 1,
          subclassId: catalog.lifeDomainId,
          subclassLabel: 'Life Domain'
        }
      ],
      expectedMaxHitPoints: 9,
      hitpointLevels: [{ level: 1, classId: catalog.clericId, classLevel: 1, value: 9 }],
      label: `Local Live Session ${runId}`,
      preparedCasterClassId: catalog.clericId,
      raceId: catalog.dragonbornId,
      raceLabel: 'Dragonborn'
    }
    const builderTimings: BuilderResolutionTiming[] = []
    const sheetTimings: SheetReadTiming[] = []
    const ruleTimings: CharacterRuleEvaluationTiming[] = []
    const commandTimings: LiveSessionCharacterCommandTiming[] = []
    const encounterCommandTimings: LiveSessionEncounterCommandTiming[] = []
    const initialSheet = await proveFixtureLifecycle(
      db,
      fixture,
      builderTimings,
      sheetTimings,
      ruleTimings
    )
    assert.equal(initialSheet.meta.streamVersion, 1)

    const campaign = await createCampaign(db, gm.id, {
      name: `Local live-session integration ${runId}`,
      format: 'ONE_SHOT',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD'
    })
    campaignId = campaign.id
    await createCampaignRepository(db).activatePlayerMembership(
      campaign.id,
      player.id,
      new Date().toISOString()
    )
    await assignCampaignCharacter(db, gm.id, campaign.id, characterId)
    const session = await createCampaignSession(
      db,
      { campaignId: campaign.id, title: 'Local integration session' },
      gm.id
    )
    const encounterCreature = (
      await createCreatureRepository(db).findAll({ userId: gm.id, includeMaster: true })
    ).find(
      (creature) =>
        creature.status === 'ACTIVE' &&
        (creature.features ?? []).some(
          (feature) =>
            feature.charges?.limitKind === 'FIXED_AMOUNT' &&
            feature.charges.scalingKind === 'NONE' &&
            feature.charges.amount > 0
        )
    )
    assert.ok(encounterCreature, 'The SRD fixture must include a fixed-use creature feature.')
    const encounterTemplate = await createEncounterTemplate(db, gm.id, {
      campaignId: campaign.id,
      name: `Local encounter ${runId}`,
      enemies: [{ kind: 'CREATURE', sourceId: encounterCreature.id }],
      commandId: randomUUID()
    })
    const encounter = await createEncounter(db, gm.id, {
      campaignId: campaign.id,
      sessionId: session.id,
      templateId: encounterTemplate.id,
      systemId: encounterCreature.systemId,
      commandId: randomUUID()
    })
    const encounterActor = encounter.actors.find((actor) => actor.sourceId === encounterCreature.id)
    const encounterFeature = encounterActor?.features.find(
      (feature) => feature.resource !== null && feature.resource.remaining > 0
    )
    assert.ok(encounterActor && encounterFeature)
    const options = { campaignId: campaign.id, sessionId: session.id }
    const [playerToken, gmToken] = await Promise.all([
      accessToken(url, secretKey, player),
      accessToken(url, secretKey, gm)
    ])

    const externalEndpoint = externalSessionHostEndpoint()
    let endpoint: string
    if (externalEndpoint) {
      endpoint = externalEndpoint
    } else {
      const port = await availablePort()
      sessionHost = createSessionHostServer(
        createLiveSessionRoomDependencies({
          onCharacterCommandTiming: (timing) => commandTimings.push(timing),
          onEncounterCommandTiming: (timing) => encounterCommandTimings.push(timing)
        })
      )
      await sessionHost.listen(port)
      endpoint = `http://127.0.0.1:${port}`
    }
    const health = await fetch(`${endpoint}/health`)
    assert.equal(health.status, 200)
    assert.deepEqual(await health.json(), {
      service: 'artificer-session-host',
      status: 'ok'
    })

    const playerJoin = await joinLiveRoom(endpoint, playerToken, options)
    playerRoom = playerJoin.room
    const gmJoin = await joinLiveRoom(endpoint, gmToken, options)
    gmRoom = gmJoin.room
    assert.equal(playerRoom.roomId, gmRoom.roomId)
    const aggregateKey = `CHARACTER:${characterId}`
    const encounterAggregateKey = `ENCOUNTER:${encounter.id}`
    await Promise.all([
      waitForAggregateVersion(playerRoom, aggregateKey, 1),
      waitForAggregateVersion(gmRoom, aggregateKey, 1),
      waitForAggregateVersion(playerRoom, encounterAggregateKey, encounter.version),
      waitForAggregateVersion(gmRoom, encounterAggregateKey, encounter.version)
    ])

    await assert.rejects(
      dispatchCommandForUser(
        db,
        characterId,
        {
          type: 'ADJUST_HIT_POINTS',
          mode: 'DAMAGE',
          amount: 1,
          commandId: randomUUID(),
          expectedVersion: 1
        },
        player.id
      ),
      (error: unknown) =>
        error instanceof Error && error.name === 'LiveSessionCommandAuthorityError'
    )
    await assert.rejects(
      executeEncounterCommand(db, gm.id, {
        type: 'ADJUST_FEATURE_RESOURCE',
        encounterId: encounter.id,
        actorId: encounterActor.id,
        featureId: encounterFeature.id,
        direction: 'USE',
        amount: 1,
        commandId: randomUUID(),
        expectedVersion: encounter.version
      }),
      (error: unknown) =>
        error instanceof Error && error.name === 'LiveSessionCommandAuthorityError'
    )

    const firstCommand = {
      type: 'ADJUST_HIT_POINTS' as const,
      mode: 'DAMAGE' as const,
      amount: 1,
      commandId: randomUUID(),
      expectedVersion: 1
    }
    const cold = await sendCharacterCommand(playerRoom, gmRoom, characterId, firstCommand, true)
    assert.equal(cold.streamVersion, 2)
    assert.equal(cold.replayed, false)
    assert.ok(
      cold.durationMs < WARM_COMMAND_P95_LIMIT_MS,
      `First local command ${cold.durationMs.toFixed(2)} ms exceeded ${WARM_COMMAND_P95_LIMIT_MS} ms.`
    )

    const replay = await sendCharacterCommand(playerRoom, gmRoom, characterId, firstCommand, false)
    assert.equal(replay.streamVersion, 2)
    assert.equal(replay.replayed, true)

    const warm: CommandMeasurement[] = []
    let expectedVersion = 2
    for (let index = 0; index < 8; index += 1) {
      const measurement = await sendCharacterCommand(
        playerRoom,
        gmRoom,
        characterId,
        {
          type: 'ADJUST_HIT_POINTS',
          mode: index % 2 === 0 ? 'HEAL' : 'DAMAGE',
          amount: 1,
          commandId: randomUUID(),
          expectedVersion
        },
        true
      )
      expectedVersion = measurement.streamVersion
      warm.push(measurement)
    }
    const warmP95Ms = percentile(
      warm.map(({ durationMs }) => durationMs),
      0.95
    )
    console.info(
      JSON.stringify({
        localLiveSessionCommandTimings: warm.map((measurement) => ({
          ...measurement,
          service: commandTimings.find(({ commandId }) => commandId === measurement.commandId)
            ?.service
        }))
      })
    )
    assert.ok(
      warmP95Ms < WARM_COMMAND_P95_LIMIT_MS,
      `Warm local command p95 ${warmP95Ms.toFixed(2)} ms exceeded ${WARM_COMMAND_P95_LIMIT_MS} ms.`
    )

    const spendableResource = initialSheet.resources.items.find(
      (resource) => resource.remaining > 0
    )
    assert.ok(
      spendableResource,
      'The live-session fixture must expose a spendable rule-backed resource.'
    )
    const mechanicsChangingCommand = await sendCharacterCommand(
      playerRoom,
      gmRoom,
      characterId,
      {
        type: 'USE_SHEET_RESOURCE',
        owner: spendableResource.owner,
        amount: 1,
        commandId: randomUUID(),
        expectedVersion
      },
      true
    )
    expectedVersion = mechanicsChangingCommand.streamVersion
    console.info(
      JSON.stringify({
        localLiveSessionMechanicsChangingCommandTiming: {
          ...mechanicsChangingCommand,
          service: commandTimings.find(
            ({ commandId }) => commandId === mechanicsChangingCommand.commandId
          )?.service
        }
      })
    )
    assert.ok(
      mechanicsChangingCommand.durationMs < WARM_COMMAND_P95_LIMIT_MS,
      `Rule-invalidating local command ${mechanicsChangingCommand.durationMs.toFixed(2)} ms exceeded ${WARM_COMMAND_P95_LIMIT_MS} ms.`
    )
    const resourceTiming = commandTimings.find(
      ({ commandId }) => commandId === mechanicsChangingCommand.commandId
    )
    if (!externalEndpoint) {
      assert.equal(resourceTiming?.service.evaluationLane, 'CHARACTER_ACTION')
      assert.ok((resourceTiming?.service.boundedZenEvaluationMs ?? 0) > 0)
    }

    const spellSlot = initialSheet.spells.slots.find((slot) => slot.remaining > 0)
    assert.ok(spellSlot, 'The prepared-caster fixture must expose a spendable spell slot.')
    const spellSlotCommand = await sendCharacterCommand(
      playerRoom,
      gmRoom,
      characterId,
      {
        type: 'USE_SPELL_SLOT',
        slotKey: spellSlot.slotKey,
        commandId: randomUUID(),
        expectedVersion
      },
      true
    )
    expectedVersion = spellSlotCommand.streamVersion
    const spellSlotTiming = commandTimings.find(
      ({ commandId }) => commandId === spellSlotCommand.commandId
    )
    console.info(
      JSON.stringify({
        localLiveSessionSpellSlotCommandTiming: {
          ...spellSlotCommand,
          service: spellSlotTiming?.service
        }
      })
    )
    assert.ok(
      spellSlotCommand.durationMs < WARM_COMMAND_P95_LIMIT_MS,
      `Spell-slot local command ${spellSlotCommand.durationMs.toFixed(2)} ms exceeded ${WARM_COMMAND_P95_LIMIT_MS} ms.`
    )
    if (!externalEndpoint) {
      assert.equal(spellSlotTiming?.service.evaluationLane, 'CHARACTER_ACTION')
      assert.ok((spellSlotTiming?.service.boundedZenEvaluationMs ?? 0) > 0)
    }

    const encounterResourceCommand = await sendEncounterCommand(gmRoom, playerRoom, {
      type: 'ADJUST_FEATURE_RESOURCE',
      encounterId: encounter.id,
      actorId: encounterActor.id,
      featureId: encounterFeature.id,
      direction: 'USE',
      amount: 1,
      commandId: randomUUID(),
      expectedVersion: encounter.version
    })
    const encounterResourceTiming = encounterCommandTimings.find(
      ({ commandId }) => commandId === encounterResourceCommand.commandId
    )
    console.info(
      JSON.stringify({
        localLiveSessionEncounterResourceCommandTiming: {
          ...encounterResourceCommand,
          service: encounterResourceTiming?.service
        }
      })
    )
    assert.ok(
      encounterResourceCommand.durationMs < WARM_COMMAND_P95_LIMIT_MS,
      `Encounter resource command ${encounterResourceCommand.durationMs.toFixed(2)} ms exceeded ${WARM_COMMAND_P95_LIMIT_MS} ms.`
    )
    if (!externalEndpoint) {
      assert.equal(encounterResourceTiming?.service.evaluationLane, 'NONE')
      assert.equal(encounterResourceTiming?.service.actorEvaluationMs, 0)
    }
    const expectedRoomVersionBeforeReconnect = expectedVersion

    playerRoom.reconnection.minUptime = 0
    playerRoom.reconnection.delay = 20
    playerRoom.reconnection.minDelay = 20
    playerRoom.reconnection.maxDelay = 50
    const dropped = new Promise<void>((resolve) => playerRoom?.onDrop.once(() => resolve()))
    const reconnected = new Promise<void>((resolve) =>
      playerRoom?.onReconnect.once(() => resolve())
    )
    const reconnectReady = waitForMessage(
      playerRoom,
      LIVE_SESSION_READY_MESSAGE,
      liveSessionReadyDtoSchema,
      (message) => message.campaignId === campaign.id && message.sessionId === session.id
    )
    const reconnectStartedAt = performance.now()
    void playerRoom.leave(false)
    await dropped
    const bufferedCommand = {
      type: 'ADJUST_HIT_POINTS' as const,
      mode: 'HEAL' as const,
      amount: 1,
      commandId: randomUUID(),
      expectedVersion
    }
    const bufferedOutcome = sendCharacterCommand(
      playerRoom,
      gmRoom,
      characterId,
      bufferedCommand,
      true
    )
    await reconnected
    const ready = await reconnectReady
    const buffered = await bufferedOutcome
    const reconnectMs = performance.now() - reconnectStartedAt
    assert.equal(buffered.streamVersion, expectedVersion + 1)
    assert.equal(buffered.replayed, false)
    assert.equal(ready.roomVersion, expectedRoomVersionBeforeReconnect)
    assert.ok(
      ready.aggregateVersions.some(
        (version) =>
          version.aggregateKind === 'CHARACTER' &&
          version.aggregateId === characterId &&
          version.version === expectedVersion
      )
    )

    const [persisted, row, persistedEncounter] = await Promise.all([
      createCharacterRepository(db).findAuthoredById(characterId),
      createCharacterRepository(db).findById(characterId),
      createEncounterRepository(db).find(encounter.id)
    ])
    assert.ok(persisted && row && persistedEncounter)
    assert.equal(row.stream_version, expectedVersion + 1)
    assert.equal(persisted.state.hitpoints.current, fixture.expectedMaxHitPoints)
    assert.equal(persistedEncounter.version, encounter.version + 1)

    await playerRoom.leave()
    playerRoom = null
    await gmRoom.leave()
    gmRoom = null
    if (sessionHost) {
      await sessionHost.gracefullyShutdown(false)
      sessionHost = null
    }
    await waitForLeaseRelease(db, session.id)

    console.info(
      JSON.stringify({
        authenticatedJoin: 'verified',
        commandAuthorityLeaseCleanup: 'verified',
        commandPersistence: 'verified',
        directHttpMutationBypass: 'rejected',
        exactReplay: 'verified',
        health: 'verified',
        hostMode: externalEndpoint ? 'EXTERNAL_LINUX_CONTAINER' : 'LOCAL_NODE_PROCESS',
        encounterCommittedSnapshot: 'verified',
        localDatabaseOnly: true,
        multiClientCommittedBroadcast: 'verified',
        reconnectBufferedCommand: 'verified',
        timings: {
          coldCommandMs: cold.durationMs,
          encounterResourceCommandMs: encounterResourceCommand.durationMs,
          gmJoinMs: gmJoin.durationMs,
          mechanicsChangingCommandMs: mechanicsChangingCommand.durationMs,
          playerJoinMs: playerJoin.durationMs,
          reconnectMs,
          spellSlotCommandMs: spellSlotCommand.durationMs,
          warmCommandMaxMs: Math.max(...warm.map(({ durationMs }) => durationMs)),
          warmCommandP50Ms: percentile(
            warm.map(({ durationMs }) => durationMs),
            0.5
          ),
          warmCommandP95Ms: warmP95Ms,
          warmCommandSamples: warm.map(({ durationMs }) => durationMs)
        }
      })
    )
  } catch (error) {
    runError = error
  } finally {
    if (playerRoom) {
      const room = playerRoom
      await captureCleanup(() => room.leave())
    }
    if (gmRoom) {
      const room = gmRoom
      await captureCleanup(() => room.leave())
    }
    if (sessionHost) {
      const host = sessionHost
      await captureCleanup(() => host.gracefullyShutdown(false))
    }
    if (campaignId && gm) {
      const currentCampaignId = campaignId
      const currentGm = gm
      await captureCleanup(async () => {
        const campaign = await getCampaign(db, currentGm.id, currentCampaignId)
        await deleteCampaign(db, currentGm.id, currentCampaignId, campaign.version)
      })
    }
    if (player) {
      const currentPlayer = player
      await captureCleanup(async () => {
        const { error } = await admin.auth.admin.deleteUser(currentPlayer.id)
        if (error) throw error
        assert.equal(await createCharacterRepository(db).findById(characterId), null)
      })
    }
    if (gm) {
      const currentGm = gm
      await captureCleanup(async () => {
        const { error } = await admin.auth.admin.deleteUser(currentGm.id)
        if (error) throw error
      })
    }
    await captureCleanup(() => db.destroy())
  }
  if (runError) throw runError
  if (cleanupError) throw cleanupError
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
