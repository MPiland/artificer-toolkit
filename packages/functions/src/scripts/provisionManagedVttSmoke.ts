import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  createCampaignRepository,
  createCreatureRepository,
  createDb,
  createMediaRepository
} from '@artificer-toolkit/db'

import { assignCampaignCharacter, createCampaign } from '../services/campaign/campaignService.js'
import { createCampaignSession } from '../services/campaign/campaignSessionService.js'
import { createEncounter, createEncounterTemplate } from '../services/encounter/encounterService.js'
import {
  attachEncounterScene,
  createCampaignSceneDefinition
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
const GM_EMAIL = 'managed-vtt-gm@example.test'
const PLAYER_EMAIL = 'managed-vtt-player@example.test'
const HIDDEN_TOKEN_LABEL = 'Managed VTT GM-only sentinel'

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
  if (process.env.CONFIRM_MANAGED_VTT_SMOKE_PROVISION !== CONFIRMATION) {
    throw new Error(
      `Set CONFIRM_MANAGED_VTT_SMOKE_PROVISION=${CONFIRMATION} to provision the managed fixture.`
    )
  }

  const connectionString = assertRemoteUrl(
    'PROD_DATABASE_CONNECTION_STRING',
    requireEnvironment('PROD_DATABASE_CONNECTION_STRING')
  )
  const supabaseUrl = assertRemoteUrl('SUPABASE_URL', requireEnvironment('SUPABASE_URL'))
  const supabaseSecretKey = requireEnvironment('SUPABASE_SECRET_KEY')
  const gmPassword = requireEnvironment('MANAGED_VTT_GM_PASSWORD')
  const playerPassword = requireEnvironment('MANAGED_VTT_PLAYER_PASSWORD')
  const db = createDb({ connectionString })
  const admin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false }
  })

  try {
    const gm = await ensureSmokeUser(admin.auth.admin, {
      email: GM_EMAIL,
      password: gmPassword,
      username: 'managedvttgm'
    })
    const player = await ensureSmokeUser(admin.auth.admin, {
      email: PLAYER_EMAIL,
      password: playerPassword,
      username: 'managedvttplayer'
    })
    const existingCampaign = (await createCampaignRepository(db).listForActiveMember(gm.id)).find(
      (campaign) => campaign.name === CAMPAIGN_NAME
    )
    if (existingCampaign) {
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
    const resourcesById = new Map(sheet.resources.items.map((resource) => [resource.id, resource]))
    const linkedAction = sheet.actions.items.find(
      (action) =>
        action.resourceGrantId &&
        (action.resourceCost ?? 1) === 1 &&
        (resourcesById.get(action.resourceGrantId)?.remaining ?? 0) > 0
    )
    const linkedResourceIds = new Set(
      sheet.actions.items.flatMap((action) =>
        action.resourceGrantId ? [action.resourceGrantId] : []
      )
    )
    const standaloneResource = sheet.resources.items.find(
      (resource) => resource.remaining > 0 && !linkedResourceIds.has(resource.id)
    )
    const actionLabel = linkedAction?.label ?? standaloneResource?.label
    assert.ok(actionLabel, 'The smoke Character must expose one reversible cost-1 rule action.')

    const campaign = await createCampaign(db, gm.id, {
      name: CAMPAIGN_NAME,
      format: 'ONE_SHOT',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD'
    })
    await createCampaignRepository(db).activatePlayerMembership(
      campaign.id,
      player.id,
      new Date().toISOString()
    )
    await assignCampaignCharacter(db, gm.id, campaign.id, characterId)
    const session = await createCampaignSession(
      db,
      { campaignId: campaign.id, title: 'Managed VTT smoke session' },
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
    assert.ok(encounterCreature, 'The managed SRD corpus must include a charged creature feature.')
    const encounterTemplate = await createEncounterTemplate(db, gm.id, {
      campaignId: campaign.id,
      name: 'Managed VTT smoke encounter',
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

    const mapAssetId = randomUUID()
    const mapOverviewObjectKey = `managed-smoke/${campaign.id}/map-display.png`
    const mapTileObjectKey = `managed-smoke/${campaign.id}/map-tile-0-0.png`
    const media = createMediaRepository(db)
    await media.createPending({
      declaredBytes: 1_024,
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
            byte_size: 512,
            height: 1_000,
            id: randomUUID(),
            kind: 'DISPLAY',
            mime_type: 'image/png',
            object_key: mapOverviewObjectKey,
            width: 1_000
          }
        ],
        verifiedBytes: 1_024,
        verifiedMimeType: 'image/png',
        vttMapTiles: [
          {
            byte_size: 512,
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
    const mapPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+S4uR7wAAAABJRU5ErkJggg==',
      'base64'
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
          actorId: null,
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
          actorId: null,
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
    const attachedScene = await attachEncounterScene(db, gm.id, {
      commandId: randomUUID(),
      encounterId: encounter.id,
      sceneDefinitionId: sceneDefinition.id,
      type: 'ATTACH_SCENE'
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
        ruleActionLabel: `Use one ${actionLabel} charge`,
        sceneId: attachedScene.scene.id,
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
