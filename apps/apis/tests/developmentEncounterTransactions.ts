import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import type { FunctionReference } from 'convex/server'
import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
  type EncounterExecuteInput
} from '@artificer-toolkit/schema/api/encounters'
import {
  bindEncounterToPresentedSceneResultDtoSchema,
  type BindEncounterToPresentedSceneInputDto,
  type EncounterActorTokenBindingCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { campaignSessionDtoSchema } from '@artificer-toolkit/schema/api/campaignSessions'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { api } from '../convex/_generated/api.js'
import {
  assertDomainRejection,
  type DevelopmentClient,
  executeEncounterCommand
} from './developmentClient'
import {
  bindScene,
  bindToken,
  type verifyEncounterLifecycle
} from './developmentEncounterLifecycle'

export async function verifyEncounterTransactions({
  owner,
  player,
  ownerUserId,
  playerUserId,
  campaignId,
  fixture,
  rollback,
  concurrent,
  checkpoint
}: {
  owner: DevelopmentClient & Pick<ConvexHttpClient, 'action'>
  player: DevelopmentClient
  /** Publishes the room's committed commands; Convex reads show a held Run only after one. */
  checkpoint: () => Promise<void>
  ownerUserId: string
  playerUserId: string
  campaignId: string
  fixture: Awaited<ReturnType<typeof verifyEncounterLifecycle>>
  /**
   * Forces Convex's own token-binding mutation to roll back. Absent when a live room holds the Run:
   * its bindings are room commands and Convex fences its own path (D47), so the in-process run
   * covers it.
   */
  rollback?: (input: {
    encounterId: string
    operation: { kind: 'TOKEN_BINDING'; input: EncounterActorTokenBindingCommandInputDto }
  }) => Promise<unknown>
  concurrent: (
    actor: 'OWNER' | 'PLAYER',
    reference: FunctionReference<'mutation', 'public', Record<string, unknown>, unknown>,
    args: Record<string, unknown>
  ) => Promise<unknown>
}) {
  async function sceneState() {
    return Promise.all(
      fixture.scenes.map(async (scene) => {
        const header = await owner.query(api.scenes.definitionReads.get, {
          campaignId,
          sceneId: scene.sceneId
        })
        const tokens = await owner.query(api.scenes.definitionReads.entities, {
          campaignId,
          sceneId: scene.sceneId,
          saveId: header.saveId,
          collection: 'tokens',
          paginationOpts: { cursor: null, numItems: 8 }
        })
        assert.equal(tokens.isDone, true)
        return { header, tokens }
      })
    )
  }
  const originalScenes = await sceneState()
  const prepared = encounterGmProjectionDtoSchema.parse(
    await owner.mutation(api.encounters.runs.create, {
      campaignId,
      blueprintId: fixture.blueprint.id,
      commandId: crypto.randomUUID()
    })
  )
  assert.equal(prepared.automationMode, 'MANUAL')
  const start: EncounterExecuteInput = {
    command: {
      type: 'START',
      encounterId: prepared.id,
      commandId: crypto.randomUUID(),
      expectedVersion: prepared.version
    }
  }
  // The room client refuses a second pending submission of one command, so identical-command
  // replay is asserted after the first answer (below); competing STARTs are V08's native proof.
  const started = encounterCommandResultDtoSchema.parse(
    await owner.mutation(executeEncounterCommand, start)
  )
  let projection = encounterGmProjectionDtoSchema.parse(started.projection)
  assert.equal(projection.status, 'ACTIVE')
  let bindingInput: BindEncounterToPresentedSceneInputDto = {
    type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
    encounterId: prepared.id,
    commandId: crypto.randomUUID()
  }
  const previousPresentation = await owner.query(api.scenes.presentations.get, { campaignId })
  assert.ok(previousPresentation)
  const competingBinding = { ...bindingInput, commandId: crypto.randomUUID() }
  const bindings = await Promise.allSettled([
    concurrent('OWNER', bindScene, bindingInput),
    concurrent('OWNER', bindScene, competingBinding),
    // A presentation change goes through the room while it is live, as the tabletop sends it.
    owner.action(api.scenes.presentations.setLive, {
      type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
      commandId: crypto.randomUUID(),
      campaignId,
      sceneId: fixture.scenes[1].liveSceneId,
      expectedPresentationVersion: previousPresentation.version
    })
  ])
  assert.equal(bindings[2]!.status, 'fulfilled')
  assert.equal(bindings.slice(0, 2).filter((result) => result.status === 'fulfilled').length, 1)
  const bindingWinner = bindings[0]!.status === 'fulfilled' ? 0 : 1
  const bindingResult = bindings[bindingWinner]!
  assert.equal(bindingResult.status, 'fulfilled')
  const bindingLoser = bindings[1 - bindingWinner]!
  assert.equal(bindingLoser.status, 'rejected')
  if (bindingLoser.status === 'rejected')
    assert.match(String(bindingLoser.reason), /different.*binding/)
  if (bindingWinner === 1) bindingInput = competingBinding
  const bound = bindEncounterToPresentedSceneResultDtoSchema.parse(bindingResult.value)
  assert.equal(bound.replayed, false)
  const scene = fixture.scenes.find((candidate) => candidate.liveSceneId === bound.sceneId)
  assert.ok(scene)
  // The presentation raced the binding, and the room moves Encounter tokens only on its presented
  // Scene (D42): present the bound Scene again if the race left another one up.
  await checkpoint()
  const presented = await owner.query(api.scenes.presentations.get, { campaignId })
  assert.ok(presented)
  if (presented.sceneId !== bound.sceneId)
    await owner.action(api.scenes.presentations.setLive, {
      type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
      commandId: crypto.randomUUID(),
      campaignId,
      sceneId: bound.sceneId,
      expectedPresentationVersion: presented.version
    })
  assert.deepEqual(await owner.mutation(bindScene, bindingInput), { ...bound, replayed: true })
  const actor = projection.actors.find((candidate) => candidate.kind === 'CHARACTER')
  assert.ok(actor?.sourceId)
  let tokenInput: EncounterActorTokenBindingCommandInputDto = {
    type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
    encounterId: prepared.id,
    commandId: crypto.randomUUID(),
    expectedEncounterVersion: projection.version,
    actorId: actor.id,
    sceneId: bound.sceneId,
    tokenId: scene.tokenIds[0]
  }
  if (rollback)
    assert.deepEqual(
      await rollback({
        encounterId: prepared.id,
        operation: { kind: 'TOKEN_BINDING', input: tokenInput }
      }),
      { rolledBack: true }
    )
  const otherActor = projection.actors.find((candidate) => candidate.id !== actor.id)
  assert.ok(otherActor)
  const competingToken = { ...tokenInput, actorId: otherActor.id, commandId: crypto.randomUUID() }
  const tokenResults = await Promise.allSettled([
    concurrent('OWNER', bindToken, { input: tokenInput }),
    concurrent('OWNER', bindToken, { input: competingToken })
  ])
  assert.equal(
    tokenResults.filter((result) => result.status === 'fulfilled').length,
    1,
    JSON.stringify(
      tokenResults.map((result) => (result.status === 'fulfilled' ? 'ok' : String(result.reason)))
    )
  )
  const tokenWinner = tokenResults[0]!.status === 'fulfilled' ? 0 : 1
  const tokenSuccess = tokenResults[tokenWinner]!
  assert.equal(tokenSuccess.status, 'fulfilled')
  const tokenFailure = tokenResults[1 - tokenWinner]!
  if (tokenFailure.status === 'rejected') assert.match(String(tokenFailure.reason), /changed/)
  const losingActorId = tokenWinner === 0 ? otherActor.id : actor.id
  if (tokenWinner === 1) tokenInput = competingToken
  const tokenResult = encounterCommandResultDtoSchema.parse(tokenSuccess.value)
  projection = encounterGmProjectionDtoSchema.parse(tokenResult.projection)
  assert.equal(projection.version, tokenInput.expectedEncounterVersion + 1)
  await assert.rejects(
    owner.mutation(bindToken, {
      input: {
        ...tokenInput,
        actorId: losingActorId,
        commandId: crypto.randomUUID(),
        expectedEncounterVersion: projection.version
      }
    }),
    /already bound/
  )
  const advance = (): EncounterExecuteInput => ({
    command: {
      type: 'ADVANCE_TURN',
      encounterId: prepared.id,
      commandId: crypto.randomUUID(),
      expectedVersion: projection.version
    }
  })
  const firstAdvance = advance()
  const secondAdvance = advance()
  const advances = await Promise.allSettled([
    concurrent('OWNER', executeEncounterCommand, firstAdvance),
    concurrent('OWNER', executeEncounterCommand, secondAdvance)
  ])
  assert.equal(advances.filter((result) => result.status === 'fulfilled').length, 1)
  for (const result of advances) {
    if (result.status === 'fulfilled') {
      const next = encounterGmProjectionDtoSchema.parse(
        encounterCommandResultDtoSchema.parse(result.value).projection
      )
      assert.equal(next.version, projection.version + 1)
      projection = next
    } else assertDomainRejection(result.reason, 'VERSION_STALE')
  }
  const beforeTransferActors = projection.actors
  const transferAdvance = advance()
  await owner.mutation(api.campaigns.ownership.request, {
    campaignId,
    recipientUserId: playerUserId
  })
  try {
    const transfer = await Promise.allSettled([
      concurrent('OWNER', executeEncounterCommand, transferAdvance),
      concurrent('PLAYER', api.campaigns.ownership.accept, { campaignId })
    ])
    const accepted = transfer[1]!
    assert.equal(accepted.status, 'fulfilled')
    const formerOwner = await owner.query(api.campaigns.queries.get, { id: campaignId })
    assert.equal(formerOwner.role, 'PLAYER')
    if (transfer[0]!.status === 'rejected')
      // The room plans the former owner's advance as a player, who does not control the actor.
      assert.match(String(transfer[0]!.reason), /NOT_ACTOR_CONTROLLER/)
    // Convex holds the room's commands only after a save point (D86).
    await checkpoint()
    const current = encounterGmProjectionDtoSchema.parse(
      await player.query(api.encounters.projectionReads.get, { encounterId: prepared.id })
    )
    assert.equal(
      current.version,
      projection.version + (transfer[0]!.status === 'fulfilled' ? 1 : 0)
    )
    assert.deepEqual(current.actors, beforeTransferActors)
    projection = current
    await assert.rejects(owner.mutation(executeEncounterCommand, advance()), /NOT_ACTOR_CONTROLLER/)
  } finally {
    const current: CampaignDetailDto = await player.query(api.campaigns.queries.get, {
      id: campaignId
    })
    if (current.role === 'OWNER') {
      await player.mutation(api.campaigns.ownership.request, {
        campaignId,
        recipientUserId: ownerUserId
      })
      await owner.mutation(api.campaigns.ownership.accept, { campaignId })
    }
  }
  assert.equal((await owner.query(api.campaigns.queries.get, { id: campaignId })).role, 'OWNER')
  // Becoming the Campaign owner removes the player's Character assignment.
  assert.deepEqual(
    await player.mutation(api.campaigns.assignments.assign, {
      campaignId,
      characterId: actor.sourceId
    }),
    { ok: true }
  )
  await checkpoint()
  const replayProjection = await owner.query(api.encounters.projectionReads.get, {
    encounterId: prepared.id
  })
  assert.deepEqual(await owner.mutation(executeEncounterCommand, start), {
    ...started,
    projection: replayProjection
  })
  assert.deepEqual(await owner.mutation(bindScene, bindingInput), { ...bound, replayed: true })
  assert.deepEqual(await owner.mutation(bindToken, { input: tokenInput }), {
    ...tokenResult,
    projection: replayProjection
  })
  const complete: EncounterExecuteInput = {
    command: {
      type: 'COMPLETE',
      encounterId: prepared.id,
      commandId: crypto.randomUUID(),
      expectedVersion: projection.version
    }
  }
  // Session finish is Session-log bookkeeping only; the Campaign-owned Run is unaffected by it.
  const session = await owner.mutation(api.campaigns.sessions.create, { campaignId })
  const finishInput = {
    campaignId,
    sessionId: session.id,
    expectedVersion: session.version,
    commandId: crypto.randomUUID()
  }
  const finishes = await Promise.allSettled([
    concurrent('OWNER', executeEncounterCommand, complete),
    concurrent('OWNER', api.campaigns.sessionFinish.finish, finishInput)
  ])
  const [completeResult, finishResult] = finishes
  assert.equal(completeResult.status, 'fulfilled')
  assert.equal(finishResult.status, 'fulfilled')
  const finished = campaignSessionDtoSchema.parse(finishResult.value)
  assert.equal(finished.status, 'FINISHED')
  assert.equal(finished.version, session.version + 1)
  const completed = encounterGmProjectionDtoSchema.parse(
    encounterCommandResultDtoSchema.parse(completeResult.value).projection
  )
  assert.equal(completed.status, 'COMPLETED')
  assert.equal(completed.version, projection.version + 1)
  projection = completed
  assert.deepEqual(await owner.mutation(api.campaigns.sessionFinish.finish, finishInput), finished)
  assert.deepEqual(await owner.mutation(executeEncounterCommand, start), { ...started, projection })
  // COMPLETE deletes the Scene binding (ADR 0035 Amendment 30): once Convex holds the finished Run
  // the room journal still replays retries of both, but a new command is refused.
  await checkpoint()
  assert.deepEqual(await owner.mutation(bindScene, bindingInput), { ...bound, replayed: true })
  assert.deepEqual(await owner.mutation(bindToken, { input: tokenInput }), {
    ...tokenResult,
    projection
  })
  await assert.rejects(
    owner.mutation(bindScene, { ...bindingInput, commandId: crypto.randomUUID() }),
    /Completed/
  )
  await assert.rejects(
    owner.mutation(bindToken, {
      input: {
        ...tokenInput,
        commandId: crypto.randomUUID(),
        expectedEncounterVersion: projection.version
      }
    }),
    /Completed/
  )
  assert.deepEqual(
    await owner.query(api.encounters.projectionReads.get, { encounterId: prepared.id }),
    projection
  )
  assert.deepEqual(await sceneState(), originalScenes)
  console.log(
    'V08 forced rollback and concurrent command/binding/presentation/ownership/Session-finish schedules passed.'
  )
  return {
    projection,
    sceneId: bound.sceneId,
    actorId: tokenInput.actorId,
    tokenId: tokenInput.tokenId
  }
}
