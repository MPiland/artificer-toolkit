import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { serverAggregateChoicePendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type {
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import {
  sceneStoredInitialStateSchema,
  sceneStoredDefinitionSaveSchema,
  sceneStoredDefinitionEntitySchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { featureChargeUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import {
  createPlatformRulesRuntime,
  deriveRulesContinuationKey
} from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import { SRD_CONCENTRATION_DEFINITIONS } from '@artificer-toolkit/source-data/srd/concentration.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { seedActiveInitiative } from '../../tests/fixtures/activeInitiative'
import { fixture } from '../../tests/fixtures/characters'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { importedSubject } from '../../tests/fixtures/publication'
import { setAutoRollDice, type FixtureRolls } from '../../tests/fixtures/rollPreferences'
import {
  automaticChargedCreature,
  automaticChargedBiteFeatureId,
  automaticChargedBiteEffectId
} from '../../tests/fixtures/encounterAction'
import { api, components, internal } from '../_generated/api'
import * as rollRandom from '../lib/rollRandom'
import { seedConcentration } from '../../tests/fixtures/concentration'
import { createActiveRuleEffectStore } from '../rules/effectStore'
import {
  commitNativeLiveEncounterAction,
  planNativeLiveEncounterAction
} from '../../../session-worker/src/nativeEncounterRules'
import { planNativeLiveConcentrationResponse } from '../../../session-worker/src/nativeConcentrationResponse'
import { callLiveSessionRoute } from '../../../session-worker/src/liveSessionRoutes'
import { executeNativeEncounterAction } from './actionCommands'
import {
  insertActiveLiveAuthority,
  stubLiveSessionFetch,
  workerEnvironment
} from '../../tests/fixtures/liveSessionWorker'

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
const capture = makeFunctionReference<
  'query',
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse
>('liveSessions/encounterRulesCapture:capture')

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
                          outcome.effectKind === 'DAMAGE' ? { ...outcome, amount: 40 } : outcome
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
    const feature = creature.features?.find(
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
        const row = await ctx.db
          .query('characters')
          .withIndex('by_publicId', (query) => query.eq('id', targetCharacterId!))
          .unique()
        if (!row) throw new Error('Missing target Character row.')
        const route = await ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (query) => query.eq('subjectId', targetCharacterId!))
          .unique()
        if (!route) throw new Error('Missing target Character route.')
        const document = characterAuthoredDtoSchema.parse({
          ...JSON.parse(row.documentJson),
          userId: identity.userId
        })
        await ctx.db.patch(row._id, {
          userId: identity.userId,
          documentJson: canonicalizeRuleDocument(document),
          checksum: checksumRuleDocument(document)
        })
        await ctx.db.patch(route._id, { ownerUserId: identity.userId })
      })
    }
    base = { t: ready.t, owner: ready.other, other: ready.owner }
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
  await base.t.mutation(internal.content.import.importSubjects, {
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
  await base.owner.caller.mutation(internal.encounters.commands.execute, {
    command: {
      type: 'REPLACE_OPTIONAL_COMBAT_RULES',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: run.version,
      definitionIds: [optional.id]
    }
  })
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
    vision: null,
    width: 1
  }))
  const actionId = await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!row) throw new Error('Missing run.')
    const state = encounterRunStateSchema.parse({
      ...JSON.parse(row.stateJson),
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: actor.id
    })
    const projection = encounterGmProjectionDtoSchema.parse({
      ...JSON.parse(row.projectionJson),
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: actor.id
    })
    await ctx.db.patch(row._id, {
      status: 'ACTIVE',
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state),
      projectionJson: JSON.stringify(projection),
      projectionChecksum: checksumCanonicalJson(projection)
    })
    await seedActiveInitiative(
      ctx,
      state,
      run.actors.map((candidate) => candidate.id)
    )
    const source = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
      .unique()
    if (!source) throw new Error('Missing source.')
    const capability = discoverEncounterFeatureActionCapabilities({
      actor: encounterRunActorStateSchema.parse(JSON.parse(source.stateJson)),
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
          ...JSON.parse(targetRow.stateJson),
          public: target.id === run.actors[2]!.id
        })
        await ctx.db.patch(targetRow._id, {
          stateJson: JSON.stringify(targetState),
          stateChecksum: checksumCanonicalJson(targetState)
        })
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
      targetActorId: run.actors[1]!.id,
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

async function records(base: Awaited<ReturnType<typeof setup>>) {
  return base.t.run(async (ctx) => ({
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
      .collect(),
    receipts: await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', base.run.id))
      .collect(),
    commands: await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', base.run.id))
      .collect()
  }))
}

async function pendingChoice(base: Awaited<ReturnType<typeof setup>>) {
  const pending = await base.owner.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
    encounterId: base.run.id
  })
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
  let result = await base.owner.caller.action(
    internal.encounters.commandActions.execute,
    base.command
  )
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
    result = await base.owner.caller.action(internal.encounters.commandActions.execute, input)
  }
  return { result, evidence }
}

describe('native Cleaving action settlement', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
  it('commits the selected Character Cleaving choice with native root and child parity', async () => {
    const base = await setup('AUTO_ROLL', false, true)
    const command = base.command.command
    if (command.type !== 'RESOLVE_ACTION') throw new Error('Missing Cleaving action command.')
    const workerSecret = 'private-cleaving-planning-test-secret-at-least-32-bytes'
    const authSecret = 'private-cleaving-continuation-test-secret-at-least-32-bytes'
    const authorityEpoch = crypto.randomUUID()
    await base.t.run((ctx) =>
      insertActiveLiveAuthority(ctx, {
        campaignId: base.campaign.id,
        epoch: authorityEpoch,
        createdAt: base.campaign.createdAt
      })
    )
    const scope = {
      campaignId: base.campaign.id,
      authorityEpoch,
      expectedUserId: base.owner.userId,
      expectedRole: 'OWNER' as const,
      encounterId: base.run.id,
      expectedVersion: command.expectedVersion
    }
    vi.stubEnv('LIVE_SESSION_WORKER_SECRET', workerSecret)
    vi.stubEnv('BETTER_AUTH_SECRET', authSecret)
    const bindings = await base.owner.caller.query(capture, {
      ...scope,
      request: { kind: 'CLEAVING_BINDINGS' }
    })
    if (bindings.kind !== 'CLEAVING_BINDINGS') throw new Error('Missing Cleaving bindings.')
    expect(bindings.bindings.map((binding) => binding.actorId)).toEqual(
      expect.arrayContaining(base.run.actors.map((actor) => actor.id))
    )
    await expect(
      base.other.caller.query(capture, {
        ...scope,
        expectedUserId: base.other.userId,
        request: { kind: 'CLEAVING_BINDINGS' }
      })
    ).rejects.toThrow()
    stubLiveSessionFetch((pathname, init) => base.owner.caller.fetch(pathname, init))
    try {
      const before = await records(base)
      const continuationIntegrityKey = await deriveRulesContinuationKey(
        process.env.RULES_CONTINUATION_SECRET
      )
      const rulesRuntime = createPlatformRulesRuntime({
        continuationIntegrityKey,
        definitions: {
          async requireCurrent() {
            throw new Error('Cleaving action graphs are sealed by their capture.')
          }
        }
      })
      const occurrenceId = crypto.randomUUID()
      const planUuid = vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(occurrenceId)
      const planned = await planNativeLiveEncounterAction(
        workerEnvironment(workerSecret),
        'fixture-access-token',
        scope,
        command,
        {
          runtime: rulesRuntime,
          random: (maximum) => (maximum === 20 ? 19 : 0)
        }
      ).finally(() => planUuid.mockRestore())
      if (planned.kind !== 'PLANNED') throw new Error('Expected complete Cleaving action plan.')
      expect(planned.occurrenceId).toBe(occurrenceId)
      expect(await records(base)).toEqual(before)
      expect(planned.prepared.target.kind).toBe('CHARACTER')
      expect(planned.concentration.pending).toBeNull()
      expect(planned.cleaving).not.toBeNull()
      const nativeProbe: {
        result?: Awaited<ReturnType<typeof executeNativeEncounterAction>>
        projection?: unknown
        rootExecution?: unknown
        child?: unknown
      } = {}
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(planned.occurredAt))
      const uuid = vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(occurrenceId)
      const random = vi
        .spyOn(rollRandom, 'nextRollInt')
        .mockImplementation((maximum) => (maximum === 20 ? 19 : 0))
      try {
        await expect(
          base.owner.caller.run(async (ctx) => {
            nativeProbe.result = await executeNativeEncounterAction(ctx, command, base.owner.userId)
            const nativeRun = await ctx.db
              .query('encounterRuns')
              .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
              .unique()
            const nativeReceipt = await ctx.db
              .query('encounterRuleReceipts')
              .withIndex('by_encounterId_commandId', (q) =>
                q.eq('encounterId', base.run.id).eq('commandId', command.commandId)
              )
              .unique()
            const nativePending = await ctx.db
              .query('encounterRuleOccurrences')
              .withIndex('by_encounterId_state', (q) =>
                q.eq('encounterId', base.run.id).eq('state', 'PENDING')
              )
              .unique()
            if (!nativeRun?.projectionJson || !nativeReceipt || !nativePending?.pendingSnapshotJson)
              throw new Error('Native Cleaving terminal records are incomplete.')
            nativeProbe.projection = JSON.parse(nativeRun.projectionJson)
            nativeProbe.rootExecution = storedRuleExecutionResultDtoSchema.parse(
              JSON.parse(nativeReceipt.resultJson)
            )
            nativeProbe.child = serverAggregateChoicePendingSnapshotDtoSchema.parse(
              JSON.parse(nativePending.pendingSnapshotJson)
            )
            throw new Error('Roll back native Cleaving terminal parity probe.')
          })
        ).rejects.toThrow('Roll back native Cleaving terminal parity probe.')
      } finally {
        random.mockRestore()
        uuid.mockRestore()
        vi.useRealTimers()
      }
      expect(await records(base)).toEqual(before)
      const committed = await commitNativeLiveEncounterAction(
        workerEnvironment(workerSecret),
        'fixture-access-token',
        scope,
        planned
      )
      expect(committed).toEqual(nativeProbe.result)
      const after = await records(base)
      expect(after.run?.version).toBe(before.run!.version + 1)
      expect(JSON.parse(after.run!.projectionJson!)).toEqual(committed.projection)
      expect(JSON.parse(after.run!.projectionJson!)).toEqual(nativeProbe.projection)
      expect(after.run?.projectionChecksum).toBe(checksumCanonicalJson(committed.projection))
      const rootReceipt = after.receipts.find((receipt) => receipt.commandId === command.commandId)
      if (!rootReceipt) throw new Error('Missing native Cleaving root receipt.')
      expect(storedRuleExecutionResultDtoSchema.parse(JSON.parse(rootReceipt.resultJson))).toEqual(
        planned.storedExecution
      )
      expect(storedRuleExecutionResultDtoSchema.parse(JSON.parse(rootReceipt.resultJson))).toEqual(
        nativeProbe.rootExecution
      )
      const pending = after.occurrences.filter((occurrence) => occurrence.state === 'PENDING')
      expect(pending).toHaveLength(1)
      expect(
        serverAggregateChoicePendingSnapshotDtoSchema.parse(
          JSON.parse(pending[0]!.pendingSnapshotJson!)
        )
      ).toEqual(planned.cleaving)
      expect(
        serverAggregateChoicePendingSnapshotDtoSchema.parse(
          JSON.parse(pending[0]!.pendingSnapshotJson!)
        )
      ).toEqual(nativeProbe.child)
      if (planned.cleaving?.applicationContext.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING') {
        throw new Error('Missing planned Cleaving choice.')
      }
      expect((await pendingChoice(base)).options).toHaveLength(
        planned.cleaving.applicationContext.options.length
      )
    } finally {
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
    }
  }, 60_000)

  it.each([
    { face: 20, outcome: 'SAVE_SUCCESS' as const, transport: 'native' as const },
    { face: 1, outcome: 'SAVE_FAILURE' as const, transport: 'native' as const },
    { face: 20, outcome: 'SAVE_SUCCESS' as const, transport: 'DO' as const },
    { face: 1, outcome: 'SAVE_FAILURE' as const, transport: 'DO' as const }
  ])(
    'orders an Assisted concentration $outcome before the deferred Cleaving choice via $transport',
    async ({ face, outcome, transport }) => {
      const base = await setup('PROMPT', false, true)
      if (!base.characterId) throw new Error('Missing Cleaving concentration Character.')
      const seeded = await seedConcentration({
        t: base.t,
        run: base.run,
        target: base.run.actors[1]!,
        character: { id: base.characterId }
      })
      const dependentDefinition = seeded.dependent.definition
      if (dependentDefinition.schemaVersion !== 2)
        throw new Error('Expected a current active-effect definition.')
      const candidateEffectId = await base.t.run(async (ctx) => {
        const dexterity = srdSystemRecord.abilities?.find((ability) => ability.code === 'DEXTERITY')
        if (!dexterity) throw new Error('Missing Cleaving candidate Dexterity.')
        const authoredEffectId = crypto.randomUUID()
        return (
          await createActiveRuleEffectStore(ctx).create({
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
      const workerSecret = 'private-cleaving-child-response-test-secret-at-least-32-bytes'
      const authSecret = 'private-cleaving-child-continuation-test-secret-at-least-32-bytes'
      if (transport === 'DO') {
        vi.stubEnv('LIVE_SESSION_WORKER_SECRET', workerSecret)
        vi.stubEnv('BETTER_AUTH_SECRET', authSecret)
      }
      const random = vi
        .spyOn(rollRandom, 'nextRollInt')
        .mockImplementation((sides) => (sides === 20 ? 18 : 0))
      try {
        const { result } = await completeParent(base)
        expect(result.occurrence?.status).toBe('COMPLETE')
      } finally {
        random.mockRestore()
      }
      const afterParent = await records(base)
      const parentReceipt = afterParent.receipts.find(
        (receipt) => receipt.commandId === base.command.command.commandId
      )
      if (!parentReceipt) throw new Error('Missing Cleaving parent receipt.')
      expect(afterParent.occurrences.filter((entry) => entry.state === 'PENDING')).toHaveLength(1)
      const pending = await base.other.caller.query(
        api.encounters.pendingReads.pendingRuleOccurrence,
        {
          encounterId: base.run.id
        }
      )
      if (!pending || pending.kind !== 'D20_EVIDENCE')
        throw new Error('Expected concentration before Cleaving.')
      const input: EncounterExecuteInput = {
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          correlationId: null,
          expectedVersion: pending.encounterVersion,
          occurrenceId: pending.occurrenceId,
          expectedOccurrenceVersion: pending.occurrenceVersion,
          resolution: {
            kind: 'ENTER_DICE',
            requestId: pending.request.requestId,
            rawFaces: pending.request.rollMode === 'NORMAL' ? [face] : [face, face],
            rollMode: pending.request.rollMode
          }
        }
      }
      const responseCommand = input.command
      if (responseCommand.type !== 'RESOLVE_RULE_OCCURRENCE')
        throw new Error('Expected concentration evidence response.')
      const rollback = makeFunctionReference<
        'action',
        {
          ownerUserId: string
          campaignId: string
          encounterId: string
          operation: { kind: 'COMMAND'; input: EncounterExecuteInput }
        },
        { rolledBack: true }
      >('encounters/developmentLifecycle:verifyRollback')
      let concentration: EncounterCommandResultDto
      let retryConcentration: () => Promise<EncounterCommandResultDto>
      if (transport === 'DO') {
        const authorityEpoch = crypto.randomUUID()
        await base.t.run((ctx) =>
          insertActiveLiveAuthority(ctx, {
            campaignId: base.campaign.id,
            epoch: authorityEpoch,
            createdAt: base.campaign.createdAt
          })
        )
        const environment = workerEnvironment(workerSecret)
        const scope = {
          campaignId: base.campaign.id,
          authorityEpoch,
          expectedUserId: base.other.userId,
          expectedRole: 'PLAYER' as const,
          encounterId: base.run.id,
          expectedVersion: pending.encounterVersion
        }
        stubLiveSessionFetch((pathname, init) => base.other.caller.fetch(pathname, init))
        const runtime = async () =>
          createPlatformRulesRuntime({
            continuationIntegrityKey: await deriveRulesContinuationKey(
              process.env.RULES_CONTINUATION_SECRET
            ),
            definitions: {
              async requireCurrent() {
                throw new Error('Concentration graphs are supplied by their sealed capture.')
              }
            }
          })
        const plan = await planNativeLiveConcentrationResponse(
          environment,
          'fixture-access-token',
          scope,
          responseCommand,
          {
            runtime: await runtime(),
            random: () => {
              throw new Error('Entered dice must not reroll.')
            }
          }
        )
        if (plan.kind !== 'PLANNED') throw new Error('Expected planned concentration response.')
        expect(await records(base)).toEqual(afterParent)
        concentration = await callLiveSessionRoute(
          environment,
          'fixture-access-token',
          'encounterConcentrationCommit',
          plan.input
        )
        retryConcentration = async () => {
          const beforeRetry = await records(base)
          const replay = await planNativeLiveConcentrationResponse(
            environment,
            'fixture-access-token',
            scope,
            responseCommand,
            {
              runtime: await runtime(),
              random: () => {
                throw new Error('Replay must not reroll.')
              }
            }
          )
          if (replay.kind !== 'REPLAY') throw new Error('Expected concentration response replay.')
          expect(replay).toEqual({ kind: 'REPLAY', result: concentration })
          expect(
            await callLiveSessionRoute(
              environment,
              'fixture-access-token',
              'encounterConcentrationCommit',
              plan.input
            )
          ).toEqual(concentration)
          expect(await records(base)).toEqual(beforeRetry)
          return replay.result
        }
      } else {
        await expect(
          base.owner.caller.action(rollback, {
            ownerUserId: base.owner.userId,
            campaignId: base.campaign.id,
            encounterId: base.run.id,
            operation: { kind: 'COMMAND', input }
          })
        ).resolves.toEqual({ rolledBack: true })
        expect(await records(base)).toEqual(afterParent)
        concentration = encounterCommandResultDtoSchema.parse(
          await base.other.caller.action(internal.encounters.commandActions.execute, input)
        )
        retryConcentration = async () =>
          encounterCommandResultDtoSchema.parse(
            await base.other.caller.action(internal.encounters.commandActions.execute, input)
          )
      }
      expect(concentration.occurrence).toMatchObject({ status: 'COMPLETE', outcome })
      const afterConcentration = await records(base)
      expect(
        afterConcentration.occurrences.filter((entry) => entry.state === 'PENDING')
      ).toHaveLength(1)
      expect(
        afterConcentration.receipts.find(
          (receipt) => receipt.commandId === base.command.command.commandId
        )?.resultJson
      ).toBe(parentReceipt.resultJson)
      const cleaving = await pendingChoice(base)
      const decline = response(base, cleaving, true)
      const declined = await base.owner.caller.action(internal.encounters.commandActions.execute, {
        command: decline
      })
      expect((await records(base)).occurrences.some((entry) => entry.state === 'PENDING')).toBe(
        false
      )
      await expect(retryConcentration()).resolves.toEqual(concentration)
      await expect(
        base.owner.caller.action(internal.encounters.commandActions.execute, { command: decline })
      ).resolves.toEqual(declined)
      const effects = await base.t.run((ctx) =>
        ctx.db
          .query('characterActiveRuleEffects')
          .withIndex('by_characterId_createdOrdinal_id', (query) =>
            query.eq('characterId', base.characterId!)
          )
          .collect()
      )
      expect(effects.map((effect) => effect.id)).toContain(seeded.independent.id)
      expect(effects.map((effect) => effect.id).includes(seeded.dependent.id)).toBe(
        outcome === 'SAVE_SUCCESS'
      )
      const candidateEffects = await base.t.run((ctx) =>
        ctx.db
          .query('encounterActiveRuleEffects')
          .withIndex('by_encounterId_targetActorId_id', (query) =>
            query.eq('encounterId', base.run.id).eq('targetActorId', base.run.actors[2]!.id)
          )
          .collect()
      )
      expect(candidateEffects.map((effect) => effect.id).includes(candidateEffectId)).toBe(
        outcome === 'SAVE_SUCCESS'
      )
    },
    60_000
  )

  it('cleans an attacker-owned concentration dependent after Automatic Cleaving damage', async () => {
    const base = await setup('AUTO_ROLL', true, true)
    if (!base.characterId) throw new Error('Missing Cleaving source Character.')
    const seeded = await seedConcentration({
      t: base.t,
      run: base.run,
      target: base.run.actors[2]!,
      character: { id: base.characterId }
    })
    const random = vi
      .spyOn(rollRandom, 'nextRollInt')
      .mockImplementation((sides) => (sides === 20 ? 18 : 0))
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
          character: await ctx.db
            .query('characters')
            .withIndex('by_publicId', (query) => query.eq('id', base.characterId!))
            .unique(),
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
      const rollback = makeFunctionReference<
        'action',
        {
          ownerUserId: string
          campaignId: string
          encounterId: string
          operation: { kind: 'COMMAND'; input: EncounterExecuteInput }
        },
        { rolledBack: true }
      >('encounters/developmentLifecycle:verifyRollback')
      random.mockClear()
      random.mockReturnValue(0)
      await expect(
        base.owner.caller.action(rollback, {
          ownerUserId: base.owner.userId,
          campaignId: base.campaign.id,
          encounterId: base.run.id,
          operation: { kind: 'COMMAND', input: { command: input } }
        })
      ).resolves.toEqual({ rolledBack: true })
      expect(await current()).toEqual(before)
      random.mockClear()
      random.mockReturnValue(0)
      const applied = await base.owner.caller.action(internal.encounters.commandActions.execute, {
        command: input
      })
      const after = await current()
      expect(after.character?.streamVersion).toBe(before.character.streamVersion + 1)
      const concentration = after.records.receipts
        .map((receipt) => storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson)))
        .find(
          (receipt) =>
            receipt.status === 'COMPLETE' &&
            receipt.applicationOutputs.kind === 'CONCENTRATION_CHECK'
        )
      expect(concentration).toMatchObject({
        applicationOutputs: { outcome: 'SAVE_FAILURE' }
      })
      const character = characterAuthoredDtoSchema.parse(JSON.parse(after.character!.documentJson))
      expect(character.state.conditions).toEqual([{ conditionTypeId: seeded.poisoned.id }])
      const source = encounterRunActorStateSchema.parse(
        JSON.parse(after.records.actors.find((actor) => actor.id === base.actor.id)!.stateJson)
      )
      expect(source).not.toHaveProperty('conditions')
      expect(after.effects.map((effect) => effect.id)).toEqual([seeded.independent.id])
      expect(after.states.map((state) => state.id)).not.toContain(seeded.state.id)
      expect(after.records.occurrences.filter((entry) => entry.state === 'PENDING')).toHaveLength(1)
      const next = await pendingChoice(base)
      expect(next.occurrenceId).not.toBe(first.occurrenceId)
      await expect(
        base.owner.caller.action(internal.encounters.commandActions.execute, { command: input })
      ).resolves.toEqual(applied)
      const nextTargetId = next.options[0]!.targetActorId
      const nextTargetBefore = encounterRunActorStateSchema.parse(
        JSON.parse(after.records.actors.find((actor) => actor.id === nextTargetId)!.stateJson)
      )
      await expect(
        base.owner.caller.action(internal.encounters.commandActions.execute, {
          command: response(base, next)
        })
      ).resolves.toMatchObject({ occurrence: { status: 'COMPLETE' } })
      const final = await records(base)
      const nextTargetAfter = encounterRunActorStateSchema.parse(
        JSON.parse(final.actors.find((actor) => actor.id === nextTargetId)!.stateJson)
      )
      if (nextTargetBefore.kind === 'CHARACTER' || nextTargetAfter.kind === 'CHARACTER')
        throw new Error('Expected a non-Character Cleaving target.')
      expect(nextTargetAfter.currentHitPoints).toBeLessThan(nextTargetBefore.currentHitPoints)
    } finally {
      random.mockRestore()
    }
  }, 60_000)

  it.each(['AUTO_ROLL', 'PROMPT'] as const)(
    'carries one finalized %s attack through a bounded chain without rolling or spending again',
    async (mode) => {
      const base = await setup(mode)
      const random = vi
        .spyOn(rollRandom, 'nextRollInt')
        .mockImplementation((sides) => (sides === 20 ? 18 : 0))
      try {
        const { result, evidence } = await completeParent(base)
        expect(result.occurrence?.status).toBe('COMPLETE')
        const parent = await records(base)
        expect(
          featureChargeUsed(
            encounterRunActorStateSchema.parse(
              JSON.parse(parent.actors.find((actor) => actor.id === base.actor.id)!.stateJson)
            ),
            automaticChargedBiteFeatureId
          )
        ).toBe(1)
        const rolls = random.mock.calls.length
        const first = await pendingChoice(base)
        expect(first.options).toHaveLength(2)
        const firstResponse = response(base, first)
        const firstResult = await base.owner.caller.action(
          internal.encounters.commandActions.execute,
          {
            command: firstResponse
          }
        )
        const second = await pendingChoice(base)
        expect(second.options).toHaveLength(1)
        expect(second.occurrenceId).not.toBe(first.occurrenceId)
        await expect(
          base.owner.caller.action(internal.encounters.commandActions.execute, {
            command: firstResponse
          })
        ).resolves.toEqual(firstResult)
        const secondResponse = response(base, second)
        await base.owner.caller.action(internal.encounters.commandActions.execute, {
          command: secondResponse
        })
        expect(
          await base.owner.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
            encounterId: base.run.id
          })
        ).toBeNull()
        const final = await records(base)
        expect(
          featureChargeUsed(
            encounterRunActorStateSchema.parse(
              JSON.parse(final.actors.find((actor) => actor.id === base.actor.id)!.stateJson)
            ),
            automaticChargedBiteFeatureId
          )
        ).toBe(1)
        expect(
          final.actors
            .filter((actor) => actor.id !== base.actor.id)
            .map((actor) => JSON.parse(actor.stateJson).currentHitPoints)
        ).toEqual([0, 0, 0])
        expect(random.mock.calls.length).toBe(rolls)
        expect(
          final.receipts
            .map((row) => JSON.parse(row.resultJson))
            .filter((payload) => payload.status === 'AGGREGATE_CHOICE_COMPLETE')
            .map((payload) => payload.applicationOutputs.damage.requestedAmount)
            .sort((left, right) => right - left)
        ).toEqual([29, 18])
        await expect(
          base.owner.caller.action(internal.encounters.commandActions.execute, base.command)
        ).resolves.toEqual(result)
        for (const retained of evidence)
          await base.owner.caller.action(internal.encounters.commandActions.execute, retained)
        expect(await records(base)).toEqual(final)
      } finally {
        random.mockRestore()
      }
    },
    30000
  )

  it('declines without damage and binds exact historical replay to the responding account', async () => {
    const base = await setup()
    const random = vi.spyOn(rollRandom, 'nextRollInt').mockReturnValue(18)
    try {
      await expect(
        base.owner.caller.action(internal.encounters.commandActions.execute, base.command)
      ).resolves.toMatchObject({ occurrence: { status: 'COMPLETE' } })
    } finally {
      random.mockRestore()
    }
    const before = await records(base)
    const pending = await pendingChoice(base)
    const input = response(base, pending, true)
    const result = await base.owner.caller.action(internal.encounters.commandActions.execute, {
      command: input
    })
    const after = await records(base)
    expect(after.actors).toEqual(before.actors)
    expect(after.run?.version).toBe(before.run!.version + 1)
    await expect(
      base.owner.caller.action(internal.encounters.commandActions.execute, { command: input })
    ).resolves.toEqual(result)
    await expect(
      base.owner.caller.action(internal.encounters.commandActions.execute, {
        command: {
          ...input,
          resolution: { kind: 'OPTION', optionId: pending.options[0]!.optionId }
        }
      })
    ).rejects.toThrow()
    await expect(
      base.other.caller.action(internal.encounters.commandActions.execute, { command: input })
    ).rejects.toThrow()
    await expect(
      base.other.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).resolves.toBeNull()
    expect(await records(base)).toEqual(after)
  }, 30000)

  it.each(['AUTO_ROLL', 'PROMPT'] as const)(
    'lets the current Character controller choose a visible %s child and keeps private choices and another responder replay unavailable',
    async (mode) => {
      const base = await setup(mode, true)
      const random = vi
        .spyOn(rollRandom, 'nextRollInt')
        .mockImplementation((sides) => (sides === 20 ? 18 : 0))
      try {
        await completeParent(base)
      } finally {
        random.mockRestore()
      }
      const ownerChoice = await pendingChoice(base)
      const playerChoice = await base.other.caller.query(
        api.encounters.pendingReads.pendingRuleOccurrence,
        { encounterId: base.run.id }
      )
      if (!playerChoice || playerChoice.kind !== 'OPTIONAL_COMBAT_CLEAVING')
        throw new Error('Expected controller Cleaving choice.')
      expect(ownerChoice.options).toHaveLength(2)
      expect(playerChoice.options).toHaveLength(1)
      const hidden = ownerChoice.options.find(
        (option) => !playerChoice.options.some((visible) => visible.optionId === option.optionId)
      )!
      const before = await records(base)
      const pending = before.occurrences.find((occurrence) => occurrence.state === 'PENDING')!
      const pin = JSON.parse(pending.pendingSnapshotJson!).applicationContext.sourceCurrentness
      expect(pin.kind).toBe('CHARACTER')
      const sourceCharacter = await base.t.run((ctx) =>
        ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', base.characterId!))
          .unique()
      )
      expect(pin.streamVersion).toBe(sourceCharacter?.streamVersion)
      await expect(
        base.other.caller.action(internal.encounters.commandActions.execute, {
          command: {
            ...response(base, ownerChoice),
            resolution: { kind: 'OPTION', optionId: hidden.optionId }
          }
        })
      ).rejects.toThrow('Cleaving target is unavailable')
      expect(await records(base)).toEqual(before)
      const input = response(base, playerChoice)
      const applied = await base.other.caller.action(internal.encounters.commandActions.execute, {
        command: input
      })
      expect(applied.projection.actors.some((actor) => actor.id === hidden.targetActorId)).toBe(
        false
      )
      await expect(
        base.other.caller.action(internal.encounters.commandActions.execute, { command: input })
      ).resolves.toEqual(applied)
      await expect(
        base.owner.caller.action(internal.encounters.commandActions.execute, { command: input })
      ).rejects.toThrow('receipt mismatch')
      const remaining = await pendingChoice(base)
      expect(remaining.options.map((option) => option.targetActorId)).toEqual([
        hidden.targetActorId
      ])
      await expect(
        base.other.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
          encounterId: base.run.id
        })
      ).resolves.toBeNull()
      await base.owner.caller.action(internal.encounters.commandActions.execute, {
        command: response(base, remaining, true)
      })
    },
    30000
  )

  it('allows decline after an offered token moves, without damage or another child', async () => {
    const base = await setup()
    const random = vi.spyOn(rollRandom, 'nextRollInt').mockReturnValue(18)
    try {
      await base.owner.caller.action(internal.encounters.commandActions.execute, base.command)
    } finally {
      random.mockRestore()
    }
    const pending = await pendingChoice(base)
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
    await expect(
      base.owner.caller.action(internal.encounters.commandActions.execute, {
        command: response(base, pending)
      })
    ).rejects.toThrow()
    expect(await records(base)).toEqual(before)
    await base.owner.caller.action(internal.encounters.commandActions.execute, {
      command: response(base, pending, true)
    })
    const after = await records(base)
    expect(after.actors).toEqual(before.actors)
    expect(after.occurrences).toHaveLength(before.occurrences.length)
    expect(after.occurrences.some((occurrence) => occurrence.state === 'PENDING')).toBe(false)
  }, 30000)

  it('refuses a choice after canonical Character currentness changes and still lets the current controller decline', async () => {
    const base = await setup('AUTO_ROLL', true)
    const random = vi.spyOn(rollRandom, 'nextRollInt').mockReturnValue(18)
    try {
      await completeParent(base)
    } finally {
      random.mockRestore()
    }
    const pending = await base.other.caller.query(
      api.encounters.pendingReads.pendingRuleOccurrence,
      {
        encounterId: base.run.id
      }
    )
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
    const before = await records(base)
    await expect(
      base.other.caller.action(internal.encounters.commandActions.execute, {
        command: response(base, pending)
      })
    ).rejects.toThrow()
    expect(await records(base)).toEqual(before)
    await base.other.caller.action(internal.encounters.commandActions.execute, {
      command: response(base, pending, true)
    })
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
            ...JSON.parse(row.stateJson),
            currentHitPoints: 10
          })
          await ctx.db.patch(row._id, {
            stateJson: JSON.stringify(actor),
            stateChecksum: checksumCanonicalJson(actor)
          })
        })
      const random = vi.spyOn(rollRandom, 'nextRollInt').mockReturnValue(reason === 'miss' ? 0 : 18)
      try {
        await base.owner.caller.action(internal.encounters.commandActions.execute, base.command)
      } finally {
        random.mockRestore()
      }
      expect(
        await base.owner.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
          encounterId: base.run.id
        })
      ).toBeNull()
      expect((await records(base)).occurrences).toHaveLength(1)
    },
    30000
  )

  it('keeps stale source and target responses atomic and rolls back terminal mechanics, chain, Run, and receipts', async () => {
    const base = await setup()
    const random = vi.spyOn(rollRandom, 'nextRollInt').mockReturnValue(18)
    try {
      await base.owner.caller.action(internal.encounters.commandActions.execute, base.command)
    } finally {
      random.mockRestore()
    }
    const pending = await pendingChoice(base)
    const input = response(base, pending)
    const before = await records(base)
    const rollback = makeFunctionReference<
      'action',
      {
        ownerUserId: string
        campaignId: string
        encounterId: string
        operation: { kind: 'COMMAND'; input: EncounterExecuteInput }
      },
      { rolledBack: true }
    >('encounters/developmentLifecycle:verifyRollback')
    await expect(
      base.owner.caller.action(rollback, {
        ownerUserId: base.owner.userId,
        campaignId: base.campaign.id,
        encounterId: base.run.id,
        operation: { kind: 'COMMAND', input: { command: input } }
      })
    ).resolves.toEqual({ rolledBack: true })
    expect(await records(base)).toEqual(before)
    for (const actorId of [base.actor.id, pending.options[0]!.targetActorId]) {
      await base.t.run(async (ctx) => {
        const row = before.actors.find((actor) => actor.id === actorId)!
        const changed = { ...JSON.parse(row.stateJson), currentHitPoints: 1 }
        await ctx.db.patch(row._id, {
          stateJson: JSON.stringify(changed),
          stateChecksum: checksumCanonicalJson(changed)
        })
      })
      const stale = await records(base)
      await expect(
        base.owner.caller.action(internal.encounters.commandActions.execute, { command: input })
      ).rejects.toThrow()
      expect(await records(base)).toEqual(stale)
      await base.t.run(async (ctx) => {
        const row = before.actors.find((actor) => actor.id === actorId)!
        await ctx.db.patch(row._id, { stateJson: row.stateJson, stateChecksum: row.stateChecksum })
      })
    }
    const occurrence = before.occurrences.find((occurrence) => occurrence.state === 'PENDING')!
    for (const tamper of ['damage', 'policy'] as const) {
      await base.t.run(async (ctx) => {
        const snapshot = JSON.parse(occurrence.pendingSnapshotJson!)
        if (tamper === 'damage') {
          snapshot.applicationContext.damage.resolvedAmount += 1
          snapshot.applicationContext.damage.remainingAmount += 1
        } else snapshot.applicationContext.optionalCombat.definitionChecksum = 'f'.repeat(64)
        await ctx.db.patch(occurrence._id, {
          pendingSnapshotJson: JSON.stringify(snapshot),
          pendingSnapshotChecksum: checksumCanonicalJson(snapshot)
        })
      })
      const tampered = await records(base)
      await expect(
        base.owner.caller.action(internal.encounters.commandActions.execute, { command: input })
      ).rejects.toThrow()
      expect(await records(base)).toEqual(tampered)
      await base.t.run((ctx) =>
        ctx.db.patch(occurrence._id, {
          pendingSnapshotJson: occurrence.pendingSnapshotJson,
          pendingSnapshotChecksum: occurrence.pendingSnapshotChecksum
        })
      )
    }
    await base.owner.caller.action(internal.encounters.commandActions.execute, { command: input })
    expect((await records(base)).run?.version).toBe(before.run!.version + 1)
  }, 30000)
})
