import { v5 as uuidv5 } from 'uuid'
import { innateConditionIds } from './encounterInnateConditions.js'
import type {
  CharacterGrantFoldModifier,
  CharacterGrantFoldOutput,
  CharacterGrantFoldSource
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import {
  incomingDamagePayloadDtoSchema,
  type IncomingDamageProfileDto
} from '@artificer-toolkit/schema/grants/modifier'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { D20AddedDieDto } from '@artificer-toolkit/schema/shared/d20AddedDice'
import { attackDomainCodeSchema } from '@artificer-toolkit/schema/shared/enums'
import { speedDtoSchema, type SpeedDto } from '@artificer-toolkit/schema/shared/speed'
import { createCharacterMechanicSourceKey } from '@artificer-toolkit/shared/character'
import {
  feetInLengthUnit,
  modifierRollInfluence,
  type AttackDomainCode,
  type AttackOccasionCode,
  type DamageDefenseBypassCode,
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
import {
  effectEventScope,
  isInEffectEventScope,
  type EffectEventScope
} from './events/encounterEventHooks.js'
import type { EncounterRelationshipD20Contributor } from './encounterRelationshipActionFacts.js'
import { lengthInUnit, speedAfterFractions, widestLengthByKey } from './modifierLength.js'
import {
  attackProfileCapabilityRegistry,
  modifierScopeCapabilityRegistry
} from './platformEncounterPolicy.js'
import {
  abilityScoreCapabilityRegistry,
  actionEconomyCapabilityRegistry,
  rollModeCapabilityRegistry
} from './platformPolicyModules.js'

// Namespaces the per-instance identity of an active grant's suppression contribution.
const grantSuppressionNamespace = '5b0c4e0a-7a52-4d2b-9a0e-3c1f6d8b2e47'

/**
 * The capabilities a holder's active grants switch off: an `ACTION_COUNT`, `BONUS_ACTION_COUNT` or
 * `REACTION_COUNT` `SET_VALUE 0` grant (Shocking Grasp's "can't take reactions", Haste's lethargy)
 * suppresses that allowance, so the holder is offered none of that kind while the grant lasts (D99).
 * A suppression is keyed by the grant instance, the active effect and its authored grant, because
 * several effects of one authored grant (or a grant id that is no UUID) would otherwise collide in
 * the availability resolver.
 */
export function encounterActiveGrantCapabilitySuppressions(
  gameSystemId: string,
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
) {
  const { allowanceDefinitionIdByCountDomain } =
    actionEconomyCapabilityRegistry.require(gameSystemId)
  return listActiveEffectGrants(effects).flatMap(({ effectId, modifiers }) =>
    modifiers.flatMap((modifier) => {
      const allowanceId = allowanceDefinitionIdByCountDomain[modifier.valueDomainCode]
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
  const { abilityDefinitionIdByCode } = abilityScoreCapabilityRegistry.require(gameSystemId)
  const scope = modifierScopeCapabilityRegistry.require(gameSystemId)
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
    const abilityDefinitionId = abilityDefinitionIdByCode[String(domain.ability)]
    const { conditionTypeId } = domain
    const influence = modifierRollInfluence(modifier)
    if (
      influence === null ||
      modifier.valueDomainCode !== 'SAVING_THROW_MODIFIER' ||
      abilityDefinitionId === undefined ||
      modifier.scope !== 'GLOBAL'
    )
      continue
    // A grant that holds only against some sources (Magic Resistance) is decided per save.
    if (hasSourceRestriction(restrictions)) continue
    const contributor = contributorOf(influence)
    if (conditionTypeId !== undefined) {
      const key = `${abilityDefinitionId}:${conditionTypeId}`
      const entry = scoped.get(key) ?? { abilityDefinitionId, conditionTypeId, contributors: [] }
      entry.contributors.push(contributor)
      scoped.set(key, entry)
    } else if (
      domain.ruleDefinitionId === undefined &&
      !hasHolderStateRestriction(restrictions) &&
      !scope.saveRequiresSourceSight(modifier)
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
  /** The authored ids of the holder's live active effects, which HOLDER_ACTIVE_EFFECT reads. */
  activeAuthoredEffectIds: readonly string[]
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

/** Whether a creature of these types meets a creature-type condition, before its constraint. */
function creatureTypeConditionMatches(
  condition: Pick<ModifierRestrictions[number]['conditions'][number], 'mode' | 'requiredIds'>,
  creatureTypeIds: readonly string[]
): boolean {
  return (
    condition.mode === 'ALL' || condition.requiredIds.some((id) => creatureTypeIds.includes(id))
  )
}

/**
 * Whether the holder meets a condition, or `undefined` when it cannot be decided here: it is no
 * holder condition, or the part of the holder state it reads is not known.
 */
function holderConditionMatches(
  condition: ModifierRestrictions[number]['conditions'][number],
  holderState: Partial<EncounterHolderState>
): boolean | undefined {
  switch (condition.kind) {
    case 'HOLDER_KIND':
      return holderState.kind && condition.requiredIds.includes(holderState.kind)
    case 'CREATURE_TYPE':
      return (
        holderState.creatureTypeIds &&
        creatureTypeConditionMatches(condition, holderState.creatureTypeIds)
      )
    case 'TURN_MOVEMENT': {
      if (!holderState.turnMovement) return undefined
      const { usedFeet, speedFeet } = holderState.turnMovement
      return (
        (condition.max === null || usedFeet <= condition.max) &&
        (condition.speedFraction === null || usedFeet <= speedFeet * condition.speedFraction)
      )
    }
    case 'HOLDER_ACTIVE_EFFECT': {
      const activeIds = holderState.activeAuthoredEffectIds
      return activeIds && condition.requiredIds.some((id) => activeIds.includes(id))
    }
    default:
      return isHolderStateKind(condition.kind)
        ? holderState[HOLDER_STATE_FLAG[condition.kind]]
        : undefined
  }
}

/**
 * Whether a modifier's holder restrictions hold: some group has only holder conditions and every
 * one is met. Any other condition, or one reading holder state not given, cannot be decided here
 * and fails closed, so the group does not hold.
 */
export function holderStateRestrictionsHold(
  restrictions: ModifierRestrictions,
  holderState: Partial<EncounterHolderState>
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

type SourceCondition = Pick<
  ModifierRestrictions[number]['conditions'][number],
  'kind' | 'constraint' | 'mode' | 'requiredIds'
>

/** The source of a grant: its creature's types and the traits of the attack that carries it. */
export type GrantSource = {
  readonly creatureTypeIds: readonly string[]
  readonly traits?: readonly string[]
}

const SOURCE_CONDITION_KINDS: ReadonlySet<string> = new Set([
  'SOURCE_CREATURE_TYPE',
  'SOURCE_TRAIT'
])

const isSourceCondition = ({ kind }: { readonly kind: string }): boolean =>
  SOURCE_CONDITION_KINDS.has(kind)

/**
 * What a grant requires of its source once the holder's own restrictions hold: alternative groups
 * of `SOURCE_CREATURE_TYPE` and `SOURCE_TRAIT` conditions, any one of which admits a source. Empty
 * admits every source.
 */
export type SourceCreatureQualifier = readonly (readonly SourceCondition[])[]

/**
 * The source qualifier of a modifier whose holder restrictions hold now, or `null` when none
 * does. The source (the attacker, the effect's origin) is unknown when the holder is prepared, so
 * its conditions travel with the grant to where it is (`sourceQualifierAdmits`).
 */
export function holderStateSourceQualifier(
  restrictions: ModifierRestrictions,
  holderState: EncounterHolderState
): SourceCreatureQualifier | null {
  if (restrictions.length === 0) return []
  const qualifier: SourceCondition[][] = []
  for (const group of restrictions) {
    const holderConditions = group.conditions.filter((condition) => !isSourceCondition(condition))
    if (!holderStateRestrictionsHold([{ conditions: holderConditions }], holderState)) continue
    if (holderConditions.length === group.conditions.length) return []
    qualifier.push(group.conditions.filter(isSourceCondition))
  }
  return qualifier.length > 0 ? qualifier : null
}

/** Whether the source meets the qualifier; a source with no type or trait meets only an exclusion. */
export function sourceQualifierAdmits(
  qualifier: SourceCreatureQualifier,
  source: GrantSource
): boolean {
  return (
    qualifier.length === 0 ||
    qualifier.some((group) =>
      group.every(
        (condition) =>
          (condition.kind === 'SOURCE_TRAIT'
            ? condition.mode === 'ALL' ||
              condition.requiredIds.some((id) => source.traits?.includes(id))
            : creatureTypeConditionMatches(condition, source.creatureTypeIds)) ===
          (condition.constraint === 'INCLUDE')
      )
    )
  )
}

function hasSourceRestriction(restrictions: ModifierRestrictions): boolean {
  return restrictions.some((group) => group.conditions.some(isSourceCondition))
}

function hasHolderStateRestriction(restrictions: ModifierRestrictions): boolean {
  return restrictions.some((group) =>
    group.conditions.some(
      (condition) =>
        isHolderStateKind(condition.kind) ||
        condition.kind === 'TURN_MOVEMENT' ||
        condition.kind === 'HOLDER_ACTIVE_EFFECT'
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
        hasHolderStateRestriction(modifier.restrictions) ||
        hasSourceRestriction(modifier.restrictions)
    )
  )
}

/**
 * Whether an active grant switches on a flag domain (`ENABLE`): Disengage's
 * `OPPORTUNITY_ATTACK_IMMUNITY` makes the holder's movement provoke no opportunity attacks, and
 * `SPELLCASTING_LOCK` bars the holder from casting spells and holding Concentration, and
 * `ACTION_BONUS_ACTION_EXCLUSIVITY` lets it take an Action or a Bonus Action on a turn, not both, and
 * `HEALING_RECEIVED` makes every die of healing the holder receives take its maximum.
 */
export function encounterGrantsEnabledDomain(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[],
  domain: Extract<
    ValueDomainCode,
    | 'OPPORTUNITY_ATTACK_IMMUNITY'
    | 'FREE_OPPORTUNITY_REACTION'
    | 'SPELLCASTING_LOCK'
    | 'ACTION_BONUS_ACTION_EXCLUSIVITY'
    | 'HEALING_RECEIVED'
  >
): boolean {
  return listActiveEffectGrants(effects).some(({ modifiers }) =>
    modifiers.some(
      (modifier) => modifier.valueDomainCode === domain && modifier.modifierKind === 'ENABLE'
    )
  )
}

/**
 * Whether the holder's active effects let this reactor make an opportunity reaction against it
 * without its reaction (`FREE_OPPORTUNITY_REACTION`), on the reactors and turns each effect's event
 * scope admits: only the source of an effect limited to its source (a Mark), anyone otherwise.
 */
export function encounterGrantsFreeOpportunityReaction(input: {
  holderActorId: string
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition' | 'lifecycle'>[]
  reactorActorId: string
  turnActorId: string | null
}): boolean {
  return input.effects.some((effect) => {
    const scope = effectEventScope(effect, input.holderActorId)
    return (
      scope !== null &&
      isInEffectEventScope(scope, {
        actorId: input.reactorActorId,
        turnActorId: input.turnActorId
      }) &&
      encounterGrantsEnabledDomain([effect], 'FREE_OPPORTUNITY_REACTION')
    )
  })
}

/**
 * How a holder takes damage, from its held modifiers (a Character's fold, or a Creature's features
 * and active grants): any `INCOMING_DAMAGE` `HALVE` halves each damage application, and each
 * `SAVE_FOR_HALF` replaces what a save-for-half effect deals it on a save of its abilities.
 */
export function incomingDamageProfile(
  modifiers: readonly {
    modifierKind: string
    valueDomainCode: string
    payload?: object | undefined
  }[]
): IncomingDamageProfileDto {
  const payloads = modifiers
    .filter(
      ({ modifierKind, valueDomainCode }) =>
        modifierKind === 'ENABLE' && valueDomainCode === 'INCOMING_DAMAGE'
    )
    .map(({ payload }) => incomingDamagePayloadDtoSchema.parse(payload))
  return {
    halved: payloads.some(({ incomingDamageKind }) => incomingDamageKind === 'HALVE'),
    saveForHalf: payloads.flatMap((payload) =>
      payload.incomingDamageKind === 'SAVE_FOR_HALF' ? [payload] : []
    )
  }
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
  /** The attacker types the grant admits (Protection from Evil and Good); empty: every attacker. */
  sourceQualifier: SourceCreatureQualifier
  /** The influence the grant gives, or null when it suppresses one instead (Elusive). */
  contributor: EncounterRelationshipD20Contributor | null
  /** The System roll-influence code the grant takes from the attack, whatever its source. */
  suppressedInfluence: string | null
}

type AttacksAgainstModifier = Pick<
  CharacterGrantFoldModifier,
  'valueDomainCode' | 'modifierKind' | 'domain' | 'payload'
>

/** The grant's part of an attacks-against entry, or null when it is no `ATTACKS_AGAINST` grant. */
function attacksAgainstEntry(
  modifier: AttacksAgainstModifier,
  contributor: (
    influence: EncounterRelationshipD20Contributor['influence']
  ) => EncounterRelationshipD20Contributor
): Omit<EncounterAttackAgainstContributor, 'eventScope' | 'sourceQualifier'> | null {
  const { attackDomain, requiresHolderSeesAttacker, exemptAttackerSenseDefinitionIds } =
    modifier.domain
  const influence = modifierRollInfluence(modifier)
  const suppressedInfluence = modifierRollInfluence(modifier, 'SUPPRESS_ROLL_INFLUENCE')
  if (
    modifier.valueDomainCode !== 'ATTACKS_AGAINST' ||
    attackDomain === undefined ||
    (influence === null && suppressedInfluence === null)
  )
    return null
  return {
    attackDomain,
    requiresHolderSeesAttacker: requiresHolderSeesAttacker === true,
    exemptAttackerSenseDefinitionIds: exemptAttackerSenseDefinitionIds ?? [],
    ...(modifier.domain.attackOccasion && { attackOccasion: modifier.domain.attackOccasion }),
    contributor: influence === null ? null : contributor(influence),
    suppressedInfluence
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
      const sourceQualifier =
        modifier.source.kind === 'ACTIVE_EFFECT'
          ? null
          : holderStateSourceQualifier(modifier.deferredRequirements, holderState)
      const entry =
        sourceQualifier === null
          ? null
          : attacksAgainstEntry(modifier, (influence) => ({
              sourceId: modifier.sourceId,
              grantId,
              domainKey: modifier.domainKey,
              influence,
              source: rollModeContributorSourceOfMechanicSource(modifier.source, holderActorId)
            }))
      return entry && sourceQualifier
        ? [{ ...entry, eventScope: EVERY_EVENT, sourceQualifier }]
        : []
    })
  )
  const fromEffects = listActiveEffectGrants(effects).flatMap(({ effectId, modifiers }) => {
    const effect = effects.find(({ id }) => id === effectId)
    const eventScope = effect ? effectEventScope(effect, holderActorId) : null
    if (eventScope === null) return []
    return modifiers.flatMap((modifier) => {
      const sourceQualifier =
        modifier.scope === 'GLOBAL'
          ? holderStateSourceQualifier(modifier.restrictions, holderState)
          : null
      const entry =
        sourceQualifier === null
          ? null
          : attacksAgainstEntry(modifier, (influence) =>
              activeGrantContributor(effectId, holderActorId, modifier.grantId, influence)
            )
      return entry && sourceQualifier ? [{ ...entry, eventScope, sourceQualifier }] : []
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
      const influence = modifierRollInfluence(modifier)
      return modifier.valueDomainCode === 'SKILL_MODIFIER' &&
        influence !== null &&
        modifier.scope === 'GLOBAL' &&
        modifier.source.kind !== 'ACTIVE_EFFECT' &&
        hasHolderStateRestriction(modifier.deferredRequirements)
        ? [{ modifier, grantId, influence }]
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

/** A holder's restricted condition immunity: against the sources its qualifier admits (all when empty). */
export type EncounterSourceConditionImmunity = {
  conditionTypeId: string
  sourceQualifier: SourceCreatureQualifier
}

/**
 * The condition immunities a holder's active effects and own features (a Character's folded
 * features, a Creature's feature modifiers) give only against some sources (Protection from Evil
 * and Good, Purity of Spirit, Fey Ancestry's magical sleep) or only in some holder state (Mindless
 * Rage while raging), whose holder restrictions hold now. Unqualified immunities fold as plain ones.
 */
export function encounterSourceConditionImmunities(input: {
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
  grantFold: Pick<CharacterGrantFoldOutput, 'modifiers'> | null
  holderState: EncounterHolderState
}): EncounterSourceConditionImmunity[] {
  const grants = [
    ...listActiveEffectGrants(input.effects).flatMap(({ modifiers }) =>
      modifiers.flatMap((modifier) =>
        modifier.scope === 'GLOBAL' ? [{ modifier, restrictions: modifier.restrictions }] : []
      )
    ),
    ...(input.grantFold?.modifiers ?? []).flatMap((modifier) =>
      modifier.source.kind === 'ACTIVE_EFFECT'
        ? []
        : [{ modifier, restrictions: modifier.deferredRequirements }]
    )
  ]
  return grants.flatMap(({ modifier, restrictions }) => {
    const { payload } = modifier
    if (
      modifier.valueDomainCode !== 'CONDITION_IMMUNITY' ||
      modifier.modifierKind !== 'ADD_OPTION' ||
      !(hasSourceRestriction(restrictions) || hasHolderStateRestriction(restrictions)) ||
      payload === undefined ||
      !('conditionTypeId' in payload)
    )
      return []
    const sourceQualifier = holderStateSourceQualifier(restrictions, input.holderState)
    return sourceQualifier ? [{ conditionTypeId: payload.conditionTypeId, sourceQualifier }] : []
  })
}

/**
 * An effect's source with the traits its System gives every effect of a spell cast when
 * `spellCastSystemId` names the System of the spell it comes from. Condition immunities and saves
 * against a source both read it, so a source trait has one home.
 */
function sourceWithSpellCastTraits(source: GrantSource, spellCastSystemId: string | null) {
  return spellCastSystemId === null
    ? source
    : {
        ...source,
        traits: [
          ...(source.traits ?? []),
          ...attackProfileCapabilityRegistry.require(spellCastSystemId).spellCastSourceTraits
        ]
      }
}

/**
 * The condition immunities that hold against a condition's source: its creature types and traits,
 * plus its spell-cast traits (Freedom of Movement against a magical restraint). Every path that
 * applies a condition resolves its immunities here.
 */
export function conditionImmunityIdsAgainstSource(
  conditionImmunityIds: readonly string[],
  sourceConditionImmunities: readonly EncounterSourceConditionImmunity[],
  source: GrantSource,
  spellCastSystemId: string | null
): readonly string[] {
  if (sourceConditionImmunities.length === 0) return conditionImmunityIds
  const conditionSource = sourceWithSpellCastTraits(source, spellCastSystemId)
  const admitted = sourceConditionImmunities.filter(({ sourceQualifier }) =>
    sourceQualifierAdmits(sourceQualifier, conditionSource)
  )
  return admitted.length === 0
    ? conditionImmunityIds
    : [
        ...new Set([
          ...conditionImmunityIds,
          ...admitted.map(({ conditionTypeId }) => conditionTypeId)
        ])
      ]
}

/** Whether any active effect carries a global grant that holds only against certain source creatures. */
export function hasEffectSourceRestrictedGrants(
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
): boolean {
  return listActiveEffectGrants(effects).some(({ modifiers }) =>
    modifiers.some(
      (modifier) => modifier.scope === 'GLOBAL' && hasSourceRestriction(modifier.restrictions)
    )
  )
}

/** Whether a holder's own features carry a grant that holds only against some sources. */
export function hasFeatureSourceRestrictedGrants(
  grantFold: Pick<CharacterGrantFoldOutput, 'modifiers'> | null
): boolean {
  return (grantFold?.modifiers ?? []).some(
    (modifier) =>
      modifier.source.kind !== 'ACTIVE_EFFECT' &&
      hasSourceRestriction(modifier.deferredRequirements)
  )
}

/** Whether a Character's own features carry a condition immunity its holder state decides (Mindless Rage). */
export function hasFeatureHolderStateConditionImmunities(
  grantFold: Pick<CharacterGrantFoldOutput, 'modifiers'> | null
): boolean {
  return (grantFold?.modifiers ?? []).some(
    (modifier) =>
      modifier.valueDomainCode === 'CONDITION_IMMUNITY' &&
      modifier.source.kind !== 'ACTIVE_EFFECT' &&
      hasHolderStateRestriction(modifier.deferredRequirements)
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
  const { abilityDefinitionIdByCode } = abilityScoreCapabilityRegistry.require(gameSystemId)
  const scope = modifierScopeCapabilityRegistry.require(gameSystemId)
  for (const { effectId, modifiers } of listActiveEffectGrants(effects)) {
    for (const modifier of modifiers) {
      const abilityDefinitionId = abilityDefinitionIdByCode[String(modifier.domain.ability)]
      const influence = modifierRollInfluence(modifier)
      if (
        influence === null ||
        modifier.valueDomainCode !== 'SAVING_THROW_MODIFIER' ||
        abilityDefinitionId === undefined ||
        modifier.scope !== 'GLOBAL' ||
        scope.saveRequiresSourceSight(modifier) ||
        !hasHolderStateRestriction(modifier.restrictions) ||
        !holderStateRestrictionsHold(modifier.restrictions, holderState)
      )
        continue
      byAbility.set(abilityDefinitionId, [
        ...(byAbility.get(abilityDefinitionId) ?? []),
        activeGrantContributor(effectId, holderActorId, modifier.grantId, influence)
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
  gameSystemId: string
  holderActorId: string
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
  grantFold: Pick<CharacterGrantFoldOutput, 'modifiers' | 'modifierGroups'> | null
}): (EncounterSourceSightSave & { restrictions: ModifierRestrictions })[] {
  const { grantFold } = input
  const { abilityDefinitionIdByCode } = abilityScoreCapabilityRegistry.require(input.gameSystemId)
  const scope = modifierScopeCapabilityRegistry.require(input.gameSystemId)
  if (grantFold)
    return grantFold.modifierGroups.flatMap(({ contributions }) =>
      contributions.flatMap(({ acceptedModifierIndex, grantId }) => {
        const modifier = grantFold.modifiers[acceptedModifierIndex]!
        const abilityDefinitionId = abilityDefinitionIdByCode[String(modifier.domain.ability)]
        const influence = modifierRollInfluence(modifier)
        return influence !== null &&
          scope.saveRequiresSourceSight(modifier) &&
          abilityDefinitionId !== undefined
          ? [
              {
                abilityDefinitionId,
                restrictions: modifier.deferredRequirements,
                contributor: {
                  sourceId: modifier.sourceId,
                  grantId,
                  domainKey: modifier.domainKey,
                  influence,
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
      const abilityDefinitionId = abilityDefinitionIdByCode[String(modifier.domain.ability)]
      const influence = modifierRollInfluence(modifier)
      return influence !== null &&
        scope.saveRequiresSourceSight(modifier) &&
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
                influence
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

/**
 * A saving-throw advantage or disadvantage that holds only against some sources (Magic
 * Resistance's spells and magical effects, D179). Preparation decides it per save from the
 * effect's source.
 */
export type EncounterSourceSave = EncounterSourceSightSave & {
  sourceQualifier: SourceCreatureQualifier
}

/**
 * The saving-throw grants a holder's active effects and own features (a Character's folded
 * features, a Creature's feature modifiers) give only against some sources, whose holder
 * restrictions hold now. A grant scoped to a condition or a rule is not one of them.
 */
export function encounterSourceSaves(input: {
  gameSystemId: string
  holderActorId: string
  effects: readonly Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]
  featureGrants: Pick<CharacterGrantFoldOutput, 'modifiers'> | null
  holderState: EncounterHolderState
}): EncounterSourceSave[] {
  const { abilityDefinitionIdByCode } = abilityScoreCapabilityRegistry.require(input.gameSystemId)
  const scope = modifierScopeCapabilityRegistry.require(input.gameSystemId)
  const grants = [
    ...listActiveEffectGrants(input.effects).flatMap(({ effectId, modifiers }) =>
      modifiers.flatMap((modifier) =>
        modifier.scope === 'GLOBAL'
          ? [
              {
                modifier,
                restrictions: modifier.restrictions,
                contributor: (influence: EncounterRelationshipD20Contributor['influence']) =>
                  activeGrantContributor(effectId, input.holderActorId, modifier.grantId, influence)
              }
            ]
          : []
      )
    ),
    ...(input.featureGrants?.modifiers ?? []).flatMap((modifier) =>
      modifier.source.kind === 'ACTIVE_EFFECT' || modifier.scope !== 'GLOBAL'
        ? []
        : [
            {
              modifier,
              restrictions: modifier.deferredRequirements,
              contributor: (influence: EncounterRelationshipD20Contributor['influence']) => ({
                sourceId: modifier.sourceId,
                grantId: modifier.grantId,
                domainKey: modifier.domainKey,
                influence,
                source: rollModeContributorSourceOfMechanicSource(
                  modifier.source,
                  input.holderActorId
                )
              })
            }
          ]
    )
  ]
  return grants.flatMap(({ modifier, restrictions, contributor }) => {
    const abilityDefinitionId = abilityDefinitionIdByCode[String(modifier.domain.ability)]
    const influence = modifierRollInfluence(modifier)
    if (
      influence === null ||
      modifier.valueDomainCode !== 'SAVING_THROW_MODIFIER' ||
      abilityDefinitionId === undefined ||
      modifier.domain.conditionTypeId !== undefined ||
      modifier.domain.ruleDefinitionId !== undefined ||
      scope.saveRequiresSourceSight(modifier) ||
      !hasSourceRestriction(restrictions)
    )
      return []
    const sourceQualifier = holderStateSourceQualifier(restrictions, input.holderState)
    return sourceQualifier
      ? [{ abilityDefinitionId, sourceQualifier, contributor: contributor(influence) }]
      : []
  })
}

/**
 * The target's facts with the source-qualified saving-throw grants its effect's source admits
 * merged into the save rows of their abilities; the source gains its spell-cast traits when
 * `spellCastSystemId` names the System of the spell it comes from.
 */
export function withSourceSaves(
  gameSystemId: string,
  targetDerivedFacts: Readonly<Record<string, unknown>>,
  sourceSaves: readonly EncounterSourceSave[],
  source: GrantSource,
  spellCastSystemId: string | null
): Readonly<Record<string, unknown>> {
  const { savingThrowDefinitions } = targetDerivedFacts
  if (!Array.isArray(savingThrowDefinitions) || sourceSaves.length === 0) return targetDerivedFacts
  const saveSource = sourceWithSpellCastTraits(source, spellCastSystemId)
  const byAbility = new Map<string, EncounterRelationshipD20Contributor[]>()
  for (const { abilityDefinitionId, sourceQualifier, contributor } of sourceSaves) {
    if (!sourceQualifierAdmits(sourceQualifier, saveSource)) continue
    byAbility.set(abilityDefinitionId, [...(byAbility.get(abilityDefinitionId) ?? []), contributor])
  }
  return byAbility.size === 0
    ? targetDerivedFacts
    : {
        ...targetDerivedFacts,
        savingThrowDefinitions: withSaveRowContributors(
          gameSystemId,
          savingThrowDefinitions,
          byAbility
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

const qualifiedDefenseKey = (defense: {
  kind: string
  damageTypeId: string
  bypassedBy: readonly string[]
}) => `${defense.kind}:${defense.damageTypeId}:${[...defense.bypassedBy].sort().join(',')}`

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
    qualifiedDefenses: readonly {
      kind: 'RESISTANCE' | 'IMMUNITY'
      damageTypeId: string
      bypassedBy: DamageDefenseBypassCode[]
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
  const qualifiedDefenses = new Map(
    protection.qualifiedDefenses.map((defense) => [qualifiedDefenseKey(defense), defense])
  )
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
        hasSourceRestriction(modifier.restrictions) ||
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
      const bypassedBy = 'bypassedBy' in payload ? payload.bypassedBy : undefined
      if (kind && bypassedBy?.length) {
        if (kind === 'VULNERABILITY') continue
        const defense = { kind, damageTypeId: option, bypassedBy }
        if (adding) qualifiedDefenses.set(qualifiedDefenseKey(defense), defense)
        else qualifiedDefenses.delete(qualifiedDefenseKey(defense))
      } else if (kind) {
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
    qualifiedDefenses: [...qualifiedDefenses.values()].sort(
      (left, right) =>
        left.damageTypeId.localeCompare(right.damageTypeId) ||
        left.kind.localeCompare(right.kind) ||
        qualifiedDefenseKey(left).localeCompare(qualifiedDefenseKey(right))
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
      const influence = modifierRollInfluence(modifier)
      return influence !== null &&
        modifier.valueDomainCode === 'ATTACK_ROLL' &&
        modifier.domain.attackDomain === attackDomain &&
        modifier.domain.againstEffectSource !== true &&
        (grantAbility === null || grantAbility === attackAbility) &&
        modifier.scope === 'GLOBAL'
        ? [activeGrantContributor(effectId, holderActorId, modifier.grantId, influence)]
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

/** The light on the holder's square: bright, and whether the Scene's daylight reaches it (D189). */
export type EncounterHolderLight = { brightLight: boolean; daylight: boolean }

/** Whether a Creature's feature grants ask how the holder is lit (Sunlight Sensitivity). */
export function featureModifiersReadHolderLight(modifiers: FeatureModifiers): boolean {
  return modifiers.some(({ deferredRequirements }) =>
    deferredRequirements.some(
      (group) => conditionsOfKind(group, 'HOLDER_IN_BRIGHT_LIGHT').length > 0
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
  targetHasNotTakenTurn: boolean,
  holderLight: EncounterHolderLight | null
): boolean {
  return (
    group.conditions.length > 0 &&
    group.conditions.every((condition) => {
      if (condition.constraint !== 'INCLUDE') return false
      if (condition.kind === 'ENEMY_NEAR_TARGET')
        return (
          nearestEnemyFeet !== null && condition.max !== null && nearestEnemyFeet <= condition.max
        )
      if (condition.kind === 'HOLDER_IN_BRIGHT_LIGHT')
        return (
          holderLight !== null &&
          holderLight.brightLight &&
          (!condition.requiresDaylight || holderLight.daylight)
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
 * target or there is no Scene to measure on. `holderLight` is the light on the holder's square
 * (Sunlight Sensitivity), null without a Scene.
 */
export function creatureFeatureAttackContributors(
  holderActorId: string,
  attackDomain: string,
  attackAbility: string | null,
  modifiers: FeatureModifiers,
  nearestEnemyFeet: number | null,
  targetHasNotTakenTurn = false,
  holderLight: EncounterHolderLight | null = null
): EncounterRelationshipD20Contributor[] {
  return modifiers.flatMap((modifier) => {
    const grantAbility = modifier.domain.ability ?? null
    const influence = modifierRollInfluence(modifier)
    const requirementsMet =
      modifier.deferredRequirements.length === 0 ||
      modifier.deferredRequirements.some((group) =>
        deferredGroupMet(group, nearestEnemyFeet, targetHasNotTakenTurn, holderLight)
      )
    return influence !== null &&
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
            influence,
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
    modifiers.flatMap((modifier) => {
      const influence = modifierRollInfluence(modifier)
      return influence !== null &&
        modifier.valueDomainCode === 'ATTACK_ROLL' &&
        modifier.domain.attackDomain === input.attackDomain &&
        modifier.domain.againstEffectSource === true
        ? [activeGrantContributor(effectId, input.attackerActorId, modifier.grantId, influence)]
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
      const influence = modifierRollInfluence(modifier)
      return influence !== null &&
        modifier.valueDomainCode === 'ABILITY_CHECK' &&
        (grantAbility === null || grantAbility === abilityCode) &&
        modifier.scope === 'GLOBAL'
        ? [activeGrantContributor(effectId, holderActorId, modifier.grantId, influence)]
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
  const base = speeds.map((entry) => speedDtoSchema.parse(entry))
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
    ),
    (speedId) => base.find((speed) => speed.speedId === speedId)
  )
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
