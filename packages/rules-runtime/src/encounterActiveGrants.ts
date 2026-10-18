import type {
  CharacterGrantFoldModifier,
  CharacterGrantFoldOutput,
  CharacterGrantFoldSource
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { speedDtoSchema, type SpeedDto } from '@artificer-toolkit/schema/shared/speed'
import { createCharacterMechanicSourceKey } from '@artificer-toolkit/shared/character'
import {
  feetInLengthUnit,
  type AttackDomainCode,
  type ValueDomainCode
} from '@artificer-toolkit/shared/core'
import { resolveD20Contributors } from '@artificer-toolkit/shared/rolls'
import {
  compareCanonicalD20Contributors,
  rollModeContributorSourceOfMechanicSource
} from '@artificer-toolkit/shared/rules'

import {
  activeFixedGrantTotal,
  activeSpeedGrantFeet,
  listActiveEffectGrants,
  record
} from './character/activeEffectGrantTotals.js'
import { normalizeCharacterGrantRestrictions } from './character/characterGrantFoldRestrictionFacts.js'
import type { EncounterRelationshipD20Contributor } from './encounterRelationshipActionFacts.js'
import { lengthInUnit, speedAfterFractions, widestLengthByKey } from './modifierLength.js'
import {
  DND5E_ABILITY_DEFINITION_ID_BY_CODE,
  DND5E_REACTION_ALLOWANCE_DEFINITION_ID
} from './systems/dnd5e/identity.js'
import { dnd5eSaveRequiresSourceSight } from './systems/dnd5e/modifierApplicability.js'

/**
 * The capabilities a holder's active grants switch off: a `REACTION_COUNT SET_VALUE 0` grant
 * (Shocking Grasp's "can't take reactions") suppresses its reaction allowance, so it is offered no
 * reaction while the grant lasts (D99).
 */
export function encounterActiveGrantCapabilitySuppressions(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
) {
  return listActiveEffectGrants(effects).flatMap(({ effectId, modifiers }) =>
    modifiers.flatMap((modifier) =>
      modifier.valueDomainCode === 'REACTION_COUNT' &&
      modifier.modifierKind === 'SET_VALUE' &&
      modifier.payload !== undefined &&
      'amount' in modifier.payload &&
      modifier.payload.amount === 0
        ? [
            {
              activeEffectId: effectId,
              contributionId: modifier.grantId,
              capabilityDefinitionIds: [DND5E_REACTION_ALLOWANCE_DEFINITION_ID]
            }
          ]
        : []
    )
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
  return listActiveEffectGrants(effects).map(({ effectId, modifiers, senses }) => {
    const mechanicSource = { kind: 'ACTIVE_EFFECT', activeEffectId: effectId } as const
    return {
      sourceId: createCharacterMechanicSourceKey(mechanicSource),
      mechanicSource,
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
  savingThrowDefinitions: readonly unknown[],
  holderActorId: string,
  effects: readonly ActiveRuleEffectRecord[]
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
  for (const { effectId, modifiers } of listActiveEffectGrants(effects)) {
    for (const modifier of modifiers) {
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
      const contributor: EncounterRelationshipD20Contributor = activeGrantContributor(
        effectId,
        holderActorId,
        modifier.grantId,
        modifier.modifierKind
      )
      if (conditionTypeId !== undefined) {
        const key = `${abilityDefinitionId}:${conditionTypeId}`
        const entry = scoped.get(key) ?? { abilityDefinitionId, conditionTypeId, contributors: [] }
        entry.contributors.push(contributor)
        scoped.set(key, entry)
      } else if (
        domain.ruleDefinitionId === undefined &&
        !hasHolderStateRestriction(modifier.restrictions) &&
        !dnd5eSaveRequiresSourceSight(modifier)
      ) {
        plain.set(abilityDefinitionId, [...(plain.get(abilityDefinitionId) ?? []), contributor])
      }
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
            row.contributors as EncounterRelationshipD20Contributor[],
            contributors
          )
        }
      ]
    })
  ]
  return plain.size === 0 ? rows : withSaveRowContributors(rows, plain)
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
    group.conditions.some((condition) => isHolderStateKind(condition.kind))
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

/** An attack-roll contributor the target's active grants give attacks of one attack domain against it. */
export type EncounterAttackAgainstContributor = {
  attackDomain: AttackDomainCode
  /** Holds only while the holder can see the attacker (D100). */
  requiresHolderSeesAttacker: boolean
  contributor: EncounterRelationshipD20Contributor
}

/**
 * The advantage and disadvantage a holder's active `ATTACKS_AGAINST` grants give attack rolls made
 * against it, for the grants whose holder-state restrictions hold now.
 */
export function encounterAttackAgainstContributors(
  holderActorId: string,
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
  holderState: EncounterHolderState
): EncounterAttackAgainstContributor[] {
  return listActiveEffectGrants(effects).flatMap(({ effectId, modifiers }) =>
    modifiers.flatMap((modifier) => {
      const { attackDomain, requiresHolderSeesAttacker } = modifier.domain
      return (modifier.modifierKind === 'ADVANTAGE' || modifier.modifierKind === 'DISADVANTAGE') &&
        modifier.valueDomainCode === 'ATTACKS_AGAINST' &&
        attackDomain !== undefined &&
        modifier.scope === 'GLOBAL' &&
        holderStateRestrictionsHold(modifier.restrictions, holderState)
        ? [
            {
              attackDomain,
              requiresHolderSeesAttacker: requiresHolderSeesAttacker === true,
              contributor: activeGrantContributor(
                effectId,
                holderActorId,
                modifier.grantId,
                modifier.modifierKind
              )
            }
          ]
        : []
    })
  )
}

/**
 * Adds a holder's active saving-throw advantage and disadvantage grants that carry holder-state
 * restrictions (Dodge's Dexterity advantage) to the saving-throw rows of their ability, while the
 * restrictions hold. The Character fold fails those grants closed, so this is their only path; a
 * Creature and a Character read the same rows.
 */
export function withHolderStateGrantSaves(
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
  return withSaveRowContributors(savingThrowDefinitions, byAbility)
}

/** The saving-throw rows with each ability's contributors merged into every row of that ability. */
function withSaveRowContributors(
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
  targetDerivedFacts: Readonly<Record<string, unknown>>,
  abilityDefinitionId: string,
  contributors: readonly EncounterRelationshipD20Contributor[]
): Readonly<Record<string, unknown>> {
  const { savingThrowDefinitions } = targetDerivedFacts
  if (!Array.isArray(savingThrowDefinitions) || contributors.length === 0) return targetDerivedFacts
  return {
    ...targetDerivedFacts,
    savingThrowDefinitions: withSaveRowContributors(
      savingThrowDefinitions,
      new Map([[abilityDefinitionId, contributors]])
    )
  }
}

/** The canonical contributors of a d20 with `added` merged in, and the roll mode they resolve to. */
export function mergedRollContributors(
  existing: readonly EncounterRelationshipD20Contributor[],
  added: readonly EncounterRelationshipD20Contributor[]
) {
  const contributors = [...existing, ...added]
    .sort(compareCanonicalD20Contributors)
    .filter(
      (contributor, index, sorted) =>
        index === 0 || compareCanonicalD20Contributors(sorted[index - 1]!, contributor) !== 0
    )
  return { contributors, rollMode: resolveD20Contributors(contributors).rollMode }
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
  }
>(protection: TProtection, effects: readonly ActiveRuleEffectRecord[]): TProtection {
  const defenses = new Map(protection.defenses.map((defense) => [defenseKey(defense), defense]))
  const conditionImmunityIds = new Set(protection.conditionImmunityIds)
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
    conditionImmunityIds: [...conditionImmunityIds]
  }
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
        (grantAbility === null || grantAbility === attackAbility) &&
        modifier.scope === 'GLOBAL'
        ? [activeGrantContributor(effectId, holderActorId, modifier.grantId, modifier.modifierKind)]
        : []
    })
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
