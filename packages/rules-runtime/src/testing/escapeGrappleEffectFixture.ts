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
export const DRAG_GRAPPLE_MODULE_ID = fixtureId(6)

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
  /** The holder contests the escape with these checks instead of a fixed `dc` (D152). */
  contestChecks?: { skillIds: string[]; abilityDefinitionIds: string[] }
  /** The grappler's moves drag the target (D105). */
  dragged?: boolean
  /** The grappler holds the target by hand, which fills one of its hands (D152). */
  occupiesHand?: boolean
  /** The hold stands whatever its source does or wherever it stands (a net). */
  sourceIndependent?: boolean
  /** The source follows the target, moving with it (a creature clinging to it). */
  follows?: boolean
  /** Where a won contested escape moves the source (a dislodged climber). */
  holderForcedMovement?: Extract<
    RelationshipContribution['modules'][number],
    { kind: 'ESCAPE_CHECK' }
  >['holderForcedMovement']
}): ActiveRuleEffectDefinitionDto {
  const definitionId = fixtureId(0)
  const entryId = fixtureId(1)
  return {
    schemaVersion: 2,
    linkedEffectId: null,
    originLevel: null,
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
      anchor: 'HOLDER',
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
        sealedReachFeet: 5,
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
            dc: input.contestChecks
              ? { kind: 'CONTEST', checks: input.contestChecks }
              : { kind: 'FIXED', value: input.dc ?? 13 },
            actorKinds: input.actorKinds ?? ['TARGET'],
            ...(input.holderForcedMovement
              ? { holderForcedMovement: input.holderForcedMovement }
              : {})
          },
          ...(input.dragged
            ? [{ id: DRAG_GRAPPLE_MODULE_ID, order: 1, kind: 'TARGET_DRAGGED' as const }]
            : []),
          ...(input.occupiesHand
            ? [{ id: fixtureId(7), order: 2, kind: 'SOURCE_OCCUPIES_HAND' as const }]
            : []),
          ...(input.sourceIndependent
            ? [{ id: fixtureId(8), order: 3, kind: 'SOURCE_INDEPENDENT_HOLD' as const }]
            : []),
          ...(input.follows
            ? [{ id: fixtureId(9), order: 4, kind: 'SOURCE_FOLLOWS_TARGET' as const }]
            : [])
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
