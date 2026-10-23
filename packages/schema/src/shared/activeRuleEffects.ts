import { z, lazySchema } from '../zod.js'

import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'

import {
  type CharacterGrantFoldModifier,
  equipmentInstanceMechanicSourceSchema,
  modifierOperationSchema,
  senseOperationSchema
} from '../api/characterGrantFoldRules.js'
import { ruleValueDtoSchema } from '../api/rulesRuntime.js'
import { activationDtoSchema } from '../effects/activation.js'
import { actorRelationshipModuleDtoSchema } from '../effects/actorRelationship.js'
import { checkChoiceDtoSchema } from '../effects/check.js'
import { hitPointMaximumReductionRecoveryTagsSchema } from '../effects/hitPointMaximumReduction.js'
import {
  activeRuleEffectLifecycleDtoSchema,
  MAX_ACTIVE_EFFECT_STORED_TICKS,
  MAX_ACTIVE_EFFECT_TURNS,
  activeEffectRestStepDownSchema,
  activeEffectSaveThresholdsSchema,
  activeEffectUsesSchema
} from './activeRuleEffectLifecycle.js'
import { storedEffectOffersSchema } from '../effects/storedEffectOffer.js'
import { storedGrantedActionsSchema } from '../effects/grantedAction.js'
import { combatPerceptionContributionsDtoSchema } from './combatPerception.js'
import {
  activationCodeSchema,
  pathLifecycleConsumeEventSchema,
  pathLifecycleEndEventSchema,
  pathLifecycleEndTriggerAgainstSchema,
  pathLifecycleEndTriggerBySchema,
  pathLifecycleEndTriggerOfSchema,
  pathLifecycleGrantConsumeEventSchema,
  pathLifecycleGrantEndEventSchema
} from './enums.js'
import { postgresUuidSchema } from './postgresUuid.js'
import { basicActionFilterDtoSchema, damageTypeFilterDtoSchema } from './reaction.js'
import { compiledRuleGraphDtoSchema } from './ruleExecutionCore.js'

export {
  activeRuleEffectLifecycleDtoSchema,
  type ActiveRuleEffectLifecycleDto
} from './activeRuleEffectLifecycle.js'

import {
  ruleExecutionCapabilityKeySchema as capabilityKeySchema,
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionIdentifierSchema as identifierSchema,
  ruleExecutionIntegerSchema as integerSchema,
  ruleExecutionLocalNodeIdSchema as localNodeIdSchema,
  ruleExecutionPositiveIntegerSchema as positiveIntegerSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'
import { systemCoreCodeSchema } from './systemCoreCode.js'

/** Hard aggregate-local bound for persisted active effects. */
export const MAX_ACTIVE_RULE_EFFECTS_PER_OWNER = 64
/** Hard Encounter-local bound for maintained state owned by one source actor. */
export const MAX_MAINTAINED_RULE_EFFECT_STATES_PER_ACTOR = 64
/** Hard Encounter-local total of maintained dependents for one source actor. */
export const MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR = 64
/** Actor removal can also empty one foreign state per direct actor-owned effect. */
export const MAX_MAINTENANCE_CLEANUP_TERMINATED_STATES =
  MAX_MAINTAINED_RULE_EFFECT_STATES_PER_ACTOR + MAX_ACTIVE_RULE_EFFECTS_PER_OWNER
/** Actor removal deletes maintained dependents plus direct actor-owned effects. */
export const MAX_MAINTENANCE_CLEANUP_REMOVED_EFFECTS =
  MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR + MAX_ACTIVE_RULE_EFFECTS_PER_OWNER
/** Each maintained dependent may belong to a distinct Character aggregate. */
export const MAX_MAINTENANCE_CLEANUP_CHARACTER_TRANSITIONS =
  MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR

const activeEffectFactsSchema = lazySchema(() =>
  z
    .record(capabilityKeySchema, ruleValueDtoSchema)
    .check(
      z.refine(
        (facts) => Object.keys(facts).length <= RULE_GRAPH_LIMITS.RUNTIME_FACTS,
        `Active effects support at most ${RULE_GRAPH_LIMITS.RUNTIME_FACTS} adapter facts.`
      )
    )
)

/**
 * Events whose consumer deletes the effect without releasing the condition it owns. A
 * condition-owning effect may not list one; a consumer leaves this set once it plans the release
 * (`endedEffectReleases`).
 */
const NON_RELEASING_EFFECT_EVENTS: ReadonlySet<string> = new Set([
  'ON_ABILITY_CHECK',
  'ON_SAVING_THROW',
  'ON_HIT_POINTS_REGAINED',
  'ON_INCAPACITATED',
  'ON_CHOSEN_ITEM_RELEASED'
])

const activeEffectOriginDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('CHARACTER'),
      sourceAggregateId: uuidSchema,
      sourceOccurrenceId: uuidSchema,
      rootCommandId: uuidSchema
    }),
    z.strictObject({
      kind: z.literal('ENCOUNTER'),
      sourceAggregateId: uuidSchema,
      sourceOccurrenceId: uuidSchema,
      rootCommandId: uuidSchema,
      sourceActorId: z.nullable(uuidSchema)
    })
  ])
)

const sortedUniqueEventsSchema = <TEvent extends z.ZodMiniType<string>>(
  event: TEvent,
  noun: string
) =>
  z
    .array(event)
    .check(z.maxLength(16))
    .check(
      z.superRefine((events, context) => {
        if (new Set(events).size !== events.length) {
          context.addIssue({ code: 'custom', message: `Active-effect ${noun} must be unique.` })
        }
        if (events.some((event, index) => index > 0 && events[index - 1]! > event)) {
          context.addIssue({ code: 'custom', message: `Active-effect ${noun} must be sorted.` })
        }
      })
    )

/** The events whose first occurrence ends an active effect: sorted and unique. */
export const activeEffectEndEventsSchema = lazySchema(() =>
  sortedUniqueEventsSchema(pathLifecycleEndEventSchema, 'end events')
)

/**
 * A structured end trigger: an event that ends the effect, narrowed by who causes it and what it
 * touches. It shares the reaction trigger's filter types, and each arm needs a consumer before an
 * effect may carry it. `DAMAGE_TAKEN` ends the effect when its holder takes damage: `by` limits whose
 * damage counts (the effect source's side, for Charm Person) and `damageTypeIds` which types do.
 * `ATTACK_ROLL` and `SPELL_CAST` end it when its holder attacks or casts at an enemy (Sanctuary).
 * `ACTION_USED_ON_HOLDER` ends it when another creature uses one of the named actions on the holder
 * (rousing a sleeper); the ids are basic-action definitions, sorted and unique. `INCAPACITATED` ends
 * it when the effect's source is incapacitated or defeated (`of: 'SOURCE'`, Knight Leadership),
 * wherever the effect sits; the holder's own incapacitation is the `ON_INCAPACITATED` end event.
 */
export const activeEffectEndTriggerSchema = lazySchema(() =>
  z.discriminatedUnion('event', [
    z.strictObject({
      event: z.literal('DAMAGE_TAKEN'),
      by: pathLifecycleEndTriggerBySchema,
      damageTypeIds: z.nullable(damageTypeFilterDtoSchema)
    }),
    z.strictObject({
      event: z.enum(['ATTACK_ROLL', 'SPELL_CAST']),
      against: pathLifecycleEndTriggerAgainstSchema
    }),
    z.strictObject({
      event: z.literal('ACTION_USED_ON_HOLDER'),
      actionDefinitionIds: basicActionFilterDtoSchema
    }),
    z.strictObject({
      event: z.literal('INCAPACITATED'),
      of: pathLifecycleEndTriggerOfSchema
    })
  ])
)

/** The structured end triggers of one effect: unique, in canonical order. */
export const activeEffectEndTriggersSchema = lazySchema(() =>
  z
    .array(activeEffectEndTriggerSchema)
    .check(z.maxLength(16))
    .check(
      z.superRefine((triggers, context) => {
        const keys = triggers.map((trigger) => JSON.stringify(trigger))
        if (new Set(keys).size !== keys.length)
          context.addIssue({
            code: 'custom',
            message: 'Active-effect end triggers must be unique.'
          })
        if (keys.some((key, index) => index > 0 && keys[index - 1]! > key))
          context.addIssue({
            code: 'custom',
            message: 'Active-effect end triggers must be sorted.'
          })
      })
    )
)

/**
 * An event that makes the holder repeat the effect's save outside its own turn, as the stored effect
 * carries it: filters explicit. `DAMAGE_TAKEN` repeats it when the holder takes damage: `by` limits
 * whose damage counts and `damageTypeIds` which types do; `rollInfluence` is how that roll differs
 * from the turn-end one. A room's damage funnel raises it.
 */
export const activeEffectRepeatTriggerSchema = lazySchema(() =>
  z.strictObject({
    event: z.literal('DAMAGE_TAKEN'),
    by: pathLifecycleEndTriggerBySchema,
    damageTypeIds: z.nullable(damageTypeFilterDtoSchema),
    rollInfluence: z.nullable(systemCoreCodeSchema)
  })
)

/** The repeat triggers of one effect: unique, in canonical order. */
export const activeEffectRepeatTriggersSchema = lazySchema(() =>
  z
    .array(activeEffectRepeatTriggerSchema)
    .check(z.minLength(1))
    .check(z.maxLength(16))
    .check(
      z.superRefine((triggers, context) => {
        const keys = triggers.map((trigger) => JSON.stringify(trigger))
        if (new Set(keys).size !== keys.length)
          context.addIssue({
            code: 'custom',
            message: 'Active-effect repeat triggers must be unique.'
          })
        if (keys.some((key, index) => index > 0 && keys[index - 1]! > key))
          context.addIssue({
            code: 'custom',
            message: 'Active-effect repeat triggers must be sorted.'
          })
      })
    )
)

/** The events whose first occurrence uses a grant up: sorted and unique. */
export const activeEffectConsumeEventsSchema = lazySchema(() =>
  sortedUniqueEventsSchema(pathLifecycleConsumeEventSchema, 'consume events')
)

/** The consume events a timed grant can carry: sorted and unique. */
export const activeGrantConsumeEventsSchema = lazySchema(() =>
  sortedUniqueEventsSchema(pathLifecycleGrantConsumeEventSchema, 'grant consume events')
)

/** The end events a timed grant can carry: sorted and unique. */
export const activeGrantEndEventsSchema = lazySchema(() =>
  sortedUniqueEventsSchema(pathLifecycleGrantEndEventSchema, 'grant end events')
)

/** The conditions whose holder ends a timed grant early (condition type ids): sorted and unique. */
export const activeGrantEndConditionIdsSchema = lazySchema(() =>
  sortedUniqueEventsSchema(postgresUuidSchema, 'end conditions')
)

/**
 * The holder ending a timed grant by choice, at the cost of one activation (`FREE` costs none). In
 * an Encounter a costed end is available only on the holder's turn and spends that slot.
 */
export const activeGrantHolderEndSchema = lazySchema(() =>
  z.strictObject({ activation: activationCodeSchema })
)

/** Immutable provenance, compiled plan, and recurrence configuration for one active effect. */
const activeRuleEffectDefinitionBaseDtoSchema = lazySchema(() =>
  z.strictObject({
    origin: activeEffectOriginDtoSchema,
    authoredEffectId: uuidSchema,
    compiledEntryId: uuidSchema,
    frozenGraphNodeId: localNodeIdSchema,
    frozenGraph: compiledRuleGraphDtoSchema,
    /**
     * The effect on the same holder this one ends with (paralyzed "while poisoned this way", D172);
     * null for none. Whatever ends the linked effect ends this one in the same transaction.
     */
    linkedEffectId: z.nullable(uuidSchema),
    adapterFacts: activeEffectFactsSchema,
    perceptionContributions: combatPerceptionContributionsDtoSchema,
    recurrence: z.strictObject({
      recurrenceStage: z.enum(['NONE', 'START_OF_TURN', 'END_OF_TURN']),
      consumeOnFirstEvents: activeEffectConsumeEventsSchema,
      endOnEvents: activeEffectEndEventsSchema,
      endOnTriggers: z._default(activeEffectEndTriggersSchema, []),
      /** Events that repeat the effect's save outside its holder's turn; absent when none do. */
      repeatTriggers: z.optional(activeEffectRepeatTriggersSchema),
      endOnConditionIds: activeGrantEndConditionIdsSchema,
      holderEnd: z.nullable(activeGrantHolderEndSchema),
      /** Only the effect's Encounter source meets its attacker grants and attack consume. */
      fromSourceOnly: z.optional(z.literal(true)),
      /** The effect is active only during its tick anchor's turn while one tick remains. */
      activeOnlyOnFinalAnchorTurn: z.optional(z.literal(true)),
      /** The uses the effect counts before it ends; its lifecycle `remainingUses` starts here. */
      uses: z.optional(activeEffectUsesSchema),
      /** The grants shrink by `step` at each matching rest; its lifecycle `restStepsRemaining` counts the rests left. */
      restStepDown: z.optional(activeEffectRestStepDownSchema),
      /** Only on a repeat save counted to thresholds; its lifecycle `saveTally` counts toward these. */
      saveThresholds: z.optional(activeEffectSaveThresholdsSchema),
      lifetimeScope: z.enum(['OWNER', 'ENCOUNTER']),
      expiration: z.discriminatedUnion('kind', [
        z.strictObject({ kind: z.literal('INDEFINITE') }),
        z.strictObject({
          kind: z.literal('TICKS'),
          // One more than the authorable bound: a grant made on its anchor's own turn gets an extra tick.
          initialRemaining: integerSchema
            .check(z.gte(1))
            .check(z.lte(MAX_ACTIVE_EFFECT_STORED_TICKS)),
          decrementStage: z.enum(['START_OF_TURN', 'END_OF_TURN']),
          /** Whose turn boundary ticks the effect: its holder's, or its Encounter source actor's. */
          anchor: z.enum(['HOLDER', 'SOURCE'])
        })
      ])
    })
  })
)

export const activeRuleEffectStateContributionDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('HIT_POINT_MAXIMUM_REDUCTION'),
    amount: positiveIntegerSchema.check(z.lte(Number.MAX_SAFE_INTEGER)),
    sourceDamageOutcomeId: uuidSchema,
    sourceDamageNodeId: identifierSchema,
    sourceDamageOperationKey: identifierSchema,
    recoveryTags: hitPointMaximumReductionRecoveryTagsSchema,
    /** The attacking Feature or action label ("Life Drain"), frozen when the reduction is created. */
    sourceLabel: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(500)),
    /** Whether the attacker was hidden from players when the reduction was created. */
    sourceHidden: z.boolean()
  })
)

export const activeRuleEffectScalarReductionContributionDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('SCALAR_REDUCTION'),
    valueDefinitionId: uuidSchema,
    amount: positiveIntegerSchema.check(z.lte(Number.MAX_SAFE_INTEGER)),
    stacking: z.literal('ADDITIVE'),
    floor: z.literal(0),
    recoveryTriggers: z
      .array(z.enum(['SHORT_REST', 'LONG_REST']))
      .check(z.minLength(1))
      .check(z.maxLength(2)),
    terminalConsequence: z.literal('TARGET_DIED'),
    sourceOutcomeId: uuidSchema,
    sourceNodeId: identifierSchema,
    sourceOperationKey: identifierSchema
  })
)

const activeRuleEffectConditionContributionDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('CONDITION_OWNERSHIP'),
    conditionId: uuidSchema,
    baselinePresent: z.boolean(),
    /** The creature whose action applied the condition, when it authored `recordsSource`. */
    sourceActorId: z.optional(uuidSchema),
    /** The holder must Dash away from `sourceActorId` (the condition authored `fleesSource`). */
    fleesSource: z.optional(z.literal(true)),
    /** The zone that holds the condition (D146): its spatial effect, which an escape names. */
    heldBySpatialEffectId: z.optional(uuidSchema)
  })
)

/**
 * The escape a zone-held condition offers its holder (D146): `label` names the zone, and `dc` is
 * resolved when the zone is placed (a source save DC is pinned). It escapes the zone named by the
 * effect's held condition (`heldBySpatialEffectId`).
 */
const activeRuleEffectConditionEscapeContributionDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('CONDITION_ESCAPE'),
    label: identifierSchema,
    activation: activationDtoSchema,
    checks: checkChoiceDtoSchema,
    dc: positiveIntegerSchema
  })
)

const activeRuleEffectActorRelationshipContributionDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('ACTOR_RELATIONSHIP'),
    relationshipOutcomeId: uuidSchema,
    /** The source's reach when it took hold, in feet; the hold ends once the held creature is beyond it (D152). */
    sealedReachFeet: z.number().check(z.gte(0)),
    modules: z
      .array(actorRelationshipModuleDtoSchema)
      .check(z.minLength(1))
      .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
    conditionIds: z.array(uuidSchema).check(z.maxLength(32)),
    capabilitySuppressions: z
      .array(
        z.strictObject({
          contributionId: uuidSchema,
          capabilityDefinitionIds: z.array(uuidSchema).check(z.minLength(1)).check(z.maxLength(32))
        })
      )
      .check(z.maxLength(32))
  })
)

export interface ActiveEffectOnEnd {
  turns: number
  modifiers: CharacterGrantFoldModifier[]
}

/**
 * The follow-on grant an ended effect leaves its holder. Typed explicitly because inlining its
 * modifier operations into the contribution and the compiled plan overflows the compiler's
 * inferred-type serialization of the Character mechanics projection.
 */
export const activeEffectOnEndSchema: z.ZodMiniType<ActiveEffectOnEnd> = lazySchema(() =>
  z.strictObject({
    turns: positiveIntegerSchema.check(z.lte(MAX_ACTIVE_EFFECT_TURNS)),
    modifiers: z.array(modifierOperationSchema).check(z.minLength(1)).check(z.maxLength(200))
  })
)

const activeRuleEffectModifierGrantContributionDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('MODIFIER_GRANT'),
      applyGrantOutcomeId: identifierSchema,
      /** Modifier operations frozen at creation, in the Character grant fold's operation shape. */
      modifiers: z.array(modifierOperationSchema).check(z.maxLength(200)),
      /** Sense grants frozen at creation (Darkvision), in the grant fold's sense shape. */
      senses: z.array(senseOperationSchema).check(z.maxLength(200)),
      /** The granting action or item label ("Antitoxin (vial)"), frozen when the grant is created. */
      sourceLabel: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(500)),
      /** Whether the source was hidden from players when the grant was created. */
      sourceHidden: z.boolean(),
      /**
       * The holder's item the cast chose and bound the grant to (Shillelagh's staff): its
       * SOURCE-scoped modifiers apply to that item. Absent for an unbound grant.
       */
      boundItem: z.optional(equipmentInstanceMechanicSourceSchema),
      /**
       * Only on the template a placed zone carries: the events that end the grant the zone leaves
       * on a creature. A created grant reads them from its own `recurrence.endOnEvents`.
       */
      endOnEvents: z.optional(activeEffectEndEventsSchema),
      /**
       * The grant the holder keeps when this effect ends, however it ends (Haste's lethargy): the
       * modifiers are frozen at creation and held for `turns` of the holder's own turns. The effect
       * store creates it where the ended effect is removed; a created follow-on carries none.
       */
      onEnd: z.optional(activeEffectOnEndSchema),
      /**
       * The actions the holder may take while this effect is held (Expeditious Retreat, Haste's extra
       * action). Frozen at creation; the offer is read from the held effect, never from the spell.
       */
      grantedActions: z.optional(storedGrantedActionsSchema),
      /**
       * The choices this effect offers beside its holder's turns (Hunter's Mark's re-mark). Frozen at
       * creation; the offer is read from the held effect, never from the spell. A created follow-on
       * carries none.
       */
      effectOffers: z.optional(storedEffectOffersSchema)
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
)

/**
 * Temporary hit points the effect gave its holder are the effect's own (D156): the holder's pool names
 * the effect as its source, and the effect ending takes them with it while it still is.
 */
const activeRuleEffectTemporaryHitPointsContributionDtoSchema = lazySchema(() =>
  z.strictObject({ kind: z.literal('TEMPORARY_HIT_POINTS_OWNERSHIP') })
)

/**
 * The holder's location is unknown to the observers its lifecycle lists. The Stealth total is
 * frozen here; the observer set is the mutable part and lives in `concealedFromActorIds`.
 */
const activeRuleEffectLocationConcealmentContributionDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('LOCATION_CONCEALMENT'),
    concealmentTotal: z.number().check(z.int())
  })
)

/**
 * The holder belongs to a bond among actors that lasts as long as the effect: each member holds its
 * own effect that lists every member (itself included). The bond is provenance only; it grants no
 * mechanic, and ending the effect on a member leaves the others' bonds to their own durations.
 */
const activeRuleEffectActorLinkContributionDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('ACTOR_LINK'),
    linkOutcomeId: identifierSchema,
    linkKind: z.enum(['TELEPATHIC']),
    memberActorIds: z
      .array(uuidSchema)
      .check(z.minLength(2))
      .check(z.maxLength(RULE_GRAPH_LIMITS.NODES))
  })
)

/**
 * The holder wears another Creature's form while the effect lasts (D130): the Creature's snapshot
 * and hit points replace the holder's, and the effect ending restores them. The actor's own
 * `form` records the origin; this contribution is the rule that put the holder in the form.
 */
const activeRuleEffectCreatureFormContributionDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('CREATURE_FORM'),
    formOutcomeId: identifierSchema,
    creatureId: uuidSchema,
    excessDamageCarriesOver: z.boolean()
  })
)

/**
 * The holder is out of play while the effect lasts (Banishment, Etherealness): its Run actor is
 * untargetable and off the Scene, and the effect ending returns it. `keepsTurn` leaves its turns in
 * initiative. The actor's own `absence` records the state; this contribution is the rule behind it.
 */
const activeRuleEffectPlayAbsenceContributionDtoSchema = lazySchema(() =>
  z.strictObject({ kind: z.literal('PLAY_ABSENCE'), keepsTurn: z.boolean() })
)

/**
 * The holder is immune to one source's use of one authored effect or spell grant (D156, SPELLS-31.T5l):
 * that source's action refuses the holder as a single target and leaves it out of an area. The
 * source is the origin's actor in its Run, and `sourceCharacterId` once the immunity is carried.
 */
const activeRuleEffectSourceImmunityContributionDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('SOURCE_IMMUNITY'),
    /** The authored effect whose save was made, or the spell grant whose use locks the holder out. */
    immuneToId: uuidSchema,
    sourceCharacterId: z.nullable(uuidSchema),
    /** The source's Feature or action label ("Intimidating Presence"), frozen at creation. */
    sourceLabel: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(500))
  })
)

/** Immutable definition of a stored active rule effect: a bounded (possibly empty) aggregate-state contribution list. */
export const activeRuleEffectDefinitionDtoSchema = lazySchema(() =>
  z
    .extend(activeRuleEffectDefinitionBaseDtoSchema, {
      schemaVersion: z.literal(2),
      stateContributions: z
        .array(
          z.discriminatedUnion('kind', [
            activeRuleEffectStateContributionDtoSchema,
            activeRuleEffectScalarReductionContributionDtoSchema,
            activeRuleEffectConditionContributionDtoSchema,
            activeRuleEffectConditionEscapeContributionDtoSchema,
            activeRuleEffectActorRelationshipContributionDtoSchema,
            activeRuleEffectModifierGrantContributionDtoSchema,
            activeRuleEffectTemporaryHitPointsContributionDtoSchema,
            activeRuleEffectLocationConcealmentContributionDtoSchema,
            activeRuleEffectActorLinkContributionDtoSchema,
            activeRuleEffectCreatureFormContributionDtoSchema,
            activeRuleEffectPlayAbsenceContributionDtoSchema,
            activeRuleEffectSourceImmunityContributionDtoSchema
          ])
        )
        .check(z.maxLength(RULE_GRAPH_LIMITS.NODES))
    })
    .check(
      z.superRefine((definition, context) => {
        const sourceDefinitionId = definition.frozenGraph.source.definitionId
        if (definition.authoredEffectId !== sourceDefinitionId) {
          context.addIssue({
            code: 'custom',
            path: ['frozenGraph', 'source', 'definitionId'],
            message: 'Active-effect authored identity must match the frozen graph source.'
          })
        }
        if (
          definition.frozenGraph.sourceEntryBindings?.filter(
            (binding) =>
              binding.sourceEntryId === definition.compiledEntryId &&
              binding.nodeId === definition.frozenGraphNodeId
          ).length !== 1
        ) {
          context.addIssue({
            code: 'custom',
            path: ['frozenGraphNodeId'],
            message: 'Active-effect compiled entry must bind exactly one frozen graph node.'
          })
        }
        if (
          definition.recurrence.lifetimeScope === 'ENCOUNTER' &&
          definition.origin.kind !== 'ENCOUNTER'
        ) {
          context.addIssue({
            code: 'custom',
            path: ['recurrence', 'lifetimeScope'],
            message: 'Encounter-lifetime effects require an Encounter origin.'
          })
        }
        if (
          definition.recurrence.expiration.kind === 'TICKS' &&
          definition.recurrence.expiration.anchor === 'SOURCE' &&
          (definition.origin.kind !== 'ENCOUNTER' || definition.origin.sourceActorId === null)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['recurrence', 'expiration', 'anchor'],
            message: 'Source-anchored expiration requires an Encounter origin with a source actor.'
          })
        }
        if (
          definition.recurrence.endOnTriggers.some(
            (trigger) =>
              ('by' in trigger && trigger.by === 'SOURCE_SIDE') || trigger.event === 'INCAPACITATED'
          ) &&
          (definition.origin.kind !== 'ENCOUNTER' || definition.origin.sourceActorId === null)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['recurrence', 'endOnTriggers'],
            message: 'A source-side end trigger requires an Encounter origin with a source actor.'
          })
        }
        if (definition.stateContributions.some(({ kind }) => kind === 'CONDITION_OWNERSHIP')) {
          const unreleasing = [
            ...definition.recurrence.consumeOnFirstEvents,
            ...definition.recurrence.endOnEvents
          ].filter((event) => NON_RELEASING_EFFECT_EVENTS.has(event))
          if (unreleasing.length)
            context.addIssue({
              code: 'custom',
              path: ['recurrence'],
              message: `Condition-owning effects cannot end on ${unreleasing.join(', ')}: its consumer does not release the condition.`
            })
        }
        if (
          definition.stateContributions.some(({ kind }) => kind === 'CONDITION_ESCAPE') &&
          !definition.stateContributions.some(
            (contribution) =>
              contribution.kind === 'CONDITION_OWNERSHIP' && contribution.heldBySpatialEffectId
          )
        )
          context.addIssue({
            code: 'custom',
            path: ['stateContributions'],
            message: 'A condition escape needs the zone-held condition it escapes.'
          })
        for (const [index, contribution] of definition.perceptionContributions.entries()) {
          if (
            contribution.kind === 'SENSE_GRANT' &&
            contribution.document.gameSystemId !== definition.frozenGraph.source.gameSystemId
          )
            context.addIssue({
              code: 'custom',
              path: ['perceptionContributions', index, 'document', 'gameSystemId'],
              message: 'Active-effect sense grants must belong to the frozen graph Game System.'
            })
        }
      })
    )
)

/**
 * Where a maintained state came from: the action occurrence that started it, or (D151) a Character's
 * Concentration carried out of an earlier Run and reinstated at this Run's START.
 */
export const encounterMaintainedEffectProvenanceDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('ACTION'),
      sourceActionId: z.string().check(z.minLength(1)).check(z.maxLength(240)),
      sourceOccurrenceId: uuidSchema
    }),
    z.strictObject({ kind: z.literal('CARRIED'), casterCharacterId: uuidSchema })
  ])
)

/**
 * Immutable System-owned maintenance identity. The application layer only
 * persists and replaces this descriptor; it never interprets its meaning.
 */
const encounterMaintainedEffectDescriptorBaseDtoSchema = lazySchema(() =>
  z.strictObject({
    maintenanceDefinitionId: uuidSchema,
    definitionChecksum: checksumSchema,
    provenance: encounterMaintainedEffectProvenanceDtoSchema,
    sourceActorId: uuidSchema,
    replacementPolicy: z.literal('REPLACE_SAME_DEFINITION')
  })
)

export const encounterMaintainedEffectDescriptorDtoSchema = lazySchema(() =>
  z.extend(encounterMaintainedEffectDescriptorBaseDtoSchema, {
    schemaVersion: z.literal(2),
    /** Whether the state ends when its last dependent effect does (Concentration), or stays until a terminal event. */
    emptyDependentPolicy: z.enum(['TERMINATE_WHEN_EMPTY', 'RETAIN_UNTIL_TERMINAL'])
  })
)

export type EncounterMaintainedEffectDescriptorDto = z.infer<
  typeof encounterMaintainedEffectDescriptorDtoSchema
>

/** Strict persisted active-effect state reconstructed from immutable definition plus mutable lifecycle. */
export const activeRuleEffectStateDtoSchema = lazySchema(() =>
  z
    .strictObject({
      definition: activeRuleEffectDefinitionDtoSchema,
      lifecycle: activeRuleEffectLifecycleDtoSchema
    })
    .check(
      z.superRefine((state, context) => {
        const configuredExpiration = state.definition.recurrence.expiration
        const remainingTicks = state.lifecycle.remainingTicks
        if (
          state.lifecycle.concealedFromActorIds !== undefined &&
          !state.definition.stateContributions.some(
            (contribution) => contribution.kind === 'LOCATION_CONCEALMENT'
          )
        ) {
          context.addIssue({
            code: 'custom',
            path: ['lifecycle', 'concealedFromActorIds'],
            message: 'Only a location concealment lists the observers it is concealed from.'
          })
        }
        if (
          (state.definition.recurrence.restStepDown === undefined) !==
          (state.lifecycle.restStepsRemaining === undefined)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['lifecycle', 'restStepsRemaining'],
            message: 'Only a step-down effect counts the rests it has left, and every one does.'
          })
        }
        if (
          (configuredExpiration.kind === 'INDEFINITE' && remainingTicks !== null) ||
          (configuredExpiration.kind === 'TICKS' &&
            remainingTicks === null &&
            state.lifecycle.expiresAtCampaignMinute === undefined)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['lifecycle', 'remainingTicks'],
            message: 'Active-effect lifecycle ticks must match its immutable definition.'
          })
        }
        if (
          configuredExpiration.kind === 'TICKS' &&
          remainingTicks !== null &&
          remainingTicks > configuredExpiration.initialRemaining
        ) {
          context.addIssue({
            code: 'custom',
            path: ['lifecycle', 'remainingTicks'],
            message: 'Active-effect remaining ticks may not exceed its initial definition.'
          })
        }
      })
    )
)

export type ActiveGrantHolderEnd = z.infer<typeof activeGrantHolderEndSchema>

/** The events whose first occurrence can use an Encounter grant up. */
export type GrantConsumeEvent = z.infer<typeof pathLifecycleGrantConsumeEventSchema>

/** The events whose first occurrence uses an active effect up. */
export type ActiveEffectConsumeEvent = z.infer<typeof pathLifecycleConsumeEventSchema>

/** The events whose first occurrence ends an active effect. */
export type ActiveEffectEndEvent = z.infer<typeof pathLifecycleEndEventSchema>

/** A structured event that ends an active effect early. */
export type ActiveEffectEndTrigger = z.infer<typeof activeEffectEndTriggerSchema>

/** A structured event that repeats an active effect's save. */
export type ActiveEffectRepeatTrigger = z.infer<typeof activeEffectRepeatTriggerSchema>

/** The events that end an Encounter grant early. */
export type GrantEndEvent = z.infer<typeof pathLifecycleGrantEndEventSchema>
export type ActiveRuleEffectDefinitionDto = z.infer<typeof activeRuleEffectDefinitionDtoSchema>
export type ActiveRuleEffectStateDto = z.infer<typeof activeRuleEffectStateDtoSchema>
