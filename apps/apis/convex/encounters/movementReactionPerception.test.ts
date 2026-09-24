import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'

import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounters'
import type { EncounterActorTokenBindingCommandInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { EncounterMovementReactionContact } from '@artificer-toolkit/rules-runtime/encounterMovementReactionContacts'
import type { EncounterMovementReactionSource } from '@artificer-toolkit/rules-runtime/encounterMovementReactionSources'
import { readRunActors, readRunState } from './documents'
import { loadMovementTargets } from './movementTargets'
import { createNativeMovementReactionPerception } from './movementReactionPerception'
import { createSpatialPreparationFixture } from '../../tests/fixtures/spatialPreparation'
import { requireIdentity } from '../lib/identity'
import { readLiveScene } from '../scenes/liveDocuments'

const bindActorToken = makeFunctionReference<
  'mutation',
  { input: EncounterActorTokenBindingCommandInputDto },
  EncounterCommandResultDto
>('encounters/actorTokenBindings:execute')

async function boundFixture() {
  const value = await createSpatialPreparationFixture()
  let version = value.base.run.version
  for (const [index, token] of value.base.tokens.entries()) {
    const actor = value.base.run.actors[index]
    if (!actor) throw new Error('Fixture Encounter actor is missing.')
    const result = await value.base.other.caller.mutation(bindActorToken, {
      input: {
        type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
        commandId: crypto.randomUUID(),
        encounterId: value.base.run.id,
        expectedEncounterVersion: version,
        actorId: actor.id,
        sceneId: value.base.sceneId,
        tokenId: token.id
      }
    })
    version = result.projection.version
  }
  return value
}

describe('native movement reaction perception', () => {
  it('uses current Run, Scene, target, and frozen-contact facts', async () => {
    const value = await boundFixture()
    let rejectForeignContext: (() => Promise<unknown>) | undefined
    await value.base.other.caller.run(async (ctx) => {
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (query) => query.eq('id', value.base.run.id))
        .unique()
      if (!run) throw new Error('Fixture Encounter Run is missing.')
      const state = readRunState(run)
      const actors = await readRunActors(ctx, state)
      const targets = await loadMovementTargets(ctx, {
        encounterId: state.id,
        expectedEncounterVersion: state.version,
        targetActorIds: actors.map((actor) => actor.id)
      })
      const [observer, moving] = actors
      const [observerToken, movingToken] = value.base.tokens.map((token) => ({
        ...token,
        id: token.id.toLowerCase()
      }))
      if (!observer || !moving || !observerToken || !movingToken)
        throw new Error('Fixture perception actors or tokens are missing.')
      const scene = {
        ambientIllumination: 'BRIGHT' as const,
        barriers: [],
        darknessZones: [],
        doorStates: {},
        grid: { kind: 'GRIDLESS' as const, pixelsPerUnit: 50, unit: 'FEET' as const },
        lights: [],
        tokens: [observerToken, movingToken]
      }
      const contact = {
        candidate: {
          contact: { x: observerToken.position.x + 1, y: observerToken.position.y },
          movingActorId: moving.id,
          pathDistance: 1,
          reactorActorId: observer.id,
          reactorTokenId: observerToken.id,
          sourceId: 'fixture',
          stage: 'ENTER_REACH' as const
        },
        contactSourceId: 'fixture',
        source: {
          reactorActorId: observer.id,
          reactorTokenId: observerToken.id,
          range: { rangeKind: 'DISTANCE' as const, amount: 5, unit: 'FEET' as const },
          source: {
            binding: {
              kind: 'MOVEMENT' as const,
              stage: 'ENTER_REACH' as const,
              perceptionRequirement: 'SEE' as const,
              eligibilityDefinitionId: crypto.randomUUID(),
              movementInterruption: null
            },
            capability: { actionId: crypto.randomUUID(), gameSystemId: state.gameSystemId }
          }
        }
      } as EncounterMovementReactionContact<EncounterMovementReactionSource>
      const input = {
        state,
        actors,
        targets,
        movingTokenId: movingToken.id,
        actorIdByTokenId: new Map([
          [observerToken.id, observer.id],
          [movingToken.id, moving.id]
        ]),
        sceneId: value.base.sceneId,
        sceneVersion: 0,
        scene,
        sceneGrid: scene.grid
      }

      const currentRead = {
        ctx,
        userId: (await requireIdentity(ctx)).userId,
        state,
        actors,
        header: (await readLiveScene(ctx, input.sceneId, 'MEMBER')).header
      }
      await expect(
        (await createNativeMovementReactionPerception(ctx, input, currentRead))(contact)
      ).resolves.toBe(true)
      await expect(
        createNativeMovementReactionPerception(
          ctx,
          { ...input, state: { ...state, version: state.version + 1 } },
          currentRead
        )
      ).rejects.toThrow('Encounter perception facts are stale.')
      await expect(
        createNativeMovementReactionPerception(
          ctx,
          { ...input, sceneVersion: input.sceneVersion + 1 },
          currentRead
        )
      ).rejects.toThrow('Scene perception facts are stale.')
      await expect(
        createNativeMovementReactionPerception(ctx, { ...input, actors: [] }, currentRead)
      ).rejects.toThrow('Encounter perception actors are stale.')
      await expect(
        createNativeMovementReactionPerception(ctx, { ...input, targets: new Map() }, currentRead)
      ).rejects.toThrow('Encounter actor perception target is unavailable.')
      rejectForeignContext = () =>
        value.base.other.caller.run(async (nextCtx) => {
          await createNativeMovementReactionPerception(nextCtx, input, currentRead)
        })
      await expect(
        (await createNativeMovementReactionPerception(ctx, input))(contact)
      ).resolves.toBe(true)
      await expect(
        (
          await createNativeMovementReactionPerception(ctx, {
            ...input,
            scene: { ...scene, ambientIllumination: 'MAGICAL_DARKNESS' }
          })
        )(contact)
      ).resolves.toBe(false)
      await expect(
        createNativeMovementReactionPerception(ctx, {
          ...input,
          sceneVersion: input.sceneVersion + 1
        })
      ).rejects.toThrow('Scene perception facts are stale.')
      await expect(
        createNativeMovementReactionPerception(ctx, { ...input, targets: new Map() })
      ).rejects.toThrow('Encounter actor perception target is unavailable.')
    })
    if (!rejectForeignContext) throw new Error('Fixture transaction context missing.')
    await expect(rejectForeignContext()).rejects.toThrow(
      'Movement perception read context belongs to another transaction.'
    )
  }, 30000)
})
