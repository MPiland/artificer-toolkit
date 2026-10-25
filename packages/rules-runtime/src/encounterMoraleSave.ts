import type { MoraleSaveInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { d20CheckTotal } from '@artificer-toolkit/schema/shared/d20MinimumRoll'
import type { EncounterActorMoraleDto } from '@artificer-toolkit/schema/shared/encounterMorale'
import { ruleCheckD20EvidenceDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'

import { mergedRollContributors } from './encounterActiveGrants.js'
import { encounterActorCannotAct } from './encounterBasicActions.js'
import { withEncounterConditionMechanics } from './encounterConditionMechanics.js'
import { freezeD20Context, settleEncounterD20Answer } from './encounterD20Settlement.js'
import { EncounterValidationError } from './encounterErrors.js'
import { heldConditionIds } from './encounterInnateConditions.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import type { MoraleSaveProposal } from './optionalCombatPolicyCapability.js'
import { savingThrowCapabilityRegistry } from './platformPolicyModules.js'
import type { CurrentReusableDefinitionSource } from './ruleCapabilityStateService.js'

/** A creature's own saving throws: the rows no rule or condition scopes, conditions applied. */
function plainSaveRows(gameSystemId: string, target: MovementTarget) {
  return savingThrowCapabilityRegistry
    .require(gameSystemId)
    .holderSaves(target)
    .filter((row) => row.ruleDefinitionId === undefined && row.conditionTypeId === undefined)
}

/**
 * Each creature that may roll a morale save, with its conditions applied: whether it can act and
 * its saving-throw modifier by ability, as the Morale policy reads them.
 */
export async function encounterMoraleRollers(input: {
  gameSystemId: string
  targets: readonly MovementTarget[]
  definitions: CurrentReusableDefinitionSource
}) {
  return new Map(
    await Promise.all(
      input.targets.map(async (loaded) => {
        const target = await withEncounterConditionMechanics({
          target: loaded,
          gameSystemId: input.gameSystemId,
          definitions: input.definitions
        })
        const canAct = !(await encounterActorCannotAct({
          conditionIds: heldConditionIds(target),
          activeEffects: target.activeEffects,
          gameSystemId: input.gameSystemId,
          definitions: input.definitions
        }))
        const saveModifiers = new Map(
          plainSaveRows(input.gameSystemId, target).map(
            (row) => [row.abilityDefinitionId, row.modifier] as const
          )
        )
        return [target.actor.id, { target, canAct, saveModifiers }] as const
      })
    )
  )
}

/**
 * Rolls the roller's saving throw for a sealed morale proposal through the one d20 settlement: its
 * own save row with the proposal's contributors merged in, against the authored DC.
 */
export function rollEncounterMoraleSave(input: {
  gameSystemId: string
  roller: MovementTarget
  proposal: MoraleSaveProposal
  roll: MoraleSaveInputDto['roll']
  requestId: string
  nextInt: (size: number) => number
}): NonNullable<EncounterActorMoraleDto['save']> {
  const { gameSystemId, proposal, requestId } = input
  const row = plainSaveRows(gameSystemId, input.roller).find(
    (candidate) => candidate.abilityDefinitionId === proposal.abilityDefinitionId
  )
  if (!row || !Number.isSafeInteger(row.modifier))
    throw new EncounterValidationError('The morale roller has no saving throw for the check.')
  const { contributors, rollMode } = mergedRollContributors(
    gameSystemId,
    row.contributors,
    proposal.contributors
  )
  const d20 = freezeD20Context({
    gameSystemId,
    rollMode,
    contributors,
    modifier: row.modifier,
    addedDice: savingThrowCapabilityRegistry
      .require(gameSystemId)
      .addedDice(input.roller.targetDerivedFacts.savingThrowAddedDice, proposal.abilityDefinitionId)
  })
  const settled = settleEncounterD20Answer({
    gameSystemId,
    d20,
    answer:
      input.roll.kind === 'AUTO_ROLL'
        ? { kind: 'AUTO_ROLL', requestId }
        : { ...input.roll, requestId },
    rollD20: () => input.nextInt(20) + 1,
    random: input.nextInt
  })
  const { addedDice } = settled
  return ruleCheckD20EvidenceDtoSchema.parse({
    requestId,
    rollMode: settled.rollMode,
    keep: settled.keep,
    derivedRollMode: d20.rollMode,
    rawFaces: settled.rawFaces,
    selectedNatural: settled.natural,
    modifier: d20.modifier,
    total: d20CheckTotal({ selectedNatural: settled.natural, modifier: d20.modifier, addedDice }),
    contributors: d20.contributors,
    contributorChecksum: d20.contributorChecksum,
    ...(addedDice.length > 0 && { addedDice }),
    dc: proposal.difficultyClass
  })
}
