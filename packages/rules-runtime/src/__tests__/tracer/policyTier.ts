import type { ActionEconomyCapabilityAdapter } from '../../actionEconomyCapabilityRegistry.js'
import type { GameSystemPolicyTier } from '../../platformPolicyModules.js'
import {
  TRACER_ACTOR_ACTION_CAPABILITY_ID,
  TRACER_EXCHANGE_ACTION_ALLOWANCE_ID,
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

/** The tracer's Sheet-reachable tier: only the capabilities it has, so the rest fail closed. */
export const tracerPolicyTier: GameSystemPolicyTier = {
  gameSystemId: TRACER_SYSTEM_ID,
  actionEconomy: tracerActionEconomyAdapter,
  policyModules: []
}
