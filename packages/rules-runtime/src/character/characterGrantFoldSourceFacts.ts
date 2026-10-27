import type {
  CharacterGrantFoldInput,
  CharacterGrantFoldSource
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import { createCharacterMechanicSourceKey } from '@artificer-toolkit/shared/character'
import type {
  CompiledFeatGrant,
  CompiledGrantTarget,
  CompiledModifierGrant,
  CompiledProficiencyGrant,
  CompiledScalingGrant,
  CompiledSenseGrant,
  CompiledSpellGrant
} from '@artificer-toolkit/shared/compilers'
import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  PROFICIENCY_KIND,
  SCALING,
  type CharacterBuildSnapshot,
  type GrantKind
} from '@artificer-toolkit/shared/core'
import type { FacetAuthored } from '@artificer-toolkit/shared/authored'
import {
  getCharacterProvenanceIdentityKey,
  type CharacterProvenance
} from '@artificer-toolkit/shared/subjects/authored'

import { normalizeCharacterGrantRestrictions } from './characterGrantFoldRestrictionFacts.js'

type GrantBearingDefinition = {
  id?: string
  restrictions?: FacetAuthored | FacetAuthored<'CHARACTER'>
  proficiencies?: readonly CompiledProficiencyGrant[]
  senses?: readonly CompiledSenseGrant[]
  modifiers?: readonly CompiledModifierGrant[]
  feats?: readonly CompiledFeatGrant[]
  spells?: readonly CompiledSpellGrant[]
}

/** The build facts a grant source reads: its System and the grant choices made for it. */
type GrantSelectionFacts = Pick<CharacterBuildSnapshot, 'systemId' | 'chosenGrantSelections'>

type ScalingTargetKey = 'senseIds' | 'featIds' | 'spellIds'

function selectedIds<K extends ScalingTargetKey>(
  target: CompiledGrantTarget<Record<K, string[]>>,
  idKey: K
): string[] {
  return target.authoringModeKind === AUTHORING_MODE_KIND.SELECTED ? [...target[idKey]] : []
}

function chosenTargets(
  snapshot: GrantSelectionFacts,
  grantId: string,
  owner: CharacterProvenance,
  progressionLevel?: number
): string[] {
  const identity = [
    encodeURIComponent(grantId),
    progressionLevel ?? 'root',
    encodeURIComponent(getCharacterProvenanceIdentityKey(owner))
  ].join(':')
  return [
    ...(snapshot.chosenGrantSelections?.find(
      (selection) =>
        [
          encodeURIComponent(selection.grantId),
          selection.progressionLevel ?? 'root',
          encodeURIComponent(getCharacterProvenanceIdentityKey(selection.source))
        ].join(':') === identity
    )?.targetIds ?? [])
  ]
}

function proficiencyTargets(
  grant: CompiledProficiencyGrant,
  snapshot: GrantSelectionFacts,
  owner: CharacterProvenance
): string[] {
  if (grant.selectionKind === 'CHOSEN') return chosenTargets(snapshot, grant.id, owner)
  if (grant.authoringModeKind === AUTHORING_MODE_KIND.ALL) return ['*']
  switch (grant.proficiencyKind) {
    case PROFICIENCY_KIND.SKILL:
      return [...grant.skillIds]
    case PROFICIENCY_KIND.SAVE_ABILITY:
      return [...grant.abilities]
    case PROFICIENCY_KIND.LANGUAGE:
      return [...grant.languageIds]
    case PROFICIENCY_KIND.EQUIPMENT:
      return [...grant.equipmentIds]
    case PROFICIENCY_KIND.EQUIPMENT_PROPERTY:
      return [...grant.properties]
  }
}

export function buildCharacterGrantFoldProficiencyFacts(
  grants: readonly CompiledProficiencyGrant[] | undefined,
  snapshot: GrantSelectionFacts,
  owner: CharacterProvenance,
  normalizeTarget?: (kind: string, targetId: string) => string
): CharacterGrantFoldSource['proficiencies'] {
  return (grants ?? []).map((grant) => {
    const targetIds = proficiencyTargets(grant, snapshot, owner)
    return {
      grantId: grant.id,
      proficiencyKind: grant.proficiencyKind,
      targetIds,
      matchIds: targetIds.map((targetId) =>
        normalizeTarget ? normalizeTarget(grant.proficiencyKind, targetId) : targetId
      ),
      category:
        grant.proficiencyKind === PROFICIENCY_KIND.EQUIPMENT_PROPERTY
          ? (grant.category ?? null)
          : null,
      scaling: grant.level === 'DOUBLE' ? 'DOUBLE' : grant.level === 'HALF' ? 'HALF' : 'FULL'
    }
  })
}

function scalingTargets<K extends ScalingTargetKey>(
  grant: CompiledScalingGrant<GrantKind, CompiledGrantTarget<Record<K, string[]>>>,
  idKey: K,
  snapshot: GrantSelectionFacts,
  owner: CharacterProvenance
): { targetIds: string[]; levels: Array<{ level: number; targetIds: string[] }> } {
  if (grant.scalingKind === SCALING.NONE) {
    return {
      targetIds:
        grant.selectionKind === AUTHORING_SELECTION_KIND.CHOSEN
          ? chosenTargets(snapshot, grant.id, owner)
          : selectedIds(grant, idKey),
      levels: []
    }
  }
  return {
    targetIds:
      grant.selectionKind === AUTHORING_SELECTION_KIND.CHOSEN
        ? chosenTargets(snapshot, grant.id, owner)
        : [],
    levels: grant.levels.map((entry) => ({
      level: entry.level,
      targetIds:
        grant.selectionKind === AUTHORING_SELECTION_KIND.CHOSEN
          ? chosenTargets(snapshot, grant.id, owner, entry.level)
          : selectedIds(entry, idKey)
    }))
  }
}

function mechanicSource(
  snapshot: GrantSelectionFacts,
  owner: CharacterProvenance,
  definitionId: string,
  sourceInstanceId?: string
): CharacterGrantFoldSource['mechanicSource'] {
  if (owner.kind === 'MANUAL') return { kind: 'SYSTEM', systemId: snapshot.systemId }
  return {
    kind: 'AUTHORED',
    sourceKind: owner.kind,
    definitionId,
    sourceInstanceId: sourceInstanceId ?? getCharacterProvenanceIdentityKey(owner)
  }
}

export function buildCharacterGrantFoldModifierFacts(
  grants: readonly CompiledModifierGrant[] | undefined,
  normalizeProficiencyTarget?: (kind: string, targetId: string) => string
): CharacterGrantFoldSource['modifiers'] {
  return (grants ?? []).map((grant) => ({
    grantId: grant.id,
    valueDomainCode: grant.valueDomainCode,
    modifierKind: grant.modifierKind,
    scope: grant.scope,
    domain: grant.domain,
    ...(grant.payload === undefined ? {} : { payload: grant.payload }),
    restrictions: normalizeCharacterGrantRestrictions(
      grant.restrictions,
      normalizeProficiencyTarget
    ),
    scopeSpellIds: (grant.restrictions?.groups ?? [])
      .flatMap((group) => group.contexts)
      .flatMap((context) =>
        context.subject === 'SPELL' &&
        context.authoringModeKind === 'SELECTED' &&
        context.spellIds.length > 0
          ? [...context.spellIds]
          : []
      ),
    scopeResourceIds: (grant.restrictions?.groups ?? [])
      .flatMap((group) => group.contexts)
      .flatMap((context) =>
        context.subject === 'RESOURCE' &&
        context.authoringModeKind === 'SELECTED' &&
        context.resourceIds.length > 0
          ? [...context.resourceIds]
          : []
      )
  }))
}

export function buildCharacterGrantFoldSourceFacts(params: {
  definition: GrantBearingDefinition
  owner: CharacterProvenance
  definitionId: string
  sourceId?: string
  sourceInstanceId?: string
  snapshot: GrantSelectionFacts
  proficiencies?: readonly CompiledProficiencyGrant[]
  sourceState?: { carried: boolean; equipped: boolean; attuned: boolean }
  equipmentSource?: CharacterGrantFoldSource['mechanicSource']
  normalizeProficiencyTarget?: (kind: string, targetId: string) => string
}): CharacterGrantFoldSource {
  const source =
    params.equipmentSource ??
    mechanicSource(params.snapshot, params.owner, params.definitionId, params.sourceInstanceId)
  return {
    sourceId: params.sourceId ?? createCharacterMechanicSourceKey(source),
    mechanicSource: source,
    sourceState: params.sourceState ?? null,
    restrictions: normalizeCharacterGrantRestrictions(
      params.definition.restrictions,
      params.normalizeProficiencyTarget
    ),
    proficiencies: buildCharacterGrantFoldProficiencyFacts(
      params.proficiencies ?? params.definition.proficiencies,
      params.snapshot,
      params.owner,
      params.normalizeProficiencyTarget
    ),
    senses: (params.definition.senses ?? []).map((grant) => ({
      grantId: grant.id,
      scalingKind: grant.scalingKind,
      ...scalingTargets(grant, 'senseIds', params.snapshot, params.owner),
      range: grant.range
    })),
    modifiers: buildCharacterGrantFoldModifierFacts(
      params.definition.modifiers,
      params.normalizeProficiencyTarget
    ),
    feats: (params.definition.feats ?? []).map((grant) => ({
      grantId: grant.id,
      scalingKind: grant.scalingKind,
      ...scalingTargets(grant, 'featIds', params.snapshot, params.owner)
    })),
    spells: (params.definition.spells ?? []).map((grant) => ({
      grantId: grant.id,
      scalingKind: grant.scalingKind,
      ...scalingTargets(grant, 'spellIds', params.snapshot, params.owner)
    }))
  }
}

/** Variant ancestry of a Character's compiled item, nearest parent first. */
export function compiledEquipmentParentIds(
  item: CharacterBuildSnapshot['equipmentItems'][number]['compiledItem']
): string[] {
  return item.category === 'VARIANT' ? [item.parentEquipmentId] : [...item.parentEquipmentIds]
}

/**
 * The grant fold facts of a holder's Equipment, for Characters and Creatures alike (ATTACK-6.3):
 * each item is one `EQUIPMENT_INSTANCE` source whose restrictions, attunement and modifiers the
 * fold decides with its equipped and attuned state.
 */
export function buildGrantFoldEquipmentFacts(params: {
  items: readonly {
    instanceId: string
    equipmentId: string
    compiledItem: CharacterBuildSnapshot['equipmentItems'][number]['compiledItem']
    equipped: boolean
    attuned: boolean
  }[]
  snapshot: GrantSelectionFacts
  normalizeProficiencyTarget?: (kind: string, targetId: string) => string
}): {
  equipment: CharacterGrantFoldInput['base']['equipment']
  equipmentItems: CharacterGrantFoldInput['equipmentItems']
} {
  const { snapshot, normalizeProficiencyTarget } = params
  return {
    equipment: params.items.map((item) => ({
      equipmentId: item.equipmentId,
      parentEquipmentIds: compiledEquipmentParentIds(item.compiledItem),
      category: item.compiledItem.category ?? null,
      properties: [...(item.compiledItem.properties ?? [])],
      equipped: item.equipped,
      attuned: item.attuned
    })),
    equipmentItems: params.items.map((item) => {
      const source = {
        kind: 'EQUIPMENT_INSTANCE' as const,
        equipmentId: item.equipmentId,
        itemInstanceId: item.instanceId
      }
      const sourceState = { carried: true, equipped: item.equipped, attuned: item.attuned }
      const rootSource = buildCharacterGrantFoldSourceFacts({
        definition: item.compiledItem,
        owner: { kind: 'FEATURE', featureId: item.compiledItem.id },
        definitionId: item.compiledItem.id,
        snapshot,
        normalizeProficiencyTarget,
        sourceState,
        equipmentSource: source
      })
      return {
        instanceId: item.instanceId,
        equipmentId: item.equipmentId,
        requiresAttunement: Boolean(item.compiledItem.requiresAttunement),
        equipped: item.equipped,
        attuned: item.attuned,
        restrictions: normalizeCharacterGrantRestrictions(
          item.compiledItem.restrictions,
          normalizeProficiencyTarget
        ),
        rootSourceId: rootSource.sourceId,
        rootModifiers: rootSource.modifiers,
        chargeId: item.compiledItem.charges?.id ?? null,
        features: (item.compiledItem.features ?? []).map((feature) => ({
          source: buildCharacterGrantFoldSourceFacts({
            definition: feature,
            owner: { kind: 'FEATURE', featureId: feature.id },
            definitionId: feature.id,
            sourceId: `${rootSource.sourceId}:FEATURE:${encodeURIComponent(feature.id)}`,
            snapshot,
            normalizeProficiencyTarget,
            sourceState,
            equipmentSource: source
          }),
          sourceChargeUse: feature.charges
            ? {
                featureId: feature.id,
                limitKind: feature.charges.limitKind,
                cost: 'cost' in feature.charges ? feature.charges.cost : 0
              }
            : null
        }))
      }
    })
  }
}

export function getCharacterGrantFoldSelectedOptionIds(
  feature: CharacterBuildSnapshot['features'][number]
): Set<string> {
  const ids = new Set<string>()
  for (const selection of feature.selections ?? []) {
    if (selection.selectionKey !== 'options') continue
    for (const value of selection.values) {
      if (value.kind === 'ID') ids.add(value.id)
      if (value.kind === 'IDS') value.ids.forEach((id) => ids.add(id))
    }
  }
  return ids
}
