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
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { adultBlackDragon as rawAdultBlackDragon } from '@artificer-toolkit/source-data/srd/creatures/adult-black-dragon.js'
import { SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/encounterLifecycle.js'
import { SRD_ABILITY_DEFINITION_IDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { SRD_RULE_STATE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { SRD_BASIC_ACTION_DEFINITIONS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import {
  conditionTypeId,
  damageTypeId
} from '@artificer-toolkit/source-data/srd/equipment/shared.js'
import {
  SRD_MOVEMENT_REACTION_DEFINITIONS,
  SRD_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID
} from '@artificer-toolkit/source-data/srd/movementReaction.js'
import { srdOpportunityReactionEligibilityDefinition } from '@artificer-toolkit/rules-runtime/testing/srdMovementReactionPolicy'
import { writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { fixture } from './characters'
import { reactionBinding } from './reactionBinding'
import { srdCreatureRecord, srdWolf } from './srdCreatures'
import { createEncounterLifecyclePolicyFixture } from './encounterInitiative'
import { importedSubject, importSeededSubjects } from './publication'
import { maintenanceDefinitionFixture } from './maintenanceDefinition'
import { api, internal } from '../../convex/_generated/api'
import { sourceImportBatches } from '../../convex/content/importBatches'
import { activateFixtureRun } from './activeInitiative'

const adultBlackDragon = srdCreatureRecord(rawAdultBlackDragon.id)
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

/** A saving throw the authored reaction forces in place of its attack, failed for its damage alone. */
interface AuthoredReactionSave {
  damageDice: boolean
  stopOnFailedSave: boolean
  maintenanceDefinitionId: string | null
}

/**
 * A test-authored Bite taken as a movement reaction, for what the SRD opportunity attack does not
 * take: an AUTOMATIC selection, a chosen perception requirement, or a saving throw in place of the
 * attack.
 */
function authoredReactionBite(input: {
  eligibilityDefinitionId: string
  perceptionRequirement: 'SEE' | null
  save: AuthoredReactionSave | null
}): NonNullable<CreatureAuthored['features']>[number] {
  const damage = {
    id: crypto.randomUUID(),
    effectKind: 'DAMAGE' as const,
    damageTypeId: damageTypeId('PIERCING'),
    scalingKind: 'NONE' as const,
    ...(input.save && !input.save.damageDice
      ? { valueKind: 'FIXED' as const, amount: 1, bonuses: [] }
      : {
          valueKind: 'DICE' as const,
          diceConfig: '2d4',
          bonuses: [
            {
              id: crypto.randomUUID(),
              bonusKind: 'ABILITY_BONUS' as const,
              ability: 'DEXTERITY' as const,
              order: 1
            }
          ]
        })
  }
  const path = (
    order: number,
    pathCode: 'ON_HIT' | 'ON_SAVE_FAIL',
    outcome: typeof damage | { id: string; effectKind: 'CONDITION'; conditionId: string }
  ) => ({
    id: crypto.randomUUID(),
    order,
    pathCode,
    groupType: 'SINGLE' as const,
    originKind: 'SOURCE' as const,
    selectionKind: 'FIXED' as const,
    resultBlock: {
      id: crypto.randomUUID(),
      resultKind: 'SINGLE' as const,
      outcomes: [outcome],
      ...(input.save?.maintenanceDefinitionId
        ? {
            maintenanceDefinitionId: input.save.maintenanceDefinitionId,
            duration: { id: crypto.randomUUID(), durationKind: 'ROUND' as const, amount: 3 },
            lifecycle: { recurringKind: 'START_OF_TURN' as const }
          }
        : {})
    }
  })
  return {
    id: crypto.randomUUID(),
    label: 'Bite',
    description: 'A bite taken as a reaction to a creature leaving reach.',
    order: 1,
    ...(input.save
      ? {}
      : {
          rollDefinitions: [
            {
              id: crypto.randomUUID(),
              label: 'Bite attack',
              kind: 'ATTACK' as const,
              expression: { count: 1, die: 20, modifier: 4 },
              rollMode: 'NORMAL' as const,
              chargeCost: null,
              order: 1
            }
          ]
        }),
    effects: [
      {
        id: crypto.randomUUID(),
        order: 1,
        invocation: {
          kind: 'ACTION' as const,
          activation: { code: 'REACTION' as const, amount: 1 },
          range: {
            id: crypto.randomUUID(),
            rangeKind: 'DISTANCE' as const,
            amount: 5,
            unit: 'FEET' as const
          },
          targeting: { selectionKind: 'SINGLE_TARGET' as const, dispositionKind: 'ANY' as const },
          ...(input.save
            ? {
                triggerCode: 'SAVING_THROW' as const,
                savingThrow: {
                  id: crypto.randomUUID(),
                  dcMethod: 'FIXED_DC' as const,
                  baseDc: 30,
                  abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY
                }
              }
            : { triggerCode: 'MELEE_WEAPON_ATTACK' as const }),
          reactionTrigger: {
            ...reactionBinding,
            eligibilityDefinitionId: input.eligibilityDefinitionId,
            perceptionRequirement: input.perceptionRequirement,
            movementInterruption: input.save?.stopOnFailedSave
              ? { kind: 'STOP' as const, whenResultPath: 'ON_SAVE_FAIL' as const }
              : null
          }
        },
        paths: input.save
          ? [path(1, 'ON_SAVE_FAIL', damage)]
          : [
              path(1, 'ON_HIT', damage),
              path(2, 'ON_HIT', {
                id: crypto.randomUUID(),
                effectKind: 'CONDITION',
                conditionId: conditionTypeId('PRONE')
              })
            ]
      }
    ]
  }
}

/** A Creature with the Wolf's statistics whose only Feature is a test-authored reaction Bite. */
function authoredReactionCreature(bite: Parameters<typeof authoredReactionBite>[0]) {
  return creatureAuthoredDtoSchema.parse({
    ...srdWolf,
    id: crypto.randomUUID(),
    label: 'Reaction Wolf',
    features: [authoredReactionBite(bite)]
  })
}

/** The SRD leave-reach eligibility graph authored again under its own ID, settling without a choice. */
function authoredAutomaticEligibilityDefinition() {
  const srd = srdOpportunityReactionEligibilityDefinition()
  const id = crypto.randomUUID()
  const outputs: Record<string, (typeof srd.definition.outputs)[string]> = {
    ...structuredClone(srd.definition.outputs),
    selectionPolicy: { kind: 'LITERAL', value: 'AUTOMATIC' }
  }
  delete outputs.choiceDefinitionId
  const document = { ...structuredClone(srd.definition), id, outputs }
  return {
    id,
    definitionFamilyKey: srd.definitionFamilyKey,
    label: 'Automatic movement reaction eligibility',
    description:
      'A leave-reach reaction eligibility graph whose eligible reaction is taken at once.',
    document: jsonValueSchema.parse(document),
    checksum: checksumRuleDocument(document)
  }
}

const legendaryResistanceFeature = adultBlackDragon.features?.find((feature) =>
  feature.ruleDefinitionIds?.includes('00000000-0000-4000-8000-0000000000e4')
)
if (!legendaryResistanceFeature)
  throw new Error('The native movement fixture requires SRD Legendary Resistance.')

const legendaryTargetCreature = creatureAuthoredDtoSchema.parse({
  ...srdWolf,
  id: crypto.randomUUID(),
  features: [
    ...(srdWolf.features ?? []),
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

/**
 * An Assisted Run on the reactor's turn: reactors FRIENDLY and a HOSTILE mover. A CHOICE reactor
 * answers a move with the SRD opportunity attack, which requires sight; `perceptionRequirement`
 * sets only a test-authored reaction's. `qualifiedDamageDefenses` are the Creature mover's.
 */
export async function setupCreatureReactionRun(
  perceptionRequirement: 'SEE' | null = null,
  withAttackRoll = false,
  additionalReactor = false,
  selectionPolicy: 'AUTOMATIC' | 'CHOICE' = 'CHOICE',
  additionalSelectionPolicy: 'AUTOMATIC' | 'CHOICE' = selectionPolicy,
  legendarySaveTarget: boolean | { outcomeDice: true; stopOnFailedSave?: boolean } = false,
  authored: {
    maintainedRecurring?: boolean
    qualifiedDamageDefenses?: NonNullable<CreatureAuthored['qualifiedDamageDefenses']>
  } = {}
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
  const save: AuthoredReactionSave | null =
    legendarySaveTarget || maintenanceDefinitionId
      ? {
          damageDice: typeof legendarySaveTarget === 'object' && !maintenanceDefinitionId,
          stopOnFailedSave,
          maintenanceDefinitionId
        }
      : null
  const automaticEligibility = authoredAutomaticEligibilityDefinition()
  // A CHOICE reactor answers with the SRD opportunity attack made with the SRD Wolf's own Bite; the
  // SRD does not take the rest, so they hold a test-authored reaction.
  const reactorCreature = (policy: 'AUTOMATIC' | 'CHOICE') =>
    policy === 'CHOICE' && !save
      ? srdWolf
      : authoredReactionCreature({
          eligibilityDefinitionId:
            policy === 'AUTOMATIC'
              ? automaticEligibility.id
              : SRD_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID,
          perceptionRequirement,
          save
        })
  const reactionCreature = reactorCreature(selectionPolicy)
  const additionalCreature = additionalReactor ? reactorCreature(additionalSelectionPolicy) : null
  const moverCreature = legendarySaveTarget
    ? legendaryTargetCreature
    : withAttackRoll
      ? authored.qualifiedDamageDefenses
        ? creatureAuthoredDtoSchema.parse({
            ...srdWolf,
            id: crypto.randomUUID(),
            qualifiedDamageDefenses: authored.qualifiedDamageDefenses
          })
        : srdWolf
      : null
  const definitions = [
    ...SRD_RULE_STATE_DEFINITIONS,
    ...(legendarySaveTarget ? SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS : []),
    ...SRD_MOVEMENT_REACTION_DEFINITIONS,
    automaticEligibility,
    ...([reactionCreature, additionalCreature].includes(srdWolf)
      ? SRD_BASIC_ACTION_DEFINITIONS
      : [])
  ].map((definition) => ({ ...definition, document: jsonValueSchema.parse(definition.document) }))
  for (const batch of sourceImportBatches(definitions))
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: batch
    })
  const subjects = new Map(
    [reactionCreature, moverCreature, additionalCreature]
      .filter((creature) => creature !== null)
      .map((creature) => [creature.id, creature])
  )
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [...subjects.values()].map((creature) =>
      importedSubject({ ...creature, subjectKind: 'CREATURE', document: creature })
    )
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
      moverCreature
        ? { kind: 'CREATURE' as const, sourceId: moverCreature.id }
        : { kind: 'CUSTOM' as const, label: 'Mover', maxHitPoints: 10 },
      ...(additionalCreature
        ? [{ kind: 'CREATURE' as const, sourceId: additionalCreature.id }]
        : [])
    ]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  // Creatures of one source are interchangeable, so each role takes the next unclaimed one.
  const claimed = new Set<string>()
  const claim = (sourceId: string) => {
    const actor = run.actors.find(
      (candidate) =>
        candidate.kind === 'CREATURE' &&
        candidate.sourceId === sourceId &&
        !claimed.has(candidate.id)
    )
    if (actor) claimed.add(actor.id)
    return actor
  }
  const reactor = claim(reactionCreature.id)
  const mover = moverCreature
    ? claim(moverCreature.id)
    : run.actors.find((actor) => actor.kind === 'CUSTOM')
  const additionalReactorActor = additionalCreature ? (claim(additionalCreature.id) ?? null) : null
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
    await activateFixtureRun(ctx, run.id, {
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: reactor.id
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
