import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import type { RuleInputBinding } from '@artificer-toolkit/shared/rules'
import type { EffectOutcomeDefinition } from '../../effectOutcomeRegistry.js'
import { DND5E_ADD_SPEED_TO_MOVEMENT_PROPOSAL_OPERATION_KEY } from './addSpeedToMovement.js'
import { DND5E_CANCEL_TRIGGERING_EVENT_PROPOSAL_OPERATION_KEY } from './cancelTriggeringEvent.js'
import {
  DND5E_ACTOR_LINK_PROPOSAL_OPERATION_KEY,
  DND5E_CONCEAL_PROPOSAL_OPERATION_KEY,
  DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY,
  DND5E_CREATURE_FORM_PROPOSAL_OPERATION_KEY,
  DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_DEPART_PROPOSAL_OPERATION_KEY,
  DND5E_DETECT_CONCEALED_PROPOSAL_OPERATION_KEY,
  DND5E_HEAL_PROPOSAL_OPERATION_KEY,
  DND5E_KILL_PROPOSAL_OPERATION_KEY,
  DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY,
  DND5E_MODIFIER_GRANT_PROPOSAL_OPERATION_KEY,
  DND5E_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY,
  DND5E_STABILIZE_PROPOSAL_OPERATION_KEY,
  DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY,
  DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY,
  DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_TEST_HEAL_PROPOSAL_OPERATION_KEY,
  DND5E_TEST_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY,
  DND5E_TEST_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY,
  type EntryDiceDamageOutcome,
  type Outcome,
  unsupported
} from './effectActionContracts.js'
import { dnd5ePathGatedOperationKey } from './dnd5eTestOperationKeys.js'
import { DND5E_TELEPORT_ALLOWANCE_PROPOSAL_OPERATION_KEY } from './teleportAllowance.js'

/** The outcomes one proposal node applies; forced movement is settled on the Scene by its own node. */
export type Dnd5eRegisteredOutcome =
  | Exclude<Outcome, { kind: 'FORCED_MOVEMENT' }>
  | EntryDiceDamageOutcome
/** The immunity fact a condition reads, which its phase selects: undefined past a path's last condition. */
export type Dnd5eOutcomeContext = { conditionImmuneFactKey: string | undefined }
// An intersection, not Extract: heal and temporary hit points share one variant.
type Definition<Kind extends Dnd5eRegisteredOutcome['kind']> = EffectOutcomeDefinition<
  Dnd5eRegisteredOutcome & { kind: Kind },
  Dnd5eOutcomeContext
>

const literal = (value: string | number): RuleInputBinding => ({ kind: 'LITERAL', value })
const amountPayload = (outcome: { amount: number }) => ({ amount: literal(outcome.amount) })
/** An outcome that stores nothing on the target and carries nothing beyond it. */
function targetOnly(
  operationKey: string,
  options: { pathGated: boolean; changesTargetState: boolean }
) {
  return {
    operationKey,
    pathGatedOperationKey: options.pathGated ? dnd5ePathGatedOperationKey(operationKey) : null,
    payloadInputs: () => ({}),
    payloadOutputs: [],
    changesTargetState: options.changesTargetState
  }
}

/**
 * Every D&D outcome a proposal node applies (ADR 0039 decision 1). An outcome whose state an
 * active-effect plan owns has no path-gated form until that plan can be gated on a test's result.
 */
export const DND5E_EFFECT_OUTCOMES: { [Kind in Dnd5eRegisteredOutcome['kind']]: Definition<Kind> } =
  {
    HEAL: {
      operationKey: DND5E_HEAL_PROPOSAL_OPERATION_KEY,
      pathGatedOperationKey: DND5E_TEST_HEAL_PROPOSAL_OPERATION_KEY,
      payloadInputs: amountPayload,
      payloadOutputs: ['amount'],
      changesTargetState: true
    },
    TEMPORARY_HIT_POINTS: {
      operationKey: DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY,
      pathGatedOperationKey: DND5E_TEST_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY,
      payloadInputs: amountPayload,
      payloadOutputs: ['amount'],
      changesTargetState: true
    },
    DAMAGE: {
      operationKey: DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
      pathGatedOperationKey: DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY,
      payloadInputs: (outcome) => ({
        ...amountPayload(outcome),
        damageTypeId: literal(outcome.damageTypeId)
      }),
      payloadOutputs: ['amount', 'damageTypeId'],
      changesTargetState: true
    },
    // The amount is the graph's own roll, which the test phase binds beside this payload.
    ENTRY_DICE_DAMAGE: {
      operationKey: DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
      pathGatedOperationKey: DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY,
      payloadInputs: (outcome) => ({ damageTypeId: literal(outcome.damageTypeId) }),
      payloadOutputs: ['amount', 'damageTypeId'],
      changesTargetState: true
    },
    CONDITION_APPLY: {
      operationKey: DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY,
      pathGatedOperationKey: DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY,
      payloadInputs: (outcome, context) => ({
        conditionId: literal(outcome.conditionId),
        conditionImmune: {
          kind: 'FACT',
          factKey:
            context.conditionImmuneFactKey ??
            unsupported('D&D result path applies too many conditions.')
        }
      }),
      payloadOutputs: ['conditionId'],
      changesTargetState: true
    },
    SCALAR_REDUCTION: {
      operationKey: DND5E_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY,
      pathGatedOperationKey: DND5E_TEST_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY,
      payloadInputs: (outcome) => ({
        ...amountPayload(outcome),
        valueDefinitionId: literal(outcome.valueDefinitionId),
        recoveryTriggers: literal(JSON.stringify(outcome.recoveryTriggers)),
        terminalConsequence: literal(outcome.terminalConsequence)
      }),
      payloadOutputs: ['amount', 'valueDefinitionId', 'recoveryTriggers', 'terminalConsequence'],
      changesTargetState: true
    },
    STABILIZE: targetOnly(DND5E_STABILIZE_PROPOSAL_OPERATION_KEY, {
      pathGated: true,
      changesTargetState: true
    }),
    KILL: targetOnly(DND5E_KILL_PROPOSAL_OPERATION_KEY, {
      pathGated: true,
      changesTargetState: true
    }),
    DEPART: targetOnly(DND5E_DEPART_PROPOSAL_OPERATION_KEY, {
      pathGated: true,
      changesTargetState: true
    }),
    MANUAL_ADJUDICATION: targetOnly(DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY, {
      pathGated: true,
      changesTargetState: false
    }),
    ADD_SPEED_TO_MOVEMENT: targetOnly(DND5E_ADD_SPEED_TO_MOVEMENT_PROPOSAL_OPERATION_KEY, {
      pathGated: true,
      changesTargetState: false
    }),
    TELEPORT_ALLOWANCE: {
      ...targetOnly(DND5E_TELEPORT_ALLOWANCE_PROPOSAL_OPERATION_KEY, {
        pathGated: true,
        changesTargetState: false
      }),
      payloadInputs: (outcome) => ({
        maxFeet: literal(outcome.maxFeet),
        destinationKind: literal(outcome.destinationKind)
      })
    },
    CANCEL_TRIGGERING_EVENT: targetOnly(DND5E_CANCEL_TRIGGERING_EVENT_PROPOSAL_OPERATION_KEY, {
      pathGated: true,
      changesTargetState: false
    }),
    MODIFIER_GRANT: targetOnly(DND5E_MODIFIER_GRANT_PROPOSAL_OPERATION_KEY, {
      pathGated: false,
      changesTargetState: false
    }),
    ACTOR_LINK: targetOnly(DND5E_ACTOR_LINK_PROPOSAL_OPERATION_KEY, {
      pathGated: false,
      changesTargetState: false
    }),
    CREATURE_FORM: targetOnly(DND5E_CREATURE_FORM_PROPOSAL_OPERATION_KEY, {
      pathGated: false,
      changesTargetState: false
    }),
    CONCEAL: targetOnly(DND5E_CONCEAL_PROPOSAL_OPERATION_KEY, {
      pathGated: false,
      changesTargetState: false
    }),
    DETECT_CONCEALED: targetOnly(DND5E_DETECT_CONCEALED_PROPOSAL_OPERATION_KEY, {
      pathGated: false,
      changesTargetState: false
    })
  }

export function dnd5eOutcomeDefinition<Kind extends Dnd5eRegisteredOutcome['kind']>(
  kind: Kind
): Definition<Kind> {
  return DND5E_EFFECT_OUTCOMES[kind]
}

const DEFINITIONS = Object.values(DND5E_EFFECT_OUTCOMES)
/** The direct proposal each path-gated proposal applies once its test resolves to its path. */
export const DND5E_DIRECT_OPERATION_BY_PATH_GATED_OPERATION: ReadonlyMap<string, string> = new Map(
  DEFINITIONS.flatMap(({ operationKey, pathGatedOperationKey }) =>
    pathGatedOperationKey === null ? [] : [[pathGatedOperationKey, operationKey] as const]
  )
)
/** Every direct outcome proposal key. */
export const DND5E_DIRECT_OUTCOME_OPERATION_KEYS: ReadonlySet<string> = new Set(
  DEFINITIONS.map(({ operationKey }) => operationKey)
)
/** The direct proposals whose outcome an active effect or the room owns, so they store nothing on the target. */
export const DND5E_STATELESS_OUTCOME_OPERATION_KEYS: ReadonlySet<string> = new Set(
  DEFINITIONS.filter(({ changesTargetState }) => !changesTargetState).map(
    ({ operationKey }) => operationKey
  )
)

export type Dnd5eAuthoredOutcome = Extract<
  CompiledEffectGroup['entries'][number],
  { outcome: unknown }
>['outcome']

/**
 * An outcome that needs nothing from its action beyond its target, so it is proposed alike with no
 * test and on a test's result path. Null for any other outcome.
 */
export function dnd5eTargetOnlyOutcome(
  outcome: Dnd5eAuthoredOutcome
): Extract<
  Outcome,
  { kind: 'STABILIZE' | 'DEPART' | 'MANUAL_ADJUDICATION' | 'ADD_SPEED_TO_MOVEMENT' }
> | null {
  if (outcome.effectKind === 'STABILIZE') return { kind: 'STABILIZE' }
  // The target leaves the Scene for a place the table does not model; the commit marks it as
  // departed (D128) and a Scene-bound destination waits for the movement service.
  if (
    outcome.effectKind === 'TELEPORT' &&
    outcome.targetKind !== 'SELF' &&
    (outcome.destinationKind === 'LINKED_LOCATION' || outcome.destinationKind === 'SPECIAL')
  )
    return { kind: 'DEPART' }
  // The Action is spent and the GM rules the result: nothing is stored on the target.
  if (outcome.effectKind === 'MANUAL_ADJUDICATION') return { kind: 'MANUAL_ADJUDICATION' }
  // Dash: the committed action adds the actor's speed to this turn's movement; the commit records it.
  if (outcome.effectKind === 'MOVEMENT_RULE' && outcome.ruleKind === 'ADD_SPEED_TO_MOVEMENT')
    return { kind: 'ADD_SPEED_TO_MOVEMENT' }
  return null
}

/** The outcome an active-effect plan owns, which a test graph never proposes. */
function activeEffectPlanOutcomeKind(
  outcome: Dnd5eAuthoredOutcome
): 'MODIFIER_GRANT' | 'ACTOR_LINK' | 'CREATURE_FORM' | 'CONCEAL' | 'DETECT_CONCEALED' | null {
  if (outcome.effectKind === 'APPLY_GRANT') return 'MODIFIER_GRANT'
  if (outcome.effectKind === 'TELEPATHIC_LINK') return 'ACTOR_LINK'
  if (outcome.effectKind === 'MANIFEST' && outcome.manifestKind === 'CREATURE')
    return 'CREATURE_FORM'
  if (outcome.effectKind === 'CONCEAL_FROM_OBSERVERS') return 'CONCEAL'
  if (outcome.effectKind === 'DETECT_CONCEALED') return 'DETECT_CONCEALED'
  return null
}

/**
 * Refuses an outcome a test graph reached that its active-effect plan should own. A concealment is
 * settled from its holder's own check total, which an attack or a save never produces; any other is
 * one its plan could not carry on the test's result path.
 */
export function dnd5eUnsupportedPlanUnderTest(kind: string): never {
  return unsupported(
    kind === 'CONCEAL' || kind === 'DETECT_CONCEALED'
      ? `D&D ${kind} is settled from its holder's own check total, which an attack or a saving throw never produces.`
      : `D&D ${kind} under a test must be one bounded effect its active-effect plan carries on the test's result path.`
  )
}

export const DND5E_CANCEL_NEEDS_SPELL_CAST_REACTION =
  'D&D cancel-triggering-event outcome belongs to a spell-cast reaction.'

/**
 * The target-only outcome a test's result path proposes (RULES-2.T6c2). Refuses an outcome a test
 * cannot carry for its own reason; null for any other outcome, which the caller reads on.
 */
export function dnd5eTestPathTargetOnlyOutcome(outcome: Dnd5eAuthoredOutcome) {
  const targetOnly = dnd5eTargetOnlyOutcome(outcome)
  if (targetOnly) return targetOnly
  if (outcome.effectKind === 'TELEPORT' && outcome.targetKind === 'SELF')
    unsupported(
      "D&D self teleport takes its reach from a self-targeted action's range, which a test action does not have."
    )
  if (outcome.effectKind === 'CANCEL_TRIGGERING_EVENT')
    unsupported(DND5E_CANCEL_NEEDS_SPELL_CAST_REACTION)
  const planKind = activeEffectPlanOutcomeKind(outcome)
  if (planKind) dnd5eUnsupportedPlanUnderTest(planKind)
  return null
}
