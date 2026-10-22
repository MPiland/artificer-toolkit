import { readInitiativeSourceRoll } from '../../encounterInitiativeRoll.js'
import type { InitiativeFactAdapter } from '../../initiativeFactAdapter.js'
import type { InitiativeDeclarationFactsDto } from '@artificer-toolkit/schema/shared/initiativeState'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import {
  checksumRuleDocument,
  RULE_VALUE_KIND,
  type GameSystemRuleCapabilityContract,
  type RuleGraphDefinition
} from '@artificer-toolkit/shared/rules'

import {
  INITIATIVE_POLICY_DEFINITION_FAMILY_KEY,
  RULE_RUNTIME_GRAPH_FAMILY_KEY
} from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { dnd5eRollModeCapabilityAdapter } from './rollModePolicy.js'

const DND5E_SPEED_FACTOR_INITIATIVE_GRAPH_DEFINITION_ID = '00000000-0000-4000-8000-0000000000eb'

export const DND5E_INITIATIVE_FACT_KEYS = {
  automatic: 'initiative.automatic',
  modifier: 'initiative.modifier',
  rollMode: 'initiative.roll-mode',
  extraD20: 'initiative.extra-d20',
  keep: 'initiative.keep',
  speedFactorModifier: 'initiative.speed-factor.modifier',
  orderChoiceMinimumIndex: 'initiative.choice-min-index',
  orderChoiceMaximumIndex: 'initiative.choice-max-index'
} as const

/**
 * D&D's System-owned capability contribution for published initiative policy
 * graphs. Roll mode is bound at execution time and is available to published
 * D&D initiative graphs that consume it.
 */
export const dnd5eInitiativeCapabilityContribution = {
  definitionFamilyKeys: [RULE_RUNTIME_GRAPH_FAMILY_KEY, INITIATIVE_POLICY_DEFINITION_FAMILY_KEY],
  factContracts: [
    { key: DND5E_INITIATIVE_FACT_KEYS.automatic, valueKind: RULE_VALUE_KIND.BOOLEAN },
    { key: DND5E_INITIATIVE_FACT_KEYS.modifier, valueKind: RULE_VALUE_KIND.NUMBER },
    { key: DND5E_INITIATIVE_FACT_KEYS.rollMode, valueKind: RULE_VALUE_KIND.TEXT },
    { key: DND5E_INITIATIVE_FACT_KEYS.extraD20, valueKind: RULE_VALUE_KIND.BOOLEAN },
    { key: DND5E_INITIATIVE_FACT_KEYS.keep, valueKind: RULE_VALUE_KIND.TEXT },
    {
      key: DND5E_INITIATIVE_FACT_KEYS.speedFactorModifier,
      valueKind: RULE_VALUE_KIND.NUMBER
    },
    {
      key: DND5E_INITIATIVE_FACT_KEYS.orderChoiceMinimumIndex,
      valueKind: RULE_VALUE_KIND.NUMBER
    },
    {
      key: DND5E_INITIATIVE_FACT_KEYS.orderChoiceMaximumIndex,
      valueKind: RULE_VALUE_KIND.NUMBER
    }
  ],
  operationContracts: [
    { key: 'evidence.integer-range', contractVersion: 1 },
    { key: 'evidence.optional-integer-range', contractVersion: 1 },
    { key: 'number.keep-one-of-two', contractVersion: 1 },
    { key: 'number.add', contractVersion: 1 }
  ]
} as const satisfies Pick<
  GameSystemRuleCapabilityContract,
  'definitionFamilyKeys' | 'factContracts' | 'operationContracts'
>

const sizeModifiers: Readonly<Record<string, number>> = {
  TINY: 5,
  SMALL: 2,
  MEDIUM: 0,
  LARGE: -2,
  HUGE: -5,
  GARGANTUAN: -8
}

function declaredActionFactor(
  source: InitiativeDeclarationFactsDto['primary'],
  applied: Set<string>
): number | null {
  if (source.kind === 'CHARACTER_SPELL_CAST') {
    const key = 'SPELL_LEVEL'
    if (applied.has(key)) return 0
    applied.add(key)
    return -source.castLevel
  }
  if (source.kind === 'CREATURE_FEATURE_ACTION') return 0
  const properties = new Set(
    source.kind === 'GM_ADJUDICATED'
      ? source.actionFactors.flatMap((factor) => {
          switch (factor) {
            case 'MELEE_HEAVY':
              return ['MELEE', 'HEAVY']
            case 'MELEE_LIGHT_OR_FINESSE':
              return ['MELEE', 'LIGHT']
            case 'MELEE_TWO_HANDED':
              return ['MELEE', 'TWO_HANDED']
            case 'RANGED_LOADING':
              return ['RANGED', 'LOADING']
          }
        })
      : source.equipmentProperties
  )
  const melee = properties.has('MELEE')
  const ranged = properties.has('RANGED')
  const hasWeaponFactor =
    properties.has('HEAVY') ||
    properties.has('LIGHT') ||
    properties.has('FINESSE') ||
    properties.has('TWO_HANDED') ||
    properties.has('LOADING')
  if (hasWeaponFactor && !melee && !ranged) return null
  let result = 0
  if (melee && properties.has('HEAVY') && !applied.has('MELEE_HEAVY')) {
    applied.add('MELEE_HEAVY')
    result -= 2
  }
  if (
    melee &&
    (properties.has('LIGHT') || properties.has('FINESSE')) &&
    !applied.has('MELEE_LIGHT_OR_FINESSE')
  ) {
    applied.add('MELEE_LIGHT_OR_FINESSE')
    result += 2
  }
  if (melee && properties.has('TWO_HANDED') && !applied.has('MELEE_TWO_HANDED')) {
    applied.add('MELEE_TWO_HANDED')
    result -= 2
  }
  if (ranged && properties.has('LOADING') && !applied.has('RANGED_LOADING')) {
    applied.add('RANGED_LOADING')
    result -= 5
  }
  if (
    source.kind === 'GM_ADJUDICATED' &&
    source.spellLevel !== null &&
    !applied.has('SPELL_LEVEL')
  ) {
    applied.add('SPELL_LEVEL')
    result -= source.spellLevel
  }
  return result
}

function speedFactorModifier(declaration: InitiativeDeclarationFactsDto): number | null {
  const size = sizeModifiers[declaration.actorSize]
  if (size === undefined) return null
  const actions = [declaration.primary, declaration.bonus].filter(
    (source): source is InitiativeDeclarationFactsDto['primary'] => source !== null
  )
  const spellLevels = actions
    .filter(
      (
        source
      ): source is Extract<
        InitiativeDeclarationFactsDto['primary'],
        { kind: 'CHARACTER_SPELL_CAST' }
      > => source.kind === 'CHARACTER_SPELL_CAST'
    )
    .map((source) => source.castLevel)
  const adjudicatedSpellLevels = actions
    .filter(
      (
        source
      ): source is Extract<InitiativeDeclarationFactsDto['primary'], { kind: 'GM_ADJUDICATED' }> =>
        source.kind === 'GM_ADJUDICATED' && source.spellLevel !== null
    )
    .map((source) => source.spellLevel!)
  const applied = new Set<string>()
  let modifier = size
  for (const source of actions.filter((source) => source.kind !== 'CHARACTER_SPELL_CAST')) {
    const factor = declaredActionFactor(source, applied)
    if (factor === null) return null
    modifier += factor
  }
  const maximumSpellLevel = Math.max(...spellLevels, ...adjudicatedSpellLevels)
  if (Number.isFinite(maximumSpellLevel) && !applied.has('SPELL_LEVEL'))
    modifier -= maximumSpellLevel
  return modifier
}

function creatureSize(
  source: Extract<Parameters<InitiativeFactAdapter['bindDeclaredActor']>[0], { kind: 'CREATURE' }>
): string | null {
  const snapshot = source.actor.snapshot
  if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) return null
  const payload = (snapshot as Record<string, unknown>).payload
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null
  const size = (payload as Record<string, unknown>).size
  return typeof size === 'string' && sizeModifiers[size] !== undefined ? size : null
}

function declarationMatchesSource(
  source: Parameters<InitiativeFactAdapter['bindDeclaredActor']>[0],
  declaration: InitiativeDeclarationFactsDto
): boolean {
  const selections = [declaration.primary, declaration.bonus].filter(
    (selection): selection is InitiativeDeclarationFactsDto['primary'] => selection !== null
  )
  if (source.kind === 'CHARACTER') {
    return (
      selections.every(
        (selection) =>
          selection.kind === 'CHARACTER_ACTION' || selection.kind === 'CHARACTER_SPELL_CAST'
      ) && source.mechanics.initiativeActorFacts.effectiveSize === declaration.actorSize
    )
  }
  if (source.kind === 'CREATURE') {
    return (
      selections.every(
        (selection) =>
          selection.kind === 'CREATURE_FEATURE_ACTION' &&
          selection.actorId === source.actor.id &&
          selection.creatureSourceId === source.actor.sourceId &&
          selection.sourceRevision === source.actor.sourceRevision
      ) && creatureSize(source) === declaration.actorSize
    )
  }
  return selections.every(
    (selection) => selection.kind === 'GM_ADJUDICATED' && selection.actorId === source.actor.id
  )
}

function published(definition: RuleGraphDefinition) {
  return serverPublishedRuleDefinitionDtoSchema.parse({
    id: definition.id,
    gameSystemId: definition.gameSystemId,
    definitionFamilyKey: definition.definitionFamilyKey,
    checksum: checksumRuleDocument(definition),
    definition
  })
}

/**
 * The graph is deliberately generic: the adapter supplies only locked,
 * normalized declaration facts, while the System-owned graph owns the score
 * composition and exact published pin used by the initiative policy.
 */
export function createDnd5eSpeedFactorInitiativeDefinition() {
  return published({
    schemaVersion: 1,
    id: DND5E_SPEED_FACTOR_INITIATIVE_GRAPH_DEFINITION_ID,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
    nodes: [
      {
        id: 'd20',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: {
          min: { kind: 'LITERAL', value: 1 },
          max: { kind: 'LITERAL', value: 20 }
        }
      },
      {
        id: 'd20-extra',
        operation: { key: 'evidence.optional-integer-range', contractVersion: 1 },
        inputs: {
          min: { kind: 'LITERAL', value: 1 },
          max: { kind: 'LITERAL', value: 20 },
          enabled: { kind: 'FACT', factKey: DND5E_INITIATIVE_FACT_KEYS.extraD20 }
        }
      },
      {
        id: 'd20-kept',
        operation: { key: 'number.keep-one-of-two', contractVersion: 1 },
        inputs: {
          first: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
          second: { kind: 'NODE_OUTPUT', nodeId: 'd20-extra', port: 'value' },
          keep: { kind: 'FACT', factKey: DND5E_INITIATIVE_FACT_KEYS.keep }
        }
      },
      {
        id: 'declared-modifier',
        operation: { key: 'number.add', contractVersion: 1 },
        inputs: {
          left: { kind: 'FACT', factKey: DND5E_INITIATIVE_FACT_KEYS.modifier },
          right: { kind: 'FACT', factKey: DND5E_INITIATIVE_FACT_KEYS.speedFactorModifier }
        }
      },
      {
        id: 'score',
        operation: { key: 'number.add', contractVersion: 1 },
        inputs: {
          left: { kind: 'NODE_OUTPUT', nodeId: 'd20-kept', port: 'value' },
          right: { kind: 'NODE_OUTPUT', nodeId: 'declared-modifier', port: 'value' }
        }
      }
    ],
    outputs: {
      automatic: { kind: 'LITERAL', value: true },
      score: { kind: 'NODE_OUTPUT', nodeId: 'score', port: 'value' }
    }
  })
}

/**
 * The facts the declared initiative graph rolls its d20s by: a second d20 and the face kept. The
 * settled evidence records only these, so a reader recovers the roll mode from the kept face.
 */
export function dnd5eDeclaredInitiativeRollFacts(rollMode: string) {
  return {
    [DND5E_INITIATIVE_FACT_KEYS.extraD20]: rollMode !== 'NORMAL',
    [DND5E_INITIATIVE_FACT_KEYS.keep]: dnd5eRollModeCapabilityAdapter.keepFor(rollMode)
  }
}

export const dnd5eInitiativeFactAdapter: InitiativeFactAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  bindActor(source) {
    if (source.kind === 'CUSTOM') return { automatic: false }
    const { modifier, rollMode } = readInitiativeSourceRoll(source)
    return {
      automatic: true,
      facts: {
        [DND5E_INITIATIVE_FACT_KEYS.automatic]: true,
        [DND5E_INITIATIVE_FACT_KEYS.modifier]: modifier,
        [DND5E_INITIATIVE_FACT_KEYS.rollMode]: rollMode
      }
    }
  },
  bindDeclaredActor(source, declaration) {
    if (!declarationMatchesSource(source, declaration)) return { automatic: false }
    const modifier = speedFactorModifier(declaration)
    if (modifier === null) return { automatic: false }
    const { modifier: baseModifier, rollMode } = readInitiativeSourceRoll(source)
    return {
      automatic: true,
      facts: {
        [DND5E_INITIATIVE_FACT_KEYS.automatic]: true,
        [DND5E_INITIATIVE_FACT_KEYS.modifier]: baseModifier,
        ...dnd5eDeclaredInitiativeRollFacts(rollMode),
        [DND5E_INITIATIVE_FACT_KEYS.speedFactorModifier]: modifier
      }
    }
  },
  bindSide(_source) {
    return {
      automatic: true,
      facts: {
        [DND5E_INITIATIVE_FACT_KEYS.automatic]: true,
        [DND5E_INITIATIVE_FACT_KEYS.modifier]: 0,
        [DND5E_INITIATIVE_FACT_KEYS.rollMode]: 'NORMAL'
      }
    }
  }
}
