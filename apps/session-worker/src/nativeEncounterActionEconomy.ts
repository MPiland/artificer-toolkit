import type { LiveSessionEncounterRulesRequest } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { systemCoreCodeSchema } from '@artificer-toolkit/schema/shared/systemCoreCode'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import {
  encounterAttackActionTransition,
  evaluateEncounterAttackAction
} from '@artificer-toolkit/rules-runtime/encounterAttackAction'
import {
  evaluateEncounterActionEconomy,
  type ActionEconomyInput
} from '@artificer-toolkit/rules-runtime/encounterActionEconomy'
import { encounterActionUndeclared } from '@artificer-toolkit/rules-runtime/encounterInitiativeDeclaredAction'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
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
  /**
   * A held offer that grants one weapon attack (D160): an attack that finds the Action spent is
   * charged to it instead, as one attack of its own Attack action. A `FREE` offer spends its unspent
   * use (`useKey`); any other spends its own allowance (`activation`, Frenzy's Bonus Action).
   */
  weaponAttackOffer?: { useKey: string } | { activation: ActionEconomyInput['activation'] } | null
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
  // A free action (Action Surge, a Legendary Action) spends no allowance; its charge is its cost. A
  // granted action or a free cast-turn repeat spends a once-per-turn key instead (D160, D190a).
  const grantedUseKey =
    prepared.source.kind === 'BASIC_ACTION' || prepared.source.kind === 'REPEAT_PATH'
      ? (prepared.source.grantedUseKey ?? null)
      : null
  if (activation.code === 'FREE')
    return {
      activationCode: activation.code,
      economy: null,
      suppressed: false,
      attackAction: null,
      grantedUseKey
    }
  if (activation.amount === null)
    throw new Error('The selected action activation is not normalized.')
  const featureId =
    prepared.source.kind === 'CREATURE' ? prepared.source.capability.ownerFeatureId : undefined
  const targetSize = systemCoreCodeSchema.safeParse(input.targetSize)
  const economyInput = {
    actor: prepared.actor,
    state: input.state,
    target: input.sourceTarget,
    loadTarget: async () => input.sourceTarget,
    definitions: captureActionEconomyDefinitions(input.capture)
  }
  const evaluated = await evaluateEncounterAttackAction({
    ...economyInput,
    triggerCode: invocation.triggerCode,
    replacesAttack:
      prepared.source.kind === 'BASIC_ACTION' && prepared.source.capability.actionCost === 'ATTACK',
    featureId,
    targetIds: input.targetIds,
    targetSize: targetSize.success ? targetSize.data : null,
    activation: { code: activation.code, amount: activation.amount }
  })
  const offer =
    input.weaponAttackOffer &&
    evaluated.attackAction &&
    evaluated.slot === null &&
    !evaluated.suppressed &&
    evaluated.economy?.available === false
      ? input.weaponAttackOffer
      : null
  const offerEconomy =
    offer && 'activation' in offer
      ? await evaluateEncounterActionEconomy({ ...economyInput, activation: offer.activation })
      : null
  const offered = offer && ('useKey' in offer || offerEconomy?.available) ? offer : null
  const { economy, suppressed } = offered ? { economy: offerEconomy, suppressed: false } : evaluated
  // A declared-action round holds the current actor to the actions it declared; a later attack of an
  // open Attack action, or a FREE granted attack, spends no allowance of its own. Only character and
  // creature actions are declarable, so basic actions and cast-turn repeats stay open.
  if (
    economy &&
    (prepared.source.kind === 'CHARACTER_ACTION' || prepared.source.kind === 'CREATURE') &&
    input.state.currentActorId === prepared.actor.id &&
    input.state.initiativePolicySnapshot?.policy.document.procedure === 'DECLARED_ACTION_ROLL'
  ) {
    const captured = await input.capture({ kind: 'INITIATIVE_ROUND' })
    if (captured.kind !== 'INITIATIVE_ROUND') throw new Error('Turn initiative is unavailable.')
    if (
      encounterActionUndeclared({
        round: captured.state,
        actorId: prepared.actor.id,
        actionId: input.actionId
      })
    )
      rejectDomain('UNDECLARED_ACTION')
  }
  const openedAttackAction = offered
    ? evaluated.attackAction && { ...evaluated.attackAction, total: 1 }
    : evaluated.attackAction
  return {
    activationCode: activation.code,
    economy,
    suppressed,
    grantedUseKey: offered && 'useKey' in offered ? offered.useKey : grantedUseKey,
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
