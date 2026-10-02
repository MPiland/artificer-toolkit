import {
  createConvexEncounterStore,
  createConvexEncounterStoreReader
} from '../lib/convexEncounterStore'
import { readReceiptHeaders } from '../lib/receiptLedgers'
import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto,
  CreateEncounterInputDto,
  EncounterGmProjectionDto,
  EncounterCommandInputDto,
  EncounterExecuteInput,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
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
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { fixture } from '../../tests/fixtures/characters'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { writeCharacterRecord } from '../../tests/fixtures/characterRecords'
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
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { readRunState, writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import {
  readPendingSnapshot,
  writePendingSnapshot
} from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { readEncounterGmProjection } from '@artificer-toolkit/encounter-persistence/nativeProjection'
import { encounterReadTransaction } from './encounterPorts'
import {
  executeRoomEncounterCommand,
  insertActiveLiveAuthority,
  executeInRoom,
  replayInRoom
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
  await executeInRoom(base.owner.caller, {
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
  const authorityEpoch = crypto.randomUUID()
  await base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: campaign.id,
      epoch: authorityEpoch,
      createdAt: campaign.createdAt
    })
  )
  return {
    ...base,
    campaign,
    run,
    actor,
    sceneId,
    command,
    characterId,
    targetCharacterId,
    targetController,
    authorityEpoch
  }
}

type Member = Awaited<ReturnType<typeof fixture>>['other']

function roomActor(base: Awaited<ReturnType<typeof setup>>, member: Member) {
  return {
    campaignId: base.campaign.id,
    authorityEpoch: base.authorityEpoch,
    expectedUserId: member.userId,
    expectedRole: member.userId === base.owner.userId ? ('OWNER' as const) : ('PLAYER' as const)
  }
}

/** Sends a command through the room's dispatcher as `member`, the GM when it is the Campaign owner. */
function room(
  base: Awaited<ReturnType<typeof setup>>,
  member: Member,
  command: EncounterCommandInputDto,
  random?: (maximum: number) => number
) {
  return executeRoomEncounterCommand({
    caller: member.caller,
    actor: roomActor(base, member),
    command,
    ...(random ? { random } : {})
  })
}

/** A lost acknowledgement's retry of a settled answer returns the stored result without rolling. */
async function replayAnswer(member: Member, command: ResolveRuleOccurrenceInputDto) {
  return { kind: 'REPLAY' as const, result: await replayInRoom(member.caller, { command }) }
}

async function records(base: Awaited<ReturnType<typeof setup>>) {
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
      .collect(),
    receipts: await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', base.run.id))
      .collect()
      .then((headers) => readReceiptHeaders(ctx, 'encounterRuleReceipts', headers)),
    commands: await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', base.run.id))
      .collect()
      .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
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
  it('commits the selected Character Cleaving choice from the Worker plan', async () => {
    const base = await setup('AUTO_ROLL', false, true)
    const command = base.command.command
    if (command.type !== 'RESOLVE_ACTION') throw new Error('Missing Cleaving action command.')
    const before = await records(base)
    const committed = await executeInRoom(
      base.owner.caller,
      base.command,
      (maximum) => (maximum === 20 ? 19 : 0)
    )
    const after = await records(base)
    expect(after.run?.version).toBe(before.run!.version + 1)
    expect(
      await base.t.run((ctx) =>
        readEncounterGmProjection(encounterReadTransaction(ctx), readRunState(after.run!))
      )
    ).toEqual(committed.projection)
    const rootReceipt = after.receipts.find((receipt) => receipt.commandId === command.commandId)
    if (!rootReceipt) throw new Error('Missing Cleaving root receipt.')
    expect(storedRuleExecutionResultDtoSchema.parse(JSON.parse(rootReceipt.resultJson)).status).toBe(
      'COMPLETE'
    )
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

  it.each([
    { face: 20, outcome: 'SAVE_SUCCESS' as const, transport: 'room' as const },
    { face: 1, outcome: 'SAVE_FAILURE' as const, transport: 'room' as const }
  ])(
    'orders an Assisted concentration $outcome before the deferred Cleaving choice via $transport',
    async ({ face, outcome }) => {
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
      const concentration = encounterCommandResultDtoSchema.parse(
        await executeInRoom(base.other.caller, input)
      )
      const retryConcentration = async () =>
        encounterCommandResultDtoSchema.parse(await replayInRoom(base.other.caller, input))
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
      const declined = await room(base, base.owner, decline)
      expect((await records(base)).occurrences.some((entry) => entry.state === 'PENDING')).toBe(
        false
      )
      const currentConcentration = encounterCommandResultDtoSchema.parse({
        ...concentration,
        projection: await base.other.caller.query(api.encounters.projectionReads.get, {
          encounterId: base.run.id
        })
      })
      await expect(retryConcentration()).resolves.toEqual(currentConcentration)
      await expect(replayAnswer(base.owner, decline)).resolves.toEqual({
        kind: 'REPLAY',
        result: declined
      })
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
      const applied = await room(base, base.owner, input, () => 0)
      const after = await current()
      expect(after.character?.play.streamVersion).toBe(before.character.play.streamVersion + 1)
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
      const character = characterAuthoredDtoSchema.parse(readCharacterRecord(after.character!))
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
      await expect(replayAnswer(base.owner, input)).resolves.toEqual({
        kind: 'REPLAY',
        result: applied
      })
      await expect(room(base, base.owner, input)).resolves.toEqual(applied)
      await expect(
        room(base, base.owner, { ...input, commandId: crypto.randomUUID() })
      ).rejects.toMatchObject({ data: { reason: 'VERSION_STALE' } })
      expect(await current()).toEqual(after)
      const nextTargetId = next.options[0]!.targetActorId
      const nextTargetBefore = encounterRunActorStateSchema.parse(
        JSON.parse(after.records.actors.find((actor) => actor.id === nextTargetId)!.stateJson)
      )
      await expect(room(base, base.owner, response(base, next))).resolves.toMatchObject({
        occurrence: { status: 'COMPLETE' }
      })
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
        const { root, result, evidence } = await completeParent(base)
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
        const noDice = () => {
          throw new Error('Cleaving carries the finalized damage without rolling.')
        }
        const firstResponse = response(base, first)
        const firstResult = await room(base, base.owner, firstResponse, noDice)
        const second = await pendingChoice(base)
        expect(second.options).toHaveLength(1)
        expect(second.occurrenceId).not.toBe(first.occurrenceId)
        await expect(replayAnswer(base.owner, firstResponse)).resolves.toEqual({
          kind: 'REPLAY',
          result: firstResult
        })
        await room(base, base.owner, response(base, second), noDice)
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
        // The room journal replays the root's own receipt over the current Run.
        await expect(replayInRoom(base.owner.caller, base.command)).resolves.toEqual({
          ...root,
          projection: await base.owner.caller.query(api.encounters.projectionReads.get, {
            encounterId: base.run.id
          })
        })
        for (const retained of evidence) await replayInRoom(base.owner.caller, retained)
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
      await expect(executeInRoom(base.owner.caller, base.command)).resolves.toMatchObject({
        occurrence: { status: 'COMPLETE' }
      })
    } finally {
      random.mockRestore()
    }
    const before = await records(base)
    const pending = await pendingChoice(base)
    const input = response(base, pending, true)
    const result = await room(base, base.owner, input)
    const after = await records(base)
    expect(after.actors).toEqual(before.actors)
    expect(after.run?.version).toBe(before.run!.version + 1)
    await expect(replayAnswer(base.owner, input)).resolves.toEqual({
      kind: 'REPLAY',
      result
    })
    // The same command ID with another answer, or from another account, is not a replay.
    await expect(
      replayAnswer(base.owner, {
        ...input,
        resolution: { kind: 'OPTION', optionId: pending.options[0]!.optionId }
      })
    ).rejects.toThrow()
    await expect(replayAnswer(base.other, input)).rejects.toThrow()
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
      const snapshot = await base.t.run((ctx) =>
        readPendingSnapshot({ db: createConvexEncounterStoreReader(ctx) }, pending)
      )
      const sourceCharacter = await base.t.run((ctx) => readCharacterRow(ctx, base.characterId!))
      expect(snapshot?.applicationContext).toMatchObject({
        kind: 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING',
        sourceCurrentness: { kind: 'CHARACTER', streamVersion: sourceCharacter?.play.streamVersion }
      })
      await expect(
        room(base, base.other, {
          ...response(base, ownerChoice),
          resolution: { kind: 'OPTION', optionId: hidden.optionId }
        })
      ).rejects.toMatchObject({ data: { reason: 'TARGET_UNAVAILABLE' } })
      expect(await records(base)).toEqual(before)
      const input = response(base, playerChoice)
      const applied = await room(base, base.other, input)
      expect(applied.projection.actors.some((actor) => actor.id === hidden.targetActorId)).toBe(
        false
      )
      await expect(replayAnswer(base.other, input)).resolves.toEqual({
        kind: 'REPLAY',
        result: applied
      })
      // Another member's replay of the player's answer is not theirs to read.
      await expect(replayAnswer(base.owner, input)).rejects.toThrow()
      const remaining = await pendingChoice(base)
      expect(remaining.options.map((option) => option.targetActorId)).toEqual([
        hidden.targetActorId
      ])
      await expect(
        base.other.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
          encounterId: base.run.id
        })
      ).resolves.toBeNull()
      await room(base, base.owner, response(base, remaining, true))
    },
    30000
  )

  it('declines a Cleaving choice the GM voids in the room, then records the void once', async () => {
    const base = await setup()
    const random = vi.spyOn(rollRandom, 'nextRollInt').mockReturnValue(18)
    try {
      await executeInRoom(base.owner.caller, base.command)
    } finally {
      random.mockRestore()
    }
    const pending = await pendingChoice(base)
    const before = await records(base)
    const voidCommand = {
      type: 'VOID_RULE_OCCURRENCE' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion
    }
    await expect(room(base, base.other, voidCommand)).rejects.toThrow()
    expect(await records(base)).toEqual(before)
    const voided = await room(base, base.owner, voidCommand)
    const after = await records(base)
    expect(after.actors).toEqual(before.actors)
    // The decline and the "Voided by the GM" entry each advance the Run once.
    expect(after.run?.version).toBe(before.run!.version + 2)
    expect(
      after.commands
        .filter((command) => !before.commands.some((prior) => prior._id === command._id))
        .map((command) => command.commandType)
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
    const random = vi.spyOn(rollRandom, 'nextRollInt').mockReturnValue(18)
    try {
      await executeInRoom(base.owner.caller, base.command)
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
    await expect(room(base, base.owner, response(base, pending))).rejects.toThrow()
    expect(await records(base)).toEqual(before)
    await room(base, base.owner, response(base, pending, true))
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
    await expect(room(base, base.other, response(base, pending))).rejects.toThrow()
    expect(await records(base)).toEqual(before)
    await room(base, base.other, response(base, pending, true))
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
          await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, actor)
        })
      const random = vi.spyOn(rollRandom, 'nextRollInt').mockReturnValue(reason === 'miss' ? 0 : 18)
      try {
        await executeInRoom(base.owner.caller, base.command)
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

  it('refuses stale source, target and choice answers atomically', async () => {
    const base = await setup()
    const random = vi.spyOn(rollRandom, 'nextRollInt').mockReturnValue(18)
    try {
      await executeInRoom(base.owner.caller, base.command)
    } finally {
      random.mockRestore()
    }
    const pending = await pendingChoice(base)
    const input = response(base, pending)
    const before = await records(base)
    for (const actorId of [base.actor.id, pending.options[0]!.targetActorId]) {
      await base.t.run(async (ctx) => {
        const row = before.actors.find((actor) => actor.id === actorId)!
        const changed = { ...JSON.parse(row.stateJson), currentHitPoints: 1 }
        await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, changed)
      })
      const stale = await records(base)
      await expect(room(base, base.owner, input)).rejects.toThrow()
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
      await expect(room(base, base.owner, input)).rejects.toThrow()
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
    await room(base, base.owner, input)
    expect((await records(base)).run?.version).toBe(before.run!.version + 1)
  }, 30000)
})
