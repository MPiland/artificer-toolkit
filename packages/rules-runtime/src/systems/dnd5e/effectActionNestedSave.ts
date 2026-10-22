import { MAX_RULE_EXECUTION_AUTOMATIC_EVIDENCE_REQUESTS } from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import { hitPointMaximumReductionRecoveryTagsSchema } from '@artificer-toolkit/schema/effects/hitPointMaximumReduction'
import { type CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import type { FailureMarginRiderAuthored } from '@artificer-toolkit/shared/authored'
import {
  compareThresholdRuleOperation,
  type RuleGraphDefinition
} from '@artificer-toolkit/shared/rules'
import { CharacterRuleActionUnsupportedCompilationError } from '../../characterRuleActionSystemAdapter.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { dnd5eAddedDiceNode } from './d20AddedDiceGraph.js'
import { DND5E_SAVE_TEST_OPERATION_KEY } from './dnd5eTestOperationKeys.js'
import {
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_TEST_OUTCOME_RULE_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  MAX_CONDITIONS_PER_PATH,
  conditionImmuneFactKey,
  DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY,
  UUID,
  isUuid,
  uuid,
  unsupported,
  NESTED_SAVE_MARGIN_NODE_ID,
  nestedSaveRiderConditionNodeId,
  DND5E_NESTED_SAVE_GATE_OPERATION_KEY,
  nestedSaveGateNodeId
} from './effectActionContracts.js'
import { type FollowUpSaveOutcome } from './effectActionFollowUp.js'
import {
  hitPointMaximumReductionProposalNode,
  forcedMovementProposalNode,
  dnd5eTestMarginConditionProposalOperation
} from './effectActionOperationRegistry.js'
import { timedBandConditions } from './effectActionBandConditions.js'
import { gateNodeInputs } from './effectActionGates.js'
import { boundedDiceTerm, parseBoundedDiceConfiguration } from './effectActionScalingFacts.js'
import {
  damageTypeIdentity,
  damageMultiplier,
  multipliedDamage,
  boundedOutcome,
  rolledDiceNodes,
  pathGatedProposalNode,
  validateDamageBonuses
} from './effectActionOutcomeNodes.js'
import type { Dnd5eCompiledEffectActionSource } from './effectActionContracts.js'

export type ImmediatePrimaryDamageEntry = CompiledEffectGroup['entries'][number] & {
  resultBlockId: string
  outcome: Extract<
    Extract<CompiledEffectGroup['entries'][number], { outcome: unknown }>['outcome'],
    { effectKind: 'DAMAGE' }
  >
}

export type ImmediateSaveEntry = CompiledEffectGroup['entries'][number] & {
  resultBlockId: string
  outcome: Extract<
    Extract<CompiledEffectGroup['entries'][number], { outcome: unknown }>['outcome'],
    { effectKind: 'FOLLOW_UP_SAVE' }
  >
}

export type FollowUpSaveConditionOutcome = Extract<
  Extract<FollowUpSaveOutcome['onFailure'], { kind: 'OUTCOMES' }>['outcomes'][number],
  { effectKind: 'CONDITION' }
>

/**
 * A save a hit calls for at once, settled inside the hit's OUTCOME so it cannot become an
 * independently invoked action or a delayed workflow: one roll against a fixed DC, whose failure
 * has outcomes and whose success ends it or has outcomes of its own.
 */
export function isImmediateFollowUpSave(save: FollowUpSaveOutcome): save is FollowUpSaveOutcome & {
  attempts: Extract<FollowUpSaveOutcome['attempts'], { kind: 'ONCE' }>
  savingThrow: Extract<FollowUpSaveOutcome['savingThrow'], { dcMethod: 'FIXED_DC' }>
} {
  return (
    save.timing === 'IMMEDIATE' &&
    save.attempts.kind === 'ONCE' &&
    save.savingThrow.dcMethod === 'FIXED_DC' &&
    UUID.test(save.savingThrow.abilityDefinitionId) &&
    Number.isSafeInteger(save.savingThrow.baseDc) &&
    save.onFailure.kind === 'OUTCOMES' &&
    (save.onSuccess.kind === 'END' || save.onSuccess.kind === 'OUTCOMES')
  )
}

/**
 * The second condition a repeated save leaves in place of the held one when it fails ("restrained,
 * then petrified"): its only failure outcome, ending the held effect. Null for any other repeat.
 */
export function escalationCondition(
  repeat: FollowUpSaveOutcome
): FollowUpSaveConditionOutcome | null {
  const { onFailure } = repeat
  const [outcome] = onFailure.kind === 'OUTCOMES' ? onFailure.outcomes : []
  return onFailure.kind === 'OUTCOMES' &&
    onFailure.endCurrent &&
    onFailure.outcomes.length === 1 &&
    outcome?.effectKind === 'CONDITION' &&
    UUID.test(outcome.conditionId)
    ? outcome
    : null
}

/**
 * An immediate save whose failure holds a condition and a one-time repeat at the end of the
 * target's next turn that escalates it (Cockatrice Bite). The conditions are not yet checked
 * against the System vocabulary; the plan does.
 */
export function escalatingImmediateSave(save: FollowUpSaveOutcome): {
  condition: FollowUpSaveConditionOutcome
  repeat: FollowUpSaveOutcome
  escalation: FollowUpSaveConditionOutcome
} | null {
  const { onFailure } = save
  if (onFailure.kind !== 'OUTCOMES' || onFailure.outcomes.length !== 2) return null
  const [condition, repeat] = onFailure.outcomes
  if (condition?.effectKind !== 'CONDITION' || repeat?.effectKind !== 'FOLLOW_UP_SAVE') return null
  const escalation = escalationCondition(repeat)
  return escalation &&
    save.attempts.kind === 'ONCE' &&
    save.attempts.repeatOnFailure !== true &&
    repeat.timing === 'TARGET_TURN_END' &&
    repeat.attempts.kind === 'ONCE' &&
    repeat.attempts.repeatOnFailure !== true &&
    repeat.onSuccess.kind === 'END' &&
    !repeat.repeatAttemptGate &&
    !repeat.repeatRollInfluence &&
    (repeat.onDurationComplete === undefined || repeat.onDurationComplete.kind === 'END')
    ? { condition, repeat, escalation }
    : null
}

export function immediateFollowUpSaveEntries(
  entries: readonly CompiledEffectGroup['entries'][number][]
): {
  primaryDamageEntries: readonly ImmediatePrimaryDamageEntry[]
  saveEntry: ImmediateSaveEntry
} | null {
  const saveEntry = entries.at(-1)
  const primaryDamageEntries = entries.slice(0, -1)
  if (!saveEntry) return null
  if (!('resultBlockId' in saveEntry) || !('outcome' in saveEntry)) return null
  const resultBlockId = saveEntry.resultBlockId
  if (
    saveEntry.resolutionKind !== 'DIRECT' ||
    // A hit with no damage before its save (Spit Poison) is a SINGLE group of that one save.
    (saveEntry.groupKind !== 'SEQUENTIAL' &&
      !(primaryDamageEntries.length === 0 && saveEntry.groupKind === 'SINGLE')) ||
    saveEntry.pathCode !== 'ON_HIT' ||
    saveEntry.outcome.effectKind !== 'FOLLOW_UP_SAVE'
  ) {
    return null
  }
  const primary = [] as ImmediatePrimaryDamageEntry[]
  for (const entry of primaryDamageEntries) {
    if (!('resultBlockId' in entry) || !('outcome' in entry)) return null
    const outcome = entry.outcome
    if (
      entry.resolutionKind !== 'DIRECT' ||
      entry.groupKind !== 'SEQUENTIAL' ||
      entry.pathCode !== 'ON_HIT' ||
      entry.resultBlockId !== resultBlockId ||
      outcome.effectKind !== 'DAMAGE' ||
      primaryDamageDiceCount(outcome) === null ||
      !UUID.test(entry.entryId) ||
      !isUuid(outcome.damageTypeId)
    ) {
      return null
    }
    primary.push(entry as ImmediatePrimaryDamageEntry)
  }
  return {
    primaryDamageEntries: primary,
    saveEntry: saveEntry as ImmediateSaveEntry
  }
}

/**
 * A margin rider the nested save can gate: a bounded margin and identified conditions, which share
 * the failed-save path's immunity facts after the failure's own condition.
 */
export function exactFailureMarginRider(rider: FailureMarginRiderAuthored): boolean {
  return (
    UUID.test(rider.id) &&
    Number.isSafeInteger(rider.failedBy) &&
    rider.failedBy >= 1 &&
    rider.failedBy <= 30 &&
    rider.outcomes.length > 0 &&
    rider.outcomes.length < MAX_CONDITIONS_PER_PATH &&
    rider.outcomes.every(
      (outcome) =>
        outcome.effectKind === 'CONDITION' &&
        UUID.test(outcome.id) &&
        UUID.test(outcome.conditionId)
    )
  )
}

/**
 * The dice one primary hit-damage outcome requests before the nested save: its exact bounded
 * term (a flat modifier or ability bonuses allowed, at most 15 dice) or none for a fixed amount.
 */
export function primaryDamageDiceCount(
  outcome: ImmediatePrimaryDamageEntry['outcome']
): number | null {
  if (outcome.scalingKind !== 'NONE') return null
  if (outcome.valueKind === 'FIXED')
    return Number.isSafeInteger(outcome.amount) && outcome.amount > 0 && !outcome.bonuses?.length
      ? 0
      : null
  if (outcome.valueKind !== 'DICE') return null
  // A constant authored as dice ("1") rolls nothing, like a fixed amount.
  if (/^[1-9]\d*$/.test(outcome.dice)) return outcome.bonuses?.length ? null : 0
  try {
    validateDamageBonuses(outcome.bonuses)
    const count = parseBoundedDiceConfiguration(outcome.dice).term.count
    return count <= 15 ? count : null
  } catch (error) {
    if (error instanceof CharacterRuleActionUnsupportedCompilationError) return null
    throw error
  }
}

type BandGate = NonNullable<Extract<FollowUpSaveOutcome['onFailure'], { kind: 'OUTCOMES' }>['gate']>

/**
 * A band's gate node: the save's result path, handed to the band's outcomes only while the target
 * passes the gate. A reduced-to-0 gate names the band's first outcome, a dice damage whose
 * application the interpreter checks.
 */
function nestedSaveBandGateNode(
  pathCode: string,
  band: Extract<FollowUpSaveOutcome['onFailure'], { kind: 'OUTCOMES' }>['outcomes'],
  gate: BandGate
) {
  const [first] = band
  if (
    gate.kind === 'REDUCED_TO_ZERO_BY' &&
    (first?.effectKind !== 'DAMAGE' ||
      first.valueKind !== 'DICE' ||
      first.id !== gate.damageOutcomeId)
  )
    unsupported('D&D reduced-to-0 gate must name the first damage of its nested save band.')
  return {
    id: nestedSaveGateNodeId(pathCode),
    operation: { key: DND5E_NESTED_SAVE_GATE_OPERATION_KEY, contractVersion: 2 },
    inputs: {
      resultPath: { kind: 'NODE_OUTPUT' as const, nodeId: 'nested-save-test', port: 'resultPath' },
      ...gateNodeInputs(
        gate.kind === 'REDUCED_TO_ZERO_BY'
          ? { gate, reducedToZeroByNodeId: `nested-save-${pathCode.toLowerCase()}-1` }
          : { gate }
      )
    }
  }
}

/**
 * The save a hit calls for at once (isExactImmediateFollowUpSaveAction): one d20 against the fixed
 * DC, then each band's outcomes from the outcome registry, gated on the save's own result path. The
 * bands' damage shares one roll, as "half as much damage on a successful one" does.
 */
export function immediateFollowUpSaveGraphDefinition(
  action: Dnd5eCompiledEffectActionSource
): RuleGraphDefinition {
  const resolved = immediateFollowUpSaveEntries(action.compiledEffect.entries)
  const save = resolved?.saveEntry.outcome
  if (!resolved || !save || !isImmediateFollowUpSave(save) || save.onFailure.kind !== 'OUTCOMES')
    unsupported('D&D immediate follow-up save source is unavailable.')
  // A band's timings are held by its active effects; this refuses one that cannot be.
  timedBandConditions(save)
  const dc = save.savingThrow.baseDc
  // An escalating save's repeat is held by its active effect, not proposed by the hit.
  const repeat = escalatingImmediateSave(save)?.repeat
  const bands = [
    [
      'ON_SAVE_FAIL',
      save.onFailure.outcomes.filter((outcome) => outcome !== repeat),
      save.onFailure.gate
    ],
    [
      'ON_SAVE_SUCCESS',
      save.onSuccess.kind === 'OUTCOMES' ? save.onSuccess.outcomes : [],
      save.onSuccess.kind === 'OUTCOMES' ? save.onSuccess.gate : undefined
    ]
  ] as const
  const outcomes = bands.flatMap(([, band]) => band)
  const gateNodes = bands.flatMap(([pathCode, band, gate]) =>
    gate ? [nestedSaveBandGateNode(pathCode, band, gate)] : []
  )
  const diceConfigs = new Set(
    outcomes.flatMap((outcome) =>
      outcome.effectKind === 'DAMAGE' && outcome.valueKind === 'DICE' ? [outcome.dice] : []
    )
  )
  if (diceConfigs.size > 1)
    unsupported('D&D immediate follow-up save damage must share one roll across its results.')
  const [diceConfig] = diceConfigs
  const dice = diceConfig === undefined ? null : boundedDiceTerm(diceConfig)
  if (dice && dice.modifier !== 0)
    unsupported('D&D immediate follow-up save dice exceed the exact bounded contract.')
  const primaryDiceCount = resolved.primaryDamageEntries.reduce(
    (total, entry) => total + (primaryDamageDiceCount(entry.outcome) ?? 0),
    0
  )
  // One TEST d20, doubled primary critical dice, one nested save d20, and the nested damage dice
  // must fit the coordinator-wide bound.
  if (
    1 + primaryDiceCount * 2 + 1 + (dice?.term.count ?? 0) >
    MAX_RULE_EXECUTION_AUTOMATIC_EVIDENCE_REQUESTS
  )
    unsupported('D&D immediate follow-up save dice exceed the coordinator-wide evidence bound.')
  if (outcomes.filter((outcome) => outcome.effectKind === 'HIT_POINT_MAXIMUM_REDUCTION').length > 1)
    unsupported('D&D immediate follow-up save reduces hit point maximum more than once.')
  const roll = dice ? rolledDiceNodes(dice.term, 'nested-save-') : null
  const resultPath = {
    kind: 'NODE_OUTPUT',
    nodeId: 'nested-save-test',
    port: 'resultPath'
  } as const
  const bandOutcomeNodes = bands.flatMap(([pathCode, band, gate]) =>
    band.map((outcome, index) => {
      const gated = gate !== undefined
      // The damage a reduced-to-0 gate names is dealt whatever the gate says; the gate holds the outcomes that follow it.
      const gatedByBand = gated && !(gate.kind === 'REDUCED_TO_ZERO_BY' && index === 0)
      const testNodeId = gatedByBand ? nestedSaveGateNodeId(pathCode) : 'nested-save-test'
      uuid(outcome.id, 'D&D immediate follow-up save outcome identity')
      const id = `nested-save-${pathCode.toLowerCase()}-${index + 1}`
      if (
        gatedByBand &&
        (outcome.effectKind === 'HIT_POINT_MAXIMUM_REDUCTION' ||
          outcome.effectKind === 'FORCED_MOVEMENT')
      )
        unsupported('D&D gated nested save outcomes are limited to path-gated proposals.')
      if (outcome.effectKind === 'HIT_POINT_MAXIMUM_REDUCTION') {
        const source = outcome.amountSource
        if (
          source.kind !== 'DAMAGE_TAKEN' ||
          source.damageOutcomeId !== resolved.primaryDamageEntries[0]?.outcome.id ||
          !UUID.test(source.damageOutcomeId) ||
          !hitPointMaximumReductionRecoveryTagsSchema.safeParse(outcome.recoveryTags).success
        )
          unsupported('D&D hit point maximum reduction must reduce by the damage the hit dealt.')
        const node = hitPointMaximumReductionProposalNode({
          id,
          resultPath,
          authorizedPath: pathCode,
          sourceDamageNodeId: 'proposal-on_hit',
          reduction: outcome
        })
        return { sourceEntryId: outcome.id, id, nodes: [node] }
      }
      if (outcome.effectKind === 'DAMAGE' && outcome.valueKind === 'DICE') {
        if (!roll || outcome.scalingKind !== 'NONE' || outcome.bonuses?.length)
          unsupported('D&D immediate follow-up save damage must be one unscaled roll.')
        const multiplier = damageMultiplier(outcome)
        const multiplied = multipliedDamage(`${id}-multiplied`, roll.subtotal, multiplier)
        const node = pathGatedProposalNode({
          id,
          pathCode,
          testNodeId,
          outcome: {
            kind: 'ENTRY_DICE_DAMAGE',
            diceConfig: outcome.dice,
            damageTypeId: damageTypeIdentity(outcome.damageTypeId),
            entryId: outcome.id,
            multiplier
          },
          conditionImmuneFactKey: undefined,
          amount: multiplied.amount
        })
        return { sourceEntryId: outcome.id, id, nodes: [...multiplied.nodes, node] }
      }
      const bounded = boundedOutcome(outcome, gatedByBand)
      const node =
        bounded.kind === 'FORCED_MOVEMENT'
          ? forcedMovementProposalNode({
              id,
              sourceEntryId: outcome.id,
              resultPath,
              authoredPath: pathCode,
              outcome: bounded
            })
          : pathGatedProposalNode({
              id,
              pathCode,
              testNodeId,
              outcome: bounded,
              // Each of a band's conditions reads its own immunity fact, in authored order.
              conditionImmuneFactKey: conditionImmuneFactKey(
                pathCode,
                band.slice(0, index + 1).filter((prior) => prior.effectKind === 'CONDITION').length
              )
            })
      return { sourceEntryId: outcome.id, id, nodes: [node] }
    })
  )
  const rider = save.failureMarginRider
  if (
    rider &&
    (save.attempts.repeatOnFailure === true ||
      bands[0][2] ||
      repeat ||
      save.onDurationComplete ||
      !exactFailureMarginRider(rider))
  )
    unsupported(
      'D&D failure-margin rider must add bounded conditions to a save that does not repeat.'
    )
  // The failed save's own conditions hold the path's first immunity facts.
  const failureConditionCount = bands[0][1].filter(
    (outcome) => outcome.effectKind === 'CONDITION'
  ).length
  return {
    schemaVersion: 1,
    id: action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      {
        id: 'nested-save-d20',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: {
          min: { kind: 'LITERAL', value: 1 },
          max: { kind: 'LITERAL', value: 20 }
        }
      },
      dnd5eAddedDiceNode('nested-save-d20'),
      {
        id: 'nested-save-test',
        operation: { key: DND5E_SAVE_TEST_OPERATION_KEY, contractVersion: 3 },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          naturalD20: {
            kind: 'NODE_OUTPUT',
            nodeId: 'nested-save-d20',
            port: 'value'
          },
          addedTotal: {
            kind: 'NODE_OUTPUT',
            nodeId: 'nested-save-d20-added-dice',
            port: 'value'
          },
          modifier: { kind: 'FACT', factKey: DND5E_SAVE_MODIFIER_FACT_KEY },
          threshold: { kind: 'LITERAL', value: dc },
          contributorChecksum: {
            kind: 'FACT',
            factKey: DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY
          },
          outcomeRule: { kind: 'FACT', factKey: DND5E_TEST_OUTCOME_RULE_FACT_KEY }
        }
      },
      ...(roll?.nodes ?? []),
      ...gateNodes,
      ...bandOutcomeNodes.flatMap(({ nodes }) => nodes),
      ...(rider
        ? [
            {
              id: NESTED_SAVE_MARGIN_NODE_ID,
              operation: { key: compareThresholdRuleOperation.key, contractVersion: 1 },
              inputs: {
                value: { kind: 'NODE_OUTPUT' as const, nodeId: 'nested-save-test', port: 'total' },
                // A total at or above this does not fail by the rider's margin.
                threshold: { kind: 'LITERAL' as const, value: dc - rider.failedBy + 1 }
              }
            },
            ...rider.outcomes.map((outcome, index) => ({
              id: nestedSaveRiderConditionNodeId(index),
              operation: {
                key: DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY,
                contractVersion: dnd5eTestMarginConditionProposalOperation.contractVersion
              },
              inputs: {
                targetActorId: { kind: 'FACT' as const, factKey: DND5E_TARGET_ACTOR_FACT_KEY },
                resolvedPath: resultPath,
                authoredPath: { kind: 'LITERAL' as const, value: 'ON_SAVE_FAIL' },
                conditionId: { kind: 'LITERAL' as const, value: outcome.conditionId },
                conditionImmune: {
                  kind: 'FACT' as const,
                  factKey:
                    conditionImmuneFactKey('ON_SAVE_FAIL', failureConditionCount + index + 1) ??
                    unsupported('D&D result path applies too many conditions.')
                },
                marginCleared: {
                  kind: 'NODE_OUTPUT' as const,
                  nodeId: NESTED_SAVE_MARGIN_NODE_ID,
                  port: 'passed'
                },
                targetStateChecksum: {
                  kind: 'FACT' as const,
                  factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY
                }
              }
            }))
          ]
        : [])
    ],
    outputs: {
      nestedSaveAbilityDefinitionId: {
        kind: 'LITERAL',
        value: save.savingThrow.abilityDefinitionId
      }
    },
    sourceEntryBindings: [
      { sourceEntryId: resolved.saveEntry.entryId, nodeId: 'nested-save-test' },
      ...bandOutcomeNodes.map(({ sourceEntryId, id }) => ({ sourceEntryId, nodeId: id })),
      ...(rider?.outcomes.map((outcome, index) => ({
        sourceEntryId: outcome.id,
        nodeId: nestedSaveRiderConditionNodeId(index)
      })) ?? [])
    ]
  }
}
