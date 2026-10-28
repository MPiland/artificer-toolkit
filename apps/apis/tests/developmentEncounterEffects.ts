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
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../convex/_generated/api.js'
import { type DevelopmentClient, executeEncounterCommand } from './developmentClient'
import { encounterEffectFeatureId, encounterEffectId } from './fixtures/encounterEffects'

const actionChoices = makeFunctionReference<
  'query',
  GetEncounterActionChoicesInputDto,
  EncounterActionChoicesResponseDto
>('encounters/actionChoices:get')

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
  /** Leaves the final Run ACTIVE so its live effect rows stay readable; COMPLETE drops them. */
  leaveLastRunActive?: boolean
}

type EncounterEffectsInput =
  | (EncounterEffectsBaseInput & {
      owner: DevelopmentClient
      playerUserId?: string
      browser?: undefined
      /** Saves a room-held Run to Convex (D90) before the proof reads it there. */
      saveTable?: () => Promise<void>
    })
  | (EncounterEffectsBaseInput & {
      owner: DevelopmentClient & Pick<ConvexHttpClient, 'action'>
      playerUserId: string
      browser: EncounterEffectsBrowserRunner
      /** Saves the room's running table to Convex (D90); the room holds the Run while the browser plays. */
      saveTable: () => Promise<void>
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
  leaveLastRunActive = false,
  playerUserId,
  browser,
  saveTable
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

  for (const { face, expectedConditions, last } of [
    { face: 20, expectedConditions: [], last: false },
    { face: 1, expectedConditions: [frightened.id], last: true }
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
          // A player sees only explored tokens (D87); this proof checks the condition, not fog.
          fogMode: 'OFF',
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
              senses: [],
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
              senses: [],
              vision: null,
              width: 100
            }
          ]
        }
      })
      const presentation = await owner.query(api.scenes.presentations.get, { campaignId })
      await owner.action(api.scenes.presentations.setLive, {
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
    // The room holds the Run; Convex's reads below need it saved first.
    await saveTable?.()
    let root: ResolveEncounterActionInputDto = {
      type: 'RESOLVE_ACTION',
      acceptedWieldConflict: null,
      acknowledgedWarnings: [],
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: run.version,
      actorId: source.id,
      target: { kind: 'ACTOR', actorId: target.id },
      actionId: `${source.id}:FEATURE:${encounterEffectFeatureId}:EFFECT:${encounterEffectId}`,
      optionalCombatIntent: null,
      // The tabletop sends its roll visibility with every action; PUBLIC is its default.
      visibility: 'PUBLIC',
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
    if (sceneContext) {
      // Convex never reads fog, so its player read fails closed and lists no bound creature the
      // player does not control (D121); the player's map shows the target instead (assertTerminal).
      assert.equal(beforePlayerSource, undefined)
      assert.equal(beforePlayerTarget, undefined)
      assert.deepEqual(
        conditionIds(
          encounterGmProjectionDtoSchema
            .parse(beforeRun)
            .actors.find((actor) => actor.id === target.id)?.conditions
        ),
        []
      )
    } else {
      assert.ok(beforePlayerSource && beforePlayerTarget)
      assert.equal(beforePlayerSource.public, true)
      assert.equal(beforePlayerTarget.public, true)
      assert.deepEqual(conditionIds(beforePlayerTarget.conditions), [])
    }
    const verify = async (controls?: EncounterEffectsBrowserControls) => {
      const browserRoot = await controls?.resolveAction()
      if (browserRoot) {
        assert.deepEqual({ ...browserRoot.command, commandId: root.commandId }, root)
        root = browserRoot.command
      }
      const issued =
        browserRoot?.result ?? (await owner.mutation(executeEncounterCommand, { command: root }))
      assert.equal(issued.occurrence?.status, 'PENDING')
      // The room holds the Run between save points (D85), so the issued receipt, not a Convex read,
      // shows the Run and the decision pending on it.
      assert.deepEqual(
        issued.projection,
        encounterGmProjectionDtoSchema.parse(beforeRun),
        'Issuing a save cannot advance the Run before evidence completes.'
      )
      const pending = issued.occurrence?.pending
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
          rawFaces: pending.request.rollMode === 'NORMAL' ? [face] : [face, face],
          rollMode: pending.request.rollMode
        }
      }
      // A member may answer only their own decisions; another's is a permission refusal.
      await assert.rejects(
        () => player.mutation(executeEncounterCommand, { command: response }),
        /NOT_ACTOR_CONTROLLER/
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
      await saveTable?.()
      const finalRun = encounterGmProjectionDtoSchema.parse(
        await owner.query(api.encounters.projectionReads.get, { encounterId: run.id })
      )
      const finalPlayerRun = encounterPlayerProjectionDtoSchema.parse(
        await player.query(api.encounters.projectionReads.get, { encounterId: run.id })
      )
      const finalPlayerTarget = finalPlayerRun.actors.find((actor) => actor.id === target.id)
      if (sceneContext) assert.equal(finalPlayerTarget, undefined)
      else {
        assert.ok(finalPlayerTarget)
        assert.equal(finalPlayerTarget.public, true)
        assert.deepEqual(conditionIds(finalPlayerTarget.conditions), expectedConditions)
      }
      const finalTarget = finalRun.actors.find((actor) => actor.id === target.id)
      if (!finalTarget) throw new Error('Action-effect target is absent after settlement.')
      assert.deepEqual(conditionIds(finalTarget.conditions), expectedConditions)
      assert.equal(finalRun.version, run.version + 1)
      await controls?.assertTerminal()
      // The room journal replays each command's own receipt, shown over the current Run.
      assert.deepEqual(
        await owner.mutation(executeEncounterCommand, { command: root }),
        { ...issued, projection: terminal.projection },
        'Exact root replay must return its issued receipt.'
      )
      assert.deepEqual(
        await owner.mutation(executeEncounterCommand, { command: response }),
        terminal,
        'Exact evidence replay must return its terminal receipt.'
      )
      assert.deepEqual(
        await owner.query(api.encounters.projectionReads.get, { encounterId: run.id }),
        finalRun
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
    if (last && leaveLastRunActive) continue
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
