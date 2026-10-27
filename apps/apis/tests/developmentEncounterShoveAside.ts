import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import {
  type EncounterCommandResultDto,
  type EncounterExecuteInput,
  encounterGmProjectionDtoSchema,
  type ResolveEncounterActionInputDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import { api } from '../convex/_generated/api.js'
import { type DevelopmentClient, executeEncounterCommand } from './developmentClient'
import { readAuthoritativeSceneToken } from './developmentEncounterCutover'

export type EncounterShoveAsideBrowserFixture = {
  /** The presented Scene: its map size, in map pixels, for turning a square into a screen point. */
  scene: { id: string; name: string; map: { width: number; height: number } }
  shoverLabel: string
  targetLabel: string
  /** The option the Shove offers under the Shove Aside rule. */
  asideLabel: string
  /** A square 5 feet from the target that leaves the shover's reach, so the board must refuse it. */
  outOfReach: ScenePoint
}

export type EncounterShoveAsideBrowserControls = {
  /** Uses Shove's aside option on the target from the actions drawer. */
  shoveAside: () => Promise<{
    command: ResolveEncounterActionInputDto
    result: EncounterCommandResultDto
  }>
  /** Enters the faces in the decision drawer: the shover's two d20s, or the defender's check. */
  enterDice: (
    faces: number[]
  ) => Promise<{ command: ResolveRuleOccurrenceInputDto; result: EncounterCommandResultDto }>
  /**
   * Walks the board's legal squares with the keyboard, returning the squares it offers, then picks
   * `position` on the board after a press on `outOfReach` sends nothing.
   */
  pickDestination: (position: ScenePoint) => Promise<{
    offered: string[]
    command: ResolveRuleOccurrenceInputDto
    result: EncounterCommandResultDto
  }>
}

export type EncounterShoveAsideBrowserRunner = (
  fixture: EncounterShoveAsideBrowserFixture,
  verify: (controls: EncounterShoveAsideBrowserControls) => Promise<void>
) => Promise<void>

const map = { width: 400, height: 300 }
const shoverAt = { x: 150, y: 150 }
const targetAt = { x: 250, y: 150 }
/** The squares 5 feet from the target that stay within the shover's 5-foot reach flank it. */
const inReach = [
  { x: 150, y: 50 },
  { x: 150, y: 250 },
  { x: 250, y: 50 },
  { x: 250, y: 250 }
]
const byPosition = (left: ScenePoint, right: ScenePoint) => left.x - right.x || left.y - right.y

/**
 * Plays one SRD Shove 5 feet aside through the browser (MOVE-2.4, D157): with the Encounter using
 * the Shove Aside rule, a GM Wolf shoves the adjacent GM Wolf at disadvantage, wins the contest, and
 * picks where the target lands on the board from the squares that stay within its reach.
 */
export async function verifyEncounterShoveAside({
  owner,
  campaignId,
  shoverId,
  targetId,
  initiativePolicyDefinitionId,
  initiativePolicyCatalogueId,
  checkpoint,
  browser
}: {
  owner: DevelopmentClient & Pick<ConvexHttpClient, 'action'>
  campaignId: string
  shoverId: string
  targetId: string
  initiativePolicyDefinitionId: string
  initiativePolicyCatalogueId: string
  /** Publishes what the room holds to Convex: a running table saves only at save points (D90). */
  checkpoint: () => Promise<void>
  browser: EncounterShoveAsideBrowserRunner
}) {
  const campaign = await owner.query(api.campaigns.queries.get, { id: campaignId })
  if (!campaign.additionalRulesCatalogueIds.includes(initiativePolicyCatalogueId))
    await owner.mutation(api.campaigns.update.update, {
      campaignId,
      expectedVersion: campaign.version,
      additionalRulesCatalogueIds: [
        ...campaign.additionalRulesCatalogueIds,
        initiativePolicyCatalogueId
      ]
    })
  const shoveAside = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
    (entry) => entry.document.kind === 'SHOVE_ASIDE'
  )
  assert.ok(shoveAside)
  // With auto-roll off, Assisted asks the GM for both Wolves' d20s.
  await owner.mutation(api.account.setAutoRollDice, { autoRollDice: false })
  const settings = await owner.query(api.campaigns.playSettings.get, { campaignId })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await owner.mutation(api.campaigns.playSettings.save, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId,
    initiativeTieDefinitionId: null,
    optionalCombatRuleDefinitionIds: [shoveAside.id]
  })
  const blueprint = await owner.mutation(api.encounters.blueprints.create, {
    gameSystemId: campaign.gameSystemId,
    name: 'Shove aside fixture',
    commandId: crypto.randomUUID(),
    enemies: [shoverId, targetId].map((sourceId) => ({ kind: 'CREATURE' as const, sourceId }))
  })
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
    assert.ok(resolutions < 20, 'Shove aside initiative did not settle.')
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
      if (!entityId) throw new Error('Shove aside fixture has no initiative choice.')
      resolution = { kind: 'INITIATIVE_ENTITY', requestId: pending.requestId, entityId }
    } else {
      throw new Error('Shove aside fixture requested an unexpected initiative continuation.')
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
  const creatureActor = (sourceId: string) => {
    const actor = run.actors.find(
      (entry) => entry.kind === 'CREATURE' && entry.sourceId === sourceId
    )
    if (!actor) throw new Error('Shove aside fixture creature is absent from the Run.')
    return actor
  }
  const shover = creatureActor(shoverId)
  const target = creatureActor(targetId)
  // The two wolves start on one side; the shoved one joins the party so the Shove is hostile.
  run = encounterGmProjectionDtoSchema.parse(
    (
      await owner.mutation(executeEncounterCommand, {
        command: {
          type: 'UPDATE_ACTOR',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: run.version,
          actorId: target.id,
          disposition: 'FRIENDLY'
        }
      })
    ).projection
  )
  if (run.currentActorId !== shover.id)
    run = encounterGmProjectionDtoSchema.parse(
      (
        await owner.mutation(executeEncounterCommand, {
          command: {
            type: 'SET_CURRENT_ACTOR',
            encounterId: run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: run.version,
            actorId: shover.id
          }
        })
      ).projection
    )

  const tokens = [
    { actorId: shover.id, label: shover.label, position: shoverAt, tokenId: crypto.randomUUID() },
    { actorId: target.id, label: target.label, position: targetAt, tokenId: crypto.randomUUID() }
  ]
  const { createEncounterLifecycleScene } = await import('./developmentEncounterScenes')
  const { bindScene, bindToken } = await import('./developmentEncounterLifecycle')
  const name = 'Shove aside browser scene'
  const sceneToken = ({ label, position, tokenId }: (typeof tokens)[number]) => ({
    id: tokenId,
    assetId: null,
    controlledByUserIds: [],
    height: 100,
    hidden: false,
    label,
    locked: false,
    position,
    rotationDegrees: 0,
    senses: [],
    vision: null,
    width: 100
  })
  const preparedScene = await createEncounterLifecycleScene({
    owner,
    campaignId,
    name,
    options: {
      fogMode: 'OFF',
      map,
      grid: {
        kind: 'SQUARE',
        origin: { x: 0, y: 0 },
        cellSize: 100,
        distancePerCell: 5,
        diagonalPolicy: 'EQUAL',
        unit: 'FEET'
      },
      tokens: [sceneToken(tokens[0]!), sceneToken(tokens[1]!)]
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
  for (const { actorId, tokenId } of tokens)
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
  await checkpoint()
  // The token positions the Scene publishes to its recipients after the last checkpoint.
  const tokenPositions = async () => {
    const at = async (tokenId: string) =>
      (await readAuthoritativeSceneToken(owner, { sceneId: preparedScene.liveSceneId, tokenId }))
        .token.position
    return { shover: await at(tokens[0]!.tokenId), target: await at(tokens[1]!.tokenId) }
  }
  assert.deepEqual(await tokenPositions(), { shover: shoverAt, target: targetAt })

  const pendingKind = (result: EncounterCommandResultDto) =>
    result.occurrence?.status === 'PENDING' ? result.occurrence.pending?.kind : undefined

  await browser(
    {
      scene: { id: preparedScene.liveSceneId, name, map },
      shoverLabel: shover.label,
      targetLabel: target.label,
      asideLabel: 'Shove 5 feet aside',
      outOfReach: { x: 350, y: 150 }
    },
    async (controls) => {
      // 1. The GM shoves the target aside: the shover's contest d20 is rolled at disadvantage.
      const issued = await controls.shoveAside()
      assert.equal(issued.command.actorId, shover.id)
      assert.equal(issued.command.target.kind, 'ACTOR')
      assert.equal(
        issued.command.target.kind === 'ACTOR' && issued.command.target.actorId,
        target.id
      )
      const shoverRoll = issued.result.occurrence?.pending
      assert.ok(shoverRoll?.kind === 'D20_EVIDENCE', 'The shover rolls the contest first.')
      assert.equal(shoverRoll.request.rollMode, 'DISADVANTAGE')

      // 2. The shover wins: 20 and 20 against the defender's 1.
      const rolled = await controls.enterDice([20, 20])
      assert.equal(pendingKind(rolled.result), 'CONTEST_CHECK')
      const defended = await controls.enterDice([1])
      const destination = defended.result.occurrence?.pending
      assert.ok(
        destination?.kind === 'FORCED_MOVEMENT_DESTINATION',
        'The won Shove waits for where the target lands.'
      )
      assert.deepEqual([...destination.positions].sort(byPosition), inReach)
      assert.deepEqual(await tokenPositions(), { shover: shoverAt, target: targetAt })

      // 3. The board offers exactly the legal squares and lands the target on the one picked.
      const picked = await controls.pickDestination({ x: 250, y: 50 })
      assert.equal(picked.offered.length, inReach.length)
      assert.deepEqual(picked.command.resolution, {
        kind: 'FORCED_MOVEMENT',
        requestId: destination.requestId,
        position: { x: 250, y: 50 }
      })
      assert.equal(picked.result.occurrence?.status, 'COMPLETE')
      await checkpoint()
      assert.deepEqual(await tokenPositions(), { shover: shoverAt, target: { x: 250, y: 50 } })
    }
  )
  console.log('Shove 5 feet aside board journey passed.')
}
