import type { EncounterRelationshipD20Contributor } from './encounterRelationshipActionFacts.js'
import type { EncounterMovementReactionCharacterSource } from './encounterMovementReactionSources.js'
import { discoverCharacterActionCapabilities } from './characterActionCapabilityDiscoveryRegistry.js'
import { compileCharacterActionEntryPoints } from './encounterActionEntryPointCompiler.js'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  EncounterRunActorState,
  EncounterRunCharacterActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterBuilderContext } from './character/builderTypes.js'
import type { CharacterSheetCampaignContext } from './character/campaignCharacterSheet.js'
import type { CharacterRuleEvaluationResult } from './character/characterRuleEvaluation.js'
import { resolveCharacterEffectiveMaximumHitPoints } from '@artificer-toolkit/shared/character'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  applyCharacterScalarValuesToFacts,
  foldActiveScalarReductions,
  scalarValuesDiffer
} from './encounterScalarReductions.js'
import { encounterCreatureRuleFactsSnapshotSchema } from '@artificer-toolkit/schema/api/encounterActorRules'
import { buildEncounterActorRuleFacts } from './encounterActorRuleFacts.js'
import {
  bindEncounterActorRuleOutputToFacts,
  reconcileEncounterActorRuleOutput,
  requireEncounterActorRuleResult
} from './encounterActorRuleOutput.js'
import { snapshotStatBlock } from './encounterProjection.js'
import type { TargetBoundActiveRuleEffectExecutionInput } from './targetBoundActiveRuleEffectExecutor.js'
import { readEncounterActorConditionState } from './encounterCharacterMechanicsBatch.js'
import { evaluateInstalledCharacterPolicy } from './platformCharacterPolicy.js'
import { evaluateInstalledEncounterActors } from './platformEncounterPolicy.js'
import { resolveCharacterRulePolicyRollModes } from './character/characterRuleRollProjection.js'
import type { Dnd5eQualifiedDamageDefense } from './systems/dnd5e/attackDamageDefenses.js'

export type CharacterMovementFacts = {
  active: { id: string; streamVersion: number; checksum: string }
  character: Pick<CharacterAuthored, 'systemId' | 'state'>
  campaignContext: Pick<
    CharacterSheetCampaignContext,
    'conditions' | 'adjustments' | 'attunementSlotOverride'
  >
  prepared: {
    context: Pick<CharacterBuilderContext, 'vocabularySnapshot'> & {
      registry: {
        system: Pick<
          NonNullable<CharacterBuilderContext['registry']['system']>,
          'conditionTypes'
        > | null
      }
    }
  }
  ruleEvaluation: CharacterRuleEvaluationResult
}

export type MovementTarget<
  TCharacterFacts extends CharacterMovementFacts = CharacterMovementFacts
> = {
  characterReactionSource?: EncounterMovementReactionCharacterSource
  characterFacts: TCharacterFacts | null
  actor: EncounterRunActorState
  activeEffects: ActiveRuleEffectRecord[]
  state: { current: number; temporary: number; conditions: readonly string[] }
  initialConditionRows: readonly unknown[] | null
  effectiveMaximumHitPoints: number
  baseScalarValues: Readonly<Record<string, number>>
  effectiveScalarValues: Readonly<Record<string, number>>
  baseRulePolicyOutput: CharacterRulePolicyOutput | null
  effectiveRulePolicyOutput: CharacterRulePolicyOutput | null
  targetDerivedFacts: Readonly<Record<string, unknown>>
  defenses: TargetBoundActiveRuleEffectExecutionInput['defenses']
  /** Defenses that apply only to attacks without their bypassing traits. */
  qualifiedDefenses: readonly Dnd5eQualifiedDamageDefense[]
  conditionImmunityIds: readonly string[]
  characterCurrentness: { projectionChecksum: string; mechanicalContextChecksum: string } | null
  /**
   * Contributors attack rolls against the actor gain from its basic-action defense (Dodge), set by
   * `withEncounterBasicActionDefense`; empty until a flow applies it.
   */
  basicActionAttackContributors: readonly EncounterRelationshipD20Contributor[]
}

function maximumReduction(effects: ActiveRuleEffectRecord[]) {
  let total = 0
  for (const effect of effects) {
    if (effect.definition.schemaVersion !== 2) continue
    for (const contribution of effect.definition.stateContributions) {
      if (contribution.kind !== 'HIT_POINT_MAXIMUM_REDUCTION') continue
      if (!Number.isSafeInteger(total + contribution.amount))
        throw new Error('Active hit point maximum reductions exceed safe bounds.')
      total += contribution.amount
    }
  }
  return total
}

export function nativeCharacterMaximumHitPoints(
  characterFacts: CharacterMovementFacts,
  activeEffects: ActiveRuleEffectRecord[]
) {
  return Math.max(
    0,
    resolveCharacterEffectiveMaximumHitPoints(
      characterFacts.ruleEvaluation.output.derivedStats.maxHitPoints.effective
    ) - maximumReduction(activeEffects)
  )
}

/**
 * Staged Character facts must belong to the actor's Character and the Run's System. Their stream
 * version is the Character currentness; callers fence it through their read or capture revisions.
 */
export function assertCharacterFactsBoundToActor<
  TFacts extends { active: { id: string }; character: { systemId: string } }
>(
  facts: TFacts | null | undefined,
  actor: Pick<EncounterRunCharacterActorState, 'sourceId'>,
  gameSystemId: string,
  message: string
): asserts facts is TFacts {
  if (!facts || facts.active.id !== actor.sourceId || facts.character.systemId !== gameSystemId)
    throw new Error(message)
}

/** Builds a target from already-loaded current encounter and Character state. */
export function buildMovementTarget<
  TCharacterFacts extends CharacterMovementFacts = CharacterMovementFacts
>(input: {
  actor: EncounterRunActorState
  activeEffects: ActiveRuleEffectRecord[]
  gameSystemId: string
  campaignId: string
  characterFacts: TCharacterFacts | null
  includeReactionSources?: boolean
}): MovementTarget<TCharacterFacts> {
  const { actor, activeEffects, gameSystemId, campaignId, characterFacts } = input
  if (actor.kind === 'CHARACTER') {
    assertCharacterFactsBoundToActor(
      characterFacts,
      actor,
      gameSystemId,
      'Encounter Character source is unavailable.'
    )
    const conditions = characterFacts.character.state.conditions ?? []
    const conditionIds = [
      ...new Set([
        ...conditions.map((condition) => condition.conditionTypeId),
        ...characterFacts.campaignContext.conditions.map((condition) => condition.conditionTypeId)
      ])
    ]
    const systemConditions = new Set(
      (characterFacts.prepared.context.registry.system?.conditionTypes ?? []).map(
        (condition) => condition.id
      )
    )
    if (
      new Set(conditions.map((condition) => condition.conditionTypeId)).size !==
        conditions.length ||
      conditionIds.some((conditionId) => !systemConditions.has(conditionId))
    )
      throw new Error('Encounter Character condition definitions are stale.')
    const baseRulePolicyOutput = characterFacts.ruleEvaluation.output
    const baseScalarValues: Record<string, number> = {}
    for (const ability of baseRulePolicyOutput.derivedStats.abilities) {
      const matches = characterFacts.ruleEvaluation.facts.abilityDefinitions.filter(
        (definition) => definition.code === ability.abilityId
      )
      if (
        matches.length !== 1 ||
        !matches[0] ||
        !Number.isSafeInteger(ability.score.effective) ||
        ability.score.effective < 0
      )
        throw new Error('Character ability scalar fact is stale.')
      baseScalarValues[matches[0].id] = ability.score.effective
    }
    const effectiveScalarValues = foldActiveScalarReductions({
      baseScalarValues,
      effects: activeEffects
    })
    const effectiveRulePolicyOutput = scalarValuesDiffer(baseScalarValues, effectiveScalarValues)
      ? resolveCharacterRulePolicyRollModes(
          evaluateInstalledCharacterPolicy({
            gameSystemId,
            facts: applyCharacterScalarValuesToFacts(
              characterFacts.ruleEvaluation.facts,
              gameSystemId,
              baseScalarValues,
              effectiveScalarValues
            )
          }),
          characterFacts.prepared.context.vocabularySnapshot
        )
      : baseRulePolicyOutput
    const effectiveMaximumHitPoints = nativeCharacterMaximumHitPoints(characterFacts, activeEffects)
    return {
      actor,
      activeEffects,
      characterFacts,
      state: {
        current: characterFacts.character.state.hitpoints.current,
        temporary: characterFacts.character.state.hitpoints.temp ?? 0,
        conditions: conditionIds
      },
      initialConditionRows: null,
      effectiveMaximumHitPoints,
      baseScalarValues,
      effectiveScalarValues,
      baseRulePolicyOutput,
      effectiveRulePolicyOutput,
      ...(input.includeReactionSources
        ? {
            characterReactionSource: {
              id: actor.sourceId,
              systemId: characterFacts.character.systemId,
              streamVersion: characterFacts.active.streamVersion,
              actor,
              activeConditionDefinitionIds: conditionIds,
              mechanics: {
                rulePolicyInput: {
                  actionCandidates: characterFacts.ruleEvaluation.facts.actionCandidates
                },
                compiledActionEntryPoints: compileCharacterActionEntryPoints({
                  gameSystemId,
                  candidates: characterFacts.ruleEvaluation.facts.actionCandidates,
                  descriptors: discoverCharacterActionCapabilities({
                    gameSystemId,
                    candidates: characterFacts.ruleEvaluation.facts.actionCandidates,
                    conditionDefinitionIds: [...systemConditions].sort(),
                    abilityDefinitions: characterFacts.ruleEvaluation.facts.abilityDefinitions,
                    entryPoints: characterFacts.ruleEvaluation.actionEntryPoints
                  })
                })
              }
            }
          }
        : {}),
      characterCurrentness: {
        projectionChecksum: checksumRuleDocument({
          documentChecksum: characterFacts.active.checksum,
          facts: characterFacts.ruleEvaluation.facts,
          output: baseRulePolicyOutput
        }),
        mechanicalContextChecksum: checksumRuleDocument({
          campaignId,
          systemId: gameSystemId,
          attunementSlotOverride: characterFacts.campaignContext.attunementSlotOverride,
          adjustments: characterFacts.campaignContext.adjustments,
          conditions: characterFacts.campaignContext.conditions,
          effectiveScalarValues,
          effects: activeEffects.map((effect) => ({
            id: effect.id,
            version: effect.version,
            definitionChecksum: effect.definitionChecksum,
            lifecycleChecksum: effect.lifecycleChecksum
          }))
        })
      },
      targetDerivedFacts: {
        ...effectiveRulePolicyOutput,
        targetProtection: {
          status: 'NORMALIZED',
          defenses: effectiveRulePolicyOutput.defenses,
          qualifiedDefenses: [],
          conditionImmunityIds: effectiveRulePolicyOutput.conditionImmunityIds
        }
      },
      defenses: effectiveRulePolicyOutput.defenses,
      qualifiedDefenses: [],
      conditionImmunityIds: effectiveRulePolicyOutput.conditionImmunityIds,
      basicActionAttackContributors: []
    }
  }
  const baseScalarValues: Record<string, number> =
    actor.kind === 'CREATURE'
      ? (() => {
          if (
            typeof actor.snapshot !== 'object' ||
            actor.snapshot === null ||
            Array.isArray(actor.snapshot)
          )
            throw new Error('Encounter actor scalar facts are stale.')
          const facts = encounterCreatureRuleFactsSnapshotSchema.parse(actor.snapshot.ruleFacts)
          if (facts.gameSystemId !== gameSystemId)
            throw new Error('Encounter actor scalar facts are stale.')
          return { ...facts.abilityScores }
        })()
      : {}
  const effectiveScalarValues = foldActiveScalarReductions({
    baseScalarValues,
    effects: activeEffects
  })
  const facts = buildEncounterActorRuleFacts(
    { actors: [actor] },
    new Map([[actor.id, effectiveScalarValues]])
  )
  const rules = bindEncounterActorRuleOutputToFacts(
    reconcileEncounterActorRuleOutput(
      evaluateInstalledEncounterActors({ gameSystemId, facts }),
      facts
    ),
    facts
  )
  const actorRule = requireEncounterActorRuleResult(rules, actor.id)
  if (actorRule.targetProtection.status !== 'NORMALIZED')
    throw new Error('Encounter actor spatial protections are not normalized.')
  const conditions = readEncounterActorConditionState(actor.conditions ?? [])
  return {
    actor,
    activeEffects,
    characterFacts: null,
    state: {
      current: actor.currentHitPoints,
      temporary: actor.tempHitPoints,
      conditions: conditions.ids
    },
    initialConditionRows: conditions.values,
    effectiveMaximumHitPoints: actor.maxHitPoints,
    baseScalarValues,
    effectiveScalarValues,
    baseRulePolicyOutput: null,
    effectiveRulePolicyOutput: null,
    characterCurrentness: null,
    targetDerivedFacts: {
      actorId: actorRule.actorId,
      initiativeModifier: actorRule.initiativeModifier,
      savingThrowDefinitions: actorRule.savingThrowDefinitions ?? [],
      featureResources: actorRule.featureResources,
      targetProtection: actorRule.targetProtection,
      statBlock: snapshotStatBlock(actor)
    },
    defenses: actorRule.targetProtection.defenses,
    qualifiedDefenses: actorRule.targetProtection.qualifiedDefenses,
    conditionImmunityIds: actorRule.targetProtection.conditionImmunityIds,
    basicActionAttackContributors: []
  }
}
