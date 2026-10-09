import type {
  CharacterGrantFoldModifier,
  CharacterGrantFoldSense,
  CharacterGrantFoldSource
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { speedDtoSchema, type SpeedDto } from '@artificer-toolkit/schema/shared/speed'
import { createCharacterMechanicSourceKey } from '@artificer-toolkit/shared/character'
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
      const merged = [
        ...(row.contributors as EncounterRelationshipD20Contributor[]),
        ...contributors
      ]
        .sort(compareCanonicalD20Contributors)
        .filter(
          (contributor, index, sorted) =>
            index === 0 || compareCanonicalD20Contributors(sorted[index - 1]!, contributor) !== 0
        )
      return [
        {
          abilityDefinitionId,
          conditionTypeId,
          modifier: row.modifier,
          rollMode: resolveD20Contributors(merged).rollMode,
          contributors: merged
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
