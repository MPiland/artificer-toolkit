import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { classAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_RULE_STATE_DEFINITIONS,
  SRD_REACTION_ALLOWANCE_DEFINITION_ID
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  srdSystemRecord,
  SRD_ABILITY_DEFINITION_IDS
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  createDnd5eMovementReactionChoiceDefinition,
  createDnd5eOpportunityReactionEligibilityDefinition,
  DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/reactionEligibilityPolicy'
import { importedSubject } from '../../tests/fixtures/publication'
import { sourceImportBatches } from '../content/importBatches'
import { reactionInput } from '../../tests/fixtures/movementReaction'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { api, components, internal } from '../_generated/api'
import { createRulesRuntime } from '../rules/runtime'
import {
  executeNativeMovementReactionAction,
  planNativeMovementReactionAction,
  prepareNativeMovementReactionAction,
  settleNativeMovementReactionAction
} from './actionMovementReactions'
import { discoverNativeMovementReactions } from './movementReactionDiscovery'
import { loadMovementTargets } from './movementTargets'

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
const createCampaign = makeFunctionReference<
  'mutation',
  {
    name: string
    format: 'ONGOING'
    toneTags: ['HEROIC']
    contentMaturity: 'STANDARD'
    gameSystemId: string
    primaryRulesCatalogueId: string
  },
  { id: string; gameSystemId: string; createdAt: string }
>('campaigns/create:create')
const reactionCreature = creatureAuthoredDtoSchema.parse({
  ...wolf,
  id: '00000000-0000-4000-8000-000000000096',
  features: wolf.features?.map((feature) => ({
    ...feature,
    ...(feature.label === 'Bite'
      ? {
          rollDefinitions: [
            {
              id: '00000000-0000-4000-8000-000000000095',
              label: 'Bite attack',
              kind: 'ATTACK' as const,
              expression: { count: 1, die: 20, modifier: 4 },
              rollMode: 'NORMAL' as const,
              chargeCost: null,
              order: 1
            }
          ]
        }
      : {}),
    effects: feature.effects?.map((effect) => ({
      ...effect,
      invocation: {
        ...effect.invocation,
        triggerCode: 'MELEE_WEAPON_ATTACK' as const,
        activation: { code: 'REACTION' as const, amount: 1 },
        reactionMovementTrigger: {
          kind: 'MOVEMENT' as const,
          stage: 'BEFORE_LEAVE_REACH' as const,
          perceptionRequirement: null,
          eligibilityDefinitionId: DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID,
          movementInterruption: null
        }
      },
      paths: effect.paths
        ?.filter(
          (path) =>
            'resultBlock' in path &&
            path.resultBlock.outcomes.some((outcome) => outcome.effectKind === 'DAMAGE')
        )
        .map((path) =>
          'resultBlock' in path
            ? {
                ...path,
                resultBlock: {
                  ...path.resultBlock,
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

async function setup() {
  const base = await setupCharacterRun()
  const definitions = [
    ...SRD_RULE_STATE_DEFINITIONS,
    ...[
      createDnd5eOpportunityReactionEligibilityDefinition(),
      createDnd5eMovementReactionChoiceDefinition()
    ].map((published) => ({
      id: published.id,
      definitionFamilyKey: published.definitionFamilyKey,
      label: 'Native movement reaction fixture',
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
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ ...reactionCreature, subjectKind: 'CREATURE', document: reactionCreature })
    ]
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Sibling reactions',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CREATURE', sourceId: reactionCreature.id },
      { kind: 'CREATURE', sourceId: reactionCreature.id }
    ]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const reactors = run.actors.filter((actor) => actor.kind === 'CREATURE')
  const target = run.actors.find((actor) => actor.kind === 'CHARACTER')
  if (reactors.length !== 2 || !target)
    throw new Error('Sibling reaction fixture actors are unavailable.')
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!row) throw new Error('Sibling reaction Run is unavailable.')
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
  return { ...base, run, reactors, target }
}

async function recordsInContext(
  ctx: Parameters<typeof prepareNativeMovementReactionAction>[0],
  base: Pick<Awaited<ReturnType<typeof setup>>, 'character' | 'run'>
) {
  return {
    character: await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
      .unique(),
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
    characterReceipts: await ctx.db
      .query('characterCommandReceipts')
      .withIndex('by_characterId_commandId', (q) => q.eq('characterId', base.character.id))
      .collect()
  }
}

async function records(base: Pick<Awaited<ReturnType<typeof setup>>, 't' | 'character' | 'run'>) {
  return base.t.run((ctx) => recordsInContext(ctx, base))
}

async function setupMixedResourceSiblings() {
  const chargeId = crypto.randomUUID()
  const bite = reactionCreature.features?.find((feature) => feature.label === 'Bite')
  const effect = structuredClone(bite?.effects?.[0])
  if (!bite || !effect || effect.invocation.kind !== 'ACTION')
    throw new Error('Character reaction source is unavailable.')
  effect.invocation = {
    ...effect.invocation,
    triggerCode: 'SAVING_THROW',
    savingThrow: {
      id: crypto.randomUUID(),
      dcMethod: 'FIXED_DC',
      baseDc: 10,
      abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY
    },
    activation: { code: 'REACTION', amount: 1 },
    targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' },
    resourceUse: { chargeId, cost: 1 },
    reactionMovementTrigger: {
      kind: 'MOVEMENT',
      stage: 'BEFORE_LEAVE_REACH',
      perceptionRequirement: null,
      eligibilityDefinitionId: DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID,
      movementInterruption: null
    }
  }
  effect.paths = effect.paths?.map((path) =>
    'resultBlock' in path
      ? {
          ...path,
          pathCode: 'ON_SAVE_FAIL',
          resultBlock: {
            ...path.resultBlock,
            outcomes: path.resultBlock.outcomes.map((outcome) =>
              outcome.effectKind === 'DAMAGE'
                ? { ...outcome, valueKind: 'FIXED', scalingKind: 'NONE', amount: 1, bonuses: [] }
                : outcome
            )
          }
        }
      : path
  )
  const sourceClass = classAuthoredDtoSchema.parse({
    ...fighter,
    resources: {
      id: crypto.randomUUID(),
      label: 'Reaction use',
      order: 0,
      availableAtLevel: 1,
      charges: {
        id: chargeId,
        resetKind: 'SHORT_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 1
      }
    },
    features: [
      {
        ...structuredClone(bite),
        id: crypto.randomUUID(),
        label: 'Reaction pulse',
        availableAtLevel: 1,
        effects: [effect]
      }
    ]
  })
  const base = await readyCharacterFixture({
    resources: sourceClass.resources,
    features: sourceClass.features
  })
  const { draft, character } = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  const owner = base.other
  await base.t.run(async (ctx) => {
    for (const [index, userId] of [owner.userId, base.owner.userId].entries()) {
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
  const definitions = [
    ...SRD_RULE_STATE_DEFINITIONS,
    ...[
      createDnd5eOpportunityReactionEligibilityDefinition(),
      createDnd5eMovementReactionChoiceDefinition()
    ].map((published) => ({
      id: published.id,
      definitionFamilyKey: published.definitionFamilyKey,
      label: 'Native movement reaction fixture',
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
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ ...reactionCreature, subjectKind: 'CREATURE', document: reactionCreature })
    ]
  })
  const blueprint = await owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Mixed siblings',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CREATURE', sourceId: reactionCreature.id },
      { kind: 'CREATURE', sourceId: reactionCreature.id }
    ]
  })
  const run = await owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const characterReactor = run.actors.find((actor) => actor.kind === 'CHARACTER')
  const [creatureReactor, mover] = run.actors.filter((actor) => actor.kind === 'CREATURE')
  if (!characterReactor || !creatureReactor || !mover)
    throw new Error('Mixed sibling actors are unavailable.')
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!row) throw new Error('Mixed sibling Run is unavailable.')
    const state = encounterRunStateSchema.parse(JSON.parse(row.stateJson))
    const sourceRow = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', run.id).eq('id', creatureReactor.id)
      )
      .unique()
    if (!sourceRow) throw new Error('Mixed sibling source actor is unavailable.')
    // Disposition, not side, makes the Creature reactor hostile to the moving Creature (D17).
    const source = encounterRunActorStateSchema.parse({
      ...JSON.parse(sourceRow.stateJson),
      disposition: 'FRIENDLY'
    })
    await ctx.db.patch(sourceRow._id, {
      stateJson: JSON.stringify(source),
      stateChecksum: checksumCanonicalJson(source)
    })
    const active = encounterRunStateSchema.parse({
      ...state,
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: characterReactor.id
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
    owner,
    campaign,
    character,
    run,
    reactors: [characterReactor, creatureReactor],
    chargeId,
    mover
  }
}

async function settleSiblings(
  ctx: Parameters<typeof prepareNativeMovementReactionAction>[0],
  base: Awaited<ReturnType<typeof setup>>,
  occurrenceId: string,
  commandId: string
) {
  const settled = []
  const planned: Array<{
    prepared: Awaited<ReturnType<typeof prepareNativeMovementReactionAction>>
    execution: Extract<
      Awaited<ReturnType<typeof executeNativeMovementReactionAction>>,
      { kind: 'COMPLETE' }
    >
    plan: ReturnType<typeof planNativeMovementReactionAction>
    occurredAt: string
  }> = []
  const reactorTokenIds = base.reactors.map(() => crypto.randomUUID())
  const movingTokenId = crypto.randomUUID()
  const beforeSettlement = await recordsInContext(ctx, base)
  for (const [ordinal, reactor] of base.reactors.entries()) {
    const seed = reactionInput({
      encounterId: base.run.id,
      expectedEncounterVersion: base.run.version,
      reactorActorId: reactor.id,
      movingActorId: base.target.id,
      occurrenceId
    })
    const input = {
      ...seed,
      movingTokenId,
      actorIdByTokenId: new Map([
        ...base.reactors.map((source, index) => [reactorTokenIds[index]!, source.id] as const),
        [movingTokenId, base.target.id] as const
      ]),
      tokens: [
        ...base.reactors.map((_, index) => ({
          id: reactorTokenIds[index]!,
          position: { x: 50, y: 50 },
          width: 100,
          height: 100
        })),
        { id: movingTokenId, position: { x: 150, y: 50 }, width: 100, height: 100 }
      ]
    }
    const discovered = await discoverNativeMovementReactions(ctx, input)
    const option = discovered.reactionTimeline
      .filter((entry) => entry.kind === 'CONTROLLER_CHOICE')
      .flatMap((entry) => entry.group.options)
      .find((candidate) => candidate.candidate.reactorActorId === reactor.id)
    if (!option) throw new Error('Sibling reaction option is unavailable.')
    const prepared = await prepareNativeMovementReactionAction(
      ctx,
      {
        encounterId: base.run.id,
        expectedEncounterVersion: base.run.version,
        movementKind: input.movementKind,
        occurrenceId,
        option,
        actorIdByTokenId: input.actorIdByTokenId,
        tokens: input.tokens,
        resolvePerception: input.resolvePerception
      },
      planned.at(-1)?.plan.projectedTargets
    )
    const execution = await executeNativeMovementReactionAction(ctx, {
      runtime: await createRulesRuntime(ctx, base.owner.userId),
      occurrenceId,
      autoRoll: {
        [prepared.option.candidate.reactorActorId]: true,
        [prepared.prepared.binding.targetActorId]: true
      },
      prepared,
      random: (maximum) => maximum - 1
    })
    if (execution.kind !== 'COMPLETE') throw new Error('Sibling reaction did not complete.')
    const occurredAt = new Date().toISOString()
    planned.push({
      prepared,
      execution,
      occurredAt,
      plan: planNativeMovementReactionAction(
        { prepared, occurrenceId, commandId, ordinal, occurredAt, execution },
        base.owner.userId
      )
    })
  }
  expect(await recordsInContext(ctx, base)).toEqual(beforeSettlement)
  for (const [ordinal, value] of planned.entries()) {
    const result = await settleNativeMovementReactionAction(ctx, {
      prepared: value.prepared,
      occurrenceId,
      commandId,
      ordinal,
      occurredAt: value.occurredAt,
      execution: value.execution
    })
    expect(result).toEqual({
      application: value.plan.application,
      reactionExecution: value.plan.reactionExecution
    })
    settled.push(result)
  }
  const afterSettlement = await recordsInContext(ctx, base)
  const finalPlan = planned.at(-1)?.plan
  const targetUpdate = finalPlan?.targetPlan.characterUpdate
  const targetActor = afterSettlement.actors.find((actor) => actor.id === base.target.id)
  if (!finalPlan || !targetUpdate || !afterSettlement.character || !targetActor)
    throw new Error('Character target reaction plan is unavailable.')
  expect(JSON.parse(afterSettlement.character.documentJson)).toEqual(targetUpdate.character)
  expect(
    afterSettlement.character.sheetState
      ? JSON.parse(afterSettlement.character.sheetState.documentJson)
      : null
  ).toEqual(targetUpdate.sheetState)
  expect(encounterRunActorStateSchema.parse(JSON.parse(targetActor.stateJson))).toEqual(
    finalPlan.targetPlan.updatedActor
  )
  const currentTarget = (
    await loadMovementTargets(ctx, {
      encounterId: base.run.id,
      expectedEncounterVersion: base.run.version,
      targetActorIds: [base.target.id],
      includeReactionSources: true
    })
  ).get(base.target.id)
  const projectedTarget = finalPlan.projectedTargets.get(base.target.id)
  if (!currentTarget || !projectedTarget)
    throw new Error('Projected Character target is unavailable.')
  expect(projectedTarget.actor).toEqual(currentTarget.actor)
  expect(projectedTarget.state).toEqual(currentTarget.state)
  expect(projectedTarget.characterCurrentness).toEqual(currentTarget.characterCurrentness)
  expect(projectedTarget.characterFacts).toEqual(currentTarget.characterFacts)
  return settled
}

describe('native sibling movement reaction receipts', () => {
  it.each([false, true])(
    'keeps Character resource and sibling outcome receipts atomic (rollback: %s)',
    async (rollback) => {
      const base = await setupMixedResourceSiblings()
      const occurrenceId = crypto.randomUUID()
      const commandId = crypto.randomUUID()
      const before = await records(base)
      const attempt = base.owner.caller.run(async (ctx) => {
        const tokenIds = base.reactors.map(() => crypto.randomUUID())
        const movingTokenId = crypto.randomUUID()
        const result = []
        for (const [ordinal, reactor] of base.reactors.entries()) {
          const seed = reactionInput({
            encounterId: base.run.id,
            expectedEncounterVersion: base.run.version,
            reactorActorId: reactor.id,
            movingActorId: base.mover.id,
            occurrenceId
          })
          const input = {
            ...seed,
            movingTokenId,
            actorIdByTokenId: new Map([
              ...base.reactors.map((source, index) => [tokenIds[index]!, source.id] as const),
              [movingTokenId, base.mover.id] as const
            ]),
            tokens: [
              ...base.reactors.map((_, index) => ({
                id: tokenIds[index]!,
                position: { x: 50, y: 50 },
                width: 100,
                height: 100
              })),
              { id: movingTokenId, position: { x: 150, y: 50 }, width: 100, height: 100 }
            ]
          }
          const discovered = await discoverNativeMovementReactions(ctx, input)
          const option = discovered.reactionTimeline
            .filter((entry) => entry.kind === 'CONTROLLER_CHOICE')
            .flatMap((entry) => entry.group.options)
            .find((candidate) => candidate.candidate.reactorActorId === reactor.id)
          if (!option) throw new Error(`Mixed sibling option ${ordinal} is unavailable.`)
          const prepared = await prepareNativeMovementReactionAction(ctx, {
            encounterId: base.run.id,
            expectedEncounterVersion: base.run.version,
            movementKind: input.movementKind,
            occurrenceId,
            option,
            actorIdByTokenId: input.actorIdByTokenId,
            tokens: input.tokens,
            resolvePerception: input.resolvePerception
          })
          const execution = await executeNativeMovementReactionAction(ctx, {
            runtime: await createRulesRuntime(ctx, base.owner.userId),
            occurrenceId,
            autoRoll: {
              [prepared.option.candidate.reactorActorId]: true,
              [prepared.prepared.binding.targetActorId]: true
            },
            prepared,
            random: (maximum) =>
              prepared.prepared.source.kind === 'CHARACTER_ACTION' ? 0 : maximum - 1
          })
          if (execution.kind !== 'COMPLETE')
            throw new Error('Mixed sibling reaction did not complete.')
          const occurredAt = new Date().toISOString()
          const beforePlan = await recordsInContext(ctx, base)
          const plan = planNativeMovementReactionAction(
            { prepared, occurrenceId, commandId, ordinal, occurredAt, execution },
            base.owner.userId
          )
          expect(await recordsInContext(ctx, base)).toEqual(beforePlan)
          const settled = await settleNativeMovementReactionAction(ctx, {
            prepared,
            occurrenceId,
            commandId,
            ordinal,
            occurredAt,
            execution
          })
          expect(settled).toEqual({
            application: plan.application,
            reactionExecution: plan.reactionExecution
          })
          const afterSettlement = await recordsInContext(ctx, base)
          const settledSource = afterSettlement.actors.find((actor) => actor.id === reactor.id)
          const settledTarget = afterSettlement.actors.find((actor) => actor.id === base.mover.id)
          if (!settledSource || !settledTarget)
            throw new Error('Mixed sibling planned actors are unavailable.')
          expect(encounterRunActorStateSchema.parse(JSON.parse(settledSource.stateJson))).toEqual(
            plan.sourceActor
          )
          expect(encounterRunActorStateSchema.parse(JSON.parse(settledTarget.stateJson))).toEqual(
            plan.targetPlan.updatedActor
          )
          if (prepared.prepared.source.kind === 'CHARACTER_ACTION') {
            const characterUpdate = plan.sourceResourcePlan?.characterUpdate
            if (!characterUpdate || !afterSettlement.character)
              throw new Error('Character resource plan is unavailable.')
            expect(JSON.parse(afterSettlement.character.documentJson)).toEqual(
              characterUpdate.character
            )
            expect(
              afterSettlement.character.sheetState
                ? JSON.parse(afterSettlement.character.sheetState.documentJson)
                : null
            ).toEqual(characterUpdate.sheetState)
          }
          const currentTargets = await loadMovementTargets(ctx, {
            encounterId: base.run.id,
            expectedEncounterVersion: base.run.version,
            targetActorIds: [reactor.id, base.mover.id],
            includeReactionSources: true
          })
          for (const actorId of [reactor.id, base.mover.id]) {
            const current = currentTargets.get(actorId)
            const projected = plan.projectedTargets.get(actorId)
            if (!current || !projected) throw new Error('Projected movement target is unavailable.')
            expect(projected.actor).toEqual(current.actor)
            expect(projected.state).toEqual(current.state)
            expect(projected.targetDerivedFacts).toEqual(current.targetDerivedFacts)
            expect(projected.effectiveRulePolicyOutput).toEqual(current.effectiveRulePolicyOutput)
          }
          result.push(settled)
        }
        if (rollback) throw new Error('late mixed sibling settlement failure')
        return result
      })
      if (rollback) {
        await expect(attempt).rejects.toThrow('late mixed sibling settlement failure')
        expect(await records(base)).toEqual(before)
        return
      }
      const settled = await attempt
      const after = await records(base)
      if (!before.character || !after.character)
        throw new Error('Mixed Character records are unavailable.')
      expect(after.character.streamVersion).toBe(before.character.streamVersion + 1)
      expect(after.characterReceipts).toEqual(before.characterReceipts)
      if (!after.character.sheetState) throw new Error('Missing Character resource state.')
      expect(JSON.parse(after.character.sheetState.documentJson).resourceUsage).toEqual([
        expect.objectContaining({ used: 1 })
      ])
      expect(after.run).toEqual(before.run)
      expect(after.occurrences).toEqual(before.occurrences)
      expect(after.receipts).toEqual(before.receipts)
      expect(settled.map((value) => value.reactionExecution.ordinal)).toEqual([0, 1])
      expect(settled[0]!.reactionExecution.application).toMatchObject({
        kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
        sourceCharacterStreamVersion: before.character.streamVersion + 1,
        resourceConsumption: { chargeId: base.chargeId, beforeRemaining: 1, afterRemaining: 0 }
      })
      expect(settled[1]!.reactionExecution.application).toMatchObject({
        kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
      })
      for (const reaction of settled) {
        expect(reaction.reactionExecution.sourceCommandId).toBe(commandId)
        expect(reaction.reactionExecution.allowance).toMatchObject({ beforeUsed: 0, afterUsed: 1 })
        if (reaction.reactionExecution.application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
          throw new Error('Mixed sibling target mechanics are unavailable.')
        expect(reaction.reactionExecution.application.applications).toEqual([
          expect.objectContaining({ kind: 'DAMAGE', appliedAmount: 1 })
        ])
      }
      for (const reactor of base.reactors) {
        const row = after.actors.find((actor) => actor.id === reactor.id)
        if (!row) throw new Error('Mixed sibling reactor is unavailable.')
        const state = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
        expect(state.resources).toMatchObject({
          ruleUsage: { [SRD_REACTION_ALLOWANCE_DEFINITION_ID]: 1 }
        })
      }
      const beforeMover = before.actors.find((actor) => actor.id === base.mover.id)
      const afterMover = after.actors.find((actor) => actor.id === base.mover.id)
      if (!beforeMover || !afterMover) throw new Error('Missing sibling target state.')
      expect(JSON.parse(afterMover.stateJson).currentHitPoints).toBe(
        JSON.parse(beforeMover.stateJson).currentHitPoints - 2
      )
    },
    60000
  )

  it('chains Character and Creature plans before either settlement', async () => {
    const base = await setupMixedResourceSiblings()
    const occurrenceId = crypto.randomUUID()
    const commandId = crypto.randomUUID()
    const before = await records(base)
    const settled = await base.owner.caller.run(async (ctx) => {
      const tokenIds = base.reactors.map(() => crypto.randomUUID())
      const movingTokenId = crypto.randomUUID()
      const seed = reactionInput({
        encounterId: base.run.id,
        expectedEncounterVersion: base.run.version,
        reactorActorId: base.reactors[0]!.id,
        movingActorId: base.mover.id,
        occurrenceId
      })
      const input = {
        ...seed,
        movingTokenId,
        actorIdByTokenId: new Map([
          ...base.reactors.map((source, index) => [tokenIds[index]!, source.id] as const),
          [movingTokenId, base.mover.id] as const
        ]),
        tokens: [
          ...base.reactors.map((_, index) => ({
            id: tokenIds[index]!,
            position: { x: 50, y: 50 },
            width: 100,
            height: 100
          })),
          { id: movingTokenId, position: { x: 150, y: 50 }, width: 100, height: 100 }
        ]
      }
      const discovered = await discoverNativeMovementReactions(ctx, input)
      const planned: Array<{
        prepared: Awaited<ReturnType<typeof prepareNativeMovementReactionAction>>
        execution: Extract<
          Awaited<ReturnType<typeof executeNativeMovementReactionAction>>,
          { kind: 'COMPLETE' }
        >
        plan: ReturnType<typeof planNativeMovementReactionAction>
        occurredAt: string
      }> = []
      for (const [ordinal, reactor] of base.reactors.entries()) {
        const option = discovered.reactionTimeline
          .filter((entry) => entry.kind === 'CONTROLLER_CHOICE')
          .flatMap((entry) => entry.group.options)
          .find((candidate) => candidate.candidate.reactorActorId === reactor.id)
        if (!option) throw new Error(`Mixed sibling option ${ordinal} is unavailable.`)
        const prepared = await prepareNativeMovementReactionAction(
          ctx,
          {
            encounterId: base.run.id,
            expectedEncounterVersion: base.run.version,
            movementKind: input.movementKind,
            occurrenceId,
            option,
            actorIdByTokenId: input.actorIdByTokenId,
            tokens: input.tokens,
            resolvePerception: input.resolvePerception
          },
          planned.at(-1)?.plan.projectedTargets
        )
        const execution = await executeNativeMovementReactionAction(ctx, {
          runtime: await createRulesRuntime(ctx, base.owner.userId),
          occurrenceId,
          autoRoll: {
            [prepared.option.candidate.reactorActorId]: true,
            [prepared.prepared.binding.targetActorId]: true
          },
          prepared,
          random: (maximum) =>
            prepared.prepared.source.kind === 'CHARACTER_ACTION' ? 0 : maximum - 1
        })
        if (execution.kind !== 'COMPLETE')
          throw new Error('Mixed sibling reaction did not complete.')
        const occurredAt = new Date().toISOString()
        planned.push({
          prepared,
          execution,
          occurredAt,
          plan: planNativeMovementReactionAction(
            { prepared, occurrenceId, commandId, ordinal, occurredAt, execution },
            base.owner.userId
          )
        })
      }
      expect(await recordsInContext(ctx, base)).toEqual(before)
      const results = []
      for (const [ordinal, value] of planned.entries()) {
        const result = await settleNativeMovementReactionAction(ctx, {
          prepared: value.prepared,
          occurrenceId,
          commandId,
          ordinal,
          occurredAt: value.occurredAt,
          execution: value.execution
        })
        expect(result).toEqual({
          application: value.plan.application,
          reactionExecution: value.plan.reactionExecution
        })
        results.push(result)
      }
      const currentTargets = await loadMovementTargets(ctx, {
        encounterId: base.run.id,
        expectedEncounterVersion: base.run.version,
        targetActorIds: [...base.reactors.map((actor) => actor.id), base.mover.id],
        includeReactionSources: true
      })
      const finalPlan = planned.at(-1)?.plan
      if (!finalPlan) throw new Error('Sibling reaction plans are unavailable.')
      for (const actorId of [base.reactors[1]!.id, base.mover.id]) {
        const current = currentTargets.get(actorId)
        const projected = finalPlan.projectedTargets.get(actorId)
        if (!current || !projected) throw new Error('Projected movement target is unavailable.')
        expect(projected.actor).toEqual(current.actor)
        expect(projected.state).toEqual(current.state)
        expect(projected.targetDerivedFacts).toEqual(current.targetDerivedFacts)
      }
      return results
    })
    const after = await records(base)
    if (!before.character || !after.character)
      throw new Error('Mixed Character records are unavailable.')
    expect(settled).toHaveLength(2)
    expect(after.character.streamVersion).toBe(before.character.streamVersion + 1)
    expect(after.character.sheetState).toEqual(
      expect.objectContaining({ documentJson: expect.any(String) })
    )
  }, 60000)

  it('settles sibling Character target events under one root without publishing the parent Run', async () => {
    const base = await setup()
    const before = await records(base)
    const occurrenceId = crypto.randomUUID()
    const commandId = crypto.randomUUID()
    const settled = await base.owner.caller.run((ctx) =>
      settleSiblings(ctx, base, occurrenceId, commandId)
    )
    const after = await records(base)
    if (!before.character || !after.character)
      throw new Error('Sibling Character records are unavailable.')
    expect(after.character.streamVersion).toBe(before.character.streamVersion + 2)
    expect(after.characterReceipts).toHaveLength(before.characterReceipts.length + 2)
    expect(after.run).toEqual(before.run)
    expect(after.occurrences).toEqual(before.occurrences)
    expect(after.receipts).toEqual(before.receipts)
    expect(settled.map((value) => value.reactionExecution.ordinal)).toEqual([0, 1])
    expect(settled.map((value) => value.reactionExecution.sourceCommandId)).toEqual([
      commandId,
      commandId
    ])
    expect(settled.map((value) => value.reactionExecution.allowance)).toEqual([
      {
        definitionId: SRD_REACTION_ALLOWANCE_DEFINITION_ID,
        maximum: 1,
        beforeUsed: 0,
        afterUsed: 1
      },
      {
        definitionId: SRD_REACTION_ALLOWANCE_DEFINITION_ID,
        maximum: 1,
        beforeUsed: 0,
        afterUsed: 1
      }
    ])
    for (const reactor of base.reactors) {
      const row = after.actors.find((actor) => actor.id === reactor.id)
      if (!row) throw new Error('Settled sibling reactor is unavailable.')
      expect(encounterRunActorStateSchema.parse(JSON.parse(row.stateJson)).resources).toMatchObject(
        { ruleUsage: { [SRD_REACTION_ALLOWANCE_DEFINITION_ID]: 1 } }
      )
    }
    const targetStreamVersions = settled.map(({ reactionExecution }, ordinal) => {
      if (reactionExecution.application.kind !== 'CHARACTER_MECHANICS_BATCH')
        throw new Error('Sibling reaction did not persist a Character target event.')
      const eventCommandId = deriveEncounterCharacterMechanicsEventCommandId({
        occurrenceId,
        sourceCommandId: commandId,
        phase: 'MOVEMENT_REACTION_OUTCOME',
        ordinal,
        targetCharacterId: base.character.id
      })
      const receipt = after.characterReceipts.find((value) => value.commandId === eventCommandId)
      expect(receipt).toMatchObject({
        characterId: base.character.id,
        commandFingerprint: checksumRuleDocument({
          encounterId: base.run.id,
          occurrenceId,
          sourceCommandId: commandId,
          targetActorId: base.target.id,
          applications: reactionExecution.application.applications
        })
      })
      expect(reactionExecution.application.applications).toEqual([
        expect.objectContaining({ kind: 'DAMAGE', appliedAmount: 1 })
      ])
      return reactionExecution.application.targetCharacterStreamVersion
    })
    expect(targetStreamVersions).toEqual([
      before.character.streamVersion + 1,
      before.character.streamVersion + 2
    ])
    const beforeDocument = JSON.parse(before.character.documentJson)
    const afterDocument = JSON.parse(after.character.documentJson)
    expect(afterDocument.state.hitpoints.current).toBe(beforeDocument.state.hitpoints.current - 2)
    const beforeTarget = before.actors.find((actor) => actor.id === base.target.id)
    const afterTarget = after.actors.find((actor) => actor.id === base.target.id)
    if (!beforeTarget || !afterTarget) throw new Error('Persisted Character target is unavailable.')
    expect(afterTarget.stateJson).toBe(beforeTarget.stateJson)
  }, 60000)

  it('rolls both sibling settlements and Character streams back when the enclosing transaction fails', async () => {
    const base = await setup()
    const before = await records(base)
    await expect(
      base.owner.caller.run(async (ctx) => {
        await settleSiblings(ctx, base, crypto.randomUUID(), crypto.randomUUID())
        throw new Error('late sibling settlement failure')
      })
    ).rejects.toThrow('late sibling settlement failure')
    expect(await records(base)).toEqual(before)
  }, 60000)
})
