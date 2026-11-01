import { readInitiativeSourceRoll } from '../../encounterInitiativeRoll.js'
import type { InitiativeFactAdapter } from '../../initiativeFactAdapter.js'
import { abilityModifier } from './abilityModifier.js'
import { snapshotAbilityScore, summonSnapshotAbilityScore } from '../../encounterActorState.js'
import type { InitiativeActorFactSource } from '@artificer-toolkit/schema/shared/initiativeFactSources'
import type { InitiativeDeclarationFactsDto } from '@artificer-toolkit/schema/shared/initiativeState'
import {
  RULE_VALUE_KIND,
  type GameSystemRuleCapabilityContract
} from '@artificer-toolkit/shared/rules'

import {
  INITIATIVE_POLICY_DEFINITION_FAMILY_KEY,
  RULE_RUNTIME_GRAPH_FAMILY_KEY
} from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { dnd5eRollModeCapabilityAdapter } from './rollModePolicy.js'
import { DND5E_ROLL_MODES } from './coreCodes.js'

export const DND5E_INITIATIVE_FACT_KEYS = {
  automatic: 'initiative.automatic',
  modifier: 'initiative.modifier',
  rollMode: 'initiative.roll-mode',
  extraD20: 'initiative.extra-d20',
  keep: 'initiative.keep',
  speedFactorModifier: 'initiative.speed-factor.modifier',
  dexterityScore: 'initiative.dexterity-score',
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
    { key: DND5E_INITIATIVE_FACT_KEYS.dexterityScore, valueKind: RULE_VALUE_KIND.NUMBER },
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

function creatureSize(
  source: Extract<Parameters<InitiativeFactAdapter['bindDeclaredActor']>[0], { kind: 'CREATURE' }>
): string | null {
  const snapshot = source.actor.snapshot
  if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) return null
  const payload = (snapshot as Record<string, unknown>).payload
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null
  const size = (payload as Record<string, unknown>).size
  return typeof size === 'string' ? size : null
}

/** The Dexterity score a tie rule may compare; null when the actor's facts carry none. */
function dexterityScore(source: InitiativeActorFactSource): number | null {
  switch (source.kind) {
    case 'CHARACTER':
      return (
        (
          source.effectiveRulePolicyOutput ?? source.overlay.rulePolicyOutput
        ).derivedStats.abilities.find((entry) => entry.abilityId === 'DEXTERITY')?.score
          .effective ?? null
      )
    case 'CREATURE':
      return snapshotAbilityScore(
        { kind: 'CREATURE', snapshot: source.actor.snapshot },
        'DEXTERITY'
      )
    case 'CUSTOM':
      return summonSnapshotAbilityScore(source.actor.snapshot, 'DEXTERITY')
  }
}

function dexterityFacts(source: InitiativeActorFactSource) {
  const score = dexterityScore(source)
  const facts: Record<string, number> = {}
  if (score !== null) facts[DND5E_INITIATIVE_FACT_KEYS.dexterityScore] = score
  return facts
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
  declaredRollMode(facts) {
    const keep = facts[DND5E_INITIATIVE_FACT_KEYS.keep]
    return (
      DND5E_ROLL_MODES.find(({ code }) => dnd5eRollModeCapabilityAdapter.keepFor(code) === keep)
        ?.code ?? null
    )
  },
  bindActor(source) {
    // A GM-made custom actor rolls by hand; a summon's stat block gives its Dexterity modifier.
    if (source.kind === 'CUSTOM' && !source.actor.owner) return { automatic: false }
    const roll = readInitiativeSourceRoll(source)
    const dexterity = source.kind === 'CUSTOM' ? dexterityScore(source) : null
    const modifier = dexterity === null ? roll.modifier : abilityModifier(dexterity)
    const { rollMode } = roll
    return {
      automatic: true,
      facts: {
        [DND5E_INITIATIVE_FACT_KEYS.automatic]: true,
        [DND5E_INITIATIVE_FACT_KEYS.modifier]: modifier,
        [DND5E_INITIATIVE_FACT_KEYS.rollMode]: rollMode,
        ...dexterityFacts(source)
      }
    }
  },
  bindDeclaredActor(source, declaration, declaredModifier) {
    if (!declarationMatchesSource(source, declaration)) return { automatic: false }
    const { modifier: baseModifier, rollMode } = readInitiativeSourceRoll(source)
    return {
      automatic: true,
      facts: {
        [DND5E_INITIATIVE_FACT_KEYS.automatic]: true,
        [DND5E_INITIATIVE_FACT_KEYS.modifier]: baseModifier,
        ...dnd5eDeclaredInitiativeRollFacts(rollMode),
        [DND5E_INITIATIVE_FACT_KEYS.speedFactorModifier]: declaredModifier,
        ...dexterityFacts(source)
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
