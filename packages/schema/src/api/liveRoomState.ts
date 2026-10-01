import { z, lazySchema } from '../zod.js'
import { campaignSceneStateDtoSchema } from './vttScenes.js'
import { projectionChecksumSchema } from '../projections/identity.js'

export const liveRoomSceneStateSchema = lazySchema(() =>
  z.strictObject({ scene: z.nullable(campaignSceneStateDtoSchema) })
)

/** Content integrity is independent of the authority's cumulative write-set chain. */
export const liveRoomStoredSceneStateSchema = lazySchema(() =>
  z.strictObject({ state: liveRoomSceneStateSchema, contentChecksum: projectionChecksumSchema })
)

export type LiveRoomSceneState = z.infer<typeof liveRoomSceneStateSchema>
