import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_ATHLETICS_SKILL_ID,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

type RelationshipContribution = Extract<
  Extract<ActiveRuleEffectDefinitionDto, { schemaVersion: 2 }>['stateContributions'][number],
  { kind: 'ACTOR_RELATIONSHIP' }
>

const fixtureId = (suffix: number) =>
  `00000000-0000-4000-8000-${(0xf00000 + suffix).toString(16).padStart(12, '0')}`

export const ESCAPE_GRAPPLE_RELATIONSHIP_OUTCOME_ID = fixtureId(4)
export const ESCAPE_GRAPPLE_MODULE_ID = fixtureId(5)

/**
 * The relationship effect a grapple leaves on its target: one fixed-DC Escape module the target
 * attempts with its Action, and the conditions the effect owns (D105).
 */
export function escapeGrappleEffectDefinition(input: {
  encounterId: string
  grapplerId: string
  conditionIds: readonly string[]
  dc?: number
  activation?: Extract<
    RelationshipContribution['modules'][number],
    { kind: 'ESCAPE_CHECK' }
  >['activation']
  checks?: { skillIds: string[]; abilityDefinitionIds: string[] }
  /** Who may attempt the escape; the holder itself only when this includes `TARGET`. */
  actorKinds?: ('TARGET' | 'CREATURE_WITHIN_REACH')[]
}): ActiveRuleEffectDefinitionDto {
  const definitionId = fixtureId(0)
  const entryId = fixtureId(1)
  return {
    schemaVersion: 2,
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: input.encounterId,
      sourceOccurrenceId: fixtureId(2),
      rootCommandId: fixtureId(3),
      sourceActorId: input.grapplerId
    },
    authoredEffectId: definitionId,
    compiledEntryId: entryId,
    frozenGraphNodeId: 'entry',
    frozenGraph: {
      schemaVersion: 1,
      source: {
        definitionId,
        gameSystemId: SRD_SYSTEM_ID,
        definitionFamilyKey: 'effect',
        checksum: 'a'.repeat(64)
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [{ id: 'entry', operation: { key: 'comparison', contractVersion: 1 }, inputs: {} }],
      sourceEntryBindings: [{ sourceEntryId: entryId, nodeId: 'entry' }],
      outputs: { result: { kind: 'LITERAL', value: true } }
    },
    adapterFacts: {},
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: 'NONE',
      consumeOnFirstEvents: [],
      endOnEvents: [],
      endOnTriggers: [],
      endOnConditionIds: [],
      holderEnd: null,
      lifetimeScope: 'ENCOUNTER',
      expiration: { kind: 'INDEFINITE' }
    },
    stateContributions: [
      {
        kind: 'ACTOR_RELATIONSHIP',
        relationshipOutcomeId: ESCAPE_GRAPPLE_RELATIONSHIP_OUTCOME_ID,
        modules: [
          {
            id: ESCAPE_GRAPPLE_MODULE_ID,
            order: 0,
            kind: 'ESCAPE_CHECK',
            activation: input.activation ?? { code: 'ACTION', amount: 1 },
            checks: input.checks ?? {
              skillIds: [SRD_ATHLETICS_SKILL_ID],
              abilityDefinitionIds: [SRD_ABILITY_DEFINITION_IDS.STRENGTH]
            },
            dc: { kind: 'FIXED', value: input.dc ?? 13 },
            actorKinds: input.actorKinds ?? ['TARGET']
          }
        ],
        conditionIds: [...input.conditionIds],
        capabilitySuppressions: []
      },
      ...input.conditionIds.map((conditionId) => ({
        kind: 'CONDITION_OWNERSHIP' as const,
        conditionId,
        baselinePresent: false
      }))
    ]
  }
}
