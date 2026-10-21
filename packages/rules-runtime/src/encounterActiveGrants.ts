import { v5 as uuidv5 } from 'uuid'
import { innateConditionIds } from './encounterInnateConditions.js'
import type {
  CharacterGrantFoldModifier,
  CharacterGrantFoldOutput,
  CharacterGrantFoldSource
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { D20AddedDieDto } from '@artificer-toolkit/schema/shared/d20AddedDice'
import { attackDomainCodeSchema } from '@artificer-toolkit/schema/shared/enums'
import { speedDtoSchema, type SpeedDto } from '@artificer-toolkit/schema/shared/speed'
import { createCharacterMechanicSourceKey } from '@artificer-toolkit/shared/character'
import {
  feetInLengthUnit,
  type AttackDomainCode,
  type AttackOccasionCode,
  type ValueDomainCode
} from '@artificer-toolkit/shared/core'
import {
  compareCanonicalD20Contributors,
  rollModeContributorSourceOfMechanicSource
} from '@artificer-toolkit/shared/rules'

import {
  activeAttackRollDice,
  activeFixedGrantTotal,
  activeSavingThrowDice,
  activeSpeedGrantFeet,
  listActiveEffectGrants,
  record
} from './character/activeEffectGrantTotals.js'
import { normalizeCharacterGrantRestrictions } from './character/characterGrantFoldRestrictionFacts.js'
import { effectEventScope, type EffectEventScope } from './events/encounterEventHooks.js'
import type { EncounterRelationshipD20Contributor } from './encounterRelationshipActionFacts.js'
import { lengthInUnit, speedAfterFractions, widestLengthByKey } from './modifierLength.js'
import {
  abilityScoreCapabilityRegistry,
  rollModeCapabilityRegistry
} from './platformPolicyModules.js'
import {
  DND5E_ABILITY_DEFINITION_ID_BY_CODE,
  DND5E_ACTION_ALLOWANCE_DEFINITION_ID,
  DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
  DND5E_REACTION_ALLOWANCE_DEFINITION_ID
} from './systems/dnd5e/identity.js'
import { dnd5eSaveRequiresSourceSight } from './systems/dnd5e/modifierApplicability.js'

// Namespaces the per-instance identity of an active grant's suppression contribution.
const grantSuppressionNamespace = '5b0c4e0a-7a52-4d2b-9a0e-3c1f6d8b2e47'

const allowanceByCountDomain: Partial<Record<ValueDomainCode, string>> = {
  ACTION_COUNT: DND5E_ACTION_ALLOWANCE_DEFINITION_ID,
  BONUS_ACTION_COUNT: DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
  REACTION_COUNT: DND5E_REACTION_ALLOWANCE_DEFINITION_ID
}

/**
 * The capabilities a holder's active grants switch off: an `ACTION_COUNT`, `BONUS_ACTION_COUNT` or
 * `REACTION_COUNT` `SET_VALUE 0` grant (Shocking Grasp's "can't take reactions", Haste's lethargy)
 * suppresses that allowance, so the holder is offered none of that kind while the grant lasts (D99).
 * A suppression is keyed by the grant instance, the active effect and its authored grant, because
 * several effects of one authored grant (or a grant id that is no UUID) would otherwise collide in
 * the availability resolver.
 */
export function encounterActiveGrantCapabilitySuppressions(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
) {
  return listActiveEffectGrants(effects).flatMap(({ effectId, modifiers }) =>
    modifiers.flatMap((modifier) => {
      const allowanceId = allowanceByCountDomain[modifier.valueDomainCode]
      return allowanceId !== undefined &&
        modifier.modifierKind === 'SET_VALUE' &&
        modifier.payload !== undefined &&
        'amount' in modifier.payload &&
        modifier.payload.amount === 0
        ? [
            {
              activeEffectId: effectId,
              contributionId: uuidv5(`${effectId}:${modifier.grantId}`, grantSuppressionNamespace),
              capabilityDefinitionIds: [allowanceId]
            }
          ]
        : []
    })
  )
}

/** The d20 contributor an active effect's advantage or disadvantage grant adds for its holder. */
function activeGrantContributor(
  effectId: string,
  holderActorId: string,
  grantId: string,
  influence: EncounterRelationshipD20Contributor['influence']
): EncounterRelationshipD20Contributor {
  return {
    sourceId: createCharacterMechanicSourceKey({ kind: 'ACTIVE_EFFECT', activeEffectId: effectId }),
    grantId,
    domainKey: `active-grant:${holderActorId}`,
    influence,
    source: { kind: 'ACTIVE_EFFECT', id: effectId, holderActorId }
  }
}

/** The Character grant fold's `ACTIVE_EFFECT` sources for the holder's grants. */
function encounterActiveGrantFoldSources(
  effects: readonly ActiveRuleEffectRecord[]
): CharacterGrantFoldSource[] {
  return listActiveEffectGrants(effects).map(({ effectId, modifiers, senses, boundItem }) => {
    const mechanicSource = { kind: 'ACTIVE_EFFECT', activeEffectId: effectId } as const
    return {
      sourceId: createCharacterMechanicSourceKey(mechanicSource),
      mechanicSource,
      ...(boundItem && { boundSourceId: createCharacterMechanicSourceKey(boundItem) }),
      sourceState: null,
      restrictions: normalizeCharacterGrantRestrictions(undefined),
      proficiencies: [],
      senses: [...senses],
      modifiers: [...modifiers],
      feats: [],
      spells: []
    }
  })
}

/**
 * The Character's policy facts with the holder's Active Effect grants folded as sources; the same
 * facts object when the holder carries none.
 */
export function withCharacterActiveGrants(
  facts: CharacterRulePolicyInput,
  effects: readonly ActiveRuleEffectRecord[]
): CharacterRulePolicyInput {
  const activeEffects = encounterActiveGrantFoldSources(effects)
  return activeEffects.length
    ? { ...facts, grantFoldFacts: { ...facts.grantFoldFacts, activeEffects } }
    : facts
}

/**
 * Folds a Creature holder's active saving-throw advantage and disadvantage grants into its save
 * rows. A grant scoped to a condition (Antitoxin against poison) adds a condition-scoped row beside
 * the base ones, so a save against that condition reads it. A grant scoped to no condition or rule
 * (Weakening Breath's Strength saves) joins every row of its ability. A Character folds the same
 * grants through its own policy instead.
 */
export function withCreatureActiveGrantSaves(
  gameSystemId: string,
  savingThrowDefinitions: readonly unknown[],
  holderActorId: string,
  effects: readonly ActiveRuleEffectRecord[],
  featureModifiers: CharacterGrantFoldOutput['modifiers']
): unknown[] {
  const scoped = new Map<
    string,
    {
      abilityDefinitionId: string
      conditionTypeId: string
      contributors: EncounterRelationshipD20Contributor[]
    }
  >()
  const plain = new Map<string, EncounterRelationshipD20Contributor[]>()
  const grants = [
    ...listActiveEffectGrants(effects).flatMap(({ effectId, modifiers }) =>
      modifiers.map((modifier) => ({
        modifier,
        restrictions: modifier.restrictions,
        contributor: (influence: EncounterRelationshipD20Contributor['influence']) =>
          activeGrantContributor(effectId, holderActorId, modifier.grantId, influence)
      }))
    ),
    ...featureModifiers.map((modifier) => ({
      modifier,
      restrictions: modifier.deferredRequirements,
      contributor: (influence: EncounterRelationshipD20Contributor['influence']) => ({
        sourceId: modifier.sourceId,
        grantId: modifier.grantId,
        domainKey: modifier.domainKey,
        influence,
        source: rollModeContributorSourceOfMechanicSource(modifier.source, holderActorId)
      })
    }))
  ]
  for (const { modifier, restrictions, contributor: contributorOf } of grants) {
    const { domain } = modifier
    const abilityDefinitionId = DND5E_ABILITY_DEFINITION_ID_BY_CODE[String(domain.ability)]
    const { conditionTypeId } = domain
    if (
      (modifier.modifierKind !== 'ADVANTAGE' && modifier.modifierKind !== 'DISADVANTAGE') ||
      modifier.valueDomainCode !== 'SAVING_THROW_MODIFIER' ||
      abilityDefinitionId === undefined ||
      modifier.scope !== 'GLOBAL'
    )
      continue
    const contributor = contributorOf(modifier.modifierKind)
    if (conditionTypeId !== undefined) {
      const key = `${abilityDefinitionId}:${conditionTypeId}`
      const entry = scoped.get(key) ?? { abilityDefinitionId, conditionTypeId, contributors: [] }
      entry.contributors.push(contributor)
      scoped.set(key, entry)
    } else if (
      domain.ruleDefinitionId === undefined &&
      !hasHolderStateRestriction(restrictions) &&
      !dnd5eSaveRequiresSourceSight(modifier)
    ) {
      plain.set(abilityDefinitionId, [...(plain.get(abilityDefinitionId) ?? []), contributor])
    }
  }
  const rows = [
    ...savingThrowDefinitions,
    ...[...scoped.values()].flatMap(({ abilityDefinitionId, conditionTypeId, contributors }) => {
      const base = savingThrowDefinitions.find((definition) => {
        const row = record(definition)
        return (
          row?.abilityDefinitionId === abilityDefinitionId &&
          row.conditionTypeId === undefined &&
          row.ruleDefinitionId === undefined
        )
      })
      const row = record(base)
      if (!row || typeof row.modifier !== 'number' || !Array.isArray(row.contributors)) return []
      return [
        {
          abilityDefinitionId,
          conditionTypeId,
          modifier: row.modifier,
          ...mergedRollContributors(
            gameSystemId,
            row.contributors as EncounterRelationshipD20Contributor[],
            contributors
          )
        }
      ]
    })
  ]
  return plain.size === 0 ? rows : withSaveRowContributors(gameSystemId, rows, plain)
}

const CREATURE_DEFENSE_KIND_BY_DOMAIN: Readonly<
  Record<string, 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY'>
> = {
  DAMAGE_RESISTANCE: 'RESISTANCE',
  DAMAGE_IMMUNITY: 'IMMUNITY',
  DAMAGE_VULNERABILITY: 'VULNERABILITY'
}

/**
 * What a holder is and can do now, read by the holder-state restrictions `CAN_ACT`,
 * `SPEED_ABOVE_ZERO`, `FREE_HAND` (a hand slot empty and not holding a creature, D107) and the
 * holder restrictions `HOLDER_KIND` and `CREATURE_TYPE` (D152).
 */
export type EncounterHolderState = {
  kind: 'CHARACTER' | 'CREATURE' | 'CUSTOM'
  /** A Creature holder's type; empty for any other holder. */
  creatureTypeIds: readonly string[]
  canAct: boolean
  speedAboveZero: boolean
  freeHand: boolean
  /**
   * The feet the holder has moved this turn and its speed in feet (its fastest after conditions),
   * which `TURN_MOVEMENT` weighs; both 0 off its turn.
   */
  turnMovement: { usedFeet: number; speedFeet: number }
  /**
   * When no hand is free, the held weapon a Character can stow for free to free one (its off hand
   * first, never a shield, D152); null otherwise.
   */
  stowableHeldItemInstanceId: string | null
}

type ModifierRestrictions = CharacterGrantFoldModifier['restrictions']

const HOLDER_STATE_FLAG = {
  CAN_ACT: 'canAct',
  SPEED_ABOVE_ZERO: 'speedAboveZero',
  FREE_HAND: 'freeHand'
} as const satisfies Record<string, keyof EncounterHolderState>

function isHolderStateKind(kind: string): kind is keyof typeof HOLDER_STATE_FLAG {
  return Object.hasOwn(HOLDER_STATE_FLAG, kind)
}

/** Whether the holder meets a condition, or `undefined` when it cannot be decided here. */
function holderConditionMatches(
  condition: ModifierRestrictions[number]['conditions'][number],
  holderState: EncounterHolderState
): boolean | undefined {
  switch (condition.kind) {
    case 'HOLDER_KIND':
      return condition.requiredIds.includes(holderState.kind)
    case 'CREATURE_TYPE':
      return (
        condition.mode === 'ALL' ||
        condition.requiredIds.some((id) => holderState.creatureTypeIds.includes(id))
      )
    case 'TURN_MOVEMENT': {
      const { usedFeet, speedFeet } = holderState.turnMovement
      return (
        (condition.max === null || usedFeet <= condition.max) &&
        (condition.speedFraction === null || usedFeet <= speedFeet * condition.speedFraction)
      )
    }
    default:
      return isHolderStateKind(condition.kind)
        ? holderState[HOLDER_STATE_FLAG[condition.kind]]
        : undefined
  }
}

/**
 * Whether a modifier's holder restrictions hold: some group has only holder conditions and every
 * one is met. Any other condition cannot be decided here and fails closed, so the group does not
 * hold.
 */
export function holderStateRestrictionsHold(
  restrictions: ModifierRestrictions,
  holderState: EncounterHolderState
): boolean {
  return (
    restrictions.length === 0 ||
    restrictions.some((group) =>
      group.conditions.every((condition) => {
        const matches = holderConditionMatches(condition, holderState)
        return matches !== undefined && matches === (condition.constraint === 'INCLUDE')
      })
    )
  )
}

function hasHolderStateRestriction(restrictions: ModifierRestrictions): boolean {
  return restrictions.some((group) =>
    group.conditions.some(
      (condition) => isHolderStateKind(condition.kind) || condition.kind === 'TURN_MOVEMENT'
    )
  )
}

/** Whether the holder carries an `ATTACKS_AGAINST` grant or a holder-state-restricted one. */
export function hasEncounterDefensiveGrants(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
): boolean {
  return listActiveEffectGrants(effects).some(({ modifiers }) =>
    modifiers.some(
      (modifier) =>
        modifier.valueDomainCode === 'ATTACKS_AGAINST' ||
        hasHolderStateRestriction(modifier.restrictions)
    )
  )
}

/**
 * Whether an active grant switches on a flag domain (`ENABLE`): Disengage's
 * `OPPORTUNITY_ATTACK_IMMUNITY` makes the holder's movement provoke no opportunity attacks, and
 * `SPELLCASTING_LOCK` bars the holder from casting spells and holding Concentration, and
 * `ACTION_BONUS_ACTION_EXCLUSIVITY` lets it take an Action or a Bonus Action on a turn, not both.
 */
export function encounterGrantsEnabledDomain(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
  domain: Extract<
    ValueDomainCode,
    'OPPORTUNITY_ATTACK_IMMUNITY' | 'SPELLCASTING_LOCK' | 'ACTION_BONUS_ACTION_EXCLUSIVITY'
  >
): boolean {
  return listActiveEffectGrants(effects).some(({ modifiers }) =>
    modifiers.some(
      (modifier) => modifier.valueDomainCode === domain && modifier.modifierKind === 'ENABLE'
    )
  )
}

/** An `ATTACKS_AGAINST` grant the target holds, for attacks of one attack domain against it. */
export type EncounterAttackAgainstContributor = {
  attackDomain: AttackDomainCode
  /** Holds only while the holder can see the attacker (D100). */
  requiresHolderSeesAttacker: boolean
  /** System Senses through which an attacker that sees the holder is unaffected. */
  exemptAttackerSenseDefinitionIds: readonly string[]
  /** Holds only for attacks made on this occasion (an opportunity attack); absent for every attack. */
  attackOccasion?: AttackOccasionCode
  /** The attackers, and the turn, the grant's effect admits; a feature's grant admits every one. */
  eventScope: EffectEventScope
  /** The advantage or disadvantage the grant gives, or null when it negates advantage (Elusive). */
  contributor: EncounterRelationshipD20Contributor | null
}

type AttacksAgainstModifier = Pick<
  CharacterGrantFoldModifier,
  'valueDomainCode' | 'modifierKind' | 'domain'
>

/** The grant's part of an attacks-against entry, or null when it is no `ATTACKS_AGAINST` grant. */
function attacksAgainstEntry(
  modifier: AttacksAgainstModifier,
  contributor: (
    influence: EncounterRelationshipD20Contributor['influence']
  ) => EncounterRelationshipD20Contributor
): Omit<EncounterAttackAgainstContributor, 'eventScope'> | null {
  const { attackDomain, requiresHolderSeesAttacker, exemptAttackerSenseDefinitionIds } =
    modifier.domain
  const { modifierKind } = modifier
  if (
    modifier.valueDomainCode !== 'ATTACKS_AGAINST' ||
    attackDomain === undefined ||
    (modifierKind !== 'ADVANTAGE' &&
      modifierKind !== 'DISADVANTAGE' &&
      modifierKind !== 'NEGATE_ADVANTAGE')
  )
    return null
  return {
    attackDomain,
    requiresHolderSeesAttacker: requiresHolderSeesAttacker === true,
    exemptAttackerSenseDefinitionIds: exemptAttackerSenseDefinitionIds ?? [],
    ...(modifier.domain.attackOccasion && { attackOccasion: modifier.domain.attackOccasion }),
    contributor: modifierKind === 'NEGATE_ADVANTAGE' ? null : contributor(modifierKind)
  }
}

/** A Character feature's grants admit every attacker, on every turn. */
const EVERY_EVENT: EffectEventScope = { actorId: null, turnActorId: null }

/**
 * The `ATTACKS_AGAINST` grants a holder's active effects and, for a Character, its own features
 * (Elusive) apply to attack rolls made against it, for the grants whose holder-state restrictions
 * hold now. The Character fold also carries its active effects' grants; those are read from the
 * effects, which scope them to their attackers and turns.
 */
export function encounterAttackAgainstContributors(input: {
  holderActorId: string
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition' | 'lifecycle'>[]
  grantFold: Pick<CharacterGrantFoldOutput, 'modifiers' | 'modifierGroups'> | null
  holderState: EncounterHolderState
}): EncounterAttackAgainstContributor[] {
  const { holderActorId, effects, grantFold, holderState } = input
  const fromFeatures = (grantFold?.modifierGroups ?? []).flatMap(({ contributions }) =>
    contributions.flatMap(({ acceptedModifierIndex, grantId }) => {
      const modifier = grantFold!.modifiers[acceptedModifierIndex]!
      const entry =
        modifier.source.kind === 'ACTIVE_EFFECT' ||
        !holderStateRestrictionsHold(modifier.deferredRequirements, holderState)
          ? null
          : attacksAgainstEntry(modifier, (influence) => ({
              sourceId: modifier.sourceId,
              grantId,
              domainKey: modifier.domainKey,
              influence,
              source: rollModeContributorSourceOfMechanicSource(modifier.source, holderActorId)
            }))
      return entry ? [{ ...entry, eventScope: EVERY_EVENT }] : []
    })
  )
  const fromEffects = listActiveEffectGrants(effects).flatMap(({ effectId, modifiers }) => {
    const effect = effects.find(({ id }) => id === effectId)
    const eventScope = effect ? effectEventScope(effect, holderActorId) : null
    if (eventScope === null) return []
    return modifiers.flatMap((modifier) => {
      const entry =
        modifier.scope !== 'GLOBAL' ||
        !holderStateRestrictionsHold(modifier.restrictions, holderState)
          ? null
          : attacksAgainstEntry(modifier, (influence) =>
              activeGrantContributor(effectId, holderActorId, modifier.grantId, influence)
            )
      return entry ? [{ ...entry, eventScope }] : []
    })
  })
  return [...fromFeatures, ...fromEffects]
}

/** A Character feature's skill-check advantage or disadvantage that holds only by holder state. */
function featureHolderStateSkillGrants(
  grantFold: Pick<CharacterGrantFoldOutput, 'modifiers' | 'modifierGroups'> | null
) {
  return (grantFold?.modifierGroups ?? []).flatMap(({ contributions }) =>
    contributions.flatMap(({ acceptedModifierIndex, grantId }) => {
      const modifier = grantFold!.modifiers[acceptedModifierIndex]!
      return modifier.valueDomainCode === 'SKILL_MODIFIER' &&
        (modifier.modifierKind === 'ADVANTAGE' || modifier.modifierKind === 'DISADVANTAGE') &&
        modifier.scope === 'GLOBAL' &&
        modifier.source.kind !== 'ACTIVE_EFFECT' &&
        hasHolderStateRestriction(modifier.deferredRequirements)
        ? [{ modifier, grantId, influence: modifier.modifierKind }]
        : []
    })
  )
}

/** Whether a Character's own features carry a skill-check grant its holder state decides (Supreme Sneak). */
export function hasFeatureHolderStateSkillGrants(
  grantFold: Pick<CharacterGrantFoldOutput, 'modifiers' | 'modifierGroups'> | null
): boolean {
  return featureHolderStateSkillGrants(grantFold).length > 0
}

/**
 * The advantage and disadvantage contributors a Character's features give a skill check while
 * their holder-state restrictions hold now (Supreme Sneak's half-speed movement). The Character
 * fold fails those grants closed, so this is their only path. `skillAliases` are the ids the
 * check's skill is granted under.
 */
export function encounterFeatureSkillCheckContributors(input: {
  holderActorId: string
  grantFold: Pick<CharacterGrantFoldOutput, 'modifiers' | 'modifierGroups'> | null
  holderState: EncounterHolderState
  skillAliases: readonly string[]
}): EncounterRelationshipD20Contributor[] {
  return featureHolderStateSkillGrants(input.grantFold).flatMap(
    ({ modifier, grantId, influence }) =>
      input.skillAliases.includes(String(modifier.domain.skillId)) &&
      holderStateRestrictionsHold(modifier.deferredRequirements, input.holderState)
        ? [
            {
              sourceId: modifier.sourceId,
              grantId,
              domainKey: modifier.domainKey,
              influence,
              source: rollModeContributorSourceOfMechanicSource(
                modifier.source,
                input.holderActorId
              )
            }
          ]
        : []
  )
}

/** Whether a Character's own features carry an `ATTACKS_AGAINST` grant. */
export function hasFeatureAttacksAgainstGrants(
  grantFold: Pick<CharacterGrantFoldOutput, 'modifiers'> | null
): boolean {
  return (grantFold?.modifiers ?? []).some(
    (modifier) =>
      modifier.valueDomainCode === 'ATTACKS_AGAINST' && modifier.source.kind !== 'ACTIVE_EFFECT'
  )
}

/**
 * Adds a holder's active saving-throw advantage and disadvantage grants that carry holder-state
 * restrictions (Dodge's Dexterity advantage) to the saving-throw rows of their ability, while the
 * restrictions hold. The Character fold fails those grants closed, so this is their only path; a
 * Creature and a Character read the same rows.
 */
export function withHolderStateGrantSaves(
  gameSystemId: string,
  savingThrowDefinitions: readonly unknown[],
  holderActorId: string,
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
  holderState: EncounterHolderState
): unknown[] {
  const byAbility = new Map<string, EncounterRelationshipD20Contributor[]>()
  for (const { effectId, modifiers } of listActiveEffectGrants(effects)) {
    for (const modifier of modifiers) {
      const abilityDefinitionId =
        DND5E_ABILITY_DEFINITION_ID_BY_CODE[String(modifier.domain.ability)]
      if (
        (modifier.modifierKind !== 'ADVANTAGE' && modifier.modifierKind !== 'DISADVANTAGE') ||
        modifier.valueDomainCode !== 'SAVING_THROW_MODIFIER' ||
        abilityDefinitionId === undefined ||
        modifier.scope !== 'GLOBAL' ||
        dnd5eSaveRequiresSourceSight(modifier) ||
        !hasHolderStateRestriction(modifier.restrictions) ||
        !holderStateRestrictionsHold(modifier.restrictions, holderState)
      )
        continue
      byAbility.set(abilityDefinitionId, [
        ...(byAbility.get(abilityDefinitionId) ?? []),
        activeGrantContributor(effectId, holderActorId, modifier.grantId, modifier.modifierKind)
      ])
    }
  }
  return withSaveRowContributors(gameSystemId, savingThrowDefinitions, byAbility)
}

/** The saving-throw rows with each ability's contributors merged into every row of that ability. */
function withSaveRowContributors(
  gameSystemId: string,
  savingThrowDefinitions: readonly unknown[],
  byAbility: ReadonlyMap<string, readonly EncounterRelationshipD20Contributor[]>
): unknown[] {
  return savingThrowDefinitions.map((definition) => {
    const row = record(definition)
    const added = byAbility.get(String(row?.abilityDefinitionId))
    return row && added && Array.isArray(row.contributors)
      ? {
          ...row,
          ...mergedRollContributors(
            gameSystemId,
            row.contributors as EncounterRelationshipD20Contributor[],
            added
          )
        }
      : definition
  })
}

/**
 * A saving-throw advantage or disadvantage that holds only while the saver sees the effect's
 * source (Danger Sense, D100). Preparation decides it per save from the Scene's sight.
 */
export type EncounterSourceSightSave = {
  abilityDefinitionId: string
  contributor: EncounterRelationshipD20Contributor
}

/**
 * The holder's source-sight saving-throw grants with their holder-state restrictions, which the
 * caller checks against the holder's state. A Character reads them from its folded grants (which
 * already carry its Active Effects); a Creature from its Active Effects.
 */
export function encounterSourceSightSaveGrants(input: {
  holderActorId: string
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
  grantFold: Pick<CharacterGrantFoldOutput, 'modifiers' | 'modifierGroups'> | null
}): (EncounterSourceSightSave & { restrictions: ModifierRestrictions })[] {
  const { grantFold } = input
  if (grantFold)
    return grantFold.modifierGroups.flatMap(({ contributions }) =>
      contributions.flatMap(({ acceptedModifierIndex, grantId }) => {
        const modifier = grantFold.modifiers[acceptedModifierIndex]!
        const abilityDefinitionId =
          DND5E_ABILITY_DEFINITION_ID_BY_CODE[String(modifier.domain.ability)]
        return (modifier.modifierKind === 'ADVANTAGE' ||
          modifier.modifierKind === 'DISADVANTAGE') &&
          dnd5eSaveRequiresSourceSight(modifier) &&
          abilityDefinitionId !== undefined
          ? [
              {
                abilityDefinitionId,
                restrictions: modifier.deferredRequirements,
                contributor: {
                  sourceId: modifier.sourceId,
                  grantId,
                  domainKey: modifier.domainKey,
                  influence: modifier.modifierKind,
                  source: rollModeContributorSourceOfMechanicSource(
                    modifier.source,
                    input.holderActorId
                  )
                }
              }
            ]
          : []
      })
    )
  return listActiveEffectGrants(input.effects).flatMap(({ effectId, modifiers }) =>
    modifiers.flatMap((modifier) => {
      const abilityDefinitionId =
        DND5E_ABILITY_DEFINITION_ID_BY_CODE[String(modifier.domain.ability)]
      return (modifier.modifierKind === 'ADVANTAGE' || modifier.modifierKind === 'DISADVANTAGE') &&
        dnd5eSaveRequiresSourceSight(modifier) &&
        modifier.scope === 'GLOBAL' &&
        abilityDefinitionId !== undefined
        ? [
            {
              abilityDefinitionId,
              restrictions: modifier.restrictions,
              contributor: activeGrantContributor(
                effectId,
                input.holderActorId,
                modifier.grantId,
                modifier.modifierKind
              )
            }
          ]
        : []
    })
  )
}

/** The target's facts with the source-sight contributors that hold now merged into its saves of one ability. */
export function withSourceSightSave(
  gameSystemId: string,
  targetDerivedFacts: Readonly<Record<string, unknown>>,
  abilityDefinitionId: string,
  contributors: readonly EncounterRelationshipD20Contributor[]
): Readonly<Record<string, unknown>> {
  const { savingThrowDefinitions } = targetDerivedFacts
  if (!Array.isArray(savingThrowDefinitions) || contributors.length === 0) return targetDerivedFacts
  return {
    ...targetDerivedFacts,
    savingThrowDefinitions: withSaveRowContributors(
      gameSystemId,
      savingThrowDefinitions,
      new Map([[abilityDefinitionId, contributors]])
    )
  }
}

/** The canonical contributors of a d20 with `added` merged in. */
export function mergedCanonicalContributors(
  existing: readonly EncounterRelationshipD20Contributor[],
  added: readonly EncounterRelationshipD20Contributor[]
): EncounterRelationshipD20Contributor[] {
  return [...existing, ...added]
    .sort(compareCanonicalD20Contributors)
    .filter(
      (contributor, index, sorted) =>
        index === 0 || compareCanonicalD20Contributors(sorted[index - 1]!, contributor) !== 0
    )
}

/** The canonical contributors of a d20 with `added` merged in, and the roll mode the System resolves them to. */
export function mergedRollContributors(
  gameSystemId: string,
  existing: readonly EncounterRelationshipD20Contributor[],
  added: readonly EncounterRelationshipD20Contributor[]
) {
  const contributors = mergedCanonicalContributors(existing, added)
  return {
    contributors,
    rollMode: rollModeCapabilityRegistry.resolveRollMode({ gameSystemId, contributors }).rollMode
  }
}

const defenseKey = (defense: {
  kind: string
  damageTypeId: string
  sourceEffectIds?: readonly string[]
}) => `${defense.kind}:${defense.damageTypeId}:${(defense.sourceEffectIds ?? []).join(',')}`

/**
 * A Creature holder's damage defenses and condition immunities with its active grants' options
 * added or removed (Protection from Energy's resistance, Heroism's immunity to Frightened); defenses
 * keep the stat block's damage-type order. A Character folds the same grants through its own policy
 * instead.
 */
export function withCreatureActiveGrantProtection<
  TProtection extends {
    defenses: readonly {
      kind: 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY'
      damageTypeId: string
      sourceEffectIds?: readonly string[]
    }[]
    conditionImmunityIds: readonly string[]
    spellSchoolImmunityIds: readonly string[]
  }
>(
  protection: TProtection,
  effects: readonly ActiveRuleEffectRecord[],
  featureModifiers: CharacterGrantFoldOutput['modifiers']
): TProtection {
  const defenses = new Map(protection.defenses.map((defense) => [defenseKey(defense), defense]))
  const conditionImmunityIds = new Set(protection.conditionImmunityIds)
  const spellSchoolImmunityIds = new Set(protection.spellSchoolImmunityIds)
  const foldSpellSchoolImmunity = (modifier: {
    modifierKind: string
    valueDomainCode: string
    payload?: object
  }) => {
    if (
      modifier.valueDomainCode !== 'SPELL_SCHOOL_IMMUNITY' ||
      !modifier.payload ||
      !('magicSchoolId' in modifier.payload) ||
      typeof modifier.payload.magicSchoolId !== 'string'
    )
      return
    if (modifier.modifierKind === 'ADD_OPTION')
      spellSchoolImmunityIds.add(modifier.payload.magicSchoolId)
    else if (modifier.modifierKind === 'REMOVE_OPTION')
      spellSchoolImmunityIds.delete(modifier.payload.magicSchoolId)
  }
  // A Creature's features grant spell school immunity through the folded feature modifiers.
  featureModifiers.forEach(foldSpellSchoolImmunity)
  for (const { modifiers } of listActiveEffectGrants(effects)) {
    for (const modifier of modifiers) {
      const { payload } = modifier
      const adding = modifier.modifierKind === 'ADD_OPTION'
      if (
        (!adding && modifier.modifierKind !== 'REMOVE_OPTION') ||
        modifier.scope !== 'GLOBAL' ||
        payload === undefined
      )
        continue
      foldSpellSchoolImmunity(modifier)
      const kind = CREATURE_DEFENSE_KIND_BY_DOMAIN[modifier.valueDomainCode]
      const option = kind
        ? 'damageTypeId' in payload
          ? payload.damageTypeId
          : undefined
        : modifier.valueDomainCode === 'CONDITION_IMMUNITY' && 'conditionTypeId' in payload
          ? payload.conditionTypeId
          : undefined
      if (option === undefined) continue
      if (kind) {
        const sourceEffectIds =
          'sourceEffectIds' in payload ? [...(payload.sourceEffectIds ?? [])].sort() : []
        const defense = {
          kind,
          damageTypeId: option,
          ...(sourceEffectIds.length > 0 && { sourceEffectIds })
        }
        if (adding) defenses.set(defenseKey(defense), defense)
        else defenses.delete(defenseKey(defense))
      } else if (adding) conditionImmunityIds.add(option)
      else conditionImmunityIds.delete(option)
    }
  }
  return {
    ...protection,
    defenses: [...defenses.values()].sort(
      (left, right) =>
        left.damageTypeId.localeCompare(right.damageTypeId) ||
        left.kind.localeCompare(right.kind) ||
        defenseKey(left).localeCompare(defenseKey(right))
    ),
    conditionImmunityIds: [...conditionImmunityIds],
    spellSchoolImmunityIds: [...spellSchoolImmunityIds]
  }
}

/** The condition types a Creature holder always has: its features' and active grants' innate conditions. */
export function creatureInnateConditionIds(
  effects: readonly ActiveRuleEffectRecord[],
  featureModifiers: CharacterGrantFoldOutput['modifiers']
): string[] {
  return innateConditionIds([
    ...featureModifiers,
    ...listActiveEffectGrants(effects).flatMap(({ modifiers }) => modifiers)
  ])
}

/**
 * The ability a Creature's attack is made with: the one its first damage adds (a stat block names
 * no other), or null when that damage adds none.
 */
export function creatureAttackAbility(outcomes: readonly unknown[]): string | null {
  const damage = outcomes.map(record).find((outcome) => outcome?.kind === 'DAMAGE')
  const bonuses = Array.isArray(damage?.bonuses) ? damage.bonuses.map(record) : []
  const ability = bonuses.find((bonus) => bonus?.bonusKind === 'ABILITY_BONUS')?.ability
  return typeof ability === 'string' ? ability : null
}

/**
 * A holder's added attack-roll dice (D156) by attack domain, for attacks made with `attackAbility`:
 * the `attackAddedDice` source fact its attack graphs read. Domains with no dice are omitted.
 */
export function encounterAttackAddedDice(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
  attackAbility: string | null
): Record<string, D20AddedDieDto[]> {
  return Object.fromEntries(
    attackDomainCodeSchema.options.flatMap((attackDomain) => {
      const dice = activeAttackRollDice(effects, attackDomain, attackAbility)
      return dice.length > 0 ? [[attackDomain, dice]] : []
    })
  )
}

/**
 * A holder's added saving-throw dice (D156) by ability definition id: the
 * `savingThrowAddedDice` target fact its save graphs read. Abilities with no dice are omitted.
 */
export function encounterSavingThrowAddedDice(
  gameSystemId: string,
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
): Record<string, D20AddedDieDto[]> {
  return Object.fromEntries(
    Object.entries(
      abilityScoreCapabilityRegistry.require(gameSystemId).abilityDefinitionIdByCode
    ).flatMap(([ability, abilityDefinitionId]) => {
      const dice = activeSavingThrowDice(effects, ability)
      return dice.length > 0 ? [[abilityDefinitionId, dice]] : []
    })
  )
}

/**
 * A Creature holder's active advantage and disadvantage grants on its own attack rolls of one
 * attack domain (Vicious Mockery's disadvantage), as roll contributors. A grant naming an ability
 * covers only attacks made with it (`attackAbility`). A Character folds the same grants through its
 * own policy instead.
 */
export function creatureActiveGrantAttackContributors(
  holderActorId: string,
  attackDomain: string,
  attackAbility: string | null,
  effects: readonly ActiveRuleEffectRecord[]
): EncounterRelationshipD20Contributor[] {
  return listActiveEffectGrants(effects).flatMap(({ effectId, modifiers }) =>
    modifiers.flatMap((modifier) => {
      const grantAbility = modifier.domain.ability ?? null
      return (modifier.modifierKind === 'ADVANTAGE' || modifier.modifierKind === 'DISADVANTAGE') &&
        modifier.valueDomainCode === 'ATTACK_ROLL' &&
        modifier.domain.attackDomain === attackDomain &&
        modifier.domain.againstEffectSource !== true &&
        (grantAbility === null || grantAbility === attackAbility) &&
        modifier.scope === 'GLOBAL'
        ? [activeGrantContributor(effectId, holderActorId, modifier.grantId, modifier.modifierKind)]
        : []
    })
  )
}

type FeatureModifiers = CharacterGrantFoldOutput['modifiers']

type DeferredGroup = FeatureModifiers[number]['deferredRequirements'][number]

function conditionsOfKind(group: DeferredGroup, kind: DeferredGroup['conditions'][number]['kind']) {
  return group.conditions.filter((condition) => condition.kind === kind)
}

/** Whether a Creature's feature grants ask how near an enemy stands to an attack's target (Pack Tactics). */
export function featureModifiersReadEnemyProximity(modifiers: FeatureModifiers): boolean {
  return modifiers.some(({ deferredRequirements }) =>
    deferredRequirements.some((group) => conditionsOfKind(group, 'ENEMY_NEAR_TARGET').length > 0)
  )
}

/** Whether a Creature's feature grants ask if an attack's target has yet to take a turn (Assassinate). */
export function featureModifiersReadTargetTurn(modifiers: FeatureModifiers): boolean {
  return modifiers.some(({ deferredRequirements }) =>
    deferredRequirements.some(
      (group) => conditionsOfKind(group, 'TARGET_HAS_NOT_TAKEN_TURN').length > 0
    )
  )
}

/**
 * Whether a deferred requirement group holds: every condition is an INCLUDE check of the Encounter
 * state this attack read, and each of those holds. Any other condition fails closed.
 */
function deferredGroupMet(
  group: DeferredGroup,
  nearestEnemyFeet: number | null,
  targetHasNotTakenTurn: boolean
): boolean {
  return (
    group.conditions.length > 0 &&
    group.conditions.every((condition) => {
      if (condition.constraint !== 'INCLUDE') return false
      if (condition.kind === 'ENEMY_NEAR_TARGET')
        return (
          nearestEnemyFeet !== null && condition.max !== null && nearestEnemyFeet <= condition.max
        )
      return condition.kind === 'TARGET_HAS_NOT_TAKEN_TURN' && targetHasNotTakenTurn
    })
  )
}

/**
 * A Creature holder's feature advantage and disadvantage grants on its own attack rolls of one
 * attack domain (Pack Tactics), as roll contributors. A grant holds when it has no deferred
 * requirement or some requirement group asks only for an enemy of the target within a distance
 * `nearestEnemyFeet` meets (Pack Tactics) or a target that has yet to take a turn (Assassinate); any
 * other deferred requirement fails closed. `nearestEnemyFeet` is null when no enemy stands near the
 * target or there is no Scene to measure on.
 */
export function creatureFeatureAttackContributors(
  holderActorId: string,
  attackDomain: string,
  attackAbility: string | null,
  modifiers: FeatureModifiers,
  nearestEnemyFeet: number | null,
  targetHasNotTakenTurn = false
): EncounterRelationshipD20Contributor[] {
  return modifiers.flatMap((modifier) => {
    const grantAbility = modifier.domain.ability ?? null
    const requirementsMet =
      modifier.deferredRequirements.length === 0 ||
      modifier.deferredRequirements.some((group) =>
        deferredGroupMet(group, nearestEnemyFeet, targetHasNotTakenTurn)
      )
    return (modifier.modifierKind === 'ADVANTAGE' || modifier.modifierKind === 'DISADVANTAGE') &&
      modifier.valueDomainCode === 'ATTACK_ROLL' &&
      modifier.scope === 'GLOBAL' &&
      modifier.source.kind !== 'ACTIVE_EFFECT' &&
      modifier.domain.attackDomain === attackDomain &&
      modifier.domain.againstEffectSource !== true &&
      (grantAbility === null || grantAbility === attackAbility) &&
      requirementsMet
      ? [
          {
            sourceId: modifier.sourceId,
            grantId: modifier.grantId,
            domainKey: modifier.domainKey,
            influence: modifier.modifierKind,
            source: rollModeContributorSourceOfMechanicSource(modifier.source, holderActorId)
          }
        ]
      : []
  })
}

/**
 * The advantage and disadvantage an attacker's active grants give only its attacks against the
 * source of the effect holding them (Bestow Curse's disadvantage against the caster), for a
 * Character and a Creature alike.
 */
export function activeEffectSourceAttackContributors(input: {
  attackerActorId: string
  targetActorId: string
  attackDomain: string
  effects: readonly ActiveRuleEffectRecord[]
}): EncounterRelationshipD20Contributor[] {
  const fromTarget = input.effects.filter(
    ({ definition }) =>
      definition.origin.kind === 'ENCOUNTER' &&
      definition.origin.sourceActorId === input.targetActorId
  )
  return listActiveEffectGrants(fromTarget).flatMap(({ effectId, modifiers }) =>
    modifiers.flatMap((modifier) =>
      (modifier.modifierKind === 'ADVANTAGE' || modifier.modifierKind === 'DISADVANTAGE') &&
      modifier.valueDomainCode === 'ATTACK_ROLL' &&
      modifier.domain.attackDomain === input.attackDomain &&
      modifier.domain.againstEffectSource === true
        ? [
            activeGrantContributor(
              effectId,
              input.attackerActorId,
              modifier.grantId,
              modifier.modifierKind
            )
          ]
        : []
    )
  )
}

/**
 * A Creature's active ability-check advantage and disadvantage grants (Help), as roll
 * contributors. A grant with no ability covers every check; one that names an ability applies
 * only when that ability is the check's `abilityCode`. A Character folds the same grants through
 * its own policy instead.
 */
export function creatureActiveGrantCheckContributors(
  holderActorId: string,
  abilityCode: string | null,
  effects: readonly ActiveRuleEffectRecord[]
): EncounterRelationshipD20Contributor[] {
  return listActiveEffectGrants(effects).flatMap(({ effectId, modifiers }) =>
    modifiers.flatMap((modifier) => {
      const grantAbility = modifier.domain.ability ?? null
      return (modifier.modifierKind === 'ADVANTAGE' || modifier.modifierKind === 'DISADVANTAGE') &&
        modifier.valueDomainCode === 'ABILITY_CHECK' &&
        (grantAbility === null || grantAbility === abilityCode) &&
        modifier.scope === 'GLOBAL'
        ? [activeGrantContributor(effectId, holderActorId, modifier.grantId, modifier.modifierKind)]
        : []
    })
  )
}

/**
 * A Creature holder's armor class with its active fixed armor-class bonuses and penalties
 * (Shimmering Shield's +2) added to its stat block value. A Character folds the same grants
 * through its own policy instead.
 */
export function withCreatureActiveGrantArmorClass(
  armorClass: number | null,
  effects: readonly ActiveRuleEffectRecord[]
): number | null {
  return armorClass === null ? null : armorClass + activeFixedGrantTotal(effects, 'ARMOR_CLASS')
}

/**
 * A Creature holder's skill total with its active fixed bonuses and penalties to that skill (Pass
 * without Trace's +10 Stealth) added to its stat block total. A Character folds the same grants
 * through its own policy instead.
 */
export function withCreatureActiveGrantSkillTotal(
  total: number | undefined,
  skillId: string,
  effects: readonly ActiveRuleEffectRecord[]
): number | undefined {
  return total === undefined
    ? undefined
    : total +
        activeFixedGrantTotal(effects, 'SKILL_MODIFIER', (domain) => domain.skillId === skillId)
}

/**
 * A holder's typed speeds with its active speed grants applied the way the Character policy folds
 * them: the best "your speed is X" grant replaces a speed's base (adding a speed the holder lacked,
 * as Fly does, in the grant's own unit), then bonuses and penalties add (Longstrider, Ray of Frost),
 * never below 0. Grant lengths convert into the speed's unit through the shared conversion; a speed
 * or grant that is not a typed length is an invariant failure.
 */
export function withActiveGrantSpeeds(
  speeds: readonly unknown[],
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
): SpeedDto[] {
  const replacements = widestLengthByKey(
    listActiveEffectGrants(effects).flatMap(({ modifiers }) =>
      modifiers.flatMap((modifier) => {
        const { speedId } = modifier.domain
        return modifier.valueDomainCode === 'SPEED' &&
          modifier.modifierKind === 'SET_VALUE' &&
          modifier.scope === 'GLOBAL' &&
          speedId !== undefined
          ? [{ key: speedId, payload: modifier.payload }]
          : []
      })
    )
  )
  const base = speeds.map((entry) => speedDtoSchema.parse(entry))
  return [
    ...base,
    ...[...replacements]
      .filter(([speedId]) => !base.some((speed) => speed.speedId === speedId))
      .map(([speedId, { amount, unit }]) => ({ speedId, amount, unit }))
  ].map((speed) => {
    const replacement = replacements.get(speed.speedId)
    const bonusFeet = activeSpeedGrantFeet(effects, (domain) => domain.speedId === speed.speedId)
    const fractions = listActiveEffectGrants(effects).flatMap(({ modifiers }) =>
      modifiers.flatMap((modifier) => {
        const { speedId } = modifier.domain
        return modifier.valueDomainCode === 'SPEED' &&
          modifier.modifierKind === 'MULTIPLY' &&
          modifier.scope === 'GLOBAL' &&
          (speedId === undefined || speedId === speed.speedId)
          ? [modifier.payload]
          : []
      })
    )
    return {
      ...speed,
      amount: speedAfterFractions(
        Math.max(
          0,
          (replacement === undefined ? speed.amount : lengthInUnit(replacement, speed.unit)) +
            (bonusFeet === 0 ? 0 : feetInLengthUnit(bonusFeet, speed.unit))
        ),
        fractions
      )
    }
  })
}
