import assert from 'node:assert/strict'
import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
  type EncounterGmProjectionDto,
  type EncounterExecuteInput,
  type EncounterBlueprintDto
} from '@artificer-toolkit/schema/api/encounters'
import type { CampaignSessionDto } from '@artificer-toolkit/schema/api/campaignSessions'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { api } from '../convex/_generated/api.js'
import type { DevelopmentClient } from './developmentClient'
import type { createEncounterLifecyclePolicyFixture } from './fixtures/encounterInitiative'
import {
  bindScene,
  bindToken,
  type verifyEncounterLifecycle
} from './developmentEncounterLifecycle'

export async function verifyEncounterAutomation({
  owner,
  player,
  campaignId,
  session,
  blueprint,
  characterId,
  policies,
  sceneFixture
}: {
  owner: DevelopmentClient
  player: DevelopmentClient
  campaignId: string
  session: CampaignSessionDto
  blueprint: EncounterBlueprintDto
  characterId: string
  policies: ReturnType<typeof createEncounterLifecyclePolicyFixture>
  sceneFixture: Pick<Awaited<ReturnType<typeof verifyEncounterLifecycle>>, 'scenes' | 'manualRun'>
}) {
  const campaign = await owner.query(api.campaigns.queries.get, { id: campaignId })
  await owner.mutation(api.campaigns.update.update, {
    campaignId,
    expectedVersion: campaign.version,
    additionalRulesCatalogueIds: [
      ...campaign.additionalRulesCatalogueIds,
      policies.bootstrap.catalogue.id
    ]
  })
  await player.mutation(api.campaigns.assignments.assign, { campaignId, characterId })
  await owner.mutation(api.campaigns.sessionAttendance.set, {
    campaignId,
    sessionId: session.id,
    expectedVersion: session.version,
    characterId,
    present: true
  })
  const revisedBlueprint = await owner.mutation(api.encounters.blueprints.update, {
    blueprintId: blueprint.id,
    expectedVersion: blueprint.version,
    name: 'V08 native initiative fixture',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CREATURE', sourceId: wolf.id },
      { kind: 'CREATURE', sourceId: wolf.id }
    ]
  })
  const sheet = await player.query(api.characters.sheet.get, { id: characterId })
  assert.ok(sheet)
  const scene = sceneFixture.scenes[0]
  const originalHeader = await owner.query(api.scenes.definitionReads.get, {
    campaignId,
    sceneId: scene.sceneId
  })
  const sceneEntitiesInput = {
    campaignId,
    sceneId: scene.sceneId,
    saveId: originalHeader.saveId,
    collection: 'tokens' as const,
    paginationOpts: { cursor: null, numItems: 8 }
  }
  const originalTokens = await owner.query(api.scenes.definitionReads.entities, sceneEntitiesInput)
  assert.equal(originalTokens.isDone, true)
  const previousPresentation = await owner.query(api.scenes.presentations.get, {
    campaignId,
    sessionId: session.id
  })
  assert.ok(previousPresentation)
  await owner.mutation(api.scenes.presentations.set, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    sessionId: session.id,
    sceneId: scene.liveSceneId,
    expectedPresentationVersion: previousPresentation.version
  })
  const presentation = await owner.query(api.scenes.presentations.get, {
    campaignId,
    sessionId: session.id
  })
  const completedRuns: EncounterGmProjectionDto[] = []
  for (const scenario of policies.scenarios) {
    const settings = await owner.query(api.campaigns.playSettings.get, { campaignId })
    const { version, updatedAt: _updatedAt, ...fields } = settings
    const configured = await owner.mutation(api.campaigns.playSettings.save, {
      ...fields,
      expectedVersion: version,
      automationMode: scenario.automationMode,
      initiativePolicyDefinitionId: scenario.definitionId,
      initiativeTieDefinitionId: null
    })
    const creation = {
      campaignId,
      sessionId: session.id,
      blueprintId: revisedBlueprint.id,
      commandId: crypto.randomUUID()
    }
    const prepared = encounterGmProjectionDtoSchema.parse(
      await owner.mutation(api.encounters.runs.create, creation)
    )
    assert.equal(prepared.status, 'PREPARED')
    assert.equal(prepared.automationMode, scenario.automationMode)
    assert.equal(prepared.initiativePolicy?.definitionId, scenario.definitionId)
    assert.equal(prepared.initiativePolicy.procedure, scenario.procedure)
    assert.equal(prepared.initiativePolicy.cadence, scenario.cadence)
    assert.equal(prepared.blueprintChecksum, revisedBlueprint.setupChecksum)
    assert.equal(prepared.actors.length, 3)
    const character = prepared.actors.find((actor) => actor.kind === 'CHARACTER')
    assert.ok(character)
    assert.equal(character.sourceId, characterId)
    assert.equal(character.currentHitPoints, sheet.overview.currentHitPoints)
    assert.equal(character.maxHitPoints, sheet.overview.maxHitPoints)
    assert.equal(character.tempHitPoints, sheet.overview.tempHitPoints)
    const wolves = prepared.actors.filter((actor) => actor.kind === 'CREATURE')
    assert.equal(wolves.length, 2)
    for (const actor of wolves) {
      assert.equal(actor.sourceId, wolf.id)
      assert.equal(actor.currentHitPoints, wolf.hitPoints)
      assert.equal(actor.statBlock?.armorClass, wolf.armorClass)
      assert.deepEqual(
        actor.features.map((feature) => feature.id),
        wolf.features?.map((feature) => feature.id) ?? []
      )
    }
    // A later Campaign settings change must not replace this Run's captured mode or policy.
    const { version: configuredVersion, updatedAt: _configuredAt, ...configuredFields } = configured
    await owner.mutation(api.campaigns.playSettings.save, {
      ...configuredFields,
      expectedVersion: configuredVersion,
      automationMode: 'MANUAL',
      initiativePolicyDefinitionId: null,
      initiativeTieDefinitionId: null
    })
    assert.deepEqual(await owner.mutation(api.encounters.runs.create, creation), prepared)
    let projection = prepared
    const sceneBindingInput = {
      type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE' as const,
      encounterId: prepared.id,
      commandId: crypto.randomUUID()
    }
    const sceneBinding = await owner.mutation(bindScene, sceneBindingInput)
    assert.equal(sceneBinding.sceneId, scene.liveSceneId)
    assert.equal(sceneBinding.replayed, false)
    const tokenBindingInput = {
      type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING' as const,
      encounterId: prepared.id,
      commandId: crypto.randomUUID(),
      actorId: character.id,
      sceneId: scene.liveSceneId,
      tokenId: scene.tokenIds[0],
      expectedEncounterVersion: projection.version
    }
    const tokenBinding = await owner.mutation(bindToken, { input: tokenBindingInput })
    projection = encounterGmProjectionDtoSchema.parse(tokenBinding.projection)
    assert.equal(projection.version, prepared.version + 1)
    let pendingResponses = 0
    const terminalRoots: Array<{
      input: EncounterExecuteInput
      result: ReturnType<typeof encounterCommandResultDtoSchema.parse>
    }> = []
    const resolutionInputs: EncounterExecuteInput[] = []
    const commandBase = () => ({
      encounterId: prepared.id,
      commandId: crypto.randomUUID(),
      expectedVersion: projection.version
    })
    async function execute(command: EncounterExecuteInput['command']) {
      let operation = 'root execution'
      try {
        const before = projection
        const input = { command }
        let result = encounterCommandResultDtoSchema.parse(
          await owner.mutation(api.encounters.commands.execute, input)
        )
        if (result.occurrence?.status === 'PENDING') {
          assert.deepEqual(result.projection, before)
          operation = 'root replay'
          assert.deepEqual(await owner.mutation(api.encounters.commands.execute, input), result)
        }
        for (let responseIndex = 0; result.occurrence?.status === 'PENDING'; responseIndex++) {
          assert.ok(
            responseIndex < 20,
            'Initiative failed to settle within its bounded fixture cohort.'
          )
          const pending = result.occurrence.pending
          assert.ok(pending)
          assert.deepEqual(
            await owner.query(api.encounters.projectionReads.get, { encounterId: prepared.id }),
            before
          )
          let resolution: Extract<
            EncounterExecuteInput['command'],
            { type: 'RESOLVE_RULE_OCCURRENCE' }
          >['resolution']
          if (pending.kind === 'INITIATIVE_EVIDENCE') {
            assert.equal(
              scenario.automationMode,
              'ASSISTED',
              'Automatic mode requested manual score entry.'
            )
            resolution = {
              kind: 'ENTER_INTEGER',
              requestId: pending.request.requestId,
              value: 20 - responseIndex
            }
          } else {
            assert.equal(pending.kind, 'INITIATIVE_ORDER')
            if (pending.kind !== 'INITIATIVE_ORDER')
              assert.fail('Unexpected lifecycle continuation.')
            assert.ok(pending.optionIds[0])
            resolution = {
              kind: 'INITIATIVE_ENTITY',
              requestId: pending.requestId,
              entityId: pending.optionIds[0]
            }
          }
          const continuation: EncounterExecuteInput = {
            command: {
              type: 'RESOLVE_RULE_OCCURRENCE',
              encounterId: prepared.id,
              commandId: crypto.randomUUID(),
              expectedVersion: before.version,
              correlationId: null,
              occurrenceId: result.occurrence.occurrenceId,
              expectedOccurrenceVersion: result.occurrence.occurrenceVersion,
              resolution
            }
          }
          const expectedOccurrenceVersion = result.occurrence.occurrenceVersion
          operation = `player denial responseIndex=${responseIndex} expectedOccurrenceVersion=${expectedOccurrenceVersion}`
          await assert.rejects(
            player.mutation(api.encounters.commands.execute, continuation),
            /Campaign not found/
          )
          const previousOccurrenceVersion = result.occurrence.occurrenceVersion
          operation = `continuation responseIndex=${responseIndex} expectedOccurrenceVersion=${expectedOccurrenceVersion}`
          result = encounterCommandResultDtoSchema.parse(
            await owner.mutation(api.encounters.commands.execute, continuation)
          )
          assert.ok(result.occurrence)
          assert.equal(result.occurrence.occurrenceVersion, previousOccurrenceVersion + 1)
          resolutionInputs.push(continuation)
          pendingResponses++
          if (result.occurrence.status === 'PENDING') assert.deepEqual(result.projection, before)
        }
        projection = encounterGmProjectionDtoSchema.parse(result.projection)
        assert.equal(projection.version, before.version + 1)
        assert.deepEqual(projection.initiativePolicy, prepared.initiativePolicy)
        assert.equal(projection.automationMode, scenario.automationMode)
        terminalRoots.push({ input, result })
        return result
      } catch (error) {
        throw new Error(
          `Encounter automation failed: automationMode=${scenario.automationMode} procedure=${scenario.procedure} cadence=${scenario.cadence} commandType=${command.type} operation=${operation}`,
          { cause: error }
        )
      }
    }
    await execute({ ...commandBase(), type: 'START' })
    assert.equal(projection.status, 'ACTIVE')
    assert.equal(projection.round, 1)
    const roundOneOrder: string[] = []
    for (let turn = 0; turn < 3; turn++) {
      assert.equal(projection.round, 1)
      assert.ok(projection.currentActorId)
      roundOneOrder.push(projection.currentActorId)
      await execute({ ...commandBase(), type: 'ADVANCE_TURN' })
    }
    assert.deepEqual([...roundOneOrder].sort(), prepared.actors.map((actor) => actor.id).sort())
    if (scenario.procedure === 'SIDE_ROLL') {
      const positions = wolves.map((actor) => roundOneOrder.indexOf(actor.id))
      assert.equal(Math.abs(positions[0]! - positions[1]!), 1, 'Side turns must remain contiguous.')
    }
    assert.equal(projection.round, 2)
    if (scenario.cadence === 'ENCOUNTER_START')
      assert.equal(projection.currentActorId, roundOneOrder[0])
    const roundTwoFirst = projection.currentActorId
    const roundTwoOrder: string[] = []
    for (let turn = 0; turn < 2; turn++) {
      assert.ok(projection.currentActorId)
      roundTwoOrder.push(projection.currentActorId)
      await execute({ ...commandBase(), type: 'ADVANCE_TURN' })
    }
    assert.ok(projection.currentActorId)
    const roundTwoLast = projection.currentActorId
    roundTwoOrder.push(roundTwoLast)
    assert.deepEqual([...roundTwoOrder].sort(), prepared.actors.map((actor) => actor.id).sort())
    const beforeCorrectionActors = projection.actors
    await execute({ ...commandBase(), type: 'SET_CURRENT_ACTOR', actorId: roundTwoFirst })
    assert.equal(projection.currentActorId, roundTwoFirst)
    assert.deepEqual(projection.actors, beforeCorrectionActors)
    await execute({ ...commandBase(), type: 'SET_CURRENT_ACTOR', actorId: roundTwoLast })
    await execute({ ...commandBase(), type: 'ADVANCE_TURN' })
    assert.equal(projection.round, 3)
    if (scenario.cadence === 'ENCOUNTER_START')
      assert.equal(projection.currentActorId, roundOneOrder[0])
    if (scenario.automationMode === 'ASSISTED' || scenario.procedure === 'SIDE_ROLL')
      assert.ok(pendingResponses > 0)

    await execute({ ...commandBase(), type: 'SET_CURRENT_ACTOR', actorId: wolves[0]!.id })
    for (const removed of wolves) {
      const command = { ...commandBase(), type: 'REMOVE_ACTOR' as const, actorId: removed.id }
      const beforeRemoval = projection
      await assert.rejects(
        player.mutation(api.encounters.commands.execute, { command }),
        /Campaign not found/
      )
      await assert.rejects(
        owner.mutation(api.encounters.commands.execute, {
          command: { ...command, expectedVersion: command.expectedVersion - 1 }
        }),
        /Encounter version is stale/
      )
      assert.deepEqual(
        await owner.query(api.encounters.projectionReads.get, { encounterId: prepared.id }),
        beforeRemoval
      )
      await execute(command)
      assert.deepEqual(
        projection.actors,
        beforeRemoval.actors.filter((actor) => actor.id !== removed.id)
      )
      assert.notEqual(projection.currentActorId, removed.id)
      assert.equal(projection.round, beforeRemoval.round)
    }
    assert.deepEqual(
      projection.actors.map((actor) => actor.id),
      [character.id]
    )
    assert.equal(projection.currentActorId, null)
    await execute({ ...commandBase(), type: 'SET_CURRENT_ACTOR', actorId: character.id })
    assert.equal(projection.currentActorId, character.id)
    const beforeSoloTurn = projection.round
    await execute({ ...commandBase(), type: 'ADVANCE_TURN' })
    assert.equal(projection.currentActorId, character.id)
    assert.equal(projection.round, beforeSoloTurn + 1)
    const insertionCursor = projection.currentActorId
    const initialActorIds = new Set(projection.actors.map((actor) => actor.id))
    await execute({
      ...commandBase(),
      type: 'REINFORCE',
      public: true,
      enemy: { kind: 'CUSTOM', label: 'Improvised scout', maxHitPoints: 9 },
      initiative: 0
    })
    assert.equal(projection.currentActorId, insertionCursor)
    assert.equal(projection.actors.length, 2)
    assert.deepEqual(
      await owner.query(api.encounters.projectionReads.get, { encounterId: prepared.id }),
      projection
    )
    const contenders = ['Improvised guard A', 'Improvised guard B'].map((label) => ({
      command: {
        ...commandBase(),
        type: 'REINFORCE' as const,
        public: true,
        enemy: { kind: 'CUSTOM' as const, label, maxHitPoints: 11 },
        initiative: 0
      }
    }))
    const contested = await Promise.allSettled(
      contenders.map((input) => owner.mutation(api.encounters.commands.execute, input))
    )
    const winnerIndex = contested.findIndex((result) => result.status === 'fulfilled')
    assert.notEqual(winnerIndex, -1)
    assert.equal(contested.filter((result) => result.status === 'fulfilled').length, 1)
    const loser = contested.find((result) => result.status === 'rejected')
    assert.ok(loser && loser.status === 'rejected')
    assert.match(String(loser.reason), /Encounter version is stale/)
    const winner = contested[winnerIndex]!
    assert.ok(winner.status === 'fulfilled')
    const winningResult = encounterCommandResultDtoSchema.parse(winner.value)
    const beforeContentionVersion = projection.version
    projection = encounterGmProjectionDtoSchema.parse(winningResult.projection)
    assert.equal(projection.version, beforeContentionVersion + 1)
    assert.equal(projection.actors.length, 3)
    assert.equal(projection.currentActorId, insertionCursor)
    terminalRoots.push({ input: contenders[winnerIndex]!, result: winningResult })
    await execute({
      ...commandBase(),
      type: 'REINFORCE',
      public: true,
      enemy: { kind: 'CREATURE', sourceId: wolf.id },
      initiative: 0
    })
    assert.equal(projection.currentActorId, insertionCursor)
    const reinforcedCreature = projection.actors.find((actor) => actor.kind === 'CREATURE')
    assert.ok(reinforcedCreature)
    assert.equal(reinforcedCreature.sourceId, wolf.id)
    assert.equal(reinforcedCreature.statBlock?.armorClass, wolf.armorClass)
    assert.deepEqual(
      reinforcedCreature.features.map((feature) => feature.id),
      wolf.features?.map((feature) => feature.id) ?? []
    )
    const reinforced = projection.actors.filter((actor) => !initialActorIds.has(actor.id))
    assert.equal(reinforced.length, 3)
    const firstEnemy = projection.actors.find((actor) => actor.kind !== 'CHARACTER')!
    await execute({ ...commandBase(), type: 'SET_CURRENT_ACTOR', actorId: firstEnemy.id })
    const actorIds = projection.actors.map((actor) => actor.id)
    const cursorIndex = actorIds.indexOf(firstEnemy.id)
    assert.ok(cursorIndex >= 0 && cursorIndex + 2 < actorIds.length)
    actorIds.splice(cursorIndex + 1, 2, actorIds[cursorIndex + 2]!, actorIds[cursorIndex + 1]!)
    const beforeReorderRound = projection.round
    await execute({ ...commandBase(), type: 'REORDER', actorIds })
    assert.deepEqual(
      projection.actors.map((actor) => actor.id),
      actorIds
    )
    assert.equal(projection.currentActorId, firstEnemy.id)
    assert.equal(projection.round, beforeReorderRound)
    await execute({ ...commandBase(), type: 'ADVANCE_TURN' })
    assert.equal(projection.currentActorId, actorIds[cursorIndex + 1])
    assert.equal(projection.round, beforeReorderRound)
    for (const actor of reinforced) {
      await execute({ ...commandBase(), type: 'REMOVE_ACTOR', actorId: actor.id })
    }
    assert.deepEqual(
      projection.actors.map((actor) => actor.id),
      [character.id]
    )
    await execute({ ...commandBase(), type: 'SET_CURRENT_ACTOR', actorId: character.id })
    const beforeReinforcementCleanupRound = projection.round
    await execute({ ...commandBase(), type: 'ADVANCE_TURN' })
    assert.equal(projection.currentActorId, character.id)
    assert.equal(projection.round, beforeReinforcementCleanupRound + 1)
    await execute({ ...commandBase(), type: 'COMPLETE' })
    assert.equal(projection.status, 'COMPLETED')
    const finalTimeline = await owner.query(api.encounters.timelineReads.timeline, {
      encounterId: prepared.id,
      limit: 100
    })
    for (const { input, result } of terminalRoots) {
      assert.deepEqual(await owner.mutation(api.encounters.commands.execute, input), result)
    }
    for (const input of resolutionInputs) {
      const replay = await owner.mutation(api.encounters.commands.execute, input)
      assert.deepEqual(replay.projection, projection)
      assert.equal(replay.occurrence?.status, 'COMPLETE')
    }
    assert.deepEqual(
      await owner.query(api.encounters.timelineReads.timeline, {
        encounterId: prepared.id,
        limit: 100
      }),
      finalTimeline
    )
    assert.deepEqual(await owner.mutation(api.encounters.runs.create, creation), projection)
    assert.deepEqual(await player.query(api.characters.sheet.get, { id: characterId }), sheet)
    assert.deepEqual(await owner.mutation(bindScene, sceneBindingInput), {
      ...sceneBinding,
      replayed: true
    })
    assert.deepEqual(await owner.mutation(bindToken, { input: tokenBindingInput }), tokenBinding)
    assert.deepEqual(
      await owner.query(api.scenes.definitionReads.get, { campaignId, sceneId: scene.sceneId }),
      originalHeader
    )
    assert.deepEqual(
      await owner.query(api.scenes.definitionReads.entities, sceneEntitiesInput),
      originalTokens
    )
    assert.deepEqual(
      await owner.query(api.scenes.presentations.get, { campaignId, sessionId: session.id }),
      presentation
    )
    for (const prior of [sceneFixture.manualRun, ...completedRuns]) {
      assert.deepEqual(
        await owner.query(api.encounters.projectionReads.get, { encounterId: prior.id }),
        prior
      )
    }
    completedRuns.push(projection)
    console.log(
      JSON.stringify({
        proof: 'V08 shared automation lifecycle',
        ...scenario,
        encounterId: prepared.id,
        pendingResponses,
        removedActorIds: wolves.map((actor) => actor.id),
        remainingActorId: character.id,
        status: 'PASS'
      })
    )
  }
  return completedRuns
}
