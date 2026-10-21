import { v5 as uuidv5 } from 'uuid'
import type { ConcentrationDamageApplicationDto } from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'

// Retains the established deterministic child/command identity from the prior backend.
const concentrationNamespace = 'd4b06f4e-c014-49b6-8e39-3a2c790f8d57'
/**
 * One damage-triggered save child per application and holder; an effect's repeat save also names
 * its effect, so a holder with several offering effects gets one child each.
 */
export function concentrationOccurrenceId(
  parentOccurrenceId: string,
  application: ConcentrationDamageApplicationDto & { activeEffectId?: string }
) {
  const base = `${parentOccurrenceId}:${application.ordinal}:${application.sourceNodeId}:${application.sourceOperationKey}:${application.targetActorId}`
  return uuidv5(
    application.activeEffectId === undefined
      ? `${base}:concentration-damage-check`
      : `${base}:${application.activeEffectId}:effect-repeat-save`,
    concentrationNamespace
  )
}
/**
 * A damage-triggered save context's damage bound to what it checks (the Concentration state or the
 * effect), the chain item `remaining` holds.
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
) {
  return context.source === 'CONCENTRATION'
    ? { ...context.application, maintainedStateId: context.maintainedState.id }
    : { ...context.application, activeEffectId: context.activeEffect.id }
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
