import type {
  CharacterGrantFoldModifier,
  CharacterGrantFoldSense,
  CharacterGrantFoldSource
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { attackDomainCodeSchema } from '@artificer-toolkit/schema/shared/enums'
import { speedDtoSchema, type SpeedDto } from '@artificer-toolkit/schema/shared/speed'
import { createCharacterMechanicSourceKey } from '@artificer-toolkit/shared/character'
import type { AttackDomainCode } from '@artificer-toolkit/shared/core'
import { resolveD20Contributors } from '@artificer-toolkit/shared/rolls'
import { compareCanonicalD20Contributors } from '@artificer-toolkit/shared/rules'

import { normalizeCharacterGrantRestrictions } from './character/characterGrantFoldRestrictionFacts.js'
import {
  listHitPointMaximumReductions,
  reduceHitPointMaximum
} from './character/hitPointMaximumReductions.js'
import type { EncounterRelationshipD20Contributor } from './encounterRelationshipActionFacts.js'
import {
  DND5E_ABILITY_DEFINITION_ID_BY_CODE,
  DND5E_REACTION_ALLOWANCE_DEFINITION_ID
} from './systems/dnd5e/identity.js'

/** A grant a holder carries from an Active Effect, in the Character grant fold's modifier shape. */
export type EncounterActiveGrant = {
  effectId: string
  modifiers: readonly CharacterGrantFoldModifier[]
  senses: readonly CharacterGrantFoldSense[]
}

export function listEncounterActiveGrants(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
): EncounterActiveGrant[] {
  return effects.flatMap(({ id, definition }) =>
    definition.schemaVersion === 2
      ? definition.stateContributions.flatMap((contribution) =>
          contribution.kind === 'MODIFIER_GRANT'
            ? [{ effectId: id, modifiers: contribution.modifiers, senses: contribution.senses }]
            : []
        )
      : []
  )
}

/**
 * The capabilities a holder's active grants switch off: a `REACTION_COUNT SET_VALUE 0` grant
 * (Shocking Grasp's "can't take reactions") suppresses its reaction allowance, so it is offered no
 * reaction while the grant lasts (D99).
 */
export function encounterActiveGrantCapabilitySuppressions(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
) {
  return listEncounterActiveGrants(effects).flatMap(({ effectId, modifiers }) =>
    modifiers.flatMap((modifier) =>
      modifier.valueDomainCode === 'REACTION_COUNT' &&
      modifier.modifierKind === 'SET_VALUE' &&
      record(record(modifier.grant)?.payload)?.amount === 0
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

/** The Character grant fold's `ACTIVE_EFFECT` sources for the holder's grants. */
function encounterActiveGrantFoldSources(
  effects: readonly ActiveRuleEffectRecord[]
): CharacterGrantFoldSource[] {
  return listEncounterActiveGrants(effects).map(({ effectId, modifiers, senses }) => {
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

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/**
 * Adds a Creature holder's active saving-throw grants scoped to a condition (Antitoxin against
 * poison) as condition-scoped save rows beside its base ones, so a save against that condition
 * reads them. A Character folds the same grants through its own policy instead.
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
  for (const { effectId, modifiers } of listEncounterActiveGrants(effects)) {
    for (const modifier of modifiers) {
      const domain = record(modifier.domain)
      const abilityDefinitionId = DND5E_ABILITY_DEFINITION_ID_BY_CODE[String(domain?.ability)]
      const conditionTypeId = domain?.conditionTypeId
      if (
        (modifier.modifierKind !== 'ADVANTAGE' && modifier.modifierKind !== 'DISADVANTAGE') ||
        modifier.valueDomainCode !== 'SAVING_THROW_MODIFIER' ||
        abilityDefinitionId === undefined ||
        typeof conditionTypeId !== 'string' ||
        record(modifier.grant)?.scope !== 'GLOBAL'
      )
        continue
      const key = `${abilityDefinitionId}:${conditionTypeId}`
      const entry = scoped.get(key) ?? { abilityDefinitionId, conditionTypeId, contributors: [] }
      entry.contributors.push({
        sourceId: createCharacterMechanicSourceKey({
          kind: 'ACTIVE_EFFECT',
          activeEffectId: effectId
        }),
        grantId: modifier.grantId,
        domainKey: `active-grant:${holderActorId}`,
        influence: modifier.modifierKind
      })
      scoped.set(key, entry)
    }
  }
  return [
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
}

const CREATURE_DEFENSE_KIND_BY_DOMAIN: Readonly<
  Record<string, 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY'>
> = {
  DAMAGE_RESISTANCE: 'RESISTANCE',
  DAMAGE_IMMUNITY: 'IMMUNITY',
  DAMAGE_VULNERABILITY: 'VULNERABILITY'
}

/** What a holder can do now, read by the holder-state restrictions `CAN_ACT` and `SPEED_ABOVE_ZERO`. */
export type EncounterHolderState = { canAct: boolean; speedAboveZero: boolean }

type ModifierRestrictions = CharacterGrantFoldModifier['restrictions']

function isHolderStateKind(kind: string): boolean {
  return kind === 'CAN_ACT' || kind === 'SPEED_ABOVE_ZERO'
}

/**
 * Whether a modifier's holder-state restrictions hold: some group has only holder-state conditions
 * and every one is met. Any other condition cannot be decided here and fails closed, so the group
 * does not hold.
 */
function holderStateRestrictionsHold(
  restrictions: ModifierRestrictions,
  holderState: EncounterHolderState
): boolean {
  return (
    restrictions.length === 0 ||
    restrictions.some((group) =>
      group.conditions.every(
        (condition) =>
          isHolderStateKind(condition.kind) &&
          (condition.kind === 'CAN_ACT' ? holderState.canAct : holderState.speedAboveZero) ===
            (condition.constraint === 'INCLUDE')
      )
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
  return listEncounterActiveGrants(effects).some(({ modifiers }) =>
    modifiers.some(
      (modifier) =>
        modifier.valueDomainCode === 'ATTACKS_AGAINST' ||
        hasHolderStateRestriction(modifier.restrictions)
    )
  )
}

/** Whether an active grant (Disengage) makes the holder's movement provoke no opportunity attacks. */
export function encounterGrantsOpportunityAttackImmunity(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
): boolean {
  return listEncounterActiveGrants(effects).some(({ modifiers }) =>
    modifiers.some(
      (modifier) =>
        modifier.valueDomainCode === 'OPPORTUNITY_ATTACK_IMMUNITY' &&
        modifier.modifierKind === 'ENABLE'
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
  return listEncounterActiveGrants(effects).flatMap(({ effectId, modifiers }) =>
    modifiers.flatMap((modifier) => {
      const domain = attackDomainCodeSchema.safeParse(record(modifier.domain)?.attackDomain)
      return (modifier.modifierKind === 'ADVANTAGE' || modifier.modifierKind === 'DISADVANTAGE') &&
        modifier.valueDomainCode === 'ATTACKS_AGAINST' &&
        domain.success &&
        record(modifier.grant)?.scope === 'GLOBAL' &&
        holderStateRestrictionsHold(modifier.restrictions, holderState)
        ? [
            {
              attackDomain: domain.data,
              requiresHolderSeesAttacker:
                record(modifier.domain)?.requiresHolderSeesAttacker === true,
              contributor: {
                sourceId: createCharacterMechanicSourceKey({
                  kind: 'ACTIVE_EFFECT',
                  activeEffectId: effectId
                }),
                grantId: modifier.grantId,
                domainKey: `active-grant:${holderActorId}`,
                influence: modifier.modifierKind
              }
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
  for (const { effectId, modifiers } of listEncounterActiveGrants(effects)) {
    for (const modifier of modifiers) {
      const abilityDefinitionId =
        DND5E_ABILITY_DEFINITION_ID_BY_CODE[String(record(modifier.domain)?.ability)]
      if (
        (modifier.modifierKind !== 'ADVANTAGE' && modifier.modifierKind !== 'DISADVANTAGE') ||
        modifier.valueDomainCode !== 'SAVING_THROW_MODIFIER' ||
        abilityDefinitionId === undefined ||
        record(modifier.grant)?.scope !== 'GLOBAL' ||
        !hasHolderStateRestriction(modifier.restrictions) ||
        !holderStateRestrictionsHold(modifier.restrictions, holderState)
      )
        continue
      byAbility.set(abilityDefinitionId, [
        ...(byAbility.get(abilityDefinitionId) ?? []),
        {
          sourceId: createCharacterMechanicSourceKey({
            kind: 'ACTIVE_EFFECT',
            activeEffectId: effectId
          }),
          grantId: modifier.grantId,
          domainKey: `active-grant:${holderActorId}`,
          influence: modifier.modifierKind
        }
      ])
    }
  }
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
    }[]
    conditionImmunityIds: readonly string[]
  }
>(protection: TProtection, effects: readonly ActiveRuleEffectRecord[]): TProtection {
  const defenses = new Map(
    protection.defenses.map((defense) => [`${defense.kind}:${defense.damageTypeId}`, defense])
  )
  const conditionImmunityIds = new Set(protection.conditionImmunityIds)
  for (const { modifiers } of listEncounterActiveGrants(effects)) {
    for (const modifier of modifiers) {
      const grant = record(modifier.grant)
      const adding = modifier.modifierKind === 'ADD_OPTION'
      if ((!adding && modifier.modifierKind !== 'REMOVE_OPTION') || grant?.scope !== 'GLOBAL')
        continue
      const payload = record(grant.payload)
      const kind = CREATURE_DEFENSE_KIND_BY_DOMAIN[modifier.valueDomainCode]
      const option = kind ? payload?.damageTypeId : payload?.conditionTypeId
      if (
        typeof option !== 'string' ||
        (!kind && modifier.valueDomainCode !== 'CONDITION_IMMUNITY')
      )
        continue
      if (kind) {
        if (adding) defenses.set(`${kind}:${option}`, { kind, damageTypeId: option })
        else defenses.delete(`${kind}:${option}`)
      } else if (adding) conditionImmunityIds.add(option)
      else conditionImmunityIds.delete(option)
    }
  }
  return {
    ...protection,
    defenses: [...defenses.values()].sort((left, right) =>
      left.damageTypeId === right.damageTypeId
        ? left.kind.localeCompare(right.kind)
        : left.damageTypeId.localeCompare(right.damageTypeId)
    ),
    conditionImmunityIds: [...conditionImmunityIds]
  }
}

/**
 * A Creature holder's active advantage and disadvantage grants on its own attack rolls of one
 * attack domain (Vicious Mockery's disadvantage), as roll contributors. A Character folds the same
 * grants through its own policy instead.
 */
export function creatureActiveGrantAttackContributors(
  holderActorId: string,
  attackDomain: string,
  effects: readonly ActiveRuleEffectRecord[]
): EncounterRelationshipD20Contributor[] {
  return listEncounterActiveGrants(effects).flatMap(({ effectId, modifiers }) =>
    modifiers.flatMap((modifier) =>
      (modifier.modifierKind === 'ADVANTAGE' || modifier.modifierKind === 'DISADVANTAGE') &&
      modifier.valueDomainCode === 'ATTACK_ROLL' &&
      record(modifier.domain)?.attackDomain === attackDomain &&
      record(modifier.grant)?.scope === 'GLOBAL'
        ? [
            {
              sourceId: createCharacterMechanicSourceKey({
                kind: 'ACTIVE_EFFECT',
                activeEffectId: effectId
              }),
              grantId: modifier.grantId,
              domainKey: `active-grant:${holderActorId}`,
              influence: modifier.modifierKind
            }
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
  return listEncounterActiveGrants(effects).flatMap(({ effectId, modifiers }) =>
    modifiers.flatMap((modifier) => {
      const grantAbility = record(modifier.domain)?.ability ?? null
      return (modifier.modifierKind === 'ADVANTAGE' || modifier.modifierKind === 'DISADVANTAGE') &&
        modifier.valueDomainCode === 'ABILITY_CHECK' &&
        (grantAbility === null || grantAbility === abilityCode) &&
        record(modifier.grant)?.scope === 'GLOBAL'
        ? [
            {
              sourceId: createCharacterMechanicSourceKey({
                kind: 'ACTIVE_EFFECT',
                activeEffectId: effectId
              }),
              grantId: modifier.grantId,
              domainKey: `active-grant:${holderActorId}`,
              influence: modifier.modifierKind
            }
          ]
        : []
    })
  )
}

/**
 * The net of a holder's active fixed bonuses and penalties to one value domain, for the grants
 * whose domain `applies` accepts.
 */
function activeFixedGrantTotal(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
  valueDomainCode: string,
  applies: (domain: Record<string, unknown> | null) => boolean = () => true
): number {
  let total = 0
  for (const { modifiers } of listEncounterActiveGrants(effects)) {
    for (const modifier of modifiers) {
      const grant = record(modifier.grant)
      if (
        modifier.valueDomainCode !== valueDomainCode ||
        (modifier.modifierKind !== 'BONUS' && modifier.modifierKind !== 'PENALTY') ||
        grant?.scope !== 'GLOBAL' ||
        !applies(record(modifier.domain))
      )
        continue
      const payload = record(grant.payload)
      if (payload?.valueKind !== 'FIXED' || typeof payload.amount !== 'number')
        throw new Error(`An active ${valueDomainCode} grant must be a fixed amount.`)
      // A penalty is authored as a positive amount and subtracted once, here.
      total += modifier.modifierKind === 'PENALTY' ? -payload.amount : payload.amount
    }
  }
  return total
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
 * The effective maximum hit points the Sheet and the Encounter read, for any holder: a maximum
 * raised or lowered by its active fixed `HIT_POINTS_MAX` grants (Aid), less every active reduction,
 * never below 0. A Character passes its grant-free policy maximum, so its grants count once.
 */
export function effectiveHitPointMaximum(
  maximum: number,
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'createdOrdinal' | 'definition'>[]
): number {
  return reduceHitPointMaximum(
    Math.max(0, maximum + activeFixedGrantTotal(effects, 'HIT_POINTS_MAX')),
    listHitPointMaximumReductions(effects)
  )
}

/**
 * A holder's typed speeds with its active speed grants applied the way the Character policy folds
 * them: the best "your speed is X" grant replaces a speed's base (adding a speed the holder lacked,
 * as Fly does), then fixed bonuses and penalties add (Longstrider, Ray of Frost), never below 0.
 */
export function withActiveGrantSpeeds(
  speeds: readonly unknown[],
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
): SpeedDto[] {
  const replacements = new Map<string, number>()
  for (const { modifiers } of listEncounterActiveGrants(effects)) {
    for (const modifier of modifiers) {
      const speedId = record(modifier.domain)?.speedId
      const grant = record(modifier.grant)
      const amount = record(grant?.payload)?.amount
      if (
        modifier.valueDomainCode !== 'SPEED' ||
        modifier.modifierKind !== 'SET_VALUE' ||
        grant?.scope !== 'GLOBAL' ||
        typeof speedId !== 'string' ||
        typeof amount !== 'number'
      )
        continue
      replacements.set(speedId, Math.max(replacements.get(speedId) ?? amount, amount))
    }
  }
  const base = speeds.flatMap((entry) => {
    const speed = speedDtoSchema.safeParse(entry)
    return speed.success ? [speed.data] : []
  })
  return [
    ...base,
    ...[...replacements.keys()]
      .filter((speedId) => !base.some((speed) => speed.speedId === speedId))
      .map((speedId) => ({ speedId, amount: 0, unit: 'FEET' as const }))
  ].map((speed) => ({
    ...speed,
    amount: Math.max(
      0,
      (replacements.get(speed.speedId) ?? speed.amount) +
        activeFixedGrantTotal(effects, 'SPEED', (domain) => domain?.speedId === speed.speedId)
    )
  }))
}
