import { makeFunctionReference } from 'convex/server'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
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
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { adultBlackDragon } from '@artificer-toolkit/source-data/srd/creatures/adult-black-dragon.js'
import { SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/encounterLifecycle.js'
import { SRD_ABILITY_DEFINITION_IDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { SRD_RULE_STATE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  createDnd5eMovementReactionChoiceDefinition,
  createDnd5eOpportunityReactionEligibilityDefinition
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/reactionEligibilityPolicy'
import { fixture } from './characters'
import { reactionBinding } from './reactionBinding'
import { srdWolf } from './srdCreatures'
import { createEncounterLifecyclePolicyFixture } from './encounterInitiative'
import { importedSubject } from './publication'
import { maintenanceDefinitionFixture } from './maintenanceDefinition'
import { api, internal } from '../../convex/_generated/api'
import { sourceImportBatches } from '../../convex/content/importBatches'
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

const reactionCreature = {
  ...srdWolf,
  features: srdWolf.features?.map((feature) => ({
    ...feature,
    effects: feature.effects?.map((effect) => ({
      ...effect,
      invocation: {
        ...effect.invocation,
        triggerCode: 'MELEE_WEAPON_ATTACK' as const,
        activation: { code: 'REACTION' as const, amount: 1 },
        reactionMovementTrigger: reactionBinding
      }
    }))
  }))
}

const legendaryResistanceFeature = adultBlackDragon.features?.find((feature) =>
  feature.ruleDefinitionIds?.includes('00000000-0000-4000-8000-0000000000e4')
)
if (!legendaryResistanceFeature)
  throw new Error('The native movement fixture requires SRD Legendary Resistance.')

const legendaryTargetCreature = creatureAuthoredDtoSchema.parse({
  ...reactionCreature,
  id: crypto.randomUUID(),
  features: [
    ...(reactionCreature.features ?? []),
    {
      ...structuredClone(legendaryResistanceFeature),
      id: crypto.randomUUID(),
      charges: legendaryResistanceFeature.charges
        ? { ...legendaryResistanceFeature.charges, id: crypto.randomUUID() }
        : undefined,
      effects: legendaryResistanceFeature.effects?.map((effect) => ({
        ...effect,
        id: crypto.randomUUID()
      }))
    }
  ]
})

export function reactionInput(input: {
  encounterId: string
  expectedEncounterVersion: number
  movingActorId: string
  reactorActorId: string
  occurrenceId: string
}) {
  const reactorTokenId = crypto.randomUUID()
  const movingTokenId = crypto.randomUUID()
  const perceptionContacts: Array<{ reactorActorId: string; movingActorId: string }> = []
  const tokens = [
    { id: reactorTokenId, position: { x: 50, y: 50 }, width: 100, height: 100 },
    { id: movingTokenId, position: { x: 150, y: 50 }, width: 100, height: 100 }
  ]
  return {
    encounterId: input.encounterId,
    expectedEncounterVersion: input.expectedEncounterVersion,
    grid: {
      kind: 'SQUARE' as const,
      origin: { x: 0, y: 0 },
      cellSize: 100,
      distancePerCell: 5,
      diagonalPolicy: 'EQUAL' as const,
      unit: 'FEET' as const
    },
    movementKind: 'VOLUNTARY' as const,
    movingTokenId,
    occurrenceId: input.occurrenceId,
    path: [
      { x: 150, y: 50 },
      { x: 350, y: 50 }
    ],
    actorIdByTokenId: new Map([
      [reactorTokenId, input.reactorActorId],
      [movingTokenId, input.movingActorId]
    ]),
    tokens,
    // Scene-owned perception is not integrated into this bounded native proof.
    resolvePerception: async (contact: {
      candidate: { reactorActorId: string; movingActorId: string }
    }) => {
      perceptionContacts.push(contact.candidate)
      return true
    },
    perceptionContacts: () => perceptionContacts
  }
}

export async function setupCreatureReactionRun(
  perceptionRequirement: 'SEE' | null = null,
  withAttackRoll = false,
  additionalReactor = false,
  selectionPolicy: 'AUTOMATIC' | 'CHOICE' = 'CHOICE',
  additionalSelectionPolicy: 'AUTOMATIC' | 'CHOICE' = selectionPolicy,
  legendarySaveTarget: boolean | { outcomeDice: true; stopOnFailedSave?: boolean } = false,
  authored: { maintainedRecurring?: boolean } = {}
) {
  const stopOnFailedSave =
    typeof legendarySaveTarget === 'object' && legendarySaveTarget.stopOnFailedSave === true
  const base = await fixture()
  const maintenancePolicies = authored.maintainedRecurring
    ? createEncounterLifecyclePolicyFixture(base.owner.userId)
    : null
  const maintenanceDefinitionId = maintenancePolicies?.scenarios[0]?.definitionId ?? null
  if (maintenancePolicies) {
    if (!maintenanceDefinitionId) throw new Error('Missing movement maintenance definition ID.')
    const maintenanceDefinition = maintenanceDefinitionFixture({ id: maintenanceDefinitionId })
    await base.t.mutation(internal.content.import.bootstrap, maintenancePolicies.bootstrap)
    await base.t.mutation(internal.content.import.importDefinitions, {
      ...maintenancePolicies.imported,
      definitions: maintenancePolicies.imported.definitions.map((definition) =>
        definition.id === maintenanceDefinitionId ? maintenanceDefinition : definition
      )
    })
  }
  const opportunity = createDnd5eOpportunityReactionEligibilityDefinition()
  const withSelectionPolicy = (
    definition: typeof opportunity.definition,
    policy: 'AUTOMATIC' | 'CHOICE'
  ) => {
    const value = structuredClone(definition)
    if (policy !== 'AUTOMATIC') return value
    const outputs: Record<string, (typeof definition.outputs)[string]> = {
      ...value.outputs
    }
    delete outputs.choiceDefinitionId
    outputs.selectionPolicy = { kind: 'LITERAL', value: 'AUTOMATIC' }
    value.outputs = outputs
    return value
  }
  const opportunityDefinition = withSelectionPolicy(opportunity.definition, selectionPolicy)
  const publishedOpportunity =
    selectionPolicy === 'AUTOMATIC'
      ? {
          ...opportunity,
          definition: opportunityDefinition,
          checksum: checksumRuleDocument(opportunityDefinition)
        }
      : opportunity
  const additionalOpportunityId = crypto.randomUUID()
  const additionalOpportunityDefinition = {
    ...withSelectionPolicy(opportunity.definition, additionalSelectionPolicy),
    id: additionalOpportunityId
  }
  const publishedAdditionalOpportunity = {
    ...opportunity,
    id: additionalOpportunityId,
    definition: additionalOpportunityDefinition,
    checksum: checksumRuleDocument(additionalOpportunityDefinition)
  }
  const definitions = [
    ...SRD_RULE_STATE_DEFINITIONS,
    ...(legendarySaveTarget
      ? SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS.map((definition) => ({
          ...definition,
          document: jsonValueSchema.parse(definition.document)
        }))
      : []),
    ...[
      publishedOpportunity,
      ...(additionalReactor ? [publishedAdditionalOpportunity] : []),
      createDnd5eMovementReactionChoiceDefinition()
    ].map((published) => ({
      id: published.id,
      definitionFamilyKey: published.definitionFamilyKey,
      label: 'Native movement reaction fixture',
      description: 'Current D&D movement reaction policy fixture.',
      document: jsonValueSchema.parse(published.definition),
      checksum: published.checksum
    }))
  ]
  for (const batch of sourceImportBatches(definitions))
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: batch
    })
  const creature = creatureAuthoredDtoSchema.parse({
    ...reactionCreature,
    features: reactionCreature.features?.map((feature) => ({
      ...feature,
      ...(withAttackRoll && !maintenanceDefinitionId && feature.label === 'Bite'
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
      effects: feature.effects?.map((effect) => {
        const paths =
          (legendarySaveTarget || maintenanceDefinitionId) && feature.label === 'Bite'
            ? effect.paths
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
                          outcomes: path.resultBlock.outcomes.map((outcome) =>
                            outcome.effectKind === 'DAMAGE' &&
                            (maintenanceDefinitionId || typeof legendarySaveTarget !== 'object')
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
            : effect.paths
        return {
          ...effect,
          paths: (maintenanceDefinitionId && feature.label === 'Bite'
            ? paths
                ?.filter(
                  (path) =>
                    'resultBlock' in path &&
                    path.resultBlock.outcomes.some((outcome) => outcome.effectKind === 'DAMAGE')
                )
                .slice(0, 1)
            : paths
          )?.map((path) =>
            maintenanceDefinitionId && feature.label === 'Bite' && 'resultBlock' in path
              ? {
                  ...path,
                  resultBlock: {
                    ...path.resultBlock,
                    id: crypto.randomUUID(),
                    maintenanceDefinitionId,
                    duration: {
                      id: crypto.randomUUID(),
                      durationKind: 'ROUND' as const,
                      amount: 3
                    },
                    lifecycle: { recurringKind: 'START_OF_TURN' as const }
                  }
                }
              : path
          ),
          invocation: {
            ...effect.invocation,
            ...((legendarySaveTarget || maintenanceDefinitionId) && feature.label === 'Bite'
              ? {
                  triggerCode: 'SAVING_THROW' as const,
                  savingThrow: {
                    id: crypto.randomUUID(),
                    dcMethod: 'FIXED_DC' as const,
                    baseDc: 30,
                    abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY
                  }
                }
              : {}),
            reactionMovementTrigger: {
              ...reactionBinding,
              perceptionRequirement,
              movementInterruption: stopOnFailedSave
                ? { kind: 'STOP' as const, whenResultPath: 'ON_SAVE_FAIL' as const }
                : null
            }
          }
        }
      })
    }))
  })
  const additionalCreature = {
    ...creature,
    id: crypto.randomUUID(),
    features: creature.features?.map((feature) => ({
      ...feature,
      effects: feature.effects?.map((effect) => ({
        ...effect,
        invocation:
          'reactionMovementTrigger' in effect.invocation &&
          effect.invocation.reactionMovementTrigger
            ? {
                ...effect.invocation,
                reactionMovementTrigger: {
                  ...effect.invocation.reactionMovementTrigger,
                  eligibilityDefinitionId: additionalOpportunityId
                }
              }
            : effect.invocation
      }))
    }))
  }
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({
        ...creature,
        subjectKind: 'CREATURE',
        document: creature
      }),
      ...(legendarySaveTarget
        ? [
            importedSubject({
              ...adultBlackDragon,
              ...legendaryTargetCreature,
              subjectKind: 'CREATURE',
              document: legendaryTargetCreature
            })
          ]
        : []),
      ...(additionalReactor
        ? [
            importedSubject({
              ...additionalCreature,
              subjectKind: 'CREATURE',
              document: additionalCreature
            })
          ]
        : [])
    ]
  })
  let campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Native movement reaction fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  if (maintenancePolicies)
    campaign = await base.owner.caller.mutation(api.campaigns.update.update, {
      campaignId: campaign.id,
      expectedVersion: campaign.version,
      additionalRulesCatalogueIds: [maintenancePolicies.bootstrap.catalogue.id]
    })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Native movement reaction fixture',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CREATURE', sourceId: reactionCreature.id },
      ...(legendarySaveTarget
        ? [{ kind: 'CREATURE' as const, sourceId: legendaryTargetCreature.id }]
        : withAttackRoll
          ? [{ kind: 'CREATURE' as const, sourceId: reactionCreature.id }]
          : [{ kind: 'CUSTOM' as const, label: 'Mover', maxHitPoints: 10 }]),
      ...(additionalReactor ? [{ kind: 'CREATURE' as const, sourceId: additionalCreature.id }] : [])
    ]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const creatures = run.actors.filter((actor) => actor.kind === 'CREATURE')
  const primaryCreatures = creatures.filter((actor) => actor.sourceId === reactionCreature.id)
  const reactor = primaryCreatures[0]
  const mover = legendarySaveTarget
    ? creatures.find((actor) => actor.id !== reactor?.id)
    : withAttackRoll
      ? primaryCreatures[1]
      : run.actors.find((actor) => actor.kind === 'CUSTOM')
  const additionalReactorActor = additionalReactor
    ? (creatures.find(
        (actor) =>
          actor.sourceId === additionalCreature.id &&
          actor.id !== reactor?.id &&
          actor.id !== mover?.id
      ) ?? null)
    : null
  if (!reactor || !mover || (additionalReactor && !additionalReactorActor))
    throw new Error('Missing native movement reaction actors.')
  await base.t.run(async (ctx) => {
    const runRow = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', run.id))
      .unique()
    const reactorRow = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (query) =>
        query.eq('encounterId', run.id).eq('id', reactor.id)
      )
      .unique()
    if (!runRow || !reactorRow) throw new Error('Missing native movement reaction rows.')
    const state = encounterRunStateSchema.parse(JSON.parse(runRow.stateJson))
    const party = state.sides.find((side) => side.label === 'Party')
    if (!party) throw new Error('Missing native movement reaction Party side.')
    const active = encounterRunStateSchema.parse({
      ...state,
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: reactor.id
    })
    const projection = encounterGmProjectionDtoSchema.parse({
      ...JSON.parse(runRow.projectionJson),
      status: 'ACTIVE'
    })
    await ctx.db.patch(runRow._id, {
      status: 'ACTIVE',
      stateJson: JSON.stringify(active),
      stateChecksum: checksumCanonicalJson(active),
      projectionJson: JSON.stringify(projection),
      projectionChecksum: checksumCanonicalJson(projection)
    })
    for (const actor of [reactor, additionalReactorActor].filter(
      (value): value is NonNullable<typeof value> => value !== null
    )) {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (query) =>
          query.eq('encounterId', run.id).eq('id', actor.id)
        )
        .unique()
      if (!row) throw new Error('Missing native movement reaction actor.')
      // Reactions follow hostility, which dispositions decide: FRIENDLY reactors, HOSTILE mover.
      const state = encounterRunActorStateSchema.parse({
        ...JSON.parse(row.stateJson),
        sideId: party.id,
        disposition: 'FRIENDLY'
      })
      await ctx.db.patch(row._id, {
        stateJson: JSON.stringify(state),
        stateChecksum: checksumCanonicalJson(state)
      })
    }
    const reactorIds = new Set(
      [reactor, additionalReactorActor].flatMap((actor) => (actor ? [actor.id] : []))
    )
    const friendly = encounterGmProjectionDtoSchema.parse({
      ...projection,
      actors: projection.actors.map((actor) =>
        reactorIds.has(actor.id) ? { ...actor, disposition: 'FRIENDLY' } : actor
      )
    })
    await ctx.db.patch(runRow._id, {
      projectionJson: JSON.stringify(friendly),
      projectionChecksum: checksumCanonicalJson(friendly)
    })
  })
  return {
    ...base,
    campaign,
    run,
    reactor,
    mover,
    additionalReactorActor,
    maintenanceDefinitionId
  }
}

export async function reactionRecords(
  t: Awaited<ReturnType<typeof fixture>>['t'],
  encounterId: string
) {
  return t.run(async (ctx) => ({
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', encounterId))
      .unique(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (query) => query.eq('encounterId', encounterId))
      .collect()
  }))
}
