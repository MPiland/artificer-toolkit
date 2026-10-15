import type { CharacterDeathSaves } from '@artificer-toolkit/schema/shared/characterDeathSaves'
import type { EncounterMovementReactionCharacterSource } from './encounterMovementReactionSources.js'
import { discoverCharacterActionCapabilities } from './characterActionCapabilityDiscoveryRegistry.js'
import { compileCharacterActionEntryPoints } from './encounterActionEntryPointCompiler.js'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { SenseRangeDto } from '@artificer-toolkit/schema/grants/sense'
import { effectiveHitPointMaximum } from './character/activeEffectGrantTotals.js'
import {
  buildCharacterSpellCastActions,
  type CharacterSpellCastActions,
  listCastableSpellCandidateIds
} from './character/characterSpellCastActions.js'
import {
  type EncounterAttackAgainstContributor,
  withActiveGrantSpeeds,
  withCharacterActiveGrants,
  withCreatureActiveGrantArmorClass,
  withCreatureActiveGrantProtection,
  withCreatureActiveGrantSaves
} from './encounterActiveGrants.js'
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
import type { PinnedConditionRuleStateDefinitionDto } from '@artificer-toolkit/schema/shared/ruleState'
import type { EncounterConditionMechanic } from './encounterConditionMechanics.js'

export type CharacterMovementFacts = {
  active: { id: string; checksum: string; play: { streamVersion: number } }
  character: CharacterAuthored
  campaignContext: Pick<
    CharacterSheetCampaignContext,
    'conditions' | 'adjustments' | 'attunementSlotOverride'
  >
  prepared: {
    context: Pick<CharacterBuilderContext, 'vocabularySnapshot' | 'spellDocumentsById'> & {
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
  /** The spells the Character may cast now; present only where reaction sources are requested. */
  characterSpellCast?: CharacterSpellCastActions
  characterFacts: TCharacterFacts | null
  actor: EncounterRunActorState
  activeEffects: ActiveRuleEffectRecord[]
  state: {
    current: number
    temporary: number
    conditions: readonly string[]
    /** A Character's death saves; null for an actor that is simply defeated at 0 (D63). */
    deathSaves: CharacterDeathSaves | null
  }
  initialConditionRows: readonly unknown[] | null
  effectiveMaximumHitPoints: number
  baseScalarValues: Readonly<Record<string, number>>
  effectiveScalarValues: Readonly<Record<string, number>>
  baseRulePolicyOutput: CharacterRulePolicyOutput | null
  effectiveRulePolicyOutput: CharacterRulePolicyOutput | null
  /** The Senses the actor perceives with: a Character's pinned Senses or a Creature's authored ones. */
  perceptionSenses: readonly { senseDefinitionId: string; range: SenseRangeDto }[]
  targetDerivedFacts: Readonly<Record<string, unknown>>
  defenses: TargetBoundActiveRuleEffectExecutionInput['defenses']
  /** Defenses that apply only to attacks without their bypassing traits. */
  qualifiedDefenses: readonly Dnd5eQualifiedDamageDefense[]
  conditionImmunityIds: readonly string[]
  characterCurrentness: { projectionChecksum: string; mechanicalContextChecksum: string } | null
  /**
   * Contributors attack rolls against the actor gain from its active `ATTACKS_AGAINST` grants
   * (Dodge), set by `withEncounterHolderDefense`; empty until a flow applies it. Those that require
   * the holder to see the attacker hold only then, which `prepareEncounterActionMechanics` decides
   * per attack.
   */
  attackAgainstContributors: readonly EncounterAttackAgainstContributor[]
  /**
   * The actor's pinned condition definitions (D94), loaded by `withEncounterConditionMechanics`
   * and carried across rebuilds so `applyEncounterConditionMechanics` can re-derive its mechanics;
   * empty until a flow loads them.
   */
  conditionDefinitions: readonly PinnedConditionRuleStateDefinitionDto[]
  /** The mechanics the actor's current conditions apply, derived from `conditionDefinitions`. */
  conditionMechanics: readonly EncounterConditionMechanic[]
}

function nativeCharacterMaximumHitPoints(
  characterFacts: CharacterMovementFacts,
  activeEffects: ActiveRuleEffectRecord[]
) {
  return effectiveHitPointMaximum(
    resolveCharacterEffectiveMaximumHitPoints(
      characterFacts.ruleEvaluation.output.derivedStats.maxHitPoints.effective
    ),
    activeEffects
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
    const scalarsReduced = scalarValuesDiffer(baseScalarValues, effectiveScalarValues)
    const factsWithGrants = withCharacterActiveGrants(
      characterFacts.ruleEvaluation.facts,
      activeEffects
    )
    const effectiveRulePolicyOutput =
      scalarsReduced || factsWithGrants !== characterFacts.ruleEvaluation.facts
        ? resolveCharacterRulePolicyRollModes(
            evaluateInstalledCharacterPolicy({
              gameSystemId,
              facts: scalarsReduced
                ? applyCharacterScalarValuesToFacts(
                    factsWithGrants,
                    gameSystemId,
                    baseScalarValues,
                    effectiveScalarValues
                  )
                : factsWithGrants
            }),
            characterFacts.prepared.context.vocabularySnapshot
          )
        : baseRulePolicyOutput
    const effectiveMaximumHitPoints = nativeCharacterMaximumHitPoints(characterFacts, activeEffects)
    const conditionDefinitionIds = [...systemConditions].sort()
    const spellCast = input.includeReactionSources
      ? buildCharacterSpellCastActions({
          spellCastCandidates: characterFacts.ruleEvaluation.facts.spellCastCandidates,
          castableCandidateIds: listCastableSpellCandidateIds({
            character: characterFacts.character,
            ruleEvaluation: {
              ...characterFacts.ruleEvaluation,
              output: effectiveRulePolicyOutput
            }
          }),
          policyOutput: effectiveRulePolicyOutput,
          spellDocumentsById: characterFacts.prepared.context.spellDocumentsById,
          firstSequence: characterFacts.ruleEvaluation.facts.actionCandidates.length
        })
      : null
    // A cast the Encounter cannot compile is not offered: choosing it could only be refused as stale.
    const spellEntryPoints = spellCast
      ? compileCharacterActionEntryPoints({
          gameSystemId,
          candidates: spellCast.candidates,
          descriptors: discoverCharacterActionCapabilities({
            gameSystemId,
            candidates: spellCast.candidates,
            conditionDefinitionIds,
            abilityDefinitions: characterFacts.ruleEvaluation.facts.abilityDefinitions,
            entryPoints: spellCast.entryPoints
          })
        })
      : []
    const executableActionIds = new Set(
      spellEntryPoints
        .filter((entry) => entry.compilation.kind === 'COMPILED')
        .map((entry) => entry.actionId)
    )
    const characterSpellCast = spellCast && {
      candidates: spellCast.candidates.filter((c) => executableActionIds.has(c.actionId)),
      decisions: spellCast.decisions.filter((d) => executableActionIds.has(d.actionId)),
      compiledActionEntryPoints: spellEntryPoints.filter((entry) =>
        executableActionIds.has(entry.actionId)
      )
    }
    return {
      actor,
      activeEffects,
      characterFacts,
      state: {
        current: characterFacts.character.state.hitpoints.current,
        temporary: characterFacts.character.state.hitpoints.temp ?? 0,
        conditions: conditionIds,
        deathSaves: characterFacts.character.state.hitpoints.deathSaves
      },
      initialConditionRows: null,
      effectiveMaximumHitPoints,
      baseScalarValues,
      effectiveScalarValues,
      baseRulePolicyOutput,
      effectiveRulePolicyOutput,
      perceptionSenses: baseRulePolicyOutput.senses,
      ...(input.includeReactionSources
        ? {
            characterReactionSource: {
              id: actor.sourceId,
              systemId: characterFacts.character.systemId,
              streamVersion: characterFacts.active.play.streamVersion,
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
                    conditionDefinitionIds,
                    abilityDefinitions: characterFacts.ruleEvaluation.facts.abilityDefinitions,
                    entryPoints: characterFacts.ruleEvaluation.actionEntryPoints
                  })
                })
              }
            },
            ...(characterSpellCast ? { characterSpellCast } : {})
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
      attackAgainstContributors: [],
      conditionDefinitions: [],
      conditionMechanics: []
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
  const targetProtection = withCreatureActiveGrantProtection(
    actorRule.targetProtection,
    activeEffects
  )
  const conditions = readEncounterActorConditionState(actor.conditions ?? [])
  const creatureStatBlock = snapshotStatBlock(actor)
  return {
    actor,
    activeEffects,
    characterFacts: null,
    state: {
      current: actor.currentHitPoints,
      temporary: actor.tempHitPoints,
      conditions: conditions.ids,
      deathSaves: null
    },
    initialConditionRows: conditions.values,
    effectiveMaximumHitPoints: effectiveHitPointMaximum(actor.maxHitPoints, activeEffects),
    baseScalarValues,
    effectiveScalarValues,
    baseRulePolicyOutput: null,
    effectiveRulePolicyOutput: null,
    perceptionSenses: creatureStatBlock?.senses ?? [],
    characterCurrentness: null,
    targetDerivedFacts: {
      actorId: actorRule.actorId,
      initiativeModifier: actorRule.initiativeModifier,
      savingThrowDefinitions: withCreatureActiveGrantSaves(
        actorRule.savingThrowDefinitions ?? [],
        actor.id,
        activeEffects
      ),
      featureResources: actorRule.featureResources,
      targetProtection,
      statBlock: creatureStatBlock && {
        ...creatureStatBlock,
        armorClass: withCreatureActiveGrantArmorClass(creatureStatBlock.armorClass, activeEffects),
        speeds: withActiveGrantSpeeds(creatureStatBlock.speeds ?? [], activeEffects)
      }
    },
    defenses: targetProtection.defenses,
    qualifiedDefenses: targetProtection.qualifiedDefenses,
    conditionImmunityIds: targetProtection.conditionImmunityIds,
    attackAgainstContributors: [],
    conditionDefinitions: [],
    conditionMechanics: []
  }
}
