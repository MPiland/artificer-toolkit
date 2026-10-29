import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type { AbilityScoreCapabilityAdapter } from '../../abilityScoreCapability.js'
import type { ActionEconomyCapabilityAdapter } from '../../actionEconomyCapabilityRegistry.js'
import type {
  EncounterEffectHook,
  EncounterEventSubscription,
  EventVocabularyCapabilityAdapter
} from '../../events/encounterEventTable.js'
import type { MaintenanceLinkCapabilityAdapter } from '../../maintenanceLinkCapability.js'
import type { GameSystemPolicyTier } from '../../platformPolicyModules.js'
import type { RollModeCapabilityAdapter } from '../../rollModeCapabilityRegistry.js'
import { tracerAddedDiceFacts } from './encounterTier.js'
import {
  TRACER_ACTOR_ACTION_CAPABILITY_ID,
  TRACER_APPROACH_DEFINITION_IDS,
  TRACER_APPROACHES,
  TRACER_EXCHANGE_ACTION_ALLOWANCE_ID,
  TRACER_ROLL_MODE,
  TRACER_STUNT_MAINTENANCE_DEFINITION_ID,
  TRACER_SYSTEM_ID
} from './system.js'

const spendsExchangeAction: ActionEconomyCapabilityAdapter['spendsAttackAction'] = ({
  activationKind,
  activationAmount
}) => activationKind === 'EXCHANGE_ACTION' && activationAmount === 1

/** One action an exchange; every other activation (defending, invoking) costs nothing. */
const tracerActionEconomyAdapter: ActionEconomyCapabilityAdapter = {
  gameSystemId: TRACER_SYSTEM_ID,
  resolveActionEconomyCapability: (activation) =>
    spendsExchangeAction(activation)
      ? {
          kind: 'REQUIRED',
          capabilityDefinitionId: TRACER_EXCHANGE_ACTION_ALLOWANCE_ID,
          grantedCountDomain: 'EXCHANGE_ACTION_COUNT'
        }
      : { kind: 'NONE' },
  spendsAttackAction: spendsExchangeAction,
  isAttackActionAttack: ({ activationKind, activationAmount, triggerCode, replacesAttack }) =>
    spendsExchangeAction({ activationKind, activationAmount }) &&
    (replacesAttack || triggerCode === 'ATTACK'),
  allowanceDefinitionIdByCountDomain: {
    EXCHANGE_ACTION_COUNT: TRACER_EXCHANGE_ACTION_ALLOWANCE_ID
  },
  actorActionCapabilityDefinitionId: () => TRACER_ACTOR_ACTION_CAPABILITY_ID,
  refreshCapabilityDefinitionIds: () => [TRACER_EXCHANGE_ACTION_ALLOWANCE_ID]
}

function requireTracerRollMode(rollMode: string) {
  if (rollMode !== TRACER_ROLL_MODE) throw new Error(`The tracer has no roll mode "${rollMode}".`)
  return rollMode
}

/** One die, always: the tracer has no roll influences, so nothing changes the mode. */
const tracerRollModeAdapter: RollModeCapabilityAdapter = {
  gameSystemId: TRACER_SYSTEM_ID,
  resolveRollMode(influences) {
    if (influences.length > 0) throw new Error('The tracer has no roll influences.')
    return { rollMode: TRACER_ROLL_MODE, keep: 'FIRST' }
  },
  keepFor: (rollMode) => (requireTracerRollMode(rollMode), 'FIRST'),
  passiveScore: (skillModifier, rollMode) => (requireTracerRollMode(rollMode), 10 + skillModifier)
}

/** An approach rating is its own bonus. */
const tracerAbilityScoreAdapter: AbilityScoreCapabilityAdapter = {
  gameSystemId: TRACER_SYSTEM_ID,
  abilityModifier: (rating) => rating,
  defaultScore: 0,
  abilityDefinitionIdByCode: TRACER_APPROACH_DEFINITION_IDS,
  abilityCode(abilityDefinitionId) {
    const code = TRACER_APPROACHES.find(
      (approach) => TRACER_APPROACH_DEFINITION_IDS[approach] === abilityDefinitionId
    )
    if (!code) throw new Error(`The tracer has no approach "${abilityDefinitionId}".`)
    return code
  }
}

/** What each tracer lifecycle code listens for: an invoke spends on a check, stress or defeat ends. */
const TRACER_LIFECYCLE_SUBSCRIPTIONS: Readonly<Record<string, EncounterEventSubscription>> = {
  INVOKED: { event: 'TEST', test: 'CHECK', valueDomainCode: 'ABILITY_CHECK' },
  TAKEN_OUT: { event: 'DEFEATED' },
  STRESSED: { event: 'DAMAGED', by: 'ANYONE', damageTypeIds: null }
}

function tracerLifecycleSubscription(code: string) {
  const subscription = TRACER_LIFECYCLE_SUBSCRIPTIONS[code]
  if (!subscription)
    throw new Error(`The tracer event vocabulary has no lifecycle event "${code}".`)
  return subscription
}

/** The tracer's codes on the neutral event table; it models no zones and no repeated saves. */
const tracerEventVocabularyAdapter: EventVocabularyCapabilityAdapter = {
  gameSystemId: TRACER_SYSTEM_ID,
  effectHooks(recurrence) {
    if (recurrence.repeatTriggers?.length) throw new Error('The tracer authors no repeat triggers.')
    return [
      ...recurrence.endTriggers.map((trigger): EncounterEffectHook => {
        if (trigger.event !== 'LIFECYCLE')
          throw new Error('The tracer authors no structured end triggers.')
        return { hook: 'END', subscription: tracerLifecycleSubscription(trigger.code) }
      }),
      ...(recurrence.endOnConditionIds.length > 0
        ? [
            {
              hook: 'END' as const,
              subscription: {
                event: 'CONDITION_HELD' as const,
                conditionIds: recurrence.endOnConditionIds
              }
            }
          ]
        : [])
    ]
  },
  zoneSubscription: () => null
}

/** A held stunt breaks when its holder is taken out; stress owes a Careful defence against it. */
const tracerMaintenanceLinkAdapter: MaintenanceLinkCapabilityAdapter = {
  gameSystemId: TRACER_SYSTEM_ID,
  maintenanceDefinitionId: TRACER_STUNT_MAINTENANCE_DEFINITION_ID,
  hooks: [
    { hook: 'BREAK', reason: 'DEFEATED', subscription: { event: 'DEFEATED' } },
    { hook: 'SAVE', subscription: { event: 'DAMAGED', by: 'ANYONE', damageTypeIds: null } }
  ],
  saveAbilityDefinitionId: TRACER_APPROACH_DEFINITION_IDS.CAREFUL,
  saveDc: (appliedDamage) => 10 + appliedDamage,
  // The tracer rates no defence beside its approaches, so the defence adds nothing to the die.
  saveFacts: () => ({
    addedDice: [],
    facts: tracerAddedDiceFacts([]),
    rollMode: TRACER_ROLL_MODE,
    keep: 'FIRST',
    modifier: 0,
    contributors: [],
    contributorChecksum: checksumRuleDocument([])
  })
}

/** The tracer's Sheet-reachable tier: only the capabilities it has, so the rest fail closed. */
export const tracerPolicyTier: GameSystemPolicyTier = {
  gameSystemId: TRACER_SYSTEM_ID,
  abilityScore: tracerAbilityScoreAdapter,
  actionEconomy: tracerActionEconomyAdapter,
  eventVocabulary: tracerEventVocabularyAdapter,
  maintenanceLink: tracerMaintenanceLinkAdapter,
  rollMode: tracerRollModeAdapter,
  policyModules: []
}
