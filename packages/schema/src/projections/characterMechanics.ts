import { z, lazySchema, lazySchemaParts } from '../zod.js'

import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema,
  characterRuleSenseRangeSchema,
  type CharacterRulePolicyInput,
  type CharacterRulePolicyOutput
} from '../api/characterRules.js'
import { modifierOperationSchema, senseOperationSchema } from '../api/characterGrantFoldRules.js'
import { characterAuthoredDtoSchema, type CharacterAuthoredDto } from '../subjects/character.js'
import { characterProvenanceDtoSchema } from '../subjects/characterIntent.js'
import { rangeDtoSchema } from '../shared/range.js'
import {
  abilityCodeSchema,
  equipmentCategoryCodeSchema,
  equipmentPropertyCodeSchema
} from '../shared/enums.js'
import { shapeDtoSchema, shapeMeasurementDtoSchema } from '../shared/shape.js'
import {
  SPATIAL_TURN_TRIGGERS,
  spatialTriggerDtoSchema,
  spatialTurnTriggerDtoSchema
} from '../shared/spatialFacts.js'
import {
  compiledSpatialHeldConditionDtoSchema,
  spatialZoneLabelSchema,
  zoneBlockingRulesSchema,
  zoneMovementCostMultiplierSchema,
  zoneRequiredSightSchema
} from '../shared/spatial.js'
import { summonStatBlockDtoSchema } from '../effects/manifest.js'
import { targetingDtoSchema } from '../effects/targeting.js'
import { ruleValueDtoSchema } from '../api/rulesRuntime.js'
import {
  combatPerceptionContributionsDtoSchema,
  senseReusableDefinitionDocumentDtoSchema
} from '../shared/combatPerception.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  authoredVersionVectorSchema,
  type AuthoredVersionVector,
  jsonValueSchema,
  type JsonValue,
  projectionChecksumSchema,
  projectionIdentifierSchema,
  projectionSchemaVersionSchema
} from './identity.js'
import {
  serverPublishedRuleDefinitionDtoSchema,
  ruleGraphSourceIdentityDtoSchema
} from '../shared/ruleExecutionCore.js'
import { compiledEffectOffersSchema } from '../effects/storedEffectOffer.js'
import { storedGrantedActionsSchema } from '../effects/grantedAction.js'
import {
  activeEffectConsumeEventsSchema,
  activeEffectOnEndSchema,
  activeEffectEndEventsSchema,
  activeEffectEndTriggersSchema,
  activeEffectRepeatTriggersSchema,
  activeGrantEndConditionIdsSchema,
  activeGrantHolderEndSchema
} from '../shared/activeRuleEffects.js'
import { serverUuidIdentityDtoSchema } from '../shared/serverUuidIdentity.js'
import {
  MAX_ACTION_RIDERS,
  MAX_ACTIVE_EFFECT_TURNS,
  activeEffectSaveThresholdsSchema,
  activeEffectUsesSchema
} from '../shared/activeRuleEffectLifecycle.js'
import {
  characterInitiativeActorFactsSchema,
  type CharacterInitiativeActorFacts
} from './characterInitiativeFacts.js'
import { actorRelationshipModuleDtoSchema } from '../effects/actorRelationship.js'
import { attackSlotConditionDtoSchema } from '../features/attackSlots.js'
import { characterResourcePoolIdentitySchema } from '../shared/characterResourceIdentity.js'

const nonNegativeStreamVersionSchema = lazySchema(() => z.number().check(z.int()).check(z.gte(0)))
const compiledActionResourceIdentitySchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
)

/**
 * Server-only source retained by a freshly compiled Character action.  It is
 * intentionally a source document, not a second executable graph: the
 * System compiler specializes its bounded TEST/OUTCOME phases only after the
 * Encounter command locks actor, target, cast, and scaling facts.
 */
const compiledActionCompilerSourceSchema = lazySchema(() =>
  z
    .strictObject({
      schemaVersion: z.literal(1),
      sourceId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
      entryPointDefinitionId: serverUuidIdentityDtoSchema,
      effectId: serverUuidIdentityDtoSchema,
      conditionDefinitionIds: z.array(serverUuidIdentityDtoSchema).check(z.maxLength(1_000)),
      savingThrowAbilityDefinitionId: z.nullable(serverUuidIdentityDtoSchema),
      /** The exact compiler-normalized Effect; never exposed by a recipient projection. */
      compiledEffect: jsonValueSchema,
      compiledEffectChecksum: projectionChecksumSchema,
      capabilityContractVersion: z.number().check(z.int()).check(z.positive()).check(z.lte(10_000)),
      /** The test is the save made over the zone the action places as it appears (D154). */
      zoneAppearSave: z.optional(z.literal(true)),
      compilerSourceChecksum: projectionChecksumSchema
    })
    .check(
      z.superRefine((source, context) => {
        const sortedIds = [...source.conditionDefinitionIds].sort((left, right) =>
          left.localeCompare(right)
        )
        if (
          source.conditionDefinitionIds.some((id, index) => id !== sortedIds[index]) ||
          new Set(source.conditionDefinitionIds).size !== source.conditionDefinitionIds.length
        ) {
          context.addIssue({
            code: 'custom',
            path: ['conditionDefinitionIds'],
            message: 'Compiled action condition definition identities must be sorted and unique.'
          })
        }
        if (source.entryPointDefinitionId !== source.effectId) {
          context.addIssue({
            code: 'custom',
            path: ['entryPointDefinitionId'],
            message: 'Compiled action source entry point must equal its authored Effect identity.'
          })
        }
        if (checksumRuleDocument(source.compiledEffect) !== source.compiledEffectChecksum) {
          context.addIssue({
            code: 'custom',
            path: ['compiledEffectChecksum'],
            message: 'Compiled action source effect checksum is invalid.'
          })
        }
        const { compilerSourceChecksum: _checksum, ...checksummed } = source
        if (checksumRuleDocument(checksummed) !== source.compilerSourceChecksum) {
          context.addIssue({
            code: 'custom',
            path: ['compilerSourceChecksum'],
            message: 'Compiled action compiler-source checksum is invalid.'
          })
        }
      })
    )
)
export type CompiledActionCompilerSource = z.infer<typeof compiledActionCompilerSourceSchema>

export const pinnedSenseDefinitionSchema = lazySchema(() =>
  z.strictObject({
    senseDefinitionId: serverUuidIdentityDtoSchema,
    definitionVersion: z.number().check(z.int()).check(z.positive()),
    definitionContractVersion: z.number().check(z.int()).check(z.positive()).check(z.lte(10_000)),
    definitionChecksum: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
    document: senseReusableDefinitionDocumentDtoSchema,
    range: characterRuleSenseRangeSchema
  })
)
export type PinnedSenseDefinition = z.infer<typeof pinnedSenseDefinitionSchema>

export {
  characterInitiativeActorFactsSchema,
  type CharacterInitiativeActorFacts
} from './characterInitiativeFacts.js'

const compiledActionResourceBindingSchema = lazySchema(() =>
  z.strictObject({
    poolId: characterResourcePoolIdentitySchema,
    chargeId: compiledActionResourceIdentitySchema,
    cost: z.number().check(z.int()).check(z.gte(1)).check(z.lte(Number.MAX_SAFE_INTEGER))
  })
)

/** The maintained effect (Concentration) an action starts, resolved under the Encounter transaction. */
const compiledActionMaintenanceSchema = lazySchema(() =>
  z.nullable(
    z.strictObject({
      definitionId: serverUuidIdentityDtoSchema,
      /** Resolved under the Encounter transaction before any aggregate mutation. */
      definitionChecksum: z.nullable(z.string().check(z.regex(/^[a-f0-9]{64}$/))),
      owner: z.literal('SOURCE_ACTOR'),
      replacementPolicy: z.literal('REPLACE_SAME_DEFINITION'),
      emptyDependentPolicy: z.enum(['TERMINATE_WHEN_EMPTY', 'RETAIN_UNTIL_TERMINAL'])
    })
  )
)

const compiledActionActiveEffectPlanObjectSchema = lazySchema(() =>
  z.strictObject({
    authoredEffectId: serverUuidIdentityDtoSchema,
    compiledEntryId: serverUuidIdentityDtoSchema,
    frozenGraphNodeId: z.string().check(z.regex(/^[a-z][a-z0-9_-]{0,79}$/)),
    frozenGraph: serverPublishedRuleDefinitionDtoSchema,
    capabilityContractVersion: z.number().check(z.int()).check(z.positive()).check(z.lte(10_000)),
    recurrenceStage: z.enum(['NONE', 'START_OF_TURN', 'END_OF_TURN']),
    initialRemaining: z.nullable(
      z.number().check(z.int()).check(z.gte(1)).check(z.lte(MAX_ACTIVE_EFFECT_TURNS))
    ),
    tickAnchor: z._default(z.enum(['HOLDER', 'SOURCE']), 'HOLDER'),
    /** Set on a plan of a hit-point-tiered action: it holds only for a target at most this many hit points. */
    hitPointTier: z.optional(z.strictObject({ atMost: z.number().check(z.int()).check(z.gte(1)) })),
    /** Set on a repeat-save plan that counts saves: frozen into the effect's recurrence. */
    saveThresholds: z.optional(activeEffectSaveThresholdsSchema),
    /**
     * Set on a plan whose outcome is authored on a test's result path: the effect is made only when
     * the action's test resolved to one of these paths, which the System lists (a hit's outcome: a hit
     * or a critical hit). Absent for an effect every resolution makes.
     */
    resultGate: z.optional(
      z.strictObject({
        paths: z
          .array(z.string().check(z.regex(/^[A-Z][A-Z_]{0,39}$/)))
          .check(z.minLength(1))
          .check(z.maxLength(8))
      })
    ),
    adapterFacts: z.record(
      z.string().check(z.regex(/^[a-z][a-z0-9.-]{0,79}$/)),
      ruleValueDtoSchema
    ),
    castSaveDcFactKey: z._default(
      z.nullable(z.string().check(z.regex(/^[a-z][a-z0-9.-]{0,79}$/))),
      null
    ),
    /** Cast evidence facts the effect keeps for its recurring executions (D156). */
    castFactKeys: z.optional(
      z.array(z.string().check(z.regex(/^[a-z][a-z0-9.-]{0,79}$/))).check(z.maxLength(8))
    ),
    /** The recurring entry first fires at its stage, not at cast (D156). */
    recurrenceDeferred: z.optional(z.boolean()),
    /** The effect owns the temporary hit points it gives, released when it ends (D156). */
    ownsTemporaryHitPoints: z.optional(z.boolean()),
    perceptionContributions: combatPerceptionContributionsDtoSchema,
    conditionContributions: z._default(
      z
        .array(
          z.strictObject({
            conditionId: serverUuidIdentityDtoSchema,
            recordsSource: z._default(z.boolean(), false),
            fleesSource: z._default(z.boolean(), false)
          })
        )
        .check(z.maxLength(8)),
      []
    ),
    lifecycle: z._default(
      z.strictObject({
        consumeOnFirstEvents: z._default(activeEffectConsumeEventsSchema, []),
        endOnEvents: z._default(activeEffectEndEventsSchema, []),
        endOnTriggers: z._default(activeEffectEndTriggersSchema, []),
        repeatTriggers: z.optional(activeEffectRepeatTriggersSchema)
      }),
      { consumeOnFirstEvents: [], endOnEvents: [], endOnTriggers: [] }
    ),
    modifierGrantContribution: z._default(
      z.nullable(
        z
          .strictObject({
            applyGrantOutcomeId: serverUuidIdentityDtoSchema,
            modifiers: z.array(modifierOperationSchema).check(z.maxLength(200)),
            senses: z.array(senseOperationSchema).check(z.maxLength(200)),
            includesCurrentTurn: z.boolean(),
            countedByTurnEffects: z.optional(z.boolean()),
            consumeOnFirstEvents: activeEffectConsumeEventsSchema,
            endOnEvents: activeEffectEndEventsSchema,
            endOnConditionIds: activeGrantEndConditionIdsSchema,
            holderEnd: z.nullable(activeGrantHolderEndSchema),
            fromSourceOnly: z.optional(z.literal(true)),
            activeOnlyOnFinalAnchorTurn: z.optional(z.literal(true)),
            uses: z.optional(activeEffectUsesSchema),
            onEnd: z.optional(activeEffectOnEndSchema),
            grantedActions: z.optional(storedGrantedActionsSchema),
            effectOffers: z.optional(compiledEffectOffersSchema)
          })
          .check(
            z.refine(
              (contribution) =>
                contribution.modifiers.length +
                  contribution.senses.length +
                  (contribution.grantedActions?.length ?? 0) +
                  (contribution.effectOffers?.length ?? 0) >
                0,
              'A grant contribution grants a modifier, a sense, an action or an offer.'
            )
          )
      ),
      null
    ),
    actorRelationshipContribution: z._default(
      z.nullable(
        z.strictObject({
          relationshipOutcomeId: serverUuidIdentityDtoSchema,
          heldAtOnce: z.number().check(z.int()).check(z.gte(1)),
          appliesWhen: z.optional(attackSlotConditionDtoSchema),
          modules: z
            .array(actorRelationshipModuleDtoSchema)
            .check(z.minLength(1))
            .check(z.maxLength(32)),
          conditionIds: z.array(serverUuidIdentityDtoSchema).check(z.maxLength(32)),
          capabilitySuppressions: z
            .array(
              z.strictObject({
                contributionId: serverUuidIdentityDtoSchema,
                capabilityDefinitionIds: z
                  .array(serverUuidIdentityDtoSchema)
                  .check(z.minLength(1))
                  .check(z.maxLength(32))
              })
            )
            .check(z.maxLength(32))
        })
      ),
      null
    ),
    actorLinkContribution: z._default(
      z.nullable(
        z.strictObject({
          linkOutcomeId: serverUuidIdentityDtoSchema,
          linkKind: z.enum(['TELEPATHIC']),
          excludesIntelligenceAtOrBelow: z.number().check(z.int()).check(z.gte(0))
        })
      ),
      null
    ),
    playAbsenceContribution: z.optional(z.strictObject({ keepsTurn: z.boolean() })),
    turnEndGate: z.optional(
      z.strictObject({
        minimumRoll: z.number().check(z.int()).check(z.gte(2)).check(z.lte(20)),
        child: z.strictObject({
          frozenGraphNodeId: z.string().check(z.regex(/^[a-z][a-z0-9_-]{0,79}$/)),
          frozenGraph: serverPublishedRuleDefinitionDtoSchema,
          playAbsence: z.strictObject({ keepsTurn: z.boolean() })
        })
      })
    ),
    creatureFormContribution: z._default(
      z.nullable(
        z.strictObject({
          formOutcomeId: serverUuidIdentityDtoSchema,
          excessDamageCarriesOver: z.boolean(),
          /** The holder's own ability scores the form keeps, by ability definition id. */
          retainedAbilityIds: z.array(serverUuidIdentityDtoSchema).check(z.maxLength(16)),
          /** The holder may end the form on its own turn (Wild Shape: a Bonus Action). */
          holderEnd: z.nullable(activeGrantHolderEndSchema),
          /** The form ends when its holder gains one of these Conditions (Wild Shape: Unconscious). */
          endOnConditionIds: activeGrantEndConditionIdsSchema,
          /** The Creature each chosen form becomes, by the form option's id. */
          forms: z
            .array(
              z.strictObject({
                id: serverUuidIdentityDtoSchema,
                label: z.string().check(z.minLength(1)).check(z.maxLength(160)),
                creatureId: serverUuidIdentityDtoSchema,
                maxTargets: z.number().check(z.int()).check(z.positive())
              })
            )
            .check(z.maxLength(32)),
          /**
           * A rule-filtered choice beside the fixed forms: the cast names the Creature on the command and
           * it must meet this at cast (Polymorph: a beast no higher than the target's challenge rating).
           */
          filter: z.nullable(
            z.strictObject({
              creatureTypeId: z.nullable(serverUuidIdentityDtoSchema),
              challengeRatingCapKind: z.enum(['TARGET', 'FIXED']),
              maxChallengeRatingId: z.nullable(serverUuidIdentityDtoSchema),
              excludedSpeedIds: z.array(serverUuidIdentityDtoSchema).check(z.maxLength(16))
            })
          )
        })
      ),
      null
    ),
    /**
     * The item the action is used on, chosen at use from what its target holds or wears (Heat
     * Metal's metal object); null for none. The chosen item must meet every filter. With `bindsGrant`
     * the grant's modifiers apply only to that item. On `releasedOn` the target drops the item when
     * it can (held, not worn), and a grant with `grantUnlessReleased` is then not applied.
     */
    chosenItem: z._default(
      z.nullable(
        z.strictObject({
          category: z.nullable(equipmentCategoryCodeSchema),
          requiredProperties: z.array(equipmentPropertyCodeSchema).check(z.maxLength(16)),
          excludedProperties: z.array(equipmentPropertyCodeSchema).check(z.maxLength(16)),
          equipmentIds: z.array(serverUuidIdentityDtoSchema).check(z.maxLength(32)),
          bindsGrant: z.boolean(),
          releasedOn: z.nullable(z.enum(['ON_SAVE_FAIL', 'ON_SAVE_SUCCESS'])),
          grantUnlessReleased: z.boolean()
        })
      ),
      null
    ),
    maintenance: z._default(compiledActionMaintenanceSchema, null),
    /**
     * The effects beside the plan's own, in creation order: conditions a save failed by at least
     * `failedBy` also applies, and a gated band's timed conditions after the first (no margin, their
     * own `initialRemaining`), each held by an active effect with its own duration node. Empty for
     * none. Required: plans are recompiled, not read with a default.
     */
    marginRiders: z
      .array(
        z.strictObject({
          compiledEntryId: serverUuidIdentityDtoSchema,
          frozenGraphNodeId: z.string().check(z.regex(/^[a-z][a-z0-9_-]{0,79}$/)),
          failedBy: z.nullable(z.number().check(z.int()).check(z.gte(1)).check(z.lte(30))),
          /** Target turns this effect lasts; null shares the plan's. */
          initialRemaining: z.nullable(
            z.number().check(z.int()).check(z.gte(1)).check(z.lte(MAX_ACTIVE_EFFECT_TURNS))
          ),
          /**
           * The effect it lasts only while (D172): the plan's own effect (`'PRIMARY'`) or an earlier
           * rider, by index; null for its own lifetime.
           */
          endsWith: z.nullable(
            z.union([
              z.literal('PRIMARY'),
              z.number().check(z.int()).check(z.gte(0)).check(z.lt(MAX_ACTION_RIDERS))
            ])
          ),
          conditionContributions: z
            .array(
              z.strictObject({
                conditionId: serverUuidIdentityDtoSchema,
                recordsSource: z.boolean(),
                fleesSource: z.boolean()
              })
            )
            .check(z.minLength(1))
            .check(z.maxLength(8)),
          lifecycle: z.strictObject({
            endOnTriggers: activeEffectEndTriggersSchema
          })
        })
      )
      .check(z.maxLength(MAX_ACTION_RIDERS)),
    /**
     * The immunity a successful save gives the target against this source's action (D156), held by a
     * second active effect under its own frozen graph; null for none.
     */
    sourceImmunity: z._default(
      z.nullable(
        z.strictObject({
          compiledEntryId: serverUuidIdentityDtoSchema,
          frozenGraphNodeId: z.string().check(z.regex(/^[a-z][a-z0-9_-]{0,79}$/)),
          /** A successful save's immunity, or a grant's lockout every creature the cast meets holds. */
          appliesTo: z.enum(['SAVE_SUCCESS', 'EVERY_TARGET']),
          /** The action effect or the grant whose uses the holder is immune to. */
          immuneToId: serverUuidIdentityDtoSchema,
          /** Target turns the immunity lasts; null lasts until something ends it (a long rest). */
          initialRemaining: z.nullable(
            z.number().check(z.int()).check(z.gte(1)).check(z.lte(MAX_ACTIVE_EFFECT_TURNS))
          ),
          frozenGraph: serverPublishedRuleDefinitionDtoSchema
        })
      ),
      null
    ),
    /**
     * The effect that holds a repeat offer for the cast's whole Concentration (D166), bound to the
     * chosen item and ended through the chosen-item release; null for none. It rides the rider
     * slot beside the recurring effect, under its own node of the plan's frozen graph.
     */
    repeatCarrier: z._default(
      z.nullable(
        z.strictObject({
          compiledEntryId: serverUuidIdentityDtoSchema,
          frozenGraphNodeId: z.string().check(z.regex(/^[a-z][a-z0-9_-]{0,79}$/)),
          applyGrantOutcomeId: serverUuidIdentityDtoSchema,
          effectOffers: compiledEffectOffersSchema
        })
      ),
      null
    )
  })
)

/** Named so the many schemas embedding a plan stay within the declaration size limit (TS7056). */
export type CompiledActionActiveEffectPlan = z.infer<
  typeof compiledActionActiveEffectPlanObjectSchema
>

const compiledActionActiveEffectPlanSchema: z.ZodMiniType<CompiledActionActiveEffectPlan> =
  compiledActionActiveEffectPlanObjectSchema

/**
 * A zone the action leaves on the Scene: at the point its user picks (PLACED_SPACE), or centered on
 * its user and moving with them (SOURCE). The geometry is fixed when the point or the user's token is
 * known; everything else is compiled from the authored manifest.
 */
/**
 * What one component of a zone does where it reaches (D154): the movements and turn boundaries that
 * catch a creature there, and the save and outcomes it runs.
 */
const zoneComponentShape = lazySchemaParts(() => ({
  label: spatialZoneLabelSchema,
  triggerModes: z.array(spatialTriggerDtoSchema).check(z.maxLength(3)),
  /** Turn boundaries at which a creature standing in the zone is caught; absent for none. */
  turnTriggers: z.optional(
    z
      .array(spatialTurnTriggerDtoSchema)
      .check(z.minLength(1))
      .check(z.maxLength(SPATIAL_TURN_TRIGGERS.length))
  ),
  /** Whether a mover who crosses at half speed (moves carefully) skips the entry. */
  bypassAtHalfSpeed: z.optional(z.boolean()),
  /** How many times the zone may catch one creature in one turn; absent for no limit. */
  maxApplicationsPerTurn: z.optional(z.number().check(z.int()).check(z.positive())),
  /** Whether a turn boundary catches only a creature wholly inside the zone (not mere overlap). */
  requiresFullyWithin: z.optional(z.boolean()),
  /** The sight an occupant needs between itself and the source to be put through the zone. */
  requiredSight: z.optional(zoneRequiredSightSchema),
  movementCostMultiplier: z.optional(zoneMovementCostMultiplierSchema),
  blockingRules: z.optional(zoneBlockingRulesSchema),
  /** Whether a creature failing the zone's save at the start of its turn loses its Action. */
  failedSaveLosesAction: z.optional(z.boolean()),
  /** The condition the zone holds on a creature failing its save (D146); absent when unheld. */
  heldCondition: z.optional(compiledSpatialHeldConditionDtoSchema),
  /** What a creature the zone triggers on is put through (its authored save and outcomes). */
  entry: compiledActionActiveEffectPlanSchema,
  /** The grant a creature that fails the entry keeps; null when nothing lingers. */
  grant: z.nullable(
    z.strictObject({
      applyGrantOutcomeId: serverUuidIdentityDtoSchema,
      modifiers: z.array(modifierOperationSchema).check(z.maxLength(200)),
      senses: z.array(senseOperationSchema).check(z.maxLength(200)),
      /** The events whose first occurrence ends the grant (a heal ends a speed penalty). */
      endOnEvents: activeEffectEndEventsSchema
    })
  )
}))

/**
 * A zone the action leaves on the Scene: at the point its user picks (PLACED_SPACE), or centered on
 * its user and moving with them (SOURCE). The geometry is fixed when the point or the user's token is
 * known; everything else is compiled from the authored manifest. Its first component covers its own
 * shape; each region component covers an authored region beside it and is placed as a record of its
 * own, maintained by the same Concentration (D154).
 */
export const compiledActionZonePlacementSchema = lazySchema(() =>
  z.strictObject({
    attachment: z.enum(['PLACED_SPACE', 'SOURCE']),
    shape: shapeDtoSchema,
    /**
     * A hollow round zone's wall thickness (D154): the zone is a ring whose inner radius is its
     * outer radius less this. Absent for a filled zone.
     */
    ringThickness: z.optional(z.pick(shapeMeasurementDtoSchema, { amount: true, unit: true })),
    ...zoneComponentShape(),
    /**
     * The zone catches a mover once for each whole such distance it travels inside, where that
     * step completes (D156); absent for once on entry. Resolved to Scene distance units at placement.
     */
    perDistanceMoved: z.optional(z.pick(shapeMeasurementDtoSchema, { amount: true, unit: true })),
    /**
     * Whether an attacker standing in a SOURCE zone who hits its source with a melee attack is
     * caught (D153); absent when not.
     */
    retaliatesMeleeHits: z.optional(z.literal(true)),
    /** Whether the caster designates creatures at cast that the zone never affects. */
    choosesUnaffected: z.optional(z.boolean()),
    /**
     * The continuous bonus the zone adds to every saving throw of an occupant its filter matches
     * (D155); absent for none. A source ability modifier is resolved and pinned at placement.
     */
    occupantSaveBonus: z.optional(
      z.strictObject({
        domain: z.literal('EVERY_SAVING_THROW'),
        dispositionFilter: z.literal('ALLIES_AND_SOURCE'),
        amount: z.discriminatedUnion('kind', [
          z.strictObject({
            kind: z.literal('FIXED'),
            value: z.number().check(z.int()).check(z.positive()).check(z.maximum(30))
          }),
          z.strictObject({
            kind: z.literal('SOURCE_ABILITY_MODIFIER'),
            ability: abilityCodeSchema,
            minimum: z.nullable(z.number().check(z.int()).check(z.minimum(-5)).check(z.maximum(30)))
          })
        ])
      })
    ),
    /**
     * The components that reach a band beside the zone's shape on the side its caster chooses: a
     * straight wall's left or right, a ring's inside or outside (D154). Absent for none.
     */
    regionComponents: z.optional(
      z
        .array(
          z.strictObject({
            region: z.strictObject({
              kind: z.literal('SIDE_BAND'),
              distance: z.pick(shapeMeasurementDtoSchema, { amount: true, unit: true })
            }),
            ...zoneComponentShape()
          })
        )
        .check(z.minLength(1))
        .check(z.maxLength(4))
    ),
    /** The Concentration the placing cast opens; every record it places depends on it (D135). */
    maintenance: compiledActionMaintenanceSchema,
    /** The timed grant the zone's placer holds once it is placed (D153); absent for none. */
    sourceGrant: z.optional(compiledActionActiveEffectPlanSchema)
  })
)

export type CompiledActionZonePlacement = z.infer<typeof compiledActionZonePlacementSchema>

/**
 * A creature an action summons: the stat block its spell authors, and the timed carrier effect that
 * ends the summon with the spell's duration or the Concentration the cast opens. The cast creates a
 * Run actor owned by the caster from the stat block and places it on the Scene at the point the
 * caster picks (T2v2a2).
 */
export const compiledActionSummonPlacementSchema = lazySchema(() =>
  z.strictObject({
    summonOutcomeId: serverUuidIdentityDtoSchema,
    label: z.nullable(z.string().check(z.minLength(1)).check(z.maxLength(160))),
    statBlock: summonStatBlockDtoSchema,
    entry: compiledActionActiveEffectPlanSchema
  })
)

export type CompiledActionSummonPlacement = z.infer<typeof compiledActionSummonPlacementSchema>

/**
 * The zones an action places when its caster picks one at cast (D140): one plan per option of its
 * ON_USE CHOICE path. The options share what is settled before the pick: where the zone is anchored,
 * whether the caster spares creatures, the Concentration the cast opens and the save DC; each may
 * have its own area (D154).
 */
const compiledActionZoneChoiceSchema = lazySchema(() =>
  z.strictObject({
    options: z
      .array(
        z.strictObject({
          optionId: serverUuidIdentityDtoSchema,
          label: z.string().check(z.minLength(1)).check(z.maxLength(160)),
          zone: compiledActionZonePlacementSchema
        })
      )
      .check(z.minLength(2))
      .check(z.maxLength(20))
  })
)

export type CompiledActionZoneChoice = z.infer<typeof compiledActionZoneChoiceSchema>

/**
 * The plans an action runs when its caster picks one option of its CHOICE path at cast (D148):
 * each option's active-effect and execution plans, compiled from the action narrowed to that option.
 * The options share the test and the Concentration the cast opens.
 */
const compiledActionChoiceSchema = lazySchema(() =>
  z.strictObject({
    options: z
      .array(
        z.strictObject({
          optionId: serverUuidIdentityDtoSchema,
          label: z.string().check(z.minLength(1)).check(z.maxLength(160)),
          activeEffectPlan: z.nullable(compiledActionActiveEffectPlanSchema),
          executionPlan: compiledActionExecutionPlanSchema
        })
      )
      .check(z.minLength(2))
      .check(z.maxLength(20))
  })
)

export type CompiledActionChoice = z.infer<typeof compiledActionChoiceSchema>

const compiledActionTemplateIdentitySchema = ruleGraphSourceIdentityDtoSchema

const compiledActionTestOutcomePlanSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('TEST_OUTCOME'),
      compilerSource: compiledActionCompilerSourceSchema,
      test: z.strictObject({
        published: serverPublishedRuleDefinitionDtoSchema,
        template: compiledActionTemplateIdentitySchema
      }),
      /** Empty when a creature form's active-effect plan carries every outcome the TEST selects. */
      outcomes: z
        .array(
          z.strictObject({
            pathCode: projectionIdentifierSchema,
            template: compiledActionTemplateIdentitySchema
          })
        )
        .check(z.maxLength(32))
    })
    .check(
      z.superRefine((plan, context) => {
        if (
          plan.test.published.id !== plan.test.template.definitionId ||
          plan.test.published.gameSystemId !== plan.test.template.gameSystemId ||
          plan.test.published.definitionFamilyKey !== plan.test.template.definitionFamilyKey ||
          plan.test.published.checksum !== plan.test.template.checksum
        ) {
          context.addIssue({
            code: 'custom',
            path: ['test'],
            message: 'The TEST template must identify its exact published graph.'
          })
        }
        const paths = new Set<string>()
        for (const [index, outcome] of plan.outcomes.entries()) {
          if (paths.has(outcome.pathCode)) {
            context.addIssue({
              code: 'custom',
              path: ['outcomes', index, 'pathCode'],
              message: 'TEST_OUTCOME paths must be unique.'
            })
          }
          paths.add(outcome.pathCode)
          if (
            outcome.template.definitionId !== plan.compilerSource.effectId ||
            outcome.template.gameSystemId !== plan.test.published.gameSystemId ||
            outcome.template.definitionFamilyKey !== plan.test.published.definitionFamilyKey
          ) {
            context.addIssue({
              code: 'custom',
              path: ['outcomes', index, 'template'],
              message: 'An OUTCOME template must remain in the TEST action family.'
            })
          }
        }
      })
    )
)

const compiledActionExecutionPlanSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('SINGLE_GRAPH'),
      published: serverPublishedRuleDefinitionDtoSchema
    }),
    compiledActionTestOutcomePlanSchema
  ])
)

/**
 * Server-only authored targeting facts retained with a compiled action. This
 * is an identity/audit carrier; the System adapter decides which exact
 * policies are executable.
 */
export const compiledActionTargetPolicySchema = lazySchema(() =>
  z.strictObject({
    range: rangeDtoSchema,
    targeting: z.nullable(targetingDtoSchema),
    shape: z.nullable(shapeDtoSchema),
    pathOverrides: z
      .array(
        z.strictObject({
          entryId: projectionIdentifierSchema,
          pathGroupId: projectionIdentifierSchema,
          pathCode: projectionIdentifierSchema,
          pathOrder: z.number().check(z.int()).check(z.gte(0)).check(z.lte(9_999)),
          entryOrder: z.number().check(z.int()).check(z.gte(0)).check(z.lte(9_999_999)),
          range: z.nullable(rangeDtoSchema),
          targeting: z.nullable(targetingDtoSchema)
        })
      )
      .check(z.maxLength(1_000))
  })
)
export type CompiledActionTargetPolicy = z.infer<typeof compiledActionTargetPolicySchema>

/**
 * The plans of an action whose result tiers on the target's hit points: one per tier that holds an
 * effect, the target's hit points choosing among them at cast. Absent when `activeEffectPlan`
 * serves every target.
 */
const compiledActionHitPointTierPlansSchema = lazySchema(() =>
  z.optional(z.array(compiledActionActiveEffectPlanSchema).check(z.maxLength(8)))
)

/**
 * The ceilings of every tier of an action whose result tiers on the target's hit points, including
 * a tier that holds no plan (an instant kill). Present exactly when `hitPointTierPlans` is.
 */
const compiledActionHitPointTiersSchema = lazySchema(() =>
  z.optional(
    z
      .array(z.number().check(z.int()).check(z.gte(1)))
      .check(z.minLength(1))
      .check(z.maxLength(8))
  )
)

const compiledActionEntryPointSchema = lazySchema(() =>
  z.union([
    z.strictObject({
      schemaVersion: z.literal(4),
      kind: z.literal('CHARACTER_SPELL_CAST'),
      /** The exact current Character spell-cast candidate identity. */
      actionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(1_000)),
      effectId: serverUuidIdentityDtoSchema,
      spell: z.strictObject({
        spellId: projectionIdentifierSchema,
        versionId: projectionIdentifierSchema,
        version: projectionSchemaVersionSchema,
        checksum: projectionChecksumSchema,
        sourceKind: z.enum([
          'BACKGROUND',
          'CLASS',
          'FEAT',
          'FEATURE',
          'ITEM',
          'OPTION',
          'RACE',
          'SUBCLASS'
        ]),
        sourceInstanceId: projectionIdentifierSchema,
        castLevel: z.number().check(z.int()).check(z.gte(0)).check(z.lte(9)),
        castMode: z.enum(['SPELL_SLOT', 'AT_WILL', 'RITUAL', 'FIXED_LEVEL', 'LIMITED_USE']),
        slotKey: z.nullable(projectionIdentifierSchema),
        resourceOwnerKey: z.nullable(characterResourcePoolIdentitySchema)
      }),
      targetPolicy: compiledActionTargetPolicySchema,
      compilation: z.strictObject({
        kind: z.literal('COMPILED'),
        activeEffectPlan: z.nullable(compiledActionActiveEffectPlanSchema),
        hitPointTierPlans: compiledActionHitPointTierPlansSchema,
        hitPointTiers: compiledActionHitPointTiersSchema,
        executionPlan: compiledActionExecutionPlanSchema
      })
    }),
    z.strictObject({
      schemaVersion: z.literal(4),
      kind: z.literal('CHARACTER_ACTION'),
      actionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
      effectId: serverUuidIdentityDtoSchema,
      targetPolicy: z.optional(compiledActionTargetPolicySchema),
      compilation: z.strictObject({
        kind: z.literal('COMPILED'),
        resourceBinding: z.nullable(compiledActionResourceBindingSchema),
        activeEffectPlan: z.nullable(compiledActionActiveEffectPlanSchema),
        hitPointTierPlans: compiledActionHitPointTierPlansSchema,
        hitPointTiers: compiledActionHitPointTiersSchema,
        /**
         * Set for an action that places a zone; its `executionPlan` then runs only as the save each
         * creature in the zone's area makes as it appears (a TEST_OUTCOME, D154), else never.
         */
        zonePlacement: z.nullable(
          z.union([compiledActionZonePlacementSchema, compiledActionZoneChoiceSchema])
        ),
        /** Set for an action that summons a creature; its `executionPlan` is the carrier's graph. */
        summonPlacement: z.optional(compiledActionSummonPlacementSchema),
        /**
         * Set for an action whose caster picks an option at cast; the top-level plans hold its first
         * option and are never run unswapped. Null when `zonePlacement` is set.
         */
        choice: z.nullable(compiledActionChoiceSchema),
        executionPlan: compiledActionExecutionPlanSchema
      })
    }),
    z.strictObject({
      schemaVersion: z.literal(1),
      kind: z.literal('CHARACTER_ACTION'),
      actionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
      effectId: serverUuidIdentityDtoSchema,
      targetPolicy: z.optional(compiledActionTargetPolicySchema),
      compilation: z.strictObject({
        kind: z.literal('MANUAL'),
        reasonCode: z.enum(['SYSTEM_CAPABILITY_UNAVAILABLE', 'NOT_NORMALIZED'])
      })
    })
  ])
)

export type CompiledActionEntryPoint = z.infer<typeof compiledActionEntryPointSchema>

// Explicitly typed so the projections embedding it stay within the declaration size limit (TS7056).
export const compiledActionEntryPointsSchema: z.ZodMiniType<CompiledActionEntryPoint[]> =
  lazySchema(() => z.array(compiledActionEntryPointSchema).check(z.maxLength(1_000)))

const characterMechanicsContentRefSchema = lazySchema(() =>
  z.strictObject({
    definitionId: projectionIdentifierSchema,
    binding: z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('ACTIVE') }),
      z.strictObject({
        kind: z.literal('REVISION'),
        revisionId: projectionIdentifierSchema
      })
    ]),
    systemId: projectionIdentifierSchema
  })
)

export const characterMechanicsRuleSnapshotSchema = lazySchema(() =>
  z.strictObject({
    characterId: projectionIdentifierSchema,
    systemId: projectionIdentifierSchema,
    classes: z.array(
      z.strictObject({
        classId: projectionIdentifierSchema,
        subclassId: z.optional(projectionIdentifierSchema)
      })
    ),
    features: z.array(
      z.strictObject({
        featureId: projectionIdentifierSchema,
        source: characterProvenanceDtoSchema
      })
    ),
    equipmentItems: z.array(
      z.strictObject({
        instanceId: projectionIdentifierSchema,
        contentRef: characterMechanicsContentRefSchema,
        compiledItem: z.strictObject({
          category: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80))
        })
      })
    )
  })
)

export type CharacterMechanicsRuleSnapshot = z.infer<typeof characterMechanicsRuleSnapshotSchema>

/** Named so the projection embedding the authored Character stays within the declaration size limit (TS7056). */
const characterCommandStateSchema: z.ZodMiniType<CharacterAuthoredDto> = characterAuthoredDtoSchema

/** Named so the projection embedding them stays within the declaration size limit (TS7056). */
const characterRulePolicyInput: z.ZodMiniType<CharacterRulePolicyInput> =
  characterRulePolicyInputSchema
const characterRulePolicyOutput: z.ZodMiniType<CharacterRulePolicyOutput> =
  characterRulePolicyOutputSchema
const characterRuleSnapshot: z.ZodMiniType<CharacterMechanicsRuleSnapshot> =
  characterMechanicsRuleSnapshotSchema
const versionVector: z.ZodMiniType<AuthoredVersionVector> = authoredVersionVectorSchema
const initiativeActorFacts: z.ZodMiniType<CharacterInitiativeActorFacts> =
  characterInitiativeActorFactsSchema
const pinnedSenseDefinitions: z.ZodMiniType<PinnedSenseDefinition[]> = lazySchema(() =>
  z.array(pinnedSenseDefinitionSchema).check(z.maxLength(100))
)
/** Written out so the projection schema never needs its inferred shape serialized (TS7056). */
export type CharacterMechanicsProjection = {
  characterId: string
  commandState: CharacterAuthoredDto
  commandStateChecksum: string
  commandLaneChecksum: string
  projectionSchemaVersion: 2
  projectionChecksum: string
  characterStreamVersion: number
  authoredVersionVector: AuthoredVersionVector
  systemVocabularySnapshotId: string
  systemVocabularySnapshotVersion: number
  systemVocabularySnapshotChecksum: string
  ruleRevisionId: string
  ruleRevisionChecksum: string
  evaluatorVersion: string
  modelContractVersion: number
  ruleSnapshot: CharacterMechanicsRuleSnapshot
  rulePolicyInput: CharacterRulePolicyInput
  rulePolicyOutput: CharacterRulePolicyOutput
  initiativeActorFacts: CharacterInitiativeActorFacts
  pinnedSenseDefinitions: PinnedSenseDefinition[]
  ruleRegistry: Record<string, JsonValue>
  compiledActionEntryPoints: CompiledActionEntryPoint[]
}

const characterMechanicsProjectionObjectSchema = lazySchema(() =>
  z.strictObject({
    characterId: projectionIdentifierSchema,
    commandState: characterCommandStateSchema,
    commandStateChecksum: projectionChecksumSchema,
    commandLaneChecksum: projectionChecksumSchema,
    projectionSchemaVersion: z.literal(2),
    projectionChecksum: projectionChecksumSchema,
    characterStreamVersion: nonNegativeStreamVersionSchema,
    authoredVersionVector: versionVector,
    systemVocabularySnapshotId: projectionIdentifierSchema,
    systemVocabularySnapshotVersion: projectionSchemaVersionSchema,
    systemVocabularySnapshotChecksum: projectionChecksumSchema,
    ruleRevisionId: projectionIdentifierSchema,
    ruleRevisionChecksum: projectionChecksumSchema,
    evaluatorVersion: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80)),
    modelContractVersion: z.number().check(z.int()).check(z.gte(1)).check(z.lte(10_000)),
    ruleSnapshot: characterRuleSnapshot,
    rulePolicyInput: characterRulePolicyInput,
    rulePolicyOutput: characterRulePolicyOutput,
    initiativeActorFacts: z._default(initiativeActorFacts, {
      effectiveSize: null,
      checkTotals: {},
      equippedItems: []
    }),
    pinnedSenseDefinitions,
    ruleRegistry: z.record(z.string(), jsonValueSchema),
    compiledActionEntryPoints: compiledActionEntryPointsSchema
  })
)

export const characterMechanicsProjectionSchema: z.ZodMiniType<CharacterMechanicsProjection> =
  lazySchema(() =>
    characterMechanicsProjectionObjectSchema.check(
      z.superRefine((projection, ctx) => {
        const senses = projection.rulePolicyOutput.senses
        if (projection.pinnedSenseDefinitions.length !== senses.length) {
          ctx.addIssue({
            code: 'custom',
            message: 'Pinned sense definitions must align with final Character senses.',
            path: ['pinnedSenseDefinitions']
          })
        }
        const expectedSenseIds = senses.map((sense) => sense.senseDefinitionId)
        const pinnedSenseIds = projection.pinnedSenseDefinitions.map((pin) => pin.senseDefinitionId)
        const sortedPinnedSenseIds = [...pinnedSenseIds].sort((left, right) =>
          left.localeCompare(right)
        )
        if (pinnedSenseIds.some((id, index) => id !== sortedPinnedSenseIds[index])) {
          ctx.addIssue({
            code: 'custom',
            message: 'Pinned sense definitions must use canonical identity order.',
            path: ['pinnedSenseDefinitions']
          })
        }
        const expectedSenseIdSet = new Set(expectedSenseIds)
        const pinnedSenseIdSet = new Set(pinnedSenseIds)
        if (
          expectedSenseIdSet.size !== expectedSenseIds.length ||
          pinnedSenseIdSet.size !== pinnedSenseIds.length ||
          expectedSenseIdSet.size !== pinnedSenseIdSet.size ||
          [...expectedSenseIdSet].some((id) => !pinnedSenseIdSet.has(id))
        ) {
          ctx.addIssue({
            code: 'custom',
            message:
              'Pinned sense definition identities must exactly match final Character senses.',
            path: ['pinnedSenseDefinitions']
          })
        }
        for (const [index, pin] of projection.pinnedSenseDefinitions.entries()) {
          const sense = senses.find(
            (candidate) => candidate.senseDefinitionId === pin.senseDefinitionId
          )
          if (
            pin.document.id !== pin.senseDefinitionId ||
            pin.document.gameSystemId !== projection.commandState.systemId ||
            checksumRuleDocument(pin.document) !== pin.definitionChecksum ||
            !sense ||
            checksumRuleDocument(pin.range) !== checksumRuleDocument(sense.range)
          ) {
            ctx.addIssue({
              code: 'custom',
              message:
                'Pinned sense definition must match its Character System and final sense range.',
              path: ['pinnedSenseDefinitions', index]
            })
          }
        }
        const candidates = projection.rulePolicyInput.actionCandidates
        const entries = projection.compiledActionEntryPoints
        const actionEntries = entries.filter((entry) => entry.kind === 'CHARACTER_ACTION')
        const spellEntries = entries.filter((entry) => entry.kind === 'CHARACTER_SPELL_CAST')
        if (actionEntries.length !== candidates.length) {
          ctx.addIssue({
            code: 'custom',
            message: 'Compiled action entries must align with action candidates.',
            path: ['compiledActionEntryPoints']
          })
          return
        }
        const seenActionIds = new Set<string>()
        for (const [index, entry] of actionEntries.entries()) {
          const candidate = candidates[index]
          if (
            !candidate ||
            entry.actionId !== candidate.actionId ||
            entry.effectId !== candidate.effectId
          ) {
            ctx.addIssue({
              code: 'custom',
              message: 'Compiled action entry identity must match its ordered action candidate.',
              path: ['compiledActionEntryPoints', index]
            })
          }
          if (seenActionIds.has(entry.actionId)) {
            ctx.addIssue({
              code: 'custom',
              message: 'Compiled action entry identities must be unique.',
              path: ['compiledActionEntryPoints', index]
            })
          }
          seenActionIds.add(entry.actionId)
          const graphOf = (plan: z.infer<typeof compiledActionExecutionPlanSchema>) =>
            plan.kind === 'SINGLE_GRAPH' ? plan.published : plan.test.published
          const published =
            entry.compilation.kind !== 'COMPILED'
              ? []
              : [
                  graphOf(entry.compilation.executionPlan),
                  ...(entry.compilation.choice?.options.map((option) =>
                    graphOf(option.executionPlan)
                  ) ?? [])
                ]
          if (
            published.some(
              (graph) =>
                graph.id !== entry.effectId ||
                graph.gameSystemId !== projection.commandState.systemId
            )
          ) {
            ctx.addIssue({
              code: 'custom',
              message: 'Compiled action graph identity must match its Effect and Character System.',
              path: ['compiledActionEntryPoints', index, 'compilation']
            })
          }
          if (
            entry.compilation.kind === 'COMPILED' &&
            entry.compilation.choice !== null &&
            entry.compilation.zonePlacement !== null
          ) {
            ctx.addIssue({
              code: 'custom',
              message: 'A compiled action picks its option or its zone at cast, never both.',
              path: ['compiledActionEntryPoints', index, 'compilation', 'choice']
            })
          }
          if (
            entry.compilation.kind === 'COMPILED' &&
            'summonPlacement' in entry.compilation &&
            entry.compilation.summonPlacement &&
            (entry.compilation.choice !== null || entry.compilation.zonePlacement !== null)
          ) {
            ctx.addIssue({
              code: 'custom',
              message: 'A compiled action summons a creature or places a zone, never both.',
              path: ['compiledActionEntryPoints', index, 'compilation', 'summonPlacement']
            })
          }
        }
        const spellCandidates = projection.rulePolicyInput.spellCastCandidates
        const spellMechanics = projection.rulePolicyOutput.spellCastMechanics
        const spellDecisions = projection.rulePolicyOutput.spellCastDecisions
        const expectedSpellEntries = new Map(
          spellCandidates.map((candidate) => [candidate.candidateId, candidate])
        )
        for (const [index, entry] of spellEntries.entries()) {
          const candidate = expectedSpellEntries.get(entry.actionId)
          const mechanics = spellMechanics.find((value) => value.candidateId === entry.actionId)
          const decision = spellDecisions.find((value) => value.candidateId === entry.actionId)
          const published =
            entry.compilation.executionPlan.kind === 'SINGLE_GRAPH'
              ? entry.compilation.executionPlan.published
              : entry.compilation.executionPlan.test.published
          if (
            !candidate ||
            !mechanics ||
            !decision ||
            candidate.spellId !== entry.spell.spellId ||
            candidate.source.sourceKind !== entry.spell.sourceKind ||
            candidate.source.sourceInstanceId !== entry.spell.sourceInstanceId ||
            candidate.castLevel !== entry.spell.castLevel ||
            candidate.castMode !== entry.spell.castMode ||
            candidate.resourceOwnerKey !== entry.spell.resourceOwnerKey ||
            decision.slotKey !== entry.spell.slotKey ||
            mechanics.mechanics.filter((value) => value.effectId === entry.effectId).length !== 1 ||
            published.id !== entry.effectId ||
            published.gameSystemId !== projection.commandState.systemId
          ) {
            ctx.addIssue({
              code: 'custom',
              message:
                'Compiled spell action entry must match one current spell-cast candidate, decision, and Effect.',
              path: ['compiledActionEntryPoints', actionEntries.length + index]
            })
          }
          expectedSpellEntries.delete(entry.actionId)
        }
      })
    )
  )

/**
 * The bounded durable identity required to reuse a room's already-validated
 * mechanics snapshot without reading its large rule payload on every command.
 */
export const characterMechanicsProjectionMetadataSchema = lazySchema(() =>
  z.pick(characterMechanicsProjectionObjectSchema, {
    characterId: true,
    commandState: true,
    commandStateChecksum: true,
    commandLaneChecksum: true,
    projectionSchemaVersion: true,
    projectionChecksum: true,
    characterStreamVersion: true,
    authoredVersionVector: true,
    systemVocabularySnapshotId: true,
    systemVocabularySnapshotVersion: true,
    systemVocabularySnapshotChecksum: true,
    ruleRevisionId: true,
    ruleRevisionChecksum: true,
    evaluatorVersion: true,
    modelContractVersion: true
  })
)

export type CharacterMechanicsProjectionMetadata = z.infer<
  typeof characterMechanicsProjectionMetadataSchema
>
