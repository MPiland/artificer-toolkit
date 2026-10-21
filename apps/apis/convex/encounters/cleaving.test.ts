import {
  createConvexEncounterStore,
  createConvexEncounterStoreReader
} from '../lib/convexEncounterStore'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { readTestActor } from '../../tests/fixtures/storedActors'
import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto,
  CreateEncounterInputDto,
  EncounterGmProjectionDto,
  EncounterCommandResultDto,
  EncounterExecuteInput,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import {
  sceneStoredInitialStateSchema,
  sceneStoredDefinitionSaveSchema,
  sceneStoredDefinitionEntitySchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { featureChargeUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import { SRD_CONCENTRATION_DEFINITIONS } from '@artificer-toolkit/source-data/srd/concentration.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { fixture } from '../../tests/fixtures/characters'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { writeCharacterRecord } from '../../tests/fixtures/characterRecords'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { setAutoRollDice, type FixtureRolls } from '../../tests/fixtures/rollPreferences'
import {
  automaticChargedCreature,
  automaticChargedBiteFeatureId,
  automaticChargedBiteEffectId
} from '../../tests/fixtures/encounterAction'
import { api, components, internal } from '../_generated/api'
import { seedConcentration } from '../../tests/fixtures/concentration'
import { concentrationEndOccurrenceId } from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { readRunState, writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import {
  readPendingSnapshot,
  writePendingSnapshot
} from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { readEncounterGmProjection } from '@artificer-toolkit/encounter-persistence/nativeProjection'
import { encounterReadTransaction } from './encounterPorts'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  closeRoom,
  executeInRoom,
  invalidateRoomInputs,
  queueRoomRolls,
  readRoomRollCards,
  readRoomTimeline,
  type RoomCaller,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import {
  expectOtherMembersCommandRefusal,
  expectReusedCommandRefusal,
  expectUnavailableRefusal
} from '../../tests/fixtures/roomRefusals'

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

async function setup(
  rolls: FixtureRolls = 'AUTO_ROLL',
  characterSource = false,
  characterTarget = false
) {
  const creature = {
    ...automaticChargedCreature,
    features: automaticChargedCreature.features?.map((feature) =>
      feature.id !== automaticChargedBiteFeatureId
        ? feature
        : {
            ...feature,
            rollDefinitions: [
              {
                id: crypto.randomUUID(),
                label: 'Cleaving attack',
                kind: 'ATTACK' as const,
                expression: { count: 1, die: 20, modifier: 4 },
                rollMode: 'NORMAL' as const,
                chargeCost: null,
                order: 1
              }
            ],
            effects: feature.effects?.map((effect) => ({
              ...effect,
              invocation: {
                ...effect.invocation,
                triggerCode: 'MELEE_WEAPON_ATTACK' as const,
                range: {
                  id: effect.invocation.range.id,
                  rangeKind: 'DISTANCE' as const,
                  amount: 20,
                  unit: 'FEET' as const
                }
              },
              paths: effect.paths?.map((path) =>
                'resultBlock' in path
                  ? {
                      ...path,
                      pathCode: 'ON_HIT' as const,
                      resultBlock: {
                        ...path.resultBlock,
                        outcomes: path.resultBlock.outcomes.map((outcome) =>
                          outcome.effectKind === 'DAMAGE' && outcome.damageTypeId !== undefined
                            ? { ...outcome, amount: 40 }
                            : outcome
                        )
                      }
                    }
                  : path
              )
            }))
          }
    )
  }
  let base: Awaited<ReturnType<typeof fixture>>
  let characterId: string | null = null
  let targetCharacterId: string | null = null
  let targetController: Awaited<ReturnType<typeof fixture>>['other'] | null = null
  if (characterSource || characterTarget) {
    const feature = creature.features.find(
      (feature) => feature.id === automaticChargedBiteFeatureId
    )
    if (
      !feature?.charges ||
      feature.charges.limitKind !== 'FIXED_AMOUNT' ||
      feature.charges.scalingKind !== 'NONE'
    )
      throw new Error('Missing Character action charge.')
    const ready = await readyCharacterFixture(
      characterSource
        ? {
            resources: {
              id: crypto.randomUUID(),
              label: 'Cleaving action',
              order: 0,
              availableAtLevel: 1,
              charges: { ...feature.charges, resetKind: 'SHORT_REST', amount: 2 }
            },
            features: [
              {
                ...feature,
                availableAtLevel: 1,
                grants: {
                  modifiers: [
                    {
                      id: crypto.randomUUID(),
                      grantKind: 'MODIFIER_GRANT',
                      valueDomainCode: 'ATTACK_ROLL',
                      domain: { attackDomain: 'MELEE' },
                      modifierKind: 'ABILITY_MODIFIER_BONUS',
                      scope: 'SOURCE',
                      selectionKind: 'GRANTED',
                      payload: { ability: 'STRENGTH' },
                      order: 1
                    }
                  ]
                }
              }
            ]
          }
        : {}
    )
    const { draft, character } = await ready.createCharacter()
    await ready.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'create',
      character
    })
    characterId = character.id
    if (characterSource && characterTarget) {
      const target = await ready.createCharacter()
      await ready.owner.caller.mutation(api.characters.commit.commit, {
        expectedDraftId: target.draft.id,
        mode: 'create',
        character: target.character
      })
      targetCharacterId = target.character.id
      const targetUser = await ready.t.run(async (ctx) =>
        ctx.runMutation(components.betterAuth.adapter.create, {
          input: {
            model: 'user',
            data: {
              name: 'Target controller',
              email: 'target-controller@example.invalid',
              emailVerified: true,
              createdAt: Date.now(),
              updatedAt: Date.now()
            }
          },
          onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
        })
      )
      const targetSession = await ready.t.run((ctx) =>
        ctx.runMutation(components.betterAuth.adapter.create, {
          input: {
            model: 'session',
            data: {
              userId: targetUser._id,
              token: crypto.randomUUID(),
              expiresAt: Date.now() + 60000,
              createdAt: Date.now(),
              updatedAt: Date.now()
            }
          }
        })
      )
      const caller = ready.t.withIdentity({ subject: targetUser._id, sessionId: targetSession._id })
      const identity = await caller.query(api.account.identity, {})
      if (!identity) throw new Error('Missing target controller identity.')
      targetController = { caller, userId: identity.userId }
      await ready.t.run(async (ctx) => {
        const row = await readCharacterRow(ctx, targetCharacterId!)
        if (!row) throw new Error('Missing target Character row.')
        const route = await ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (query) => query.eq('subjectId', targetCharacterId!))
          .unique()
        if (!route) throw new Error('Missing target Character route.')
        await writeCharacterRecord(ctx, row, {
          document: readCharacterRecord(row),
          userId: identity.userId
        })
        await ctx.db.patch(route._id, { ownerUserId: identity.userId })
      })
    }
    base = { t: ready.t, owner: ready.other, other: ready.owner, addActor: ready.addActor }
  } else base = await fixture()
  await base.t.run(async (ctx) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
      .unique()
    if (!profile) throw new Error('Missing owner profile.')
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: 'user',
        where: [{ field: '_id', value: profile.authUserId }],
        update: { email: 'draft_123456abcde0@example.invalid' }
      }
    })
  })
  for (const user of [base.owner, base.other, ...(targetController ? [targetController] : [])])
    await setAutoRollDice(base.t, user.userId, rolls === 'AUTO_ROLL')
  const optional = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
    (definition) => definition.document.kind === 'CLEAVING'
  )
  if (!optional) throw new Error('Missing Cleaving definition.')
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: [
      ...SRD_RULE_STATE_DEFINITIONS.filter(
        (definition) =>
          definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID ||
          definition.id === SRD_ACTOR_ACTION_CAPABILITY_DEFINITION_ID ||
          srdSystemRecord.conditionTypes.some(
            (condition) =>
              condition.id === definition.id &&
              (condition.code === 'BLINDED' || condition.code === 'POISONED')
          )
      ),
      ...SRD_CONCENTRATION_DEFINITIONS,
      optional
    ]
  })
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...creature, subjectKind: 'CREATURE', document: creature })]
  })
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Encounter execution fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  if (targetController)
    await base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: targetController.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
    )
  if (characterId)
    await base.other.caller.mutation(api.campaigns.assignments.assign, {
      campaignId: campaign.id,
      characterId
    })
  if (targetCharacterId && targetController)
    await targetController.caller.mutation(api.campaigns.assignments.assign, {
      campaignId: campaign.id,
      characterId: targetCharacterId
    })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Cleaving targets',
    commandId: crypto.randomUUID(),
    enemies: Array.from({ length: targetCharacterId ? 2 : characterId ? 3 : 4 }, () => ({
      kind: 'CREATURE' as const,
      sourceId: creature.id
    }))
  })
  const createdRun = await base.owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const characterActor = createdRun.actors.find(
    (candidate) => candidate.kind === 'CHARACTER' && candidate.sourceId === characterId
  )
  const targetCharacterActor = createdRun.actors.find(
    (candidate) => candidate.kind === 'CHARACTER' && candidate.sourceId === targetCharacterId
  )
  const creatureActors = createdRun.actors.filter((candidate) => candidate.kind === 'CREATURE')
  const orderedActors = characterSource
    ? targetCharacterActor
      ? [characterActor!, creatureActors[0]!, targetCharacterActor, ...creatureActors.slice(1)]
      : [characterActor!, ...creatureActors]
    : characterTarget
      ? [creatureActors[0]!, characterActor!, ...creatureActors.slice(1)]
      : createdRun.actors
  const run = { ...createdRun, actors: orderedActors }
  await attachFixtureRoom(base.t, campaign.id)
  await executeInRoom(base.owner.caller, {
    command: {
      type: 'REPLACE_OPTIONAL_COMBAT_RULES',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: run.version,
      definitionIds: [optional.id]
    }
  })
  // The fixture below writes the Run, its actors and its Scene straight into Convex.
  await closeRoom(campaign.id)
  const actor = run.actors[0]!
  const sceneId = crypto.randomUUID()
  const saveId = crypto.randomUUID()
  const definitionId = crypto.randomUUID()
  const tokens = run.actors.map((_, index) => ({
    id: crypto.randomUUID(),
    assetId: null,
    controlledByUserIds: [],
    height: 1,
    hidden: false,
    label: `Cleaving token ${index}`,
    locked: false,
    position: { x: index * 100, y: 0 },
    rotationDegrees: 0,
    senses: [],
    vision: null,
    width: 1
  }))
  const actionId = await base.t.run(async (ctx) => {
    await activateFixtureRun(
      ctx,
      run.id,
      { automationMode: 'ASSISTED', round: 1, currentActorId: actor.id },
      run.actors.map((candidate) => candidate.id)
    )
    const source = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
      .unique()
    if (!source) throw new Error('Missing source.')
    const capability = discoverEncounterFeatureActionCapabilities({
      spells: new Map(),
      actor: await readTestActor(ctx, source),
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
      abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
    }).find((candidate) => candidate.ownerFeatureId === automaticChargedBiteFeatureId)
    const characterFacts = characterId
      ? await loadCharacterSheetFacts(ctx, base.owner.userId, characterId, campaign.id)
      : null
    const characterAction = characterFacts?.ruleEvaluation.facts.actionCandidates.find(
      (candidate) => candidate.effectId === automaticChargedBiteEffectId
    )
    const selectedActionId = characterAction?.actionId ?? capability?.actionId
    if (!selectedActionId) throw new Error('Missing attack capability.')
    if (characterSource) {
      for (const target of run.actors.slice(2)) {
        const targetRow = await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', target.id))
          .unique()
        if (!targetRow) throw new Error('Missing Cleaving target.')
        const targetState = encounterRunActorStateSchema.parse({
          ...(await readTestActor(ctx, targetRow)),
          public: target.id === run.actors[2]!.id
        })
        await writeRunActor({ db: createConvexEncounterStore(ctx) }, targetRow._id, targetState)
      }
    }
    const now = new Date().toISOString()
    const materializationCommandId = crypto.randomUUID()
    const settings = {
      campaignId: campaign.id,
      name: 'Cleaving Scene',
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
      map: { assetId: crypto.randomUUID(), width: 800, height: 400, tileManifestAssetId: null }
    }
    await ctx.db.insert(
      'campaignScenes',
      sceneStoredInitialStateSchema.parse({
        ...settings,
        id: sceneId,
        definitionId,
        definitionVersion: 1,
        definitionSaveId: saveId,
        version: 0,
        materializationCommandId,
        materializationCommandFingerprint: '0'.repeat(64),
        createdAt: now,
        updatedAt: now
      })
    )
    const counts = {
      annotations: 0,
      barriers: 0,
      darknessZones: 0,
      lights: 0,
      tokens: tokens.length
    }
    await ctx.db.insert(
      'sceneDefinitionSaves',
      sceneStoredDefinitionSaveSchema.parse({
        id: saveId,
        commandId: materializationCommandId,
        commandFingerprint: '0'.repeat(64),
        ownerUserId: base.owner.userId,
        definitionId,
        expectedVersion: null,
        settings,
        counts,
        received: counts,
        status: 'PUBLISHED',
        liveSceneId: sceneId,
        entitiesRemoved: false,
        createdAt: now,
        expiresAt: Date.now() + 60000
      })
    )
    for (const [ordinal, entity] of tokens.entries()) {
      const value = { collection: 'tokens' as const, entity }
      await ctx.db.insert(
        'sceneDefinitionEntities',
        sceneStoredDefinitionEntitySchema.parse({
          saveId,
          entityId: entity.id,
          ordinal,
          value,
          checksum: checksumCanonicalJson(value)
        })
      )
      await ctx.db.insert('encounterActorTokenBindings', {
        encounterId: run.id,
        actorId: run.actors[ordinal]!.id,
        sceneId,
        tokenId: entity.id
      })
    }
    await ctx.db.insert('encounterSceneBindings', {
      encounterId: run.id,
      campaignId: campaign.id,
      sceneId,
      commandId: crypto.randomUUID(),
      commandFingerprint: '0'.repeat(64),
      createdAt: now
    })
    // The room owns Scene-context actions only on its presented Scene (D42).
    await ctx.db.insert('campaignScenePresentations', {
      campaignId: campaign.id,
      sceneId,
      version: 1,
      activeMapAssetId: settings.map.assetId,
      createdAt: now,
      updatedAt: now
    })
    return selectedActionId
  })
  const command: EncounterExecuteInput = {
    command: {
      type: 'RESOLVE_ACTION',
      acceptedWieldConflict: null,
      acknowledgedWarnings: [],
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: run.version + 1,
      actorId: actor.id,
      target: { kind: 'ACTOR', actorId: run.actors[1]!.id },
      actionId,
      optionalCombatIntent: null,
      sceneContext: {
        sceneId,
        expectedSceneVersion: 0,
        sourceTokenId: tokens[0]!.id,
        targetTokenId: tokens[1]!.id
      }
    }
  }
  return {
    ...base,
    campaign,
    run,
    actor,
    sceneId,
    command,
    characterId,
    targetCharacterId,
    targetController
  }
}

/** The Run as the room last published it: the room holds receipts and commands until it checkpoints (D85). */
async function records(base: Awaited<ReturnType<typeof setup>>) {
  await checkpointLiveRoom(base.campaign.id)
  return base.t.run(async (ctx) => ({
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id))
      .collect(),
    occurrences: await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) => q.eq('encounterId', base.run.id))
      .collect()
  }))
}

async function pendingFor(base: Awaited<ReturnType<typeof setup>>, caller: RoomCaller) {
  await checkpointLiveRoom(base.campaign.id)
  return caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
    encounterId: base.run.id
  })
}

/** A retried command's answer: the settled result with the Run's current projection for this member (D85). */
async function withCurrentProjection(
  base: Awaited<ReturnType<typeof setup>>,
  caller: RoomCaller,
  result: EncounterCommandResultDto
) {
  await checkpointLiveRoom(base.campaign.id)
  return {
    ...result,
    projection: await caller.query(api.encounters.projectionReads.get, {
      encounterId: base.run.id
    })
  }
}

async function pendingChoice(base: Awaited<ReturnType<typeof setup>>) {
  const pending = await pendingFor(base, base.owner.caller)
  if (!pending || pending.kind !== 'OPTIONAL_COMBAT_CLEAVING')
    throw new Error('Expected native Cleaving choice.')
  return pending
}

function response(
  base: Awaited<ReturnType<typeof setup>>,
  pending: Awaited<ReturnType<typeof pendingChoice>>,
  decline = false
): ResolveRuleOccurrenceInputDto {
  return {
    type: 'RESOLVE_RULE_OCCURRENCE',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    correlationId: null,
    expectedVersion: pending.encounterVersion,
    occurrenceId: pending.occurrenceId,
    expectedOccurrenceVersion: pending.occurrenceVersion,
    resolution: decline
      ? { kind: 'DECLINE' }
      : { kind: 'OPTION', optionId: pending.options[0]!.optionId }
  }
}

async function completeParent(base: Awaited<ReturnType<typeof setup>>) {
  const root = await executeInRoom(base.owner.caller, base.command)
  let result = root
  const evidence: EncounterExecuteInput[] = []
  while (result.occurrence?.status === 'PENDING') {
    const pending = result.occurrence.pending
    if (!pending || (pending.kind !== 'D20_EVIDENCE' && pending.kind !== 'ACTION_OUTCOME_EVIDENCE'))
      throw new Error('Expected parent attack evidence.')
    const input: EncounterExecuteInput = {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        correlationId: null,
        expectedVersion: pending.encounterVersion,
        occurrenceId: pending.occurrenceId,
        expectedOccurrenceVersion: pending.occurrenceVersion,
        resolution:
          pending.kind === 'D20_EVIDENCE'
            ? {
                kind: 'ENTER_DICE',
                requestId: pending.request.requestId,
                rawFaces: pending.request.rollMode === 'NORMAL' ? [19] : [19, 19],
                rollMode: pending.request.rollMode
              }
            : {
                kind: 'ENTER_INTEGER',
                requestId: pending.request.requestId,
                value: pending.request.min
              }
      }
    }
    evidence.push(input)
    result = await executeInRoom(base.owner.caller, input)
  }
  return { root, result, evidence }
}

describe('native Cleaving action settlement', () => {
  useLocalRoomWorker()

  it('commits the selected Character Cleaving choice from the Worker plan', async () => {
    const base = await setup('AUTO_ROLL', false, true)
    const before = await records(base)
    await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 19 })
    const committed = await executeInRoom(base.owner.caller, base.command)
    const after = await records(base)
    expect(after.run?.version).toBe(before.run!.version + 1)
    expect(
      await base.t.run((ctx) =>
        readEncounterGmProjection(encounterReadTransaction(ctx), readRunState(after.run!))
      )
    ).toEqual(committed.projection)
    // The root's receipt stays in the room; its settled status is the command result's occurrence
    // (receipt shape: packages/rules-runtime/src/__tests__/encounterCleaving.test.ts).
    expect(committed.occurrence?.status).toBe('COMPLETE')
    const pending = after.occurrences.filter((occurrence) => occurrence.state === 'PENDING')
    expect(pending).toHaveLength(1)
    const snapshot = await base.t.run((ctx) =>
      readPendingSnapshot({ db: createConvexEncounterStoreReader(ctx) }, pending[0]!)
    )
    if (snapshot?.applicationContext.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING')
      throw new Error('Missing checkpointed Cleaving choice.')
    expect((await pendingChoice(base)).options).toHaveLength(
      snapshot.applicationContext.options.length
    )
  }, 60_000)

  // D95 supersedes the D63 ordering of a Concentration check before the deferred Cleaving choice: a
  // Cleaving first target is always at 0 hit points, and a Character there falls Unconscious, so
  // its Concentration ends in the attack commit with no check and the choice is offered directly.
  // This fixture's hit overflows the Character's maximum, so it dies (D96) and is defeated.
  it("ends a Cleaving first target Character's Concentration with no check and offers the choice", async () => {
    const base = await setup('PROMPT', false, true)
    if (!base.characterId) throw new Error('Missing Cleaving concentration Character.')
    const seeded = await seedConcentration({
      t: base.t,
      run: base.run,
      target: base.run.actors[1]!,
      character: { id: base.characterId }
    })
    const dependentDefinition = seeded.dependent.definition
    const candidateEffectId = await base.t.run(async (ctx) => {
      const dexterity = srdSystemRecord.abilities?.find((ability) => ability.code === 'DEXTERITY')
      if (!dexterity) throw new Error('Missing Cleaving candidate Dexterity.')
      const authoredEffectId = crypto.randomUUID()
      return (
        await createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).create({
          id: crypto.randomUUID(),
          owner: {
            kind: 'ENCOUNTER_ACTOR',
            encounterId: base.run.id,
            targetActorId: base.run.actors[2]!.id
          },
          definition: {
            ...dependentDefinition,
            authoredEffectId,
            frozenGraph: {
              ...dependentDefinition.frozenGraph,
              source: {
                ...dependentDefinition.frozenGraph.source,
                definitionId: authoredEffectId
              }
            },
            stateContributions: [
              {
                kind: 'SCALAR_REDUCTION',
                valueDefinitionId: dexterity.id,
                amount: 2,
                stacking: 'ADDITIVE',
                floor: 0,
                recoveryTriggers: ['LONG_REST'],
                terminalConsequence: 'TARGET_DIED',
                sourceOutcomeId: crypto.randomUUID(),
                sourceNodeId: 'concentration_candidate',
                sourceOperationKey: 'concentration_candidate'
              }
            ]
          },
          lifecycle: seeded.dependent.lifecycle,
          maintainedEffectStateId: seeded.state.id
        })
      ).id
    })
    const { root, result } = await completeParent(base)
    expect(result.occurrence?.status).toBe('COMPLETE')
    const afterParent = await records(base)
    // The only pending occurrence is the Cleaving choice: no Concentration check precedes it.
    const pending = afterParent.occurrences.filter((entry) => entry.state === 'PENDING')
    expect(pending).toHaveLength(1)
    const choice = await pendingChoice(base)
    expect(choice.options.length).toBeGreaterThan(0)
    const characterEffectIds = (
      await base.t.run((ctx) =>
        ctx.db
          .query('characterActiveRuleEffects')
          .withIndex('by_characterId_createdOrdinal_id', (query) =>
            query.eq('characterId', base.characterId!)
          )
          .collect()
      )
    ).map((effect) => effect.id)
    expect(characterEffectIds).toContain(seeded.independent.id)
    expect(characterEffectIds).not.toContain(seeded.dependent.id)
    const candidateEffects = await base.t.run((ctx) =>
      ctx.db
        .query('encounterActiveRuleEffects')
        .withIndex('by_encounterId_targetActorId_id', (query) =>
          query.eq('encounterId', base.run.id).eq('targetActorId', base.run.actors[2]!.id)
        )
        .collect()
    )
    expect(candidateEffects.map((effect) => effect.id)).not.toContain(candidateEffectId)
    // The end is a durable child of the parent action, keyed by its occurrence and the slot.
    const endId = concentrationEndOccurrenceId(result.occurrence!.occurrenceId, seeded.state.id)
    expect(afterParent.occurrences.find((entry) => entry.id === endId)).toMatchObject({
      state: 'COMPLETED'
    })
    const chat = await base.other.caller.query(api.campaigns.chat.list, {
      campaignId: base.campaign.id,
      room: 'TABLE',
      limit: 100
    })
    expect(
      chat.entries.filter((entry) => entry.body?.endsWith('is defeated and loses Concentration.'))
    ).toHaveLength(1)
    // The parent's stored receipt is untouched by the end: the room still answers a retry of the
    // root from it.
    await expect(executeInRoom(base.owner.caller, base.command)).resolves.toEqual(
      await withCurrentProjection(base, base.owner.caller, root)
    )
    const decline = response(base, choice, true)
    const declined = await executeInRoom(base.owner.caller, { command: decline })
    expect((await records(base)).occurrences.some((entry) => entry.state === 'PENDING')).toBe(false)
    await expect(executeInRoom(base.owner.caller, { command: decline })).resolves.toEqual(
      await withCurrentProjection(base, base.owner.caller, declined)
    )
  }, 60_000)

  it('cleans an attacker-owned concentration dependent after Automatic Cleaving damage', async () => {
    const base = await setup('AUTO_ROLL', true, true)
    if (!base.characterId) throw new Error('Missing Cleaving source Character.')
    const seeded = await seedConcentration({
      t: base.t,
      run: base.run,
      target: base.run.actors[2]!,
      character: { id: base.characterId }
    })
    await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 18 })
    try {
      const { result } = await completeParent(base)
      expect(result.occurrence?.status).toBe('COMPLETE')
      const first = await pendingChoice(base)
      const concentrationTarget = first.options.find(
        (option) => option.targetActorId === base.run.actors[2]!.id
      )
      if (!concentrationTarget) throw new Error('Missing concentrating Cleaving target.')
      const input = response(base, first)
      input.resolution = { kind: 'OPTION', optionId: concentrationTarget.optionId }
      const current = async () => ({
        records: await records(base),
        ...(await base.t.run(async (ctx) => ({
          character: await readCharacterRow(ctx, base.characterId!),
          effects: await ctx.db
            .query('characterActiveRuleEffects')
            .withIndex('by_characterId_createdOrdinal_id', (query) =>
              query.eq('characterId', base.characterId!)
            )
            .collect(),
          states: await ctx.db
            .query('encounterMaintainedEffectStates')
            .withIndex('by_encounter_owner_definition_order', (query) =>
              query.eq('encounterId', base.run.id)
            )
            .collect()
        })))
      })
      const before = await current()
      if (!before.character) throw new Error('Missing Cleaving source Character row.')
      // The target's automatic Concentration save rolls a natural 1.
      await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 0 })
      const applied = await executeInRoom(base.owner.caller, { command: input })
      const after = await current()
      expect(after.character?.play.streamVersion).toBe(before.character.play.streamVersion + 1)
      // The save's outcome lives in the room's receipt (SAVE_FAILURE, with the cleanup it removed:
      // apps/session-worker/src/roomEncounterConcentrationResponse.test.ts); the cleanup is what
      // Convex shows below.
      const character = characterAuthoredDtoSchema.parse(readCharacterRecord(after.character!))
      expect(character.state.conditions).toEqual([{ conditionTypeId: seeded.poisoned.id }])
      const source = readStoredRunActor(
        after.records.actors.find((actor) => actor.id === base.actor.id)!
      )
      expect(source).not.toHaveProperty('conditions')
      expect(after.effects.map((effect) => effect.id)).toEqual([seeded.independent.id])
      expect(after.states.map((state) => state.id)).not.toContain(seeded.state.id)
      expect(after.records.occurrences.filter((entry) => entry.state === 'PENDING')).toHaveLength(1)
      const next = await pendingChoice(base)
      expect(next.occurrenceId).not.toBe(first.occurrenceId)
      // A lost acknowledgement's retry returns the stored result without rolling or writing.
      await expect(executeInRoom(base.owner.caller, { command: input })).resolves.toEqual(
        await withCurrentProjection(base, base.owner.caller, applied)
      )
      await expect(
        executeInRoom(base.owner.caller, { command: { ...input, commandId: crypto.randomUUID() } })
      ).rejects.toMatchObject({ data: { reason: 'VERSION_STALE' } })
      expect(await current()).toEqual(after)
      const nextTargetId = next.options[0]!.targetActorId
      const nextTargetBefore = readStoredRunActor(
        after.records.actors.find((actor) => actor.id === nextTargetId)!
      )
      await expect(
        executeInRoom(base.owner.caller, { command: response(base, next) })
      ).resolves.toMatchObject({
        occurrence: { status: 'COMPLETE' }
      })
      const final = await records(base)
      const nextTargetAfter = readStoredRunActor(
        final.actors.find((actor) => actor.id === nextTargetId)!
      )
      if (nextTargetBefore.kind === 'CHARACTER' || nextTargetAfter.kind === 'CHARACTER')
        throw new Error('Expected a non-Character Cleaving target.')
      expect(nextTargetAfter.currentHitPoints).toBeLessThan(nextTargetBefore.currentHitPoints)
    } finally {
      await queueRoomRolls(base.campaign.id, { rolls: [] })
    }
  }, 60_000)

  it.each(['AUTO_ROLL', 'PROMPT'] as const)(
    'carries one finalized %s attack through a bounded chain without rolling or spending again',
    async (mode) => {
      const base = await setup(mode)
      await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 18 })
      try {
        const { root, result, evidence } = await completeParent(base)
        expect(result.occurrence?.status).toBe('COMPLETE')
        const parent = await records(base)
        expect(
          featureChargeUsed(
            readStoredRunActor(parent.actors.find((actor) => actor.id === base.actor.id)!),
            automaticChargedBiteFeatureId
          )
        ).toBe(1)
        const rolls = (await readRoomRollCards(base.owner.caller, base.campaign.id)).length
        const first = await pendingChoice(base)
        expect(first.options).toHaveLength(2)
        const firstResponse = response(base, first)
        const firstResult = await executeInRoom(base.owner.caller, { command: firstResponse })
        const second = await pendingChoice(base)
        expect(second.options).toHaveLength(1)
        expect(second.occurrenceId).not.toBe(first.occurrenceId)
        await expect(executeInRoom(base.owner.caller, { command: firstResponse })).resolves.toEqual(
          await withCurrentProjection(base, base.owner.caller, firstResult)
        )
        await executeInRoom(base.owner.caller, { command: response(base, second) })
        expect(await pendingFor(base, base.owner.caller)).toBeNull()
        const final = await records(base)
        expect(
          featureChargeUsed(
            readStoredRunActor(final.actors.find((actor) => actor.id === base.actor.id)!),
            automaticChargedBiteFeatureId
          )
        ).toBe(1)
        expect(
          final.actors
            .filter((actor) => actor.id !== base.actor.id)
            .map((actor) => JSON.parse(actor.stateJson).currentHitPoints)
        ).toEqual([0, 0, 0])
        // The chain's children rolled nothing: no further roll card reached the table.
        expect(await readRoomRollCards(base.owner.caller, base.campaign.id)).toHaveLength(rolls)
        // The children's carried damage (29, then 18 requested) is in the room's receipts; the
        // carry rule is packages/rules-runtime/src/__tests__/encounterCleaving.test.ts (chains
        // while it drops undamaged targets), and the three targets at 0 above are its outcome.
        // The room's held history replays the root's own receipt over the current Run.
        await expect(executeInRoom(base.owner.caller, base.command)).resolves.toEqual(
          await withCurrentProjection(base, base.owner.caller, root)
        )
        for (const retained of evidence) await executeInRoom(base.owner.caller, retained)
        expect(await records(base)).toEqual(final)
      } finally {
        await queueRoomRolls(base.campaign.id, { rolls: [] })
      }
    },
    30000
  )

  it('declines without damage and binds exact historical replay to the responding account', async () => {
    const base = await setup()
    await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 18 })
    await expect(executeInRoom(base.owner.caller, base.command)).resolves.toMatchObject({
      occurrence: { status: 'COMPLETE' }
    })
    const before = await records(base)
    const pending = await pendingChoice(base)
    const input = response(base, pending, true)
    const result = await executeInRoom(base.owner.caller, { command: input })
    const after = await records(base)
    expect(after.actors).toEqual(before.actors)
    expect(after.run?.version).toBe(before.run!.version + 1)
    await expect(executeInRoom(base.owner.caller, { command: input })).resolves.toEqual(
      await withCurrentProjection(base, base.owner.caller, result)
    )
    // The same command ID with another answer, or from another account, is not a replay.
    await expectReusedCommandRefusal(
      executeInRoom(base.owner.caller, {
        command: {
          ...input,
          resolution: { kind: 'OPTION', optionId: pending.options[0]!.optionId }
        }
      })
    )
    await expectOtherMembersCommandRefusal(base.other.caller, base.campaign.id, { command: input })
    await expect(pendingFor(base, base.other.caller)).resolves.toBeNull()
    expect(await records(base)).toEqual(after)
  }, 30000)

  it.each(['AUTO_ROLL', 'PROMPT'] as const)(
    'lets the current Character controller choose a visible %s child and keeps private choices and another responder replay unavailable',
    async (mode) => {
      const base = await setup(mode, true)
      await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 18 })
      await completeParent(base)
      const ownerChoice = await pendingChoice(base)
      const playerChoice = await pendingFor(base, base.other.caller)
      if (!playerChoice || playerChoice.kind !== 'OPTIONAL_COMBAT_CLEAVING')
        throw new Error('Expected controller Cleaving choice.')
      expect(ownerChoice.options).toHaveLength(2)
      expect(playerChoice.options).toHaveLength(1)
      const hidden = ownerChoice.options.find(
        (option) => !playerChoice.options.some((visible) => visible.optionId === option.optionId)
      )!
      const before = await records(base)
      const pending = before.occurrences.find((occurrence) => occurrence.state === 'PENDING')!
      const snapshot = await base.t.run((ctx) =>
        readPendingSnapshot({ db: createConvexEncounterStoreReader(ctx) }, pending)
      )
      const sourceCharacter = await base.t.run((ctx) => readCharacterRow(ctx, base.characterId!))
      expect(snapshot?.applicationContext).toMatchObject({
        kind: 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING',
        sourceCurrentness: { kind: 'CHARACTER', streamVersion: sourceCharacter?.play.streamVersion }
      })
      await expect(
        executeInRoom(base.other.caller, {
          command: {
            ...response(base, ownerChoice),
            resolution: { kind: 'OPTION', optionId: hidden.optionId }
          }
        })
      ).rejects.toMatchObject({ data: { reason: 'TARGET_UNAVAILABLE' } })
      expect(await records(base)).toEqual(before)
      const input = response(base, playerChoice)
      const applied = await executeInRoom(base.other.caller, { command: input })
      expect(applied.projection.actors.some((actor) => actor.id === hidden.targetActorId)).toBe(
        false
      )
      await expect(executeInRoom(base.other.caller, { command: input })).resolves.toEqual(
        await withCurrentProjection(base, base.other.caller, applied)
      )
      // Another member's replay of the player's answer is not theirs to read.
      await expectReusedCommandRefusal(executeInRoom(base.owner.caller, { command: input }))
      const remaining = await pendingChoice(base)
      expect(remaining.options.map((option) => option.targetActorId)).toEqual([
        hidden.targetActorId
      ])
      await expect(pendingFor(base, base.other.caller)).resolves.toBeNull()
      await executeInRoom(base.owner.caller, { command: response(base, remaining, true) })
    },
    30000
  )

  it('declines a Cleaving choice the GM voids in the room, then records the void once', async () => {
    const base = await setup()
    await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 18 })
    await executeInRoom(base.owner.caller, base.command)
    const pending = await pendingChoice(base)
    const before = await records(base)
    const timelineBefore = await readRoomTimeline(base.owner.caller, base.campaign.id)
    const voidCommand = {
      type: 'VOID_RULE_OCCURRENCE' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion
    }
    await expect(executeInRoom(base.other.caller, { command: voidCommand })).rejects.toMatchObject({
      data: { code: 'DOMAIN_REJECTED', reason: 'GM_ONLY' }
    })
    expect(await records(base)).toEqual(before)
    const voided = await executeInRoom(base.owner.caller, { command: voidCommand })
    const after = await records(base)
    expect(after.actors).toEqual(before.actors)
    // The decline and the "Voided by the GM" entry each advance the Run once.
    expect(after.run?.version).toBe(before.run!.version + 2)
    const timelineAfter = await readRoomTimeline(base.owner.caller, base.campaign.id)
    expect(
      timelineAfter
        .slice(0, timelineAfter.length - timelineBefore.length)
        .map((entry) => entry.commandType)
        .sort()
    ).toEqual(['RESOLVE_RULE_OCCURRENCE', 'VOID_RULE_OCCURRENCE'])
    expect(voided.occurrence).toMatchObject({
      occurrenceId: pending.occurrenceId,
      status: 'COMPLETE'
    })
    expect(after.occurrences.some((occurrence) => occurrence.state === 'PENDING')).toBe(false)
  }, 30000)
  it('allows decline after an offered token moves, without damage or another child', async () => {
    const base = await setup()
    await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 18 })
    await executeInRoom(base.owner.caller, base.command)
    const pending = await pendingChoice(base)
    // The Scene's token geometry is written straight into Convex, so the room drops its held copy.
    await closeRoom(base.campaign.id)
    await base.t.run(async (ctx) => {
      const scene = await ctx.db
        .query('campaignScenes')
        .withIndex('by_publicId', (q) => q.eq('id', base.sceneId))
        .unique()
      const binding = await ctx.db
        .query('encounterActorTokenBindings')
        .withIndex('by_encounterId_actorId', (q) =>
          q.eq('encounterId', base.run.id).eq('actorId', pending.options[0]!.targetActorId)
        )
        .unique()
      if (!scene || !binding) throw new Error('Missing token.')
      const row = await ctx.db
        .query('sceneDefinitionEntities')
        .withIndex('by_saveId_collection_entityId', (q) =>
          q
            .eq('saveId', scene.definitionSaveId)
            .eq('value.collection', 'tokens')
            .eq('entityId', binding.tokenId)
        )
        .unique()
      if (!row || row.value.collection !== 'tokens') throw new Error('Missing token geometry.')
      const value = { ...row.value, entity: { ...row.value.entity, position: { x: 10000, y: 0 } } }
      await ctx.db.patch(row._id, { value, checksum: checksumCanonicalJson(value) })
    })
    const before = await records(base)
    await expectUnavailableRefusal(
      executeInRoom(base.owner.caller, { command: response(base, pending) }),
      'Cleaving policy, target, or Scene is stale'
    )
    expect(await records(base)).toEqual(before)
    await executeInRoom(base.owner.caller, { command: response(base, pending, true) })
    const after = await records(base)
    expect(after.actors).toEqual(before.actors)
    expect(after.occurrences).toHaveLength(before.occurrences.length)
    expect(after.occurrences.some((occurrence) => occurrence.state === 'PENDING')).toBe(false)
  }, 30000)

  it('refuses a choice after canonical Character currentness changes and still lets the current controller decline', async () => {
    const base = await setup('AUTO_ROLL', true)
    await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 18 })
    await completeParent(base)
    const pending = await pendingFor(base, base.other.caller)
    if (!pending || pending.kind !== 'OPTIONAL_COMBAT_CLEAVING' || !base.actor.sourceId)
      throw new Error('Expected Character Cleaving choice.')
    const sheet = await base.other.caller.query(api.characters.sheet.get, {
      id: base.actor.sourceId
    })
    if (!sheet) throw new Error('Expected the controller Character Sheet.')
    await base.other.caller.mutation(api.characters.sheetCommands.execute, {
      id: base.actor.sourceId,
      command: {
        type: 'CREATE_NOTE',
        commandId: crypto.randomUUID(),
        expectedVersion: sheet.meta.streamVersion,
        title: 'Changed during Cleaving',
        body: 'The source Character advanced.',
        groupId: 'session-notes'
      }
    })
    // A note is not a live play command: it commits in Convex, and the room reloads the Character.
    await invalidateRoomInputs(base.campaign.id, ['CHARACTER'])
    const before = await records(base)
    await expectUnavailableRefusal(
      executeInRoom(base.other.caller, { command: response(base, pending) }),
      'Cleaving policy, target, or Scene is stale'
    )
    expect(await records(base)).toEqual(before)
    await executeInRoom(base.other.caller, { command: response(base, pending, true) })
    const after = await records(base)
    expect(after.actors).toEqual(before.actors)
    expect(after.occurrences).toHaveLength(before.occurrences.length)
    expect(after.occurrences.some((occurrence) => occurrence.state === 'PENDING')).toBe(false)
  }, 30000)

  it.each(['miss', 'already injured'] as const)(
    'does not open a child when the original target is %s',
    async (reason) => {
      const base = await setup()
      if (reason === 'already injured')
        await base.t.run(async (ctx) => {
          const row = await ctx.db
            .query('encounterRunActors')
            .withIndex('by_encounterId_id', (q) =>
              q.eq('encounterId', base.run.id).eq('id', base.run.actors[1]!.id)
            )
            .unique()
          if (!row) throw new Error('Missing target.')
          const actor = encounterRunActorStateSchema.parse({
            ...(await readTestActor(ctx, row)),
            currentHitPoints: 10
          })
          await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, actor)
        })
      await queueRoomRolls(base.campaign.id, { rolls: [], repeat: reason === 'miss' ? 0 : 18 })
      await executeInRoom(base.owner.caller, base.command)
      expect(await pendingFor(base, base.owner.caller)).toBeNull()
      expect((await records(base)).occurrences).toHaveLength(1)
    },
    30000
  )

  it('refuses stale source, target and choice answers atomically', async () => {
    const base = await setup()
    await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 18 })
    await executeInRoom(base.owner.caller, base.command)
    const pending = await pendingChoice(base)
    const input = response(base, pending)
    // Each step below writes the Run straight into Convex, so the room holds no copy of it first:
    // the answer then hydrates from the changed rows, and a refusal leaves them as written.
    await closeRoom(base.campaign.id)
    const before = await records(base)
    for (const actorId of [base.actor.id, pending.options[0]!.targetActorId]) {
      await base.t.run(async (ctx) => {
        const row = before.actors.find((actor) => actor.id === actorId)!
        const changed = { ...(await readTestActor(ctx, row)), currentHitPoints: 1 }
        await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, changed)
      })
      const stale = await records(base)
      await expectUnavailableRefusal(
        executeInRoom(base.owner.caller, { command: input }),
        'Cleaving policy, target, or Scene is stale'
      )
      await closeRoom(base.campaign.id)
      expect(await records(base)).toEqual(stale)
      await base.t.run(async (ctx) => {
        const row = before.actors.find((actor) => actor.id === actorId)!
        await ctx.db.patch(row._id, { stateJson: row.stateJson, stateChecksum: row.stateChecksum })
      })
    }
    const occurrence = before.occurrences.find((occurrence) => occurrence.state === 'PENDING')!
    const original = await base.t.run((ctx) =>
      readPendingSnapshot({ db: createConvexEncounterStoreReader(ctx) }, occurrence)
    )
    if (!original) throw new Error('Expected pending Cleaving choice.')
    for (const tamper of ['damage', 'policy'] as const) {
      await base.t.run(async (ctx) => {
        const snapshot = structuredClone(original)
        const context = snapshot.applicationContext
        if (context.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING')
          throw new Error('Expected pending Cleaving choice.')
        if (tamper === 'damage') {
          context.damage.resolvedAmount += 1
          context.damage.remainingAmount += 1
        } else context.optionalCombat.definitionChecksum = 'f'.repeat(64)
        await ctx.db.patch(occurrence._id, {
          pendingSnapshotChecksum: await writePendingSnapshot(
            { db: createConvexEncounterStore(ctx) },
            occurrence,
            snapshot
          )
        })
      })
      const tampered = await records(base)
      await expectUnavailableRefusal(
        executeInRoom(base.owner.caller, { command: input }),
        tamper === 'damage'
          ? 'Cleaving retained damage is stale'
          : 'Cleaving rule definition is stale'
      )
      await closeRoom(base.campaign.id)
      expect(await records(base)).toEqual(tampered)
      await base.t.run(async (ctx) =>
        ctx.db.patch(occurrence._id, {
          pendingSnapshotChecksum: await writePendingSnapshot(
            { db: createConvexEncounterStore(ctx) },
            occurrence,
            original
          )
        })
      )
    }
    await executeInRoom(base.owner.caller, { command: input })
    expect((await records(base)).run?.version).toBe(before.run!.version + 1)
  }, 30000)
})
