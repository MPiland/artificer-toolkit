import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterActionRuleEntryPoint } from '@artificer-toolkit/schema/api/characterActionRules'
import type { CharacterGrantFoldInput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import { equalCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import {
  compileEffect,
  type CompiledEffectGroup,
  type CompiledFeatureEffectGroup
} from '@artificer-toolkit/shared/compilers'
import type { CompiledEquipmentEffectGroup } from '@artificer-toolkit/shared/subjects/compilers'
import type {
  CharacterAssemblyRegistry,
  CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'

import {
  compiledEquipmentParentIds,
  getCharacterGrantFoldSelectedOptionIds
} from './characterGrantFoldSourceFacts.js'
import {
  collectCastModifiers,
  collectSparesCreatures,
  type CastModifierSource,
  type SparesCreaturesSource
} from './characterCastModifiers.js'
import { collectOnHitRiders, mergeOnHitRiders, type OnHitRider } from './characterOnHitRiders.js'
import {
  initiativeRestoreSources,
  type InitiativeRestoreSource
} from './characterInitiativeRestores.js'
import type { HeldGrantedAction } from '../encounterGrantedActions.js'
import { placedSpaceEntries } from '../placedSpaceEntries.js'
import { compiledStandingGrantedActions, standingEffectReturnsOn } from '../standingEffects.js'
import { reduceEffectRestrictions } from '../systems/dnd5e/attackRestrictions.js'
import { dnd5eAttackingItem } from '../systems/dnd5e/modifierApplicability.js'

type ActionCandidate = NonNullable<CharacterRulePolicyInput['actionCandidates']>[number]
type CharacterActionSource = ActionCandidate['source']
type CharacterActionRestrictions = CharacterGrantFoldInput['equipmentItems'][number]['restrictions']
type CharacterActionMechanicsOwner = ActionCandidate['mechanicsOwner']
type ResourcePoolCandidate = CharacterRulePolicyInput['resourcePoolCandidates'][number]
type ActionMechanicFacts = ActionCandidate['mechanicFacts']
type ActionMechanicOutcome = ActionMechanicFacts['outcomes'][number]
type CompiledEffectEntry = Extract<CompiledEffectGroup['entries'][number], { outcome: unknown }>
type HealOutcome = Extract<ActionMechanicOutcome, { kind: 'HEAL' }>
type ActionEquipment = NonNullable<ActionCandidate['equipment']>
type ItemEquipmentState = Omit<ActionEquipment, 'grip' | 'requirements'>

/**
 * The ammunition an ammunition weapon fires: every item of the Character descending from the equipment
 * the weapon names fits, so a variant (+1 Arrows) fits through its parent chain.
 */
function ammunitionState(
  ammunitionEquipmentId: string | undefined,
  items: CharacterBuildSnapshot['equipmentItems']
): Pick<ItemEquipmentState, 'ammunitionEquipmentId' | 'ammunitionStacks'> {
  if (!ammunitionEquipmentId) return {}
  return {
    ammunitionEquipmentId,
    ammunitionStacks: items.flatMap(({ instanceId, contentRef, compiledItem }) =>
      [contentRef.definitionId, ...compiledEquipmentParentIds(compiledItem)].includes(
        ammunitionEquipmentId
      )
        ? [
            {
              itemInstanceId: instanceId,
              equipmentId: contentRef.definitionId,
              label: compiledItem.label ?? 'Ammunition'
            }
          ]
        : []
    )
  }
}

/** One weapon attack an item makes, which a Feature attack with the wielded weapons uses (D156). */
interface ItemWeaponAttack {
  equipment: ItemEquipmentState
  effect: CompiledEquipmentEffectGroup
  label: string
}

/** The weapon attacks a Feature attack with the wielded weapons makes, and the riders on them. */
interface WieldedWeaponAttacks {
  weapons: readonly ItemWeaponAttack[]
  onHitRiders: readonly OnHitRider[]
}

/** Action candidates with their server-only entries, index-aligned. */
interface CharacterActionSources {
  candidates: ActionCandidate[]
  entryPoints: CharacterActionRuleEntryPoint[]
}

interface CharacterActionRuleFacts {
  actionCandidates: ActionCandidate[]
  entryPoints: CharacterActionRuleEntryPoint[]
  /**
   * The zones the Character's passive features, options and feats keep around its token (D155),
   * as candidates no one takes: an Encounter places them, and they are never policy facts.
   */
  passiveZones: CharacterActionSources
  /** The charges the Character's passive features raise when it rolls initiative; never policy facts. */
  initiativeRestores: InitiativeRestoreSource[]
  /**
   * The always-on effects the Character's passive features hold until something ends them, which a
   * rest turns back on; candidates no one takes, never policy facts.
   */
  standingEffects: CharacterActionSources
  /** The basic actions the Character's passive features offer on every turn (D188); never policy facts. */
  standingGrantedActions: HeldGrantedAction[]
  /** The costs the Character's features, options and feats let it pay on casting a spell; never policy facts. */
  castModifiers: CastModifierSource[]
  /** What the Character's features let it spare from the area spells it casts; never policy facts. */
  sparesCreatures: SparesCreaturesSource[]
  /** The riders the Character's passive features, options and feats owe the attacks they name; never policy facts. */
  onHitRiders: OnHitRider[]
}

/** Every action identity of one Character source starts with this prefix. */
export function characterSourceActionIdPrefix(sourceId: string): string {
  return `${sourceId}:ACTION:`
}

function actionId(sourceId: string, effectId: string): string {
  const id = `${characterSourceActionIdPrefix(sourceId)}${encodeURIComponent(effectId)}`
  if (id.length > 240)
    throw new Error(`Character action identity exceeds 240 characters: ${effectId}`)
  return id
}

function sourceStateRequirements(restrictions: CharacterActionRestrictions): {
  requiresEquipped: boolean
  requiresAttuned: boolean
} {
  const included = restrictions
    .flatMap((group) => group.conditions)
    .filter((condition) => condition.kind === 'SOURCE_STATE' && condition.constraint === 'INCLUDE')
  return {
    requiresEquipped: included.some((condition) => condition.sourceState === 'EQUIPPED'),
    requiresAttuned: included.some((condition) => condition.sourceState === 'ATTUNED')
  }
}

function nullableNumber(value: number | undefined): number | null {
  return value ?? null
}

function nullableLabel(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

/**
 * The saving throw the entering behavior of a placed or source zone authors. The action's facts carry
 * it so its DC resolves like any save's; the web bundle reads these facts, so this stays out of the
 * Encounter zone modules.
 */
function zoneEntrySavingThrow(effect: CompiledEffectGroup) {
  // A GM ruling beside the zone (D187a) resolves nothing, so it does not count as another entry.
  const entries = effect.entries.filter(
    (entry) => !('outcome' in entry && entry.outcome.effectKind === 'MANUAL_ADJUDICATION')
  )
  // A cast-time pick between zones (D140) has one entry per option; the action resolves one save,
  // so every option must author the same one.
  const picks = entries.length > 1 && entries.every((entry) => entry.groupKind === 'CHOICE')
  if (entries.length !== 1 && !picks) return undefined
  const saves = entries.map((entry) => {
    const outcome = 'outcome' in entry ? entry.outcome : null
    if (
      outcome?.effectKind !== 'MANIFEST' ||
      outcome.manifestKind !== 'ZONE' ||
      (outcome.attachmentKind !== 'PLACED_SPACE' && outcome.attachmentKind !== 'SOURCE')
    )
      return undefined
    const invocation = outcome.components?.[0]?.behaviors?.[0]?.invocation
    return invocation && 'savingThrow' in invocation ? invocation.savingThrow : undefined
  })
  // Each option authors its own save identity; the save itself is what must agree.
  const [first] = saves
  return first &&
    saves.every((save) => save && equalCanonicalJson({ ...save, id: null }, { ...first, id: null }))
    ? first
    : undefined
}

/**
 * The save an action with no save of its own repeats on the target's later turns (Power Word Stun):
 * its DC is the action's to resolve, as a zone's is, so the repeat can be pinned at cast.
 */
function followUpSaveSavingThrow(effect: CompiledEffectGroup) {
  for (const entry of effect.entries)
    if ('outcome' in entry && entry.outcome.effectKind === 'FOLLOW_UP_SAVE')
      return entry.outcome.savingThrow
  return undefined
}

function normalizeInvocation(
  invocation: CompiledEffectGroup['invocation'],
  zoneSavingThrow:
    | ReturnType<typeof zoneEntrySavingThrow>
    | ReturnType<typeof followUpSaveSavingThrow>
): ActionMechanicFacts['invocation'] {
  const activation =
    'activation' in invocation
      ? {
          code: invocation.activation.code,
          amount: 'amount' in invocation.activation ? invocation.activation.amount : null
        }
      : null
  const range =
    invocation.range.rangeKind === 'DISTANCE'
      ? {
          rangeKind: invocation.range.rangeKind,
          amount: invocation.range.amount,
          longAmount: nullableNumber(invocation.range.longAmount),
          unit: invocation.range.unit
        }
      : {
          rangeKind: invocation.range.rangeKind,
          amount: null,
          longAmount: null,
          unit: null
        }
  // A zone's save is made later by whoever enters it; its DC is the action's to resolve.
  const authoredSave =
    invocation.triggerCode === 'SAVING_THROW' ? invocation.savingThrow : zoneSavingThrow
  const savingThrow = authoredSave
    ? {
        dcMethod: authoredSave.dcMethod,
        abilityDefinitionId: authoredSave.abilityDefinitionId,
        baseDc: 'baseDc' in authoredSave ? authoredSave.baseDc : null,
        bonuses:
          'bonuses' in authoredSave
            ? (authoredSave.bonuses ?? []).map((bonus) => {
                switch (bonus.bonusKind) {
                  case 'ABILITY_MODIFIER':
                    return {
                      bonusKind: bonus.bonusKind,
                      abilityDefinitionId: bonus.abilityDefinitionId
                    }
                  case 'PROFICIENCY_BONUS':
                    return { bonusKind: bonus.bonusKind }
                  case 'STATIC_BONUS':
                    return { bonusKind: bonus.bonusKind, amount: bonus.amount }
                }
              })
            : []
      }
    : null

  const trigger = 'reactionTrigger' in invocation ? invocation.reactionTrigger : undefined
  const targetCount =
    invocation.targeting?.selectionKind === 'CHOSEN_CREATURES'
      ? invocation.targeting.maxTargetsScaling
      : undefined

  return {
    triggerCode: invocation.triggerCode,
    activation,
    range,
    savingThrow,
    reactionTrigger:
      trigger?.kind === 'MOVEMENT'
        ? { ...trigger, movementInterruption: trigger.movementInterruption ?? null }
        : (trigger ?? null),
    ...(targetCount?.scalingSource === 'SPELL_CAST_LEVEL'
      ? { targetCountLevels: targetCount.breakpoints.map(({ level }) => level) }
      : {})
  }
}

function normalizeHealOutcome(
  outcome: Extract<CompiledEffectEntry['outcome'], { effectKind: 'HEAL' }>,
  pathCode: string,
  label: string | null
): HealOutcome {
  const values: HealOutcome['values'] = []
  if (outcome.scalingKind === 'NONE') {
    values.push({
      level: null,
      order: 0,
      amount: 'amount' in outcome ? outcome.amount : null,
      dice: 'diceConfig' in outcome ? outcome.diceConfig : null,
      multiplier: null,
      minimum: null,
      maximum: null
    })
  } else if (outcome.valueKind === 'POOL') {
    values.push({
      level: null,
      order: 0,
      amount: outcome.amount ?? null,
      dice: null,
      multiplier: outcome.multiplier ?? null,
      minimum: outcome.min ?? null,
      maximum: outcome.max ?? null
    })
  } else if (outcome.scalingKind === 'BREAKPOINTS') {
    for (const entry of outcome.breakpoints) {
      values.push({
        level: entry.level,
        order: entry.order,
        amount: 'amount' in entry.value ? entry.value.amount : null,
        dice: 'diceConfig' in entry.value ? entry.value.diceConfig : null,
        multiplier: null,
        minimum: null,
        maximum: null
      })
    }
  } else {
    for (const entry of outcome.levels) {
      values.push({
        level: entry.level,
        order: entry.order,
        amount: 'amount' in entry ? entry.amount : null,
        dice: 'diceConfig' in entry ? entry.diceConfig : null,
        multiplier: null,
        minimum: null,
        maximum: null
      })
    }
  }

  return {
    kind: 'HEAL',
    outcomeId: outcome.id,
    pathCode,
    label,
    valueKind: outcome.valueKind,
    scalingKind: outcome.scalingKind,
    scalingSource: outcome.scalingKind === 'NONE' ? null : outcome.scalingSource,
    classId: outcome.scalingKind !== 'NONE' && 'classId' in outcome ? outcome.classId : null,
    temporary: outcome.temporary ?? false,
    values,
    bonuses: [...(outcome.bonuses ?? [])]
      .sort((left, right) => left.order - right.order)
      .map((bonus) => {
        const bounds = {
          order: bonus.order,
          min: bonus.min ?? null,
          max: bonus.max ?? null,
          multiplier: bonus.multiplier ?? null
        }
        switch (bonus.bonusKind) {
          case 'ABILITY_BONUS':
            return { ...bounds, bonusKind: bonus.bonusKind, ability: bonus.ability }
          case 'PROFICIENCY_BONUS':
            return { ...bounds, bonusKind: bonus.bonusKind }
          case 'CLASS_LEVEL':
            return { ...bounds, bonusKind: bonus.bonusKind, classId: bonus.classId }
        }
      })
  }
}

export function normalizeCharacterActionMechanicFacts(
  effect: CompiledEffectGroup
): ActionMechanicFacts {
  const grouped = new Map<string, CompiledEffectEntry[]>()
  const entries = effect.entries
    // An optional rider is the player's choice at the hit, so the action card does not list it.
    .filter((entry): entry is CompiledEffectEntry => 'outcome' in entry && !entry.optionalRider)
    .sort(
      (left, right) =>
        left.pathOrder - right.pathOrder ||
        left.entryOrder - right.entryOrder ||
        left.id.localeCompare(right.id)
    )

  for (const entry of entries) {
    const key = [entry.pathGroupId, entry.entryId, entry.entryOrder, entry.outcome.effectKind].join(
      '\u0000'
    )
    const existing = grouped.get(key) ?? []
    existing.push(entry)
    grouped.set(key, existing)
  }

  const outcomes: ActionMechanicOutcome[] = []
  for (const group of grouped.values()) {
    const entry = group[0]!
    const outcome = entry.outcome
    if (outcome.effectKind === 'DAMAGE') {
      if (outcome.damageTypeId === undefined)
        throw new Error('A rider that takes the weapon damage type must be merged into an attack.')
      const values = group.flatMap((candidate) => {
        const damage = candidate.outcome
        if (damage.effectKind !== 'DAMAGE') return []
        return [
          {
            level: 'level' in damage ? damage.level : null,
            order: 'order' in damage ? damage.order : 0,
            amount: 'amount' in damage ? nullableNumber(damage.amount) : null,
            dice: 'dice' in damage ? (damage.dice ?? null) : null,
            halfHitPointsDice:
              'halfHitPointsDice' in damage ? (damage.halfHitPointsDice ?? null) : null,
            multiplier: 'multiplier' in damage ? nullableNumber(damage.multiplier) : null,
            minimum: 'min' in damage ? nullableNumber(damage.min) : null,
            maximum: 'max' in damage ? nullableNumber(damage.max) : null
          }
        ]
      })
      outcomes.push({
        kind: 'DAMAGE',
        outcomeId: outcome.id,
        pathCode: entry.pathCode,
        label: nullableLabel(entry.label),
        damageTypeId: outcome.damageTypeId,
        valueKind: outcome.valueKind,
        scalingKind: outcome.scalingKind,
        scalingSource: 'scalingSource' in outcome ? outcome.scalingSource : null,
        classId: 'classId' in outcome ? outcome.classId : null,
        amountKind: outcome.amountKind ?? null,
        amountMultiplier: outcome.multiplier ?? null,
        values,
        bonuses: [...(outcome.bonuses ?? [])]
          .sort((left, right) => left.order - right.order)
          .map((bonus) => ({
            ...bonus,
            min: bonus.min ?? null,
            max: bonus.max ?? null,
            multiplier: bonus.multiplier ?? null
          }))
      })
      continue
    }
    if (outcome.effectKind === 'HEAL') {
      outcomes.push(normalizeHealOutcome(outcome, entry.pathCode, nullableLabel(entry.label)))
      continue
    }
    if (outcome.effectKind === 'CONDITION') {
      outcomes.push({
        kind: 'CONDITION',
        pathCode: entry.pathCode,
        conditionId: outcome.conditionId
      })
      continue
    }
    if (outcome.effectKind === 'SPELL_SLOT_EXCHANGE') {
      outcomes.push({
        kind: 'SPELL_SLOT_EXCHANGE',
        pathCode: entry.pathCode,
        exchange: outcome,
        label: nullableLabel(entry.label)
      })
      continue
    }
    outcomes.push({
      kind: 'EFFECT',
      pathCode: entry.pathCode,
      effectKind: outcome.effectKind,
      ...(entry.resolutionKind === 'ROLL_TABLE' && { onRollTableRow: true as const }),
      ...(outcome.effectKind === 'MOVEMENT_RULE' ? { ruleKind: outcome.ruleKind } : {}),
      ...(outcome.effectKind === 'END_EFFECTS'
        ? {
            endEffects: {
              scope: outcome.scope,
              selectors: outcome.selectors.map((selector) => {
                if (selector.kind === 'CONDITION')
                  return { ...selector, conditionIds: [...selector.conditionIds] }
                if (selector.kind === 'SAME_EFFECT')
                  return { kind: selector.kind, effectId: effect.id }
                return { ...selector }
              }),
              ...(outcome.originCreatureTypeIds?.length
                ? { originCreatureTypeIds: [...outcome.originCreatureTypeIds] }
                : {}),
              ...(outcome.levelCheck ? { levelCheck: { ...outcome.levelCheck } } : {})
            }
          }
        : {}),
      label: nullableLabel(entry.label) ?? nullableLabel('label' in outcome ? outcome.label : null)
    })
  }

  return {
    invocation: normalizeInvocation(
      effect.invocation,
      zoneEntrySavingThrow(effect) ?? followUpSaveSavingThrow(effect)
    ),
    outcomes
  }
}

/** An action's item state: the item plus the grip and requirements of the effect it uses. */
function actionEquipmentState(
  item: ItemEquipmentState,
  effect: CompiledEffectGroup | CompiledEquipmentEffectGroup | CompiledFeatureEffectGroup
): ActionEquipment {
  return {
    ...item,
    // Only an item's own effects carry a grip; features granted by an item have none.
    grip: 'grip' in effect ? effect.grip : null,
    ...('requirements' in effect && effect.requirements
      ? {
          requirements: {
            id: effect.requirements.id,
            groups: effect.requirements.groups.map((group) => ({
              ...group,
              contexts: [...group.contexts]
            }))
          }
        }
      : {})
  }
}

/**
 * A Feature attack made with one wielded weapon (D156): the Feature's activation, targeting and
 * area, with the weapon's outcomes followed by the Feature's own. Its range is the weapon's, held
 * to the Feature's own distance when it authors one (Whirlwind Attack's 5 feet with a reach
 * weapon); a Feature that reaches as far as the weapon does (Volley) authors a SPECIAL range.
 */
function wieldedWeaponAttackEffect(
  feature: CompiledFeatureEffectGroup,
  weapon: CompiledEffectGroup
): CompiledEffectGroup {
  const { weaponAttack: _weaponAttack, ...effect } = feature
  const held = feature.invocation.range
  const own = weapon.invocation.range
  const range =
    held.rangeKind !== 'DISTANCE' ||
    (own.rangeKind === 'DISTANCE' && own.unit === held.unit && own.amount <= held.amount)
      ? own
      : held
  return {
    ...effect,
    invocation: { ...feature.invocation, range },
    entries: [...weapon.entries, ...feature.entries]
  }
}

function activationCode(effect: CompiledEffectGroup): string | undefined {
  return 'activation' in effect.invocation ? effect.invocation.activation?.code : undefined
}

function appendActions(params: {
  candidates: ActionCandidate[]
  entryPoints: CharacterActionRuleEntryPoint[]
  effects:
    | readonly (CompiledEffectGroup | CompiledEquipmentEffectGroup | CompiledFeatureEffectGroup)[]
    | undefined
  source: { sourceId: string; mechanicSource: CharacterActionSource }
  label: string
  mechanicsOwner: CharacterActionMechanicsOwner
  activationSourceKind: ActionCandidate['activationSourceKind']
  equipment: ItemEquipmentState | null
  resourcePoolCandidates: readonly ResourcePoolCandidate[]
  /** Passive Feature damage that rides on the attacks of this source. */
  onHitRiders?: readonly OnHitRider[]
  /** Where this source's passive zones go; absent for a source that keeps none. */
  passiveZones?: CharacterActionSources
  /** Where this source's initiative restores go; absent for a source that keeps none. */
  initiativeRestores?: InitiativeRestoreSource[]
  /** Where this source's standing effects go; absent for a source that keeps none. */
  standingEffects?: CharacterActionSources
  /** Where this source's standing offers go; absent for a source that keeps none. */
  standingGrantedActions?: HeldGrantedAction[]
  /** The weapons a Feature attack with the wielded weapons is made with; absent for an item. */
  wieldedWeaponAttacks?: WieldedWeaponAttacks
}): void {
  const append = (
    sink: CharacterActionSources,
    action: {
      effect: CompiledEffectGroup
      identity: string
      label: string
      activationSourceKind: ActionCandidate['activationSourceKind']
      equipment: ActionEquipment | null
      onHitRiders: readonly OnHitRider[]
    }
  ) => {
    const effect = reduceEffectRestrictions(
      mergeOnHitRiders(action.effect, action.onHitRiders, params.source.sourceId),
      dnd5eAttackingItem(action.equipment)
    )
    const resourceUse =
      effect.invocation.kind === 'PASSIVE' ? undefined : effect.invocation.resourceUse
    const mechanicSource = params.source.mechanicSource
    const matchingPools = resourceUse
      ? mechanicSource.kind === 'EQUIPMENT_INSTANCE'
        ? params.resourcePoolCandidates.filter(
            (pool) =>
              pool.ownerKind === 'ITEM_INSTANCE' &&
              pool.itemInstanceId === mechanicSource.itemInstanceId &&
              pool.chargeId === resourceUse.chargeId
          )
        : (() => {
            const sourceMatches = params.resourcePoolCandidates.filter(
              (pool) =>
                pool.ownerKind === 'AUTHORED_SOURCE' &&
                pool.sourceId === params.source.sourceId &&
                pool.chargeId === resourceUse.chargeId
            )
            if (sourceMatches.length > 0) return sourceMatches
            return params.resourcePoolCandidates.filter(
              (pool) =>
                pool.ownerKind === 'AUTHORED_GRANT' &&
                pool.chargeId === resourceUse.chargeId &&
                pool.activeSourceLevel >= pool.availableAtLevel
            )
          })()
      : []
    const candidate = {
      sequence: sink.candidates.length,
      actionId: actionId(params.source.sourceId, action.identity),
      label: action.label,
      effectId: effect.id,
      sourceId: params.source.sourceId,
      source: params.source.mechanicSource,
      mechanicsOwner: params.mechanicsOwner,
      activationSourceKind: action.activationSourceKind,
      equipment: action.equipment,
      resourceUse: resourceUse
        ? {
            chargeId: resourceUse.chargeId,
            cost: resourceUse.cost,
            poolId: matchingPools.length === 1 ? matchingPools[0]!.poolId : null
          }
        : null,
      mechanicFacts: normalizeCharacterActionMechanicFacts(effect)
    }
    sink.candidates.push(candidate)
    sink.entryPoints.push({
      actionId: candidate.actionId,
      effectId: candidate.effectId,
      sourceId: candidate.sourceId,
      source: candidate.source,
      mechanicsOwner: candidate.mechanicsOwner,
      activationSourceKind: candidate.activationSourceKind,
      compiledEffect: effect
    })
  }

  for (const authoredEffect of params.effects ?? []) {
    const passive = authoredEffect.invocation.kind === 'PASSIVE'
    if (params.initiativeRestores) {
      const restores = initiativeRestoreSources(authoredEffect)
      if (restores.length > 0) {
        params.initiativeRestores.push(...restores)
        continue
      }
    }
    if (params.standingGrantedActions) {
      const offers = compiledStandingGrantedActions(authoredEffect)
      if (offers.length > 0) {
        params.standingGrantedActions.push(...offers)
        continue
      }
    }
    const standing = standingEffectReturnsOn(authoredEffect) !== null
    const sink = standing
      ? params.standingEffects
      : passive
        ? params.passiveZones
        : { candidates: params.candidates, entryPoints: params.entryPoints }
    if (!sink || (passive && !standing && !placedSpaceEntries(authoredEffect))) continue
    if ('weaponAttack' in authoredEffect && authoredEffect.weaponAttack) {
      // One action per weapon attack of the effect's trigger and activation (an Attack action
      // feature never takes a weapon's bonus-action off-hand attack) that a weapon with every
      // required property makes; it is offered while both the Feature and that weapon are (D156).
      const { requiredPropertyCodes = [] } = authoredEffect.weaponAttack
      for (const weapon of params.wieldedWeaponAttacks?.weapons ?? []) {
        if (
          weapon.effect.invocation.triggerCode !== authoredEffect.invocation.triggerCode ||
          activationCode(weapon.effect) !== activationCode(authoredEffect) ||
          !requiredPropertyCodes.every((code) => weapon.equipment.properties?.includes(code))
        )
          continue
        append(sink, {
          effect: wieldedWeaponAttackEffect(authoredEffect, weapon.effect),
          // Hashed to the length of an effect id, so it fits wherever the Feature's own action does.
          identity: sha256Hex(
            `${authoredEffect.id}:${weapon.equipment.itemInstanceId}:${weapon.effect.id}`
          ).slice(0, 32),
          label: `${params.label} (${weapon.label})`,
          activationSourceKind: 'ACTIVE_SOURCE_AND_EQUIPMENT',
          equipment: actionEquipmentState(weapon.equipment, weapon.effect),
          onHitRiders: params.wieldedWeaponAttacks?.onHitRiders ?? []
        })
      }
      continue
    }
    append(sink, {
      effect: authoredEffect,
      identity: authoredEffect.id,
      label: params.label,
      activationSourceKind: params.activationSourceKind,
      equipment: params.equipment && actionEquipmentState(params.equipment, authoredEffect),
      onHitRiders: params.onHitRiders ?? []
    })
  }
}

export function buildCharacterActionRuleFacts(params: {
  snapshot: CharacterBuildSnapshot
  registry: CharacterAssemblyRegistry
  grantFoldFacts: CharacterGrantFoldInput
  resourcePoolCandidates: readonly ResourcePoolCandidate[]
}): CharacterActionRuleFacts {
  const { snapshot, registry, grantFoldFacts } = params
  const actionCandidates: ActionCandidate[] = []
  const entryPoints: CharacterActionRuleEntryPoint[] = []
  const onHitRiders: OnHitRider[] = []
  const passiveZones: CharacterActionSources = { candidates: [], entryPoints: [] }
  const initiativeRestores: InitiativeRestoreSource[] = []
  const standingEffects: CharacterActionSources = { candidates: [], entryPoints: [] }
  const standingGrantedActions: HeldGrantedAction[] = []
  const castModifiers: CastModifierSource[] = []
  const sparesCreatures: SparesCreaturesSource[] = []
  // Feature actions are appended once every rider is known, since an attack a Feature makes with
  // a wielded weapon carries them (D156).
  const featureActions: Pick<
    Parameters<typeof appendActions>[0],
    'effects' | 'source' | 'label' | 'mechanicsOwner'
  >[] = []
  for (const [index, feature] of snapshot.features.entries()) {
    const definition = registry.features[feature.featureId]
    const folded = grantFoldFacts.features[index]
    if (!folded) continue
    if (definition && folded.definition) {
      onHitRiders.push(
        ...collectOnHitRiders(definition.effects, feature.featureId, definition.label)
      )
      castModifiers.push(...collectCastModifiers(definition.effects, definition.label ?? ''))
      sparesCreatures.push(...collectSparesCreatures(definition.effects))
      featureActions.push({
        effects: definition.effects,
        source: folded.definition,
        label: definition.label ?? 'Feature action',
        mechanicsOwner: { kind: 'FEATURE', id: feature.featureId }
      })
    }
    const selected = getCharacterGrantFoldSelectedOptionIds(feature)
    for (const option of definition?.options ?? []) {
      if (!selected.has(option.id)) continue
      const source = folded.selectedOptions.find(
        (candidate) =>
          candidate.mechanicSource.kind === 'AUTHORED' &&
          candidate.mechanicSource.definitionId === option.id
      )
      if (!source) continue
      onHitRiders.push(
        ...collectOnHitRiders(option.effects, option.id, option.label || definition?.label)
      )
      castModifiers.push(...collectCastModifiers(option.effects, option.label ?? ''))
      sparesCreatures.push(...collectSparesCreatures(option.effects))
      featureActions.push({
        effects: option.effects,
        source,
        label: option.label ?? 'Feature option action',
        mechanicsOwner: { kind: 'FEATURE_OPTION', id: option.id }
      })
    }
    if (feature.source.kind === 'FEAT' && folded.featDefinition) {
      onHitRiders.push(
        ...collectOnHitRiders(
          registry.feats[feature.source.featId]?.effects,
          feature.source.featId,
          registry.feats[feature.source.featId]?.label
        )
      )
      castModifiers.push(
        ...collectCastModifiers(
          registry.feats[feature.source.featId]?.effects,
          registry.feats[feature.source.featId]?.label ?? ''
        )
      )
      sparesCreatures.push(
        ...collectSparesCreatures(registry.feats[feature.source.featId]?.effects)
      )
      featureActions.push({
        effects: registry.feats[feature.source.featId]?.effects,
        source: folded.featDefinition,
        label: registry.feats[feature.source.featId]?.label ?? 'Feat action',
        mechanicsOwner: { kind: 'FEAT', id: feature.source.featId }
      })
    }
  }

  const items = snapshot.equipmentItems.flatMap((item, itemIndex) => {
    const folded = grantFoldFacts.equipmentItems[itemIndex]
    if (!folded) return []
    const rootRequirements = sourceStateRequirements(folded.restrictions)
    const rootEquipment: ItemEquipmentState = {
      itemInstanceId: item.instanceId,
      equipmentId: item.contentRef.definitionId,
      parentEquipmentIds: compiledEquipmentParentIds(item.compiledItem),
      category: item.compiledItem.category ?? null,
      properties: [...(item.compiledItem.properties ?? [])],
      equipped: Boolean(item.equippedState),
      attuned: item.attuned,
      requiresAttunement: folded.requiresAttunement,
      consumedOnUse: item.compiledItem.attributes?.includes('CONSUMED_ON_USE') ?? false,
      ...(item.degradation === undefined ? {} : { degradation: item.degradation }),
      ...ammunitionState(item.compiledItem.ammunitionEquipmentId, snapshot.equipmentItems),
      otherWeaponEquipped: snapshot.equipmentItems.some(
        (other) =>
          other.instanceId !== item.instanceId &&
          Boolean(other.equippedState) &&
          other.compiledItem.category === 'WEAPON'
      ),
      ...rootRequirements
    }
    return [{ item, folded, rootRequirements, rootEquipment }]
  })
  const wieldedWeaponAttacks: WieldedWeaponAttacks = {
    weapons: items.flatMap(({ item, rootEquipment }) =>
      (item.compiledItem.effects ?? []).flatMap((effect) =>
        effect.grip === null
          ? []
          : [{ equipment: rootEquipment, effect, label: item.compiledItem.label ?? 'Weapon' }]
      )
    ),
    onHitRiders
  }

  for (const action of featureActions)
    appendActions({
      candidates: actionCandidates,
      entryPoints,
      ...action,
      activationSourceKind: 'ACTIVE_SOURCE',
      equipment: null,
      resourcePoolCandidates: params.resourcePoolCandidates,
      passiveZones,
      initiativeRestores,
      standingEffects,
      standingGrantedActions,
      wieldedWeaponAttacks
    })

  for (const { item, folded, rootRequirements, rootEquipment } of items) {
    const rootSource = {
      sourceId: folded.rootSourceId,
      mechanicSource: {
        kind: 'EQUIPMENT_INSTANCE' as const,
        equipmentId: folded.equipmentId,
        itemInstanceId: folded.instanceId
      }
    }
    appendActions({
      candidates: actionCandidates,
      entryPoints,
      effects: item.compiledItem.effects,
      source: rootSource,
      label: item.compiledItem.label ?? 'Equipment action',
      mechanicsOwner: { kind: 'EQUIPMENT', id: item.compiledItem.id },
      activationSourceKind: 'ACTIVE_EQUIPMENT',
      equipment: rootEquipment,
      resourcePoolCandidates: params.resourcePoolCandidates,
      onHitRiders
    })
    for (const [featureIndex, feature] of (item.compiledItem.features ?? []).entries()) {
      const nested = folded.features[featureIndex]?.source
      if (!nested) continue
      const requirements = sourceStateRequirements(nested.restrictions)
      appendActions({
        candidates: actionCandidates,
        entryPoints,
        effects: feature.effects,
        source: nested,
        label: feature.label ?? 'Feature action',
        mechanicsOwner: { kind: 'FEATURE', id: feature.id },
        activationSourceKind: 'ACTIVE_SOURCE',
        equipment: {
          ...rootEquipment,
          requiresEquipped: rootRequirements.requiresEquipped || requirements.requiresEquipped,
          requiresAttuned: rootRequirements.requiresAttuned || requirements.requiresAttuned
        },
        resourcePoolCandidates: params.resourcePoolCandidates,
        wieldedWeaponAttacks
      })
    }
  }

  return {
    actionCandidates,
    entryPoints,
    passiveZones,
    initiativeRestores,
    standingEffects,
    standingGrantedActions,
    castModifiers,
    sparesCreatures,
    onHitRiders
  }
}

type CompiledOutcome = CompiledEffectEntry['outcome']
type Targeting = NonNullable<CompiledEffectGroup['invocation']['targeting']>

function targetingReadsSpellCastLevel(targeting: Targeting | undefined): boolean {
  switch (targeting?.selectionKind) {
    case 'CHOSEN_CREATURES':
      return targeting.maxTargetsScaling?.scalingSource === 'SPELL_CAST_LEVEL'
    case 'AREA_CONTENTS':
      return targeting.hitPointPoolScaling?.scalingSource === 'SPELL_CAST_LEVEL'
    default:
      return false
  }
}

function branchReadsSpellCastLevel(
  branch: Extract<CompiledOutcome, { effectKind: 'FOLLOW_UP_SAVE' }>['onFailure'] | undefined
): boolean {
  return branch?.kind === 'OUTCOMES' && branch.outcomes.some(outcomeReadsSpellCastLevel)
}

function outcomeReadsSpellCastLevel(outcome: CompiledOutcome): boolean {
  switch (outcome.effectKind) {
    case 'DAMAGE':
    case 'HEAL':
      return 'scalingSource' in outcome && outcome.scalingSource === 'SPELL_CAST_LEVEL'
    case 'APPLY_GRANT':
      return (outcome.grants.modifiers ?? []).some(
        (modifier) =>
          typeof modifier.payload === 'object' &&
          modifier.payload !== null &&
          'valueKind' in modifier.payload &&
          modifier.payload.valueKind === 'SPELL_SLOT_LEVEL'
      )
    case 'CANCEL_TRIGGERING_EVENT':
      return true
    case 'FOLLOW_UP_SAVE':
      return [outcome.onSuccess, outcome.onFailure, outcome.onDurationComplete].some(
        branchReadsSpellCastLevel
      )
    case 'FOLLOW_UP_CHECK':
      return [outcome.onSuccess, outcome.onFailure].some(branchReadsSpellCastLevel)
    case 'MANIFEST':
      return [
        ...('behaviors' in outcome ? (outcome.behaviors ?? []) : []),
        ...('components' in outcome ? (outcome.components ?? []) : []).flatMap(
          (component) => component.behaviors ?? []
        ),
        ...('proximityRule' in outcome && outcome.proximityRule
          ? [outcome.proximityRule.behavior]
          : [])
      ].some(effectReadsSpellCastLevel)
    default:
      return false
  }
}

/**
 * Whether casting the Effect at a higher level changes it: a result scaled by the cast level (damage,
 * healing, targets, a granted amount, in a follow-up save branch, a manifest's behaviors or the
 * Effect a repeat offer re-runs too) or one compared with it (Counterspell's slot-versus-spell check).
 */
export function effectReadsSpellCastLevel(effect: CompiledEffectGroup): boolean {
  return (
    targetingReadsSpellCastLevel(effect.invocation.targeting) ||
    effect.entries.some(
      (entry) =>
        'outcome' in entry &&
        (targetingReadsSpellCastLevel(entry.targetingOverride) ||
          outcomeReadsSpellCastLevel(entry.outcome) ||
          (entry.lifecycle?.effectOffers ?? []).some(
            (offer) =>
              // A repeat of the Effect's own paths is read above; a sibling Effect is read here.
              offer.kind === 'REPEAT_SOURCE_PATH' &&
              offer.effect.id !== effect.id &&
              effectReadsSpellCastLevel(compileEffect(offer.effect))
          ))
    )
  )
}
