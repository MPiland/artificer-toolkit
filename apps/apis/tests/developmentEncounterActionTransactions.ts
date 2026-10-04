import assert from 'node:assert/strict'
import {
  type EncounterExecuteInput,
  type ResolveEncounterActionInputDto,
  encounterGmProjectionDtoSchema
} from '@artificer-toolkit/schema/api/encounters'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../convex/_generated/api.js'
import { type DevelopmentClient, executeEncounterCommand } from './developmentClient'
import {
  automaticChargedBiteEffectId,
  automaticChargedBiteFeatureId
} from './fixtures/encounterAction'

export async function verifyEncounterActionTransactions({
  owner,
  peer,
  duplicateCampaignId,
  contentionCampaignId,
  initiativePolicyDefinitionId,
  initiativePolicyCatalogueId,
  creatureId
}: {
  owner: DevelopmentClient
  peer: DevelopmentClient
  duplicateCampaignId: string
  contentionCampaignId: string
  initiativePolicyDefinitionId: string
  initiativePolicyCatalogueId: string
  creatureId: string
}) {
  assert.notEqual(owner, peer, 'Action contenders require independent clients.')
  assert.notEqual(duplicateCampaignId, contentionCampaignId)
  for (const campaignId of [duplicateCampaignId, contentionCampaignId]) {
    const campaign = await owner.query(api.campaigns.queries.get, { id: campaignId })
    if (!campaign.additionalRulesCatalogueIds.includes(initiativePolicyCatalogueId)) {
      await owner.mutation(api.campaigns.update.update, {
        campaignId,
        expectedVersion: campaign.version,
        additionalRulesCatalogueIds: [
          ...campaign.additionalRulesCatalogueIds,
          initiativePolicyCatalogueId
        ]
      })
    }
  }
  const blueprint = await owner.mutation(api.encounters.blueprints.create, {
    gameSystemId: srdSystemRecord.id,
    name: 'V14 action contention fixture',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CREATURE', sourceId: creatureId },
      { kind: 'CUSTOM', label: 'V14 target', maxHitPoints: 10 }
    ]
  })
  // Assisted with the GM's auto-roll on: initiative and the contended action roll on the server.
  await owner.mutation(api.account.setAutoRollDice, { autoRollDice: true })
  async function prepareActionRun(campaignId: string) {
    const settings = await owner.query(api.campaigns.playSettings.get, { campaignId })
    const { version, updatedAt: _updatedAt, ...fields } = settings
    await owner.mutation(api.campaigns.playSettings.save, {
      ...fields,
      expectedVersion: version,
      automationMode: 'ASSISTED',
      initiativePolicyDefinitionId,
      initiativeTieDefinitionId: null
    })
    const run = await owner.mutation(api.encounters.runs.create, {
      campaignId,
      blueprintId: blueprint.id,
      commandId: crypto.randomUUID()
    })
    let started = await owner.mutation(executeEncounterCommand, {
      command: {
        type: 'START',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: run.version
      }
    })
    for (let resolutions = 0; started.occurrence?.status === 'PENDING'; resolutions++) {
      assert.ok(resolutions < 20, 'V14 action initiative did not settle.')
      const pending = started.occurrence.pending
      if (pending?.kind !== 'INITIATIVE_ORDER')
        throw new Error('V14 action fixture requested an unexpected initiative continuation.')
      const entityId = pending.optionIds[0]
      if (!entityId) throw new Error('V14 action fixture has no initiative choice.')
      started = await owner.mutation(executeEncounterCommand, {
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: run.version,
          correlationId: null,
          occurrenceId: started.occurrence.occurrenceId,
          expectedOccurrenceVersion: started.occurrence.occurrenceVersion,
          resolution: { kind: 'INITIATIVE_ENTITY', requestId: pending.requestId, entityId }
        }
      })
    }
    const active = encounterGmProjectionDtoSchema.parse(started.projection)
    const source = active.actors.find(
      (actor) => actor.kind === 'CREATURE' && actor.sourceId === creatureId
    )
    const target = active.actors.find((actor) => actor.kind === 'CUSTOM')
    if (!source || !target) throw new Error('V14 action fixture actors are unavailable.')
    const current =
      active.currentActorId === source.id
        ? active
        : encounterGmProjectionDtoSchema.parse(
            (
              await owner.mutation(executeEncounterCommand, {
                command: {
                  type: 'SET_CURRENT_ACTOR',
                  encounterId: active.id,
                  commandId: crypto.randomUUID(),
                  expectedVersion: active.version,
                  actorId: source.id
                }
              })
            ).projection
          )
    const sourceAfterCurrent = current.actors.find((actor) => actor.id === source.id)
    const targetAfterCurrent = current.actors.find((actor) => actor.id === target.id)
    if (!sourceAfterCurrent || !targetAfterCurrent)
      throw new Error('V14 action fixture changed actors before contention.')
    const feature = sourceAfterCurrent.features.find(
      (candidate) => candidate.id === automaticChargedBiteFeatureId
    )
    const resource = feature?.resource
    if (!feature || !resource) throw new Error('V14 action fixture resource is unavailable.')
    return {
      run: current,
      source: sourceAfterCurrent,
      target: targetAfterCurrent,
      feature,
      resource,
      actionId: `${source.id}:FEATURE:${automaticChargedBiteFeatureId}:EFFECT:${automaticChargedBiteEffectId}`
    }
  }
  const command = (
    fixture: Awaited<ReturnType<typeof prepareActionRun>>,
    commandId: string
  ): { command: ResolveEncounterActionInputDto } => ({
    command: {
      type: 'RESOLVE_ACTION',
      acceptedWieldConflict: null,
      acknowledgedWarnings: [],
      encounterId: fixture.run.id,
      commandId,
      expectedVersion: fixture.run.version,
      actorId: fixture.source.id,
      targetActorId: fixture.target.id,
      actionId: fixture.actionId,
      optionalCombatIntent: null,
      sceneContext: null
    }
  })
  const duplicateFixture = await prepareActionRun(duplicateCampaignId)
  const duplicateInput = command(duplicateFixture, crypto.randomUUID())
  const contentionFixture = await prepareActionRun(contentionCampaignId)
  assert.notEqual(duplicateFixture.run.id, contentionFixture.run.id)
  const contenders = [
    command(contentionFixture, crypto.randomUUID()),
    command(contentionFixture, crypto.randomUUID())
  ] as const
  const [duplicate, results] = await Promise.all([
    Promise.all([
      owner.mutation(executeEncounterCommand, duplicateInput),
      peer.mutation(executeEncounterCommand, duplicateInput)
    ]),
    Promise.allSettled([
      owner.mutation(executeEncounterCommand, contenders[0]),
      peer.mutation(executeEncounterCommand, contenders[1])
    ])
  ])
  assert.deepEqual(duplicate[0], duplicate[1])
  const duplicateRun = encounterGmProjectionDtoSchema.parse(
    await owner.query(api.encounters.projectionReads.get, { encounterId: duplicateFixture.run.id })
  )
  assert.equal(duplicateRun.version, duplicateFixture.run.version + 1)
  const duplicateSource = duplicateRun.actors.find(
    (actor) => actor.id === duplicateFixture.source.id
  )
  const duplicateTarget = duplicateRun.actors.find(
    (actor) => actor.id === duplicateFixture.target.id
  )
  const duplicateFeature = duplicateSource?.features.find(
    (candidate) => candidate.id === automaticChargedBiteFeatureId
  )
  if (!duplicateTarget || !duplicateFeature?.resource)
    throw new Error('V14 duplicate action result actors are unavailable.')
  assert.equal(duplicateTarget.currentHitPoints, duplicateFixture.target.currentHitPoints - 1)
  assert.equal(duplicateFeature.resource.used, duplicateFixture.resource.used + 1)
  assert.equal(duplicateFeature.resource.remaining, duplicateFixture.resource.remaining - 1)
  assert.deepEqual(await owner.mutation(executeEncounterCommand, duplicateInput), duplicate[0])
  assert.deepEqual(
    await owner.query(api.encounters.projectionReads.get, { encounterId: duplicateFixture.run.id }),
    duplicateRun
  )
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  const winnerIndex = results.findIndex((result) => result.status === 'fulfilled')
  const winner = results[winnerIndex]
  const loser = results[1 - winnerIndex]
  if (!winner || winner.status !== 'fulfilled' || !loser || loser.status !== 'rejected')
    throw new Error('V14 action contention did not produce one winner and one stale loser.')
  assert.match(String(loser.reason), /stale/)
  const afterWinner = encounterGmProjectionDtoSchema.parse(
    await owner.query(api.encounters.projectionReads.get, { encounterId: contentionFixture.run.id })
  )
  assert.equal(afterWinner.version, contentionFixture.run.version + 1)
  const source = afterWinner.actors.find((actor) => actor.id === contentionFixture.source.id)
  const target = afterWinner.actors.find((actor) => actor.id === contentionFixture.target.id)
  const feature = source?.features.find(
    (candidate) => candidate.id === automaticChargedBiteFeatureId
  )
  if (!source || !target || !feature?.resource)
    throw new Error('V14 action result actors are unavailable.')
  assert.equal(target.currentHitPoints, contentionFixture.target.currentHitPoints - 1)
  assert.equal(feature.resource.used, contentionFixture.resource.used + 1)
  assert.equal(feature.resource.remaining, contentionFixture.resource.remaining - 1)
  assert.deepEqual(
    await owner.mutation(executeEncounterCommand, contenders[winnerIndex]),
    winner.value
  )
  assert.deepEqual(
    await owner.query(api.encounters.projectionReads.get, {
      encounterId: contentionFixture.run.id
    }),
    afterWinner
  )
  const winnerCommand = contenders[winnerIndex]?.command
  if (!winnerCommand) throw new Error('V14 action contention winner input is unavailable.')
  const changedPayload: EncounterExecuteInput = {
    command: {
      type: 'RESOLVE_ACTION',
      acceptedWieldConflict: null,
      acknowledgedWarnings: [],
      encounterId: winnerCommand.encounterId,
      commandId: winnerCommand.commandId,
      expectedVersion: winnerCommand.expectedVersion,
      actorId: winnerCommand.actorId,
      targetActorId: contentionFixture.source.id,
      actionId: winnerCommand.actionId,
      optionalCombatIntent: winnerCommand.optionalCombatIntent,
      sceneContext: winnerCommand.sceneContext
    }
  }
  await assert.rejects(owner.mutation(executeEncounterCommand, changedPayload), /different input/)
  assert.deepEqual(
    await owner.query(api.encounters.projectionReads.get, {
      encounterId: contentionFixture.run.id
    }),
    afterWinner
  )
  assert.deepEqual(
    await owner.query(api.encounters.projectionReads.get, { encounterId: duplicateFixture.run.id }),
    duplicateRun
  )
  console.log('V14 native RESOLVE_ACTION contention, duplicate replay, and receipt checks passed.')
}
