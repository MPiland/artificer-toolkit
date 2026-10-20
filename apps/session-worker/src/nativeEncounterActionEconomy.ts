import type { LiveSessionEncounterRulesRequest } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { sizeCodeSchema } from '@artificer-toolkit/schema/shared/enums'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import {
  encounterAttackActionTransition,
  evaluateEncounterAttackAction
} from '@artificer-toolkit/rules-runtime/encounterAttackAction'
import type { ActionEconomyInput } from '@artificer-toolkit/rules-runtime/encounterActionEconomy'
import type { LiveCaptureReads } from './nativeEncounterReads.js'

type Prepared = Awaited<ReturnType<typeof prepareEncounterActionMechanics>>
type EconomyTarget = Parameters<typeof evaluateEncounterAttackAction>[0]['target']
type EconomyCapture = (
  request: LiveSessionEncounterRulesRequest
) => ReturnType<LiveCaptureReads['encounterRules']>

/** The current capability definitions an allowance resolves against, read through the planner's captures. */
export function captureActionEconomyDefinitions(
  capture: EconomyCapture
): ActionEconomyInput['definitions'] {
  return {
    requireCurrent: async (definitionId) => {
      const response = await capture({ kind: 'DEFINITION', definitionId })
      if (response.kind !== 'DEFINITION' || !response.definition)
        throw new Error('Action-economy capability is unavailable.')
      return response.definition
    }
  }
}

/**
 * The action allowance the chosen action spends and the Attack action it opens or continues, for a
 * single target or for every creature an area caught. A suppressed allowance only warns: the
 * command may acknowledge it.
 */
export async function evaluateNativeLiveActionEconomy(input: {
  prepared: Pick<Prepared, 'source' | 'actor'>
  state: EncounterRunState
  actionId: string
  /** The acting actor's own facts. */
  sourceTarget: EconomyTarget
  targetIds: readonly string[]
  /** The size of the one creature the action targets, when a slot's predicate reads it. */
  targetSize?: string | null
  capture: EconomyCapture
}) {
  const { prepared } = input
  const invocation =
    prepared.source.kind === 'CHARACTER_ACTION'
      ? prepared.source.candidate.mechanicFacts.invocation
      : prepared.source.capability.mechanicFacts.invocation
  const { activation } = invocation
  const equipment =
    prepared.source.kind === 'CHARACTER_ACTION' ? prepared.source.candidate.equipment : null
  if (!activation) throw new Error('The selected action activation is not normalized.')
  // A free action (Action Surge, a Legendary Action) spends no allowance; its charge is its cost.
  if (activation.code === 'FREE')
    return { activationCode: activation.code, economy: null, suppressed: false, attackAction: null }
  if (activation.amount === null)
    throw new Error('The selected action activation is not normalized.')
  const featureId =
    prepared.source.kind === 'CREATURE' ? prepared.source.capability.ownerFeatureId : undefined
  const targetSize = sizeCodeSchema.safeParse(input.targetSize)
  const {
    economy,
    attackAction: openedAttackAction,
    suppressed
  } = await evaluateEncounterAttackAction({
    triggerCode: invocation.triggerCode,
    replacesAttack:
      prepared.source.kind === 'BASIC_ACTION' && prepared.source.capability.actionCost === 'ATTACK',
    featureId,
    targetIds: input.targetIds,
    targetSize: targetSize.success ? targetSize.data : null,
    actor: prepared.actor,
    state: input.state,
    activation: { code: activation.code, amount: activation.amount },
    target: input.sourceTarget,
    loadTarget: async () => input.sourceTarget,
    definitions: captureActionEconomyDefinitions(input.capture)
  })
  return {
    activationCode: activation.code,
    economy,
    suppressed,
    attackAction: openedAttackAction
      ? encounterAttackActionTransition(openedAttackAction, {
          actionId: input.actionId,
          ...(featureId ? { featureId } : {}),
          targetIds: [...input.targetIds],
          ...(targetSize.success ? { targetSize: targetSize.data } : {}),
          ...(equipment
            ? {
                item: {
                  itemInstanceId: equipment.itemInstanceId,
                  properties: [...(equipment.properties ?? [])]
                }
              }
            : {})
        })
      : null
  }
}
