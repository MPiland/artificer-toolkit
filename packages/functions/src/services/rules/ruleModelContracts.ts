import { z } from 'zod'

import {
  ENCOUNTER_ACTOR_MODEL_KEY,
  encounterActorRuleInputSchema,
  encounterActorRuleOutputSchema
} from '@artificer-toolkit/schema/api/encounterActorRules'
import { ruleEvaluationDtoSchema } from '@artificer-toolkit/schema/api/rules'
import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema
} from '@artificer-toolkit/schema/api/characterRules'
import {
  CHARACTER_GRANT_FOLD_MODEL_KEY,
  characterGrantFoldInputSchema,
  characterGrantFoldOutputSchema
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import {
  CHARACTER_ACTION_MODEL_KEY,
  characterActionModelInputSchema,
  characterActionModelOutputSchema
} from '@artificer-toolkit/schema/api/characterActionRules'

const encounterResolveFactsSchema = z
  .object({
    encounter: z.object({
      id: z.string(),
      status: z.string(),
      round: z.number(),
      currentActorId: z.string().nullable()
    }),
    action: z.object({
      actorId: z.string(),
      targetActorIds: z.array(z.string()),
      choices: z.json()
    }),
    actor: z
      .object({
        id: z.string(),
        kind: z.string(),
        label: z.string(),
        systemId: z.string().nullable()
      })
      .passthrough(),
    targets: z.array(
      z
        .object({
          id: z.string(),
          kind: z.string(),
          label: z.string(),
          systemId: z.string().nullable()
        })
        .passthrough()
    ),
    rolls: z.array(z.json())
  })
  .passthrough()

export const RULE_EVALUATOR_KIND = 'ZEN'
export const RULE_EVALUATOR_VERSION = '0.54.0'
export const CHARACTER_ACTION_SPELL_STATE_CONTRACT_VERSION = 5
export const RULE_MODEL_CONTRACT_VERSION = 5

export interface RuleModelContract {
  version: number
  input: z.ZodType<unknown>
  output: z.ZodType<unknown>
  usesRuleRollProtocol?: true
}

const encounterResolveContract = (version: number): RuleModelContract => ({
  version,
  input: encounterResolveFactsSchema,
  output: ruleEvaluationDtoSchema,
  usesRuleRollProtocol: true
})

const completeRuleModelContracts = (
  version: number
): Readonly<Record<string, RuleModelContract | undefined>> => ({
  [ENCOUNTER_ACTOR_MODEL_KEY]: {
    version,
    input: encounterActorRuleInputSchema,
    output: encounterActorRuleOutputSchema
  },
  [CHARACTER_ACTION_MODEL_KEY]: {
    version,
    input: characterActionModelInputSchema,
    output: characterActionModelOutputSchema
  },
  [CHARACTER_GRANT_FOLD_MODEL_KEY]: {
    version,
    input: characterGrantFoldInputSchema,
    output: characterGrantFoldOutputSchema
  },
  'character-policy': {
    version,
    input: characterRulePolicyInputSchema,
    output: characterRulePolicyOutputSchema
  },
  'encounter-resolve': encounterResolveContract(version)
})

const ruleModelContractsByVersion: Readonly<
  Record<number, Readonly<Record<string, RuleModelContract | undefined>> | undefined>
> = {
  1: {
    'encounter-resolve': encounterResolveContract(1)
  },
  4: completeRuleModelContracts(4),
  [RULE_MODEL_CONTRACT_VERSION]: completeRuleModelContracts(RULE_MODEL_CONTRACT_VERSION)
}

export function getRuleModelContract(
  modelKey: string,
  version = RULE_MODEL_CONTRACT_VERSION
): RuleModelContract | undefined {
  return ruleModelContractsByVersion[version]?.[modelKey]
}
