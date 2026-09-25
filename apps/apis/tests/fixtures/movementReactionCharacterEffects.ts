import { makeFunctionReference } from 'convex/server'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_RULE_STATE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  createDnd5eMovementReactionChoiceDefinition,
  createDnd5eMovementReactionEligibilityDefinition
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/reactionEligibilityPolicy'
import { api, internal } from '../../convex/_generated/api'
import { sourceImportBatches } from '../../convex/content/importBatches'
import { setupReactionMovementScene } from './automaticSceneMovement'
import { setupCharacterRun } from './encounterCharacter'
import { conditionReactionCreature } from './movementReactionEffects'
import { importedSubject } from './publication'

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

function eligibilityDefinition(policy: 'AUTOMATIC' | 'CHOICE', id: string) {
  const published = createDnd5eMovementReactionEligibilityDefinition({
    definitionId: id,
    stage: 'BEFORE_LEAVE_REACH'
  })
  const definition = structuredClone({ ...published.definition, id })
  if (policy === 'AUTOMATIC') {
    const outputs = { ...definition.outputs }
    delete outputs.choiceDefinitionId
    outputs.selectionPolicy = { kind: 'LITERAL', value: 'AUTOMATIC' }
    definition.outputs = outputs
  }
  return {
    ...published,
    id,
    definition,
    checksum: checksumRuleDocument(definition)
  }
}

/** A Character mover and a Creature condition-reaction source for public Scene journeys. */
export async function setupMovementReactionCharacterEffects(withSecondReactor = false) {
  const base = await setupCharacterRun()
  const frightened = srdSystemRecord.conditionTypes.find(
    (condition) => condition.code === 'FRIGHTENED'
  )
  if (!frightened) throw new Error('Character reaction condition fixture requires Frightened.')
  await base.player.caller.mutation(api.characters.sheetCommands.execute, {
    id: base.character.id,
    command: {
      type: 'ADD_CONDITION',
      commandId: crypto.randomUUID(),
      expectedVersion: base.characterStreamVersion,
      conditionTypeId: frightened.id,
      notes: 'Sheet condition survives reaction effect'
    }
  })
  await base.owner.caller.mutation(api.campaigns.gmWrites.saveCondition, {
    campaignId: base.campaign.id,
    characterId: base.character.id,
    conditionTypeId: frightened.id,
    visibility: 'VISIBLE',
    expectedVersion: 0,
    notes: 'Campaign condition survives reaction effect'
  })
  const policies = withSecondReactor ? (['AUTOMATIC', 'CHOICE'] as const) : (['CHOICE'] as const)
  const eligibility = policies.map((policy) => eligibilityDefinition(policy, crypto.randomUUID()))
  const choice = createDnd5eMovementReactionChoiceDefinition()
  for (const batch of sourceImportBatches([
    ...SRD_RULE_STATE_DEFINITIONS,
    ...[...eligibility, choice].map((published) => ({
      id: published.id,
      definitionFamilyKey: published.definitionFamilyKey,
      label: 'Character reaction effect policy',
      description: 'Fixture',
      document: published.definition,
      checksum: published.checksum
    }))
  ]))
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: batch
    })

  const source = conditionReactionCreature()
  const creatures = eligibility.map((policy) =>
    creatureAuthoredDtoSchema.parse({
      ...source,
      id: crypto.randomUUID(),
      features: source.features?.map((feature) => ({
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
                    eligibilityDefinitionId: policy.id
                  }
                }
              : effect.invocation
        }))
      }))
    })
  )
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: creatures.map((creature) =>
      importedSubject({ ...creature, subjectKind: 'CREATURE', document: creature })
    )
  })

  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Character movement reaction condition fixture',
    commandId: crypto.randomUUID(),
    enemies: creatures.map((creature) => ({ kind: 'CREATURE' as const, sourceId: creature.id }))
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const reactors: EncounterGmProjectionDto['actors'] = []
  for (const creature of creatures) {
    const reactor = run.actors.find(
      (actor) => actor.kind === 'CREATURE' && actor.sourceId === creature.id
    )
    if (!reactor) throw new Error('Character movement reaction actors are unavailable.')
    reactors.push(reactor)
  }
  const mover = run.actors.find((actor) => actor.kind === 'CHARACTER')
  if (!mover) throw new Error('Character movement reaction actors are unavailable.')

  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!row) throw new Error('Character movement reaction Run is unavailable.')
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

  return setupReactionMovementScene(
    { ...base, other: base.player, run, reactors, mover },
    [reactors[0]!, mover, ...reactors.slice(1)],
    policies.map((_, index) => 50 + index * 100),
    [
      { x: 150, y: 50 },
      { x: 250 + policies.length * 100, y: 50 }
    ]
  )
}
