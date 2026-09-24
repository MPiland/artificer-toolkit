import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { EncounterExecuteInput } from '@artificer-toolkit/schema/api/encounters'
import { api } from '../convex/_generated/api.js'
import type { DevelopmentClient } from './developmentClient'
import { bindScene, bindToken } from './developmentEncounterLifecycle'
import { createEncounterLifecycleScene } from './developmentEncounterScenes'
import { reactionBinding } from './fixtures/movementReaction'

type ActionClient = DevelopmentClient & Pick<ConvexHttpClient, 'action'>
type MovementScenario = 'REACTION' | 'PASSAGE'

export async function publishMovementReactionCreature(
  owner: ActionClient,
  eligibilityDefinitionId: string
) {
  const subjectId = crypto.randomUUID()
  const bite = wolf.features?.find((feature) => feature.label === 'Bite')
  if (!bite) throw new Error('Movement reaction fixture requires the SRD Wolf Bite Feature.')
  const biteEffect = bite.effects?.[0]
  if (!biteEffect) throw new Error('Movement reaction fixture requires the SRD Wolf Bite Effect.')
  const creature = {
    ...wolf,
    id: subjectId,
    label: 'Movement reaction browser creature',
    features: wolf.features?.map((feature) => ({
      ...feature,
      ...(feature.id === bite.id
        ? {
            rollDefinitions: [
              {
                id: crypto.randomUUID(),
                label: 'Reaction attack',
                kind: 'ATTACK' as const,
                expression: { count: 1, die: 20, modifier: 4 },
                rollMode: 'NORMAL' as const,
                chargeCost: null,
                order: 1
              }
            ]
          }
        : {}),
      effects: feature.effects?.map((effect) => ({
        ...effect,
        invocation: {
          ...effect.invocation,
          ...(feature.id === bite.id
            ? {
                triggerCode: 'MELEE_WEAPON_ATTACK' as const,
                activation: { code: 'REACTION' as const, amount: 1 },
                reactionMovementTrigger: { ...reactionBinding, eligibilityDefinitionId }
              }
            : {})
        },
        ...(feature.id === bite.id
          ? {
              paths: effect.paths
                ?.filter(
                  (path) =>
                    'resultBlock' in path &&
                    path.resultBlock.outcomes.some((outcome) => outcome.effectKind === 'DAMAGE')
                )
                .map((path) =>
                  'resultBlock' in path
                    ? {
                        ...path,
                        resultBlock: {
                          ...path.resultBlock,
                          outcomes: path.resultBlock.outcomes.filter(
                            (outcome) => outcome.effectKind === 'DAMAGE'
                          )
                        }
                      }
                    : path
                )
            }
          : {})
      }))
    }))
  }
  const draft = await owner.mutation(api.content.drafts.save, {
    subjectKind: 'CREATURE',
    subjectId,
    systemId: srdSystemRecord.id,
    label: creature.label,
    payload: creature
  })
  assert.ok(draft.subjectId && draft.updatedAt)
  await owner.mutation(api.content.publication.publishDraft, {
    subjectKind: 'CREATURE',
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
  return { creatureId: draft.subjectId, biteFeatureId: bite.id, biteEffectId: biteEffect.id }
}

export async function prepareEncounterMovementFixture({
  owner,
  playerUserId,
  player,
  playerCharacterId,
  campaignId,
  initiativePolicyDefinitionId,
  reactionCreatureId,
  biteFeatureId,
  biteEffectId,
  scenario = 'REACTION'
}: {
  owner: ActionClient
  player: DevelopmentClient
  playerUserId: string
  playerCharacterId: string
  campaignId: string
  initiativePolicyDefinitionId: string
  reactionCreatureId: string
  biteFeatureId: string
  biteEffectId: string
  scenario?: MovementScenario
}) {
  const passage = scenario === 'PASSAGE'
  const moverTokenId = crypto.randomUUID()
  const reactorTokenId = crypto.randomUUID()
  const scene = await createEncounterLifecycleScene({
    owner,
    campaignId,
    name: passage ? 'Movement passage browser scene' : 'Movement reaction browser scene',
    options: {
      map: { width: passage ? 600 : 400, height: 200 },
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
          id: reactorTokenId,
          assetId: null,
          controlledByUserIds: [],
          height: 100,
          hidden: false,
          label: 'Movement reaction reactor',
          locked: false,
          position: { x: passage ? 250 : 50, y: 50 },
          rotationDegrees: 0,
          vision: null,
          width: 100
        },
        {
          id: moverTokenId,
          assetId: null,
          controlledByUserIds: [playerUserId],
          height: 100,
          hidden: false,
          label: 'Movement reaction mover',
          locked: false,
          position: { x: passage ? 50 : 150, y: 50 },
          rotationDegrees: 0,
          vision: {
            enabled: true,
            brightRange: 10,
            dimRange: 0,
            angleDegrees: 360,
            directionDegrees: 0
          },
          width: 100
        }
      ]
    }
  })
  const settings = await owner.query(api.campaigns.playSettings.get, { campaignId })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await owner.mutation(api.campaigns.playSettings.save, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId,
    initiativeTieDefinitionId: null,
    ...(passage
      ? {
          optionalCombatRuleDefinitionIds: SRD_OPTIONAL_COMBAT_DEFINITIONS.filter(
            (definition) =>
              definition.document.kind === 'OVERRUN' || definition.document.kind === 'TUMBLE'
          ).map((definition) => definition.id)
        }
      : {})
  })
  await player.mutation(api.campaigns.assignments.assign, {
    campaignId,
    characterId: playerCharacterId
  })
  const currentPresentation = await owner.query(api.scenes.presentations.get, { campaignId })
  const presentation = await owner.mutation(api.scenes.presentations.set, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    campaignId,
    sceneId: scene.liveSceneId,
    expectedPresentationVersion: currentPresentation?.version ?? null
  })
  const blueprint = await owner.mutation(api.encounters.blueprints.create, {
    gameSystemId: srdSystemRecord.id,
    name: 'Movement reaction browser fixture',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CREATURE', sourceId: reactionCreatureId }]
  })
  const created = await owner.mutation(api.encounters.runs.create, {
    campaignId,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const reactor = created.actors.find(
    (actor) => actor.kind === 'CREATURE' && actor.sourceId === reactionCreatureId
  )
  const mover = created.actors.find(
    (actor) => actor.kind === 'CHARACTER' && actor.sourceId === playerCharacterId
  )
  if (!reactor || !mover) throw new Error('Movement reaction fixture actors are unavailable.')
  let started = await owner.mutation(api.encounters.commands.execute, {
    command: {
      type: 'START',
      encounterId: created.id,
      commandId: crypto.randomUUID(),
      expectedVersion: created.version
    }
  })
  for (let responseIndex = 0; started.occurrence?.status === 'PENDING'; responseIndex++) {
    assert.ok(
      responseIndex < 20,
      'Movement reaction fixture initiative failed to settle within the lifecycle fixture bound.'
    )
    const pending = started.occurrence.pending
    if (!pending) throw new Error('Movement reaction fixture is missing an initiative request.')
    let resolution: Extract<
      EncounterExecuteInput['command'],
      { type: 'RESOLVE_RULE_OCCURRENCE' }
    >['resolution']
    if (pending.kind === 'INITIATIVE_EVIDENCE') {
      resolution = {
        kind: 'ENTER_INTEGER',
        requestId: pending.request.requestId,
        value: pending.request.max
      }
    } else {
      if (pending.kind !== 'INITIATIVE_ORDER')
        throw new Error(
          `Movement reaction fixture requested unsupported initiative continuation ${pending.kind}.`
        )
      const entityId = pending.optionIds[0]
      if (!entityId) throw new Error('Movement reaction fixture has no initiative choice.')
      resolution = { kind: 'INITIATIVE_ENTITY', requestId: pending.requestId, entityId }
    }
    started = await owner.mutation(api.encounters.commands.execute, {
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
  await owner.mutation(bindScene, {
    type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
    encounterId: created.id,
    commandId: crypto.randomUUID()
  })
  let run = await owner.query(api.encounters.projectionReads.get, { encounterId: created.id })
  for (const [actorId, tokenId] of [
    [reactor.id, reactorTokenId],
    [mover.id, moverTokenId]
  ] as const) {
    run = (
      await owner.mutation(bindToken, {
        input: {
          type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
          commandId: crypto.randomUUID(),
          encounterId: created.id,
          expectedEncounterVersion: run.version,
          actorId,
          sceneId: scene.liveSceneId,
          tokenId
        }
      })
    ).projection
  }
  run = (
    await owner.mutation(api.encounters.commands.execute, {
      command: {
        type: 'SET_CURRENT_ACTOR',
        encounterId: created.id,
        commandId: crypto.randomUUID(),
        expectedVersion: run.version,
        actorId: mover.id
      }
    })
  ).projection
  return {
    blueprint,
    mover: { actorId: mover.id, tokenId: moverTokenId },
    presentation,
    reactor: {
      actorId: reactor.id,
      actionId: `${reactor.id}:FEATURE:${biteFeatureId}:EFFECT:${biteEffectId}`,
      tokenId: reactorTokenId
    },
    run,
    scene
  }
}
