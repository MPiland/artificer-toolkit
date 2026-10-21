import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { readTestActor } from '../../tests/fixtures/storedActors'
import { makeFunctionReference } from 'convex/server'
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
  ResolveEncounterActionInputDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterMaintainedEffectDescriptorDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { readCharacterSheetState } from '@artificer-toolkit/schema/projections/characterStoredState'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { discoverCharacterActionCapabilities } from '@artificer-toolkit/rules-runtime/characterActionCapabilityDiscovery'
import { compileCharacterActionEntryPoints } from '@artificer-toolkit/rules-runtime/encounterActionEntryPointCompiler'
import { withEncounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdWolf as wolf } from '../../tests/fixtures/srdCreatures'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  SRD_CONCENTRATION_DEFINITIONS,
  SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
} from '@artificer-toolkit/source-data/srd/concentration.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { maintenanceDefinitionFixture } from '../../tests/fixtures/maintenanceDefinition'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { setAutoRollDice, type FixtureRolls } from '../../tests/fixtures/rollPreferences'
import { api, components, internal } from '../_generated/api'
import { sourceImportBatches } from '../content/importBatches'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  closeRoom,
  executeInRoom,
  executeSheetInRoom,
  expectRedactedRoomRefusal,
  invalidateRoomInputs,
  roomErrorLogs,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

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

const CHARACTER_ACTION_MAINTENANCE_DEFINITION_ID = '00000000-0000-4000-8000-0000000008f0'

function input(
  fixture: Awaited<ReturnType<typeof setup>>,
  commandId = crypto.randomUUID(),
  targetActorId = fixture.actor.id,
  expectedVersion = 0
) {
  return {
    type: 'RESOLVE_ACTION' as const,
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    encounterId: fixture.run.id,
    commandId,
    expectedVersion,
    actorId: fixture.actor.id,
    target: { kind: 'ACTOR', actorId: targetActorId },
    actionId: fixture.actionId,
    optionalCombatIntent: null,
    sceneContext: null
  } satisfies ResolveEncounterActionInputDto
}

type SetupOptions = {
  maintained?: boolean
  /** The action starts the SRD Concentration instead of the fixture maintenance policy. */
  concentration?: boolean
  useResource?: boolean
}

async function setup(self = true, rolls: FixtureRolls = 'AUTO_ROLL', options: SetupOptions = {}) {
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
        ...(options.maintained || options.concentration
          ? {
              id: crypto.randomUUID(),
              maintenanceDefinitionId: options.concentration
                ? SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
                : CHARACTER_ACTION_MAINTENANCE_DEFINITION_ID,
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
          if (outcome.damageTypeId === undefined) throw new Error('Expected named damage.')
          return {
            id: outcome.id,
            scalingKind: 'NONE' as const,
            // Concentration starts must not damage their caster: its save could lose the Concentration.
            ...(rolls === 'PROMPT' || options.concentration
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
  for (const user of [base.owner, base.other])
    await setAutoRollDice(base.t, user.userId, rolls === 'AUTO_ROLL')
  const { draft, character } = await base.createCharacter()
  if (rolls === 'PROMPT') character.state.hitpoints.current = 1
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
      ...(options.concentration
        ? []
        : [maintenanceDefinitionFixture({ id: CHARACTER_ACTION_MAINTENANCE_DEFINITION_ID })])
    ]
  })
  if (options.concentration)
    for (const definitions of sourceImportBatches([
      ...SRD_RULE_STATE_DEFINITIONS,
      ...SRD_CONCENTRATION_DEFINITIONS
    ]))
      await base.t.mutation(internal.content.import.importDefinitions, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitions
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
  const blueprint = await owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Character source',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CUSTOM', label: 'Target', maxHitPoints: 3 }]
  })
  const run = await owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const actor = run.actors.find((value) => value.kind === 'CHARACTER')
  const target = run.actors.find((value) => value.id !== actor?.id)
  if (!actor || !target) throw new Error('Missing Encounter actors.')
  await base.t.run(async (ctx) => {
    await activateFixtureRun(
      ctx,
      run.id,
      { automationMode: 'ASSISTED', round: 1, currentActorId: actor.id },
      [actor.id, target.id]
    )
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
  await attachFixtureRoom(base.t, campaign.id)
  return {
    ...base,
    owner,
    player: base.owner,
    campaign,
    character,
    run,
    actor,
    target,
    actionId,
    maintenanceDefinitionId: options.maintained ? CHARACTER_ACTION_MAINTENANCE_DEFINITION_ID : null
  }
}

// The room holds the Run's commands and receipts until it ends (D85), so Convex is read after the
// room publishes what it holds.
async function records(fixture: Awaited<ReturnType<typeof setup>>) {
  await checkpointLiveRoom(fixture.campaign.id)
  return fixture.t.run(async (ctx) =>
    Promise.all([
      readCharacterRow(ctx, fixture.character.id),
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', fixture.run.id).eq('id', fixture.actor.id)
        )
        .unique(),
      ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', fixture.run.id))
        .unique()
    ])
  )
}

async function maintenanceRecords(fixture: Awaited<ReturnType<typeof setup>>) {
  await checkpointLiveRoom(fixture.campaign.id)
  return fixture.t.run(async (ctx) => ({
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    character: await readCharacterRow(ctx, fixture.character.id),
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

/** The maintained state's descriptor, as the room published it. */
function descriptorOf(
  state: Awaited<ReturnType<typeof maintenanceRecords>>['maintainedStates'][number]
) {
  return encounterMaintainedEffectDescriptorDtoSchema.parse(JSON.parse(state.descriptorJson))
}

/** Releases the room so the direct write below is what its next command hydrates. */
async function resetActionAllowance(fixture: Awaited<ReturnType<typeof setup>>) {
  await closeRoom(fixture.campaign.id)
  await fixture.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', fixture.run.id).eq('id', fixture.actor.id)
      )
      .unique()
    if (!row) throw new Error('Character action source is unavailable.')
    const actor = await readTestActor(ctx, row)
    const reset = encounterRunActorStateSchema.parse({
      ...actor,
      resources: withEncounterRuleUsageUsed(actor, SRD_ACTION_ALLOWANCE_DEFINITION_ID, 0)
    })
    await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, reset)
  })
}

/**
 * A Character assigned to the Campaign but outside the Run, holding two carried Concentration grants:
 * one stamped with the Run's caster and one stamped with nobody (D99, SPELLS-5.7).
 */
async function bystanderWithCarriedGrants(fixture: Awaited<ReturnType<typeof setup>>) {
  // A Campaign member holds one assigned Character, so the Campaign owner's is the bystander.
  const { draft, character } = await fixture.createCharacter(undefined, fixture.owner.caller)
  const bystanderId = (
    await fixture.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'create',
      character: { ...character, label: 'Bystander' }
    })
  ).character.id
  await fixture.owner.caller.mutation(api.campaigns.assignments.assign, {
    campaignId: fixture.campaign.id,
    characterId: bystanderId
  })
  const grants = await fixture.t.run(async (ctx) => {
    const store = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
    const carried = (concentrationCasterCharacterId: string | null) =>
      store.create({
        id: crypto.randomUUID(),
        owner: { kind: 'CHARACTER', characterId: bystanderId },
        definition: plannedModifierGrant({
          encounterId: fixture.run.id,
          sourceActorId: fixture.actor.id,
          holderActorId: fixture.actor.id,
          lifecycle: {},
          rounds: 30,
          lifetimeScope: 'OWNER'
        }).definition,
        lifecycle: { schemaVersion: 1, remainingTicks: 25, concentrationCasterCharacterId }
      })
    return { stamped: await carried(fixture.character.id), unstamped: await carried(null) }
  })
  const held = () =>
    fixture.t.run(async (ctx) => ({
      effectIds: (
        await ctx.db
          .query('characterActiveRuleEffects')
          .withIndex('by_characterId_id', (q) => q.eq('characterId', bystanderId))
          .take(8)
      ).map(({ id }) => id),
      streamVersion: (await readCharacterRow(ctx, bystanderId))?.play.streamVersion
    }))
  return { ...grants, held }
}

function expectLiveCharacterProjection(
  fixture: Awaited<ReturnType<typeof setup>>,
  snapshot: Awaited<ReturnType<typeof maintenanceRecords>>,
  projection: { actors: readonly { id: string }[] }
) {
  if (!snapshot.character) throw new Error('Character source is unavailable.')
  expect(projection.actors.find((candidate) => candidate.id === fixture.actor.id)).toMatchObject({
    sourceRevision: null,
    currentHitPoints: readCharacterRecord(snapshot.character).state.hitpoints.current
  })
}

// Receipt-level outputs (mechanics batches, maintenance transitions) live in the room's history:
// see apps/session-worker/test/nativeRoomCharacterSources.test.ts.
describe('native Character action sources', () => {
  useLocalRoomWorker()

  it.each([true, false])(
    'retains an Assisted Character resource until its terminal evidence (self: %s)',
    async (self) => {
      const fixture = await setup(self, 'PROMPT')
      const command = input(
        fixture,
        crypto.randomUUID(),
        self ? fixture.actor.id : fixture.target.id
      )
      const before = await records(fixture)
      const pendingResult = await executeInRoom(fixture.owner.caller, {
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
        resolution: {
          kind: 'ENTER_INTEGER',
          requestId: pending.request.requestId,
          value: self ? pending.request.max : pending.request.min
        }
      }
      expect(await records(fixture)).toEqual(before)
      expect(await records(fixture)).toEqual(before)
      const result = await executeInRoom(fixture.owner.caller, {
        command: response
      })
      const after = await records(fixture)
      const character = after[0]
      if (!character || !before[0]) throw new Error('Missing Character settlement.')
      expect(character.play.streamVersion).toBe(before[0].play.streamVersion + 1)
      expect(readCharacterSheetState(character).resourceUsage).toEqual([
        expect.objectContaining({ used: 1 })
      ])
      expect(result.occurrence?.status).toBe('COMPLETE')
      expect(result.projection.version).toBe(1)
      if (self)
        expect(readCharacterRecord(character).state.hitpoints.current).toBe(
          Math.min(
            fixture.actor.maxHitPoints!,
            readCharacterRecord(before[0]).state.hitpoints.current + pending.request.max
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
      // The room journals the original occurrence and reads the projection as it is now (D78).
      await expect(executeInRoom(fixture.owner.caller, { command })).resolves.toEqual({
        ...pendingResult,
        projection: result.projection
      })
      await expect(executeInRoom(fixture.owner.caller, { command: response })).resolves.toEqual(
        result
      )
      expect(await records(fixture)).toEqual(after)
    },
    30000
  )

  it('settles a compiled self action resource and hit points once, then replays exactly', async () => {
    const fixture = await setup()
    const command = input(fixture)
    const before = await records(fixture)
    const result = await executeInRoom(fixture.owner.caller, {
      command
    })
    const after = await records(fixture)
    const [beforeCharacter, beforeActor] = before
    const [afterCharacter, afterActor] = after
    if (!beforeCharacter || !beforeActor || !afterCharacter || !afterActor)
      throw new Error('Missing records.')
    expect(afterCharacter.play.streamVersion).toBe(beforeCharacter.play.streamVersion + 1)
    expect(readCharacterRecord(afterCharacter).state.hitpoints.current).toBe(
      readCharacterRecord(beforeCharacter).state.hitpoints.current - 1
    )
    expect(readCharacterSheetState(afterCharacter).resourceUsage).toEqual([
      expect.objectContaining({ used: 1 })
    ])
    expect(
      result.projection.actors.find((candidate) => candidate.id === fixture.actor.id)
    ).toMatchObject({
      sourceRevision: null,
      currentHitPoints: readCharacterRecord(afterCharacter).state.hitpoints.current
    })
    // The room keeps the receipt until the Run ends; the Character's stream advancing exactly once
    // (asserted above) is what its targetCharacterStreamVersion records.
    await expect(executeInRoom(fixture.owner.caller, { command })).resolves.toEqual(result)
    expect(await records(fixture)).toEqual(after)
  }, 30000)

  it('settles a separate Character resource source and Creature target atomically', async () => {
    const fixture = await setup(false)
    const command = input(fixture, crypto.randomUUID(), fixture.target.id)
    const snapshot = async () => {
      await checkpointLiveRoom(fixture.campaign.id)
      return fixture.t.run(async (ctx) =>
        Promise.all([
          readCharacterRow(ctx, fixture.character.id),
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
    }
    const before = await snapshot()
    const result = await executeInRoom(fixture.owner.caller, {
      command
    })
    const after = await snapshot()
    if (!before[0] || !before[1] || !after[0] || !after[1])
      throw new Error('Missing separate source records.')
    expect(after[0].play.streamVersion).toBe(before[0].play.streamVersion + 1)
    expect(readCharacterSheetState(after[0]).resourceUsage).toEqual([
      expect.objectContaining({ used: 1 })
    ])
    expect(JSON.parse(after[1].stateJson).currentHitPoints).toBe(
      JSON.parse(before[1].stateJson).currentHitPoints - 1
    )
    expect(result.projection.actors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: fixture.target.id, healthBand: expect.any(String) }),
        expect.objectContaining({
          id: fixture.actor.id,
          sourceRevision: null,
          currentHitPoints: readCharacterRecord(after[0]).state.hitpoints.current
        })
      ])
    )
    await expect(executeInRoom(fixture.owner.caller, { command })).resolves.toEqual(result)
    expect(await snapshot()).toEqual(after)

    const rollbackFixture = await setup(false)
    const rollbackBefore = await rollbackFixture.t.run(async (ctx) =>
      Promise.all([
        readCharacterRow(ctx, rollbackFixture.character.id),
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
    const rollbackAfter = await rollbackFixture.t.run(async (ctx) =>
      Promise.all([
        readCharacterRow(ctx, rollbackFixture.character.id),
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
    const fixture = await setup(true, 'AUTO_ROLL', { maintained: true })
    if (!fixture.maintenanceDefinitionId)
      throw new Error('Automatic Character maintenance policy is unavailable.')
    const before = await maintenanceRecords(fixture)
    const root = input(fixture)
    const created = await executeInRoom(fixture.owner.caller, {
      command: root
    })
    const afterCreated = await maintenanceRecords(fixture)
    if (!before.character || !afterCreated.character)
      throw new Error('Automatic maintained Character is unavailable.')
    expect(created.occurrence?.status).toBe('COMPLETE')
    expect(afterCreated.character.play.streamVersion).toBe(before.character.play.streamVersion + 1)
    expect(readCharacterSheetState(afterCreated.character).resourceUsage).toEqual([
      expect.objectContaining({ used: 1 })
    ])
    expect(afterCreated.maintainedStates).toHaveLength(1)
    expect(afterCreated.characterEffects).toHaveLength(1)
    expect(afterCreated.characterEffects[0]?.maintainedEffectStateId).toBe(
      afterCreated.maintainedStates[0]?.id
    )
    expect(afterCreated.maintainedStates[0]).toMatchObject({
      ownerActorId: fixture.actor.id,
      maintenanceDefinitionId: fixture.maintenanceDefinitionId
    })
    expect(descriptorOf(afterCreated.maintainedStates[0]!)).toMatchObject({
      provenance: { kind: 'ACTION', sourceActionId: root.actionId },
      sourceActorId: fixture.actor.id
    })
    expectLiveCharacterProjection(fixture, afterCreated, created.projection)

    await resetActionAllowance(fixture)
    const replacementRoot = input(
      fixture,
      crypto.randomUUID(),
      fixture.actor.id,
      created.projection.version
    )
    const beforeReplacement = await maintenanceRecords(fixture)
    expect(await maintenanceRecords(fixture)).toEqual(beforeReplacement)

    const replaced = await executeInRoom(fixture.owner.caller, {
      command: replacementRoot
    })
    const afterReplacement = await maintenanceRecords(fixture)
    if (!beforeReplacement.character || !afterReplacement.character)
      throw new Error('Replaced maintained Character is unavailable.')
    expect(afterReplacement.character.play.streamVersion).toBe(
      beforeReplacement.character.play.streamVersion + 1
    )
    expect(readCharacterSheetState(afterReplacement.character).resourceUsage).toEqual([
      expect.objectContaining({ used: 2 })
    ])
    expect(afterReplacement.maintainedStates).toHaveLength(1)
    expect(afterReplacement.maintainedStates[0]?.id).not.toBe(afterCreated.maintainedStates[0]?.id)
    expect(afterReplacement.characterEffects).toHaveLength(1)
    expect(afterReplacement.characterEffects[0]?.id).not.toBe(afterCreated.characterEffects[0]?.id)
    expect(afterReplacement.characterEffects[0]?.maintainedEffectStateId).toBe(
      afterReplacement.maintainedStates[0]?.id
    )
    expect(descriptorOf(afterReplacement.maintainedStates[0]!)).toMatchObject({
      provenance: { kind: 'ACTION', sourceActionId: replacementRoot.actionId },
      sourceActorId: fixture.actor.id
    })
    expectLiveCharacterProjection(fixture, afterReplacement, replaced.projection)
    await expect(
      executeInRoom(fixture.owner.caller, {
        command: replacementRoot
      })
    ).resolves.toEqual(replaced)
    expect(await maintenanceRecords(fixture)).toEqual(afterReplacement)
  }, 60000)

  it('resumes Assisted maintenance and advances a distinct source Character once for cleanup', async () => {
    const fixture = await setup(false, 'PROMPT', {
      maintained: true,
      useResource: false
    })
    if (!fixture.maintenanceDefinitionId)
      throw new Error('Assisted Character maintenance policy is unavailable.')
    const maintenanceDefinitionId = fixture.maintenanceDefinitionId
    const firstRoot = input(fixture, crypto.randomUUID(), fixture.target.id)
    const before = await maintenanceRecords(fixture)
    const firstIssued = await executeInRoom(fixture.owner.caller, {
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
        kind: 'ENTER_INTEGER',
        requestId: firstPending.request.requestId,
        value: firstPending.request.min
      }
    }
    const firstSettled = await executeInRoom(fixture.owner.caller, {
      command: firstResponse
    })
    const firstComplete = await maintenanceRecords(fixture)
    if (!before.character || !firstComplete.character)
      throw new Error('Assisted maintained Character is unavailable.')
    expect(firstComplete.character.play.streamVersion).toBe(before.character.play.streamVersion)
    expect(readCharacterSheetState(firstComplete.character).resourceUsage).toEqual(
      readCharacterSheetState(before.character).resourceUsage
    )
    expect(firstComplete.maintainedStates).toHaveLength(1)
    expect(firstComplete.actorEffects).toHaveLength(1)
    expect(firstComplete.characterEffects).toHaveLength(0)
    expect(firstComplete.actorEffects[0]?.maintainedEffectStateId).toBe(
      firstComplete.maintainedStates[0]?.id
    )
    expect(firstComplete.maintainedStates[0]).toMatchObject({ ownerActorId: fixture.actor.id })
    expectLiveCharacterProjection(fixture, firstComplete, firstSettled.projection)

    // The seed is a direct write, so the room is released and hydrates it with its next command.
    await closeRoom(fixture.campaign.id)
    await fixture.t.run(async (ctx) => {
      const store = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
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
      await store.create({
        id: crypto.randomUUID(),
        owner: { kind: 'CHARACTER', characterId: fixture.character.id },
        definition: dependent.definition,
        lifecycle: dependent.lifecycle,
        maintainedEffectStateId: maintained.id
      })
    })

    await resetActionAllowance(fixture)
    const replacementRoot = input(
      fixture,
      crypto.randomUUID(),
      fixture.target.id,
      firstSettled.projection.version
    )
    const beforeReplacement = await maintenanceRecords(fixture)
    const replacementIssued = await executeInRoom(fixture.owner.caller, {
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
        kind: 'ENTER_INTEGER',
        requestId: replacementPending.request.requestId,
        value: replacementPending.request.min
      }
    }

    await closeRoom(fixture.campaign.id)
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
    await expectRedactedRoomRefusal(
      executeInRoom(fixture.owner.caller, {
        command: replacementResponse
      }),
      'The Encounter command could not be completed.'
    )
    expect(roomErrorLogs().join('\n')).toMatch(/pending action source or target changed/)
    await closeRoom(fixture.campaign.id)
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
    await expectRedactedRoomRefusal(
      executeInRoom(fixture.owner.caller, {
        command: replacementResponse
      }),
      'The Encounter changed; review the current state and try again.',
      'STALE_STATE'
    )
    await fixture.t.run(async (ctx) => {
      const character = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', fixture.character.id))
        .unique()
      if (!character) throw new Error('Character maintenance owner is unavailable.')
      await ctx.db.patch(character._id, { status: 'ACTIVE' })
    })
    await invalidateRoomInputs(fixture.campaign.id, ['CHARACTER'])
    expect(await maintenanceRecords(fixture)).toEqual(replacementStaged)

    const replaced = await executeInRoom(fixture.owner.caller, {
      command: replacementResponse
    })
    const replacementComplete = await maintenanceRecords(fixture)
    if (!beforeReplacement.character || !replacementComplete.character)
      throw new Error('Cleaned Character maintenance source is unavailable.')
    expect(replacementComplete.character.play.streamVersion).toBe(
      beforeReplacement.character.play.streamVersion + 1
    )
    expect(readCharacterRecord(replacementComplete.character).state.hitpoints).toEqual(
      readCharacterRecord(beforeReplacement.character).state.hitpoints
    )
    expect(readCharacterSheetState(replacementComplete.character).resourceUsage).toEqual(
      readCharacterSheetState(beforeReplacement.character).resourceUsage
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
    // The seeded Character dependent is gone (no Character effects remain) and the old Creature
    // dependent is replaced; the owner's single stream advance is asserted above.
    expect(replacementComplete.actorEffects[0]?.id).not.toBe(firstComplete.actorEffects[0]?.id)
    expectLiveCharacterProjection(fixture, replacementComplete, replaced.projection)
    // The room was released while the root was pending (D85/D88), so it no longer holds the root's
    // journaled answer: the replay index answers with the occurrence as it is now, settled.
    await expect(
      executeInRoom(fixture.owner.caller, {
        command: replacementRoot
      })
    ).resolves.toEqual({
      ...replacementIssued,
      occurrence: replaced.occurrence,
      projection: replaced.projection
    })
    await expect(
      executeInRoom(fixture.owner.caller, {
        command: replacementResponse
      })
    ).resolves.toEqual(replaced)
    expect(await maintenanceRecords(fixture)).toEqual(replacementComplete)
  }, 60000)

  it('ends the carried grants a Character’s new Concentration cast on a Character outside the Run, keeping unstamped ones (D99, SPELLS-5.7)', async () => {
    const fixture = await setup(true, 'AUTO_ROLL', { concentration: true })
    const grants = await bystanderWithCarriedGrants(fixture)
    const before = await grants.held()
    expect(before.effectIds.sort()).toEqual([grants.stamped.id, grants.unstamped.id].sort())

    const started = await executeInRoom(fixture.owner.caller, { command: input(fixture) })
    expect(started.occurrence?.status).toBe('COMPLETE')
    await checkpointLiveRoom(fixture.campaign.id)

    const after = await grants.held()
    expect(after.effectIds).toEqual([grants.unstamped.id])
    expect(after.streamVersion).toBe(before.streamVersion! + 1)
    const { run } = await maintenanceRecords(fixture)
    expect(run?.concentrationCasterCharacterIds).toEqual([fixture.character.id])

    // A later checkpoint finds the caster already handled.
    await checkpointLiveRoom(fixture.campaign.id)
    expect(await grants.held()).toEqual(after)
  }, 60000)

  it('ends them although the Concentration was lost before the first checkpoint (D99, SPELLS-5.7)', async () => {
    const fixture = await setup(true, 'AUTO_ROLL', { concentration: true })
    const grants = await bystanderWithCarriedGrants(fixture)
    const paralyzed = srdSystemRecord.conditionTypes.find(({ code }) => code === 'PARALYZED')
    if (!paralyzed) throw new Error('The SRD Paralyzed condition is unavailable.')
    const [character] = await records(fixture)
    if (!character) throw new Error('Missing Character.')

    await executeInRoom(fixture.owner.caller, { command: input(fixture) })
    // The cast moved the Character's stream once in the room; Convex has not seen it yet.
    await executeSheetInRoom(fixture.player.caller, {
      scope: 'CHARACTER_SHEET',
      characterId: fixture.character.id,
      encounterId: fixture.run.id,
      command: {
        type: 'ADD_CONDITION',
        conditionTypeId: paralyzed.id,
        commandId: crypto.randomUUID(),
        expectedVersion: character.play.streamVersion + 1
      }
    })
    await checkpointLiveRoom(fixture.campaign.id)

    const { maintainedStates, run } = await maintenanceRecords(fixture)
    expect(maintainedStates).toEqual([])
    expect(run?.concentrationCasterCharacterIds).toEqual([fixture.character.id])
    expect((await grants.held()).effectIds).toEqual([grants.unstamped.id])
  }, 60000)

  it('keeps the carried grants of a Concentration the GM undid before any checkpoint (D99, SPELLS-5.7)', async () => {
    const fixture = await setup(true, 'AUTO_ROLL', { concentration: true })
    const grants = await bystanderWithCarriedGrants(fixture)
    const before = await grants.held()

    const started = await executeInRoom(fixture.owner.caller, { command: input(fixture) })
    expect(started.occurrence?.status).toBe('COMPLETE')
    const undone = await executeInRoom(fixture.owner.caller, {
      command: {
        type: 'REVERT_LAST_ACTION',
        encounterId: fixture.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version
      }
    })
    expect(undone.projection.version).toBe(started.projection.version + 1)
    await checkpointLiveRoom(fixture.campaign.id)

    expect(await grants.held()).toEqual(before)
    const { maintainedStates, run } = await maintenanceRecords(fixture)
    expect(maintainedStates).toEqual([])
    expect(run?.concentrationCasterCharacterIds).toEqual([])
  }, 60000)

  it('keeps a caster an earlier Concentration already recorded when the GM undoes a later one (D99, SPELLS-5.7)', async () => {
    const fixture = await setup(true, 'AUTO_ROLL', { concentration: true })
    // An earlier, since-ended Concentration of the Character is already on the Run's record.
    await closeRoom(fixture.campaign.id)
    await fixture.t.run(async (ctx) => {
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', fixture.run.id))
        .unique()
      if (!run) throw new Error('Run is unavailable.')
      await ctx.db.patch(run._id, { concentrationCasterCharacterIds: [fixture.character.id] })
    })

    const started = await executeInRoom(fixture.owner.caller, { command: input(fixture) })
    expect(started.occurrence?.status).toBe('COMPLETE')
    await executeInRoom(fixture.owner.caller, {
      command: {
        type: 'REVERT_LAST_ACTION',
        encounterId: fixture.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version
      }
    })
    await checkpointLiveRoom(fixture.campaign.id)

    expect((await maintenanceRecords(fixture)).run?.concentrationCasterCharacterIds).toEqual([
      fixture.character.id
    ])
  }, 60000)

  it('reads the current Character source after a Sheet edit made after Run creation', async () => {
    const fixture = await setup()
    const [created] = await records(fixture)
    if (!created) throw new Error('Missing Character.')
    await fixture.player.caller.mutation(api.characters.sheetCommands.execute, {
      id: fixture.character.id,
      command: {
        type: 'ADJUST_HIT_POINTS',
        mode: 'DAMAGE',
        amount: 1,
        expectedVersion: created.play.streamVersion,
        commandId: crypto.randomUUID()
      }
    })
    const [edited] = await records(fixture)
    if (!edited) throw new Error('Missing edited Character.')
    expect(edited.play.streamVersion).toBe(created.play.streamVersion + 1)
    const result = await executeInRoom(fixture.owner.caller, {
      command: input(fixture)
    })
    const [after] = await records(fixture)
    if (!after) throw new Error('Missing settled Character.')
    expect(after.play.streamVersion).toBe(edited.play.streamVersion + 1)
    expect(readCharacterRecord(after).state.hitpoints.current).toBe(
      readCharacterRecord(edited).state.hitpoints.current - 1
    )
    expect(
      result.projection.actors.find((candidate) => candidate.id === fixture.actor.id)
    ).toMatchObject({
      sourceRevision: null,
      currentHitPoints: readCharacterRecord(after).state.hitpoints.current
    })
  }, 30000)
})
