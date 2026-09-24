'use node'

import { makeFunctionReference } from 'convex/server'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { sceneGeometryFinishInputSchema } from '@artificer-toolkit/schema/api/sceneGeometry'
import {
  sceneMovementPerceptionCaptureSchema,
  sceneMovementPerceptionEnvironmentSchema,
  type SceneMovementPerceptionCapture,
  type SceneMovementPerceptionEnvironment,
  type sceneSpatialPrepareInputSchema
} from '@artificer-toolkit/schema/api/sceneMovementPerception'
import {
  sceneSpatialPreparationSchema,
  type SceneSpatialPreparation
} from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import type {
  SceneCurrentEntityPage,
  SceneCurrentEntityPageInput
} from '@artificer-toolkit/schema/api/sceneRecipient'
import {
  resolveSceneCombatPerceptionEnvironment,
  type CampaignSceneState
} from '@artificer-toolkit/shared/vtt'
import { internalAction, type ActionCtx } from '../_generated/server'

type Request = ReturnType<typeof sceneGeometryFinishInputSchema.parse>
const captureReference = makeFunctionReference<'mutation', Request, SceneMovementPerceptionCapture>(
  'scenes/movementPerception:capture'
)
const prepareReference = makeFunctionReference<
  'mutation',
  ReturnType<typeof sceneSpatialPrepareInputSchema.parse>,
  SceneSpatialPreparation
>('scenes/spatialPreparation:prepare')
const entitiesReference = makeFunctionReference<
  'query',
  SceneCurrentEntityPageInput,
  SceneCurrentEntityPage
>('scenes/recipientReads:currentEntities')

/** Hydrates large geometry in bounded reads and sends only contact environment facts to the mutation. */
export const prepare = internalAction({
  args: zodToConvexFields(sceneGeometryFinishInputSchema.shape),
  returns: zodToConvex(sceneSpatialPreparationSchema),
  handler: async (ctx, args): Promise<SceneSpatialPreparation> => {
    return (await prepareSceneMovement(ctx, sceneGeometryFinishInputSchema.parse(args))).preparation
  }
})

/** Keeps server-derived contact evidence available for the final publication recheck. */
export async function prepareSceneMovement(
  ctx: Pick<ActionCtx, 'runQuery' | 'runMutation'>,
  input: Request
) {
  const capture = sceneMovementPerceptionCaptureSchema.parse(
    await ctx.runMutation(captureReference, input)
  )
  const { header } = capture
  const scene: Pick<
    CampaignSceneState,
    'ambientIllumination' | 'grid' | 'barriers' | 'lights' | 'darknessZones' | 'doorStates'
  > = {
    ambientIllumination: header.ambientIllumination,
    grid: capture.grid,
    barriers: [],
    lights: [],
    darknessZones: [],
    doorStates: {}
  }
  if (capture.requests.length > 0) {
    for (const collection of ['barriers', 'lights', 'darknessZones'] as const) {
      const ids = new Set<string>()
      const ordinals = new Set<number>()
      let next: SceneCurrentEntityPage['next'] = { phase: 'BASE', afterOrdinal: null }
      while (next) {
        const request: SceneCurrentEntityPageInput = {
          sceneId: capture.sceneId,
          expectedVersion: capture.sceneVersion,
          definitionSaveId: header.definitionSaveId,
          collection,
          numItems: 8,
          ...next
        }
        const page = await ctx.runQuery(entitiesReference, request)
        if (page.version !== capture.sceneVersion || page.collection !== collection)
          throw new Error('Scene perception snapshot changed before hydration.')
        for (const entry of page.page) {
          const { value, ordinal } = entry
          if (value.collection !== collection || ids.has(value.entity.id) || ordinals.has(ordinal))
            throw new Error('Scene perception geometry identities are inconsistent.')
          ids.add(value.entity.id)
          ordinals.add(ordinal)
          if (value.collection === 'barriers') {
            scene.barriers.push(value.entity)
            if (value.entity.kind === 'DOOR') {
              if (entry.doorState === null)
                throw new Error('Scene perception door state is unavailable.')
              scene.doorStates[value.entity.id] = entry.doorState
            }
          } else if (value.collection === 'lights') scene.lights.push(value.entity)
          else if (value.collection === 'darknessZones') scene.darknessZones.push(value.entity)
        }
        if (
          ids.size > header.currentCounts[collection] ||
          (page.next &&
            ((request.phase === 'APPENDED' && page.next.phase === 'BASE') ||
              (request.phase === page.next.phase &&
                (page.next.afterOrdinal ?? -1) <= (request.afterOrdinal ?? -1))))
        )
          throw new Error('Scene perception geometry pagination is inconsistent.')
        next = page.next
      }
      if (ids.size !== header.currentCounts[collection])
        throw new Error('Scene perception geometry is incomplete.')
    }
  }
  const perceptionEnvironments: SceneMovementPerceptionEnvironment[] = capture.requests.map(
    (request) =>
      sceneMovementPerceptionEnvironmentSchema.parse({
        key: request.key,
        environment: resolveSceneCombatPerceptionEnvironment({
          scene,
          observer: request.observer,
          subject: request.subject,
          sharedSurface: true,
          invisibleChannels: [],
          suppressedChannels: []
        })
      })
  )
  const preparation = await ctx.runMutation(prepareReference, { ...input, perceptionEnvironments })
  return { preparation, perceptionEnvironments }
}
