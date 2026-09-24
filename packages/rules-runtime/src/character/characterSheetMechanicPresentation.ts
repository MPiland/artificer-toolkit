import type { CharacterBuilderResolution } from './builderTypes.js'
import type { CharacterRuleActionPresentationReferences } from './characterRuleActionProjection.js'

export interface CharacterSheetMechanicOwner {
  description?: string | null
  id: string
  kind: 'EQUIPMENT' | 'FEATURE' | 'FEATURE_OPTION' | 'FEAT' | 'SPELL'
  label: string
}

interface FeaturePresentationSource {
  attributes?: readonly string[]
  description?: string
  id: string
  label: string
  options?: readonly FeaturePresentationSource[]
}

function ownerKey(owner: Pick<CharacterSheetMechanicOwner, 'id' | 'kind'>): string {
  return `${owner.kind}:${owner.id}`
}

export interface CharacterSheetMechanicPresentationSources {
  actionReferences: CharacterRuleActionPresentationReferences
  hiddenOwnerKeys: ReadonlySet<string>
  ownersByKey: ReadonlyMap<string, CharacterSheetMechanicOwner>
}

export function createCharacterSheetMechanicPresentationSources(
  resolution: CharacterBuilderResolution
): CharacterSheetMechanicPresentationSources {
  const ownersByKey = new Map<string, CharacterSheetMechanicOwner>()
  const hiddenOwnerKeys = new Set<string>()
  const addOwner = (owner: CharacterSheetMechanicOwner, attributes?: readonly string[]) => {
    const key = ownerKey(owner)
    const existing = ownersByKey.get(key)
    if (
      existing &&
      (existing.label !== owner.label || existing.description !== owner.description)
    ) {
      throw new Error(`Character Sheet has conflicting presentation data for "${key}".`)
    }
    ownersByKey.set(key, owner)
    if (attributes?.includes('HIDDEN_ON_SHEET')) hiddenOwnerKeys.add(key)
  }
  const addFeatures = (features: readonly FeaturePresentationSource[] | undefined) => {
    for (const feature of features ?? []) {
      addOwner(
        {
          kind: 'FEATURE',
          id: feature.id,
          label: feature.label,
          description: feature.description
        },
        feature.attributes
      )
      for (const option of feature.options ?? []) {
        addOwner(
          {
            kind: 'FEATURE_OPTION',
            id: option.id,
            label: option.label,
            description: option.description
          },
          option.attributes
        )
      }
    }
  }

  addFeatures(resolution.registry.features)
  for (const race of resolution.registry.races) {
    addFeatures(race.features)
    for (const option of race.ancestry?.options ?? []) addFeatures(option.features)
  }
  for (const classRecord of resolution.registry.classes) addFeatures(classRecord.features)
  for (const background of resolution.registry.backgrounds) addFeatures(background.features)
  for (const feat of resolution.registry.feats ?? []) {
    addOwner({ kind: 'FEAT', id: feat.id, label: feat.label, description: feat.description })
    addFeatures(feat.features)
  }
  for (const equipment of resolution.registry.equipment) {
    addOwner(
      {
        kind: 'EQUIPMENT',
        id: equipment.id,
        label: equipment.label,
        description: equipment.description
      },
      equipment.attributes
    )
    addFeatures(equipment.features)
  }
  for (const spell of resolution.catalog.spells) {
    addOwner({ kind: 'SPELL', id: spell.id, label: spell.label, description: spell.description })
  }

  return {
    ownersByKey,
    hiddenOwnerKeys,
    actionReferences: {
      damageLabels: new Map(
        (resolution.registry.system?.damageTypes ?? []).map((damageType) => [
          damageType.id,
          damageType.label
        ])
      ),
      conditionLabels: new Map(
        (resolution.registry.system?.conditionTypes ?? []).map((conditionType) => [
          conditionType.id,
          conditionType.label
        ])
      )
    }
  }
}
