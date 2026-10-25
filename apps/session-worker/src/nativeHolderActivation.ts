import type {
  ChangeFacingInputDto,
  EndHeldGrantInputDto,
  EscapeRelationshipInputDto,
  MoveHeldEffectInputDto,
  ReleaseRelationshipInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import {
  evaluateEncounterActionEconomy,
  type ActionEconomyInput
} from '@artificer-toolkit/rules-runtime/encounterActionEconomy'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import {
  encounterActionEconomyWarnings,
  overridesActionEconomy,
  RULE_WARNINGS_MESSAGE
} from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import { captureActionEconomyDefinitions } from './nativeEncounterActionEconomy.js'
import { liveEncounterCaptures, type LiveCaptureReads } from './nativeEncounterReads.js'

type HolderActivationCommand =
  | ChangeFacingInputDto
  | EndHeldGrantInputDto
  | EscapeRelationshipInputDto
  | MoveHeldEffectInputDto
  | ReleaseRelationshipInputDto

/**
 * Admits a command a creature runs on an effect it holds (an Escape, D105, an end of its own
 * grant, D113, or a release of a creature it holds, D152, or a move of an effect
 * it is offered, D160, or a turn of its own facing, ATTACK-12) and reads the Run inputs it plans against: the replay of an already-recorded
 * command, or the admitted command with the reads that fence its commit.
 */
export async function admitNativeLiveHolderCommand(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  command: HolderActivationCommand,
  captures: LiveCaptureReads
) {
  const request = { kind: 'BASIC_ACTION' as const, command }
  const initial = liveSessionEncounterRulesInputSchema.parse({
    ...scope,
    // A player's admitted command lets its follow-up captures read the rules inputs.
    ...(scope.expectedRole === 'PLAYER' ? { action: request } : {}),
    request
  })
  if (
    command.encounterId.toLowerCase() !== initial.encounterId ||
    command.expectedVersion !== initial.expectedVersion
  )
    throw new Error('Live holder command scope mismatch.')
  const reads = liveEncounterCaptures(initial, captures)
  const { capture } = reads
  const admission = await capture(request)
  if (admission.result) return { kind: 'REPLAY' as const, result: admission.result }
  if (!admission.ready) throw new Error('The holder command is unavailable.')
  const { state, system } = await capture({ kind: 'INPUTS' })
  if (state.id !== initial.encounterId || state.version !== initial.expectedVersion)
    throw new Error('Holder command Run inputs changed during capture.')
  return { kind: 'ADMITTED' as const, initial, reads, ready: admission.ready, state, system }
}

/**
 * Spends the activation a holder command costs: its economy consumption, the warnings the command
 * must have acknowledged and the actor after paying. A FREE activation costs nothing. `extraWarnings`
 * are the command's own (a move's range) and are acknowledged alongside the economy's.
 */
export async function spendNativeHolderActivation(input: {
  actor: ActionEconomyInput['actor']
  state: ActionEconomyInput['state']
  holder: NonNullable<ActionEconomyInput['target']>
  activation: { code: 'FREE' } | ActionEconomyInput['activation']
  acknowledgedWarnings: readonly string[]
  extraWarnings?: readonly EncounterRuleWarningDto[]
  capture: ReturnType<typeof liveEncounterCaptures>['capture']
}) {
  const { actor, state, holder, activation, acknowledgedWarnings, capture } = input
  const economy = !('amount' in activation)
    ? null
    : await evaluateEncounterActionEconomy({
        actor,
        state,
        activation,
        target: holder,
        loadTarget: async () => holder,
        definitions: captureActionEconomyDefinitions(capture)
      })
  const warnings = [
    ...(input.extraWarnings ?? []),
    ...encounterActionEconomyWarnings(economy, activation.code)
  ]
  if (!warnings.every((warning) => acknowledgedWarnings.includes(warning.code)))
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'RULE_WARNINGS',
      message: RULE_WARNINGS_MESSAGE,
      warnings
    })
  const actionEconomy = economy?.consumption ?? null
  const spent = actionEconomy
    ? consumeEncounterActionEconomy({
        actor,
        consumption: actionEconomy,
        overridden: overridesActionEconomy(warnings)
      })
    : actor
  return { actionEconomy, warnings, spent }
}
