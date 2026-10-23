import { sourceImmunityEffect } from '@artificer-toolkit/rules-runtime/encounterActionEffectPlans'
import { passedWardImmunityPlan } from '@artificer-toolkit/rules-runtime/encounterWardImmunity'

/**
 * The immunity a passed ward grants its action's actor against the warded target, as a new effect
 * plan, or null when the gate granted none.
 */
export function plannedGateImmunityGrant(input: {
  ward: Parameters<typeof passedWardImmunityPlan>[0]['ward']
  state: { id: string; gameSystemId: string }
  occurrenceId: string
  commandId: string
  actorId: string
  sourceCharacterId: string | null
  targetLabel: string
  targetLifetimeScope: 'OWNER' | 'ENCOUNTER'
}) {
  const immunity = passedWardImmunityPlan({
    gameSystemId: input.state.gameSystemId,
    ward: input.ward
  })
  return immunity
    ? {
        id: crypto.randomUUID(),
        plan: sourceImmunityEffect({
          ...immunity,
          origin: {
            encounterId: input.state.id,
            occurrenceId: input.occurrenceId,
            commandId: input.commandId,
            sourceActorId: input.actorId
          },
          sourceCharacterId: input.sourceCharacterId,
          sourceLabel: `Ward of ${input.targetLabel}`,
          lifetimeScope: input.targetLifetimeScope
        })
      }
    : null
}
