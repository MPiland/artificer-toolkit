import assert from 'node:assert/strict'
import { ConvexHttpClient } from 'convex/browser'
import {
  makeFunctionReference,
  type FunctionReference,
  type FunctionArgs,
  type FunctionReturnType
} from 'convex/server'
import {
  DEVELOPMENT_CHECKPOINT_ROLLBACK_MARKER,
  developmentCheckpointInspectionSchema,
  type DevelopmentCheckpointScope,
  type DevelopmentCheckpointPreparationInput,
  type DevelopmentCheckpointRollbackInput,
  type DevelopmentCheckpointInspection
} from '@artificer-toolkit/schema/api/developmentCheckpoint'
import {
  liveSessionCheckpointRequestSchema,
  liveSessionCheckpointResponseSchema,
  type LiveSessionCheckpointRequest,
  type LiveSessionCheckpointResponse
} from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import type {
  LiveSessionAuthorityDto,
  LiveSessionDrainReleaseInput
} from '@artificer-toolkit/schema/api/liveSessionState'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { JSON_PAYLOAD_CHUNK_MAX_BYTES } from '@artificer-toolkit/shared/jsonPayloadChunks'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../convex/_generated/api.js'
import type { DevelopmentClient } from './developmentClient'
import { developmentCli as cli } from './developmentCli'
import { createDevelopmentCharacter } from './developmentCharacterFixture'
import { developmentTarget } from './developmentTarget'

const prepare = makeFunctionReference<
  'mutation',
  DevelopmentCheckpointPreparationInput,
  LiveSessionCheckpointRequest
>('liveSessions/developmentCheckpoint:prepare')
const inspect = makeFunctionReference<
  'query',
  DevelopmentCheckpointScope,
  DevelopmentCheckpointInspection
>('liveSessions/developmentCheckpoint:inspect')
const rollback = makeFunctionReference<'mutation', DevelopmentCheckpointRollbackInput, null>(
  'liveSessions/developmentCheckpoint:rollback'
)
const publish = makeFunctionReference<
  'mutation',
  LiveSessionCheckpointRequest,
  LiveSessionCheckpointResponse
>('liveSessions/checkpoint:publish')
const beginDrain = makeFunctionReference<
  'mutation',
  LiveSessionDrainReleaseInput,
  LiveSessionAuthorityDto
>('liveSessions/authority:beginDrain')
const release = makeFunctionReference<'mutation', LiveSessionDrainReleaseInput, null>(
  'liveSessions/authority:release'
)
const held = makeFunctionReference<
  'query',
  Pick<DevelopmentCheckpointScope, 'campaignId'>,
  boolean
>('liveSessions/authority:held')

// The room checkpoints a pending Scene commit at its deadline alarm (`ROOM_LIMITS.checkpointDeadlineMs`).
const SCENE_CHECKPOINT_TIMEOUT_MS = 180_000

/**
 * Room Scene commits reach Convex only at a checkpoint, so Convex reads of a presented Scene lag the
 * room. Waits, without disturbing connected sockets, until Convex holds the Scene at `version`.
 */
export async function awaitSceneCheckpoint(
  client: Pick<ConvexHttpClient, 'query'>,
  sceneId: string,
  version: number
) {
  const deadline = Date.now() + SCENE_CHECKPOINT_TIMEOUT_MS
  while (true) {
    const header = await client.query(api.scenes.liveReads.header, { sceneId })
    if (header.version >= version) return
    assert.ok(Date.now() < deadline, `Scene ${sceneId} did not checkpoint to version ${version}.`)
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
}

/** Uses real native mutations: a post-publication throw must roll back the entire checkpoint. */
export async function verifyDevelopmentCheckpoint({
  owner,
  player,
  characterId,
  large = false
}: {
  owner: {
    client: DevelopmentClient & Pick<ConvexHttpClient, 'action'>
    identity: { userId: string }
  }
  player: {
    client: DevelopmentClient & Pick<ConvexHttpClient, 'action'>
    identity: { userId: string }
  }
  characterId: string
  large?: boolean
}) {
  const target = developmentTarget(process.env)
  assert.equal(target.mode, 'local', 'Checkpoint proof requires the isolated local backend.')
  assert.equal(process.env.CONVEX_SELF_HOSTED_URL, target.deploymentUrl.origin)
  const adminKey = process.env.CONVEX_SELF_HOSTED_ADMIN_KEY
  assert.ok(adminKey, 'Local fixture credentials are required.')
  const admin = new ConvexHttpClient(target.deploymentUrl.origin, { logger: false })
  // Convex exposes this native internal-call facility at runtime but strips it from public types.
  const setAdminAuth: unknown = Reflect.get(admin, 'setAdminAuth')
  assert.equal(typeof setAdminAuth, 'function')
  if (typeof setAdminAuth !== 'function') throw new Error('Native admin client is unavailable.')
  setAdminAuth.call(admin, adminKey)
  const nativeFunction: unknown = Reflect.get(admin, 'function')
  if (typeof nativeFunction !== 'function')
    throw new Error('Native internal function endpoint is unavailable.')
  // The installed client's internal method uses /api/function, including its validated generic refs.
  const invoke = nativeFunction.bind(admin) as <
    Function extends FunctionReference<'query' | 'mutation' | 'action'>
  >(
    reference: Function,
    componentPath: undefined,
    args: FunctionArgs<Function>
  ) => Promise<FunctionReturnType<Function>>

  let campaignId: string | undefined
  let blueprintId: string | undefined
  let checkpoint: LiveSessionCheckpointRequest | undefined
  let released = false
  let scope: DevelopmentCheckpointScope | undefined
  let proof:
    | { before: DevelopmentCheckpointInspection; after: DevelopmentCheckpointInspection }
    | undefined
  const fixture = {
    ownerUserId: owner.identity.userId,
    playerUserId: player.identity.userId,
    characterId
  }
  try {
    await createDevelopmentCharacter(player.client, characterId)
    const campaign = await owner.client.mutation(api.campaigns.create.create, {
      name: 'Encounter execution fixture',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    campaignId = campaign.id
    await cli(
      'encounters/developmentCampaign:admitFixturePlayer',
      {
        ownerUserId: fixture.ownerUserId,
        playerUserId: fixture.playerUserId,
        campaignId
      },
      false
    )
    await player.client.mutation(api.campaigns.assignments.assign, { campaignId, characterId })
    const blueprint = await owner.client.mutation(api.encounters.blueprints.create, {
      gameSystemId: srdSystemRecord.id,
      name: 'Checkpoint native proof',
      commandId: crypto.randomUUID(),
      enemies: [{ kind: 'CUSTOM', label: 'Checkpoint practice opponent', maxHitPoints: 10 }]
    })
    blueprintId = blueprint.id
    const run = await owner.client.mutation(api.encounters.runs.create, {
      campaignId,
      blueprintId,
      commandId: crypto.randomUUID()
    })
    assert.equal(run.status, 'PREPARED')
    scope = { ...fixture, campaignId, encounterId: run.id }
    checkpoint = liveSessionCheckpointRequestSchema.parse(
      await invoke(prepare, undefined, { ...scope, large })
    )
    const before = developmentCheckpointInspectionSchema.parse(
      await invoke(inspect, undefined, scope)
    )
    const badChecksum =
      checkpoint.payloadChecksum === '0'.repeat(64) ? '1'.repeat(64) : '0'.repeat(64)
    if (large) {
      const json = canonicalizeJson(checkpoint.records)
      const byteLength = new TextEncoder().encode(json).byteLength
      assert.ok(byteLength > JSON_PAYLOAD_CHUNK_MAX_BYTES)
      assert.ok(byteLength > json.length, 'Fixture must contain multibyte UTF-8.')
    }
    await assert.rejects(
      invoke(rollback, undefined, { scope, checkpoint }),
      new RegExp(DEVELOPMENT_CHECKPOINT_ROLLBACK_MARKER)
    )
    assert.deepEqual(await invoke(inspect, undefined, scope), before)
    await assert.rejects(
      invoke(publish, undefined, { ...checkpoint, payloadChecksum: badChecksum }),
      /payload checksum/
    )
    assert.deepEqual(await invoke(inspect, undefined, scope), before)
    await assert.rejects(
      invoke(publish, undefined, { ...checkpoint, epoch: crypto.randomUUID() }),
      /authority is stale/
    )
    assert.deepEqual(await invoke(inspect, undefined, scope), before)

    const committed = liveSessionCheckpointResponseSchema.parse(
      await invoke(publish, undefined, checkpoint)
    )
    assert.equal(committed.status, 'COMMITTED')
    assert.equal(committed.authority.epoch, checkpoint.epoch)
    assert.equal(committed.authority.persistedSequence, checkpoint.sequence)
    assert.equal(committed.authority.persistedStateChecksum, checkpoint.checksum)
    const after = developmentCheckpointInspectionSchema.parse(
      await invoke(inspect, undefined, scope)
    )
    const sharedEntryCount = large ? 64 : 2
    assert.equal(after.runVersion, before.runVersion + sharedEntryCount)
    assert.equal(after.playStreamVersion, before.playStreamVersion + 1)
    assert.equal(after.sharedHeaderCount, before.sharedHeaderCount + sharedEntryCount)
    assert.equal(after.privateHeaderCount, before.privateHeaderCount + 1)
    const ledgers = after.ledgers.filter(
      (ledger) => ledger.checkpointId === checkpoint?.checkpointId
    )
    assert.equal(ledgers.length, 2)
    assert.deepEqual(
      ledgers
        .map(({ scope, scopeId, epoch, entryCount }) => ({ scope, scopeId, epoch, entryCount }))
        .sort((left, right) => left.scope.localeCompare(right.scope)),
      [
        {
          scope: 'CAMPAIGN',
          scopeId: campaignId,
          epoch: checkpoint.epoch,
          entryCount: sharedEntryCount
        },
        { scope: 'CHARACTER', scopeId: characterId, epoch: checkpoint.epoch, entryCount: 1 }
      ]
    )
    const replayed = liveSessionCheckpointResponseSchema.parse(
      await invoke(publish, undefined, checkpoint)
    )
    assert.equal(replayed.status, 'REPLAYED')
    assert.deepEqual(replayed.authority, committed.authority)
    assert.deepEqual(await invoke(inspect, undefined, scope), after)
    const records = { ...checkpoint.records, history: [...checkpoint.records.history].reverse() }
    assert.notEqual(checksumCanonicalJson(records), checkpoint.payloadChecksum)
    await assert.rejects(
      invoke(publish, undefined, {
        ...checkpoint,
        records,
        payloadChecksum: checksumCanonicalJson(records)
      }),
      /retry differs from the acknowledged payload/
    )
    assert.deepEqual(await invoke(inspect, undefined, scope), after)
    await assert.rejects(
      invoke(publish, undefined, { ...checkpoint, checkpointId: crypto.randomUUID() }),
      /retry differs from the acknowledged payload/
    )
    assert.deepEqual(await invoke(inspect, undefined, scope), after)
    const drain = {
      campaignId,
      epoch: checkpoint.epoch,
      finalSequence: checkpoint.sequence,
      finalStateChecksum: checkpoint.checksum
    }
    const draining = await invoke(beginDrain, undefined, drain)
    assert.equal(draining.phase, 'DRAINING')
    await invoke(release, undefined, drain)
    released = true
    assert.equal(await invoke(held, undefined, { campaignId }), false)
    proof = { before, after }
  } finally {
    if (checkpoint && scope && !released) {
      // A lost publication response may already have committed; drain the observed native fence.
      const current = await invoke(inspect, undefined, scope)
      if (current.authority) {
        assert.equal(
          current.authority.epoch,
          checkpoint.epoch,
          'Refuse a different fixture authority epoch.'
        )
        const drain: LiveSessionDrainReleaseInput = {
          campaignId: checkpoint.campaignId,
          epoch: checkpoint.epoch,
          finalSequence: current.authority.persistedSequence,
          finalStateChecksum: current.authority.persistedStateChecksum
        }
        await invoke(beginDrain, undefined, drain)
        await invoke(release, undefined, drain)
      }
      assert.equal(await invoke(held, undefined, { campaignId: checkpoint.campaignId }), false)
    }
    if (campaignId) {
      await cli('encounters/developmentRuns:removeFixtureState', { ...fixture, campaignId }, false)
      await cli(
        'encounters/developmentCampaign:removeFixtureCampaign',
        { ...fixture, campaignId },
        false
      )
      await assert.rejects(
        owner.client.query(api.campaigns.queries.get, { id: campaignId }),
        /Campaign not found/
      )
    }
    if (blueprintId)
      await cli(
        'encounters/development:removeFixtureBlueprint',
        {
          userId: fixture.ownerUserId,
          blueprintId
        },
        false
      )
    await cli(
      'characters/development:removePersonalFixtureCharacter',
      {
        userId: fixture.playerUserId,
        characterId
      },
      false
    )
    const characters = await player.client.query(api.characters.list.list, {
      paginationOpts: { cursor: null, numItems: 8 }
    })
    assert.equal(characters.isDone, true)
    assert.equal(
      characters.page.some((character) => character.id === characterId),
      false
    )
    const blueprints = await owner.client.query(api.encounters.blueprints.list, {
      gameSystemId: srdSystemRecord.id,
      paginationOpts: { cursor: null, numItems: 8 }
    })
    assert.equal(blueprints.isDone, true)
    assert.equal(
      blueprints.page.some((blueprint) => blueprint.id === blueprintId),
      false
    )
    admin.clearAuth()
  }
  assert.ok(proof)
  console.log(
    JSON.stringify({
      proof: large
        ? 'Native large inline checkpoint rollback, replay, receipt partition and clocks'
        : 'Native checkpoint rollback, replay, receipt partition and clocks',
      campaignId,
      characterId,
      checkpointId: checkpoint?.checkpointId,
      before: proof.before,
      after: proof.after,
      rollback: 'PASS',
      invalidPayload: 'PASS',
      foreignEpoch: 'PASS',
      exactReplay: 'PASS',
      alteredReplay: 'PASS',
      privateLedgerPartition: 'PASS',
      authorityRelease: 'PASS',
      cleanup: 'PASS',
      status: 'PASS'
    })
  )
}
