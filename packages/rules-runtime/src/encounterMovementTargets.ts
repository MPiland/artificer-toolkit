import type { DamageDefenseBypassCode } from '@artificer-toolkit/shared/core'
import type { CharacterDeathSaves } from '@artificer-toolkit/schema/shared/characterDeathSaves'
import type { EncounterMovementReactionCharacterSource } from './encounterMovementReactionSources.js'
import { discoverCharacterActionCapabilities } from './characterActionCapabilityDiscovery.js'
import { compileCharacterActionEntryPoints } from './encounterActionEntryPointCompiler.js'
import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { SenseRangeDto } from '@artificer-toolkit/schema/grants/sense'
import {
  featureHeldDamageInterceptions,
  heldBatchInputs,
  type HeldDamageInterception
} from './encounterDamageInterception.js'
import {
  buildCharacterSpellCastActions,
  type CharacterSpellCastActions,
  listCastableSpellCandidateIds
} from './character/characterSpellCastActions.js'
import {
  type EncounterAttackAgainstContributor,
  type EncounterHolderState,
  type EncounterSourceSightSave,
  withActiveGrantSpeeds,
  withCharacterActiveGrants,
  withCreatureActiveGrantArmorClass,
  creatureInnateConditionIds,
  withCreatureActiveGrantProtection,
  withCreatureActiveGrantSaves,
  encounterSavingThrowAddedDice
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
import { innateConditionIds } from './encounterInnateConditions.js'
import { buildEncounterActorRuleFacts } from './encounterActorRuleFacts.js'
import {
  bindEncounterActorRuleOutputToFacts,
  reconcileEncounterActorRuleOutput,
  requireEncounterActorRuleResult
} from './encounterActorRuleOutput.js'
import { snapshotCreatureTypeId, snapshotFeatureDefinitions } from './encounterActorState.js'
import { characterFormStatBlock, snapshotStatBlock } from './encounterProjection.js'
import type { TargetBoundActiveRuleEffectExecutionInput } from './targetBoundActiveRuleEffectExecutor.js'
import { readEncounterActorConditionState } from './encounterCharacterMechanicsBatch.js'
import { evaluateInstalledCharacterPolicy } from './platformCharacterPolicy.js'
import { resolveCharacterRulePolicyRollModes } from './character/characterRuleRollProjection.js'
import type { QualifiedDamageDefense } from './attackProfileCapability.js'
import {
  attackProfileCapabilityRegistry,
  evaluateInstalledEncounterActors
} from './platformEncounterPolicy.js'
import {
  encounterActorMovementPassage,
  type EncounterMovementPassage
} from './encounterMovementPassagePolicy.js'
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
    context: Pick<CharacterBuilderContext, 'vocabularySnapshot' | 'spellsById'> & {
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
    /** The active effect whose temporary hit points these are; absent when none (D156). */
    temporarySourceEffectId?: string
    conditions: readonly string[]
    /** A Character's death saves; null for an actor that is simply defeated at 0 (D63). */
    deathSaves: CharacterDeathSaves | null
  }
  initialConditionRows: readonly unknown[] | null
  /** The maximum of the hit points `state` holds: a Character in a form has the form's. */
  effectiveMaximumHitPoints: number
  /** The actor's unspent damage interceptions (`heldBatchInputs`), passed to every batch planned for it. */
  damageInterceptions: readonly HeldDamageInterception[]
  /** A Character's own effective maximum, which differs from `effectiveMaximumHitPoints` in a form. */
  sheetMaximumHitPoints?: number | undefined
  baseScalarValues: Readonly<Record<string, number>>
  effectiveScalarValues: Readonly<Record<string, number>>
  baseRulePolicyOutput: CharacterRulePolicyOutput | null
  effectiveRulePolicyOutput: CharacterRulePolicyOutput | null
  /** The Senses the actor perceives with: a Character's, with its Active Effect grants, or a Creature's authored ones. */
  perceptionSenses: readonly { senseDefinitionId: string; range: SenseRangeDto }[]
  targetDerivedFacts: Readonly<Record<string, unknown>>
  /** The save-bonus aura amount (D155) its save rows include, which a rebuilt turn target keeps. */
  occupantSaveBonus?: number
  defenses: TargetBoundActiveRuleEffectExecutionInput['defenses']
  /** Defenses that apply only to attacks without their bypassing traits. */
  qualifiedDefenses: readonly QualifiedDamageDefense[]
  conditionImmunityIds: readonly string[]
  /** Conditions the actor always has (see `heldConditionIds`); `state.conditions` holds only those applied to it. */
  innateConditionIds: readonly string[]
  /** What the actor's own grants let it move through (D154). */
  movementPassage: EncounterMovementPassage
  /** The attack traits the actor's grants (a Character's fold, a Creature's features) give every attack. */
  grantedAttackTraits: readonly DamageDefenseBypassCode[]
  /** A Creature's folded feature grants, whose attack roll modes its attacks read; empty for a Character, whose policy output carries its own. */
  featureModifiers: CharacterGrantFoldOutput['modifiers']
  /** Magic schools whose spells have no effect on the actor. */
  spellSchoolImmunityIds: readonly string[]
  characterCurrentness: { projectionChecksum: string; mechanicalContextChecksum: string } | null
  /**
   * Contributors attack rolls against the actor gain from its active `ATTACKS_AGAINST` grants
   * (Dodge), set by `withEncounterHolderDefense`; empty until a flow applies it. Those that require
   * the holder to see the attacker hold only then, which `prepareEncounterActionMechanics` decides
   * per attack.
   */
  attackAgainstContributors: readonly EncounterAttackAgainstContributor[]
  /**
   * The saving-throw grants that hold only while the actor sees the effect's source (Danger
   * Sense), set by `withEncounterHolderDefense`; empty until a flow applies it.
   * `prepareEncounterActionMechanics` decides them per save.
   */
  sourceSightSaves: readonly EncounterSourceSightSave[]
  /**
   * What the actor could do when `withEncounterHolderDefense` applied its grants, which a rebuilt
   * turn target re-applies them with; absent when it had none.
   */
  holderState?: EncounterHolderState
  /**
   * The actor's pinned condition definitions (D94), loaded by `withEncounterConditionMechanics`
   * and carried across rebuilds so `applyEncounterConditionMechanics` can re-derive its mechanics;
   * empty until a flow loads them.
   */
  conditionDefinitions: readonly PinnedConditionRuleStateDefinitionDto[]
  /** The mechanics the actor's current conditions apply, derived from `conditionDefinitions`. */
  conditionMechanics: readonly EncounterConditionMechanic[]
}

/** The Character's current condition ids: its play state's and its Campaign context's, unique. */
export function characterConditionIds(characterFacts: CharacterMovementFacts): string[] {
  return [
    ...new Set([
      ...(characterFacts.character.state.conditions ?? []).map(
        (condition) => condition.conditionTypeId
      ),
      ...characterFacts.campaignContext.conditions.map((condition) => condition.conditionTypeId)
    ])
  ]
}

/** The sum of a Character's class levels. */
export function characterTotalLevel(characterFacts: CharacterMovementFacts): number {
  return characterFacts.ruleEvaluation.facts.grantFoldFacts.base.classes.reduce(
    (sum, { level }) => sum + level,
    0
  )
}

/** A Creature snapshot's pinned rule facts. */
function creatureRuleFacts(snapshot: unknown, gameSystemId: string) {
  if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot))
    throw new Error('Encounter actor scalar facts are stale.')
  const facts = encounterCreatureRuleFactsSnapshotSchema.parse(
    (snapshot as { ruleFacts?: unknown }).ruleFacts
  )
  if (facts.gameSystemId !== gameSystemId)
    throw new Error('Encounter actor scalar facts are stale.')
  return facts
}

/** The Character's policy output with its armor class replaced by the form's. */
function withFormArmorClass(
  output: CharacterRulePolicyOutput,
  armorClass: number
): CharacterRulePolicyOutput {
  return {
    ...output,
    derivedStats: {
      ...output.derivedStats,
      armorClass: {
        ...output.derivedStats.armorClass,
        base: armorClass,
        effective: armorClass,
        contributions: []
      }
    }
  }
}

function nativeCharacterBatchInputs(
  characterFacts: CharacterMovementFacts,
  activeEffects: ActiveRuleEffectRecord[]
) {
  return heldBatchInputs({
    baseMaximumHitPoints: resolveCharacterEffectiveMaximumHitPoints(
      characterFacts.ruleEvaluation.output.derivedStats.maxHitPoints.effective
    ),
    effects: activeEffects
  })
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
    const conditionIds = characterConditionIds(characterFacts)
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
    const { form } = actor
    // In a form the physical scores are the form's and the mental ones the Character's, baked into
    // the snapshot when the form was entered (D130 amendment).
    const targetScalarValues =
      form === null
        ? baseScalarValues
        : { ...creatureRuleFacts(form.snapshot, gameSystemId).abilityScores }
    const effectiveScalarValues = foldActiveScalarReductions({
      baseScalarValues: targetScalarValues,
      effects: activeEffects
    })
    const scalarsReduced = scalarValuesDiffer(baseScalarValues, effectiveScalarValues)
    const factsWithGrants = withCharacterActiveGrants(
      characterFacts.ruleEvaluation.facts,
      activeEffects
    )
    const policyOutput =
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
    const formStatBlock = characterFormStatBlock(actor)
    const formArmorClass =
      formStatBlock?.armorClass == null
        ? null
        : (withCreatureActiveGrantArmorClass(formStatBlock.armorClass, activeEffects) ??
          formStatBlock.armorClass)
    const effectiveRulePolicyOutput =
      formArmorClass === null ? policyOutput : withFormArmorClass(policyOutput, formArmorClass)
    const sheetInputs = nativeCharacterBatchInputs(characterFacts, activeEffects)
    const { effectiveMaximumHitPoints, damageInterceptions } =
      form === null
        ? sheetInputs
        : heldBatchInputs({ baseMaximumHitPoints: form.maxHitPoints, effects: activeEffects })
    const sheetMaximumHitPoints = sheetInputs.effectiveMaximumHitPoints
    const conditionDefinitionIds = [...systemConditions].sort()
    // A form that cannot cast offers no spells; Concentration on one already held stays (D130).
    const spellCast =
      input.includeReactionSources && form === null
        ? buildCharacterSpellCastActions({
            spellCastCandidates: characterFacts.ruleEvaluation.facts.spellCastCandidates,
            spellAccessCandidates: characterFacts.ruleEvaluation.facts.spellAccessCandidates,
            castableCandidateIds: listCastableSpellCandidateIds({
              character: characterFacts.character,
              ruleEvaluation: {
                ...characterFacts.ruleEvaluation,
                output: effectiveRulePolicyOutput
              }
            }),
            policyOutput: effectiveRulePolicyOutput,
            spellsById: characterFacts.prepared.context.spellsById,
            characterLevel: characterTotalLevel(characterFacts),
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
    const characterSpellCast: CharacterSpellCastActions | null = spellCast
      ? {
          candidates: spellCast.candidates.filter((c) => executableActionIds.has(c.actionId)),
          decisions: spellCast.decisions.filter((d) => executableActionIds.has(d.actionId)),
          compiledActionEntryPoints: spellEntryPoints.filter((entry) =>
            executableActionIds.has(entry.actionId)
          ),
          magicSchoolIdBySpellId: new Map(
            [...(characterFacts.prepared.context.spellsById ?? [])].map(([spellId, spell]) => [
              spellId,
              spell.magicSchoolId
            ])
          )
        }
      : input.includeReactionSources
        ? {
            candidates: [],
            decisions: [],
            compiledActionEntryPoints: [],
            magicSchoolIdBySpellId: new Map()
          }
        : null
    return {
      actor,
      activeEffects,
      characterFacts,
      state:
        form === null
          ? {
              current: characterFacts.character.state.hitpoints.current,
              temporary: characterFacts.character.state.hitpoints.temp,
              ...(characterFacts.character.state.hitpoints.tempSourceEffectId && {
                temporarySourceEffectId: characterFacts.character.state.hitpoints.tempSourceEffectId
              }),
              conditions: conditionIds,
              deathSaves: characterFacts.character.state.hitpoints.deathSaves
            }
          : {
              current: form.currentHitPoints,
              temporary: form.tempHitPoints,
              ...(form.tempHitPointsSourceEffectId && {
                temporarySourceEffectId: form.tempHitPointsSourceEffectId
              }),
              conditions: conditionIds,
              deathSaves: null
            },
      initialConditionRows: null,
      effectiveMaximumHitPoints,
      damageInterceptions,
      sheetMaximumHitPoints,
      baseScalarValues: targetScalarValues,
      effectiveScalarValues,
      baseRulePolicyOutput,
      effectiveRulePolicyOutput,
      perceptionSenses: effectiveRulePolicyOutput.senses,
      ...(input.includeReactionSources
        ? {
            characterReactionSource: {
              id: actor.sourceId,
              systemId: characterFacts.character.systemId,
              streamVersion: characterFacts.active.play.streamVersion,
              actor,
              activeConditionDefinitionIds: conditionIds,
              // In a form the Sheet's actions are not the Character's: the form's stat block supplies them (T4d).
              mechanics:
                form === null
                  ? {
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
                          abilityDefinitions:
                            characterFacts.ruleEvaluation.facts.abilityDefinitions,
                          entryPoints: characterFacts.ruleEvaluation.actionEntryPoints
                        })
                      })
                    }
                  : { rulePolicyInput: { actionCandidates: [] }, compiledActionEntryPoints: [] }
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
        // The form's ability scores resolve its attacks' damage, as a Creature's stat block does (T4d).
        ...(formStatBlock ? { statBlock: formStatBlock } : {}),
        savingThrowAddedDice: encounterSavingThrowAddedDice(gameSystemId, activeEffects),
        targetProtection: {
          status: 'NORMALIZED',
          defenses: effectiveRulePolicyOutput.defenses,
          qualifiedDefenses: [],
          conditionImmunityIds: effectiveRulePolicyOutput.conditionImmunityIds,
          spellSchoolImmunityIds: effectiveRulePolicyOutput.spellSchoolImmunityIds
        }
      },
      defenses: effectiveRulePolicyOutput.defenses,
      qualifiedDefenses: [],
      conditionImmunityIds: effectiveRulePolicyOutput.conditionImmunityIds,
      movementPassage: encounterActorMovementPassage(
        gameSystemId,
        actor,
        effectiveRulePolicyOutput
      ),
      grantedAttackTraits: attackProfileCapabilityRegistry
        .require(gameSystemId)
        .grantedAttackTraits(effectiveRulePolicyOutput.grantFold.modifiers),
      innateConditionIds: innateConditionIds(effectiveRulePolicyOutput.grantFold.modifiers),
      featureModifiers: [],
      spellSchoolImmunityIds: effectiveRulePolicyOutput.spellSchoolImmunityIds,
      attackAgainstContributors: [],
      sourceSightSaves: [],
      conditionDefinitions: [],
      conditionMechanics: []
    }
  }
  const creatureFacts =
    actor.kind === 'CREATURE' ? creatureRuleFacts(actor.snapshot, gameSystemId) : null
  const baseScalarValues: Record<string, number> = { ...creatureFacts?.abilityScores }
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
    activeEffects,
    creatureFacts?.modifiers ?? []
  )
  const conditions = readEncounterActorConditionState(actor.conditions ?? [])
  const creatureStatBlock = snapshotStatBlock(actor)
  const featureDefinitions = snapshotFeatureDefinitions(actor)
  return {
    actor,
    activeEffects,
    characterFacts: null,
    state: {
      current: actor.currentHitPoints,
      temporary: actor.tempHitPoints,
      ...(actor.tempHitPointsSourceEffectId && {
        temporarySourceEffectId: actor.tempHitPointsSourceEffectId
      }),
      conditions: conditions.ids,
      deathSaves: null
    },
    initialConditionRows: conditions.values,
    ...heldBatchInputs({
      baseMaximumHitPoints: actor.maxHitPoints,
      effects: activeEffects,
      featureInterceptions: featureHeldDamageInterceptions({
        modifiers: creatureFacts?.modifiers ?? [],
        featureResources: actorRule.featureResources.map(({ featureId, maximum, used }) => ({
          featureId,
          maximum,
          used,
          chargeId: featureDefinitions.find(({ id }) => id === featureId)?.charges?.id ?? null
        }))
      })
    }),
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
        gameSystemId,
        actorRule.savingThrowDefinitions ?? [],
        actor.id,
        activeEffects,
        creatureFacts?.modifiers ?? []
      ),
      savingThrowAddedDice: encounterSavingThrowAddedDice(gameSystemId, activeEffects),
      featureResources: actorRule.featureResources,
      creatureTypeId: snapshotCreatureTypeId(actor),
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
    movementPassage: encounterActorMovementPassage(gameSystemId, actor, null),
    grantedAttackTraits: attackProfileCapabilityRegistry
      .require(gameSystemId)
      .grantedAttackTraits(creatureFacts?.modifiers ?? []),
    innateConditionIds: creatureInnateConditionIds(activeEffects, creatureFacts?.modifiers ?? []),
    featureModifiers: creatureFacts?.modifiers ?? [],
    spellSchoolImmunityIds: targetProtection.spellSchoolImmunityIds,
    attackAgainstContributors: [],
    sourceSightSaves: [],
    conditionDefinitions: [],
    conditionMechanics: []
  }
}
