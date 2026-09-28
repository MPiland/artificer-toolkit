// @vitest-environment node
import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { withEncounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import {
  createDnd5eMovementReactionChoiceDefinition,
  createDnd5eMovementReactionEligibilityDefinition
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/reactionEligibilityPolicy'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import {
  SRD_REACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { createEncounterLifecyclePolicyFixture } from '../../tests/fixtures/encounterInitiative'
import {
  setupReactionMovementScene,
  useMovementReactions
} from '../../tests/fixtures/automaticSceneMovement'
import { importedSubject } from '../../tests/fixtures/publication'
import { maintenanceDefinitionFixture } from '../../tests/fixtures/maintenanceDefinition'
import { api, internal } from '../_generated/api'
import { sourceImportBatches } from '../content/importBatches'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: (sides: number) => (sides === 20 ? 14 : 0) }))

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

async function setup() {
  const base = await setupCharacterRun()
  const detachedDraft = await base.createCharacter()
  await base.player.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: detachedDraft.draft.id,
    mode: 'create',
    character: detachedDraft.character
  })
  const policies = createEncounterLifecyclePolicyFixture(base.owner.userId)
  const maintenanceDefinitionId = policies.scenarios[0]?.definitionId
  if (!maintenanceDefinitionId) throw new Error('Missing maintenance definition.')
  const maintenanceDefinition = maintenanceDefinitionFixture({ id: maintenanceDefinitionId })
  await base.t.mutation(internal.content.import.bootstrap, policies.bootstrap)
  await base.t.mutation(internal.content.import.importDefinitions, {
    ...policies.imported,
    definitions: policies.imported.definitions.map((definition) =>
      definition.id === maintenanceDefinitionId ? maintenanceDefinition : definition
    )
  })

  const eligibilityDefinitions = [0, 1].map(() => {
    const id = crypto.randomUUID()
    const published = createDnd5eMovementReactionEligibilityDefinition({
      definitionId: id,
      stage: 'BEFORE_LEAVE_REACH'
    })
    const definition = structuredClone(published.definition)
    const outputs = { ...definition.outputs }
    delete outputs.choiceDefinitionId
    outputs.selectionPolicy = { kind: 'LITERAL' as const, value: 'AUTOMATIC' }
    definition.outputs = outputs
    return { ...published, id, definition: { ...definition, id } }
  })
  const choice = createDnd5eMovementReactionChoiceDefinition()
  for (const batch of sourceImportBatches([
    ...SRD_RULE_STATE_DEFINITIONS,
    ...[...eligibilityDefinitions, choice].map((entry) => ({
      id: entry.id,
      definitionFamilyKey: entry.definitionFamilyKey,
      label: 'Maintained Character movement reaction',
      description: 'Fixture',
      document: entry.definition,
      checksum: checksumRuleDocument(entry.definition)
    }))
  ]))
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: batch
    })

  const creatures = eligibilityDefinitions.map((eligibility) => {
    const document = creatureAuthoredDtoSchema.parse({
      ...wolf,
      id: crypto.randomUUID(),
      features: wolf.features?.map((feature) => ({
        ...feature,
        effects: feature.effects?.map((effect) => ({
          ...effect,
          invocation: {
            ...effect.invocation,
            triggerCode: 'SAVING_THROW' as const,
            activation: { code: 'REACTION' as const, amount: 1 },
            savingThrow: {
              id: crypto.randomUUID(),
              dcMethod: 'FIXED_DC' as const,
              baseDc: 30,
              abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY
            },
            reactionMovementTrigger: {
              kind: 'MOVEMENT' as const,
              stage: 'BEFORE_LEAVE_REACH' as const,
              perceptionRequirement: null,
              eligibilityDefinitionId: eligibility.id,
              movementInterruption: null
            }
          },
          paths: effect.paths
            ?.filter(
              (path) =>
                'resultBlock' in path &&
                path.resultBlock.outcomes.some((outcome) => outcome.effectKind === 'DAMAGE')
            )
            .slice(0, 1)
            .map((path) =>
              'resultBlock' in path
                ? {
                    ...path,
                    pathCode: 'ON_SAVE_FAIL' as const,
                    resultBlock: {
                      ...path.resultBlock,
                      id: crypto.randomUUID(),
                      maintenanceDefinitionId,
                      duration: {
                        id: crypto.randomUUID(),
                        durationKind: 'ROUND' as const,
                        amount: 3
                      },
                      lifecycle: { recurringKind: 'START_OF_TURN' as const },
                      outcomes: path.resultBlock.outcomes.map((outcome) =>
                        outcome.effectKind === 'DAMAGE'
                          ? {
                              ...outcome,
                              valueKind: 'FIXED' as const,
                              scalingKind: 'NONE' as const,
                              bonuses: [],
                              amount: 1
                            }
                          : outcome
                      )
                    }
                  }
                : path
            )
        }))
      }))
    })
    return document
  })
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: creatures.map((document) =>
      importedSubject({ ...document, subjectKind: 'CREATURE', document })
    )
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Maintained Character movement',
    commandId: crypto.randomUUID(),
    enemies: creatures.map((creature) => ({ kind: 'CREATURE' as const, sourceId: creature.id }))
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const mover = run.actors.find((actor) => actor.kind === 'CHARACTER')
  const reactors = creatures.map((creature) =>
    run.actors.find((actor) => actor.kind === 'CREATURE' && actor.sourceId === creature.id)
  )
  if (!mover || reactors.some((actor) => !actor)) throw new Error('Missing movement actors.')
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!row) throw new Error('Missing movement Run.')
    const state = encounterRunStateSchema.parse(JSON.parse(row.stateJson))
    const active = encounterRunStateSchema.parse({
      ...state,
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: reactors[0]!.id
    })
    const projection = encounterGmProjectionDtoSchema.parse({
      ...JSON.parse(row.projectionJson),
      status: 'ACTIVE'
    })
    await ctx.db.patch(row._id, {
      status: 'ACTIVE',
      stateJson: JSON.stringify(active),
      stateChecksum: checksumCanonicalJson(active),
      projectionJson: JSON.stringify(projection),
      projectionChecksum: checksumCanonicalJson(projection)
    })
  })
  return {
    ...base,
    run,
    mover,
    reactors: reactors as [
      NonNullable<(typeof reactors)[number]>,
      NonNullable<(typeof reactors)[number]>
    ],
    detached: detachedDraft.character,
    maintenanceDefinitionId
  }
}

async function resetAndDetachScene(value: Awaited<ReturnType<typeof setup>>) {
  return value.t.run(async (ctx) => {
    for (const reactor of value.reactors) {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', value.run.id).eq('id', reactor.id)
        )
        .unique()
      if (!row) throw new Error('Missing reactor.')
      const actor = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
      const available = encounterRunActorStateSchema.parse({
        ...actor,
        resources: withEncounterRuleUsageUsed(actor, SRD_REACTION_ALLOWANCE_DEFINITION_ID, 0)
      })
      await ctx.db.patch(row._id, {
        stateJson: JSON.stringify(available),
        stateChecksum: checksumCanonicalJson(available)
      })
    }
    for (const row of await ctx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_actorId', (q) => q.eq('encounterId', value.run.id))
      .collect())
      await ctx.db.delete(row._id)
    const binding = await ctx.db
      .query('encounterSceneBindings')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', value.run.id))
      .unique()
    if (binding) await ctx.db.delete(binding._id)
    for (const row of await ctx.db
      .query('campaignScenePresentations')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', value.campaign.id))
      .collect())
      await ctx.db.delete(row._id)
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', value.run.id))
      .unique()
    if (!run) throw new Error('Missing reset Run.')
    return encounterGmProjectionDtoSchema.parse(JSON.parse(run.projectionJson))
  })
}

async function snapshot(value: Awaited<ReturnType<typeof setup>>) {
  return value.t.run(async (ctx) => ({
    characters: await ctx.db.query('characters').collect(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.run.id))
      .collect(),
    states: await ctx.db
      .query('encounterMaintainedEffectStates')
      .withIndex('by_encounter_owner_definition_order', (q) => q.eq('encounterId', value.run.id))
      .collect(),
    actorEffects: await ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_encounterId_targetActorId_id', (q) => q.eq('encounterId', value.run.id))
      .collect(),
    characterEffects: await ctx.db.query('characterActiveRuleEffects').collect(),
    characterReceipts: await ctx.db.query('characterCommandReceipts').collect(),
    receipts: await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', value.run.id))
      .collect(),
    commands: await ctx.db.query('sceneLiveCommands').collect(),
    scenes: await ctx.db.query('sceneLiveStates').collect()
  }))
}

it('settles present and detached Character maintenance once per used automatic contact', async () => {
  const value = await setup()
  const firstScene = await setupReactionMovementScene(
    value,
    [value.reactors[0], value.mover, value.reactors[1]],
    [50, 1000]
  )
  await (await useMovementReactions(firstScene)).publish()
  const blinded = srdSystemRecord.conditionTypes.find((condition) => condition.code === 'BLINDED')!
  const poisoned = srdSystemRecord.conditionTypes.find(
    (condition) => condition.code === 'POISONED'
  )!
  const seeded = await value.t.run(async (ctx) => {
    const store = createActiveRuleEffectStore(ctx)
    const states = await store.listMaintainedStatesByOwner({
      encounterId: value.run.id,
      ownerActorId: value.reactors[0].id
    })
    const state = states[0]
    if (!state) throw new Error('Missing created maintained state.')
    const dependents = await store.listDependentEffects({
      encounterId: value.run.id,
      stateId: state.id
    })
    const template = dependents[0]
    if (!template) throw new Error('Missing created maintained dependent.')
    const definition = {
      ...template.definition,
      schemaVersion: 2 as const,
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP' as const, conditionId: blinded.id, baselinePresent: false },
        { kind: 'CONDITION_OWNERSHIP' as const, conditionId: poisoned.id, baselinePresent: false }
      ]
    }
    const removedIds: string[] = dependents.map((effect) => effect.id)
    const independentIds: string[] = []
    for (const characterId of [value.character.id, value.detached.id]) {
      const dependent = await store.create({
        id: crypto.randomUUID(),
        owner: { kind: 'CHARACTER', characterId },
        definition,
        lifecycle: template.lifecycle,
        maintainedEffectStateId: state.id
      })
      removedIds.push(dependent.id)
      const independent = await store.create({
        id: crypto.randomUUID(),
        owner: { kind: 'CHARACTER', characterId },
        definition: {
          ...definition,
          stateContributions: [
            {
              kind: 'CONDITION_OWNERSHIP' as const,
              conditionId: poisoned.id,
              baselinePresent: false
            }
          ]
        },
        lifecycle: template.lifecycle
      })
      independentIds.push(independent.id)
      const row = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', characterId))
        .unique()
      if (!row) throw new Error('Missing Character owner.')
      const character = characterAuthoredDtoSchema.parse(JSON.parse(row.documentJson))
      const updated = {
        ...character,
        state: {
          ...character.state,
          conditions: [{ conditionTypeId: blinded.id }, { conditionTypeId: poisoned.id }]
        }
      }
      await ctx.db.patch(row._id, {
        documentJson: canonicalizeRuleDocument(updated),
        checksum: checksumRuleDocument(updated)
      })
    }
    return { removedIds, independentIds }
  })
  const projection = await resetAndDetachScene(value)
  const next = await setupReactionMovementScene(
    { ...value, run: projection },
    [value.reactors[0], value.mover, value.reactors[1]],
    [50, 250],
    [
      { x: 150, y: 50 },
      { x: 700, y: 50 }
    ]
  )
  const origin = await snapshot(value)
  const presentBefore = origin.characters.find((row) => row.id === value.character.id)!
  const detachedBefore = origin.characters.find((row) => row.id === value.detached.id)!
  // Assisted play offers both authored automatic reactions as Use/Decline. The GM uses them, so the
  // first reaction publishes at the second choice and the totals below span both publications.
  const used = await useMovementReactions(next)
  const before = await snapshot(value)
  const prepared = used.prepared
  expect(prepared.outcome.kind).toBe('TERMINAL')
  if (prepared.outcome.kind !== 'TERMINAL') throw new Error('Expected terminal preparation.')
  expect(prepared.outcome.result.reactionExecutions).toHaveLength(2)
  const executions = [...prepared.outcome.result.reactionExecutions].sort(
    (left, right) => left.ordinal - right.ordinal
  )
  expect(executions.map((execution) => execution.option.candidate.movingActorId)).toEqual([
    value.mover.id,
    value.mover.id
  ])
  expect(executions[0]!.ordinal).toBeLessThan(executions[1]!.ordinal)
  expect(await snapshot(value)).toEqual(before)
  const published = await used.publish()
  const after = await snapshot(value)
  const presentAfter = after.characters.find((row) => row.id === value.character.id)!
  const detachedAfter = after.characters.find((row) => row.id === value.detached.id)!
  expect.soft(presentAfter.streamVersion).toBe(presentBefore.streamVersion + 2)
  expect.soft(detachedAfter.streamVersion).toBe(detachedBefore.streamVersion + 1)
  const finalEffectIds = after.characterEffects.map((effect) => effect.id)
  expect(finalEffectIds.filter((id) => seeded.removedIds.includes(id))).toEqual([])
  expect(finalEffectIds).toEqual(expect.arrayContaining(seeded.independentIds))
  expect(executions.flatMap((execution) => execution.characterTransitions)).toEqual(
    expect.arrayContaining([
      {
        characterId: value.character.id,
        beforeStreamVersion: presentBefore.streamVersion,
        afterStreamVersion: presentBefore.streamVersion + 1
      },
      {
        characterId: value.character.id,
        beforeStreamVersion: presentBefore.streamVersion + 1,
        afterStreamVersion: presentBefore.streamVersion + 2
      },
      {
        characterId: value.detached.id,
        beforeStreamVersion: detachedBefore.streamVersion,
        afterStreamVersion: detachedBefore.streamVersion + 1
      }
    ])
  )
  for (const execution of executions) {
    if (
      execution.application.kind !== 'CHARACTER_MECHANICS_BATCH' &&
      execution.application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
    )
      throw new Error('Expected Character movement mechanics.')
    const damage = execution.application.applications.find(
      (application) => application.kind === 'DAMAGE'
    )
    if (!damage) throw new Error('Expected maintained movement damage.')
    expect(damage.beforeCurrentHitPoints - damage.afterCurrentHitPoints).toBe(1)
  }
  for (const row of [presentAfter, detachedAfter]) {
    const character = characterAuthoredDtoSchema.parse(JSON.parse(row.documentJson))
    expect(character.state.conditions?.map((condition) => condition.conditionTypeId)).toEqual([
      poisoned.id
    ])
  }
  expect(
    characterAuthoredDtoSchema.parse(JSON.parse(presentAfter.documentJson)).state.hitpoints.current
  ).toBe(
    characterAuthoredDtoSchema.parse(JSON.parse(presentBefore.documentJson)).state.hitpoints
      .current - 2
  )
  const actor = after.actors.find((row) => row.id === value.mover.id)!
  const actorState = encounterRunActorStateSchema.parse(JSON.parse(actor.stateJson))
  expect(actorState).toMatchObject({ kind: 'CHARACTER', sourceId: value.character.id })
  expect(actorState).not.toHaveProperty('conditions')
  const receipt = after.receipts.find((row) => row.commandId === used.responseCommandId)
  expect(receipt && JSON.parse(receipt.resultJson)).toEqual(prepared.outcome.result)
  expect(after.characterReceipts.length - origin.characterReceipts.length).toBe(2)
  expect(await used.publish()).toEqual({
    ...published,
    replayed: true
  })
  expect(await snapshot(value)).toEqual(after)
}, 60_000)
