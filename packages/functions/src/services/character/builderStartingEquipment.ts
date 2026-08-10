import {
  evaluateCharacterFacet,
  type CharacterEligibilityContext,
  type EquipmentCategoryCode,
  type EquipmentPropertyCode,
  type AbilityCode
} from '@artificer-toolkit/shared/core'
import type {
  BackgroundAuthored,
  CharacterAuthored,
  ParentClassAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type { StartingEquipmentAuthored } from '@artificer-toolkit/shared/authored'
import type { CharacterBuilderCatalog } from './builderCatalog.js'
import { createCharacterBuilderEligibilityContext } from './builderEligibility.js'
import type { GrantedFeatureRecord } from './builderEligibility.js'
import type { CharacterBuilderRegistry } from './builderService.js'
import { createCharacterAssemblyRegistry } from './characterEngine.js'

export type CharacterStartingEquipmentDecision = NonNullable<
  NonNullable<CharacterAuthored['intent']['startingEquipment']>['class']
>
type StartingEquipmentItem =
  StartingEquipmentAuthored['sets'][number]['groups'][number]['options'][number]['items'][number]
type ChosenStartingEquipmentItem = StartingEquipmentItem & {
  startingEquipmentKind: 'EQUIPMENT'
  category?: EquipmentCategoryCode
  properties?: EquipmentPropertyCode[]
  selectionKind: 'CHOSEN'
  count: number
  equipmentIds?: string[]
}
function isEquipmentAllowedForStartingItem(
  item: ChosenStartingEquipmentItem,
  equipmentId: string,
  catalog: CharacterBuilderCatalog
): boolean {
  const equipment = catalog.equipment.find((record) => record.id === equipmentId)
  if (!equipment) return false

  if (Array.isArray(item.equipmentIds) && !item.equipmentIds.includes(equipmentId)) return false
  if (item.category && equipment.category !== item.category) return false
  if (item.properties?.some((property) => !equipment.properties.includes(property))) return false

  return true
}

export function isStartingEquipmentDecisionComplete(
  startingEquipment: StartingEquipmentAuthored,
  decision: CharacterStartingEquipmentDecision | undefined,
  catalog: CharacterBuilderCatalog
): boolean {
  if (startingEquipment.sets.length === 0) return true
  if (!decision) return false

  if (decision.tookGold) {
    return Boolean(
      decision.gold && decision.gold.goldOption.trim().length > 0 && decision.gold.totalGold > 0
    )
  }

  const groupSelections = new Map((decision.groups ?? []).map((group) => [group.groupId, group]))

  return startingEquipment.sets.every((set) =>
    set.groups.every((group) => {
      const groupSelection = groupSelections.get(group.id)
      const option = group.options.find((candidate) => candidate.id === groupSelection?.optionId)
      if (!groupSelection || !option) return false

      const selectableItemIds = new Set(
        option.items.filter(isChosenStartingEquipmentItem).map((item) => item.id)
      )
      const hasInvalidSelectionKey = groupSelection.selections?.some(
        (selection) => !selectableItemIds.has(selection.selectionKey)
      )
      if (hasInvalidSelectionKey) return false

      return option.items.every((item) => {
        if (!isChosenStartingEquipmentItem(item)) return true

        const selections =
          groupSelection.selections?.filter((selection) => selection.selectionKey === item.id) ?? []
        const selectedQuantity = selections.reduce((sum, selection) => sum + selection.quantity, 0)

        return (
          selectedQuantity === item.count &&
          selections.every(
            (selection) =>
              selection.equipmentId.trim().length > 0 &&
              selection.quantity > 0 &&
              isEquipmentAllowedForStartingItem(item, selection.equipmentId, catalog)
          )
        )
      })
    })
  )
}

function isChosenStartingEquipmentItem(
  item: StartingEquipmentItem
): item is ChosenStartingEquipmentItem {
  return (
    item.startingEquipmentKind === 'EQUIPMENT' &&
    'selectionKind' in item &&
    item.selectionKind === 'CHOSEN' &&
    'count' in item
  )
}

export function clearObsoleteStartingEquipmentSelections(
  character: CharacterAuthored,
  existingCharacter: CharacterAuthored | null
): CharacterAuthored {
  const nextCharacter = structuredClone(character)

  if (!existingCharacter) {
    if (!nextCharacter.intent.classes[0]?.classId) {
      delete nextCharacter.intent.startingEquipment?.class
    }
    if (!nextCharacter.intent.background.backgroundId) {
      delete nextCharacter.intent.startingEquipment?.background
    }
    if (
      nextCharacter.intent.startingEquipment &&
      !nextCharacter.intent.startingEquipment.class &&
      !nextCharacter.intent.startingEquipment.background
    ) {
      delete nextCharacter.intent.startingEquipment
    }
    return nextCharacter
  }

  const previousPrimaryClassId = existingCharacter.intent.classes[0]?.classId
  const nextPrimaryClassId = nextCharacter.intent.classes[0]?.classId

  if (previousPrimaryClassId !== nextPrimaryClassId) {
    delete nextCharacter.intent.startingEquipment?.class
  }

  if (
    existingCharacter.intent.background.backgroundId !==
    nextCharacter.intent.background.backgroundId
  ) {
    delete nextCharacter.intent.startingEquipment?.background
  }

  if (!nextPrimaryClassId) {
    delete nextCharacter.intent.startingEquipment?.class
  }

  if (!nextCharacter.intent.background.backgroundId) {
    delete nextCharacter.intent.startingEquipment?.background
  }

  if (
    nextCharacter.intent.startingEquipment &&
    !nextCharacter.intent.startingEquipment.class &&
    !nextCharacter.intent.startingEquipment.background
  ) {
    delete nextCharacter.intent.startingEquipment
  }

  return nextCharacter
}

function filterStartingEquipmentByEligibility(
  startingEquipment: StartingEquipmentAuthored,
  context: CharacterEligibilityContext,
  registry: ReturnType<typeof createCharacterAssemblyRegistry>
): StartingEquipmentAuthored {
  return {
    ...startingEquipment,
    sets: startingEquipment.sets.map((set) => ({
      ...set,
      groups: set.groups.map((group) => ({
        ...group,
        options: group.options.filter(
          (option) => evaluateCharacterFacet(option.eligibility, context, registry).passed
        )
      }))
    }))
  }
}

export function resolveEligibleStartingEquipment(params: {
  character: CharacterAuthored
  registry: CharacterBuilderRegistry
  grantedFeatures: readonly GrantedFeatureRecord[]
  abilityScores: Partial<Record<AbilityCode, number>>
  primaryClass?: ParentClassAuthored
  selectedBackground?: BackgroundAuthored
}): {
  classStartingEquipment?: StartingEquipmentAuthored
  backgroundStartingEquipment?: StartingEquipmentAuthored
} {
  const classStartingEquipment = params.primaryClass?.startingEquipment
  const backgroundStartingEquipment = params.selectedBackground?.startingEquipment
  if (!classStartingEquipment && !backgroundStartingEquipment) return {}

  const hasEligibility = [classStartingEquipment, backgroundStartingEquipment]
    .filter((record): record is StartingEquipmentAuthored => Boolean(record))
    .some((record) =>
      record.sets.some((set) =>
        set.groups.some((group) => group.options.some((option) => Boolean(option.eligibility)))
      )
    )
  if (!hasEligibility) {
    return {
      classStartingEquipment,
      backgroundStartingEquipment
    }
  }

  const { context, registry } = createCharacterBuilderEligibilityContext(params)

  return {
    classStartingEquipment: classStartingEquipment
      ? filterStartingEquipmentByEligibility(classStartingEquipment, context, registry)
      : undefined,
    backgroundStartingEquipment: backgroundStartingEquipment
      ? filterStartingEquipmentByEligibility(backgroundStartingEquipment, context, registry)
      : undefined
  }
}

export function reconcileStartingEquipmentDecision(
  decision: CharacterStartingEquipmentDecision | undefined,
  startingEquipment: StartingEquipmentAuthored | undefined,
  catalog: CharacterBuilderCatalog
): CharacterStartingEquipmentDecision | undefined {
  if (!decision || !startingEquipment || decision.tookGold) return decision

  const optionsByGroup = new Map(
    startingEquipment.sets.flatMap((set) =>
      set.groups.map(
        (group) => [group.id, new Map(group.options.map((option) => [option.id, option]))] as const
      )
    )
  )
  const groups = (decision.groups ?? []).flatMap((group) => {
    const option = optionsByGroup.get(group.groupId)?.get(group.optionId)
    if (!option) return []

    const chosenItemsById = new Map(
      option.items.filter(isChosenStartingEquipmentItem).map((item) => [item.id, item])
    )
    const selections = (group.selections ?? []).filter((selection) => {
      const item = chosenItemsById.get(selection.selectionKey)
      return Boolean(
        item &&
        selection.quantity > 0 &&
        isEquipmentAllowedForStartingItem(item, selection.equipmentId, catalog)
      )
    })

    return [
      {
        ...group,
        ...(group.selections ? { selections } : {})
      }
    ]
  })

  if ((decision.groups?.length ?? 0) > 0 && groups.length === 0) return undefined

  return {
    ...decision,
    groups
  }
}

export function hasStartingEquipmentGroupWithoutEligibleOptions(
  startingEquipment: StartingEquipmentAuthored | undefined
): boolean {
  return Boolean(
    startingEquipment?.sets.some((set) => set.groups.some((group) => group.options.length === 0))
  )
}
