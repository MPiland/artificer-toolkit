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
  type DevelopmentCheckpointDiscardUploadInput,
  type DevelopmentCheckpointRollbackInput,
  type DevelopmentCheckpointInspection
} from '@artificer-toolkit/schema/api/developmentCheckpoint'
import {
  developmentCheckpointSceneInspectionSchema,
  type DevelopmentCheckpointSceneInput,
  type DevelopmentCheckpointSceneInspection
} from '@artificer-toolkit/schema/api/developmentCheckpointScenes'
import {
  liveSessionCheckpointSceneSchema,
  type LiveSessionCheckpointScene
} from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import {
  liveSessionCheckpointInputSchema,
  liveSessionCheckpointResponseSchema,
  type LiveSessionCheckpointInput,
  type LiveSessionCheckpointResponse
} from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import {
  liveSessionCheckpointStageResponseSchema,
  type LiveSessionCheckpointCommitInput,
  type LiveSessionCheckpointPartInput,
  type LiveSessionCheckpointStageInput,
  type LiveSessionCheckpointStageResponse
} from '@artificer-toolkit/schema/api/liveSessionCheckpointStaging'
import type {
  LiveSessionAuthorityDto,
  LiveSessionDrainReleaseInput
} from '@artificer-toolkit/schema/api/liveSessionState'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { encodeBase64 } from '@artificer-toolkit/shared/base64'
import {
  encodeUtf8PayloadChunks,
  JSON_PAYLOAD_CHUNK_MAX_BYTES
} from '@artificer-toolkit/shared/jsonPayloadChunks'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../convex/_generated/api.js'
import type { DevelopmentClient } from './developmentClient'
import { developmentCli as cli } from './developmentCli'
import { createDevelopmentCharacter } from './developmentCharacterFixture'
import { developmentTarget } from './developmentTarget'
import { createEncounterLifecycleScene } from './developmentEncounterScenes'
import { createUniformSceneFogLayer } from '@artificer-toolkit/shared/vtt'

const prepare = makeFunctionReference<
  'mutation',
  DevelopmentCheckpointPreparationInput,
  LiveSessionCheckpointInput
>('liveSessions/developmentCheckpoint:prepare')
const inspect = makeFunctionReference<
  'query',
  DevelopmentCheckpointScope,
  DevelopmentCheckpointInspection
>('liveSessions/developmentCheckpoint:inspect')
const rollback = makeFunctionReference<'mutation', DevelopmentCheckpointRollbackInput, null>(
  'liveSessions/developmentCheckpoint:rollback'
)
const discardUpload = makeFunctionReference<
  'mutation',
  DevelopmentCheckpointDiscardUploadInput,
  null
>('liveSessions/developmentCheckpoint:discardUpload')
const publish = makeFunctionReference<
  'mutation',
  LiveSessionCheckpointInput,
  LiveSessionCheckpointResponse
>('liveSessions/checkpoint:publish')
const beginUpload = makeFunctionReference<
  'mutation',
  LiveSessionCheckpointStageInput,
  LiveSessionCheckpointStageResponse
>('liveSessions/checkpointStaging:begin')
const uploadPart = makeFunctionReference<
  'mutation',
  LiveSessionCheckpointPartInput,
  LiveSessionCheckpointStageResponse
>('liveSessions/checkpointStaging:part')
const commitUpload = makeFunctionReference<
  'mutation',
  LiveSessionCheckpointCommitInput,
  LiveSessionCheckpointResponse
>('liveSessions/checkpointStaging:commit')
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
const captureScene = makeFunctionReference<
  'mutation',
  DevelopmentCheckpointSceneInput,
  LiveSessionCheckpointScene
>('liveSessions/developmentCheckpointScenes:capture')
const inspectScene = makeFunctionReference<
  'query',
  DevelopmentCheckpointSceneInput,
  DevelopmentCheckpointSceneInspection
>('liveSessions/developmentCheckpointScenes:inspect')

/** Uses real native mutations: a post-publication throw must roll back the entire checkpoint. */
export async function verifyDevelopmentCheckpoint({
  owner,
  player,
  characterId,
  staged = false,
  scenes = false
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
  staged?: boolean
  scenes?: boolean
}) {
  assert.ok(!scenes || !staged, 'Scene proof uses the inline checkpoint path.')
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

  const readScene = async (sceneId: string) => {
    const header = await owner.client.query(api.scenes.liveReads.header, { sceneId })
    const [tokens, layers] = await Promise.all([
      owner.client.query(api.scenes.liveReads.changes, {
        sceneId,
        definitionSaveId: header.definitionSaveId,
        expectedVersion: header.version,
        collection: 'tokens',
        paginationOpts: { cursor: null, numItems: 8 }
      }),
      owner.client.query(api.scenes.fogReads.layers, {
        sceneId,
        expectedVersion: header.version,
        paginationOpts: { cursor: null, numItems: 8 }
      })
    ])
    assert.equal(tokens.isDone, true)
    assert.equal(layers.isDone, true)
    const chunks = await Promise.all(
      layers.page.map((layer) =>
        owner.client.query(api.scenes.fogReads.chunks, {
          sceneId,
          ownerUserId: layer.ownerUserId,
          expectedVersion: header.version,
          offset: 0,
          numItems: 8
        })
      )
    )
    assert.ok(chunks.every((page) => page.isDone))
    return { header, tokens: tokens.page, layers: layers.page, chunks }
  }

  let campaignId: string | undefined
  let blueprintId: string | undefined
  let checkpoint: LiveSessionCheckpointInput | undefined
  let released = false
  let scope: DevelopmentCheckpointScope | undefined
  let scene: Awaited<ReturnType<typeof createEncounterLifecycleScene>> | undefined
  let sceneInput: DevelopmentCheckpointSceneInput | undefined
  let sceneGroup: LiveSessionCheckpointScene | undefined
  let sceneExpected: DevelopmentCheckpointSceneInspection | undefined
  let sceneReset: DevelopmentCheckpointSceneInspection | undefined
  let sceneRestored: DevelopmentCheckpointSceneInspection | undefined
  let sceneReadExpected: Awaited<ReturnType<typeof readScene>> | undefined
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
    if (scenes) {
      const options = {
        map: { width: 64, height: 64 },
        grid: { kind: 'GRIDLESS' as const, pixelsPerUnit: 50, unit: 'FEET' as const },
        tokens: [0, 1].map((ordinal) => ({
          id: crypto.randomUUID(),
          assetId: null,
          controlledByUserIds: [],
          height: 1,
          hidden: false,
          label: `Checkpoint token ${ordinal}`,
          locked: false,
          position: { x: ordinal, y: 0 },
          rotationDegrees: 0,
          vision: null,
          width: 1
        }))
      }
      const [firstToken, secondToken] = options.tokens
      assert.ok(firstToken && secondToken)
      scene = await createEncounterLifecycleScene({
        owner: owner.client,
        campaignId,
        name: 'Checkpoint native Scene',
        options: { ...options, tokens: [firstToken, secondToken] }
      })
      sceneInput = { scope, sceneId: scene.liveSceneId }
      const presentation = await owner.client.action(api.scenes.presentations.setLive, {
        type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
        commandId: crypto.randomUUID(),
        campaignId,
        sceneId: scene.liveSceneId,
        expectedPresentationVersion: null
      })
      const off = await owner.client.mutation(api.scenes.commands.execute, {
        input: {
          type: 'SET_SCENE_FOG_MODE',
          sceneId: scene.liveSceneId,
          commandId: crypto.randomUUID(),
          expectedSceneVersion: 0,
          mode: 'OFF'
        }
      })
      const moved = await owner.client.action(api.scenes.geometryActions.execute, {
        input: {
          type: 'UPSERT_SCENE_TOKEN',
          sceneId: scene.liveSceneId,
          commandId: crypto.randomUUID(),
          expectedSceneVersion: off.version,
          token: { ...firstToken, position: { x: 10, y: 10 } }
        },
        presentation: { expectedPresentationVersion: presentation.version }
      })
      assert.deepEqual(moved.fogPatches, [])
      const on = await owner.client.mutation(api.scenes.commands.execute, {
        input: {
          type: 'SET_SCENE_FOG_MODE',
          sceneId: scene.liveSceneId,
          commandId: crypto.randomUUID(),
          expectedSceneVersion: moved.version,
          mode: 'PER_PLAYER'
        }
      })
      const fog = createUniformSceneFogLayer(
        {
          ...options,
          map: { ...options.map, assetId: scene.assetId, tileManifestAssetId: null },
          barriers: [],
          doorStates: {},
          fogMode: 'PER_PLAYER',
          fogLayers: []
        },
        { explored: true, ownerUserId: player.identity.userId }
      )
      const save = await owner.client.mutation(api.scenes.fogCommands.begin, {
        input: {
          type: 'PATCH_SCENE_FOG',
          sceneId: scene.liveSceneId,
          commandId: crypto.randomUUID(),
          expectedSceneVersion: on.version,
          presentation: { expectedPresentationVersion: presentation.version },
          layer: { ownerUserId: fog.ownerUserId, width: fog.width, height: fog.height },
          chunkManifest: fog.chunks.map((chunk) => ({
            index: chunk.index,
            checksum: checksumCanonicalJson(chunk)
          }))
        }
      })
      assert.ok(fog.chunks.length > 0 && fog.chunks.length <= 8)
      await owner.client.mutation(api.scenes.fogCommands.append, {
        input: { saveId: save.saveId, offset: 0, chunks: fog.chunks }
      })
      const patched = await owner.client.mutation(api.scenes.fogCommands.publish, {
        saveId: save.saveId
      })
      sceneExpected = developmentCheckpointSceneInspectionSchema.parse(
        await invoke(inspectScene, undefined, sceneInput)
      )
      assert.equal(sceneExpected.version, patched.version)
      assert.equal(Object.keys(sceneExpected.counts).length, 7)
      assert.ok(Object.values(sceneExpected.counts).every((count) => count > 0))
      sceneReadExpected = await readScene(scene.liveSceneId)
      assert.equal(sceneReadExpected.tokens.length, 1)
      assert.equal(sceneReadExpected.layers.length, 1)
      assert.deepEqual(sceneReadExpected.chunks[0]?.page, fog.chunks)
      sceneGroup = liveSessionCheckpointSceneSchema.parse(
        await invoke(captureScene, undefined, sceneInput)
      )
      assert.equal(sceneGroup.fromVersion, 0)
      assert.equal(sceneGroup.toVersion, sceneExpected.version)
      sceneReset = developmentCheckpointSceneInspectionSchema.parse(
        await invoke(inspectScene, undefined, sceneInput)
      )
      assert.equal(sceneReset.version, 0)
      assert.ok(Object.values(sceneReset.counts).every((count) => count === 0))
      assert.notEqual(sceneReset.digest, sceneExpected.digest)
    }
    checkpoint = liveSessionCheckpointInputSchema.parse(
      await invoke(prepare, undefined, { ...scope, staged })
    )
    if (sceneGroup) {
      const records = { ...checkpoint.records, scenes: [sceneGroup] }
      checkpoint = liveSessionCheckpointInputSchema.parse({
        ...checkpoint,
        records,
        payloadChecksum: checksumCanonicalJson(records)
      })
    }
    const before = developmentCheckpointInspectionSchema.parse(
      await invoke(inspect, undefined, scope)
    )
    const { records: _records, ...commit } = checkpoint
    let upload: LiveSessionCheckpointStageInput | undefined
    const badChecksum =
      checkpoint.payloadChecksum === '0'.repeat(64) ? '1'.repeat(64) : '0'.repeat(64)
    if (staged) {
      const json = canonicalizeJson(checkpoint.records)
      const parts = encodeUtf8PayloadChunks(json)
      const { knownAuthorization: _knownAuthorization, ...frame } = commit
      upload = {
        ...frame,
        byteLength: new TextEncoder().encode(json).byteLength,
        partCount: parts.length
      }
      assert.ok(upload.byteLength > JSON_PAYLOAD_CHUNK_MAX_BYTES)
      assert.ok(upload.byteLength > json.length, 'Fixture must contain multibyte UTF-8.')
      assert.ok(parts.length > 1)
      assert.equal(
        liveSessionCheckpointStageResponseSchema.parse(await invoke(beginUpload, undefined, upload))
          .status,
        'STAGED'
      )
      const begun = await invoke(inspect, undefined, scope)
      assert.equal(begun.stagedUploadCount, before.stagedUploadCount + 1)
      assert.equal(begun.stagedPartCount, before.stagedPartCount)
      assert.equal(
        liveSessionCheckpointStageResponseSchema.parse(await invoke(beginUpload, undefined, upload))
          .status,
        'STAGED'
      )
      assert.deepEqual(await invoke(inspect, undefined, scope), begun)
      const firstBytes = new Uint8Array(parts[0]!)
      const firstPart: LiveSessionCheckpointPartInput = {
        campaignId,
        epoch: checkpoint.epoch,
        checkpointId: checkpoint.checkpointId,
        index: 0,
        data: encodeBase64(firstBytes)
      }
      assert.equal(
        liveSessionCheckpointStageResponseSchema.parse(
          await invoke(uploadPart, undefined, firstPart)
        ).status,
        'STAGED'
      )
      const firstUploaded = await invoke(inspect, undefined, scope)
      assert.equal(firstUploaded.stagedPartCount, before.stagedPartCount + 1)
      assert.equal(
        liveSessionCheckpointStageResponseSchema.parse(
          await invoke(uploadPart, undefined, firstPart)
        ).status,
        'STAGED'
      )
      assert.deepEqual(await invoke(inspect, undefined, scope), firstUploaded)
      const differentBytes = firstBytes.slice()
      differentBytes[0] = differentBytes[0]! ^ 1
      await assert.rejects(
        invoke(uploadPart, undefined, { ...firstPart, data: encodeBase64(differentBytes) }),
        /already uploaded with different bytes/
      )
      assert.deepEqual(await invoke(inspect, undefined, scope), firstUploaded)
      await assert.rejects(invoke(commitUpload, undefined, commit), /upload is incomplete/)
      assert.deepEqual(await invoke(inspect, undefined, scope), firstUploaded)
      for (let index = 1; index < parts.length; index++) {
        assert.equal(
          liveSessionCheckpointStageResponseSchema.parse(
            await invoke(uploadPart, undefined, {
              ...firstPart,
              index,
              data: encodeBase64(new Uint8Array(parts[index]!))
            })
          ).status,
          'STAGED'
        )
      }
      const uploaded = await invoke(inspect, undefined, scope)
      assert.equal(uploaded.stagedPartCount, before.stagedPartCount + parts.length)
      await assert.rejects(
        invoke(rollback, undefined, { scope, checkpoint, staged }),
        new RegExp(DEVELOPMENT_CHECKPOINT_ROLLBACK_MARKER)
      )
      assert.deepEqual(await invoke(inspect, undefined, scope), uploaded)
      await assert.rejects(
        invoke(commitUpload, undefined, { ...commit, payloadChecksum: badChecksum }),
        /upload fence does not match/
      )
      assert.deepEqual(await invoke(inspect, undefined, scope), uploaded)
      await assert.rejects(
        invoke(commitUpload, undefined, { ...commit, epoch: crypto.randomUUID() }),
        /authority is stale/
      )
      assert.deepEqual(await invoke(inspect, undefined, scope), uploaded)
    } else {
      await assert.rejects(
        invoke(rollback, undefined, { scope, checkpoint, staged }),
        new RegExp(DEVELOPMENT_CHECKPOINT_ROLLBACK_MARKER)
      )
      assert.deepEqual(await invoke(inspect, undefined, scope), before)
      if (sceneInput && sceneGroup) {
        assert.deepEqual(await invoke(inspectScene, undefined, sceneInput), sceneReset)
        await assert.rejects(
          owner.client.mutation(api.scenes.commands.execute, {
            input: {
              type: 'SET_SCENE_FOG_MODE',
              sceneId: sceneInput.sceneId,
              commandId: crypto.randomUUID(),
              expectedSceneVersion: 0,
              mode: 'OFF'
            }
          }),
          /Campaign live table/
        )
        assert.deepEqual(await invoke(inspect, undefined, scope), before)
        assert.deepEqual(await invoke(inspectScene, undefined, sceneInput), sceneReset)
        const fogChunk = sceneGroup.changes.find((change) => change.table === 'sceneFogChunks')
        assert.ok(fogChunk)
        for (const changes of [
          sceneGroup.changes.filter((change) => change !== fogChunk),
          sceneGroup.changes.map((change) =>
            change === fogChunk ? { ...change, nextChecksum: '0'.repeat(64) } : change
          )
        ]) {
          const records = { ...checkpoint.records, scenes: [{ ...sceneGroup, changes }] }
          await assert.rejects(
            invoke(publish, undefined, {
              ...checkpoint,
              records,
              payloadChecksum: checksumCanonicalJson(records)
            }),
            /fog|chunk|Scene delta checksum/i
          )
          assert.deepEqual(await invoke(inspect, undefined, scope), before)
          assert.deepEqual(await invoke(inspectScene, undefined, sceneInput), sceneReset)
        }
        for (const source of [
          { ...sceneGroup, definitionSaveId: crypto.randomUUID() },
          { ...sceneGroup, presentationVersion: sceneGroup.presentationVersion + 1 }
        ]) {
          const records = { ...checkpoint.records, scenes: [source] }
          await assert.rejects(
            invoke(publish, undefined, {
              ...checkpoint,
              records,
              payloadChecksum: checksumCanonicalJson(records)
            }),
            /Scene source or version is stale|Scene presentation is stale/
          )
          assert.deepEqual(await invoke(inspect, undefined, scope), before)
          assert.deepEqual(await invoke(inspectScene, undefined, sceneInput), sceneReset)
        }
      }
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
    }

    const publication = staged
      ? await invoke(commitUpload, undefined, commit)
      : await invoke(publish, undefined, checkpoint)
    const committed = liveSessionCheckpointResponseSchema.parse(publication)
    assert.equal(committed.status, 'COMMITTED')
    assert.equal(committed.authority.epoch, checkpoint.epoch)
    assert.equal(committed.authority.persistedSequence, checkpoint.sequence)
    assert.equal(committed.authority.persistedStateChecksum, checkpoint.checksum)
    const after = developmentCheckpointInspectionSchema.parse(
      await invoke(inspect, undefined, scope)
    )
    if (sceneInput) {
      sceneRestored = developmentCheckpointSceneInspectionSchema.parse(
        await invoke(inspectScene, undefined, sceneInput)
      )
      assert.deepEqual(sceneRestored, sceneExpected)
      assert.deepEqual(await readScene(sceneInput.sceneId), sceneReadExpected)
    }
    const sharedEntryCount = staged ? 64 : 2
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
    if (upload) {
      assert.equal(after.stagedUploadCount, 0)
      assert.equal(after.stagedPartCount, 0)
      assert.equal(
        liveSessionCheckpointStageResponseSchema.parse(await invoke(beginUpload, undefined, upload))
          .status,
        'REPLAYED'
      )
      assert.deepEqual(await invoke(inspect, undefined, scope), after)
    }
    const replayed = liveSessionCheckpointResponseSchema.parse(
      staged
        ? await invoke(commitUpload, undefined, commit)
        : await invoke(publish, undefined, checkpoint)
    )
    assert.equal(replayed.status, 'REPLAYED')
    assert.deepEqual(replayed.authority, committed.authority)
    assert.deepEqual(await invoke(inspect, undefined, scope), after)
    if (sceneInput) {
      assert.deepEqual(await invoke(inspectScene, undefined, sceneInput), sceneRestored)
      assert.deepEqual(await readScene(sceneInput.sceneId), sceneReadExpected)
    }
    if (upload) {
      await assert.rejects(
        invoke(beginUpload, undefined, { ...upload, payloadChecksum: badChecksum }),
        /retry differs from the acknowledged payload/
      )
      assert.deepEqual(await invoke(inspect, undefined, scope), after)
      await assert.rejects(
        invoke(commitUpload, undefined, { ...commit, payloadChecksum: badChecksum }),
        /retry differs from the acknowledged payload/
      )
      assert.deepEqual(await invoke(inspect, undefined, scope), after)
      await assert.rejects(
        invoke(beginUpload, undefined, { ...upload, epoch: crypto.randomUUID() }),
        /authority is stale/
      )
    } else {
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
    }
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
    if (staged && checkpoint && scope) {
      await invoke(discardUpload, undefined, { scope, checkpointId: checkpoint.checkpointId })
    }
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
      if (scenes) {
        await cli(
          'scenes/developmentScene:removeFixtureState',
          { ownerUserId: fixture.ownerUserId, campaignId },
          false
        )
        const page = { campaignId, paginationOpts: { cursor: null, numItems: 8 } }
        assert.deepEqual((await owner.client.query(api.scenes.definitionReads.list, page)).page, [])
        assert.deepEqual(
          (await owner.client.query(api.scenes.definitionReads.listLive, page)).page,
          []
        )
      }
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
      proof: scenes
        ? 'Native Scene/fog and Run/play checkpoint rollback, source parity and replay'
        : staged
          ? 'Native staged checkpoint upload, rollback, replay, receipt partition and clocks'
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
      ...(staged
        ? {
            idempotentBegin: 'PASS',
            partReplay: 'PASS',
            alteredPart: 'PASS',
            incompleteUpload: 'PASS',
            uploadDeletion: 'PASS'
          }
        : {}),
      ...(scenes
        ? {
            sceneId: scene?.liveSceneId,
            sceneExpected,
            sceneReset,
            sceneRestored,
            sceneFamilies: 7,
            missingFogChildRollback: 'PASS',
            malformedFogChildRollback: 'PASS',
            sceneSourceFence: 'PASS',
            scenePresentationFence: 'PASS',
            sceneDirectWriteFence: 'PASS',
            sceneReadability: 'PASS',
            sceneReplay: 'PASS',
            mediaCleanup:
              'Outer account cleanup invokes guarded native media purge; object deletion retains its operation fence.'
          }
        : {}),
      privateLedgerPartition: 'PASS',
      authorityRelease: 'PASS',
      cleanup: 'PASS',
      status: 'PASS'
    })
  )
}
