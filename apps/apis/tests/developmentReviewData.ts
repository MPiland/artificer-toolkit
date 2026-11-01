import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import type { ConvexHttpClient } from 'convex/browser'
import { type FunctionReturnType, makeFunctionReference } from 'convex/server'
import {
  type EncounterCommandResultDto,
  type EncounterExecuteInput,
  encounterGmProjectionDtoSchema,
  resolveEncounterActionInputDtoSchema
} from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterActionChoicesResponseDto,
  GetEncounterActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import { SRD_DND5E_SPEED_FACTOR_INITIATIVE_POLICY_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/initiativePolicies.js'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../convex/_generated/api.js'
import { createDevelopmentCharacter } from './developmentCharacterFixture'
import { type DevelopmentClient, executeEncounterCommand } from './developmentClient'
import { declarationCommand } from './fixtures/encounterInitiative'
import { createDevelopmentSpellCharacter } from './developmentSpellCharacterFixture'
import {
  REVIEW_PLAYERS,
  REVIEW_READY_TITLE,
  REVIEW_SCENARIOS,
  type ReviewHero,
  type ReviewScenario,
  type ReviewStep
} from './developmentReviewDataScenarios'

const actionChoices = makeFunctionReference<
  'query',
  GetEncounterActionChoicesInputDto,
  EncounterActionChoicesResponseDto
>('encounters/actionChoices:get')

type Resolution = Extract<
  EncounterExecuteInput['command'],
  { type: 'RESOLVE_RULE_OCCURRENCE' }
>['resolution']

type PendingOccurrence = NonNullable<EncounterCommandResultDto['occurrence']>['pending']

/**
 * The GM's answer to an initiative decision: the top score, the first tie choice, the declared
 * option of the actor's first step. Null for any other pending decision.
 */
function initiativeResolution(
  encounterId: string,
  pending:
    | PendingOccurrence
    | FunctionReturnType<typeof api.encounters.pendingReads.pendingRuleOccurrence>,
  declaredAction: (actorId: string) => string | undefined = () => undefined
): Resolution | null {
  switch (pending?.kind) {
    case 'INITIATIVE_EVIDENCE':
      return {
        kind: 'ENTER_INTEGER',
        requestId: pending.request.requestId,
        value: pending.request.max
      }
    case 'INITIATIVE_ORDER': {
      const entityId = pending.optionIds[0]
      assert.ok(entityId, 'The initiative tie has no choice.')
      return { kind: 'INITIATIVE_ENTITY', requestId: pending.requestId, entityId }
    }
    case 'INITIATIVE_DECLARATION': {
      // The option whose label starts with the actor's next scripted turn action, else the first option.
      const label = declaredAction(pending.actorId)
      const option = label && pending.primaryOptions.find((entry) => entry.label.startsWith(label))
      return declarationCommand({
        encounterId,
        pending: option ? { ...pending, primaryOptions: [option] } : pending
      }).command.resolution
    }
    default:
      return null
  }
}

export type ReviewClient = DevelopmentClient & Pick<ConvexHttpClient, 'action'>
export type ReviewAccount = { client: ReviewClient; userId: string; username: string }

export type ReviewContext = {
  gm: ReviewAccount
  /** One account per entry of REVIEW_PLAYERS, in order. */
  players: readonly ReviewAccount[]
  /** Operator step: lifts the GM account to the GM tier, whose hosted-Campaign limit fits every review Campaign. */
  grantGmTier: (userId: string) => Promise<void>
  /** Closes a finished Campaign's room where a harness would otherwise keep every room open; a live backend closes idle rooms itself. */
  releaseRoom?: (campaignId: string) => Promise<void>
  /** Publishes what the room holds to Convex: a running table saves only at save points (D90). */
  checkpoint: (campaignId: string) => Promise<void>
  /** Builds the Campaign's content snapshots where nothing schedules them (convex-test); a live backend builds its own. */
  buildSnapshots?: (campaignId: string) => Promise<void>
  log: (message: string) => void
}

export type ReviewSeedResult = { created: string[]; skipped: string[] }

/** A stable, v4-shaped id for a review record, so a rebuild after a reset reuses the same ids. */
export function reviewId(slug: string): string {
  const hex = createHash('sha256').update(`artificer-review:${slug}`).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/**
 * Builds the review Campaigns that are not finished yet: each is created last-Session-first-proof,
 * so a Campaign that has its `REVIEW_READY_TITLE` Session is complete and is left alone. A Campaign
 * without it is a failed earlier run, which only a backend reset clears.
 */
export async function seedReviewData(
  context: ReviewContext,
  scenarios: readonly ReviewScenario[] = REVIEW_SCENARIOS
): Promise<ReviewSeedResult> {
  assert.equal(context.players.length, REVIEW_PLAYERS.length, 'One account per review player.')
  const result: ReviewSeedResult = { created: [], skipped: [] }
  await context.grantGmTier(context.gm.userId)
  // The room caches each roller's preference, so every account stays off: dice are typed.
  for (const account of [context.gm, ...context.players])
    await account.client.mutation(api.account.setAutoRollDice, { autoRollDice: false })
  for (const scenario of scenarios) {
    const existing = await findCampaign(context.gm.client, scenario.campaign)
    if (existing) {
      assert.ok(
        await isFinished(context.gm.client, existing),
        `Review Campaign "${scenario.campaign}" is incomplete; reset the local backend and run again.`
      )
      result.skipped.push(scenario.campaign)
      continue
    }
    await buildScenario(context, scenario)
    result.created.push(scenario.campaign)
  }
  return result
}

async function findCampaign(client: ReviewClient, name: string): Promise<string | null> {
  let cursor: string | null = null
  for (;;) {
    const page: { page: { id: string; name: string }[]; isDone: boolean; continueCursor: string } =
      await client.query(api.campaigns.queries.list, {
        paginationOpts: { cursor, numItems: 8 }
      })
    const match = page.page.find((campaign) => campaign.name === name)
    if (match) return match.id
    if (page.isDone) return null
    cursor = page.continueCursor
  }
}

async function isFinished(client: ReviewClient, campaignId: string): Promise<boolean> {
  // Sessions list newest first, and the marker is created last.
  const page = await client.query(api.campaigns.sessions.list, {
    campaignId,
    paginationOpts: { cursor: null, numItems: 8 }
  })
  return page.page.some((session) => session.title === REVIEW_READY_TITLE)
}

async function admitPlayers(
  context: ReviewContext,
  campaignId: string,
  members: readonly ReviewAccount[]
) {
  const { gm } = context
  for (const account of [gm, ...members])
    await account.client.mutation(api.social.profiles.initialize, {})
  const draft = await gm.client.mutation(api.social.listingDrafts.create, {
    input: {
      campaignId,
      summary: 'Review table',
      audience: 'PUBLIC',
      systemId: srdSystemRecord.id,
      playMode: 'ONLINE',
      capacity: REVIEW_PLAYERS.length,
      schedule: {
        kind: 'FLEXIBLE',
        timeZone: 'America/Chicago',
        summary: 'Whenever the review runs'
      },
      location: null,
      expectations: {
        contentGuidance: 'Standard adventure content.',
        attendancePolicy: 'Tell the table when unavailable.',
        allowedContentRules: 'Campaign-shared and SRD content.',
        tableConduct: 'Be kind and collaborate.',
        contentBoundaries: 'Discuss boundaries before play.',
        safetyPractices: ['LINES_AND_VEILS'],
        safetyDetails: 'Pause and discuss when needed.'
      }
    }
  })
  const listing = await gm.client.mutation(api.social.listings.open, {
    listingPublicId: draft.listingPublicId,
    expectedVersion: draft.version
  })
  for (const member of members) {
    const invitation = await gm.client.mutation(api.social.invitations.create, {
      listingPublicId: listing.listingPublicId,
      expectedListingVersion: listing.version,
      username: member.username
    })
    await member.client.mutation(api.social.invitations.accept, {
      invitePublicId: invitation.invitePublicId,
      expectedVersion: invitation.version
    })
  }
}

async function createHero(
  scenario: ReviewScenario,
  hero: ReviewHero,
  owner: ReviewAccount
): Promise<{ characterId: string; classId: string | null; spellIds: string[] }> {
  const characterId = reviewId(`${scenario.campaign}/${hero.slug}`)
  if (!hero.spells) {
    await createDevelopmentCharacter(owner.client, characterId, {}, hero.label)
    return { characterId, classId: null, spellIds: [] }
  }
  const created = await createDevelopmentSpellCharacter(
    owner.client,
    characterId,
    hero.spells.list,
    hero.spells.slots,
    undefined,
    undefined,
    hero.label
  )
  return { characterId, classId: created.classId, spellIds: [...created.spellSubjectIds.values()] }
}

async function buildScenario(context: ReviewContext, scenario: ReviewScenario) {
  const { gm, players, log } = context
  const accounts = scenario.heroes.map((hero) => {
    const account = players[hero.player]
    assert.ok(account, `Review hero ${hero.slug} names a missing player.`)
    return account
  })
  const members = [...new Set(accounts)]
  const campaign = await gm.client.mutation(api.campaigns.create.create, {
    name: scenario.campaign,
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const campaignId = campaign.id
  log(`${scenario.campaign}: Campaign created`)
  await admitPlayers(context, campaignId, members)

  const settings = await gm.client.query(api.campaigns.playSettings.get, { campaignId })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await gm.client.mutation(api.campaigns.playSettings.save, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId: SRD_DND5E_SPEED_FACTOR_INITIATIVE_POLICY_DEFINITION_ID,
    initiativeTieDefinitionId: null
  })

  const heroRecords: { hero: ReviewHero; owner: ReviewAccount; characterId: string }[] = []
  for (const [index, hero] of scenario.heroes.entries()) {
    const owner = accounts[index]!
    const { characterId, classId, spellIds } = await createHero(scenario, hero, owner)
    await owner.client.mutation(api.campaigns.assignments.assign, { campaignId, characterId })
    if (classId) await prepareSpells(owner.client, characterId, classId, spellIds)
    heroRecords.push({ hero, owner, characterId })
  }
  log(`${scenario.campaign}: ${heroRecords.length} Character(s) assigned`)
  // The room reads the snapshots current when it activates, so they are built before the first command.
  await context.buildSnapshots?.(campaignId)
  await awaitSnapshotHeads(accounts[0]!.client, campaign.gameSystemId, heroRecords[0]!.characterId)

  const blueprint = await gm.client.mutation(api.encounters.blueprints.create, {
    gameSystemId: campaign.gameSystemId,
    name: `${scenario.campaign} encounter`,
    commandId: crypto.randomUUID(),
    enemies: scenario.creatures.map((creature) => ({
      kind: 'CREATURE' as const,
      sourceId: creature.sourceId
    }))
  })
  const created = await gm.client.mutation(api.encounters.runs.create, {
    campaignId,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  log(`${scenario.campaign}: Run ${created.id} prepared`)
  const prepared = encounterGmProjectionDtoSchema.parse(
    await gm.client.query(api.encounters.projectionReads.get, { encounterId: created.id })
  )
  // Heroes by slug, creatures by key: the n-th spec creature of a source is its n-th actor.
  const actors = new Map<
    string,
    {
      id: string
      label: string
      position: { x: number; y: number }
      tokenId: string
      controlledBy: string[]
    }
  >()
  for (const { hero, owner, characterId } of heroRecords) {
    const actor = prepared.actors.find(
      (entry) => entry.kind === 'CHARACTER' && entry.sourceId === characterId
    )
    assert.ok(actor, `Review hero ${hero.slug} is absent from the Run.`)
    actors.set(hero.slug, {
      id: actor.id,
      label: actor.label,
      position: hero.position,
      tokenId: crypto.randomUUID(),
      controlledBy: [owner.userId]
    })
  }
  const seen = new Map<string, number>()
  for (const creature of scenario.creatures) {
    const ordinal = seen.get(creature.sourceId) ?? 0
    seen.set(creature.sourceId, ordinal + 1)
    const actor = prepared.actors.filter(
      (entry) => entry.kind === 'CREATURE' && entry.sourceId === creature.sourceId
    )[ordinal]
    assert.ok(actor, `Review creature ${creature.key} is absent from the Run.`)
    actors.set(creature.key, {
      id: actor.id,
      label: actor.label,
      position: creature.position,
      tokenId: crypto.randomUUID(),
      controlledBy: []
    })
  }

  // An actor declares, each round, the action its next scripted turn takes first.
  const turnActions = new Map<string, string[]>()
  const turnAction = new Map<string, string | undefined>()
  for (const step of scenario.steps) {
    const found = actors.get(step.actor)
    assert.ok(found, `Review step names an unknown actor "${step.actor}".`)
    const turns = turnActions.get(found.id) ?? []
    if ('advance' in step) {
      turns.push(turnAction.get(found.id) ?? '')
      turnAction.delete(found.id)
    } else if (step.action && !turnAction.has(found.id)) turnAction.set(found.id, step.action)
    turnActions.set(found.id, turns)
  }
  const declaredAction = (actorId: string) => turnActions.get(actorId)?.shift() || undefined
  const execute = (command: EncounterExecuteInput['command']) =>
    gm.client.mutation(executeEncounterCommand, { command })
  // The first command of a Campaign activates its room, which can drop the socket while it warms
  // up. The command ID makes a repeat an exact replay, so the same START is sent again.
  const start = {
    type: 'START' as const,
    encounterId: created.id,
    commandId: crypto.randomUUID(),
    expectedVersion: created.version
  }
  let started = await execute(start).catch((error: unknown) => {
    if (!String(error).includes('closed the connection')) throw error
    log(`${scenario.campaign}: room dropped during activation; starting again`)
    return execute(start)
  })
  for (let resolutions = 0; started.occurrence?.status === 'PENDING'; resolutions++) {
    assert.ok(resolutions < 30, `${scenario.campaign} initiative did not settle.`)
    const pending = started.occurrence.pending
    const resolution = initiativeResolution(created.id, pending, declaredAction)
    if (!resolution)
      throw new Error(
        `${scenario.campaign} met an unexpected initiative continuation: ${pending?.kind ?? 'none'}.`
      )
    started = await execute({
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: created.id,
      commandId: crypto.randomUUID(),
      expectedVersion: started.projection.version,
      correlationId: null,
      occurrenceId: started.occurrence.occurrenceId,
      expectedOccurrenceVersion: started.occurrence.occurrenceVersion,
      resolution
    })
  }
  log(`${scenario.campaign}: Run started`)
  let run = encounterGmProjectionDtoSchema.parse(started.projection)

  const { createEncounterLifecycleScene } = await import('./developmentEncounterScenes')
  const { bindScene, bindToken } = await import('./developmentEncounterLifecycle')
  const placed = [...actors.values()]
  const [firstToken, secondToken, ...otherTokens] = placed.map((actor) => ({
    id: actor.tokenId,
    assetId: null,
    controlledByUserIds: actor.controlledBy,
    height: 50,
    hidden: false as const,
    label: actor.label,
    locked: false as const,
    position: actor.position,
    rotationDegrees: 0,
    senses: [],
    vision: null,
    width: 50
  }))
  assert.ok(firstToken && secondToken, 'A review Scene needs at least two tokens.')
  const scene = await createEncounterLifecycleScene({
    owner: gm.client,
    campaignId,
    name: `${scenario.campaign} map`,
    options: {
      // A player sees only explored tokens (D87); review boards show everything.
      fogMode: 'OFF',
      map: { width: 800, height: 600 },
      grid: {
        kind: 'SQUARE',
        origin: { x: 0, y: 0 },
        cellSize: 50,
        distancePerCell: 5,
        diagonalPolicy: 'EQUAL',
        unit: 'FEET'
      },
      tokens: [firstToken, secondToken, ...otherTokens]
    }
  })
  const presentation = await gm.client.query(api.scenes.presentations.get, { campaignId })
  await gm.client.action(api.scenes.presentations.setLive, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    campaignId,
    sceneId: scene.liveSceneId,
    expectedPresentationVersion: presentation?.version ?? null
  })
  await gm.client.mutation(bindScene, {
    type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
    encounterId: run.id,
    commandId: crypto.randomUUID()
  })
  run = encounterGmProjectionDtoSchema.parse(
    await gm.client.query(api.encounters.projectionReads.get, { encounterId: run.id })
  )
  for (const actor of placed) {
    run = encounterGmProjectionDtoSchema.parse(
      (
        await gm.client.mutation(bindToken, {
          input: {
            type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
            commandId: crypto.randomUUID(),
            encounterId: run.id,
            expectedEncounterVersion: run.version,
            actorId: actor.id,
            sceneId: scene.liveSceneId,
            tokenId: actor.tokenId
          }
        })
      ).projection
    )
  }
  await gm.client.mutation(api.campaigns.sessions.create, {
    campaignId,
    title: `${scenario.campaign} session`
  })
  await context.checkpoint(campaignId)
  log(`${scenario.campaign}: Encounter and map ready`)

  const ownerOf = new Map(heroRecords.map(({ owner, hero }) => [actors.get(hero.slug)!.id, owner]))
  const playStep = stepPlayer({
    context,
    campaignId,
    encounterId: run.id,
    sceneId: scene.liveSceneId,
    actors,
    ownerOf,
    declaredAction,
    execute
  })
  for (const step of scenario.steps) await playStep(step)
  await context.checkpoint(campaignId)
  log(`${scenario.campaign}: ${scenario.steps.length} step(s) played`)

  await gm.client.mutation(api.campaigns.sessions.create, {
    campaignId,
    title: REVIEW_READY_TITLE
  })
  await context.releaseRoom?.(campaignId)
}

/** Sheet commands go through Convex, so they come before the room holds the Character. */
async function prepareSpells(
  client: ReviewClient,
  characterId: string,
  classId: string,
  spellIds: readonly string[]
) {
  const sheet = await client.query(api.characters.sheet.get, { id: characterId })
  assert.ok(sheet, 'The review Character sheet must be readable.')
  let streamVersion = sheet.meta.streamVersion
  for (const type of ['SET_KNOWN_SPELLS', 'SET_PREPARED_SPELLS'] as const)
    streamVersion = (
      await client.mutation(api.characters.sheetCommands.execute, {
        id: characterId,
        command: {
          type,
          classId,
          spellIds: [...spellIds],
          commandId: crypto.randomUUID(),
          expectedVersion: streamVersion
        }
      })
    ).streamVersion
}

/** Snapshot builds run a moment after each publish; the room refuses to activate on a stale head. */
async function awaitSnapshotHeads(client: ReviewClient, systemId: string, characterId: string) {
  const deadline = Date.now() + 60_000
  for (;;) {
    const { sources, campaign } = await client.query(api.contentSnapshots.manifest.manifest, {
      systemId,
      characterId
    })
    const heads = [...sources.map((source) => source.head), campaign?.head]
    if (heads.every((head) => !head || head.builtRevision === head.revision)) return
    assert.ok(Date.now() < deadline, 'Content snapshot heads did not finish building.')
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
}

type PlacedActor = {
  id: string
  label: string
  position: { x: number; y: number }
  tokenId: string
}

function stepPlayer({
  context,
  campaignId,
  encounterId,
  sceneId,
  actors,
  ownerOf,
  declaredAction,
  execute
}: {
  context: ReviewContext
  campaignId: string
  encounterId: string
  sceneId: string
  actors: ReadonlyMap<string, PlacedActor>
  /** The account that controls each hero actor; it answers that actor's reaction prompts. */
  ownerOf: ReadonlyMap<string, ReviewAccount>
  /** The next declaration an actor makes at initiative: the start of its scripted turn's action. */
  declaredAction: (actorId: string) => string | undefined
  execute: (command: EncounterExecuteInput['command']) => Promise<EncounterCommandResultDto>
}) {
  const { gm, checkpoint } = context
  const actor = (key: string) => {
    const found = actors.get(key)
    assert.ok(found, `Review step names an unknown actor "${key}".`)
    return found
  }
  const center = ({ position }: PlacedActor) => ({ x: position.x + 25, y: position.y + 25 })
  const readProjection = async () => {
    await checkpoint(campaignId)
    return encounterGmProjectionDtoSchema.parse(
      await gm.client.query(api.encounters.projectionReads.get, { encounterId })
    )
  }

  /** Stands in for every die of an action: each d20 shows `d20`, each damage roll its minimum. */
  const settle = async (start: EncounterCommandResultDto, d20: number) => {
    let current = start
    for (let answers = 0; current.occurrence?.status === 'PENDING'; answers++) {
      assert.ok(answers < 20, 'A review action did not settle.')
      const { occurrence } = current
      await checkpoint(campaignId)
      const pending =
        occurrence.pending ??
        (await gm.client.query(api.encounters.pendingReads.pendingRuleOccurrence, { encounterId }))
      assert.ok(pending, 'A review action has no pending decision.')
      let resolution: Resolution
      let client: ReviewClient = gm.client
      if (pending?.kind === 'D20_EVIDENCE')
        resolution = {
          kind: 'ENTER_DICE',
          requestId: pending.request.requestId,
          rawFaces: pending.request.rollMode === 'NORMAL' ? [d20] : [d20, d20],
          rollMode: pending.request.rollMode
        }
      else if (pending?.kind === 'ACTION_OUTCOME_EVIDENCE')
        resolution = {
          kind: 'ENTER_INTEGER',
          requestId: pending.request.requestId,
          value: pending.request.min
        }
      else if (pending?.kind === 'AREA_SAVES') {
        // The caster's result lists no one else's saves; the GM's view lists every one.
        const { pending: view } = await gm.client.query(api.encounters.activeReads.active, {
          campaignId
        })
        const save = view?.kind === 'AREA_SAVES' ? view.saves[0] : undefined
        assert.ok(save, 'The area has no save to answer.')
        resolution = {
          kind: 'ENTER_DICE',
          requestId: save.request.requestId,
          rawFaces: save.request.rollMode === 'NORMAL' ? [d20] : [d20, d20],
          rollMode: save.request.rollMode
        }
      } else if (pending?.kind === 'REACTION_CHOICE') {
        const option = pending.options[0]
        assert.ok(option, 'The reaction has no option to take.')
        resolution = { kind: 'OPTION', optionId: option.optionId }
        // The reacting Character's own player decides it, as at a table.
        client = ownerOf.get(pending.targetActorId)?.client ?? gm.client
      } else {
        // A turn that wraps the round asks for the next round's initiative.
        const initiative = initiativeResolution(encounterId, pending, declaredAction)
        if (!initiative)
          throw new Error(`A review action met an unexpected pending ${pending.kind}.`)
        resolution = initiative
      }
      current = await client.mutation(executeEncounterCommand, {
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId,
          commandId: crypto.randomUUID(),
          expectedVersion: pending.encounterVersion,
          correlationId: null,
          occurrenceId: pending.occurrenceId,
          expectedOccurrenceVersion: pending.occurrenceVersion,
          resolution
        }
      })
    }
    return current
  }

  const makeCurrent = async (actorId: string) => {
    const projection = await readProjection()
    if (projection.currentActorId === actorId) return projection
    return encounterGmProjectionDtoSchema.parse(
      (
        await execute({
          type: 'SET_CURRENT_ACTOR',
          encounterId,
          commandId: crypto.randomUUID(),
          expectedVersion: projection.version,
          actorId
        })
      ).projection
    )
  }

  return async (step: ReviewStep) => {
    const source = actor(step.actor)
    const projection = await makeCurrent(source.id)
    if ('advance' in step) {
      await settle(
        await execute({
          type: 'ADVANCE_TURN',
          encounterId,
          commandId: crypto.randomUUID(),
          expectedVersion: projection.version
        }),
        14
      )
      return
    }
    const target = actor(step.target)
    const choices = await gm.client.query(actionChoices, {
      encounterId,
      expectedVersion: projection.version,
      actorId: source.id
    })
    assert.ok(choices, `${source.label} has no action choices.`)
    const choice = choices.actions.find((candidate) =>
      step.action ? candidate.label.startsWith(step.action) : candidate.attackBonus !== undefined
    )
    assert.ok(choice, `${source.label} has no "${step.action ?? 'attack'}" action choice.`)
    const { version: sceneVersion } = await gm.client.query(api.scenes.recipientReads.header, {
      sceneId
    })
    const scene = { sceneId, expectedSceneVersion: sceneVersion }
    const aim = (() => {
      switch (choice.target.kind) {
        case 'SELF':
          return { kind: 'ACTOR' as const, actorId: source.id }
        case 'ACTOR':
          return { kind: 'ACTOR' as const, actorId: target.id }
        case 'ACTORS':
          return { kind: 'ACTORS' as const, actorIds: [target.id], scene: null }
        case 'POINT':
          return { kind: 'POINT' as const, ...scene, point: center(target) }
        case 'DIRECTED':
          return {
            kind: 'DIRECTED' as const,
            ...scene,
            origin: center(source),
            toward: center(target)
          }
        case 'CASTER_CENTERED':
          return { kind: 'CASTER_CENTERED' as const, ...scene }
        default:
          throw new Error(`Review steps cannot aim a ${choice.target.kind} action.`)
      }
    })()
    const { gmRollVisibility } = await gm.client.query(api.account.rollPreferences, {})
    const issued = await execute(
      resolveEncounterActionInputDtoSchema.parse({
        type: 'RESOLVE_ACTION',
        encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: projection.version,
        actorId: source.id,
        target: aim,
        actionId: choice.id,
        ...(aim.kind === 'ACTOR' && aim.actorId !== source.id
          ? {
              sceneContext: {
                ...scene,
                sourceTokenId: source.tokenId,
                targetTokenId: target.tokenId
              }
            }
          : {}),
        visibility: gmRollVisibility,
        acknowledgedWarnings: [],
        acceptedWieldConflict: null,
        optionalCombatIntent: null
      })
    )
    await settle(issued, step.d20 ?? 14)
  }
}
