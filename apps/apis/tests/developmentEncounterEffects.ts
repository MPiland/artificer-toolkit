import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import {
  type EncounterCommandResultDto,
  type EncounterExecuteInput,
  encounterGmProjectionDtoSchema,
  encounterPlayerProjectionDtoSchema,
  type ResolveEncounterActionInputDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterActionChoicesResponseDto,
  GetEncounterActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import type {
  SceneFogAppendInput,
  SceneFogCommandResult,
  SceneFogPatchInput,
  SceneFogSaveProgress
} from '@artificer-toolkit/schema/api/sceneFog'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  createUniformSceneFogLayer,
  type SceneExplorationState
} from '@artificer-toolkit/shared/vtt'
import { api } from '../convex/_generated/api.js'
import { type DevelopmentClient, executeEncounterCommand } from './developmentClient'
import { encounterEffectFeatureId, encounterEffectId } from './fixtures/encounterEffects'

const actionChoices = makeFunctionReference<
  'query',
  GetEncounterActionChoicesInputDto,
  EncounterActionChoicesResponseDto
>('encounters/actionChoices:get')
const beginFog = makeFunctionReference<
  'mutation',
  { input: SceneFogPatchInput },
  SceneFogSaveProgress
>('scenes/fogCommands:begin')
const appendFog = makeFunctionReference<
  'mutation',
  { input: SceneFogAppendInput },
  SceneFogSaveProgress
>('scenes/fogCommands:append')
const publishFog = makeFunctionReference<'mutation', { saveId: string }, SceneFogCommandResult>(
  'scenes/fogCommands:publish'
)

export type EncounterEffectsBrowserFixture = {
  scene: { id: string; name: string }
  actionLabel: string
  targetLabel: string
  targetTokenLabel: string
  expectedConditionLabel: string | null
}

export type EncounterEffectsBrowserControls = {
  resolveAction: () => Promise<{
    command: ResolveEncounterActionInputDto
    result: EncounterCommandResultDto
  }>
  assertPendingPrivacy: () => Promise<void>
  resolveEvidence: (
    expected: ResolveRuleOccurrenceInputDto
  ) => Promise<{ command: ResolveRuleOccurrenceInputDto; result: EncounterCommandResultDto }>
  assertTerminal: () => Promise<void>
}

export type EncounterEffectsBrowserRunner = (
  fixture: EncounterEffectsBrowserFixture,
  verify: (controls: EncounterEffectsBrowserControls) => Promise<void>
) => Promise<void>

type EncounterEffectsBaseInput = {
  player: DevelopmentClient
  campaignId: string
  initiativePolicyDefinitionId: string
  initiativePolicyCatalogueId: string
  creatureId: string
  targetCreatureId?: string
}

type EncounterEffectsInput =
  | (EncounterEffectsBaseInput & {
      owner: DevelopmentClient
      playerUserId?: string
      browser?: undefined
    })
  | (EncounterEffectsBaseInput & {
      owner: DevelopmentClient & Pick<ConvexHttpClient, 'action'>
      playerUserId: string
      browser: EncounterEffectsBrowserRunner
    })
function conditionIds(conditions: unknown): string[] {
  if (!Array.isArray(conditions)) throw new Error('Encounter conditions are unavailable.')
  return conditions.map((condition) => {
    if (typeof condition === 'string') return condition
    if (
      typeof condition === 'object' &&
      condition !== null &&
      !Array.isArray(condition) &&
      'conditionTypeId' in condition &&
      typeof condition.conditionTypeId === 'string'
    )
      return condition.conditionTypeId
    throw new Error('Encounter condition has an invalid public shape.')
  })
}

export async function verifyEncounterEffects({
  owner,
  player,
  campaignId,
  initiativePolicyDefinitionId,
  initiativePolicyCatalogueId,
  creatureId,
  targetCreatureId = creatureId,
  playerUserId,
  browser
}: EncounterEffectsInput) {
  assert.notEqual(owner, player, 'Action-effect verification requires independent clients.')
  const frightened = srdSystemRecord.conditionTypes.find(
    (condition) => condition.code === 'FRIGHTENED'
  )
  if (!frightened) throw new Error('The SRD Frightened condition is unavailable.')

  let campaign = await owner.query(api.campaigns.queries.get, { id: campaignId })
  if (!campaign.additionalRulesCatalogueIds.includes(initiativePolicyCatalogueId)) {
    await owner.mutation(api.campaigns.update.update, {
      campaignId,
      expectedVersion: campaign.version,
      additionalRulesCatalogueIds: [
        ...campaign.additionalRulesCatalogueIds,
        initiativePolicyCatalogueId
      ]
    })
    campaign = await owner.query(api.campaigns.queries.get, { id: campaignId })
  }
  // The GM issues the save; with auto-roll off, Assisted prompts for its d20 evidence.
  await owner.mutation(api.account.setAutoRollDice, { autoRollDice: false })
  const settings = await owner.query(api.campaigns.playSettings.get, { campaignId })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await owner.mutation(api.campaigns.playSettings.save, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId,
    initiativeTieDefinitionId: null
  })
  const blueprint = await owner.mutation(api.encounters.blueprints.create, {
    gameSystemId: campaign.gameSystemId,
    name: 'Action-effect fixture',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CREATURE', sourceId: creatureId },
      { kind: 'CREATURE', sourceId: targetCreatureId }
    ]
  })

  async function prepareRun() {
    const created = await owner.mutation(api.encounters.runs.create, {
      campaignId,
      blueprintId: blueprint.id,
      commandId: crypto.randomUUID()
    })
    let started = await owner.mutation(executeEncounterCommand, {
      command: {
        type: 'START',
        encounterId: created.id,
        commandId: crypto.randomUUID(),
        expectedVersion: created.version
      }
    })
    for (let resolutions = 0; started.occurrence?.status === 'PENDING'; resolutions++) {
      assert.ok(resolutions < 20, 'Action-effect initiative did not settle.')
      const pending = started.occurrence.pending
      let resolution: Extract<
        EncounterExecuteInput['command'],
        { type: 'RESOLVE_RULE_OCCURRENCE' }
      >['resolution']
      if (pending?.kind === 'INITIATIVE_EVIDENCE') {
        resolution = {
          kind: 'ENTER_INTEGER',
          requestId: pending.request.requestId,
          value: pending.request.max
        }
      } else if (pending?.kind === 'INITIATIVE_ORDER') {
        const entityId = pending.optionIds[0]
        if (!entityId) throw new Error('Action-effect fixture has no initiative choice.')
        resolution = { kind: 'INITIATIVE_ENTITY', requestId: pending.requestId, entityId }
      } else {
        throw new Error('Action-effect fixture requested an unexpected initiative continuation.')
      }
      started = await owner.mutation(executeEncounterCommand, {
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: created.id,
          commandId: crypto.randomUUID(),
          expectedVersion: started.projection.version,
          correlationId: null,
          occurrenceId: started.occurrence.occurrenceId,
          expectedOccurrenceVersion: started.occurrence.occurrenceVersion,
          resolution
        }
      })
    }
    let run = encounterGmProjectionDtoSchema.parse(started.projection)
    const source = run.actors.find(
      (actor) => actor.kind === 'CREATURE' && actor.sourceId === creatureId
    )
    const target = run.actors.find(
      (actor) =>
        actor.kind === 'CREATURE' &&
        actor.sourceId === targetCreatureId &&
        (targetCreatureId !== creatureId || actor.id !== source?.id)
    )
    if (!source || !target) throw new Error('Action-effect fixture actors are unavailable.')
    if (run.currentActorId !== source.id) {
      run = encounterGmProjectionDtoSchema.parse(
        (
          await owner.mutation(executeEncounterCommand, {
            command: {
              type: 'SET_CURRENT_ACTOR',
              encounterId: run.id,
              commandId: crypto.randomUUID(),
              expectedVersion: run.version,
              actorId: source.id
            }
          })
        ).projection
      )
    }
    const currentSource = run.actors.find((actor) => actor.id === source.id)
    const currentTarget = run.actors.find((actor) => actor.id === target.id)
    if (!currentSource || !currentTarget)
      throw new Error('Action-effect fixture actors changed during setup.')
    return { run, source: currentSource, target: currentTarget }
  }

  for (const { face, expectedConditions } of [
    { face: 1, expectedConditions: [frightened.id] },
    { face: 20, expectedConditions: [] }
  ]) {
    const prepared = await prepareRun()
    let run = prepared.run
    let source = prepared.source
    let target = prepared.target
    let scene: EncounterEffectsBrowserFixture['scene'] | undefined
    let sceneContext: ResolveEncounterActionInputDto['sceneContext'] = null
    let targetTokenLabel: string | undefined
    if (browser) {
      const browserPlayerUserId = playerUserId
      if (!browserPlayerUserId)
        throw new Error('Action-effect browser fixture requires the player user ID.')
      const { createEncounterLifecycleScene } = await import('./developmentEncounterScenes')
      const { bindScene, bindToken } = await import('./developmentEncounterLifecycle')
      const sourceTokenId = crypto.randomUUID()
      const targetTokenId = crypto.randomUUID()
      const name = `Action-effect browser scene ${face}`
      const sourceTokenLabel = `Action-effect source ${face}`
      targetTokenLabel = `Action-effect target ${face}`
      const preparedScene = await createEncounterLifecycleScene({
        owner,
        campaignId,
        name,
        options: {
          map: { width: 400, height: 200 },
          grid: {
            kind: 'SQUARE',
            origin: { x: 0, y: 0 },
            cellSize: 100,
            distancePerCell: 5,
            diagonalPolicy: 'EQUAL',
            unit: 'FEET'
          },
          tokens: [
            {
              id: sourceTokenId,
              assetId: null,
              controlledByUserIds: [],
              height: 100,
              hidden: false,
              label: sourceTokenLabel,
              locked: false,
              position: { x: 50, y: 50 },
              rotationDegrees: 0,
              vision: null,
              width: 100
            },
            {
              id: targetTokenId,
              assetId: null,
              controlledByUserIds: [],
              height: 100,
              hidden: false,
              label: targetTokenLabel,
              locked: false,
              position: { x: 150, y: 50 },
              rotationDegrees: 0,
              vision: null,
              width: 100
            }
          ]
        }
      })
      const presentation = await owner.query(api.scenes.presentations.get, { campaignId })
      await owner.mutation(api.scenes.presentations.set, {
        type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
        commandId: crypto.randomUUID(),
        campaignId,
        sceneId: preparedScene.liveSceneId,
        expectedPresentationVersion: presentation?.version ?? null
      })
      await owner.mutation(bindScene, {
        type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
        encounterId: run.id,
        commandId: crypto.randomUUID()
      })
      run = encounterGmProjectionDtoSchema.parse(
        await owner.query(api.encounters.projectionReads.get, { encounterId: run.id })
      )
      for (const [actorId, tokenId] of [
        [source.id, sourceTokenId],
        [target.id, targetTokenId]
      ] as const) {
        run = encounterGmProjectionDtoSchema.parse(
          (
            await owner.mutation(bindToken, {
              input: {
                type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
                commandId: crypto.randomUUID(),
                encounterId: run.id,
                expectedEncounterVersion: run.version,
                actorId,
                sceneId: preparedScene.liveSceneId,
                tokenId
              }
            })
          ).projection
        )
      }
      source = run.actors.find((actor) => actor.id === source.id) ?? source
      target = run.actors.find((actor) => actor.id === target.id) ?? target
      const fogHeader = await owner.query(api.scenes.liveReads.header, {
        sceneId: preparedScene.liveSceneId
      })
      const fogState = {
        map: {
          assetId: preparedScene.assetId,
          height: 200,
          tileManifestAssetId: null,
          width: 400
        },
        grid: {
          kind: 'SQUARE' as const,
          origin: { x: 0, y: 0 },
          cellSize: 100,
          distancePerCell: 5,
          diagonalPolicy: 'EQUAL' as const,
          unit: 'FEET' as const
        },
        tokens: [],
        barriers: [],
        doorStates: {},
        fogMode: 'PER_PLAYER' as const,
        fogLayers: []
      } satisfies SceneExplorationState
      const fogLayer = createUniformSceneFogLayer(fogState, {
        explored: true,
        ownerUserId: browserPlayerUserId
      })
      const commandId = crypto.randomUUID()
      const fogSave = await owner.mutation(beginFog, {
        input: {
          type: 'PATCH_SCENE_FOG',
          sceneId: preparedScene.liveSceneId,
          commandId,
          expectedSceneVersion: fogHeader.version,
          layer: {
            ownerUserId: fogLayer.ownerUserId,
            width: fogLayer.width,
            height: fogLayer.height
          },
          chunkManifest: fogLayer.chunks.map((chunk) => ({
            index: chunk.index,
            checksum: checksumCanonicalJson(chunk)
          }))
        }
      })
      for (let offset = 0; offset < fogLayer.chunks.length; offset += 8) {
        const chunkBatch = fogLayer.chunks.slice(offset, offset + 8)
        assert.ok(chunkBatch.length)
        const appended: SceneFogSaveProgress = await owner.mutation(appendFog, {
          input: { saveId: fogSave.saveId, offset, chunks: chunkBatch }
        })
        assert.equal(appended.receivedChunks, Math.min(offset + 8, fogLayer.chunks.length))
      }
      const fog = await owner.mutation(publishFog, { saveId: fogSave.saveId })
      assert.equal(fog.replayed, false)
      const header = await owner.query(api.scenes.recipientReads.header, {
        sceneId: preparedScene.liveSceneId
      })
      sceneContext = {
        sceneId: preparedScene.liveSceneId,
        expectedSceneVersion: header.version,
        sourceTokenId,
        targetTokenId
      }
      scene = { id: preparedScene.liveSceneId, name }
    }
    let root: ResolveEncounterActionInputDto = {
      type: 'RESOLVE_ACTION',
      acceptedWieldConflict: null,
      acknowledgedWarnings: [],
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: run.version,
      actorId: source.id,
      targetActorId: target.id,
      actionId: `${source.id}:FEATURE:${encounterEffectFeatureId}:EFFECT:${encounterEffectId}`,
      optionalCombatIntent: null,
      sceneContext
    }
    const choices = browser
      ? await owner.query(actionChoices, {
          encounterId: run.id,
          expectedVersion: run.version,
          actorId: source.id
        })
      : null
    const choice = choices?.actions.find((action) => action.id === root.actionId)

    const beforeRun = await owner.query(api.encounters.projectionReads.get, { encounterId: run.id })
    const beforePlayerRun = encounterPlayerProjectionDtoSchema.parse(
      await player.query(api.encounters.projectionReads.get, { encounterId: run.id })
    )
    const beforePlayerSource = beforePlayerRun.actors.find((actor) => actor.id === source.id)
    const beforePlayerTarget = beforePlayerRun.actors.find((actor) => actor.id === target.id)
    assert.ok(beforePlayerSource && beforePlayerTarget)
    assert.equal(beforePlayerSource.public, true)
    assert.equal(beforePlayerTarget.public, true)
    assert.deepEqual(conditionIds(beforePlayerTarget.conditions), [])
    const beforeTimeline = await owner.query(api.encounters.timelineReads.timeline, {
      encounterId: run.id,
      limit: 100
    })
    const verify = async (controls?: EncounterEffectsBrowserControls) => {
      const browserRoot = await controls?.resolveAction()
      if (browserRoot) {
        assert.deepEqual({ ...browserRoot.command, commandId: root.commandId }, root)
        root = browserRoot.command
      }
      const issued =
        browserRoot?.result ?? (await owner.mutation(executeEncounterCommand, { command: root }))
      assert.equal(issued.occurrence?.status, 'PENDING')
      assert.deepEqual(
        await owner.query(api.encounters.projectionReads.get, { encounterId: run.id }),
        beforeRun,
        'Issuing a save cannot advance the Run before evidence completes.'
      )
      assert.deepEqual(
        await owner.query(api.encounters.timelineReads.timeline, {
          encounterId: run.id,
          limit: 100
        }),
        beforeTimeline,
        'Issuing a save cannot append a terminal receipt.'
      )
      const pending = await owner.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: run.id
      })
      if (!pending || pending.kind !== 'D20_EVIDENCE')
        throw new Error('Action-effect save evidence is unavailable.')
      await controls?.assertPendingPrivacy()
      assert.equal(
        await player.query(api.encounters.pendingReads.pendingRuleOccurrence, {
          encounterId: run.id
        }),
        null
      )
      let response: ResolveRuleOccurrenceInputDto = {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: pending.encounterVersion,
        correlationId: null,
        occurrenceId: pending.occurrenceId,
        expectedOccurrenceVersion: pending.occurrenceVersion,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: pending.request.requestId,
          rawFaces: pending.request.rollMode === 'NORMAL' ? [face] : [face, face]
        }
      }
      await assert.rejects(
        () => player.mutation(executeEncounterCommand, { command: response }),
        /owner|permission|authorized|not found/i
      )
      const browserResponse = await controls?.resolveEvidence(response)
      if (browserResponse) {
        assert.deepEqual({ ...browserResponse.command, commandId: response.commandId }, response)
        response = browserResponse.command
      }
      const terminal =
        browserResponse?.result ??
        (await owner.mutation(executeEncounterCommand, { command: response }))
      assert.equal(terminal.occurrence?.status, 'COMPLETE')
      const finalRun = encounterGmProjectionDtoSchema.parse(
        await owner.query(api.encounters.projectionReads.get, { encounterId: run.id })
      )
      const finalTimeline = await owner.query(api.encounters.timelineReads.timeline, {
        encounterId: run.id,
        limit: 100
      })
      const finalPlayerRun = encounterPlayerProjectionDtoSchema.parse(
        await player.query(api.encounters.projectionReads.get, { encounterId: run.id })
      )
      const finalPlayerTarget = finalPlayerRun.actors.find((actor) => actor.id === target.id)
      assert.ok(finalPlayerTarget)
      assert.equal(finalPlayerTarget.public, true)
      assert.deepEqual(conditionIds(finalPlayerTarget.conditions), expectedConditions)
      const finalTarget = finalRun.actors.find((actor) => actor.id === target.id)
      if (!finalTarget) throw new Error('Action-effect target is absent after settlement.')
      assert.deepEqual(conditionIds(finalTarget.conditions), expectedConditions)
      assert.equal(finalRun.version, run.version + 1)
      assert.equal(finalTimeline.entries.length, beforeTimeline.entries.length + 1)
      assert.equal(
        finalTimeline.entries.filter((entry) => entry.commandType === 'RESOLVE_ACTION').length,
        beforeTimeline.entries.filter((entry) => entry.commandType === 'RESOLVE_ACTION').length + 1,
        'The terminal save must settle the original action receipt once.'
      )
      await controls?.assertTerminal()
      assert.deepEqual(
        await owner.mutation(executeEncounterCommand, { command: root }),
        terminal,
        'Exact root replay must retain the completed action receipt.'
      )
      assert.deepEqual(
        await owner.mutation(executeEncounterCommand, { command: response }),
        terminal,
        'Exact terminal replay must retain the completed receipt.'
      )
      assert.deepEqual(
        await owner.query(api.encounters.projectionReads.get, { encounterId: run.id }),
        finalRun
      )
      assert.deepEqual(
        await owner.query(api.encounters.timelineReads.timeline, {
          encounterId: run.id,
          limit: 100
        }),
        finalTimeline
      )
    }
    if (browser) {
      if (!choice || !scene || !targetTokenLabel)
        throw new Error('Action-effect browser fixture has no rendered action or Scene.')
      await browser(
        {
          scene,
          actionLabel: choice.sourceLabel
            ? `${choice.label} · ${choice.sourceLabel}`
            : choice.label,
          targetLabel: target.label,
          targetTokenLabel,
          expectedConditionLabel: face === 1 ? frightened.label : null
        },
        verify
      )
    } else await verify()
    // A Campaign keeps one ACTIVE Run across sittings, so each iteration completes its own Run.
    const settled = encounterGmProjectionDtoSchema.parse(
      await owner.query(api.encounters.projectionReads.get, { encounterId: run.id })
    )
    const completed = await owner.mutation(executeEncounterCommand, {
      command: {
        type: 'COMPLETE',
        encounterId: run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: settled.version
      }
    })
    assert.equal(encounterGmProjectionDtoSchema.parse(completed.projection).status, 'COMPLETED')
  }
  console.log('Native action-effect save, privacy, and replay checks passed.')
}
