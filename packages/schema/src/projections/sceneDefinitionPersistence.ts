import { z, lazySchema } from '../zod.js'
import {
  sceneDefinitionHeaderSchema,
  sceneDefinitionCountsSchema,
  sceneDefinitionEntitySchema
} from '../api/sceneDefinitionSave.js'
import {
  sceneDefinitionSettingsDtoSchema,
  campaignScenePresentationDtoSchema,
  showCampaignSceneInputSchema
} from '../api/vttScenes.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { projectionChecksumSchema } from './identity.js'

export const sceneStoredDefinitionSchema = sceneDefinitionHeaderSchema
export const sceneStoredDefinitionSaveSchema = lazySchema(() =>
  z.strictObject({
    id: postgresUuidSchema,
    commandId: postgresUuidSchema,
    commandFingerprint: projectionChecksumSchema,
    ownerUserId: postgresUuidSchema,
    definitionId: postgresUuidSchema,
    expectedVersion: z.nullable(z.number().check(z.int()).check(z.positive())),
    settings: sceneDefinitionSettingsDtoSchema,
    counts: sceneDefinitionCountsSchema,
    received: sceneDefinitionCountsSchema,
    status: z.enum(['RECEIVING', 'PUBLISHED', 'EXPIRED']),
    liveSceneId: z.nullable(postgresUuidSchema),
    entitiesRemoved: z.boolean(),
    createdAt: z.iso.datetime(),
    expiresAt: z.number()
  })
)
export const sceneStoredDefinitionEntitySchema = lazySchema(() =>
  z.strictObject({
    saveId: postgresUuidSchema,
    // Scene entity UUID spelling is retained by the existing shared Scene contract.
    entityId: z.string().check(z.uuid()),
    ordinal: z.number().check(z.int()).check(z.gte(0)).check(z.lt(10000)),
    value: sceneDefinitionEntitySchema,
    checksum: projectionChecksumSchema
  })
)
// The immutable authoring save is also the initial live Scene snapshot. Live edits
// own their separate current entity state; editing a definition never mutates it.
export const sceneStoredInitialStateSchema = lazySchema(() =>
  z.extend(sceneDefinitionSettingsDtoSchema, {
    id: postgresUuidSchema,
    definitionId: postgresUuidSchema,
    definitionVersion: z.number().check(z.int()).check(z.positive()),
    definitionSaveId: postgresUuidSchema,
    version: z.literal(0),
    materializationCommandId: postgresUuidSchema,
    materializationCommandFingerprint: projectionChecksumSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime()
  })
)

export const sceneStoredPresentationSchema = lazySchema(() =>
  z.extend(campaignScenePresentationDtoSchema, {
    campaignId: postgresUuidSchema,
    // Server-derived from the presented Scene's map. Scene map identity is immutable.
    activeMapAssetId: z.nullable(postgresUuidSchema),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime()
  })
)
export const sceneStoredShowingSchema = lazySchema(() =>
  z.extend(showCampaignSceneInputSchema, {
    campaignId: postgresUuidSchema,
    sceneId: postgresUuidSchema,
    shownBy: postgresUuidSchema,
    shownAt: z.iso.datetime()
  })
)
