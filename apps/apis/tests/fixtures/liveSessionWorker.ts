import { vi } from 'vitest'
import type {
  LiveSessionExpectedScene,
  LiveSessionExternalAuthority
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { preparedMovementSceneDelta } from '@artificer-toolkit/rules-runtime/encounterMovementPublication'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type {
  EncounterCommandInputDto,
  EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import type { MutationCtx, QueryCtx } from '../../convex/_generated/server'
import { parseGeometrySave } from '../../convex/scenes/geometryDocuments'
import {
  executeLiveEncounterCommand,
  type LiveEncounterActor
} from '../../../session-worker/src/nativeRoomEncounterCommand'
import {
  createNativeLiveRulesRuntime,
  secureRandomInt
} from '../../../session-worker/src/nativeRulesRuntime'

export function workerEnvironment(secret: string) {
  return { CONVEX_SITE_URL: 'https://convex.example.test', LIVE_SESSION_WORKER_SECRET: secret }
}

type LiveSessionRoute = (pathname: string, init?: RequestInit) => Promise<Response> | Response

function liveSessionFetch(route: LiveSessionRoute) {
  return (url: string | URL | Request, init?: RequestInit) =>
    route(new URL(url instanceof Request ? url.url : url.toString()).pathname, init)
}

/** Routes the Worker's Convex site requests by pathname, typically into a convex-test caller. */
export function stubLiveSessionFetch(route: LiveSessionRoute) {
  vi.stubGlobal('fetch', vi.fn(liveSessionFetch(route)))
}

const ROOM_WORKER_SECRET = 'fixture-room-worker-secret-at-least-32-bytes-long'

/**
 * Runs Worker room code with its Convex requests served by `caller`, a member's convex-test
 * identity, and the live rules runtime. The test's own fetch and Worker secret are restored after.
 */
export async function withRoomConvex<T>(
  caller: { fetch(pathname: string, init?: RequestInit): Promise<Response> },
  run: (room: {
    environment: ReturnType<typeof workerEnvironment>
    accessToken: string
    runtime: Awaited<ReturnType<typeof createNativeLiveRulesRuntime>>
  }) => Promise<T>
): Promise<T> {
  const fetch = globalThis.fetch
  const secret = process.env.LIVE_SESSION_WORKER_SECRET
  const route = liveSessionFetch((pathname, init) => caller.fetch(pathname, init))
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => route(url, init)
  process.env.LIVE_SESSION_WORKER_SECRET = ROOM_WORKER_SECRET
  try {
    return await run({
      environment: workerEnvironment(ROOM_WORKER_SECRET),
      accessToken: 'fixture-access-token',
      runtime: await createNativeLiveRulesRuntime(process.env.RULES_CONTINUATION_SECRET ?? '')
    })
  } finally {
    globalThis.fetch = fetch
    if (secret === undefined) delete process.env.LIVE_SESSION_WORKER_SECRET
    else process.env.LIVE_SESSION_WORKER_SECRET = secret
  }
}

/**
 * Sends one Encounter command through the room's dispatcher (`executeLiveEncounterCommand`) as a
 * member. The Campaign needs an active live authority at `actor.authorityEpoch`.
 */
export function executeRoomEncounterCommand(input: {
  caller: { fetch(pathname: string, init?: RequestInit): Promise<Response> }
  actor: LiveEncounterActor
  command: EncounterCommandInputDto
  random?: (maximum: number) => number
}): Promise<EncounterCommandResultDto> {
  return withRoomConvex(input.caller, (room) =>
    executeLiveEncounterCommand({
      ...room,
      actor: input.actor,
      command: input.command,
      random: input.random ?? secureRandomInt,
      movement: () => {
        throw new Error('Room movement decisions need the room Scene.')
      }
    })
  )
}

/**
 * An Encounter's stored rows for a room-versus-native parity check: generated row identities are
 * dropped, since any two transactions differ there, and stored JSON compares by value.
 */
export async function encounterParityRecords(
  ctx: Pick<QueryCtx, 'db'>,
  encounterId: string,
  characterId?: string
) {
  const comparable = <T extends { _id: unknown; _creationTime: number }>(
    rows: readonly (T | null)[],
    ...generated: string[]
  ) =>
    rows.map(
      (row) =>
        row &&
        Object.fromEntries(
          Object.entries(row)
            .filter(([key]) => key !== '_id' && key !== '_creationTime' && !generated.includes(key))
            .map(([key, value]) => [
              key,
              key.endsWith('Json') && typeof value === 'string' ? JSON.parse(value) : value
            ])
        )
    )
  return {
    run: comparable([
      await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', encounterId))
        .unique()
    ]),
    actors: comparable(
      await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
        .collect()
    ),
    occurrences: comparable(
      await ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_encounterId_state', (q) => q.eq('encounterId', encounterId))
        .collect()
    ),
    receipts: comparable(
      await ctx.db
        .query('encounterRuleReceipts')
        .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', encounterId))
        .collect(),
      'id'
    ),
    commands: comparable(
      await ctx.db
        .query('encounterRunCommands')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
        .collect(),
      'id'
    ),
    character: characterId
      ? comparable([
          await ctx.db
            .query('characters')
            .withIndex('by_publicId', (q) => q.eq('id', characterId))
            .unique()
        ])
      : null,
    characterReceipts: characterId
      ? comparable(
          await ctx.db
            .query('characterCommandReceipts')
            .withIndex('by_characterId_commandId', (q) => q.eq('characterId', characterId))
            .collect(),
          'id',
          'historyJson',
          'historyChecksum'
        )
      : null
  }
}

export function insertActiveLiveAuthority(
  ctx: MutationCtx,
  { campaignId, epoch, createdAt }: { campaignId: string; epoch: string; createdAt: string }
) {
  return ctx.db.insert('campaignLiveAuthorities', {
    campaignId,
    epoch,
    phase: 'DO_ACTIVE',
    activationFingerprint: '0'.repeat(64),
    persistedSequence: 0,
    persistedStateChecksum: '0'.repeat(64),
    createdAt,
    updatedAt: createdAt
  })
}

/** The room's next authority advance for a Convex-first commit (D27). */
export async function nextExternalAuthority(
  ctx: QueryCtx,
  campaignId: string
): Promise<LiveSessionExternalAuthority> {
  const authority = await ctx.db
    .query('campaignLiveAuthorities')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
    .unique()
  if (!authority) throw new Error('Live authority fixture is missing.')
  const sequence = authority.persistedSequence + 1
  return {
    sequence,
    expectedStateChecksum: authority.persistedStateChecksum,
    stateChecksum: checksumCanonicalJson({ campaignId, sequence })
  }
}

/** The Scene result a staged move publishes with its prepared outcome, as the room predicts it. */
export async function expectedMovementScene(
  ctx: QueryCtx,
  saveId: string,
  outcome: SceneSpatialPreparation['outcome'] | null
): Promise<LiveSessionExpectedScene> {
  const row = await ctx.db
    .query('sceneGeometrySaves')
    .withIndex('by_publicId', (q) => q.eq('id', saveId))
    .unique()
  if (!row) throw new Error('Geometry save fixture is missing.')
  const save = parseGeometrySave(row)
  if (save.input.type !== 'MOVE_SCENE_TOKEN') throw new Error('Expected a staged token move.')
  const delta = preparedMovementSceneDelta({
    tokenId: save.input.tokenId,
    path: save.input.path,
    outcome,
    sceneVersion: save.snapshotVersion
  })
  return {
    sceneId: save.sceneId,
    version: save.snapshotVersion + (delta || save.fogSaves.length ? 1 : 0),
    delta
  }
}
