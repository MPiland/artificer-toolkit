import { DOMAIN_REJECTION_MESSAGES } from '@artificer-toolkit/schema/api/domainRejections'
import type {
  EncounterAcceptedWieldConflictDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionForcedMovement } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { encounterLegendaryActionFeatureIds } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { encounterActionRequirementsHold } from '@artificer-toolkit/rules-runtime/encounterActionRequirements'
import {
  encounterAttackActionState,
  snapshotCreatureTypeId
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import { holderStateRestrictionsHold } from '@artificer-toolkit/rules-runtime/encounterActiveGrants'
import { encounterBasicActionAdmission } from '@artificer-toolkit/rules-runtime/encounterBasicActionRestrictions'
import { encounterHolderState } from '@artificer-toolkit/rules-runtime/encounterHolderDefense'
import { lockedRelationshipActionFacts } from '@artificer-toolkit/rules-runtime/encounterRelationshipActionFacts'
import { encounterActionReachFeet } from '@artificer-toolkit/rules-runtime/encounterActionTargetPolicy'
import { encounterSourceImmunityLabel } from '@artificer-toolkit/rules-runtime/encounterSourceImmunity'
import { encounterSpellSchoolImmunity } from '@artificer-toolkit/rules-runtime/encounterSpellSchoolImmunity'
import { encounterActorEffectiveSize } from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import {
  deadCharacterIdsOfTargets,
  isEncounterActorDefeated
} from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import {
  encounterActionSuppressedWarning,
  evaluateEncounterActionRuleWarnings,
  RULE_WARNINGS_MESSAGE
} from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import {
  encounterConditionFleeSources,
  encounterFleeActionWarnings
} from '@artificer-toolkit/rules-runtime/encounterConditionMechanics'
import { nextRollInt } from '@artificer-toolkit/rules-runtime/random'
import { SQUARE_GRID_COMPASS_RAYS, type ScenePoint } from '@artificer-toolkit/shared/vtt'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import { authoredCheckOf } from './nativeCheckAction.js'
import type { MovementTargets } from './nativeAreaPreparation.js'
import type { evaluateNativeLiveActionEconomy } from './nativeEncounterActionEconomy.js'

type Prepared = Awaited<ReturnType<typeof prepareEncounterActionMechanics>>
type Relationship = Parameters<
  Parameters<typeof prepareEncounterActionMechanics>[0]['loadRelationshipFacts']
>[0]

/** The relationship facts an action's d20s read: the locked ones between the two actors. */
export function nativeLiveRelationshipFacts(input: {
  activeEffectsByActorId: Relationship['activeEffectsByActorId']
}) {
  return async (relationship: Relationship) =>
    lockedRelationshipActionFacts({
      actionEffectId: relationship.actionEffectId,
      sourceActorId: relationship.sourceActorId,
      targetActorId: relationship.targetActorId,
      targets: { activeEffectsByActorId: input.activeEffectsByActorId }
    })
}

/**
 * Every action path admits an action through here: a Legendary Action is taken only in its own
 * window, or as the root a turn end delegated it to (admission proves that root against the turn's
 * receipt), and a reaction only when its trigger happens, never as an ordinary action: as the child
 * action of the reaction its holder chose against a pending action (D219; admission proves that
 * action records the child).
 */
export function refuseActionOutsideItsWindow(
  prepared: Pick<Prepared, 'actor' | 'source'>,
  command: Pick<ResolveEncounterActionInputDto, 'systemTrigger'>
) {
  const { source } = prepared
  if (
    source.kind === 'CREATURE' &&
    command.systemTrigger?.trigger !== 'LEGENDARY_ACTION' &&
    encounterLegendaryActionFeatureIds(prepared.actor).has(source.capability.ownerFeatureId)
  )
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'LEGENDARY_WINDOW_ONLY',
      message: DOMAIN_REJECTION_MESSAGES.LEGENDARY_WINDOW_ONLY
    })
  const { mechanicFacts } =
    source.kind === 'CHARACTER_ACTION' ? source.candidate : source.capability
  if (mechanicFacts.invocation.reactionTrigger && command.systemTrigger?.trigger !== 'REACTION')
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'REACTION_TRIGGER_ONLY',
      message: DOMAIN_REJECTION_MESSAGES.REACTION_TRIGGER_ONLY
    })
}

/**
 * A Character action is taken only by an actor that meets its use path's holder restrictions
 * (Frenzy only while raging). An authored basic action is taken only by an actor that meets its
 * facet restrictions, or that accepted the free held-weapon stow that meets them (D152); an
 * accepted stow it doesn't need is refused.
 */
export async function refuseUnmetActionRestrictions(
  action: {
    source: Prepared['source']
    acceptedWieldConflict: EncounterAcceptedWieldConflictDto | null
  },
  holder: Parameters<typeof encounterHolderState>[0]
) {
  const { source } = action
  if (source.kind === 'CHARACTER_ACTION') {
    const restrictions =
      ('holderRestrictions' in source.entry && source.entry.holderRestrictions) || []
    const holderState = restrictions.length > 0 ? await encounterHolderState(holder) : null
    if (
      holderState &&
      !restrictions.every((current) => holderStateRestrictionsHold(current, holderState))
    )
      throw new LiveSessionDomainRejectionError(422, {
        code: 'DOMAIN_REJECTED',
        reason: 'SOURCE_REQUIREMENTS_NOT_MET',
        message: DOMAIN_REJECTION_MESSAGES.SOURCE_REQUIREMENTS_NOT_MET
      })
    return
  }
  if (source.kind !== 'BASIC_ACTION') return
  const admission = source.capability.restrictions
    ? encounterBasicActionAdmission(
        source.capability.restrictions,
        await encounterHolderState(holder)
      )
    : ({ kind: 'MET' } as const)
  if (admission.kind === 'UNMET')
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'SOURCE_REQUIREMENTS_NOT_MET',
      message: DOMAIN_REJECTION_MESSAGES.SOURCE_REQUIREMENTS_NOT_MET
    })
  const accepted = action.acceptedWieldConflict
  if (
    admission.kind === 'STOW_HELD_WEAPON'
      ? accepted?.kind !== 'STOW_HELD_WEAPON' ||
        accepted.itemInstanceId !== admission.itemInstanceId
      : accepted !== null
  )
    throw new Error(
      admission.kind === 'STOW_HELD_WEAPON'
        ? 'This action would stow a held weapon; confirm it first.'
        : 'This action stows nothing.'
    )
}

/**
 * A check action runs from an authored basic action, or from a Creature feature whose success runs
 * its outcome against a fixed DC (D173). A contest, a concealment check and a stabilizing check are
 * a basic action's alone, and a Character action authored with the check is refused.
 */
export function checkActionSource(prepared: Pick<Prepared, 'source' | 'plan'>) {
  const { source } = prepared
  if (source.kind === 'BASIC_ACTION') return source
  if (
    source.kind === 'CREATURE' &&
    prepared.plan.kind === 'TEST_OUTCOME' &&
    authoredCheckOf(source.capability).dc.kind === 'FIXED'
  )
    return source
  throw new LiveSessionDomainRejectionError(422, {
    code: 'DOMAIN_REJECTED',
    reason: 'SOURCE_REQUIREMENTS_NOT_MET',
    message: 'Only a basic action or a Creature feature with a fixed DC can make this check.'
  })
}

/** An item action with authored requirements is taken only once they hold (an off-hand attack). */
export function refuseUnmetItemActionRequirements(
  prepared: Pick<Prepared, 'source' | 'actor'>,
  state: { turnSequence: number }
) {
  const equipment =
    prepared.source.kind === 'CHARACTER_ACTION' ? prepared.source.candidate.equipment : null
  if (
    equipment &&
    !encounterActionRequirementsHold(equipment.requirements, {
      attackAction: encounterAttackActionState(prepared.actor),
      turnSequence: state.turnSequence,
      actingItemInstanceId: equipment.itemInstanceId
    })
  )
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'SOURCE_REQUIREMENTS_NOT_MET',
      message: DOMAIN_REJECTION_MESSAGES.SOURCE_REQUIREMENTS_NOT_MET
    })
}

/** A target immune to this source's use of the action (D156), or to spells of its school, is refused outright. */
export function refuseImmuneTarget(
  prepared: Pick<Prepared, 'source' | 'targetFacts'>,
  holder: {
    targetEffects: Parameters<typeof encounterSourceImmunityLabel>[0]['holderEffects']
    sourceFacts: Parameters<typeof encounterSpellSchoolImmunity>[0]['sourceFacts']
  }
) {
  const label = encounterSourceImmunityLabel({
    source: prepared.source,
    holderEffects: holder.targetEffects
  })
  const message =
    label !== null
      ? `Immune to ${label}`
      : encounterSpellSchoolImmunity({
            source: prepared.source,
            sourceFacts: holder.sourceFacts,
            target: prepared.targetFacts
          })
        ? 'Immune to spells of this school'
        : null
  if (message)
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message
    })
}

/** The refusal of a target the selected action cannot take. */
export const targetNotPermitted = () =>
  new LiveSessionDomainRejectionError(422, {
    code: 'DOMAIN_REJECTED',
    reason: 'TARGET_UNAVAILABLE',
    message: 'The selected action does not permit this target.'
  })

type RuleWarningInput = Parameters<typeof evaluateEncounterActionRuleWarnings>[0]

/**
 * The warnings a single-target action raises, refused unless the actor acknowledged them, and the
 * overrides they then apply. A target no rule lets the action take is refused outright.
 */
export function targetRuleOverrides(input: {
  prepared: Prepared
  command: Pick<ResolveEncounterActionInputDto, 'acknowledgedWarnings'>
  evaluation: Pick<
    Awaited<ReturnType<typeof evaluateNativeLiveActionEconomy>>,
    'activationCode' | 'economy' | 'suppressed'
  >
  endWarnings: RuleWarningInput['preparedWarnings']
  scene: Pick<RuleWarningInput['target'], 'sceneContext' | 'facing' | 'rangeProven'>
  gameSystemId: string
  movementTargets: ReadonlyMap<string, MovementTargets>
}) {
  const { prepared, movementTargets } = input
  const { activationCode, economy, suppressed } = input.evaluation
  const actorTarget = movementTargets.get(prepared.actor.id)
  if (!actorTarget) throw new Error('Encounter rules input binding mismatch.')
  const targetMovement = movementTargets.get(prepared.target.id)
  const { outcomes } = (
    prepared.source.kind === 'CHARACTER_ACTION'
      ? prepared.source.candidate
      : prepared.source.capability
  ).mechanicFacts
  const ruleWarnings = evaluateEncounterActionRuleWarnings({
    preparedWarnings: [
      ...prepared.ruleWarnings,
      ...encounterFleeActionWarnings({
        sourceActorIds: encounterConditionFleeSources(actorTarget),
        activationCode,
        dash: outcomes.some(
          (outcome) =>
            outcome.kind === 'EFFECT' &&
            outcome.effectKind === 'MOVEMENT_RULE' &&
            outcome.ruleKind === 'ADD_SPEED_TO_MOVEMENT'
        )
      }),
      ...input.endWarnings,
      ...(suppressed ? [encounterActionSuppressedWarning(activationCode)] : [])
    ],
    target: {
      actor: prepared.actor,
      target: prepared.target,
      targetPolicy: prepared.targetPolicy,
      makesAttackRoll: prepared.makesAttackRoll,
      ...input.scene
    },
    targetCreatureTypeId: snapshotCreatureTypeId(prepared.target),
    sizes: {
      gameSystemId: input.gameSystemId,
      actor: encounterActorEffectiveSize(actorTarget),
      target: targetMovement ? encounterActorEffectiveSize(targetMovement) : null
    },
    targetDefeated: isEncounterActorDefeated(
      prepared.target,
      deadCharacterIdsOfTargets(movementTargets.values())
    ),
    targetPreconditions: {
      declared: prepared.adapter.outcomeTargetPreconditions({
        effectKinds: outcomes.flatMap((o) =>
          o.kind === 'EFFECT' && !o.onRollTableRow ? [o.effectKind] : []
        )
      }),
      target: targetMovement
    },
    actionEconomy: economy,
    activationCode,
    acknowledged: input.command.acknowledgedWarnings
  })
  if (ruleWarnings.kind === 'UNSUPPORTED_TARGET') throw targetNotPermitted()
  // The same user-safe rejection the Convex fallback raises, so the room forwards it unchanged.
  if (ruleWarnings.kind === 'UNACKNOWLEDGED')
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'RULE_WARNINGS',
      message: RULE_WARNINGS_MESSAGE,
      warnings: ruleWarnings.warnings
    })
  return ruleWarnings.overrides
}

/** A `RANDOM` push's ray: the one sealed for its target, else a compass ray rolled once with `roll`. */
export function randomRay(
  targetActorId: string,
  sealedRays: readonly { targetActorId: string; ray: ScenePoint }[] | undefined,
  roll: (maximum: number) => number
): ScenePoint {
  return (
    sealedRays?.find((sealed) => sealed.targetActorId === targetActorId)?.ray ??
    SQUARE_GRID_COMPASS_RAYS[roll(SQUARE_GRID_COMPASS_RAYS.length)]!
  )
}

/**
 * The forced movements an action's completed outcome on one target settles in its commit, each still
 * without the square its source may pick (D157); one aside stays within the action's reach. A
 * `RANDOM` move rolls its direction now: it never lets its source pick a shorter distance and stops
 * early only when blocked. A ray already sealed for its target (an area holding a pick for another
 * creature) is kept, never rerolled.
 */
export function interpretForcedMovements(
  prepared: Pick<Prepared, 'adapter' | 'targetPolicy'>,
  input: {
    execution: Parameters<NonNullable<Prepared['adapter']['interpretSpatial']>>[0]['execution']
    occurrenceId: string
    published: Parameters<NonNullable<Prepared['adapter']['interpretSpatial']>>[0]['published']
    targetActorId: string
    random?: (maximum: number) => number
    sealedRays?: readonly { targetActorId: string; ray: ScenePoint }[]
  }
): LiveSessionForcedMovement[] {
  return (prepared.adapter.interpretSpatial?.(input) ?? []).map(
    ({ targetActorId, direction, feet, upTo, collision }) => ({
      targetActorId,
      direction,
      feet,
      upTo: upTo && direction !== 'RANDOM',
      sourceReachFeet:
        direction === 'ASIDE' ? encounterActionReachFeet(prepared.targetPolicy) : null,
      position: null,
      ray:
        direction === 'RANDOM'
          ? randomRay(targetActorId, input.sealedRays, input.random ?? nextRollInt)
          : null,
      collision
    })
  )
}
