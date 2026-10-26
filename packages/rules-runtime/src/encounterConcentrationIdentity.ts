import { v5 as uuidv5 } from 'uuid'
import {
  damageSaveBinding,
  type ConcentrationDamageApplicationDto,
  type DamageSaveApplicationDto,
  type DamageSaveBindable
} from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'

// Retains the established deterministic child/command identity from the prior backend.
const concentrationNamespace = 'd4b06f4e-c014-49b6-8e39-3a2c790f8d57'
/**
 * One damage-triggered save child per application, holder and source; an effect's repeat save and a
 * massive-damage save also name what they check, so each offering effect or rule gets its own child.
 */
export function concentrationOccurrenceId(
  parentOccurrenceId: string,
  application: DamageSaveBindable
) {
  const base = `${parentOccurrenceId}:${application.ordinal}:${application.sourceNodeId}:${application.sourceOperationKey}:${application.targetActorId}`
  const binding = damageSaveBinding(application)
  const suffix =
    binding === null || binding.source === 'CONCENTRATION'
      ? 'concentration-damage-check'
      : `${binding.id}:${binding.source === 'EFFECT_REPEAT_SAVE' ? 'effect-repeat-save' : 'massive-damage-save'}`
  return uuidv5(`${base}:${suffix}`, concentrationNamespace)
}
/**
 * A damage-triggered save context's damage bound to what it checks (the Concentration state, the
 * effect or the optional rule), the chain item `remaining` holds.
 */
export function damageSaveContextBoundApplication(
  context:
    | {
        source: 'CONCENTRATION'
        application: ConcentrationDamageApplicationDto
        maintainedState: { id: string }
      }
    | {
        source: 'EFFECT_REPEAT_SAVE'
        application: ConcentrationDamageApplicationDto
        activeEffect: { id: string }
      }
    | {
        source: 'MASSIVE_DAMAGE'
        application: ConcentrationDamageApplicationDto
        optionalCombatDefinition: { id: string }
      }
): DamageSaveApplicationDto {
  switch (context.source) {
    case 'CONCENTRATION':
      return { ...context.application, maintainedStateId: context.maintainedState.id }
    case 'EFFECT_REPEAT_SAVE':
      return { ...context.application, activeEffectId: context.activeEffect.id }
    case 'MASSIVE_DAMAGE':
      return {
        ...context.application,
        optionalCombatDefinitionId: context.optionalCombatDefinition.id
      }
  }
}
/** One CONCENTRATION_END child per ended maintained state of a parent commit. */
export function concentrationEndOccurrenceId(
  parentOccurrenceId: string,
  maintainedStateId: string
) {
  return uuidv5(
    `${parentOccurrenceId}:${maintainedStateId}:concentration-end`,
    concentrationNamespace
  )
}
/** The chat entry that tells the table a holder's state ended this grant; a replay reuses it. */
export function grantEndNoticeId(occurrenceId: string, grantId: string) {
  return uuidv5(`${occurrenceId}:${grantId}:grant-end-notice`, concentrationNamespace)
}
export function concentrationCommandId(occurrenceId: string) {
  return uuidv5(`${occurrenceId}:command`, concentrationNamespace)
}
