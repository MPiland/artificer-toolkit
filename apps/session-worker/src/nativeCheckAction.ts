import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  liveSessionEncounterBasicActionCommitInputSchema,
  type LiveSessionEncounterBasicActionCommitInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import {
  completeEncounterBasicActionCheckResult,
  encounterBasicActionCheckLabel,
  encounterBasicActionCheckPendingSnapshot,
  encounterBasicActionStabilizeApplication,
  evaluateEncounterBasicActionCheck,
  prepareEncounterBasicActionCheck,
  startEncounterBasicActionCheck
} from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import type { EncounterBasicActionCapabilityDescriptor } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { EncounterValidationError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import { planEncounterMechanicsBatch } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { prepareNativeLiveMovementTarget } from './nativeEncounterTargets.js'

type CheckTarget = Awaited<ReturnType<typeof prepareNativeLiveMovementTarget>>['target']

/**
 * Plans a CHECK action: the actor spends the action's allowance and makes its one authored check
 * against the authored DC; the outcome (a stabilize) runs only when the check reaches the DC. The
 * check pends on the actor's d20, or settles here when the roller's preference rolls for them
 * (ADR 0034 decision 3). Convex records the plan; it evaluates none of it.
 */
export async function planNativeLiveCheckAction(input: {
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>
  command: ResolveEncounterActionInputDto
  fingerprint: string
  capability: EncounterBasicActionCapabilityDescriptor
  state: {
    id: string
    version: number
    gameSystemId: string
    optionalCombatSnapshotChecksum: string | null
  }
  system: SystemAuthoredDto
  actors: readonly EncounterRunActorState[]
  actor: CheckTarget
  target: CheckTarget
  overrides: readonly EncounterRuleWarningDto[]
  actionEconomy: LiveSessionEncounterBasicActionCommitInput['actionEconomy']
  autoRoll: boolean
  runtime: RulesRuntimeService
  random?: (maximum: number) => number
  revisions: LiveSessionRulesRevisions
}) {
  const { capability, command, state, actor, target } = input
  const invocation = capability.compiledEffect.invocation
  if (invocation.triggerCode !== 'CHECK') throw new Error('The selected action makes no check.')
  // The compiler admits exactly one check against a fixed DC; the roller takes either kind.
  const { checks, dc } = invocation.check
  if (dc.kind !== 'FIXED') throw new Error('A compiled check action has a fixed DC.')
  const skillId = checks.skillIds[0]
  const checkDefinitionId = skillId ?? checks.abilityDefinitionIds[0]
  if (!checkDefinitionId) throw new Error('A compiled check action lists one check.')
  const checkKind = skillId ? 'SKILL' : 'ABILITY'
  const settled = input.actionEconomy
    ? consumeEncounterActionEconomy({
        actor: actor.actor,
        consumption: input.actionEconomy,
        overridden: overridesActionEconomy(input.overrides)
      })
    : actor.actor
  const facts = buildEncounterActorRuleFacts({ actors: input.actors })
  const nextFacts = buildEncounterActorRuleFacts({
    actors: input.actors.map((entry) => (entry.id === settled.id ? settled : entry))
  })
  const prepared = prepareEncounterBasicActionCheck({
    gameSystemId: state.gameSystemId,
    commandId: command.commandId,
    commandFingerprint: input.fingerprint,
    definition: {
      id: capability.definitionId,
      version: capability.definitionVersion,
      checksum: capability.definitionChecksum,
      label: capability.label
    },
    system: input.system,
    check: { checkKind, checkDefinitionId, dc: dc.value },
    checkLabel: encounterBasicActionCheckLabel(input.system, checkDefinitionId),
    helper: actor,
    target
  })
  let check: LiveSessionEncounterBasicActionCommitInput['check'] = null
  if (prepared) {
    const occurrenceId = crypto.randomUUID()
    const { context } = prepared
    const continuation = await startEncounterBasicActionCheck({
      runtime: input.runtime,
      gameSystemId: state.gameSystemId,
      occurrenceId
    })
    if (!input.autoRoll)
      check = {
        kind: 'PENDING',
        snapshot: encounterBasicActionCheckPendingSnapshot({
          continuation,
          context,
          optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
        })
      }
    else {
      const { random } = input
      if (!random) throw new Error('The roller preference requires a random source.')
      const evaluated = await evaluateEncounterBasicActionCheck({
        runtime: input.runtime,
        context,
        continuation,
        answer: { kind: 'AUTO_ROLL', requestId: continuation.request.requestId },
        rollD20: () => random(20) + 1,
        expectedOccurrenceId: occurrenceId
      })
      const stabilized = evaluated.reachesDc
        ? planEncounterMechanicsBatch({
            batch: {
              encounterId: state.id,
              targetActorId: target.actor.id,
              expectedEncounterVersion: state.version,
              occurrenceId,
              sourceCommandId: command.commandId,
              commandId: deriveEncounterCharacterMechanicsEventCommandId({
                occurrenceId,
                sourceCommandId: command.commandId,
                phase: 'BASIC_ACTION_CHECK',
                ordinal: 0,
                targetCharacterId: context.targetCharacterId
              }),
              occurredAt: new Date().toISOString(),
              applications: [encounterBasicActionStabilizeApplication(context.targetActorId)],
              expectedCharacterStreamVersion:
                target.characterFacts?.active.play.streamVersion ?? null,
              effectiveMaximumHitPoints: target.effectiveMaximumHitPoints,
              effectiveScalarValues: target.effectiveScalarValues,
              forceVersionAdvance: false
            },
            actor: target.actor,
            userId: input.scope.expectedUserId,
            ...(target.characterFacts ? { characterFacts: target.characterFacts } : {})
          })
        : null
      const { result } = completeEncounterBasicActionCheckResult({
        context,
        continuation,
        evaluated,
        targetStillDying: true,
        transition: stabilized
          ? {
              before: stabilized.targetTransition.before,
              after: stabilized.targetTransition.after,
              afterStreamVersion: stabilized.characterStreamVersion
            }
          : null,
        occurrenceVersion: 0,
        initialFactsChecksum: checksumRuleDocument(continuation.facts)
      })
      check = { kind: 'SETTLED', settlement: { context, execution: result, appRollId: null } }
    }
  }
  return {
    kind: 'CHECK' as const,
    input: liveSessionEncounterBasicActionCommitInputSchema.parse({
      ...input.scope,
      command,
      revisions: input.revisions,
      occurredAt: new Date().toISOString(),
      definition: {
        id: capability.definitionId,
        version: capability.definitionVersion,
        checksum: capability.definitionChecksum
      },
      actionEconomy: input.actionEconomy,
      ruleOverrides: input.overrides,
      consumedGrants: prepared?.context.consumedGrants ?? [],
      check,
      rules: reconcileEncounterActorRuleOutput(
        evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts: nextFacts }),
        nextFacts,
        {
          output: reconcileEncounterActorRuleOutput(
            evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
            facts
          )
        }
      )
    })
  }
}
