import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  createAccountProfileRepository,
  createCampaignRepository,
  createDb,
  createMediaRepository,
  createVttSceneRepository,
  srdBaselineContent
} from '@artificer-toolkit/db'
import { createUniformSceneFogLayer } from '@artificer-toolkit/shared/vtt'
import sharp from 'sharp'

import { assignCampaignCharacter, createCampaign } from '../services/campaign/campaignService.js'
import { createCampaignSession } from '../services/campaign/campaignSessionService.js'
import {
  createEncounter,
  createEncounterBlueprint,
  executeEncounterCommand
} from '../services/encounter/encounterService.js'
import {
  bindEncounterToPresentedScene,
  createCampaignSceneDefinition,
  executeEncounterSceneCommand,
  setCampaignLiveScenePresentation
} from '../services/encounter/vttSceneService.js'
import { proveFixtureLifecycle } from './characterLifecycleIntegrationBuilderProof.js'
import {
  findFixtureCatalog,
  type BuilderResolutionTiming,
  type CharacterLifecycleFixture,
  type CharacterRuleEvaluationTiming,
  type SheetReadTiming
} from './characterLifecycleIntegrationFixtures.js'

const CONFIRMATION = 'provision-managed-vtt-smoke'
const CAMPAIGN_NAME = 'Artificer managed VTT smoke'
const HIDDEN_TOKEN_LABEL = 'Managed VTT GM-only sentinel'
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url))

interface SmokeUser {
  id: string
  email: string
}

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function assertRemoteUrl(name: string, rawValue: string): string {
  const value = new URL(rawValue)
  if (value.hostname === '127.0.0.1' || value.hostname === 'localhost') {
    throw new Error(`${name} must target the managed Supabase project.`)
  }
  return value.toString().replace(/\/$/u, '')
}

function loadLocalEnvironment(): void {
  const environmentPath = `${repoRoot}/.env.local`
  if (!existsSync(environmentPath)) {
    throw new Error('Root .env.local is required to provision the local VTT smoke fixture.')
  }
  for (const [key, value] of Object.entries(parseEnv(readFileSync(environmentPath, 'utf8')))) {
    if (
      key.startsWith('NETLIFY_') ||
      key.startsWith('PROD_') ||
      key.startsWith('STAGING_') ||
      key === 'MANAGED_LIVE_SESSION_ENDPOINT' ||
      key === 'MANAGED_VTT_BASE_URL' ||
      key === 'SUPABASE_ACCESS_TOKEN'
    ) {
      continue
    }
    process.env[key] = value
  }
}

function assertLoopbackUrl(name: string, rawValue: string): string {
  const value = new URL(rawValue)
  if (!LOCAL_HOSTS.has(value.hostname.toLowerCase())) {
    throw new Error(`${name} must target local Supabase for the local VTT smoke fixture.`)
  }
  return value.toString().replace(/\/$/u, '')
}

async function ensureSmokeUser(
  admin: SupabaseClient['auth']['admin'],
  input: { email: string; password: string; username: string }
): Promise<SmokeUser> {
  let page = 1
  let existingId: string | null = null
  while (!existingId) {
    const { data, error } = await admin.listUsers({ page, perPage: 100 })
    if (error) throw error
    existingId =
      data.users.find((user) => user.email?.toLocaleLowerCase() === input.email)?.id ?? null
    if (existingId || !data.nextPage) break
    page = data.nextPage
  }

  if (existingId) {
    const { data, error } = await admin.updateUserById(existingId, {
      email_confirm: true,
      password: input.password,
      user_metadata: { purpose: CAMPAIGN_NAME, username: input.username }
    })
    if (error) throw error
    return { email: input.email, id: data.user.id }
  }

  const { data, error } = await admin.createUser({
    email: input.email,
    email_confirm: true,
    password: input.password,
    user_metadata: { purpose: CAMPAIGN_NAME, username: input.username }
  })
  if (error) throw error
  if (!data.user) throw new Error(`Supabase did not create ${input.email}.`)
  return { email: input.email, id: data.user.id }
}

async function main(): Promise<void> {
  const local = process.argv.includes('--local')
  const staging = process.argv.includes('--staging')
  const production = process.argv.includes('--production')
  if ([local, staging, production].filter(Boolean).length !== 1) {
    throw new Error('Pass exactly one of --local, --staging, or --production.')
  }
  if (local) loadLocalEnvironment()
  if (!local && process.env.CONFIRM_MANAGED_VTT_SMOKE_PROVISION !== CONFIRMATION) {
    throw new Error(
      `Set CONFIRM_MANAGED_VTT_SMOKE_PROVISION=${CONFIRMATION} to provision the managed fixture.`
    )
  }

  const prefix = staging ? 'STAGING_' : production ? 'PROD_' : ''
  const connectionName = `${prefix}DATABASE_CONNECTION_STRING`
  const supabaseUrlName = `${prefix}SUPABASE_URL`
  const supabaseSecretKeyName = `${prefix}SUPABASE_SECRET_KEY`
  const connectionString = (local ? assertLoopbackUrl : assertRemoteUrl)(
    connectionName,
    requireEnvironment(connectionName)
  )
  const supabaseUrl = (local ? assertLoopbackUrl : assertRemoteUrl)(
    supabaseUrlName,
    requireEnvironment(supabaseUrlName)
  )
  const supabaseSecretKey = requireEnvironment(supabaseSecretKeyName)
  const gmEmail = requireEnvironment('MANAGED_VTT_GM_EMAIL')
  const gmPassword = requireEnvironment('MANAGED_VTT_GM_PASSWORD')
  const playerEmail = requireEnvironment('MANAGED_VTT_PLAYER_EMAIL')
  const playerPassword = requireEnvironment('MANAGED_VTT_PLAYER_PASSWORD')
  const player2Email = requireEnvironment('MANAGED_VTT_PLAYER2_EMAIL')
  const player2Password = requireEnvironment('MANAGED_VTT_PLAYER2_PASSWORD')
  const db = createDb({ connectionString, connectionTimeoutMillis: 60_000 })
  const admin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false }
  })

  try {
    const gm = await ensureSmokeUser(admin.auth.admin, {
      email: gmEmail,
      password: gmPassword,
      username: 'managedvttgm'
    })
    const player = await ensureSmokeUser(admin.auth.admin, {
      email: playerEmail,
      password: playerPassword,
      username: 'managedvttplayer'
    })
    const player2 = await ensureSmokeUser(admin.auth.admin, {
      email: player2Email,
      password: player2Password,
      username: 'managedvttplayer2'
    })
    const profiles = createAccountProfileRepository(db)
    await profiles.upsertForUser(gm.id, { bio: null, username: 'managedvttgm' })
    await profiles.upsertForUser(player.id, { bio: null, username: 'managedvttplayer' })
    await profiles.upsertForUser(player2.id, { bio: null, username: 'managedvttplayer2' })
    const existingCampaign = (await createCampaignRepository(db).listForActiveMember(gm.id)).find(
      (campaign) => campaign.name === CAMPAIGN_NAME
    )
    if (existingCampaign) {
      if (local) {
        console.info(
          JSON.stringify({
            localVttSmokeFixture: {
              campaignId: existingCampaign.id,
              campaignName: CAMPAIGN_NAME,
              reused: true
            }
          })
        )
        return
      }
      throw new Error(
        `The dedicated Campaign already exists (${existingCampaign.id}); refusing to create a duplicate.`
      )
    }

    const catalog = await findFixtureCatalog(db)
    const characterId = randomUUID()
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
      label: 'Managed VTT smoke Character',
      preparedCasterClassId: catalog.clericId,
      raceId: catalog.dragonbornId,
      raceLabel: 'Dragonborn'
    }
    const builderTimings: BuilderResolutionTiming[] = []
    const sheetTimings: SheetReadTiming[] = []
    const ruleTimings: CharacterRuleEvaluationTiming[] = []
    const sheet = await proveFixtureLifecycle(
      db,
      fixture,
      builderTimings,
      sheetTimings,
      ruleTimings
    )

    const campaign = await createCampaign(db, gm.id, {
      name: CAMPAIGN_NAME,
      format: 'ONE_SHOT',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: '00000000-0000-0000-0000-000000000001',
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301'
    })
    await createCampaignRepository(db).activatePlayerMembership(
      campaign.id,
      player.id,
      new Date().toISOString()
    )
    await createCampaignRepository(db).activatePlayerMembership(
      campaign.id,
      player2.id,
      new Date().toISOString()
    )
    await assignCampaignCharacter(db, gm.id, campaign.id, characterId)
    const session = await createCampaignSession(
      db,
      { campaignId: campaign.id, title: 'Managed VTT smoke session' },
      gm.id
    )

    const encounterCreatures = srdBaselineContent.subjects.creatures.filter(
      (creature) => creature.label === 'Acolyte' && creature.systemId === catalog.systemId
    )
    assert.equal(
      encounterCreatures.length,
      1,
      'The managed SRD corpus must include exactly one canonical Acolyte for the seeded system.'
    )
    const encounterCreature = encounterCreatures[0]
    assert.ok(encounterCreature, 'The managed SRD corpus must include a charged creature feature.')
    const hasChargedFeature =
      encounterCreature.features?.some((feature) =>
        feature.grants?.spells?.some(
          (spell) =>
            'charges' in spell &&
            spell.charges?.scalingKind === 'NONE' &&
            spell.charges.limitKind === 'FIXED_AMOUNT' &&
            spell.charges.amount > 0
        )
      ) ?? false
    assert.ok(hasChargedFeature, 'The canonical Acolyte must include a charged creature feature.')
    const encounterBlueprint = await createEncounterBlueprint(db, gm.id, {
      gameSystemId: encounterCreature.systemId,
      name: 'Managed VTT smoke encounter',
      enemies: [{ kind: 'CREATURE', sourceId: encounterCreature.id }],
      commandId: randomUUID()
    })
    const encounter = await createEncounter(db, gm.id, {
      campaignId: campaign.id,
      sessionId: session.id,
      blueprintId: encounterBlueprint.id,
      commandId: randomUUID()
    })
    const mapAssetId = randomUUID()
    const mapOverviewObjectKey = `managed-smoke/${campaign.id}/map-display.png`
    const mapTileObjectKey = `managed-smoke/${campaign.id}/map-tile-0-0.png`
    const mapPng = await sharp({
      create: {
        background: { alpha: 1, b: 32, g: 28, r: 24 },
        channels: 4,
        height: 1_000,
        width: 1_000
      }
    })
      .png()
      .toBuffer()
    const media = createMediaRepository(db)
    await media.createPending({
      declaredBytes: mapPng.length,
      declaredMimeType: 'image/png',
      id: mapAssetId,
      idempotencyKey: randomUUID(),
      originalFileName: 'managed-vtt-smoke-map.png',
      ownerUserId: gm.id,
      profile: 'VTT_MAP',
      rawObjectKey: `managed-smoke/${campaign.id}/map-original.png`,
      targetKey: `VTT_MAP:${campaign.id}`
    })
    assert.ok(await media.claimForProcessing(mapAssetId, gm.id))
    assert.equal(
      await media.replaceReady({
        assetId: mapAssetId,
        height: 1_000,
        ownerUserId: gm.id,
        quotaBytes: 100_000_000,
        reservationBytes: 26_214_400,
        variants: [
          {
            byte_size: mapPng.length,
            height: 1_000,
            id: randomUUID(),
            kind: 'DISPLAY',
            mime_type: 'image/png',
            object_key: mapOverviewObjectKey,
            width: 1_000
          }
        ],
        verifiedBytes: mapPng.length,
        verifiedMimeType: 'image/png',
        vttMapTiles: [
          {
            byte_size: mapPng.length,
            column_index: 0,
            height: 1_000,
            object_key: mapTileObjectKey,
            row_index: 0,
            width: 1_000
          }
        ],
        width: 1_000
      }),
      true
    )
    for (const objectKey of [mapOverviewObjectKey, mapTileObjectKey]) {
      const { error } = await admin.storage.from('media').upload(objectKey, mapPng, {
        contentType: 'image/png',
        upsert: true
      })
      if (error) throw error
    }

    const doorId = randomUUID()
    const sceneDefinition = await createCampaignSceneDefinition(db, gm.id, {
      annotations: [
        {
          id: randomUUID(),
          position: { x: 20, y: 20 },
          text: 'Managed smoke GM-only note',
          visibility: 'GM_ONLY'
        }
      ],
      barriers: [
        {
          a: { x: 50, y: 0 },
          b: { x: 50, y: 100 },
          blocksLightWhenClosed: true,
          blocksMovementWhenClosed: true,
          id: doorId,
          initialState: 'CLOSED',
          kind: 'DOOR',
          openAngleDegrees: 90
        }
      ],
      ambientIllumination: 'BRIGHT',
      campaignId: campaign.id,
      darknessZones: [],
      fogMode: 'SHARED_PARTY',
      grid: {
        cellSize: 50,
        diagonalPolicy: 'EQUAL',
        distancePerCell: 5,
        kind: 'SQUARE',
        origin: { x: 0, y: 0 },
        unit: 'FEET'
      },
      lights: [],
      map: { assetId: mapAssetId, height: 1_000, tileManifestAssetId: null, width: 1_000 },
      name: 'Managed VTT smoke scene',
      tokens: [
        {
          assetId: null,
          controlledByUserIds: [player.id],
          height: 1,
          hidden: false,
          id: randomUUID(),
          label: 'Managed player token',
          locked: false,
          position: { x: 20, y: 20 },
          rotationDegrees: 0,
          vision: null,
          width: 1
        },
        {
          assetId: null,
          controlledByUserIds: [player2.id],
          height: 1,
          hidden: false,
          id: randomUUID(),
          label: 'Managed second player token',
          locked: false,
          position: { x: 20, y: 80 },
          rotationDegrees: 0,
          vision: null,
          width: 1
        },
        {
          assetId: null,
          controlledByUserIds: [],
          height: 1,
          hidden: true,
          id: randomUUID(),
          label: HIDDEN_TOKEN_LABEL,
          locked: false,
          position: { x: 80, y: 20 },
          rotationDegrees: 0,
          vision: null,
          width: 1
        }
      ],
      visionRevealMode: 'ON_DROP'
    })
    const liveScene = (await createVttSceneRepository(db).listLiveScenes(campaign.id)).find(
      (candidate) => candidate.state.definitionId === sceneDefinition.id
    )
    assert.ok(liveScene, 'Creating a Campaign Scene definition must materialize its live Scene.')
    await setCampaignLiveScenePresentation(db, gm.id, {
      commandId: randomUUID(),
      expectedPresentationVersion: null,
      sceneId: liveScene.state.id,
      sessionId: session.id,
      type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
    })
    await bindEncounterToPresentedScene(db, gm.id, {
      commandId: randomUUID(),
      encounterId: encounter.id,
      type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE'
    })
    await executeEncounterSceneCommand(db, gm.id, {
      commandId: randomUUID(),
      expectedSceneVersion: liveScene.state.version,
      layer: createUniformSceneFogLayer(liveScene.state, {
        explored: true,
        ownerUserId: null
      }),
      sceneId: liveScene.state.id,
      type: 'PATCH_SCENE_FOG'
    })
    await executeEncounterCommand(db, gm.id, {
      commandId: randomUUID(),
      encounterId: encounter.id,
      expectedVersion: encounter.version,
      systemId: encounterCreature.systemId,
      type: 'START'
    })

    console.info(
      JSON.stringify({
        campaignId: campaign.id,
        campaignName: CAMPAIGN_NAME,
        characterSheetPath: `/characters/${sheet.publicId}/sheet`,
        doorId,
        gmEmail: gm.email,
        gmOnlyTokenLabel: HIDDEN_TOKEN_LABEL,
        mapAssetId,
        playerEmail: player.email,
        player2Email: player2.email,
        sceneId: liveScene.state.id,
        sessionId: session.id,
        tabletopPath: `/tabletop/campaigns/${encodeURIComponent(campaign.publicId)}/sessions/${session.sessionNumber}`
      })
    )
  } finally {
    await db.destroy()
  }
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
