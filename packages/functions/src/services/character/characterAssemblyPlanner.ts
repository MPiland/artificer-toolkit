import type { CharacterAssemblyStructureQueryResult } from '@artificer-toolkit/db'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

export interface CharacterAssemblyPlan {
  activeFeatureIds: ReadonlySet<string>
  selectedFeatureOptionIds: ReadonlySet<string>
}

export function planCharacterAssembly(params: {
  character: CharacterAuthored
  structure: CharacterAssemblyStructureQueryResult
  selectedFeatIds: ReadonlySet<string>
}): CharacterAssemblyPlan {
  const { character, structure } = params
  const totalLevel = character.intent.classes.reduce(
    (sum, classIntent) => sum + classIntent.classLevel,
    0
  )
  const selectedSourceLevel = Math.max(totalLevel, 1)
  const classLevels = new Map<string, number>()
  for (const classIntent of character.intent.classes) {
    classLevels.set(classIntent.classId, classIntent.classLevel)
    if (classIntent.subclassId) classLevels.set(classIntent.subclassId, classIntent.classLevel)
  }
  const selectedRaceIds = new Set(
    [character.intent.race.raceId, character.intent.race.subraceId].filter((id): id is string =>
      Boolean(id)
    )
  )
  const selectedBackgroundId = character.intent.background.backgroundId
  const ownedEquipmentIds = new Set(
    character.state.equipment.inventory.map((item) => item.equipmentId)
  )
  const selectedAncestryOptionIds = new Set(
    (character.intent.ancestrySelections ?? []).map((selection) => selection.optionId)
  )
  const activeFeatureIds = new Set<string>()

  for (const link of structure.rootFeatureLinks) {
    let activeLevel: number | undefined
    switch (link.ownerKind) {
      case 'CLASS':
        activeLevel = classLevels.get(link.ownerId)
        break
      case 'RACE':
        activeLevel = selectedRaceIds.has(link.ownerId) ? selectedSourceLevel : undefined
        break
      case 'BACKGROUND':
        activeLevel = link.ownerId === selectedBackgroundId ? selectedSourceLevel : undefined
        break
      case 'FEAT':
        activeLevel = params.selectedFeatIds.has(link.ownerId) ? selectedSourceLevel : undefined
        break
      case 'EQUIPMENT':
        activeLevel = ownedEquipmentIds.has(link.ownerId) ? selectedSourceLevel : undefined
        break
    }

    if (activeLevel !== undefined && activeLevel >= (link.availableAtLevel ?? 1)) {
      activeFeatureIds.add(link.featureId)
    }
  }

  for (const ancestryOption of structure.ancestryOptions) {
    if (
      !selectedRaceIds.has(ancestryOption.raceId) ||
      !selectedAncestryOptionIds.has(ancestryOption.ancestryOptionId)
    ) {
      continue
    }
    for (const link of ancestryOption.featureLinks) {
      if (selectedSourceLevel >= (link.availableAtLevel ?? 1)) activeFeatureIds.add(link.featureId)
    }
  }

  const activeAcquisitions = character.intent.featureAcquisitions.filter((acquisition) => {
    switch (acquisition.timing.kind) {
      case 'IMMEDIATE':
        return true
      case 'CHARACTER_LEVEL':
        return totalLevel >= acquisition.timing.level
      case 'CLASS_LEVEL':
        return (classLevels.get(acquisition.timing.classId) ?? 0) >= acquisition.timing.classLevel
    }
  })
  for (const acquisition of activeAcquisitions) activeFeatureIds.add(acquisition.featureId)

  const optionIdsByFeatureId = new Map<string, Set<string>>()
  for (const option of structure.featureOptions) {
    const optionIds = optionIdsByFeatureId.get(option.featureId) ?? new Set<string>()
    optionIds.add(option.optionId)
    optionIdsByFeatureId.set(option.featureId, optionIds)
  }
  const selectedFeatureOptionIds = new Set<string>()
  for (const acquisition of activeAcquisitions) {
    const authoredOptionIds = optionIdsByFeatureId.get(acquisition.featureId)
    for (const selection of acquisition.selections ?? []) {
      if (selection.selectionKey !== 'options') continue
      for (const value of selection.values) {
        const optionIds = value.kind === 'ID' ? [value.id] : value.kind === 'IDS' ? value.ids : []
        for (const optionId of optionIds) {
          if (!authoredOptionIds || authoredOptionIds.has(optionId)) {
            selectedFeatureOptionIds.add(optionId)
          }
        }
      }
    }
  }

  return { activeFeatureIds, selectedFeatureOptionIds }
}
