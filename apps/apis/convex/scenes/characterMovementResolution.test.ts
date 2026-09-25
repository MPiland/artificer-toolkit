import { importedSubject } from '../../tests/fixtures/publication'
import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'

import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto,
  PendingEncounterRuleOccurrenceSummaryDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterActorTokenBindingCommandInputDto,
  SceneDefinitionDto
} from '@artificer-toolkit/schema/api/vttScenes'
import type {
  SceneGeometryBeginResult,
  SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  sceneStoredDefinitionEntitySchema,
  sceneStoredDefinitionSaveSchema,
  sceneStoredInitialStateSchema,
  sceneStoredPresentationSchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { sceneStoredGeometrySaveSchema } from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_REACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  createDnd5eMovementReactionChoiceDefinition,
  createDnd5eOpportunityReactionEligibilityDefinition,
  DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/reactionEligibilityPolicy'
import { api, components, internal } from '../_generated/api'
import { sourceImportBatches } from '../content/importBatches'
import { readSessionVisionScope } from './sessionVisionDocuments'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)

const createBlueprint = makeFunctionReference<
  'mutation',
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto
>('encounters/blueprints:create')
const createRun = makeFunctionReference<
  'mutation',
  CreateEncounterInputDto,
  EncounterGmProjectionDto
>('encounters/runs:create')
const bindActorToken = makeFunctionReference<
  'mutation',
  { input: EncounterActorTokenBindingCommandInputDto },
  { projection: { version: number } }
>('encounters/actorTokenBindings:execute')
const prepare = makeFunctionReference<
  'mutation',
  ReturnType<typeof sceneSpatialPrepareInputSchema.parse>,
  SceneSpatialPreparation
>('scenes/spatialPreparation:prepare')
const finish = makeFunctionReference<
  'mutation',
  ReturnType<typeof sceneSpatialPrepareInputSchema.parse>,
  SceneGeometryCommandResult
>('scenes/geometryCommands:finish')
const beginResponse = makeFunctionReference<
  'mutation',
  ResolveRuleOccurrenceInputDto,
  SceneGeometryBeginResult | null
>('scenes/movementResolutionStaging:begin')
const observe = makeFunctionReference<
  'mutation',
  { saveId: string; characterRevisions: [] },
  { saveId: string }
>('scenes/geometryStaging:observe')
const pendingRuleOccurrence = makeFunctionReference<
  'query',
  { encounterId: string },
  PendingEncounterRuleOccurrenceSummaryDto | null
>('encounters/pendingReads:pendingRuleOccurrence')

const reactionBinding = {
  kind: 'MOVEMENT' as const,
  stage: 'BEFORE_LEAVE_REACH' as const,
  perceptionRequirement: null,
  eligibilityDefinitionId: DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID,
  movementInterruption: null
}

async function addPlayer(base: Awaited<ReturnType<typeof readyCharacterFixture>>) {
  const user = await base.t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Unrelated',
          email: 'unrelated@example.invalid',
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
    })
  )
  const session = await base.t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: user._id,
          token: crypto.randomUUID(),
          expiresAt: Date.now() + 60_000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  const caller = base.t.withIdentity({ subject: user._id, sessionId: session._id })
  const identity = await caller.query(api.account.identity, {})
  if (!identity) throw new Error('Missing unrelated player identity.')
  return { caller, userId: identity.userId }
}

async function setup(replacement = false, futureReactor = false, assisted = false, stop = false) {
  const chargeId = crypto.randomUUID()
  const sourceFeature = structuredClone(wolf.features?.find((feature) => feature.label === 'Bite'))
  const sourceEffect = structuredClone(sourceFeature?.effects?.[0])
  if (!sourceFeature || !sourceEffect) throw new Error('Missing Character reaction source.')
  sourceEffect.invocation = {
    ...sourceEffect.invocation,
    kind: 'ACTION',
    triggerCode: 'MELEE_WEAPON_ATTACK',
    activation: { code: 'REACTION', amount: 1 },
    ...(assisted ? { resourceUse: { chargeId, cost: 1 } } : {}),
    reactionMovementTrigger: {
      ...reactionBinding,
      movementInterruption: stop ? { kind: 'STOP', whenResultPath: 'ON_HIT' } : null
    }
  }
  const base = await readyCharacterFixture({
    ...(assisted
      ? {
          resources: {
            id: crypto.randomUUID(),
            label: 'Reaction use',
            order: 0,
            availableAtLevel: 1,
            charges: {
              id: chargeId,
              resetKind: 'SHORT_REST' as const,
              limitKind: 'FIXED_AMOUNT' as const,
              scalingKind: 'NONE' as const,
              amount: 1
            }
          }
        }
      : {}),
    features: [
      {
        ...sourceFeature,
        id: crypto.randomUUID(),
        availableAtLevel: 1,
        grants: {
          ...sourceFeature.grants,
          modifiers: [
            ...(sourceFeature.grants?.modifiers ?? []),
            {
              id: crypto.randomUUID(),
              grantKind: 'MODIFIER_GRANT' as const,
              valueDomainCode: 'ATTACK_ROLL' as const,
              domain: { attackDomain: 'MELEE' as const },
              modifierKind: 'ABILITY_MODIFIER_BONUS' as const,
              scope: 'SOURCE' as const,
              selectionKind: 'GRANTED' as const,
              payload: { ability: 'STRENGTH' as const },
              order: 0
            }
          ]
        },
        effects: [sourceEffect]
      }
    ]
  })
  const first = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: first.draft.id,
    mode: 'create',
    character: first.character
  })
  const second = replacement || futureReactor ? await base.createCharacter() : null
  if (second)
    await base.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: second.draft.id,
      mode: 'create',
      character: second.character
    })
  await base.t.run(async (ctx) => {
    for (const [index, userId] of [base.other.userId, base.owner.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing fixture profile.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: `draft_123456abcde${index}@example.invalid` }
        }
      })
    }
  })
  const futurePlayer = futureReactor ? await addPlayer(base) : null
  if (futurePlayer && second)
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', second.character.id))
        .unique()
      const route = await ctx.db
        .query('authoredRouteIds')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', second.character.id))
        .unique()
      if (!row || !route) throw new Error('Missing future Character.')
      const character = characterAuthoredDtoSchema.parse({
        ...JSON.parse(row.documentJson),
        userId: futurePlayer.userId
      })
      await ctx.db.patch(row._id, {
        userId: futurePlayer.userId,
        documentJson: JSON.stringify(character),
        checksum: checksumRuleDocument(character)
      })
      await ctx.db.patch(route._id, { ownerUserId: futurePlayer.userId })
    })
  const definitions = [
    ...SRD_RULE_STATE_DEFINITIONS,
    ...[
      createDnd5eOpportunityReactionEligibilityDefinition(),
      createDnd5eMovementReactionChoiceDefinition()
    ].map((published) => ({
      id: published.id,
      definitionFamilyKey: published.definitionFamilyKey,
      label: 'Character movement reaction fixture',
      description: 'Current D&D movement reaction policy fixture.',
      document: published.definition,
      checksum: published.checksum
    }))
  ]
  for (const batch of sourceImportBatches(definitions))
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: batch
    })
  const player = base.owner
  const gm = base.other
  const campaign = await gm.caller.mutation(createCampaign, {
    name: 'Encounter execution fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await base.t.mutation(
    makeFunctionReference<
      'mutation',
      { ownerUserId: string; playerUserId: string; campaignId: string },
      null
    >('encounters/developmentCampaign:admitFixturePlayer'),
    { ownerUserId: gm.userId, playerUserId: player.userId, campaignId: campaign.id }
  )
  if (futurePlayer)
    await base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: futurePlayer.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        joinedAt: new Date().toISOString(),
        accessStartedAt: new Date().toISOString(),
        leftAt: null
      })
    )
  await player.caller.mutation(api.campaigns.assignments.assign, {
    campaignId: campaign.id,
    characterId: first.character.id
  })
  if (futurePlayer && second)
    await futurePlayer.caller.mutation(api.campaigns.assignments.assign, {
      campaignId: campaign.id,
      characterId: second.character.id
    })
  if (assisted) {
    // The reacting player rolls the selected reaction's dice; prompt for them as evidence.
    await setAutoRollDice(base.t, player.userId, false)
    await base.t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ ...wolf, subjectKind: 'CREATURE', document: wolf })]
    })
  }
  const blueprint = await gm.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Character movement authority fixture',
    commandId: crypto.randomUUID(),
    enemies: assisted
      ? [{ kind: 'CREATURE', sourceId: wolf.id }]
      : [{ kind: 'CUSTOM', label: 'Mover', maxHitPoints: 10 }]
  })
  const run = await gm.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const reactor = run.actors.find(
    (actor) => actor.kind === 'CHARACTER' && actor.sourceId === first.character.id
  )
  const futureReactorActor =
    futurePlayer && second
      ? run.actors.find(
          (actor) => actor.kind === 'CHARACTER' && actor.sourceId === second.character.id
        )
      : null
  const mover = run.actors.find((actor) =>
    assisted ? actor.kind === 'CREATURE' && actor.sourceId === wolf.id : actor.kind === 'CUSTOM'
  )
  if (!reactor || !mover || (futurePlayer && !futureReactorActor))
    throw new Error('Missing Character reaction actors.')
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!row) throw new Error('Missing Character reaction Run.')
    const state = encounterRunStateSchema.parse(JSON.parse(row.stateJson))
    const active = encounterRunStateSchema.parse({
      ...state,
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: mover.id
    })
    const projection = encounterGmProjectionDtoSchema.parse({
      ...JSON.parse(row.projectionJson),
      status: 'ACTIVE',
      round: 1,
      currentActorId: mover.id
    })
    await ctx.db.patch(row._id, {
      status: 'ACTIVE',
      stateJson: JSON.stringify(active),
      stateChecksum: checksumCanonicalJson(active),
      projectionJson: JSON.stringify(projection),
      projectionChecksum: checksumCanonicalJson(projection)
    })
  })
  const sceneId = crypto.randomUUID()
  const definitionSaveId = crypto.randomUUID()
  const rootCommandId = crypto.randomUUID()
  const now = new Date().toISOString()
  const tokens: SceneDefinitionDto['tokens'] = (futurePlayer ? [50, 250, 150] : [50, 150]).map(
    (x, index) => ({
      id: crypto.randomUUID(),
      assetId: null,
      controlledByUserIds: [],
      width: 100,
      height: 100,
      hidden: false,
      locked: false,
      label:
        index === 0
          ? 'Current Character reactor'
          : index === 1 && futurePlayer
            ? 'Future Character reactor'
            : 'GM mover',
      position: { x, y: 50 },
      rotationDegrees: 0,
      vision: null
    })
  )
  const settings = {
    campaignId: campaign.id,
    name: 'Character response scene',
    ambientIllumination: 'BRIGHT' as const,
    fogMode: 'SHARED_PARTY' as const,
    visionRevealMode: 'ON_DRAG' as const,
    grid: {
      kind: 'SQUARE' as const,
      origin: { x: 0, y: 0 },
      cellSize: 100,
      distancePerCell: 5,
      diagonalPolicy: 'EQUAL' as const,
      unit: 'FEET' as const
    },
    map: { assetId: crypto.randomUUID(), width: 1000, height: 1000, tileManifestAssetId: null }
  }
  await base.t.run(async (ctx) => {
    const definitionId = crypto.randomUUID()
    const materializationCommandId = crypto.randomUUID()
    await ctx.db.insert(
      'campaignScenes',
      sceneStoredInitialStateSchema.parse({
        ...settings,
        id: sceneId,
        definitionId,
        definitionVersion: 1,
        definitionSaveId,
        version: 0,
        materializationCommandId,
        materializationCommandFingerprint: '0'.repeat(64),
        createdAt: now,
        updatedAt: now
      })
    )
    await ctx.db.insert(
      'sceneDefinitionSaves',
      sceneStoredDefinitionSaveSchema.parse({
        id: definitionSaveId,
        commandId: materializationCommandId,
        commandFingerprint: '0'.repeat(64),
        ownerUserId: gm.userId,
        definitionId,
        expectedVersion: null,
        settings,
        counts: { annotations: 0, barriers: 0, darknessZones: 0, lights: 0, tokens: tokens.length },
        received: {
          annotations: 0,
          barriers: 0,
          darknessZones: 0,
          lights: 0,
          tokens: tokens.length
        },
        status: 'PUBLISHED',
        liveSceneId: sceneId,
        entitiesRemoved: false,
        createdAt: now,
        expiresAt: Date.now() + 60_000
      })
    )
    for (const [ordinal, entity] of tokens.entries()) {
      const value = { collection: 'tokens' as const, entity }
      await ctx.db.insert(
        'sceneDefinitionEntities',
        sceneStoredDefinitionEntitySchema.parse({
          saveId: definitionSaveId,
          entityId: entity.id,
          ordinal,
          value,
          checksum: checksumCanonicalJson(value)
        })
      )
    }
    await ctx.db.insert(
      'campaignScenePresentations',
      sceneStoredPresentationSchema.parse({
        campaignId: campaign.id,
        sceneId,
        version: 0,
        activeMapAssetId: null,
        createdAt: now,
        updatedAt: now
      })
    )
    await ctx.db.insert('encounterSceneBindings', {
      encounterId: run.id,
      campaignId: campaign.id,
      sceneId,
      commandId: rootCommandId,
      commandFingerprint: checksumCanonicalJson({ sceneId }),
      createdAt: now
    })
  })
  let encounterVersion = run.version
  for (const [index, actor] of [
    reactor,
    ...(futureReactorActor ? [futureReactorActor] : []),
    mover
  ].entries()) {
    const result = await gm.caller.mutation(bindActorToken, {
      input: {
        type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
        commandId: crypto.randomUUID(),
        encounterId: run.id,
        expectedEncounterVersion: encounterVersion,
        actorId: actor.id,
        sceneId,
        tokenId: tokens[index]!.id
      }
    })
    encounterVersion = result.projection.version
  }
  const vision = await gm.caller.run(async (ctx) => {
    const scope = {
      campaignId: campaign.id,
      systemId: campaign.gameSystemId,
      sceneId,
      expectedSceneVersion: 0,
      expectedPresentationVersion: 0
    }
    const { freshness } = await readSessionVisionScope(ctx, scope)
    return { ...scope, freshness }
  })
  const rootInput = {
    type: 'MOVE_SCENE_TOKEN' as const,
    sceneId,
    commandId: rootCommandId,
    expectedSceneVersion: 0,
    expectedEncounterVersion: encounterVersion,
    correlationId: null,
    tokenId: tokens[tokens.length - 1]!.id,
    movementKind: 'VOLUNTARY' as const,
    path: [
      { x: 150, y: 50 },
      { x: futurePlayer ? 550 : 350, y: 50 }
    ]
  }
  const rootSaveId = crypto.randomUUID()
  await gm.caller.run((ctx) =>
    ctx.db.insert(
      'sceneGeometrySaves',
      sceneStoredGeometrySaveSchema.parse({
        id: rootSaveId,
        sceneId,
        commandId: rootCommandId,
        actorUserId: gm.userId,
        input: rootInput,
        inputChecksum: checksumCanonicalJson(rootInput),
        snapshotVersion: 0,
        sessionVision: vision,
        status: 'RECEIVING',
        expiresAt: Date.now() + 60_000,
        fogSaves: [],
        characterRevisions: []
      })
    )
  )
  const rootRequest = {
    saveId: rootSaveId,
    baseOrdinal: tokens.length - 1,
    tokenOrdinals: tokens.map((token, baseOrdinal) => ({ tokenId: token.id, baseOrdinal }))
  }
  return {
    base,
    player,
    gm,
    campaign,
    first: first.character,
    second: second?.character ?? null,
    futurePlayer,
    futureCharacter: futurePlayer && second ? second.character : null,
    run,
    sceneId,
    tokens,
    rootInput,
    rootRequest
  }
}

async function startPending(value: Awaited<ReturnType<typeof setup>>) {
  await value.gm.caller.mutation(observe, {
    saveId: value.rootRequest.saveId,
    characterRevisions: []
  })
  expect((await value.gm.caller.mutation(prepare, value.rootRequest)).outcome.kind).toBe('PENDING')
  const result = await value.gm.caller.mutation(finish, value.rootRequest)
  if (!result.occurrence?.pending) throw new Error('Expected Character controller pending choice.')
  return { ...result.occurrence, pending: result.occurrence.pending }
}

function decline(
  value: Awaited<ReturnType<typeof setup>>,
  occurrence: {
    occurrenceId: string
    occurrenceVersion: number
    pending: { encounterVersion: number }
  }
) {
  return {
    type: 'RESOLVE_RULE_OCCURRENCE' as const,
    commandId: crypto.randomUUID(),
    encounterId: value.run.id,
    expectedVersion: occurrence.pending.encounterVersion,
    occurrenceId: occurrence.occurrenceId,
    expectedOccurrenceVersion: occurrence.occurrenceVersion,
    correlationId: null,
    resolution: { kind: 'DECLINE' as const }
  } satisfies ResolveRuleOccurrenceInputDto
}

async function gameplayRows(value: Awaited<ReturnType<typeof setup>>) {
  return value.base.t.run(async (ctx) => ({
    characters: await ctx.db.query('characters').collect(),
    runs: await ctx.db.query('encounterRuns').collect(),
    actors: await ctx.db.query('encounterRunActors').collect(),
    runCommands: await ctx.db.query('encounterRunCommands').collect(),
    occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
    receipts: await ctx.db.query('encounterRuleReceipts').collect(),
    characterReceipts: await ctx.db.query('characterCommandReceipts').collect(),
    scenes: await ctx.db.query('campaignScenes').collect(),
    liveStates: await ctx.db.query('sceneLiveStates').collect(),
    liveEntities: await ctx.db.query('sceneLiveEntities').collect(),
    sceneEntities: await ctx.db.query('sceneDefinitionEntities').collect(),
    sceneSaves: await ctx.db.query('sceneGeometrySaves').collect(),
    sceneCommands: await ctx.db.query('sceneLiveCommands').collect(),
    fogSaves: await ctx.db.query('sceneFogSaves').collect(),
    fogLayers: await ctx.db.query('sceneFogLayers').collect()
  }))
}

async function reactionMechanics(value: Awaited<ReturnType<typeof setup>>) {
  return value.base.t.run(async (ctx) => ({
    characters: await ctx.db.query('characters').collect(),
    runs: await ctx.db.query('encounterRuns').collect(),
    actors: await ctx.db.query('encounterRunActors').collect(),
    receipts: await ctx.db.query('encounterRuleReceipts').collect(),
    commands: await ctx.db.query('encounterRunCommands').collect(),
    sceneCommands: await ctx.db.query('sceneLiveCommands').collect(),
    fog: await ctx.db.query('sceneFogLayers').collect()
  }))
}

async function stageDecline(
  value: Awaited<ReturnType<typeof setup>>,
  caller: Awaited<ReturnType<typeof setup>>['player'],
  occurrence: Awaited<ReturnType<typeof startPending>>
) {
  const command = decline(value, occurrence)
  const begin = await caller.caller.mutation(beginResponse, command)
  if (!begin || begin.kind !== 'READY') throw new Error('Expected response geometry save.')
  const request = {
    saveId: begin.saveId,
    baseOrdinal: value.rootRequest.baseOrdinal,
    tokenOrdinals: value.tokens.map((token, baseOrdinal) => ({ tokenId: token.id, baseOrdinal }))
  }
  await caller.caller.mutation(observe, { saveId: begin.saveId, characterRevisions: [] })
  return { command, request }
}

async function advanceFutureCharacterSource(value: Awaited<ReturnType<typeof setup>>) {
  if (!value.futureCharacter) throw new Error('Missing future Character source.')
  await value.base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', value.futureCharacter!.id))
      .unique()
    if (!row) throw new Error('Missing future Character source record.')
    await ctx.db.patch(row._id, { streamVersion: row.streamVersion + 1 })
  })
}

describe('native Character movement-decision authority', () => {
  it.each([
    { label: 'critical hit through TEST and OUTCOME', natural: 20, stop: false },
    { label: 'STOP-bound miss through TEST_ONLY', natural: 1, stop: true }
  ])(
    'settles a selected Character reaction $label atomically',
    async ({ natural, stop }) => {
      const value = await setup(false, false, true, stop)
      const root = await startPending(value)
      const choice = root.pending
      if (choice.kind !== 'MOVEMENT_REACTION')
        throw new Error('Expected Character reaction choice.')
      const option = choice.choice.options[0]
      if (!option) throw new Error('Expected Character reaction option.')
      const selected: ResolveRuleOccurrenceInputDto = {
        type: 'RESOLVE_RULE_OCCURRENCE',
        commandId: crypto.randomUUID(),
        encounterId: value.run.id,
        expectedVersion: choice.encounterVersion,
        occurrenceId: choice.occurrenceId,
        expectedOccurrenceVersion: choice.occurrenceVersion,
        correlationId: null,
        resolution: { kind: 'OPTION', optionId: option.optionId }
      }
      const staged = await value.player.caller.mutation(beginResponse, selected)
      if (!staged || staged.kind !== 'READY')
        throw new Error('Expected selected Character response geometry save.')
      const request = {
        saveId: staged.saveId,
        baseOrdinal: value.rootRequest.baseOrdinal,
        tokenOrdinals: value.tokens.map((token, baseOrdinal) => ({
          tokenId: token.id,
          baseOrdinal
        }))
      }
      await value.player.caller.mutation(observe, { saveId: staged.saveId, characterRevisions: [] })
      const beforePreparation = await reactionMechanics(value)
      expect((await value.player.caller.mutation(prepare, request)).outcome.kind).toBe('PENDING')
      expect(await reactionMechanics(value)).toEqual(beforePreparation)
      let result = await value.player.caller.mutation(finish, request)
      let replayRequest = request
      const evidenceKinds: PendingEncounterRuleOccurrenceSummaryDto['kind'][] = []
      while (result.occurrence?.status === 'PENDING') {
        const pending = result.occurrence.pending
        if (
          !pending ||
          (pending.kind !== 'D20_EVIDENCE' && pending.kind !== 'ACTION_OUTCOME_EVIDENCE')
        )
          throw new Error('Expected Character reaction evidence request.')
        evidenceKinds.push(pending.kind)
        const response: ResolveRuleOccurrenceInputDto = {
          type: 'RESOLVE_RULE_OCCURRENCE',
          commandId: crypto.randomUUID(),
          encounterId: value.run.id,
          expectedVersion: pending.encounterVersion,
          occurrenceId: pending.occurrenceId,
          expectedOccurrenceVersion: pending.occurrenceVersion,
          correlationId: null,
          resolution:
            pending.kind === 'D20_EVIDENCE'
              ? {
                  kind: 'ENTER_DICE',
                  requestId: pending.request.requestId,
                  rawFaces: pending.request.rollMode === 'NORMAL' ? [natural] : [natural, natural],
                  rollMode: pending.request.rollMode
                }
              : {
                  kind: 'ENTER_INTEGER',
                  requestId: pending.request.requestId,
                  value: pending.request.min
                }
        }
        const next = await value.player.caller.mutation(beginResponse, response)
        if (!next || next.kind !== 'READY')
          throw new Error('Expected Character reaction evidence geometry save.')
        replayRequest = { ...request, saveId: next.saveId }
        await value.player.caller.mutation(observe, {
          saveId: next.saveId,
          characterRevisions: []
        })
        const prepared = await value.player.caller.mutation(prepare, replayRequest)
        expect(['PENDING', 'TERMINAL']).toContain(prepared.outcome.kind)
        if (pending.kind === 'D20_EVIDENCE' && natural === 20)
          expect(prepared.outcome.kind).toBe('PENDING')
        result = await value.player.caller.mutation(finish, replayRequest)
      }
      expect(evidenceKinds[0]).toBe('D20_EVIDENCE')
      if (natural === 20) expect(evidenceKinds).toContain('ACTION_OUTCOME_EVIDENCE')
      else expect(evidenceKinds).toEqual(['D20_EVIDENCE'])
      expect(result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
      const completed = await reactionMechanics(value)
      expect(completed.runs[0]?.version).toBe(beforePreparation.runs[0]!.version + 1)
      expect(completed.characters).not.toEqual(beforePreparation.characters)
      expect(completed.actors).not.toEqual(beforePreparation.actors)
      if (stop) {
        const rows = await gameplayRows(value)
        expect(rows.liveEntities).toMatchObject([
          {
            entityId: value.tokens.at(-1)?.id,
            value: { entity: { position: value.rootInput.path.at(-1) } }
          }
        ])
      }
      const source = completed.actors.find((actor) => actor.id === choice.choice.reactorActorId)
      if (!source) throw new Error('Expected selected Character reactor.')
      expect(
        encounterRunActorStateSchema.parse(JSON.parse(source.stateJson)).resources
      ).toMatchObject({
        ruleUsage: { [SRD_REACTION_ALLOWANCE_DEFINITION_ID]: 1 }
      })
      await expect(value.player.caller.mutation(finish, replayRequest)).resolves.toMatchObject({
        replayed: true,
        occurrence: { status: 'COMPLETE' }
      })
      expect(await reactionMechanics(value)).toEqual(completed)
    },
    30000
  )

  it('stops a selected authored reaction at its contact and rolls back its final publication', async () => {
    const value = await setup(false, false, true, true)
    const root = await startPending(value)
    const choice = root.pending
    if (choice.kind !== 'MOVEMENT_REACTION') throw new Error('Expected Character reaction choice.')
    const [origin, destination] = value.rootInput.path
    if (!origin || !destination) throw new Error('Expected Character movement path.')
    const pathLength = Math.hypot(destination.x - origin.x, destination.y - origin.y)
    const expectedContact = {
      x: origin.x + ((destination.x - origin.x) * choice.choice.pathDistance) / pathLength,
      y: origin.y + ((destination.y - origin.y) * choice.choice.pathDistance) / pathLength
    }
    const option = choice.choice.options[0]
    if (!option) throw new Error('Expected Character reaction option.')
    const selected = await value.player.caller.mutation(beginResponse, {
      type: 'RESOLVE_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: value.run.id,
      expectedVersion: choice.encounterVersion,
      occurrenceId: choice.occurrenceId,
      expectedOccurrenceVersion: choice.occurrenceVersion,
      correlationId: null,
      resolution: { kind: 'OPTION', optionId: option.optionId }
    })
    if (!selected || selected.kind !== 'READY')
      throw new Error('Expected selected Character response geometry save.')
    let request = {
      saveId: selected.saveId,
      baseOrdinal: value.rootRequest.baseOrdinal,
      tokenOrdinals: value.tokens.map((token, baseOrdinal) => ({ tokenId: token.id, baseOrdinal }))
    }
    await value.player.caller.mutation(observe, { saveId: request.saveId, characterRevisions: [] })
    expect((await value.player.caller.mutation(prepare, request)).outcome.kind).toBe('PENDING')
    let pending = (await value.player.caller.mutation(finish, request)).occurrence?.pending
    if (!pending || pending.kind !== 'D20_EVIDENCE')
      throw new Error('Expected Character TEST request.')
    const test = await value.player.caller.mutation(beginResponse, {
      type: 'RESOLVE_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: value.run.id,
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      correlationId: null,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: pending.request.requestId,
        rawFaces: pending.request.rollMode === 'NORMAL' ? [20] : [20, 20],
        rollMode: pending.request.rollMode
      }
    })
    if (!test || test.kind !== 'READY') throw new Error('Expected Character TEST response save.')
    request = { ...request, saveId: test.saveId }
    await value.player.caller.mutation(observe, { saveId: request.saveId, characterRevisions: [] })
    expect((await value.player.caller.mutation(prepare, request)).outcome.kind).toBe('PENDING')
    pending = (await value.player.caller.mutation(finish, request)).occurrence?.pending
    for (;;) {
      if (!pending || pending.kind !== 'ACTION_OUTCOME_EVIDENCE')
        throw new Error('Expected Character OUTCOME request.')
      const outcome = await value.player.caller.mutation(beginResponse, {
        type: 'RESOLVE_RULE_OCCURRENCE',
        commandId: crypto.randomUUID(),
        encounterId: value.run.id,
        expectedVersion: pending.encounterVersion,
        occurrenceId: pending.occurrenceId,
        expectedOccurrenceVersion: pending.occurrenceVersion,
        correlationId: null,
        resolution: {
          kind: 'ENTER_INTEGER',
          requestId: pending.request.requestId,
          value: pending.request.min
        }
      })
      if (!outcome || outcome.kind !== 'READY')
        throw new Error('Expected Character OUTCOME response save.')
      request = { ...request, saveId: outcome.saveId }
      await value.player.caller.mutation(observe, {
        saveId: request.saveId,
        characterRevisions: []
      })
      const prepared = await value.player.caller.mutation(prepare, request)
      if (prepared.outcome.kind === 'TERMINAL') break
      expect(prepared.outcome.kind).toBe('PENDING')
      pending = (await value.player.caller.mutation(finish, request)).occurrence?.pending
    }
    await value.player.caller.mutation(internal.scenes.geometryStaging.stageFog, {
      saveId: request.saveId,
      layer: {
        ownerUserId: value.player.userId,
        width: 32,
        height: 32,
        chunks: [
          {
            index: 0,
            x: 0,
            y: 0,
            width: 32,
            height: 32,
            data: Buffer.alloc(128, 255).toString('base64')
          }
        ]
      }
    })
    const before = await gameplayRows(value)
    await expect(
      value.player.caller.run(async (ctx) => {
        const published = await ctx.runMutation(finish, request)
        expect(published.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
        expect(await ctx.db.query('characters').collect()).not.toEqual(before.characters)
        expect(await ctx.db.query('encounterRunActors').collect()).not.toEqual(before.actors)
        expect(await ctx.db.query('encounterRuns').collect()).not.toEqual(before.runs)
        expect(await ctx.db.query('encounterRuleOccurrences').collect()).not.toEqual(
          before.occurrences
        )
        expect(await ctx.db.query('encounterRuleReceipts').collect()).not.toEqual(before.receipts)
        expect(await ctx.db.query('sceneLiveStates').collect()).not.toEqual(before.liveStates)
        expect(await ctx.db.query('sceneFogLayers').collect()).not.toEqual(before.fogLayers)
        throw new Error('Injected selected Character final publication rollback')
      })
    ).rejects.toThrow('Injected selected Character final publication rollback')
    expect(await gameplayRows(value)).toEqual(before)
    const completed = await value.player.caller.mutation(finish, request)
    expect(completed).toMatchObject({
      delta: null,
      occurrence: { status: 'COMPLETE', pending: null }
    })
    const after = await gameplayRows(value)
    expect(after.liveEntities).toEqual(before.liveEntities)
    expect(after.liveEntities).toMatchObject([
      { entityId: value.tokens.at(-1)?.id, value: { entity: { position: expectedContact } } }
    ])
    expect(after.liveStates[0]?.version).toBe(before.liveStates[0]!.version + 1)
    expect(after.liveStates[0]?.fogLayerCount).toBe(before.liveStates[0]!.fogLayerCount + 1)
    expect(after.fogLayers).toHaveLength(1)
    expect(after.runs[0]?.version).toBe(before.runs[0]!.version + 1)
    expect(after.characters).not.toEqual(before.characters)
    expect(after.actors).not.toEqual(before.actors)
    expect(after.receipts).not.toEqual(before.receipts)
  }, 30000)

  it.each(['source', 'scene', 'run'] as const)(
    'refuses stale selected Character reaction %s publication without gameplay writes',
    async (stale) => {
      const value = await setup(false, false, true)
      const root = await startPending(value)
      const choice = root.pending
      if (choice.kind !== 'MOVEMENT_REACTION')
        throw new Error('Expected Character reaction choice.')
      const option = choice.choice.options[0]
      if (!option) throw new Error('Expected Character reaction option.')
      const begin = await value.player.caller.mutation(beginResponse, {
        type: 'RESOLVE_RULE_OCCURRENCE',
        commandId: crypto.randomUUID(),
        encounterId: value.run.id,
        expectedVersion: choice.encounterVersion,
        occurrenceId: choice.occurrenceId,
        expectedOccurrenceVersion: choice.occurrenceVersion,
        correlationId: null,
        resolution: { kind: 'OPTION', optionId: option.optionId }
      })
      if (!begin || begin.kind !== 'READY')
        throw new Error('Expected selected Character response geometry save.')
      const request = {
        saveId: begin.saveId,
        baseOrdinal: value.rootRequest.baseOrdinal,
        tokenOrdinals: value.tokens.map((token, baseOrdinal) => ({
          tokenId: token.id,
          baseOrdinal
        }))
      }
      await value.player.caller.mutation(observe, { saveId: begin.saveId, characterRevisions: [] })
      expect((await value.player.caller.mutation(prepare, request)).outcome.kind).toBe('PENDING')
      await value.base.t.run(async (ctx) => {
        if (stale === 'source') {
          const row = await ctx.db
            .query('characters')
            .withIndex('by_publicId', (q) => q.eq('id', value.first.id))
            .unique()
          if (!row) throw new Error('Missing current Character source.')
          await ctx.db.patch(row._id, { streamVersion: row.streamVersion + 1 })
          return
        }
        if (stale === 'scene') {
          const row = await ctx.db
            .query('sceneLiveStates')
            .withIndex('by_sceneId', (q) => q.eq('sceneId', value.sceneId))
            .unique()
          if (!row) throw new Error('Missing current Scene.')
          await ctx.db.patch(row._id, { version: row.version + 1 })
          return
        }
        const row = await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', value.run.id))
          .unique()
        if (!row) throw new Error('Missing current Run.')
        await ctx.db.patch(row._id, { version: row.version + 1 })
      })
      const afterStaleWrite = await gameplayRows(value)
      await expect(value.player.caller.mutation(finish, request)).rejects.toThrow()
      expect(await gameplayRows(value)).toEqual(afterStaleWrite)
    },
    30000
  )

  it('lets the current Character controller decline a GM-initiated move and hides the choice from unrelated members', async () => {
    const value = await setup()
    const occurrence = await startPending(value)
    const unrelated = await addPlayer(value.base)
    await value.base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: value.campaign.id,
        userId: unrelated.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        joinedAt: new Date().toISOString(),
        accessStartedAt: new Date().toISOString(),
        leftAt: null
      })
    )
    expect(
      await value.player.caller.query(pendingRuleOccurrence, { encounterId: value.run.id })
    ).not.toBeNull()
    expect(
      await value.gm.caller.query(pendingRuleOccurrence, { encounterId: value.run.id })
    ).not.toBeNull()
    expect(
      await unrelated.caller.query(pendingRuleOccurrence, { encounterId: value.run.id })
    ).toBeNull()
    const gmCommand = decline(value, occurrence)
    await expect(value.gm.caller.mutation(beginResponse, gmCommand)).resolves.toMatchObject({
      kind: 'READY'
    })
    const command = decline(value, occurrence)
    const begin = await value.player.caller.mutation(beginResponse, command)
    expect(begin).toMatchObject({ kind: 'READY', input: { commandId: command.commandId } })
    if (!begin || begin.kind !== 'READY')
      throw new Error('Expected Character response geometry save.')
    const request = {
      saveId: begin.saveId,
      baseOrdinal: value.rootRequest.baseOrdinal,
      tokenOrdinals: value.tokens.map((token, baseOrdinal) => ({ tokenId: token.id, baseOrdinal }))
    }
    await value.player.caller.mutation(observe, { saveId: begin.saveId, characterRevisions: [] })
    expect((await value.player.caller.mutation(prepare, request)).outcome.kind).toBe('TERMINAL')
    const result = await value.player.caller.mutation(finish, request)
    expect(result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  }, 30000)

  it('refuses outsiders, unrelated members, and a former assignee without gameplay writes or private-choice leakage', async () => {
    const value = await setup(true)
    const occurrence = await startPending(value)
    const command = decline(value, occurrence)
    const unrelated = await addPlayer(value.base)
    await value.base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: value.campaign.id,
        userId: unrelated.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        joinedAt: new Date().toISOString(),
        accessStartedAt: new Date().toISOString(),
        leftAt: null
      })
    )
    const before = await gameplayRows(value)
    await expect(value.base.t.mutation(beginResponse, command)).rejects.toThrow()
    await expect(unrelated.caller.mutation(beginResponse, command)).rejects.toThrow(
      'another controller'
    )
    expect(await gameplayRows(value)).toEqual(before)
    const staged = await value.player.caller.mutation(beginResponse, command)
    expect(staged).toMatchObject({ kind: 'READY' })
    if (!staged || staged.kind !== 'READY')
      throw new Error('Expected stale Character response geometry save.')
    const stagedRequest = {
      saveId: staged.saveId,
      baseOrdinal: value.rootRequest.baseOrdinal,
      tokenOrdinals: value.tokens.map((token, baseOrdinal) => ({ tokenId: token.id, baseOrdinal }))
    }
    await value.player.caller.mutation(observe, {
      saveId: staged.saveId,
      characterRevisions: []
    })
    expect((await value.player.caller.mutation(prepare, stagedRequest)).outcome.kind).toBe(
      'TERMINAL'
    )
    if (!value.second) throw new Error('Missing replacement Character.')
    await value.player.caller.mutation(api.campaigns.assignments.assign, {
      campaignId: value.campaign.id,
      characterId: value.second.id
    })
    const afterAssignment = await gameplayRows(value)
    expect(
      await value.player.caller.query(pendingRuleOccurrence, { encounterId: value.run.id })
    ).toBeNull()
    await expect(value.player.caller.mutation(beginResponse, command)).rejects.toThrow(
      'another controller'
    )
    await expect(value.player.caller.mutation(finish, stagedRequest)).rejects.toThrow()
    expect(await gameplayRows(value)).toEqual(afterAssignment)
  }, 30000)

  it('redacts and refuses the issued choice after the controller leaves the Campaign', async () => {
    const value = await setup()
    const occurrence = await startPending(value)
    const command = decline(value, occurrence)
    await value.base.t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', value.campaign.id).eq('userId', value.player.userId)
        )
        .unique()
      if (!membership) throw new Error('Missing Character controller membership.')
      await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: new Date().toISOString() })
    })
    const afterDeparture = await gameplayRows(value)
    await expect(
      value.player.caller.query(pendingRuleOccurrence, { encounterId: value.run.id })
    ).rejects.toThrow()
    await expect(value.player.caller.mutation(beginResponse, command)).rejects.toThrow()
    expect(await gameplayRows(value)).toEqual(afterDeparture)
  }, 30000)

  it('refuses a changed future Character reaction source before preparing its retained choice', async () => {
    const value = await setup(false, true)
    const root = await startPending(value)
    const first = await stageDecline(value, value.player, root)
    await advanceFutureCharacterSource(value)
    const afterSourceChange = await gameplayRows(value)
    await expect(value.player.caller.mutation(prepare, first.request)).rejects.toThrow()
    expect(await gameplayRows(value)).toEqual(afterSourceChange)
  }, 30000)

  it('refuses a changed future Character reaction source after preparation and before publication', async () => {
    const value = await setup(false, true)
    const root = await startPending(value)
    const first = await stageDecline(value, value.player, root)
    expect((await value.player.caller.mutation(prepare, first.request)).outcome.kind).toBe(
      'PENDING'
    )
    await advanceFutureCharacterSource(value)
    await value.player.caller.mutation(observe, {
      saveId: first.request.saveId,
      characterRevisions: []
    })
    const afterSourceChange = await gameplayRows(value)
    await expect(value.player.caller.mutation(finish, first.request)).rejects.toThrow()
    expect(await gameplayRows(value)).toEqual(afterSourceChange)
  }, 30000)

  it('continues unchanged two-boundary Character reactions from the first decline to the second choice', async () => {
    const value = await setup(false, true)
    if (!value.futurePlayer) throw new Error('Missing future Character controller.')
    const root = await startPending(value)
    const first = await stageDecline(value, value.player, root)
    expect((await value.player.caller.mutation(prepare, first.request)).outcome.kind).toBe(
      'PENDING'
    )
    const next = await value.player.caller.mutation(finish, first.request)
    if (!next.occurrence) throw new Error('Expected second Character occurrence.')
    expect(next.occurrence).toMatchObject({ status: 'PENDING', pending: null })
    const futurePending = await value.futurePlayer.caller.query(pendingRuleOccurrence, {
      encounterId: value.run.id
    })
    if (!futurePending) throw new Error('Expected second Character reaction choice.')
    const future = await stageDecline(value, value.futurePlayer, {
      ...next.occurrence,
      pending: futurePending
    })
    expect((await value.futurePlayer.caller.mutation(prepare, future.request)).outcome.kind).toBe(
      'TERMINAL'
    )
    expect(
      (await value.futurePlayer.caller.mutation(finish, future.request)).occurrence
    ).toMatchObject({
      status: 'COMPLETE',
      pending: null
    })
  }, 30000)
})
