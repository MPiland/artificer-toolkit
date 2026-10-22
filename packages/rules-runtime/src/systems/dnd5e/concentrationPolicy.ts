import { z } from 'zod'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import {
  rollModeContributorSourceDtoSchema,
  type ReceiptD20ContributorDto
} from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import {
  compareCanonicalD20Contributors,
  RULE_GRAPH_LIMITS,
  RULE_VALUE_KIND,
  type GameSystemRuleCapabilityContract,
  type PureRuleOperationContract,
  type RuleGraphDefinition,
  type RuleValue
} from '@artificer-toolkit/shared/rules'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { RULE_RUNTIME_GRAPH_FAMILY_KEY } from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import type { MaintenanceLinkCapabilityAdapter } from '../../maintenanceLinkCapability.js'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from './concentrationIdentity.js'
import type { D20AddedDieDto } from '@artificer-toolkit/schema/shared/d20AddedDice'
import { derivedAddedDice, dnd5eAddedDiceFacts, dnd5eAddedDiceNode } from './d20AddedDiceGraph.js'
import type { RollModeKeep } from '@artificer-toolkit/schema/shared/systemCoreCode'
import { DND5E_KEEP_BY_ROLL_MODE } from './rollModePolicy.js'
import { DND5E_SAVE_TEST_OPERATION_KEY } from './dnd5eTestOperationKeys.js'

const DND5E_CONCENTRATION_CHECK_DEFINITION_ID = '00000000-0000-4000-8000-0000000000c2'
const DND5E_CONCENTRATION_DAMAGE_DC_OPERATION_KEY = 'dnd5e.concentration-damage-dc'
/** UUID identity from the D&D System vocabulary snapshot, not an ability code. */
export const DND5E_CONSTITUTION_ABILITY_DEFINITION_ID = '00000000-0000-0000-0011-000300000000'
export const DND5E_CONCENTRATION_TARGET_ACTOR_FACT_KEY = 'dnd5e.concentration-target-actor-id'
export const DND5E_CONCENTRATION_APPLIED_DAMAGE_FACT_KEY = 'dnd5e.concentration-applied-damage'
export const DND5E_CONCENTRATION_SAVE_MODIFIER_FACT_KEY = 'dnd5e.concentration-save-modifier'
export const DND5E_CONCENTRATION_CONTRIBUTOR_CHECKSUM_FACT_KEY =
  'dnd5e.concentration-contributor-checksum'

/** Rejects noncanonical or altered contributor evidence before it enters a child receipt. */
function validateDnd5eConcentrationContributors(
  contributors: readonly ReceiptD20ContributorDto[],
  contributorChecksum: string
): void {
  if (contributors.length > RULE_GRAPH_LIMITS.NODES)
    throw new Error('D&D concentration saving-throw contributors exceed the rules-runtime limit.')
  let prior: ReceiptD20ContributorDto | null = null
  for (const contributor of contributors) {
    if (prior !== null && compareCanonicalD20Contributors(prior, contributor) >= 0)
      throw new Error('D&D concentration saving-throw contributors are not canonical.')
    prior = contributor
  }
  if (checksumRuleDocument(contributors) !== contributorChecksum)
    throw new Error('D&D concentration saving-throw contributor evidence is invalid.')
}

function positiveSafeInteger(value: RuleValue | undefined, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${label} must be a positive safe integer.`)
  return value
}

/** D&D 2014 concentration damage-check DC: max(10, floor(applied damage / 2)). */
export function dnd5eConcentrationDamageDc(appliedDamage: number) {
  return Math.max(10, Math.floor(positiveSafeInteger(appliedDamage, 'Applied damage') / 2))
}

export const dnd5eConcentrationDamageDcOperation: PureRuleOperationContract = {
  key: DND5E_CONCENTRATION_DAMAGE_DC_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PURE',
  inputs: { appliedDamage: RULE_VALUE_KIND.NUMBER },
  outputs: { dc: RULE_VALUE_KIND.NUMBER },
  execute(inputs) {
    return {
      dc: dnd5eConcentrationDamageDc(positiveSafeInteger(inputs.appliedDamage, 'Applied damage'))
    }
  }
}

/**
 * Contribution merged into the one D&D System capability registration. The
 * runtime deliberately permits one complete capability contract per System.
 */
export const dnd5eConcentrationCapabilityContribution = {
  definitionFamilyKeys: [RULE_RUNTIME_GRAPH_FAMILY_KEY],
  factContracts: [
    { key: DND5E_CONCENTRATION_TARGET_ACTOR_FACT_KEY, valueKind: RULE_VALUE_KIND.TEXT },
    { key: DND5E_CONCENTRATION_APPLIED_DAMAGE_FACT_KEY, valueKind: RULE_VALUE_KIND.NUMBER },
    { key: DND5E_CONCENTRATION_SAVE_MODIFIER_FACT_KEY, valueKind: RULE_VALUE_KIND.NUMBER },
    {
      key: DND5E_CONCENTRATION_CONTRIBUTOR_CHECKSUM_FACT_KEY,
      valueKind: RULE_VALUE_KIND.TEXT
    }
  ],
  operationContracts: [{ key: DND5E_CONCENTRATION_DAMAGE_DC_OPERATION_KEY, contractVersion: 1 }]
} as const satisfies Pick<
  GameSystemRuleCapabilityContract,
  'definitionFamilyKeys' | 'factContracts' | 'operationContracts'
>

const creatureSaveRowsSchema = z.array(
  z.looseObject({
    abilityDefinitionId: z.string(),
    ruleDefinitionId: z.optional(z.string()),
    conditionTypeId: z.optional(z.string()),
    modifier: z.number(),
    rollMode: z.string(),
    contributors: z.array(
      z.looseObject({
        sourceId: z.string(),
        grantId: z.nullable(z.string()),
        domainKey: z.nullable(z.string()),
        influence: z.string(),
        source: rollModeContributorSourceDtoSchema
      })
    )
  })
)

/**
 * The saving throws a Concentration holder rolls from: a Character's effective policy output, else
 * a Creature's or custom actor's derived save rows, which already carry its condition contributors (D94).
 */
export function dnd5eConcentrationHolderSaves(target: {
  effectiveRulePolicyOutput: {
    savingThrowDefinitions?: readonly z.infer<typeof creatureSaveRowsSchema>[number][]
  } | null
  targetDerivedFacts: Readonly<Record<string, unknown>>
}) {
  return (
    target.effectiveRulePolicyOutput ?? {
      savingThrowDefinitions: creatureSaveRowsSchema.parse(
        target.targetDerivedFacts.savingThrowDefinitions
      )
    }
  )
}

/**
 * Derives the D&D-specific saving-throw facts consumed by the portable
 * concentration graph. The D&D policy binding supplies the exact ability
 * identity; no default modifier, contributor set, code, or display label is
 * permitted here.
 */
export function resolveDnd5eConcentrationSaveFacts(input: {
  appliedDamage: number
  targetActorId: string
  rulePolicyOutput: {
    savingThrowDefinitions?: readonly {
      abilityDefinitionId: string
      ruleDefinitionId?: string
      conditionTypeId?: string
      modifier: number
      rollMode: string
      contributors: readonly ReceiptD20ContributorDto[]
    }[]
  }
  /** The dice the holder rolls with the save (D156). */
  addedDice: readonly D20AddedDieDto[]
}): {
  facts: Record<string, string | number | boolean>
  rollMode: string
  keep: RollModeKeep
  modifier: number
  contributors: ReadonlyArray<ReceiptD20ContributorDto>
  contributorChecksum: string
} {
  const appliedDamage = positiveSafeInteger(input.appliedDamage, 'Applied damage')
  const constitutionSaves = (input.rulePolicyOutput.savingThrowDefinitions ?? []).filter(
    (candidate) => candidate.abilityDefinitionId === DND5E_CONSTITUTION_ABILITY_DEFINITION_ID
  )
  const scopedSaves = constitutionSaves.filter(
    (candidate) => candidate.ruleDefinitionId === DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
  )
  const savingThrow =
    scopedSaves.length > 0
      ? scopedSaves
      : constitutionSaves.filter(
          (candidate) =>
            candidate.ruleDefinitionId === undefined && candidate.conditionTypeId === undefined
        )
  if (savingThrow.length !== 1 || !Number.isSafeInteger(savingThrow[0]!.modifier))
    throw new Error('D&D concentration saving throw is unavailable.')
  const rollMode = savingThrow[0]!.rollMode
  if (rollMode !== 'NORMAL' && rollMode !== 'ADVANTAGE' && rollMode !== 'DISADVANTAGE')
    throw new Error('D&D concentration saving-throw roll mode is unavailable.')
  const contributors = savingThrow[0]!.contributors
  if (!Array.isArray(contributors))
    throw new Error('D&D concentration saving-throw contributors are unavailable.')
  const normalizedContributors = contributors
    .map(({ sourceId, grantId, domainKey, influence, source }) => ({
      sourceId,
      grantId,
      domainKey,
      influence,
      source
    }))
    .sort(compareCanonicalD20Contributors)
  const contributorChecksum = checksumRuleDocument(normalizedContributors)
  validateDnd5eConcentrationContributors(normalizedContributors, contributorChecksum)
  return {
    facts: {
      [DND5E_CONCENTRATION_TARGET_ACTOR_FACT_KEY]: input.targetActorId,
      [DND5E_CONCENTRATION_APPLIED_DAMAGE_FACT_KEY]: appliedDamage,
      [DND5E_CONCENTRATION_SAVE_MODIFIER_FACT_KEY]: savingThrow[0]!.modifier,
      [DND5E_CONCENTRATION_CONTRIBUTOR_CHECKSUM_FACT_KEY]: contributorChecksum,
      ...dnd5eAddedDiceFacts(input.addedDice)
    },
    rollMode,
    keep: DND5E_KEEP_BY_ROLL_MODE[rollMode],
    modifier: savingThrow[0]!.modifier,
    contributors: normalizedContributors,
    contributorChecksum
  }
}

/**
 * Creates the canonical reusable D&D concentration-check definition. Later
 * baseline seeding owns publication; this factory has no persistence effect.
 */
export function createDnd5eConcentrationCheckDefinition() {
  const definition: RuleGraphDefinition = {
    schemaVersion: 1,
    id: DND5E_CONCENTRATION_CHECK_DEFINITION_ID,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
    vocabularyBindings: [
      { kind: 'ABILITY', definitionId: DND5E_CONSTITUTION_ABILITY_DEFINITION_ID }
    ],
    nodes: [
      {
        id: 'damage_dc',
        operation: { key: DND5E_CONCENTRATION_DAMAGE_DC_OPERATION_KEY, contractVersion: 1 },
        inputs: {
          appliedDamage: {
            kind: 'FACT',
            factKey: DND5E_CONCENTRATION_APPLIED_DAMAGE_FACT_KEY
          }
        }
      },
      {
        id: 'd20',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: {
          min: { kind: 'LITERAL', value: 1 },
          max: { kind: 'LITERAL', value: 20 }
        }
      },
      dnd5eAddedDiceNode('d20'),
      {
        id: 'save',
        operation: { key: DND5E_SAVE_TEST_OPERATION_KEY, contractVersion: 3 },
        inputs: {
          targetActorId: {
            kind: 'FACT',
            factKey: DND5E_CONCENTRATION_TARGET_ACTOR_FACT_KEY
          },
          naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
          addedTotal: { kind: 'NODE_OUTPUT', nodeId: 'd20-added-dice', port: 'value' },
          modifier: {
            kind: 'FACT',
            factKey: DND5E_CONCENTRATION_SAVE_MODIFIER_FACT_KEY
          },
          threshold: { kind: 'NODE_OUTPUT', nodeId: 'damage_dc', port: 'dc' },
          contributorChecksum: {
            kind: 'FACT',
            factKey: DND5E_CONCENTRATION_CONTRIBUTOR_CHECKSUM_FACT_KEY
          },
          // Condition outcome rules don't reach concentration saves yet (D94).
          outcomeRule: { kind: 'LITERAL', value: 'NONE' }
        }
      }
    ],
    outputs: {
      targetActorId: { kind: 'NODE_OUTPUT', nodeId: 'save', port: 'targetActorId' },
      appliedDamage: {
        kind: 'FACT',
        factKey: DND5E_CONCENTRATION_APPLIED_DAMAGE_FACT_KEY
      },
      dc: { kind: 'NODE_OUTPUT', nodeId: 'damage_dc', port: 'dc' },
      naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'save', port: 'naturalD20' },
      total: { kind: 'NODE_OUTPUT', nodeId: 'save', port: 'total' },
      resultPath: { kind: 'NODE_OUTPUT', nodeId: 'save', port: 'resultPath' },
      contributorChecksum: {
        kind: 'NODE_OUTPUT',
        nodeId: 'save',
        port: 'contributorChecksum'
      }
    }
  }
  return serverPublishedRuleDefinitionDtoSchema.parse({
    id: definition.id,
    gameSystemId: definition.gameSystemId,
    definitionFamilyKey: definition.definitionFamilyKey,
    checksum: checksumRuleDocument(definition),
    definition
  })
}

/** 5e Concentration: breaks when defeated, incapacitated or casting-locked; any damage owes a Constitution save. */
export const dnd5eMaintenanceLinkCapabilityAdapter: MaintenanceLinkCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  maintenanceDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
  hooks: [
    { hook: 'BREAK', reason: 'DEFEATED', subscription: { event: 'DEFEATED' } },
    {
      hook: 'BREAK',
      reason: 'INCAPACITATED',
      subscription: { event: 'INCAPACITATED', of: 'HOLDER' }
    },
    { hook: 'BREAK', reason: 'SPELLCASTING_LOCKED', subscription: { event: 'MAINTENANCE_BARRED' } },
    { hook: 'SAVE', subscription: { event: 'DAMAGED', by: 'ANYONE', damageTypeIds: null } }
  ],
  saveAbilityDefinitionId: DND5E_CONSTITUTION_ABILITY_DEFINITION_ID,
  saveDc: dnd5eConcentrationDamageDc,
  saveFacts(input) {
    const addedDice = derivedAddedDice(
      input.target.targetDerivedFacts.savingThrowAddedDice,
      DND5E_CONSTITUTION_ABILITY_DEFINITION_ID
    )
    return {
      addedDice,
      ...resolveDnd5eConcentrationSaveFacts({
        appliedDamage: input.appliedDamage,
        targetActorId: input.targetActorId,
        rulePolicyOutput: dnd5eConcentrationHolderSaves(input.target),
        addedDice
      })
    }
  }
}
