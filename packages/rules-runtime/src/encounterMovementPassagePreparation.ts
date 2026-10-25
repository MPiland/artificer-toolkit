import {
  creatureActiveGrantCheckContributors,
  encounterFeatureSkillCheckContributors,
  mergedRollContributors,
  withCreatureActiveGrantSkillTotal
} from './encounterActiveGrants.js'
import type { D20AddedDieDto } from '@artificer-toolkit/schema/shared/d20AddedDice'
import type { D20MinimumRollDto } from '@artificer-toolkit/schema/shared/d20MinimumRoll'
import {
  activeAbilityCheckDice,
  activeAbilityCheckMinimumRoll
} from './character/activeEffectGrantTotals.js'
import { freezeD20Context } from './encounterD20Settlement.js'
import { withEncounterConditionCheckContributors } from './encounterConditionMechanics.js'
import type {
  OptionalCombatPassageChoicePendingContextDto,
  ServerContestCheckPendingApplicationContextDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  activeOptionalCombatDefinitions,
  encounterOptionalCombatSnapshotDtoSchema
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { encounterCreatureRuleFactsSnapshotSchema } from '@artificer-toolkit/schema/api/encounterActorRules'
import { sizeRank } from '@artificer-toolkit/shared/core'
import { sizeCodeSchema } from '@artificer-toolkit/schema/shared/enums'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import { resolveAbilityAlias } from '@artificer-toolkit/shared/character'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  characterCheckSkillId,
  toCharacterInitiativeActorFacts
} from './character/characterInitiativeFacts.js'
import { createEncounterMovementPassageChoice } from './encounterMovementPassageChoice.js'
import type { EncounterActionEconomyConsumption } from './encounterActionEconomyConsumption.js'
import type { CharacterMovementFacts, MovementTarget } from './encounterMovementTargets.js'
import { EncounterValidationError } from './encounterErrors.js'
import { prepareEncounterContestPendingContext } from './encounterContestPendingContext.js'
import {
  contestCheckCapabilityRegistry,
  optionalCombatPolicyCapabilityRegistry
} from './platformEncounterPolicy.js'
import { abilityScoreCapabilityRegistry } from './platformPolicyModules.js'

type PassageReads<TCharacterFacts extends CharacterMovementFacts> = {
  loadSystem: () => Promise<SystemAuthoredDto>
  prepareEconomy: (input: {
    actor: EncounterRunActorState
    state: EncounterRunState
    activation: { code: string; amount: number }
    target: MovementTarget<TCharacterFacts>
  }) => Promise<EncounterActionEconomyConsumption | null>
}

export type ContestFacts = {
  controllerCharacterId: string | null
  contributors: ServerContestCheckPendingApplicationContextDto['initiator']['contributors']
  modifier: number | null
  rollMode: string
  size: string | null
  /** The dice the actor's active effects add to this check (D156). */
  addedDice: D20AddedDieDto[]
  /** The floor the actor's active effects put on this check's d20; null when it has none. */
  minimumRoll: D20MinimumRollDto | null
}

type PassagePreparationInput<TCharacterFacts extends CharacterMovementFacts> = {
  state: EncounterRunState
  movement: OptionalCombatPassageChoicePendingContextDto['movement']
  sourceActorId: string
  targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
}

/** A Character's ability check by ability definition: its modifier, evidence and roll mode. */
function characterAbilityCheck(
  facts: CharacterMovementFacts,
  policy: CharacterRulePolicyOutput,
  abilityDefinitionId: string
) {
  const code = facts.ruleEvaluation.facts.abilityDefinitions.find(
    (definition) => definition.id === abilityDefinitionId
  )?.code
  if (code === undefined) return { modifier: undefined, evidence: undefined, rollMode: undefined }
  // The System may spell an ability by its short alias while the rules output keys it by the full
  // code: every lookup goes through the one canonical key.
  const canonicalKey = (ability: string) => resolveAbilityAlias(ability) ?? ability
  const canonical = canonicalKey(code)
  const byCanonical = <TValue>(record: Readonly<Record<string, TValue>>) => record[canonical]
  return {
    modifier: policy.derivedStats.abilities.find(
      (entry) => canonicalKey(entry.abilityId) === canonical
    )?.modifier.effective,
    evidence: byCanonical(policy.rollContributorEvidence.abilityChecks),
    rollMode: byCanonical(policy.rollModes.abilityChecks)
  }
}

/** The check's name as the roller reads it: "Strength" or "Wisdom (Medicine)". */
export function encounterBasicActionCheckLabel(
  system: SystemAuthoredDto,
  checkDefinitionId: string
): string {
  const abilityCheck = system.abilities.find((entry) => entry.id === checkDefinitionId)
  if (abilityCheck) return abilityCheck.label
  const skill = system.skills.find((entry) => entry.id === checkDefinitionId)
  if (!skill) throw new EncounterValidationError('The basic action check is not in the System.')
  const ability = system.abilities.find((entry) => entry.id === skill.governingAbilityDefinitionId)
  return ability ? `${ability.label} (${skill.label})` : skill.label
}

/**
 * The ability code a check is made with: the ability itself, or the skill's governing ability in
 * the System. Active check grants that name an ability apply by it.
 */
export function checkAbilityCode(
  system: SystemAuthoredDto,
  checkKind: 'SKILL' | 'ABILITY',
  checkDefinitionId: string
): string | null {
  const abilityId =
    checkKind === 'ABILITY'
      ? checkDefinitionId
      : system.skills.find((skill) => skill.id === checkDefinitionId)?.governingAbilityDefinitionId
  return system.abilities.find((ability) => ability.id === abilityId)?.code ?? null
}

/**
 * An actor's modifier, contributors and roll mode for one System check: a skill check, or an
 * ability check named by its ability definition.
 */
export function actorContestFacts<TCharacterFacts extends CharacterMovementFacts>(input: {
  actorId: string
  checkKind: 'SKILL' | 'ABILITY'
  checkDefinitionId: string
  gameSystemId: string
  system: SystemAuthoredDto
  targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
}): ContestFacts {
  const target = input.targets.get(input.actorId)
  if (!target || target.actor.id !== input.actorId || target.actor.systemId !== input.gameSystemId)
    throw new Error('Movement passage actor facts are stale.')
  const abilityCode = checkAbilityCode(input.system, input.checkKind, input.checkDefinitionId)
  const withConditions = (
    facts: Omit<ContestFacts, 'addedDice' | 'minimumRoll'>
  ): ContestFacts => ({
    ...facts,
    addedDice: activeAbilityCheckDice(target.activeEffects, abilityCode),
    minimumRoll: activeAbilityCheckMinimumRoll(target.activeEffects, abilityCode),
    ...withEncounterConditionCheckContributors({
      gameSystemId: input.gameSystemId,
      holderActorId: target.actor.id,
      mechanics: target.conditionMechanics,
      roll: facts
    })
  })
  // A Character whose form replaces its proficiencies checks as the form's Creature (D191).
  const { formCreature } = target
  if (target.actor.kind === 'CHARACTER' && !formCreature) {
    const facts = target.characterFacts
    const policy = target.effectiveRulePolicyOutput
    if (!facts || !policy || !target.actor.sourceId || facts.active.id !== target.actor.sourceId)
      throw new Error('Movement passage Character facts are unavailable.')
    const initiative = toCharacterInitiativeActorFacts({
      snapshot: facts.ruleEvaluation.snapshot,
      registry: facts.ruleEvaluation.registry,
      rulePolicyOutput: policy
    })
    const skillId = characterCheckSkillId(facts.ruleEvaluation.registry, input.checkDefinitionId)
    const check =
      input.checkKind === 'SKILL'
        ? {
            modifier: initiative.checkTotals[input.checkDefinitionId],
            evidence: skillId ? policy.rollContributorEvidence.skillChecks[skillId] : undefined,
            rollMode: skillId ? policy.rollModes.skillChecks[skillId] : undefined
          }
        : characterAbilityCheck(facts, policy, input.checkDefinitionId)
    // A skill grant its holder state decides (Supreme Sneak) is judged here; the fold fails it closed.
    const featureCheck =
      input.checkKind === 'SKILL' && skillId && target.holderState
        ? mergedRollContributors(
            input.gameSystemId,
            check.evidence ?? [],
            encounterFeatureSkillCheckContributors({
              holderActorId: target.actor.id,
              grantFold: policy.grantFold,
              holderState: target.holderState,
              skillAliases:
                facts.ruleEvaluation.facts.derivedBaseFacts.skills.find(
                  (skill) => skill.skillId === skillId
                )?.proficiencySubjectIds ?? []
            })
          )
        : null
    return withConditions({
      controllerCharacterId: facts.active.id,
      contributors: featureCheck?.contributors ?? check.evidence ?? [],
      modifier:
        typeof check.modifier === 'number' && Number.isSafeInteger(check.modifier)
          ? check.modifier
          : null,
      rollMode: featureCheck?.rollMode ?? check.rollMode ?? 'NORMAL',
      size: initiative.effectiveSize
    })
  }
  const creature = formCreature ?? target.actor
  if (creature.kind === 'CREATURE') {
    if (
      typeof creature.snapshot !== 'object' ||
      creature.snapshot === null ||
      Array.isArray(creature.snapshot) ||
      typeof creature.snapshot.payload !== 'object' ||
      creature.snapshot.payload === null ||
      Array.isArray(creature.snapshot.payload)
    )
      throw new Error('Movement passage Creature facts are unavailable.')
    const ruleFacts = encounterCreatureRuleFactsSnapshotSchema.parse(creature.snapshot.ruleFacts)
    if (ruleFacts.gameSystemId !== input.gameSystemId)
      throw new Error('Movement passage Creature facts are stale.')
    const abilityScore = ruleFacts.abilityScores[input.checkDefinitionId]
    const modifier =
      input.checkKind === 'SKILL'
        ? withCreatureActiveGrantSkillTotal(
            ruleFacts.checkTotals?.[input.checkDefinitionId],
            input.checkDefinitionId,
            target.activeEffects
          )
        : abilityScore === undefined
          ? undefined
          : abilityScoreCapabilityRegistry.require(input.gameSystemId).abilityModifier(abilityScore)
    const granted = mergedRollContributors(
      input.gameSystemId,
      [],
      creatureActiveGrantCheckContributors(
        creature.id,
        checkAbilityCode(input.system, input.checkKind, input.checkDefinitionId),
        target.activeEffects
      )
    )
    return withConditions({
      controllerCharacterId: target.actor.kind === 'CHARACTER' ? target.actor.sourceId : null,
      contributors: granted.contributors,
      modifier: typeof modifier === 'number' && Number.isSafeInteger(modifier) ? modifier : null,
      rollMode: granted.rollMode,
      size: sizeCodeSchema.parse(creature.snapshot.payload.size)
    })
  }
  throw new Error('Movement passage Custom actors cannot contest passage.')
}

function passageActors<TCharacterFacts extends CharacterMovementFacts>(input: {
  state: EncounterRunState
  choice: OptionalCombatPassageChoicePendingContextDto
  targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
}) {
  const source = input.targets.get(input.choice.sourceActorId)
  const blocker = input.targets.get(input.choice.movement.blockerActorId)
  if (
    !source ||
    !blocker ||
    source.actor.id !== input.choice.sourceActorId ||
    blocker.actor.id !== input.choice.movement.blockerActorId ||
    source.actor.encounterId !== input.state.id ||
    blocker.actor.encounterId !== input.state.id ||
    source.actor.systemId !== input.state.gameSystemId ||
    blocker.actor.systemId !== input.state.gameSystemId
  )
    throw new Error('Movement passage actors are stale.')
  return { blocker, source }
}

type PassageContestInput<TCharacterFacts extends CharacterMovementFacts> = {
  state: EncounterRunState
  choice: OptionalCombatPassageChoicePendingContextDto
  optionId: string
  targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
}

/** Creates one sealed contest from an issued passage option without changing Encounter state. */
export async function prepareEncounterMovementPassageContest<
  TCharacterFacts extends CharacterMovementFacts
>(
  reads: PassageReads<TCharacterFacts>,
  input: PassageContestInput<TCharacterFacts>
): Promise<ServerContestCheckPendingApplicationContextDto> {
  const option = input.choice.options.find((candidate) => candidate.optionId === input.optionId)
  if (!option) throw new Error('Movement passage option is unavailable.')
  const { source } = passageActors(input)
  const system = await reads.loadSystem()
  if (system.id !== input.state.gameSystemId) throw new Error('Movement passage System is stale.')
  const economy = await reads.prepareEconomy({
    actor: source.actor,
    state: input.state,
    activation: { code: option.economy, amount: 1 },
    target: source
  })
  if (!economy) throw new Error('Movement passage allowance is unavailable.')
  return prepareMovementPassageContest(input, economy, system)
}

/** All options in one read-only choice share the same current allowance observations. */
function prepareMovementPassageContest<TCharacterFacts extends CharacterMovementFacts>(
  input: PassageContestInput<TCharacterFacts>,
  economy: EncounterActionEconomyConsumption,
  system: SystemAuthoredDto
): ServerContestCheckPendingApplicationContextDto {
  const option = input.choice.options.find((candidate) => candidate.optionId === input.optionId)
  if (!option) throw new Error('Movement passage option is unavailable.')
  const { blocker, source } = passageActors(input)
  const common = {
    actionEconomy: option.economy,
    actionEconomyAvailable: true,
    automationMode: input.state.automationMode,
    blockerActorId: blocker.actor.id,
    gameSystemId: input.state.gameSystemId,
    initiatorActorId: source.actor.id,
    optionalCombatSnapshot: input.state.optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum,
    passageAlreadyUsedThisTurn: false
  }
  const sourceSize = actorContestFacts({
    actorId: source.actor.id,
    checkKind: 'SKILL',
    checkDefinitionId: '00000000-0000-0000-0000-000000000000',
    gameSystemId: input.state.gameSystemId,
    system,
    targets: input.targets
  }).size
  const blockerSize = actorContestFacts({
    actorId: blocker.actor.id,
    checkKind: 'SKILL',
    checkDefinitionId: '00000000-0000-0000-0000-000000000000',
    gameSystemId: input.state.gameSystemId,
    system,
    targets: input.targets
  }).size
  const policy = optionalCombatPolicyCapabilityRegistry.require(input.state.gameSystemId)
  const preliminary =
    option.ruleKind === 'OVERRUN'
      ? policy.prepareOverrunContest({
          ...common,
          initiatorSizeRank: sizeRank(sourceSize),
          targetSizeRank: sizeRank(blockerSize),
          qualifiedInitiatorContributors: []
        })
      : policy.prepareTumbleContest(common)
  if (preliminary.kind !== 'PROPOSED') throw new Error('Movement passage policy is unavailable.')
  const initiator = actorContestFacts({
    actorId: source.actor.id,
    checkKind: 'SKILL',
    checkDefinitionId: preliminary.proposal.contest.initiatorCheckDefinitionId,
    gameSystemId: input.state.gameSystemId,
    system,
    targets: input.targets
  })
  const defender = actorContestFacts({
    actorId: blocker.actor.id,
    checkKind: 'SKILL',
    checkDefinitionId: preliminary.proposal.contest.targetCheckDefinitionId,
    gameSystemId: input.state.gameSystemId,
    system,
    targets: input.targets
  })
  if (initiator.modifier === null || defender.modifier === null)
    throw new Error('Movement passage contest facts are unavailable.')
  const resolved =
    option.ruleKind === 'OVERRUN'
      ? {
          ruleKind: 'OVERRUN' as const,
          result: policy.prepareOverrunContest({
            ...common,
            initiatorSizeRank: sizeRank(initiator.size),
            targetSizeRank: sizeRank(defender.size),
            qualifiedInitiatorContributors: initiator.contributors.map((contributor) => ({
              id: contributor.sourceId,
              influence: contributor.influence,
              reason: 'EXISTING_QUALIFIED_FACT' as const
            }))
          })
        }
      : { ruleKind: 'TUMBLE' as const, result: policy.prepareTumbleContest(common) }
  if (resolved.result.kind !== 'PROPOSED')
    throw new Error('Movement passage policy changed before contest.')
  const proposal = resolved.result.proposal
  if (
    proposal.pin.definitionId !== option.definitionId ||
    proposal.pin.definitionVersion !== option.definitionVersion ||
    proposal.pin.definitionChecksum !== option.definitionChecksum ||
    proposal.pin.moduleKey !== option.moduleKey ||
    proposal.pin.moduleContractVersion !== option.moduleContractVersion
  )
    throw new Error('Movement passage definition is stale.')
  let initiatorContributors = initiator.contributors
  let initiatorRollMode = initiator.rollMode
  if (resolved.ruleKind === 'OVERRUN') {
    const overrun = resolved
    if (overrun.result.kind !== 'PROPOSED')
      throw new Error('Movement passage policy changed before contest.')
    // Keep a qualified contributor's grant, domain and source, so a condition still names its holder
    // (D94); the Overrun rule's own size relation is sourced to the rule's definition.
    initiatorContributors = overrun.result.proposal.contest.initiatorContributors.map(
      (contributor) => {
        const qualified = initiator.contributors.find(
          (candidate) => candidate.sourceId === contributor.id
        )
        return {
          sourceId: contributor.id,
          grantId: qualified?.grantId ?? null,
          domainKey: qualified?.domainKey ?? null,
          influence: contributor.influence,
          source: qualified?.source ?? {
            kind: 'AUTHORED' as const,
            id: option.definitionId,
            holderActorId: null
          }
        }
      }
    )
    initiatorRollMode = overrun.result.proposal.contest.initiatorMode
  }
  const graph = contestCheckCapabilityRegistry
    .require(input.state.gameSystemId)
    .optionalCombatContestGraph(proposal.pin)
  return prepareEncounterContestPendingContext({
    origin: {
      kind: 'OPTIONAL_COMBAT',
      actionKind: option.ruleKind,
      pin: {
        snapshotChecksum: input.state.optionalCombatSnapshotChecksum,
        definitionId: proposal.pin.definitionId,
        definitionVersion: proposal.pin.definitionVersion,
        definitionChecksum: proposal.pin.definitionChecksum,
        moduleKey: proposal.pin.moduleKey,
        moduleContractVersion: proposal.pin.moduleContractVersion
      },
      optionId: option.optionId,
      selectionContractChecksum: checksumRuleDocument(option),
      resolvedSelectionChecksum: checksumRuleDocument({ optionId: option.optionId }),
      selection:
        option.ruleKind === 'OVERRUN'
          ? {
              kind: 'OVERRUN',
              economy: option.economy,
              defenderCheckDefinitionId: proposal.contest.targetCheckDefinitionId
            }
          : {
              kind: 'TUMBLE',
              economy: option.economy,
              defenderCheckDefinitionId: proposal.contest.targetCheckDefinitionId
            },
      movementContinuation: input.choice.movement
    },
    actionId: option.optionId,
    sourceActorId: source.actor.id,
    targetActorId: blocker.actor.id,
    initiatorControllerCharacterId: initiator.controllerCharacterId,
    sceneContext: {
      sceneId: input.choice.movement.root.sceneId,
      sceneVersion: input.choice.movement.root.currentSceneVersion,
      sourceTokenId: input.choice.sourceTokenId,
      targetTokenId: input.choice.movement.blockerTokenId
    },
    positionalDependencyChecksum: checksumRuleDocument(input.choice.movement),
    contestGraph: {
      definitionId: graph.published.id,
      checksum: graph.published.checksum,
      identityChecksum: graph.identityChecksum
    },
    source: {
      kind: 'OPTIONAL_COMBAT_DEFINITION',
      definitionId: proposal.pin.definitionId,
      definitionVersion: proposal.pin.definitionVersion,
      definitionChecksum: proposal.pin.definitionChecksum,
      moduleKey: proposal.pin.moduleKey,
      moduleContractVersion: proposal.pin.moduleContractVersion
    },
    target: {
      kind: 'ENCOUNTER_ACTOR',
      currentnessChecksum: input.choice.movement.blockerCurrentnessChecksum
    },
    initiator: {
      actorId: source.actor.id,
      requestNodeId: 'initiator_d20',
      ...freezeD20Context({
        gameSystemId: input.state.gameSystemId,
        rollMode: initiatorRollMode,
        contributors: initiatorContributors,
        modifier: initiator.modifier
      })
    },
    defender: {
      actorId: blocker.actor.id,
      requestNodeId: 'target_d20',
      checks: [
        {
          checkDefinitionId: proposal.contest.targetCheckDefinitionId,
          label: encounterBasicActionCheckLabel(system, proposal.contest.targetCheckDefinitionId),
          ...freezeD20Context({
            gameSystemId: input.state.gameSystemId,
            rollMode: defender.rollMode,
            contributors: defender.contributors,
            modifier: defender.modifier
          })
        }
      ]
    },
    rollEvidence: { initiator: null, defender: null },
    actionEconomy: {
      definitionId: economy.definitionId,
      definitionVersion: economy.definitionVersion,
      definitionChecksum: economy.definitionChecksum,
      maximum: economy.maximum,
      beforeUsed: economy.beforeUsed
    }
  })
}

/** Issues only optional-passage choices that can be prepared from current actor facts. */
export async function availableEncounterMovementPassageChoice<
  TCharacterFacts extends CharacterMovementFacts
>(
  reads: PassageReads<TCharacterFacts>,
  input: PassagePreparationInput<TCharacterFacts>
): Promise<OptionalCombatPassageChoicePendingContextDto | null> {
  if (input.state.automationMode === 'MANUAL' || !input.state.optionalCombatSnapshotChecksum)
    return null
  const snapshot = encounterOptionalCombatSnapshotDtoSchema.safeParse(
    input.state.optionalCombatSnapshot
  )
  if (!snapshot.success || snapshot.data.gameSystemId !== input.state.gameSystemId) return null
  const source = input.targets.get(input.sourceActorId)
  if (
    !source ||
    source.actor.id !== input.sourceActorId ||
    source.actor.encounterId !== input.state.id ||
    source.actor.systemId !== input.state.gameSystemId
  )
    return null
  const definitions = activeOptionalCombatDefinitions({
    automationMode: input.state.automationMode,
    snapshot: snapshot.data
  })
  const economies = await Promise.all(
    (['ACTION', 'BONUS_ACTION'] as const).map(async (economy) => {
      try {
        const prepared = await reads.prepareEconomy({
          actor: source.actor,
          state: input.state,
          activation: { code: economy, amount: 1 },
          target: source
        })
        return prepared ? { code: economy, prepared } : null
      } catch {
        return null
      }
    })
  )
  const options = definitions.flatMap((definition) => {
    const ruleKind = definition.document.kind
    if (ruleKind !== 'OVERRUN' && ruleKind !== 'TUMBLE') return []
    return economies.flatMap((economy) =>
      economy
        ? [
            {
              ruleKind,
              economy: economy.code,
              definitionId: definition.definitionId,
              definitionVersion: definition.definitionVersion,
              definitionChecksum: definition.definitionChecksum,
              moduleKey: definition.document.module.policyModuleKey,
              moduleContractVersion: definition.document.module.contractVersion
            }
          ]
        : []
    )
  })
  if (options.length === 0) return null
  const choice = createEncounterMovementPassageChoice({
    movement: input.movement,
    sourceActorId: input.sourceActorId,
    sourceControllerCharacterId:
      source.actor.kind === 'CHARACTER' ? (source.characterFacts?.active.id ?? null) : null,
    options
  })
  let system: SystemAuthoredDto
  try {
    system = await reads.loadSystem()
    if (system.id !== input.state.gameSystemId) return null
  } catch {
    return null
  }
  const executable = new Set<string>()
  for (const option of choice.options) {
    try {
      const economy = economies.find((candidate) => candidate?.code === option.economy)
      if (!economy) continue
      prepareMovementPassageContest(
        {
          state: input.state,
          choice,
          optionId: option.optionId,
          targets: input.targets
        },
        economy.prepared,
        system
      )
      executable.add(option.optionId)
    } catch {
      // Missing or stale contest facts make this issued option unavailable.
    }
  }
  const accepted = options.filter((candidate) =>
    choice.options.some(
      (option) =>
        executable.has(option.optionId) &&
        option.definitionId === candidate.definitionId &&
        option.definitionVersion === candidate.definitionVersion &&
        option.economy === candidate.economy &&
        option.ruleKind === candidate.ruleKind
    )
  )
  return accepted.length === 0
    ? null
    : createEncounterMovementPassageChoice({
        movement: input.movement,
        sourceActorId: input.sourceActorId,
        sourceControllerCharacterId:
          source.actor.kind === 'CHARACTER' ? (source.characterFacts?.active.id ?? null) : null,
        options: accepted
      })
}
