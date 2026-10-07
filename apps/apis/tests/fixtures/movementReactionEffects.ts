import { createConvexEncounterStore } from '../../convex/lib/convexEncounterStore'
import { readTestActor } from './storedActors'
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
import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema
} from '@artificer-toolkit/schema/api/encounterData'
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
import { srdWolf as wolf } from './srdCreatures'
import { SRD_RULE_STATE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  createDnd5eMovementReactionChoiceDefinition,
  createDnd5eOpportunityReactionEligibilityDefinition
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/reactionEligibilityPolicy'
import { writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { fixture } from './characters'
import { reactionBinding } from './reactionBinding'
import { createEncounterLifecyclePolicyFixture } from './encounterInitiative'
import { importedSubject } from './publication'
import { api, internal } from '../../convex/_generated/api'
import { sourceImportBatches } from '../../convex/content/importBatches'
import { attachFixtureRoom, closeRoom, executeInRoom } from './localRoomWorker'
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

const conditionCreatureId = '00000000-0000-4000-8000-0000000009a0'
const conditionFeatureId = '00000000-0000-4000-8000-0000000009a1'
const conditionEffectId = '00000000-0000-4000-8000-0000000009a2'

export function conditionReactionCreature() {
  const bite = wolf.features?.find((feature) => feature.label === 'Bite')
  const dexterity = srdSystemRecord.abilities?.find((ability) => ability.code === 'DEXTERITY')
  const frightened = srdSystemRecord.conditionTypes.find(
    (condition) => condition.code === 'FRIGHTENED'
  )
  if (!bite || !dexterity || !frightened)
    throw new Error('Movement reaction condition fixture requires Bite, Dexterity, and Frightened.')
  return {
    ...wolf,
    id: conditionCreatureId,
    label: 'Movement reaction condition wolf',
    hitPoints: 100,
    features: [
      {
        ...bite,
        id: conditionFeatureId,
        rollDefinitions: [
          {
            id: '00000000-0000-4000-8000-0000000009b0',
            label: 'Bite attack',
            kind: 'ATTACK' as const,
            expression: { count: 1, die: 20, modifier: 4 },
            rollMode: 'NORMAL' as const,
            chargeCost: null,
            order: 1
          }
        ],
        effects: bite.effects?.slice(0, 1).map((effect) => ({
          ...effect,
          id: conditionEffectId,
          invocation: {
            ...effect.invocation,
            triggerCode: 'MELEE_WEAPON_ATTACK' as const,
            activation: { code: 'REACTION' as const, amount: 1 },
            reactionMovementTrigger: reactionBinding,
            targeting: { selectionKind: 'SINGLE_TARGET' as const, dispositionKind: 'ANY' as const }
          },
          paths: effect.paths?.slice(0, 1).map((path) => {
            if (!('resultBlock' in path)) throw new Error('Bite action path has no result block.')
            return {
              ...path,
              groupType: 'SEQUENTIAL' as const,
              resultBlock: {
                ...path.resultBlock,
                id: '00000000-0000-4000-8000-0000000009a5',
                resultKind: 'SEQUENCE' as const,
                duration: {
                  id: '00000000-0000-4000-8000-0000000009a6',
                  durationKind: 'ROUND' as const,
                  amount: 2
                },
                outcomes: [
                  ...path.resultBlock.outcomes,
                  {
                    id: '00000000-0000-4000-8000-0000000009a8',
                    effectKind: 'FOLLOW_UP_SAVE' as const,
                    timing: 'IMMEDIATE' as const,
                    repeatTiming: 'TARGET_TURN_END' as const,
                    savingThrow: {
                      id: '00000000-0000-4000-8000-0000000009a9',
                      dcMethod: 'FIXED_DC' as const,
                      abilityDefinitionId: dexterity.id,
                      baseDc: 30
                    },
                    attempts: { kind: 'ONCE' as const, repeatOnFailure: true },
                    onSuccess: { kind: 'END' as const },
                    onFailure: {
                      kind: 'OUTCOMES' as const,
                      endCurrent: false,
                      resultKind: 'SINGLE' as const,
                      outcomes: [
                        {
                          id: '00000000-0000-4000-8000-0000000009a7',
                          effectKind: 'CONDITION' as const,
                          conditionId: frightened.id
                        }
                      ]
                    },
                    onDurationComplete: { kind: 'END' as const }
                  }
                ]
              }
            }
          })
        }))
      }
    ]
  }
}

const reactionCreature = conditionReactionCreature()

async function settleStart(
  base: Awaited<ReturnType<typeof fixture>>,
  input: ReturnType<typeof encounterCommandResultDtoSchema.parse>
) {
  let current = input
  for (let resolutions = 0; current.occurrence?.status === 'PENDING'; resolutions++) {
    if (resolutions >= 20) throw new Error('Movement reaction fixture initiative did not settle.')
    const pending = current.occurrence.pending
    const resolution =
      pending?.kind === 'INITIATIVE_EVIDENCE'
        ? {
            kind: 'ENTER_INTEGER' as const,
            requestId: pending.request.requestId,
            value: pending.request.max
          }
        : pending?.kind === 'INITIATIVE_ORDER'
          ? {
              kind: 'INITIATIVE_ENTITY' as const,
              requestId: pending.requestId,
              entityId: pending.optionIds[0]!
            }
          : (() => {
              throw new Error(
                'Movement reaction fixture received an unsupported initiative request.'
              )
            })()
    current = encounterCommandResultDtoSchema.parse(
      await executeInRoom(base.owner.caller, {
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: current.projection.id,
          commandId: crypto.randomUUID(),
          expectedVersion: current.projection.version,
          correlationId: null,
          occurrenceId: current.occurrence.occurrenceId,
          expectedOccurrenceVersion: current.occurrence.occurrenceVersion,
          resolution
        }
      })
    )
  }
  return current
}

export async function setupCreatureReactionRun(
  perceptionRequirement: 'SEE' | null = null,
  withAttackRoll = false,
  additionalReactor = false,
  selectionPolicy: 'AUTOMATIC' | 'CHOICE' = 'CHOICE',
  additionalSelectionPolicy: 'AUTOMATIC' | 'CHOICE' = selectionPolicy
) {
  const base = await fixture()
  const policies = createEncounterLifecyclePolicyFixture(base.owner.userId)
  await base.t.mutation(internal.content.import.bootstrap, policies.bootstrap)
  await base.t.mutation(internal.content.import.importDefinitions, policies.imported)
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
      ...(withAttackRoll && feature.label === 'Bite'
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
          reactionMovementTrigger: {
            ...reactionBinding,
            perceptionRequirement
          }
        }
      }))
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
  campaign = await base.owner.caller.mutation(api.campaigns.update.update, {
    campaignId: campaign.id,
    expectedVersion: campaign.version,
    additionalRulesCatalogueIds: [policies.bootstrap.catalogue.id]
  })
  const settings = await base.owner.caller.query(api.campaigns.playSettings.get, {
    campaignId: campaign.id
  })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await base.owner.caller.mutation(api.campaigns.playSettings.save, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
    initiativeTieDefinitionId: null
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Native movement reaction fixture',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CREATURE', sourceId: reactionCreature.id },
      ...(withAttackRoll
        ? [{ kind: 'CREATURE' as const, sourceId: reactionCreature.id }]
        : [{ kind: 'CUSTOM' as const, label: 'Mover', maxHitPoints: 10 }]),
      ...(additionalReactor ? [{ kind: 'CREATURE' as const, sourceId: additionalCreature.id }] : [])
    ]
  })
  let run = await base.owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  await attachFixtureRoom(base.t, campaign.id)
  run = encounterGmProjectionDtoSchema.parse(
    (
      await settleStart(
        base,
        encounterCommandResultDtoSchema.parse(
          await executeInRoom(base.owner.caller, {
            command: {
              type: 'START',
              encounterId: run.id,
              commandId: crypto.randomUUID(),
              expectedVersion: run.version
            }
          })
        )
      )
    ).projection
  )
  const creatures = run.actors.filter((actor) => actor.kind === 'CREATURE')
  const primaryCreatures = creatures.filter((actor) => actor.sourceId === reactionCreature.id)
  const reactor = primaryCreatures[0]
  const mover = withAttackRoll
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
  // The real room holds the Run until it closes; it is made Active in Convex below, and the first
  // command's room hydrates from it.
  await closeRoom(campaign.id)
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
      round: 1
    })
    await ctx.db.patch(runRow._id, {
      status: 'ACTIVE',
      stateJson: JSON.stringify(active),
      stateChecksum: checksumCanonicalJson(active)
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
        ...(await readTestActor(ctx, row)),
        sideId: party.id,
        disposition: 'FRIENDLY'
      })
      await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, state)
    }
  })
  return { ...base, campaign, run, reactor, mover, additionalReactorActor }
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
