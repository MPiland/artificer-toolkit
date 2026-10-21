import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionCore'

import type { OptionalCombatPolicyPin } from './optionalCombatPolicyCapability.js'

export interface OptionalCombatContestGraph {
  readonly identityChecksum: string
  readonly pin: OptionalCombatPolicyPin
  readonly published: ServerPublishedRuleDefinitionDto
}

/** A System's bounded two-participant contested check graph. The application owns authority and ties. */
export interface ContestCheckCapabilityAdapter {
  readonly gameSystemId: string
  /** The graph fact holding the initiator's check modifier. */
  readonly initiatorModifierFactKey: string
  /** The graph fact holding the target's check modifier. */
  readonly targetModifierFactKey: string
  /** The contest graph identified by the definition that starts it, such as an authored escape. */
  contestGraph(definitionId: string): ServerPublishedRuleDefinitionDto
  /** The contest graph an optional-combat policy starts, retained beside its exact policy pin. */
  optionalCombatContestGraph(pin: OptionalCombatPolicyPin): OptionalCombatContestGraph
}
