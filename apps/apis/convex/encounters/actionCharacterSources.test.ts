import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignSessionDto,
  createCampaignSessionInputSchema
} from '@artificer-toolkit/schema/api/campaignSessions'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto,
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { discoverCharacterActionCapabilities } from '@artificer-toolkit/rules-runtime/characterActionCapabilityDiscoveryRegistry'
import { compileCharacterActionEntryPoints } from '@artificer-toolkit/rules-runtime/encounterActionEntryPointCompiler'
import { withEncounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { maintenanceDefinitionFixture } from '../../tests/fixtures/maintenanceDefinition'
import { seedActiveInitiative } from '../../tests/fixtures/activeInitiative'
import { api, components, internal } from '../_generated/api'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { createActiveRuleEffectStore } from '../rules/effectStore'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createSession = makeFunctionReference<
  'mutation',
  z.input<typeof createCampaignSessionInputSchema>,
  CampaignSessionDto
>('campaigns/sessions:create')
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

const CHARACTER_ACTION_MAINTENANCE_DEFINITION_ID = '00000000-0000-4000-8000-0000000008f0'

function input(
  fixture: Awaited<ReturnType<typeof setup>>,
  commandId = crypto.randomUUID(),
  targetActorId = fixture.actor.id,
  expectedVersion = 0
) {
  return {
    type: 'RESOLVE_ACTION' as const,
    encounterId: fixture.run.id,
    commandId,
    expectedVersion,
    actorId: fixture.actor.id,
    targetActorId,
    actionId: fixture.actionId,
    optionalCombatIntent: null,
    sceneContext: null
  } satisfies ResolveEncounterActionInputDto
}

type SetupOptions = {
  maintained?: boolean
  useResource?: boolean
}

async function setup(
  self = true,
  automationMode: 'AUTOMATIC' | 'ASSISTED' = 'AUTOMATIC',
  options: SetupOptions = {}
) {
  const chargeId = crypto.randomUUID()
  const feature = wolf.features?.find((value) => value.label === 'Bite')
  const effect = structuredClone(feature?.effects?.[0])
  if (!feature || !effect || effect.invocation.kind !== 'ACTION') throw new Error('Missing Bite.')
  effect.invocation = {
    ...effect.invocation,
    triggerCode: 'ACTIVATED',
    range: {
      id: effect.invocation.range.id,
      rangeKind: self ? 'SELF' : 'UNLIMITED'
    },
    targeting: self
      ? { selectionKind: 'SELF' }
      : { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' },
    ...(options.useResource === false ? {} : { resourceUse: { chargeId, cost: 1 } })
  }
  effect.paths = effect.paths?.slice(0, 1).map((path) => {
    if (!('resultBlock' in path)) return path
    return {
      ...path,
      pathCode: 'ON_USE' as const,
      resultBlock: {
        ...path.resultBlock,
        ...(options.maintained
          ? {
              id: crypto.randomUUID(),
              maintenanceDefinitionId: CHARACTER_ACTION_MAINTENANCE_DEFINITION_ID,
              duration: {
                id: crypto.randomUUID(),
                durationKind: 'ROUND' as const,
                amount: 3
              },
              lifecycle: { recurringKind: 'START_OF_TURN' as const }
            }
          : {}),
        outcomes: path.resultBlock.outcomes.map((outcome) => {
          if (outcome.effectKind !== 'DAMAGE') return outcome
          return {
            id: outcome.id,
            scalingKind: 'NONE' as const,
            ...(automationMode === 'ASSISTED'
              ? { effectKind: 'HEAL' as const, valueKind: 'DICE' as const, diceConfig: '1d6' }
              : {
                  effectKind: 'DAMAGE' as const,
                  damageTypeId: outcome.damageTypeId,
                  valueKind: 'FIXED' as const,
                  amount: 1
                })
          }
        })
      }
    }
  })
  const base = await readyCharacterFixture({
    resources: {
      id: crypto.randomUUID(),
      label: 'Action use',
      order: 0,
      availableAtLevel: 1,
      charges: {
        id: chargeId,
        resetKind: 'SHORT_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 2
      }
    },
    features: [
      {
        ...structuredClone(feature),
        id: crypto.randomUUID(),
        availableAtLevel: 1,
        effects: [effect]
      }
    ]
  })
  const { draft, character } = await base.createCharacter()
  if (automationMode === 'ASSISTED') character.state.hitpoints.current = 1
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: [
      ...SRD_RULE_STATE_DEFINITIONS.filter(
        (definition) => definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID
      ),
      maintenanceDefinitionFixture({ id: CHARACTER_ACTION_MAINTENANCE_DEFINITION_ID })
    ]
  })
  const owner = base.other
  await base.t.run(async (ctx) => {
    for (const [index, userId] of [owner.userId, base.owner.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing profile.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: `draft_123456abcde${index}@example.invalid` }
        }
      })
    }
  })
  const campaign = await owner.caller.mutation(createCampaign, {
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
    { ownerUserId: owner.userId, playerUserId: base.owner.userId, campaignId: campaign.id }
  )
  await base.owner.caller.mutation(api.campaigns.assignments.assign, {
    campaignId: campaign.id,
    characterId: character.id
  })
  const session = await owner.caller.mutation(createSession, { campaignId: campaign.id })
  await owner.caller.mutation(
    makeFunctionReference<
      'mutation',
      {
        campaignId: string
        sessionId: string
        characterId: string
        present: boolean
        expectedVersion: number
      },
      { present: boolean }
    >('campaigns/sessionAttendance:set'),
    {
      campaignId: campaign.id,
      sessionId: session.id,
      characterId: character.id,
      present: true,
      expectedVersion: session.version
    }
  )
  const blueprint = await owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Character source',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CUSTOM', label: 'Target', maxHitPoints: 3 }]
  })
  const run = await owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    sessionId: session.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const actor = run.actors.find((value) => value.kind === 'CHARACTER')
  const target = run.actors.find((value) => value.id !== actor?.id)
  if (!actor || !target) throw new Error('Missing Encounter actors.')
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!row) throw new Error('Missing Run.')
    const state = encounterRunStateSchema.parse(JSON.parse(row.stateJson))
    const active = encounterRunStateSchema.parse({
      ...state,
      status: 'ACTIVE',
      automationMode,
      round: 1,
      currentActorId: actor.id
    })
    const projection = encounterGmProjectionDtoSchema.parse({
      ...JSON.parse(row.projectionJson),
      status: 'ACTIVE',
      automationMode,
      round: 1,
      currentActorId: actor.id
    })
    await ctx.db.patch(row._id, {
      status: 'ACTIVE',
      stateJson: JSON.stringify(active),
      stateChecksum: checksumCanonicalJson(active),
      projectionJson: JSON.stringify(projection),
      projectionChecksum: checksumCanonicalJson(projection)
    })
    await seedActiveInitiative(ctx, active, [actor.id, target.id])
  })
  const actionId = await base.t.run(async (ctx) => {
    const current = await loadCharacterSheetFacts(ctx, owner.userId, character.id, campaign.id)
    if (!current) throw new Error('Missing Character facts.')
    const candidate = current.ruleEvaluation.facts.actionCandidates.find((value) =>
      options.useResource === false
        ? value.effectId === effect.id
        : value.resourceUse?.chargeId === chargeId
    )
    const entries = compileCharacterActionEntryPoints({
      gameSystemId: character.systemId,
      candidates: current.ruleEvaluation.facts.actionCandidates,
      descriptors: discoverCharacterActionCapabilities({
        gameSystemId: character.systemId,
        candidates: current.ruleEvaluation.facts.actionCandidates,
        conditionDefinitionIds: (
          current.prepared.context.registry.system?.conditionTypes ?? []
        ).map((value) => value.id),
        abilityDefinitions: current.ruleEvaluation.facts.abilityDefinitions,
        entryPoints: current.ruleEvaluation.actionEntryPoints
      })
    })
    const entry = entries.find(
      (value) => value.kind === 'CHARACTER_ACTION' && value.actionId === candidate?.actionId
    )
    if (!candidate || !entry || entry.compilation.kind !== 'COMPILED')
      throw new Error('Missing compiled Character action.')
    return candidate.actionId
  })
  return {
    ...base,
    owner,
    campaign,
    character,
    run,
    actor,
    target,
    actionId,
    maintenanceDefinitionId: options.maintained ? CHARACTER_ACTION_MAINTENANCE_DEFINITION_ID : null
  }
}

async function records(fixture: Awaited<ReturnType<typeof setup>>) {
  return fixture.t.run(async (ctx) =>
    Promise.all([
      ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', fixture.character.id))
        .unique(),
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', fixture.run.id).eq('id', fixture.actor.id)
        )
        .unique(),
      ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', fixture.run.id))
        .unique(),
      ctx.db
        .query('encounterRunCommands')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', fixture.run.id))
        .collect()
    ])
  )
}

async function maintenanceRecords(fixture: Awaited<ReturnType<typeof setup>>) {
  return fixture.t.run(async (ctx) => ({
    character: await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', fixture.character.id))
      .unique(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', fixture.run.id))
      .take(8),
    actorEffects: await ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_encounterId_targetActorId_id', (q) => q.eq('encounterId', fixture.run.id))
      .take(16),
    characterEffects: await ctx.db
      .query('characterActiveRuleEffects')
      .withIndex('by_characterId_createdOrdinal_id', (q) =>
        q.eq('characterId', fixture.character.id)
      )
      .take(16),
    maintainedStates: await ctx.db
      .query('encounterMaintainedEffectStates')
      .withIndex('by_encounter_owner_definition_order', (q) => q.eq('encounterId', fixture.run.id))
      .take(16),
    receipts: await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', fixture.run.id))
      .take(32),
    commands: await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', fixture.run.id))
      .take(32),
    pendingOccurrences: await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) =>
        q.eq('encounterId', fixture.run.id).eq('state', 'PENDING')
      )
      .take(8),
    completedOccurrences: await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) =>
        q.eq('encounterId', fixture.run.id).eq('state', 'COMPLETED')
      )
      .take(32),
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', fixture.run.id))
      .unique()
  }))
}

function executionFor(snapshot: Awaited<ReturnType<typeof maintenanceRecords>>, commandId: string) {
  const receipt = snapshot.receipts.find((candidate) => candidate.commandId === commandId)
  if (!receipt) throw new Error('Character maintenance receipt is missing.')
  const execution = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
  if (execution.status !== 'COMPLETE') throw new Error('Character maintenance did not complete.')
  return execution
}

async function resetActionAllowance(fixture: Awaited<ReturnType<typeof setup>>) {
  await fixture.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', fixture.run.id).eq('id', fixture.actor.id)
      )
      .unique()
    if (!row) throw new Error('Character action source is unavailable.')
    const actor = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
    const reset = encounterRunActorStateSchema.parse({
      ...actor,
      resources: withEncounterRuleUsageUsed(actor, SRD_ACTION_ALLOWANCE_DEFINITION_ID, 0)
    })
    await ctx.db.patch(row._id, {
      stateJson: JSON.stringify(reset),
      stateChecksum: checksumCanonicalJson(reset)
    })
  })
}

function expectSourceMirror(
  fixture: Awaited<ReturnType<typeof setup>>,
  snapshot: Awaited<ReturnType<typeof maintenanceRecords>>,
  streamVersion: number,
  projection: { actors: readonly { id: string; sourceRevision?: number | null }[] }
) {
  const row = snapshot.actors.find((candidate) => candidate.id === fixture.actor.id)
  if (!row) throw new Error('Character actor mirror is unavailable.')
  const actor = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
  expect(actor.sourceRevision).toBe(streamVersion)
  expect(actor.snapshot).toMatchObject({ sourceRevision: streamVersion })
  expect(
    projection.actors.find((candidate) => candidate.id === fixture.actor.id)?.sourceRevision
  ).toBe(streamVersion)
}

describe('native Character action sources', () => {
  it.each([true, false])(
    'retains an Assisted Character resource until its terminal evidence (self: %s)',
    async (self) => {
      const fixture = await setup(self, 'ASSISTED')
      const command = input(
        fixture,
        crypto.randomUUID(),
        self ? fixture.actor.id : fixture.target.id
      )
      const before = await records(fixture)
      const pendingResult = await fixture.owner.caller.mutation(api.encounters.commands.execute, {
        command
      })
      expect(await records(fixture)).toEqual(before)
      const pending = pendingResult.occurrence?.pending
      if (pending?.kind !== 'ACTION_OUTCOME_EVIDENCE')
        throw new Error('Expected Character healing evidence.')
      const response: ResolveRuleOccurrenceInputDto = {
        type: 'RESOLVE_RULE_OCCURRENCE',
        commandId: crypto.randomUUID(),
        encounterId: fixture.run.id,
        expectedVersion: 0,
        occurrenceId: pending.occurrenceId,
        expectedOccurrenceVersion: pending.occurrenceVersion,
        correlationId: null,
        resolution: self
          ? {
              kind: 'ENTER_INTEGER',
              requestId: pending.request.requestId,
              value: pending.request.max
            }
          : { kind: 'SYSTEM_ROLL', requestId: pending.request.requestId }
      }
      await expect(
        fixture.owner.caller.run(async (ctx) => {
          const character = before[0]!
          await ctx.db.patch(character._id, { streamVersion: character.streamVersion + 1 })
          await expect(
            ctx.runMutation(api.encounters.commands.execute, { command: response })
          ).rejects.toThrow()
          throw new Error('restore current Character')
        })
      ).rejects.toThrow('restore current Character')
      expect(await records(fixture)).toEqual(before)
      await expect(
        fixture.owner.caller.run(async (ctx) => {
          await ctx.runMutation(api.encounters.commands.execute, { command: response })
          throw new Error('rollback Character evidence')
        })
      ).rejects.toThrow('rollback Character evidence')
      expect(await records(fixture)).toEqual(before)
      const result = await fixture.owner.caller.mutation(api.encounters.commands.execute, {
        command: response
      })
      const after = await records(fixture)
      const character = after[0]
      if (!character?.sheetState || !before[0]) throw new Error('Missing Character settlement.')
      expect(character.streamVersion).toBe(before[0].streamVersion + 1)
      expect(JSON.parse(character.sheetState.documentJson).resourceUsage).toEqual([
        expect.objectContaining({ used: 1 })
      ])
      expect(result.occurrence?.status).toBe('COMPLETE')
      expect(result.projection.version).toBe(1)
      if (self)
        expect(JSON.parse(character.documentJson).state.hitpoints.current).toBe(
          Math.min(
            fixture.actor.maxHitPoints!,
            JSON.parse(before[0].documentJson).state.hitpoints.current + pending.request.max
          )
        )
      else {
        const target = await fixture.t.run((ctx) =>
          ctx.db
            .query('encounterRunActors')
            .withIndex('by_encounterId_id', (query) =>
              query.eq('encounterId', fixture.run.id).eq('id', fixture.target.id)
            )
            .unique()
        )
        if (!target) throw new Error('Missing Creature target.')
        expect(JSON.parse(target.stateJson).currentHitPoints).toBe(fixture.target.maxHitPoints)
      }
      await expect(
        fixture.owner.caller.mutation(api.encounters.commands.execute, { command })
      ).resolves.toEqual(result)
      await expect(
        fixture.owner.caller.mutation(api.encounters.commands.execute, { command: response })
      ).resolves.toEqual(result)
      expect(await records(fixture)).toEqual(after)
    },
    30000
  )

  it('settles a compiled self action resource and hit points once, then replays exactly', async () => {
    const fixture = await setup()
    const command = input(fixture)
    const before = await records(fixture)
    const result = await fixture.owner.caller.mutation(api.encounters.commands.execute, { command })
    const after = await records(fixture)
    const [beforeCharacter, beforeActor] = before
    const [afterCharacter, afterActor] = after
    if (
      !beforeCharacter ||
      !beforeActor ||
      !afterCharacter ||
      !afterActor ||
      !afterCharacter.sheetState
    )
      throw new Error('Missing records.')
    expect(afterCharacter.streamVersion).toBe(beforeCharacter.streamVersion + 1)
    expect(JSON.parse(afterCharacter.documentJson).state.hitpoints.current).toBe(
      JSON.parse(beforeCharacter.documentJson).state.hitpoints.current - 1
    )
    expect(JSON.parse(afterCharacter.sheetState.documentJson).resourceUsage).toEqual([
      expect.objectContaining({ used: 1 })
    ])
    expect(JSON.parse(afterActor.stateJson).sourceRevision).toBe(afterCharacter.streamVersion)
    const receipt = await fixture.t.run((ctx) =>
      ctx.db
        .query('encounterRuleReceipts')
        .withIndex('by_encounterId_commandId', (q) =>
          q.eq('encounterId', fixture.run.id).eq('commandId', command.commandId)
        )
        .unique()
    )
    if (!receipt) throw new Error('Missing native action receipt.')
    const storedExecution = JSON.parse(receipt.resultJson)
    expect(storedExecution.initialFactsChecksum).toBe(
      JSON.parse(receipt.commandMetadataJson).factsChecksum
    )
    expect(storedExecution.applicationOutputs).toMatchObject({
      kind: 'CHARACTER_MECHANICS_BATCH',
      sourceActorId: fixture.actor.id,
      sourceCharacterId: fixture.character.id,
      targetActorId: fixture.actor.id,
      sourceCharacterStreamVersion: null,
      targetCharacterStreamVersion: afterCharacter.streamVersion
    })
    await expect(
      fixture.owner.caller.mutation(api.encounters.commands.execute, { command })
    ).resolves.toEqual(result)
    expect(await records(fixture)).toEqual(after)
    await fixture.t.run(async (ctx) => {
      const metadata = JSON.parse(receipt.commandMetadataJson)
      await ctx.db.patch(receipt._id, {
        commandMetadataJson: JSON.stringify({ ...metadata, factsChecksum: '0'.repeat(64) })
      })
    })
    await expect(
      fixture.owner.caller.mutation(api.encounters.commands.execute, { command })
    ).rejects.toThrow(/receipt mismatch/)
    await fixture.t.run(async (ctx) => {
      const tampered = JSON.parse(receipt.resultJson)
      tampered.applicationOutputs.sourceCharacterId = crypto.randomUUID()
      const resultChecksum = checksumRuleDocument(tampered)
      const commandRow = after[3].find((value) => value.commandId === command.commandId)
      if (!commandRow) throw new Error('Missing native action command.')
      await ctx.db.patch(receipt._id, {
        commandMetadataJson: receipt.commandMetadataJson,
        resultJson: JSON.stringify(tampered),
        resultChecksum
      })
      await ctx.db.patch(commandRow._id, { ruleResultChecksum: resultChecksum })
    })
    await expect(
      fixture.owner.caller.mutation(api.encounters.commands.execute, { command })
    ).rejects.toThrow(/Character action receipt mismatch/)
  }, 30000)

  it('settles a separate Character resource source and Creature target atomically', async () => {
    const fixture = await setup(false)
    const command = input(fixture, crypto.randomUUID(), fixture.target.id)
    const snapshot = () =>
      fixture.t.run(async (ctx) =>
        Promise.all([
          ctx.db
            .query('characters')
            .withIndex('by_publicId', (q) => q.eq('id', fixture.character.id))
            .unique(),
          ctx.db
            .query('encounterRunActors')
            .withIndex('by_encounterId_id', (q) =>
              q.eq('encounterId', fixture.run.id).eq('id', fixture.target.id)
            )
            .unique(),
          ctx.db
            .query('encounterRuns')
            .withIndex('by_publicId', (q) => q.eq('id', fixture.run.id))
            .unique()
        ])
      )
    const before = await snapshot()
    const result = await fixture.owner.caller.mutation(api.encounters.commands.execute, { command })
    const after = await snapshot()
    if (!before[0] || !before[1] || !after[0] || !after[1] || !after[0].sheetState)
      throw new Error('Missing separate source records.')
    expect(after[0].streamVersion).toBe(before[0].streamVersion + 1)
    expect(JSON.parse(after[0].sheetState.documentJson).resourceUsage).toEqual([
      expect.objectContaining({ used: 1 })
    ])
    expect(JSON.parse(after[1].stateJson).currentHitPoints).toBe(
      JSON.parse(before[1].stateJson).currentHitPoints - 1
    )
    expect(result.projection.actors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: fixture.target.id, healthBand: expect.any(String) }),
        expect.objectContaining({ id: fixture.actor.id, sourceRevision: after[0].streamVersion })
      ])
    )
    await expect(
      fixture.owner.caller.mutation(api.encounters.commands.execute, { command })
    ).resolves.toEqual(result)
    expect(await snapshot()).toEqual(after)

    const rollbackFixture = await setup(false)
    const rollbackBefore = await rollbackFixture.t.run(async (ctx) =>
      Promise.all([
        ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', rollbackFixture.character.id))
          .unique(),
        ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) =>
            q.eq('encounterId', rollbackFixture.run.id).eq('id', rollbackFixture.target.id)
          )
          .unique(),
        ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', rollbackFixture.run.id))
          .unique()
      ])
    )
    await expect(
      rollbackFixture.owner.caller.run(async (ctx) => {
        await ctx.runMutation(api.encounters.commands.execute, {
          command: input(rollbackFixture, crypto.randomUUID(), rollbackFixture.target.id)
        })
        throw new Error('terminal failure')
      })
    ).rejects.toThrow('terminal failure')
    const rollbackAfter = await rollbackFixture.t.run(async (ctx) =>
      Promise.all([
        ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', rollbackFixture.character.id))
          .unique(),
        ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) =>
            q.eq('encounterId', rollbackFixture.run.id).eq('id', rollbackFixture.target.id)
          )
          .unique(),
        ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', rollbackFixture.run.id))
          .unique()
      ])
    )
    expect(rollbackAfter).toEqual(rollbackBefore)
  }, 30000)

  it('creates and replaces Automatic self maintenance with one Character stream advance', async () => {
    const fixture = await setup(true, 'AUTOMATIC', { maintained: true })
    if (!fixture.maintenanceDefinitionId)
      throw new Error('Automatic Character maintenance policy is unavailable.')
    const before = await maintenanceRecords(fixture)
    const root = input(fixture)
    const created = await fixture.owner.caller.mutation(api.encounters.commands.execute, {
      command: root
    })
    const afterCreated = await maintenanceRecords(fixture)
    if (!before.character || !afterCreated.character || !afterCreated.character.sheetState)
      throw new Error('Automatic maintained Character is unavailable.')
    expect(created.occurrence?.status).toBe('COMPLETE')
    expect(afterCreated.character.streamVersion).toBe(before.character.streamVersion + 1)
    expect(JSON.parse(afterCreated.character.sheetState.documentJson).resourceUsage).toEqual([
      expect.objectContaining({ used: 1 })
    ])
    expect(afterCreated.maintainedStates).toHaveLength(1)
    expect(afterCreated.characterEffects).toHaveLength(1)
    expect(afterCreated.characterEffects[0]?.maintainedEffectStateId).toBe(
      afterCreated.maintainedStates[0]?.id
    )
    expect(executionFor(afterCreated, root.commandId).applicationOutputs).toMatchObject({
      kind: 'CHARACTER_MECHANICS_BATCH',
      sourceActorId: fixture.actor.id,
      sourceCharacterId: fixture.character.id,
      targetActorId: fixture.actor.id,
      sourceCharacterStreamVersion: null,
      targetCharacterStreamVersion: afterCreated.character.streamVersion,
      maintenanceTransition: {
        priorState: null,
        createdState: {
          id: afterCreated.maintainedStates[0]!.id,
          sourceActionId: root.actionId,
          sourceActorId: fixture.actor.id,
          maintenanceDefinitionId: fixture.maintenanceDefinitionId
        },
        createdDependentEffectIds: [afterCreated.characterEffects[0]!.id]
      }
    })
    expectSourceMirror(
      fixture,
      afterCreated,
      afterCreated.character.streamVersion,
      created.projection
    )

    await resetActionAllowance(fixture)
    const replacementRoot = input(
      fixture,
      crypto.randomUUID(),
      fixture.actor.id,
      created.projection.version
    )
    const beforeReplacement = await maintenanceRecords(fixture)
    await expect(
      fixture.owner.caller.run(async (ctx) => {
        await ctx.runMutation(api.encounters.commands.execute, { command: replacementRoot })
        throw new Error('rollback Character maintenance replacement')
      })
    ).rejects.toThrow('rollback Character maintenance replacement')
    expect(await maintenanceRecords(fixture)).toEqual(beforeReplacement)

    const replaced = await fixture.owner.caller.mutation(api.encounters.commands.execute, {
      command: replacementRoot
    })
    const afterReplacement = await maintenanceRecords(fixture)
    if (!beforeReplacement.character || !afterReplacement.character?.sheetState)
      throw new Error('Replaced maintained Character is unavailable.')
    expect(afterReplacement.character.streamVersion).toBe(
      beforeReplacement.character.streamVersion + 1
    )
    expect(JSON.parse(afterReplacement.character.sheetState.documentJson).resourceUsage).toEqual([
      expect.objectContaining({ used: 2 })
    ])
    expect(afterReplacement.maintainedStates).toHaveLength(1)
    expect(afterReplacement.maintainedStates[0]?.id).not.toBe(afterCreated.maintainedStates[0]?.id)
    expect(afterReplacement.characterEffects).toHaveLength(1)
    expect(afterReplacement.characterEffects[0]?.id).not.toBe(afterCreated.characterEffects[0]?.id)
    expect(afterReplacement.characterEffects[0]?.maintainedEffectStateId).toBe(
      afterReplacement.maintainedStates[0]?.id
    )
    expect(
      executionFor(afterReplacement, replacementRoot.commandId).applicationOutputs
    ).toMatchObject({
      kind: 'CHARACTER_MECHANICS_BATCH',
      sourceActorId: fixture.actor.id,
      sourceCharacterId: fixture.character.id,
      targetActorId: fixture.actor.id,
      sourceCharacterStreamVersion: null,
      targetCharacterStreamVersion: afterReplacement.character.streamVersion,
      maintenanceTransition: {
        priorState: { id: afterCreated.maintainedStates[0]!.id },
        removedDependentEffects: [
          expect.objectContaining({ activeEffectId: afterCreated.characterEffects[0]!.id })
        ],
        createdState: { id: afterReplacement.maintainedStates[0]!.id },
        createdDependentEffectIds: [afterReplacement.characterEffects[0]!.id]
      }
    })
    expectSourceMirror(
      fixture,
      afterReplacement,
      afterReplacement.character.streamVersion,
      replaced.projection
    )
    await expect(
      fixture.owner.caller.mutation(api.encounters.commands.execute, { command: replacementRoot })
    ).resolves.toEqual(replaced)
    expect(await maintenanceRecords(fixture)).toEqual(afterReplacement)
  }, 60000)

  it('resumes Assisted maintenance and advances a distinct source Character once for cleanup', async () => {
    const fixture = await setup(false, 'ASSISTED', {
      maintained: true,
      useResource: false
    })
    if (!fixture.maintenanceDefinitionId)
      throw new Error('Assisted Character maintenance policy is unavailable.')
    const maintenanceDefinitionId = fixture.maintenanceDefinitionId
    const firstRoot = input(fixture, crypto.randomUUID(), fixture.target.id)
    const before = await maintenanceRecords(fixture)
    const firstIssued = await fixture.owner.caller.mutation(api.encounters.commands.execute, {
      command: firstRoot
    })
    const firstPending = firstIssued.occurrence?.pending
    if (firstPending?.kind !== 'ACTION_OUTCOME_EVIDENCE')
      throw new Error('Expected maintained Character outcome evidence.')
    const firstStaged = await maintenanceRecords(fixture)
    expect(firstStaged).toMatchObject({
      character: before.character,
      actors: before.actors,
      actorEffects: before.actorEffects,
      characterEffects: before.characterEffects,
      maintainedStates: before.maintainedStates,
      receipts: before.receipts,
      commands: before.commands,
      completedOccurrences: before.completedOccurrences,
      run: before.run
    })
    expect(firstStaged.pendingOccurrences).toHaveLength(before.pendingOccurrences.length + 1)
    const firstResponse: ResolveRuleOccurrenceInputDto = {
      type: 'RESOLVE_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: fixture.run.id,
      expectedVersion: firstIssued.projection.version,
      occurrenceId: firstPending.occurrenceId,
      expectedOccurrenceVersion: firstPending.occurrenceVersion,
      correlationId: null,
      resolution: {
        kind: 'SYSTEM_ROLL',
        requestId: firstPending.request.requestId
      }
    }
    const firstSettled = await fixture.owner.caller.mutation(api.encounters.commands.execute, {
      command: firstResponse
    })
    const firstComplete = await maintenanceRecords(fixture)
    if (!before.character || !firstComplete.character)
      throw new Error('Assisted maintained Character is unavailable.')
    expect(firstComplete.character.streamVersion).toBe(before.character.streamVersion)
    expect(
      firstComplete.character.sheetState
        ? JSON.parse(firstComplete.character.sheetState.documentJson).resourceUsage
        : []
    ).toEqual(
      before.character.sheetState
        ? JSON.parse(before.character.sheetState.documentJson).resourceUsage
        : []
    )
    expect(firstComplete.maintainedStates).toHaveLength(1)
    expect(firstComplete.actorEffects).toHaveLength(1)
    expect(firstComplete.characterEffects).toHaveLength(0)
    expect(firstComplete.actorEffects[0]?.maintainedEffectStateId).toBe(
      firstComplete.maintainedStates[0]?.id
    )
    expect(executionFor(firstComplete, firstRoot.commandId).applicationOutputs).toMatchObject({
      kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
      sourceActorId: fixture.actor.id,
      sourceCharacterId: fixture.character.id,
      targetActorId: fixture.target.id,
      sourceCharacterStreamVersion: null,
      maintenanceTransition: {
        priorState: null,
        createdState: { id: firstComplete.maintainedStates[0]!.id },
        createdDependentEffectIds: [firstComplete.actorEffects[0]!.id]
      }
    })
    expectSourceMirror(
      fixture,
      firstComplete,
      firstComplete.character.streamVersion,
      firstSettled.projection
    )

    const seededCharacterEffectId = await fixture.t.run(async (ctx) => {
      const store = createActiveRuleEffectStore(ctx)
      const current = await store.list({
        kind: 'ENCOUNTER_ACTOR',
        encounterId: fixture.run.id,
        targetActorId: fixture.target.id
      })
      const dependent = current[0]
      const maintained = await store.findMaintainedState({
        encounterId: fixture.run.id,
        ownerActorId: fixture.actor.id,
        maintenanceDefinitionId
      })
      if (!dependent || !maintained)
        throw new Error('Created Character maintenance records are unavailable.')
      const seeded = await store.create({
        id: crypto.randomUUID(),
        owner: { kind: 'CHARACTER', characterId: fixture.character.id },
        definition: dependent.definition,
        lifecycle: dependent.lifecycle,
        maintainedEffectStateId: maintained.id
      })
      return seeded.id
    })

    await resetActionAllowance(fixture)
    const replacementRoot = input(
      fixture,
      crypto.randomUUID(),
      fixture.target.id,
      firstSettled.projection.version
    )
    const beforeReplacement = await maintenanceRecords(fixture)
    const replacementIssued = await fixture.owner.caller.mutation(api.encounters.commands.execute, {
      command: replacementRoot
    })
    const replacementPending = replacementIssued.occurrence?.pending
    if (replacementPending?.kind !== 'ACTION_OUTCOME_EVIDENCE')
      throw new Error('Expected replacement Character outcome evidence.')
    const replacementStaged = await maintenanceRecords(fixture)
    expect(replacementStaged).toMatchObject({
      character: beforeReplacement.character,
      actors: beforeReplacement.actors,
      actorEffects: beforeReplacement.actorEffects,
      characterEffects: beforeReplacement.characterEffects,
      maintainedStates: beforeReplacement.maintainedStates,
      receipts: beforeReplacement.receipts,
      commands: beforeReplacement.commands,
      completedOccurrences: beforeReplacement.completedOccurrences,
      run: beforeReplacement.run
    })
    expect(replacementStaged.pendingOccurrences).toHaveLength(
      beforeReplacement.pendingOccurrences.length + 1
    )
    const replacementResponse: ResolveRuleOccurrenceInputDto = {
      type: 'RESOLVE_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: fixture.run.id,
      expectedVersion: replacementIssued.projection.version,
      occurrenceId: replacementPending.occurrenceId,
      expectedOccurrenceVersion: replacementPending.occurrenceVersion,
      correlationId: null,
      resolution: {
        kind: 'SYSTEM_ROLL',
        requestId: replacementPending.request.requestId
      }
    }

    const maintainedVersion = await fixture.t.run(async (ctx) => {
      const state = await ctx.db
        .query('encounterMaintainedEffectStates')
        .withIndex('by_encounter_owner_definition', (q) =>
          q
            .eq('encounterId', fixture.run.id)
            .eq('ownerActorId', fixture.actor.id)
            .eq('maintenanceDefinitionId', maintenanceDefinitionId)
        )
        .unique()
      if (!state) throw new Error('Character maintenance state is unavailable.')
      await ctx.db.patch(state._id, { version: state.version + 1 })
      return state.version
    })
    await expect(
      fixture.owner.caller.mutation(api.encounters.commands.execute, {
        command: replacementResponse
      })
    ).rejects.toThrow(/pending action source or target changed/)
    await fixture.t.run(async (ctx) => {
      const state = await ctx.db
        .query('encounterMaintainedEffectStates')
        .withIndex('by_encounter_owner_definition', (q) =>
          q
            .eq('encounterId', fixture.run.id)
            .eq('ownerActorId', fixture.actor.id)
            .eq('maintenanceDefinitionId', maintenanceDefinitionId)
        )
        .unique()
      if (!state) throw new Error('Character maintenance state is unavailable.')
      await ctx.db.patch(state._id, { version: maintainedVersion })
    })
    expect(await maintenanceRecords(fixture)).toEqual(replacementStaged)

    await fixture.t.run(async (ctx) => {
      const character = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', fixture.character.id))
        .unique()
      if (!character) throw new Error('Character maintenance owner is unavailable.')
      await ctx.db.patch(character._id, { status: 'DRAFT' })
    })
    await expect(
      fixture.owner.caller.mutation(api.encounters.commands.execute, {
        command: replacementResponse
      })
    ).rejects.toThrow(/Stored Character identity mismatch/)
    await fixture.t.run(async (ctx) => {
      const character = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', fixture.character.id))
        .unique()
      if (!character) throw new Error('Character maintenance owner is unavailable.')
      await ctx.db.patch(character._id, { status: 'ACTIVE' })
    })
    expect(await maintenanceRecords(fixture)).toEqual(replacementStaged)

    await expect(
      fixture.owner.caller.run(async (ctx) => {
        await ctx.runMutation(api.encounters.commands.execute, {
          command: replacementResponse
        })
        throw new Error('rollback resumed Character maintenance')
      })
    ).rejects.toThrow('rollback resumed Character maintenance')
    expect(await maintenanceRecords(fixture)).toEqual(replacementStaged)

    const replaced = await fixture.owner.caller.mutation(api.encounters.commands.execute, {
      command: replacementResponse
    })
    const replacementComplete = await maintenanceRecords(fixture)
    if (!beforeReplacement.character || !replacementComplete.character)
      throw new Error('Cleaned Character maintenance source is unavailable.')
    expect(replacementComplete.character.streamVersion).toBe(
      beforeReplacement.character.streamVersion + 1
    )
    expect(JSON.parse(replacementComplete.character.documentJson).state.hitpoints).toEqual(
      JSON.parse(beforeReplacement.character.documentJson).state.hitpoints
    )
    expect(
      replacementComplete.character.sheetState
        ? JSON.parse(replacementComplete.character.sheetState.documentJson).resourceUsage
        : []
    ).toEqual(
      beforeReplacement.character.sheetState
        ? JSON.parse(beforeReplacement.character.sheetState.documentJson).resourceUsage
        : []
    )
    expect(replacementComplete.characterEffects).toHaveLength(0)
    expect(replacementComplete.actorEffects).toHaveLength(1)
    expect(replacementComplete.maintainedStates).toHaveLength(1)
    expect(replacementComplete.maintainedStates[0]?.id).not.toBe(
      firstComplete.maintainedStates[0]?.id
    )
    expect(replacementComplete.actorEffects[0]?.maintainedEffectStateId).toBe(
      replacementComplete.maintainedStates[0]?.id
    )
    expect(
      executionFor(replacementComplete, replacementRoot.commandId).applicationOutputs
    ).toMatchObject({
      kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
      sourceActorId: fixture.actor.id,
      sourceCharacterId: fixture.character.id,
      sourceCharacterStreamVersion: replacementComplete.character.streamVersion,
      targetActorId: fixture.target.id,
      maintenanceTransition: {
        priorState: { id: firstComplete.maintainedStates[0]!.id },
        removedDependentEffects: expect.arrayContaining([
          expect.objectContaining({ activeEffectId: firstComplete.actorEffects[0]!.id }),
          expect.objectContaining({
            kind: 'CHARACTER',
            characterId: fixture.character.id,
            activeEffectId: seededCharacterEffectId
          })
        ]),
        characterOwnerTransitions: [
          {
            characterId: fixture.character.id,
            beforeStreamVersion: beforeReplacement.character.streamVersion,
            afterStreamVersion: beforeReplacement.character.streamVersion + 1
          }
        ],
        createdState: { id: replacementComplete.maintainedStates[0]!.id },
        createdDependentEffectIds: [replacementComplete.actorEffects[0]!.id]
      }
    })
    expectSourceMirror(
      fixture,
      replacementComplete,
      replacementComplete.character.streamVersion,
      replaced.projection
    )
    await expect(
      fixture.owner.caller.mutation(api.encounters.commands.execute, {
        command: replacementRoot
      })
    ).resolves.toEqual(replaced)
    await expect(
      fixture.owner.caller.mutation(api.encounters.commands.execute, {
        command: replacementResponse
      })
    ).resolves.toEqual(replaced)
    expect(await maintenanceRecords(fixture)).toEqual(replacementComplete)
  }, 60000)

  it('refuses a stale Character source without writes', async () => {
    const fixture = await setup()
    await fixture.t.run(async (ctx) => {
      const row = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', fixture.character.id))
        .unique()
      if (!row) throw new Error('Missing Character.')
      await ctx.db.patch(row._id, { streamVersion: row.streamVersion + 1 })
    })
    const before = await records(fixture)
    await expect(
      fixture.owner.caller.mutation(api.encounters.commands.execute, { command: input(fixture) })
    ).rejects.toThrow(/stale/)
    expect(await records(fixture)).toEqual(before)
  }, 30000)
})
