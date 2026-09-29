import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ConvexHttpClient } from 'convex/browser'
import sharp from 'sharp'
import { api } from '../convex/_generated/api'
import { verifySceneAuthoringBrowser } from '../../web/tests/live-backend/sceneAuthoring'
import { verifySceneLiveBrowser } from '../../web/tests/live-backend/sceneLive'
import type { SceneGeometryExecuteInput } from '@artificer-toolkit/schema/api/sceneGeometry'
import type { SceneToken } from '@artificer-toolkit/shared/vtt/scene'

export async function verifySceneAuthoring(input: {
  owner: {
    client: ConvexHttpClient
    fetchToken(): Promise<string>
    email: string
    password: string
    username: string
    identity: { userId: string }
  }
  player: {
    client: ConvexHttpClient
    fetchToken(): Promise<string>
    email: string
    password: string
    username: string
    identity: { userId: string }
  }
  anonymous: ConvexHttpClient
  campaignId: string
  publicId: string
  evidenceDirectory: string
  verifyRetention?: boolean
  verifyLive?: boolean
}) {
  const { owner, campaignId, evidenceDirectory } = input
  await mkdir(evidenceDirectory, { recursive: true })
  const mapPath = join(evidenceDirectory, 'owner-map.png')
  await sharp({ create: { width: 800, height: 600, channels: 3, background: '#455a64' } })
    .png()
    .toFile(mapPath)
  const session = await owner.client.mutation(api.campaigns.sessions.create, {
    campaignId,
    title: 'V02 native owner session'
  })
  const page = { campaignId, paginationOpts: { cursor: null, numItems: 8 } }
  assert.deepEqual((await owner.client.query(api.scenes.definitionReads.list, page)).page, [])
  await assert.rejects(input.player.client.query(api.scenes.definitionReads.list, page), /owner/)
  await assert.rejects(
    input.anonymous.query(api.scenes.definitionReads.list, page),
    /Unauthenticated/
  )
  let sceneId: string | undefined
  let assetId: string | undefined
  const checkpoints: Array<{
    stage: string
    version: number
    barriers: number
    liveVersion: number
  }> = []
  await verifySceneAuthoringBrowser({
    owner,
    publicId: input.publicId,
    sessionNumber: session.sessionNumber,
    mapPath,
    evidenceDirectory,
    verifyState: async (stage) => {
      const definitions = await owner.client.query(api.scenes.definitionReads.list, page)
      assert.equal(definitions.isDone, true)
      assert.equal(definitions.page.length, 1)
      const definition = definitions.page[0]!
      const version = stage === 'created' ? 1 : 2
      assert.equal(definition.name, 'V02 native owner scene')
      assert.equal(definition.version, version)
      assert.deepEqual(definition.counts, {
        annotations: 0,
        barriers: version - 1,
        darknessZones: 0,
        lights: 0,
        tokens: 0
      })
      assert.deepEqual(
        { width: definition.map.width, height: definition.map.height },
        { width: 800, height: 600 }
      )
      sceneId ??= definition.id
      assetId ??= definition.map.assetId
      assert.equal(definition.id, sceneId)
      assert.equal(definition.map.assetId, assetId)
      const barriers = await owner.client.query(api.scenes.definitionReads.entities, {
        ...page,
        sceneId,
        saveId: definition.saveId,
        collection: 'barriers'
      })
      assert.equal(barriers.isDone, true)
      assert.equal(barriers.page.length, version - 1)
      if (version === 2) {
        const barrier = barriers.page[0]!
        assert.equal(barrier.ordinal, 0)
        assert.equal(barrier.value.collection, 'barriers')
        assert.ok('kind' in barrier.value.entity)
        assert.equal(barrier.value.entity.kind, 'WALL')
      }
      const live = await owner.client.query(api.scenes.definitionReads.listLive, page)
      assert.equal(live.isDone, true)
      assert.equal(live.page.length, 1)
      assert.equal(live.page[0]!.definitionId, sceneId)
      assert.equal(live.page[0]!.version, 0, 'Authoring must preserve the initial live snapshot.')
      if (stage === 'created') {
        const delivery = await owner.client.action(api.media.vttMapActions.getDelivery, { assetId })
        assert.equal(delivery.width, 800)
        assert.equal(delivery.height, 600)
        assert.equal(delivery.tiles.length, 1)
        for (const url of [delivery.overview.url, ...delivery.tiles.map((tile) => tile.url)]) {
          const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
          assert.equal(response.status, 200, 'Native signed map delivery failed.')
          const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata()
          assert.equal(metadata.width, 800)
          assert.equal(metadata.height, 600)
        }
        await assert.rejects(
          input.player.client.action(api.media.vttMapActions.getDelivery, { assetId }),
          /unavailable|presented/i
        )
        await assert.rejects(
          input.anonymous.action(api.media.vttMapActions.getDelivery, { assetId }),
          /Unauthenticated/
        )
      }
      checkpoints.push({ stage, version, barriers: barriers.page.length, liveVersion: 0 })
    }
  })
  assert.deepEqual(
    checkpoints.map((checkpoint) => checkpoint.stage),
    ['created', 'edited', 'reloaded']
  )
  await writeFile(
    join(evidenceDirectory, 'native-checkpoints.json'),
    JSON.stringify({ sceneId, assetId, checkpoints }, null, 2)
  )
  console.log(
    'Native owner map upload, Scene create/edit/reload, immutable initial snapshot and private-read denials passed.'
  )
  if (input.verifyLive) {
    assert.ok(sceneId)
    const definitionId = sceneId
    const definition = await owner.client.query(api.scenes.definitionReads.get, {
      campaignId,
      sceneId: definitionId
    })
    assert.equal(definition.version, 2)
    const definitionBarriers = await owner.client.query(api.scenes.definitionReads.entities, {
      campaignId,
      sceneId: definitionId,
      saveId: definition.saveId,
      collection: 'barriers',
      paginationOpts: { cursor: null, numItems: 8 }
    })
    assert.equal(definitionBarriers.isDone, true)
    assert.equal(definitionBarriers.page.length, 1)
    const verifyDefinition = async () => {
      assert.deepEqual(
        await owner.client.query(api.scenes.definitionReads.get, {
          campaignId,
          sceneId: definitionId
        }),
        definition
      )
      assert.deepEqual(
        await owner.client.query(api.scenes.definitionReads.entities, {
          campaignId,
          sceneId: definitionId,
          saveId: definition.saveId,
          collection: 'barriers',
          paginationOpts: { cursor: null, numItems: 8 }
        }),
        definitionBarriers
      )
    }
    assert.deepEqual(
      await owner.client.query(api.encounters.projectionReads.list, { campaignId }),
      []
    )
    const live = await owner.client.query(api.scenes.definitionReads.listLive, page)
    assert.equal(live.isDone, true)
    assert.equal(live.page.length, 1)
    const liveScene = live.page[0]!
    assert.equal(liveScene.definitionId, definitionId)
    const presentation = await owner.client.action(api.scenes.presentations.setLive, {
      type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
      commandId: crypto.randomUUID(),
      campaignId,
      sceneId: liveScene.id,
      expectedPresentationVersion: null
    })
    assert.equal(presentation.version, 0)
    const publicToken: SceneToken = {
      id: crypto.randomUUID(),
      label: 'V02 public token',
      assetId: null,
      controlledByUserIds: [input.player.identity.userId],
      height: 40,
      hidden: false,
      locked: false,
      position: { x: 80, y: 80 },
      rotationDegrees: 0,
      vision: null,
      width: 40
    }
    const privateToken: SceneToken = {
      ...publicToken,
      id: crypto.randomUUID(),
      label: 'V02 hidden token',
      controlledByUserIds: [],
      hidden: true,
      position: { x: 160, y: 80 }
    }
    let liveHead = await owner.client.query(api.scenes.liveReads.header, { sceneId: liveScene.id })
    const execute = async (token: SceneToken) => {
      const command: SceneGeometryExecuteInput = {
        input: {
          type: 'UPSERT_SCENE_TOKEN',
          sceneId: liveScene.id,
          expectedSceneVersion: liveHead.version,
          commandId: crypto.randomUUID(),
          token
        },
        presentation: { expectedPresentationVersion: presentation.version }
      }
      const result = await owner.client.action(api.scenes.geometryActions.execute, command)
      assert.equal(result.version, liveHead.version + 1)
      liveHead = await owner.client.query(api.scenes.liveReads.header, { sceneId: liveScene.id })
      assert.equal(liveHead.version, result.version)
    }
    await execute(publicToken)
    await execute(privateToken)
    assert.equal(liveHead.version, 2)
    await verifyDefinition()
    const onlinePublicTokenName = 'V02 connected browser token'
    let reconnectedTokenName: string | null = null
    const verifyRecipient = async (expectedPublicTokenName: string) => {
      const header = await input.player.client.query(api.scenes.recipientReads.header, {
        sceneId: liveScene.id
      })
      const tokens = await input.player.client.action(api.scenes.recipientActions.entities, {
        sceneId: liveScene.id,
        expectedVersion: header.version,
        expectedRecipientRevision: header.recipientRevision,
        collection: 'tokens',
        afterEntityId: null,
        numItems: 8
      })
      assert.equal(tokens.next, null)
      assert.deepEqual(
        tokens.page.flatMap(({ value }) =>
          value.collection === 'tokens' ? [{ id: value.entity.id, label: value.entity.label }] : []
        ),
        [{ id: publicToken.id, label: expectedPublicTokenName }]
      )
    }
    const liveSessionEndpoint = process.env.MANAGED_LIVE_SESSION_ENDPOINT
    assert.ok(
      liveSessionEndpoint,
      'MANAGED_LIVE_SESSION_ENDPOINT is required for native live proof.'
    )
    await verifySceneLiveBrowser({
      owner: input.owner,
      player: input.player,
      publicId: input.publicId,
      sceneName: definition.name,
      publicTokenName: publicToken.label,
      onlinePublicTokenName,
      privateTokenName: privateToken.label,
      privateTokenId: privateToken.id,
      evidenceDirectory,
      updateWhileDisconnected: async () => {
        owner.client.setAuth(await owner.fetchToken())
        input.player.client.setAuth(await input.player.fetchToken())
        const label = 'V02 reconnected token'
        await execute({ ...publicToken, label })
        reconnectedTokenName = label
        return label
      },
      liveSessionEndpoint,
      revokePlayer: async () => {
        const current = await owner.client.query(api.campaigns.queries.get, { id: campaignId })
        const member = current.memberships.find(
          (entry) => entry.userId === input.player.identity.userId
        )
        assert.ok(member)
        await owner.client.mutation(api.campaigns.membershipDeparture.removeMember, {
          campaignId,
          userId: input.player.identity.userId,
          commandId: crypto.randomUUID(),
          expectedCampaignVersion: current.version,
          expectedMembershipAccessStartedAt: member.accessStartedAt
        })
        await assert.rejects(() =>
          input.player.client.query(api.scenes.recipientReads.header, { sceneId: liveScene.id })
        )
      },
      verifyState: async (stage) => {
        const expectedPublicTokenName =
          stage === 'hydrated'
            ? publicToken.label
            : stage === 'live-updated'
              ? onlinePublicTokenName
              : reconnectedTokenName
        assert.ok(expectedPublicTokenName)
        await verifyRecipient(expectedPublicTokenName)
        liveHead = await owner.client.query(api.scenes.liveReads.header, { sceneId: liveScene.id })
        assert.equal(liveHead.version, stage === 'hydrated' ? 2 : stage === 'live-updated' ? 3 : 4)
      }
    })
    assert.equal(reconnectedTokenName, 'V02 reconnected token')
    assert.equal(
      (await owner.client.query(api.scenes.liveReads.header, { sceneId: liveScene.id })).version,
      4
    )
    await verifyDefinition()
    console.log('Native and browser Scene hydration/reconnect proof passed.')
  }
  if (input.verifyRetention) {
    assert.ok(sceneId && assetId)
    try {
      await owner.client.mutation(api.campaigns.ownership.request, {
        campaignId,
        recipientUserId: input.player.identity.userId
      })
      const transferred = await input.player.client.mutation(api.campaigns.ownership.accept, {
        campaignId
      })
      assert.equal(transferred.role, 'OWNER')
      assert.equal(
        (await owner.client.query(api.campaigns.queries.get, { id: campaignId })).role,
        'PLAYER'
      )
      await assert.rejects(
        owner.client.action(api.media.vttMapActions.getDelivery, { assetId }),
        /unavailable|presented/i
      )
      const delivery = await input.player.client.action(api.media.vttMapActions.getDelivery, {
        assetId
      })
      assert.equal(
        (
          await fetch(delivery.overview.url, {
            signal: AbortSignal.timeout(30_000)
          })
        ).status,
        200
      )
      await input.player.client.mutation(api.scenes.definitions.remove, {
        campaignId,
        sceneId,
        expectedVersion: 2
      })
      assert.equal(
        (await owner.client.query(api.account.identity, {})).userId,
        owner.identity.userId
      )
    } finally {
      const current = await owner.client.query(api.campaigns.queries.get, { id: campaignId })
      if (current.role === 'PLAYER') {
        await input.player.client.mutation(api.campaigns.ownership.request, {
          campaignId,
          recipientUserId: owner.identity.userId
        })
        const restored = await owner.client.mutation(api.campaigns.ownership.accept, { campaignId })
        assert.equal(restored.role, 'OWNER')
      }
    }
    await writeFile(
      join(evidenceDirectory, 'map-retention-checkpoints.json'),
      JSON.stringify({ definitionRemoved: true, ownershipRestored: true }, null, 2)
    )
    console.log('Native owner map transfer, delivery, definition removal, and restoration passed.')
  }
}
