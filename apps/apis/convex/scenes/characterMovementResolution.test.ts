import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
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
import {
  sceneStoredDefinitionEntitySchema,
  sceneStoredDefinitionSaveSchema,
  sceneStoredInitialStateSchema,
  sceneStoredPresentationSchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
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
  createDnd5eReactionChoiceDefinition,
  createDnd5eOpportunityReactionEligibilityDefinition
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/reactionEligibilityPolicy'
import { api, components, internal } from '../_generated/api'
import {
  joinCharacterPlay,
  readCharacterRecord,
  readCharacterRow
} from '../characters/stateDocuments'
import { sourceImportBatches } from '../content/importBatches'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { writeCharacterRecord } from '../../tests/fixtures/characterRecords'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { reactionBinding } from '../../tests/fixtures/reactionBinding'
import { srdWolf } from '../../tests/fixtures/srdCreatures'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  executeInRoom,
  executeSceneInRoom,
  executeSheetInRoom,
  deliverQueuedRoomControl,
  invalidateRoomInputs,
  readRoomTimeline,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

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
const pendingRuleOccurrence = makeFunctionReference<
  'query',
  { encounterId: string },
  PendingEncounterRuleOccurrenceSummaryDto | null
>('encounters/pendingReads:pendingRuleOccurrence')

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
  const sourceFeature = structuredClone(
    srdWolf.features?.find((feature) => feature.label === 'Bite')
  )
  const sourceEffect = structuredClone(sourceFeature?.effects?.[0])
  if (!sourceFeature || !sourceEffect) throw new Error('Missing Character reaction source.')
  sourceEffect.invocation = {
    ...sourceEffect.invocation,
    kind: 'ACTION',
    triggerCode: 'MELEE_WEAPON_ATTACK',
    activation: { code: 'REACTION', amount: 1 },
    ...(assisted ? { resourceUse: { chargeId, cost: 1 } } : {}),
    reactionTrigger: {
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
      const row = await readCharacterRow(ctx, second.character.id)
      const route = await ctx.db
        .query('authoredRouteIds')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', second.character.id))
        .unique()
      if (!row || !route) throw new Error('Missing future Character.')
      await writeCharacterRecord(ctx, row, {
        document: readCharacterRecord(row),
        userId: futurePlayer.userId
      })
      await ctx.db.patch(route._id, { ownerUserId: futurePlayer.userId })
    })
  const definitions = [
    ...SRD_RULE_STATE_DEFINITIONS,
    ...[
      createDnd5eOpportunityReactionEligibilityDefinition(),
      createDnd5eReactionChoiceDefinition()
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
    await importSeededSubjects(base.t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ ...srdWolf, subjectKind: 'CREATURE', document: srdWolf })]
    })
  }
  const blueprint = await gm.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Character movement authority fixture',
    commandId: crypto.randomUUID(),
    enemies: assisted
      ? [{ kind: 'CREATURE', sourceId: srdWolf.id }]
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
    assisted ? actor.kind === 'CREATURE' && actor.sourceId === srdWolf.id : actor.kind === 'CUSTOM'
  )
  if (!reactor || !mover || (futurePlayer && !futureReactorActor))
    throw new Error('Missing Character reaction actors.')
  await base.t.run((ctx) =>
    activateFixtureRun(ctx, run.id, {
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: mover.id
    })
  )
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
      // The future reactor stands one cell off the mover's path, which the mover may not walk through.
      position: { x, y: x === 250 ? 150 : 50 },
      rotationDegrees: 0,
      senses: [],
      vision: null
    })
  )
  const settings = {
    campaignId: campaign.id,
    name: 'Character response scene',
    ambientIllumination: 'BRIGHT' as const,
    daylight: false,
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
  await attachFixtureRoom(base.t, campaign.id)
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
    rootInput
  }
}

async function startPending(value: Awaited<ReturnType<typeof setup>>) {
  const result = (await executeSceneInRoom(value.gm.caller, value.rootInput)).result
  if (!result?.occurrence?.pending) throw new Error('Expected Character controller pending choice.')
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

/**
 * Convex's rows after the room checkpoints what it holds (a Run's state is the room's until then,
 * D85), with the room's own command timeline: its commands and receipts are held history.
 */
async function gameplayRows(value: Awaited<ReturnType<typeof setup>>) {
  await checkpointLiveRoom(value.campaign.id)
  const timeline = await readRoomTimeline(value.gm.caller, value.campaign.id)
  return value.base.t.run(async (ctx) => ({
    timeline,
    characters: await Promise.all(
      (await ctx.db.query('characters').collect()).map((row) => joinCharacterPlay(ctx, row))
    ),
    runs: await ctx.db.query('encounterRuns').collect(),
    actors: await ctx.db.query('encounterRunActors').collect(),
    occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    characterReceipts: await ctx.db.query('characterCommandReceipts').collect(),
    scenes: await ctx.db.query('campaignScenes').collect(),
    liveStates: await ctx.db.query('sceneLiveStates').collect(),
    liveEntities: await ctx.db.query('sceneLiveEntities').collect(),
    sceneEntities: await ctx.db.query('sceneDefinitionEntities').collect(),
    fogSaves: await ctx.db.query('sceneFogSaves').collect(),
    fogLayers: await ctx.db.query('sceneFogLayers').collect()
  }))
}

async function reactionMechanics(value: Awaited<ReturnType<typeof setup>>) {
  await checkpointLiveRoom(value.campaign.id)
  const timeline = await readRoomTimeline(value.gm.caller, value.campaign.id)
  return value.base.t.run(async (ctx) => ({
    timeline,
    characters: await Promise.all(
      (await ctx.db.query('characters').collect()).map((row) => joinCharacterPlay(ctx, row))
    ),
    runs: await ctx.db.query('encounterRuns').collect(),
    actors: await ctx.db.query('encounterRunActors').collect(),
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    fog: await ctx.db.query('sceneFogLayers').collect()
  }))
}

async function declineAs(
  value: Awaited<ReturnType<typeof setup>>,
  caller: Awaited<ReturnType<typeof setup>>['player'],
  occurrence: Awaited<ReturnType<typeof startPending>>
) {
  return executeInRoom(caller.caller, { command: decline(value, occurrence) })
}

/** The pending choice as a member reads it from Convex once the room checkpoints. */
async function checkpointedPendingFor(
  value: Awaited<ReturnType<typeof setup>>,
  caller: Awaited<ReturnType<typeof setup>>['player']
) {
  await checkpointLiveRoom(value.campaign.id)
  return caller.caller.query(pendingRuleOccurrence, { encounterId: value.run.id })
}

/**
 * Changes a held Character's source the way play does: its controller's Sheet command commits in
 * the room and advances the Character's stream version, which its reaction sources carry.
 */
async function advanceCharacterSource(
  value: Awaited<ReturnType<typeof setup>>,
  character: { id: string },
  controller: Awaited<ReturnType<typeof setup>>['player']
) {
  await checkpointLiveRoom(value.campaign.id)
  const row = await value.base.t.run((ctx) => readCharacterRow(ctx, character.id))
  if (!row) throw new Error('Missing Character source record.')
  await executeSheetInRoom(controller.caller, {
    scope: 'CHARACTER_SHEET',
    characterId: character.id,
    encounterId: value.run.id,
    command: {
      type: 'ADJUST_HIT_POINTS',
      mode: 'DAMAGE',
      amount: 1,
      commandId: crypto.randomUUID(),
      expectedVersion: row.play.streamVersion
    }
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
      const beforePreparation = await reactionMechanics(value)
      let lastResponse = selected
      let result = await executeInRoom(value.player.caller, { command: selected })
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
        lastResponse = response
        result = await executeInRoom(value.player.caller, { command: response })
        // A natural 20 on the TEST still owes the OUTCOME evidence.
        if (pending.kind === 'D20_EVIDENCE' && natural === 20)
          expect(result.occurrence?.status).toBe('PENDING')
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
      expect(readStoredRunActor(source).resources).toMatchObject({
        ruleUsage: { [SRD_REACTION_ALLOWANCE_DEFINITION_ID]: 1 }
      })
      await expect(executeInRoom(value.player.caller, { command: lastResponse })).resolves.toEqual(
        result
      )
      expect(await reactionMechanics(value)).toEqual(completed)
    },
    30000
  )

  it('stops a selected authored reaction at its contact', async () => {
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
    let result = await executeInRoom(value.player.caller, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        commandId: crypto.randomUUID(),
        encounterId: value.run.id,
        expectedVersion: choice.encounterVersion,
        occurrenceId: choice.occurrenceId,
        expectedOccurrenceVersion: choice.occurrenceVersion,
        correlationId: null,
        resolution: { kind: 'OPTION', optionId: option.optionId }
      }
    })
    let pending = result.occurrence?.pending
    if (!pending || pending.kind !== 'D20_EVIDENCE')
      throw new Error('Expected Character TEST request.')
    result = await executeInRoom(value.player.caller, {
      command: {
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
      }
    })
    pending = result.occurrence?.pending
    // Convex's rows are read just before each OUTCOME answer; the last read precedes the settling one.
    let before: Awaited<ReturnType<typeof gameplayRows>> | undefined
    for (;;) {
      if (!pending || pending.kind !== 'ACTION_OUTCOME_EVIDENCE')
        throw new Error('Expected Character OUTCOME request.')
      before = await gameplayRows(value)
      result = await executeInRoom(value.player.caller, {
        command: {
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
        }
      })
      if (result.occurrence?.status !== 'PENDING') break
      pending = result.occurrence.pending
    }
    expect(result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    const after = await gameplayRows(value)
    if (!before) throw new Error('Expected a pre-settlement read.')
    expect(after.liveEntities).toEqual(before.liveEntities)
    expect(after.liveEntities).toMatchObject([
      { entityId: value.tokens.at(-1)?.id, value: { entity: { position: expectedContact } } }
    ])
    expect(after.runs[0]?.version).toBe(before.runs[0]!.version + 1)
    expect(after.characters).not.toEqual(before.characters)
    expect(after.actors).not.toEqual(before.actors)
    expect(after.timeline).not.toEqual(before.timeline)
  }, 30000)

  it('lets the current Character controller decline a GM-initiated move and hides the choice from unrelated members', async () => {
    const value = await setup()
    // Convex writes are refused while the room holds the Run, so the unrelated member joins first.
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
    await invalidateRoomInputs(value.campaign.id, ['CAMPAIGN'])
    const occurrence = await startPending(value)
    expect(await checkpointedPendingFor(value, value.player)).not.toBeNull()
    expect(
      await value.gm.caller.query(pendingRuleOccurrence, { encounterId: value.run.id })
    ).not.toBeNull()
    expect(
      await unrelated.caller.query(pendingRuleOccurrence, { encounterId: value.run.id })
    ).toBeNull()
    const result = await declineAs(value, value.player, occurrence)
    expect(result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  }, 30000)

  it('lets the GM decline a GM-initiated move', async () => {
    const value = await setup()
    const occurrence = await startPending(value)
    const result = await executeInRoom(value.gm.caller, { command: decline(value, occurrence) })
    expect(result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  }, 30000)

  it('refuses outsiders, unrelated members, and a former assignee without gameplay writes or private-choice leakage', async () => {
    const value = await setup(true)
    // Convex writes are refused while the room holds the Run, so the unrelated member joins first.
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
    await invalidateRoomInputs(value.campaign.id, ['CAMPAIGN'])
    const occurrence = await startPending(value)
    const command = decline(value, occurrence)
    const before = await gameplayRows(value)
    await expect(executeInRoom(unrelated.caller, { command })).rejects.toThrow()
    expect(await gameplayRows(value)).toEqual(before)
    if (!value.second) throw new Error('Missing replacement Character.')
    await value.player.caller.mutation(api.campaigns.assignments.assign, {
      campaignId: value.campaign.id,
      characterId: value.second.id
    })
    await deliverQueuedRoomControl(value.base.t)
    // D74: the room freezes the unassigned Character's actor in the reconcile the notice starts, and
    // a checkpoint orders behind it, so the baseline already carries the freeze.
    await checkpointLiveRoom(value.campaign.id)
    const frozen = await value.base.t.run(async (ctx) =>
      (await ctx.db.query('encounterRunActors').collect()).flatMap((row) => {
        const actor = readStoredRunActor(row)
        return actor.kind === 'CHARACTER' ? [Boolean(actor.frozenState)] : []
      })
    )
    expect(frozen).toEqual([true])
    const afterAssignment = await gameplayRows(value)
    expect(await checkpointedPendingFor(value, value.player)).toBeNull()
    await expect(executeInRoom(value.player.caller, { command })).rejects.toThrow()
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
    await invalidateRoomInputs(value.campaign.id, ['CAMPAIGN'])
    const afterDeparture = await gameplayRows(value)
    await expect(
      value.player.caller.query(pendingRuleOccurrence, { encounterId: value.run.id })
    ).rejects.toThrow()
    await expect(executeInRoom(value.player.caller, { command })).rejects.toThrow()
    expect(await gameplayRows(value)).toEqual(afterDeparture)
  }, 30000)

  // The real room revalidates the retained future choice when the first reactor declines. A genuine
  // Sheet-driven source change makes it stale, so the room discovers that reactor's options again
  // instead of failing the decline.
  it('discovers a changed future Character reaction source again when the first reactor declines', async () => {
    const value = await setup(false, true, true)
    if (!value.futurePlayer || !value.futureCharacter)
      throw new Error('Missing future Character controller.')
    const root = await startPending(value)
    await advanceCharacterSource(value, value.futureCharacter, value.futurePlayer)
    const next = await declineAs(value, value.player, root)
    expect(next.occurrence).toMatchObject({ status: 'PENDING', pending: null })
    const futurePending = await checkpointedPendingFor(value, value.futurePlayer)
    if (futurePending?.kind !== 'MOVEMENT_REACTION')
      throw new Error('Expected the future Character reaction choice.')
    const option = futurePending.choice.options[0]
    if (!option) throw new Error('Expected a freshly discovered future Character option.')
    // The fresh option is current: choosing it is not refused as stale.
    const chosen = await executeInRoom(value.futurePlayer.caller, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        commandId: crypto.randomUUID(),
        encounterId: value.run.id,
        expectedVersion: futurePending.encounterVersion,
        occurrenceId: futurePending.occurrenceId,
        expectedOccurrenceVersion: futurePending.occurrenceVersion,
        correlationId: null,
        resolution: { kind: 'OPTION', optionId: option.optionId }
      }
    })
    expect(chosen.occurrence).toMatchObject({ occurrenceId: futurePending.occurrenceId })
  }, 30000)

  // Coverage for the producer's refusal (`revalidateEncounterMovementReactionOption`): it needs the
  // room's locked Characters and Scene, so it is proved through the real room rather than a
  // rules-runtime fixture.
  it('refuses a selected reaction whose Character source changed after its choice was prepared as VERSION_STALE', async () => {
    const value = await setup(false, false, true)
    const root = await startPending(value)
    const choice = root.pending
    if (choice.kind !== 'MOVEMENT_REACTION') throw new Error('Expected Character reaction choice.')
    const option = choice.choice.options[0]
    if (!option) throw new Error('Expected Character reaction option.')
    await advanceCharacterSource(value, value.first, value.player)
    const afterSourceChange = await gameplayRows(value)
    await expect(
      executeInRoom(value.player.caller, {
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE',
          commandId: crypto.randomUUID(),
          encounterId: value.run.id,
          expectedVersion: choice.encounterVersion,
          occurrenceId: choice.occurrenceId,
          expectedOccurrenceVersion: choice.occurrenceVersion,
          correlationId: null,
          resolution: { kind: 'OPTION', optionId: option.optionId }
        }
      })
    ).rejects.toMatchObject({
      data: {
        code: 'DOMAIN_REJECTED',
        reason: 'VERSION_STALE',
        message: 'This reaction changed; refresh and choose again.'
      }
    })
    expect(await gameplayRows(value)).toEqual(afterSourceChange)
  }, 30000)

  it('continues unchanged two-boundary Character reactions from the first decline to the second choice', async () => {
    const value = await setup(false, true)
    if (!value.futurePlayer) throw new Error('Missing future Character controller.')
    const root = await startPending(value)
    const next = await declineAs(value, value.player, root)
    if (!next.occurrence) throw new Error('Expected second Character occurrence.')
    expect(next.occurrence).toMatchObject({ status: 'PENDING', pending: null })
    const futurePending = await checkpointedPendingFor(value, value.futurePlayer)
    if (!futurePending) throw new Error('Expected second Character reaction choice.')
    const future = await declineAs(value, value.futurePlayer, {
      ...next.occurrence,
      pending: futurePending
    })
    expect(future.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  }, 30000)
})
