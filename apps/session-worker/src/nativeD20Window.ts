import type { EncounterSettledAppRollDto } from '@artificer-toolkit/schema/api/encounterData'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterD20WindowPendingContextDto } from '@artificer-toolkit/schema/shared/ruleExecutionD20Window'
import type { D20WindowPausePayloadDto } from '@artificer-toolkit/schema/shared/ruleExecutionD20WindowOffer'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { rollEncounterCheck } from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import {
  encounterD20WindowSelection,
  encounterHeldCheckDice,
  openEncounterD20Window,
  settleEncounterD20Window
} from '@artificer-toolkit/rules-runtime/encounterD20Window'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { bindEncounterD20Evidence } from './nativeD20Evidence.js'

/**
 * The one Worker answer to a pending check's d20 (D168, ADR 0039). A d20 the roller rolls opens a
 * window when its roller holds after-roll dice for the check; otherwise, or once a window is
 * answered, the check settles with that d20 and the die the window spent. Each check applies the
 * settled d20 its own way; none has window code of its own.
 */
export async function answerNativeD20Check(input: {
  runtime: RulesRuntimeService
  random(maximum: number): number
  gameSystemId: string
  system: SystemAuthoredDto
  command: ResolveRuleOccurrenceInputDto
  appRoll: EncounterSettledAppRollDto | null
  /** The check the d20 belongs to, as a window names it. */
  source: EncounterD20WindowPendingContextDto['source']
  pending: {
    snapshot: { occurrenceId: string }
    continuation: ServerRuleExecutionContinuationDto
    window: EncounterD20WindowPendingContextDto | null
  }
  /** The roller's active effects, which hold its after-roll dice. */
  rollerEffects: readonly ActiveRuleEffectRecord[]
  optionalCombatSnapshotChecksum: string | null
  refusal: string
}) {
  const { runtime, random, command, source, pending } = input
  const { continuation, window } = pending
  if (window) {
    const settled = await settleEncounterD20Window({
      runtime,
      context: window,
      continuation,
      selection: encounterD20WindowSelection(command.resolution),
      random
    })
    const { rolled, appRollId } = window.pause.payload
    return {
      kind: 'SETTLED' as const,
      rolled: { ...rolled, d20: settled.d20 },
      appRollId,
      windowDice: settled.option ? [settled.option] : [],
      // A d20 that paused keeps the version it was recorded under.
      occurrenceVersion: command.expectedOccurrenceVersion,
      window: {
        spentEffect: settled.option
          ? (input.rollerEffects.find(({ id }) => id === settled.option?.effectId) ?? null)
          : null
      }
    }
  }
  const rolled: D20WindowPausePayloadDto['rolled'] = {
    ...(await rollEncounterCheck({
      gameSystemId: input.gameSystemId,
      runtime,
      context: source.context,
      continuation,
      answer: bindEncounterD20Evidence({
        response: { resolution: command.resolution, appRoll: input.appRoll },
        refusal: input.refusal
      }),
      rollD20: () => random(20) + 1,
      random,
      expectedOccurrenceId: pending.snapshot.occurrenceId
    })),
    initialFactsChecksum: checksumRuleDocument(continuation.facts)
  }
  const appRollId = input.appRoll?.rollId ?? null
  const heldDice = encounterHeldCheckDice(
    input.system,
    input.rollerEffects,
    source.context.check.checkDefinitionId
  )
  if (heldDice.length > 0) {
    const opened = await openEncounterD20Window({
      runtime,
      occurrenceId: pending.snapshot.occurrenceId,
      gameSystemId: input.gameSystemId,
      source,
      rolled,
      appRollId,
      heldDice,
      optionalCombatSnapshotChecksum: input.optionalCombatSnapshotChecksum
    })
    return { kind: 'WINDOW' as const, snapshot: opened.snapshot }
  }
  return {
    kind: 'SETTLED' as const,
    rolled,
    appRollId,
    windowDice: [],
    occurrenceVersion: command.expectedOccurrenceVersion + 1,
    window: undefined
  }
}
