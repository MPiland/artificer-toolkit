import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterActionRuleEntryPoint } from '@artificer-toolkit/schema/api/characterActionRules'
import type { CharacterGrantFoldInput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import type { CompiledEquipmentEffectGroup } from '@artificer-toolkit/shared/subjects/compilers'
import type {
  CharacterAssemblyRegistry,
  CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'

import {
  compiledEquipmentParentIds,
  getCharacterGrantFoldSelectedOptionIds
} from './characterGrantFoldSourceFacts.js'
import { collectOnHitRiders, mergeOnHitRiders, type OnHitRider } from './characterOnHitRiders.js'
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

interface CharacterActionRuleFacts {
  actionCandidates: ActionCandidate[]
  entryPoints: CharacterActionRuleEntryPoint[]
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
  const [entry] = effect.entries
  const outcome = effect.entries.length === 1 && entry && 'outcome' in entry ? entry.outcome : null
  if (
    outcome?.effectKind !== 'MANIFEST' ||
    outcome.manifestKind !== 'ZONE' ||
    (outcome.attachmentKind !== 'PLACED_SPACE' && outcome.attachmentKind !== 'SOURCE')
  )
    return undefined
  const invocation = outcome.components?.[0]?.behaviors?.[0]?.invocation
  return invocation && 'savingThrow' in invocation ? invocation.savingThrow : undefined
}

function normalizeInvocation(
  invocation: CompiledEffectGroup['invocation'],
  zoneSavingThrow: ReturnType<typeof zoneEntrySavingThrow>
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
    outcomes.push({
      kind: 'EFFECT',
      pathCode: entry.pathCode,
      effectKind: outcome.effectKind,
      ...(outcome.effectKind === 'MOVEMENT_RULE' ? { ruleKind: outcome.ruleKind } : {}),
      label: nullableLabel(entry.label) ?? nullableLabel('label' in outcome ? outcome.label : null)
    })
  }

  return {
    invocation: normalizeInvocation(effect.invocation, zoneEntrySavingThrow(effect)),
    outcomes
  }
}

function appendActions(params: {
  candidates: ActionCandidate[]
  entryPoints: CharacterActionRuleEntryPoint[]
  effects: readonly (CompiledEffectGroup | CompiledEquipmentEffectGroup)[] | undefined
  source: { sourceId: string; mechanicSource: CharacterActionSource }
  label: string
  mechanicsOwner: CharacterActionMechanicsOwner
  activationSourceKind: ActionCandidate['activationSourceKind']
  equipment: Omit<NonNullable<ActionCandidate['equipment']>, 'grip' | 'requirements'> | null
  resourcePoolCandidates: readonly ResourcePoolCandidate[]
  /** Passive Feature damage that rides on the attacks of this source. */
  onHitRiders?: readonly OnHitRider[]
}): void {
  for (const authoredEffect of params.effects ?? []) {
    if (authoredEffect.invocation.kind === 'PASSIVE') continue
    // Only an item's own effects carry a grip; features granted by an item have none.
    const equipment = params.equipment && {
      ...params.equipment,
      grip: 'grip' in authoredEffect ? authoredEffect.grip : null,
      ...('requirements' in authoredEffect && authoredEffect.requirements
        ? {
            requirements: {
              id: authoredEffect.requirements.id,
              groups: authoredEffect.requirements.groups.map((group) => ({
                ...group,
                contexts: [...group.contexts]
              }))
            }
          }
        : {})
    }
    const effect = reduceEffectRestrictions(
      mergeOnHitRiders(authoredEffect, params.onHitRiders ?? []),
      dnd5eAttackingItem(equipment)
    )
    const resourceUse = authoredEffect.invocation.resourceUse
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
      sequence: params.candidates.length,
      actionId: actionId(params.source.sourceId, effect.id),
      label: params.label,
      effectId: effect.id,
      sourceId: params.source.sourceId,
      source: params.source.mechanicSource,
      mechanicsOwner: params.mechanicsOwner,
      activationSourceKind: params.activationSourceKind,
      equipment,
      resourceUse: resourceUse
        ? {
            chargeId: resourceUse.chargeId,
            cost: resourceUse.cost,
            poolId: matchingPools.length === 1 ? matchingPools[0]!.poolId : null
          }
        : null,
      mechanicFacts: normalizeCharacterActionMechanicFacts(effect)
    }
    params.candidates.push(candidate)
    params.entryPoints.push({
      actionId: candidate.actionId,
      effectId: candidate.effectId,
      sourceId: candidate.sourceId,
      source: candidate.source,
      mechanicsOwner: candidate.mechanicsOwner,
      activationSourceKind: candidate.activationSourceKind,
      compiledEffect: effect
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
  for (const [index, feature] of snapshot.features.entries()) {
    const definition = registry.features[feature.featureId]
    const folded = grantFoldFacts.features[index]
    if (!folded) continue
    if (definition && folded.definition) {
      onHitRiders.push(...collectOnHitRiders(definition.effects, feature.featureId))
      appendActions({
        candidates: actionCandidates,
        entryPoints,
        effects: definition.effects,
        source: folded.definition,
        label: definition.label ?? 'Feature action',
        mechanicsOwner: { kind: 'FEATURE', id: feature.featureId },
        activationSourceKind: 'ACTIVE_SOURCE',
        equipment: null,
        resourcePoolCandidates: params.resourcePoolCandidates
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
      onHitRiders.push(...collectOnHitRiders(option.effects, option.id))
      appendActions({
        candidates: actionCandidates,
        entryPoints,
        effects: option.effects,
        source,
        label: option.label ?? 'Feature option action',
        mechanicsOwner: { kind: 'FEATURE_OPTION', id: option.id },
        activationSourceKind: 'ACTIVE_SOURCE',
        equipment: null,
        resourcePoolCandidates: params.resourcePoolCandidates
      })
    }
    if (feature.source.kind === 'FEAT' && folded.featDefinition) {
      onHitRiders.push(
        ...collectOnHitRiders(registry.feats[feature.source.featId]?.effects, feature.source.featId)
      )
      appendActions({
        candidates: actionCandidates,
        entryPoints,
        effects: registry.feats[feature.source.featId]?.effects,
        source: folded.featDefinition,
        label: registry.feats[feature.source.featId]?.label ?? 'Feat action',
        mechanicsOwner: { kind: 'FEAT', id: feature.source.featId },
        activationSourceKind: 'ACTIVE_SOURCE',
        equipment: null,
        resourcePoolCandidates: params.resourcePoolCandidates
      })
    }
  }

  for (const [itemIndex, item] of snapshot.equipmentItems.entries()) {
    const folded = grantFoldFacts.equipmentItems[itemIndex]
    if (!folded) continue
    const rootRequirements = sourceStateRequirements(folded.restrictions)
    const rootEquipment = {
      itemInstanceId: item.instanceId,
      equipmentId: item.contentRef.definitionId,
      parentEquipmentIds: compiledEquipmentParentIds(item.compiledItem),
      category: item.compiledItem.category ?? null,
      properties: [...(item.compiledItem.properties ?? [])],
      equipped: Boolean(item.equippedState),
      attuned: item.attuned,
      requiresAttunement: folded.requiresAttunement,
      consumedOnUse: item.compiledItem.attributes?.includes('CONSUMED_ON_USE') ?? false,
      otherWeaponEquipped: snapshot.equipmentItems.some(
        (other) =>
          other.instanceId !== item.instanceId &&
          Boolean(other.equippedState) &&
          other.compiledItem.category === 'WEAPON'
      ),
      ...rootRequirements
    }
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
        resourcePoolCandidates: params.resourcePoolCandidates
      })
    }
  }

  return { actionCandidates, entryPoints }
}

type CompiledOutcome = CompiledEffectEntry['outcome']
type Targeting = NonNullable<CompiledEffectGroup['invocation']['targeting']>

function targetingReadsSpellCastLevel(targeting: Targeting | undefined): boolean {
  return (
    targeting?.selectionKind === 'CHOSEN_CREATURES' &&
    targeting.maxTargetsScaling?.scalingSource === 'SPELL_CAST_LEVEL'
  )
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
 * healing, targets, a granted amount, in a follow-up save branch or a manifest's behaviors too) or one
 * compared with it (Counterspell's slot-versus-spell check).
 */
export function effectReadsSpellCastLevel(effect: CompiledEffectGroup): boolean {
  return (
    targetingReadsSpellCastLevel(effect.invocation.targeting) ||
    effect.entries.some(
      (entry) =>
        'outcome' in entry &&
        (targetingReadsSpellCastLevel(entry.targetingOverride) ||
          outcomeReadsSpellCastLevel(entry.outcome))
    )
  )
}
