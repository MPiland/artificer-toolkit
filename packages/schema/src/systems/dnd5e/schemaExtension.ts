import type {
  SystemModifierGrantKind,
  SystemReceiptBindings
} from '../../shared/systemSchemaExtension.js'

// The D&D System's additions to the persisted contracts (QUALITY-16.T3). The keys are the System's
// persisted identities, so the rules runtime's D&D System imports them from here.

export const DND5E_ENCOUNTER_LIFECYCLE_DEFINITION_FAMILY_KEY = 'dnd5e-encounter-lifecycle'
export const DND5E_OPTIONAL_COMBAT_DEFINITION_FAMILY_KEY = 'dnd5e-optional-combat'

export const DND5E_SAVE_TEST_OPERATION_KEY = 'dnd5e.save-test-resolution'
export const DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY = 'dnd5e.manual-adjudication-proposal'
export const DND5E_ACTOR_RELATIONSHIP_STATE_OPERATION_KEY = 'dnd5e.actor-relationship-state'
export const DND5E_CONDITION_DURATION_OPERATION_KEY = 'dnd5e.condition-duration'
export const DND5E_SAVE_MODIFIER_FACT_KEY = 'dnd5e.save-modifier'
export const DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY = 'dnd5e.roll-contributor-checksum'
/** The target's condition test-outcome rule (D94): `NONE`, `SAVE_AUTO_FAIL` or `HIT_IS_CRITICAL`. */
export const DND5E_TEST_OUTCOME_RULE_FACT_KEY = 'dnd5e.test-outcome-rule'
export const DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY =
  'dnd5e.active-effect-save-ability-definition-id'
/** Whether this turn's repeat save is attempted; false settles the gated d20 without a request. */
export const DND5E_REPEAT_SAVE_ATTEMPT_ALLOWED_FACT_KEY = 'dnd5e.repeat-save-attempt-allowed'

/** A Rage-style lock that bars every spell cast while it holds. */
export const dnd5eModifierGrantKinds = [
  { valueDomainCode: 'SPELLCASTING_LOCK', modifierKind: 'ENABLE' }
] as const satisfies readonly SystemModifierGrantKind[]

export const dnd5eDefinitionFamilyKeys = [
  DND5E_ENCOUNTER_LIFECYCLE_DEFINITION_FAMILY_KEY,
  DND5E_OPTIONAL_COMBAT_DEFINITION_FAMILY_KEY
] as const

export const dnd5eReceiptBindings = {
  relationshipStateOperationKey: DND5E_ACTOR_RELATIONSHIP_STATE_OPERATION_KEY,
  durationOperationKey: DND5E_CONDITION_DURATION_OPERATION_KEY,
  repeatSave: {
    testOperationKey: DND5E_SAVE_TEST_OPERATION_KEY,
    testContractVersion: 3,
    // A path-gated proposal's key: `dnd5e.<x>` becomes `dnd5e.test-<x>` inside a test graph.
    rulingOperationKey: 'dnd5e.test-manual-adjudication-proposal',
    attemptAllowedFactKey: DND5E_REPEAT_SAVE_ATTEMPT_ALLOWED_FACT_KEY,
    outcomeRuleFactKey: DND5E_TEST_OUTCOME_RULE_FACT_KEY,
    saveModifierFactKey: DND5E_SAVE_MODIFIER_FACT_KEY,
    contributorChecksumFactKey: DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
    saveAbilityDefinitionFactKey: DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY
  }
} as const satisfies SystemReceiptBindings
