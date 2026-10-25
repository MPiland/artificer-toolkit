import { createConvexEncounterStore } from '../../convex/lib/convexEncounterStore'
import { makeFunctionReference } from 'convex/server'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignPlaySettingsDto,
  SaveCampaignPlaySettingsInput
} from '@artificer-toolkit/schema/api/campaignSettings'
import {
  encounterGmProjectionDtoSchema,
  type CreateEncounterBlueprintInputDto,
  type CreateEncounterInputDto,
  type EncounterBlueprintDto,
  type EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import { checksumRuleDocument, type RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY,
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_TEST_OUTCOME_RULE_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/effectActionContracts'
import { DND5E_SAVE_TEST_OPERATION_KEY } from '@artificer-toolkit/rules-runtime/systems/dnd5e/dnd5eTestOperationKeys'
import {
  createDnd5eRechargeDefinition,
  createDnd5eRechargeLifecycleDefinition
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/encounterLifecyclePolicy'
import { fixture } from './characters'
import { equipAllCharacterItems, setupCharacterRun } from './encounterCharacter'
import {
  automaticChargedBiteFeatureId,
  automaticChargedCreature,
  automaticChargedCreatureId
} from './encounterAction'
import { createEncounterInitiativeDefinitions } from './encounterInitiative'
import { importedSubject, importSeededSubjects } from './publication'
import { components, internal } from '../../convex/_generated/api'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { createRulesRuntime } from './rulesRuntime'
import { setAutoRollDice, type FixtureRolls } from './rollPreferences'
import { attachFixtureRoom, executeInRoom } from './localRoomWorker'
import {
  dnd5eAddedDiceFacts,
  dnd5eAddedDiceNode
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/d20AddedDiceGraph'

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
const getSettings = makeFunctionReference<'query', { campaignId: string }, CampaignPlaySettingsDto>(
  'campaigns/playSettings:get'
)
const saveSettings = makeFunctionReference<
  'mutation',
  SaveCampaignPlaySettingsInput,
  CampaignPlaySettingsDto
>('campaigns/playSettings:save')

export async function turnActiveEffectFixture(
  rolls: FixtureRolls,
  procedure: 'ACTOR_ROLL' | 'DECLARED_ACTION_ROLL' = 'ACTOR_ROLL'
) {
  const base = await fixture()
  await setAutoRollDice(base.t, base.owner.userId, rolls === 'AUTO_ROLL')
  await base.t.run(async (ctx) => {
    for (const [index, userId] of [base.owner.userId, base.other.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing turn-effect fixture profile.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: `draft_123456abcde${index}@example.invalid` }
        }
      })
    }
  })
  const initiative = createEncounterInitiativeDefinitions([{ procedure, cadence: 'EACH_ROUND' }])
  const recharge = createDnd5eRechargeDefinition(5)
  const lifecycle = createDnd5eRechargeLifecycleDefinition(5)
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: [
      ...initiative.definitions,
      {
        id: recharge.id,
        definitionFamilyKey: recharge.definitionFamilyKey,
        label: 'Turn Recharge',
        description: 'Turn Recharge',
        document: recharge.definition,
        checksum: recharge.checksum
      },
      {
        id: lifecycle.id,
        definitionFamilyKey: 'dnd5e-encounter-lifecycle',
        label: 'Turn Recharge lifecycle',
        description: 'Turn Recharge lifecycle',
        document: lifecycle,
        checksum: checksumRuleDocument(lifecycle)
      }
    ]
  })
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({
        ...automaticChargedCreature,
        subjectKind: 'CREATURE',
        document: {
          ...automaticChargedCreature,
          features: automaticChargedCreature.features?.map((feature) =>
            feature.id === automaticChargedBiteFeatureId
              ? { ...feature, ruleDefinitionIds: [lifecycle.id] }
              : feature
          )
        }
      })
    ]
  })
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Encounter execution fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const settings = await base.owner.caller.query(getSettings, {
    campaignId: campaign.id
  })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await base.owner.caller.mutation(saveSettings, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId: initiative.policyIds[0]!,
    initiativeTieDefinitionId: null
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
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Turn active effects',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CREATURE', sourceId: automaticChargedCreatureId }]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  return { ...base, campaign, run }
}

export async function turnCharacterEffectFixture() {
  const base = await setupCharacterRun()
  await equipAllCharacterItems(base)
  const initiative = createEncounterInitiativeDefinitions([
    { procedure: 'DECLARED_ACTION_ROLL', cadence: 'ENCOUNTER_START' }
  ])
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: initiative.definitions
  })
  const settings = await base.owner.caller.query(getSettings, { campaignId: base.campaign.id })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await base.owner.caller.mutation(saveSettings, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId: initiative.policyIds[0]!,
    initiativeTieDefinitionId: null
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Player declaration effect privacy',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CUSTOM', label: 'Required fixture opponent', maxHitPoints: 3 }]
  })
  const created = await base.owner.caller.mutation(createRun, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const opponent = created.actors.find((actor) => actor.kind === 'CUSTOM')
  if (!opponent) throw new Error('Expected the fixture opponent.')
  await attachFixtureRoom(base.t, base.campaign.id)
  const removed = await executeInRoom(base.owner.caller, {
    command: {
      type: 'REMOVE_ACTOR',
      encounterId: created.id,
      commandId: crypto.randomUUID(),
      expectedVersion: created.version,
      actorId: opponent.id
    }
  })
  return { ...base, run: encounterGmProjectionDtoSchema.parse(removed.projection) }
}

export async function seedTurnSaveEffect(
  base: Awaited<ReturnType<typeof turnActiveEffectFixture>>,
  input: {
    stage: 'START_OF_TURN' | 'END_OF_TURN'
    ticks: number
    damage: number
  }
) {
  const definitionId = crypto.randomUUID()
  const entryId = crypto.randomUUID()
  const occurrenceId = crypto.randomUUID()
  const actor = base.run.actors[0]!
  const graph = {
    schemaVersion: 1,
    id: definitionId,
    gameSystemId: srdSystemRecord.id,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      {
        id: 'd20',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: {
          min: { kind: 'LITERAL', value: 1 },
          max: { kind: 'LITERAL', value: 20 }
        }
      },
      dnd5eAddedDiceNode('d20'),
      {
        id: 'test',
        operation: { key: DND5E_SAVE_TEST_OPERATION_KEY, contractVersion: 3 },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
          addedTotal: { kind: 'NODE_OUTPUT', nodeId: 'd20-added-dice', port: 'value' },
          modifier: { kind: 'FACT', factKey: DND5E_SAVE_MODIFIER_FACT_KEY },
          threshold: { kind: 'FACT', factKey: DND5E_SAVE_DC_FACT_KEY },
          contributorChecksum: {
            kind: 'FACT',
            factKey: DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY
          },
          outcomeRule: { kind: 'FACT', factKey: DND5E_TEST_OUTCOME_RULE_FACT_KEY }
        }
      },
      {
        id: 'proposal-on_save_fail',
        operation: {
          key: DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY,
          contractVersion: 1
        },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          resolvedPath: {
            kind: 'NODE_OUTPUT',
            nodeId: 'test',
            port: 'resultPath'
          },
          authoredPath: { kind: 'LITERAL', value: 'ON_SAVE_FAIL' },
          targetStateChecksum: {
            kind: 'FACT',
            factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY
          },
          amount: { kind: 'LITERAL', value: input.damage },
          damageTypeId: { kind: 'LITERAL', value: crypto.randomUUID() }
        }
      }
    ],
    outputs: {
      targetActorId: {
        kind: 'NODE_OUTPUT',
        nodeId: 'test',
        port: 'targetActorId'
      },
      naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'naturalD20' },
      total: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'total' },
      resultPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
      contributorChecksum: {
        kind: 'NODE_OUTPUT',
        nodeId: 'test',
        port: 'contributorChecksum'
      }
    },
    sourceEntryBindings: [{ sourceEntryId: entryId, nodeId: 'proposal-on_save_fail' }]
  } satisfies RuleGraphDefinition
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: [
      {
        id: graph.id,
        definitionFamilyKey: graph.definitionFamilyKey,
        label: 'Turn saving throw damage',
        description: 'Turn saving throw damage',
        document: graph,
        checksum: checksumRuleDocument(graph)
      }
    ]
  })
  return base.t.run(async (ctx) => {
    const runtime = createRulesRuntime(ctx, base.owner.userId)
    const prepared = await runtime.executeResolvedWithGraph?.({
      command: {
        definitionId,
        occurrenceId,
        facts: {
          [DND5E_TARGET_ACTOR_FACT_KEY]: actor.id,
          [DND5E_SAVE_MODIFIER_FACT_KEY]: 0,
          ...dnd5eAddedDiceFacts([]),
          [DND5E_SAVE_DC_FACT_KEY]: 30,
          [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: checksumRuleDocument([]),
          [DND5E_TEST_OUTCOME_RULE_FACT_KEY]: 'NONE',
          [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: checksumRuleDocument({
            targetActorId: actor.id,
            currentHitPoints: actor.currentHitPoints,
            temporaryHitPoints: 0,
            maximumHitPoints: actor.maxHitPoints,
            conditionIds: []
          })
        }
      },
      published: serverPublishedRuleDefinitionDtoSchema.parse({
        id: definitionId,
        gameSystemId: srdSystemRecord.id,
        definitionFamilyKey: graph.definitionFamilyKey,
        checksum: checksumRuleDocument(graph),
        definition: graph
      })
    })
    if (!prepared) throw new Error('Frozen turn-effect graph compilation unavailable.')
    return createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).create({
      id: crypto.randomUUID(),
      owner:
        actor.kind === 'CHARACTER' && actor.sourceId
          ? { kind: 'CHARACTER', characterId: actor.sourceId }
          : { kind: 'ENCOUNTER_ACTOR', encounterId: base.run.id, targetActorId: actor.id },
      definition: activeRuleEffectDefinitionDtoSchema.parse({
        schemaVersion: 2,
        linkedEffectId: null,
        originLevel: null,
        stateContributions: [],
        origin: {
          kind: 'ENCOUNTER',
          sourceAggregateId: base.run.id,
          sourceOccurrenceId: occurrenceId,
          rootCommandId: crypto.randomUUID(),
          sourceActorId: actor.id
        },
        authoredEffectId: definitionId,
        compiledEntryId: entryId,
        frozenGraphNodeId: 'proposal-on_save_fail',
        frozenGraph: prepared.graph,
        adapterFacts: {
          [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]:
            SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
          [DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]: 'd20',
          [DND5E_SAVE_DC_FACT_KEY]: 30
        },
        perceptionContributions: [],
        recurrence: {
          recurrenceStage: input.stage,
          anchor: 'HOLDER',
          consumeOnFirstEvents: [],
          endOnEvents: [],
          endOnTriggers: [],
          endOnConditionIds: [],
          holderEnd: null,
          lifetimeScope: 'ENCOUNTER',
          expiration: {
            kind: 'TICKS',
            initialRemaining: input.ticks,
            decrementStage: input.stage
          }
        }
      }),
      lifecycle: { schemaVersion: 1, remainingTicks: input.ticks }
    })
  })
}
