import type { AuthoredSubjectKind } from '@artificer-toolkit/schema/projections/identity'
import type {
  CharacterAcquisitionTiming,
  CharacterAuthored,
  CharacterProvenance
} from '@artificer-toolkit/shared/subjects/authored'
import { getCharacterChosenGrantSelectionIdentityKey } from '@artificer-toolkit/shared/subjects/authored'

export interface CharacterSourceLossTarget {
  subjectKind: AuthoredSubjectKind
  subjectId: string
}

/** Removes current Character references to one authored root without mutating the input. */
export function reconcileCharacterAuthoredSourceLoss(
  character: CharacterAuthored,
  target: CharacterSourceLossTarget,
  chosenGrantKinds: ReadonlyMap<string, AuthoredSubjectKind>
): CharacterAuthored {
  const next = structuredClone(character)
  switch (target.subjectKind) {
    case 'SPELL':
      removeSpell(next, target.subjectId)
      break
    case 'EQUIPMENT':
      removeEquipment(next, target.subjectId)
      break
    case 'CREATURE':
      removeCreature(next, target.subjectId)
      break
    case 'VEHICLE':
      removeVehicle(next, target.subjectId)
      break
    case 'RACE':
      removeRace(next, target.subjectId)
      break
    case 'CLASS':
      removeClass(next, target.subjectId)
      break
    case 'BACKGROUND':
      removeBackground(next, target.subjectId)
      break
    case 'FEAT':
      removeProvenance(
        next,
        (source) => source.kind === 'FEAT' && source.featId === target.subjectId
      )
      break
  }
  if (
    next.intent.chosenGrantSelections?.some(
      (entry) =>
        chosenGrantKinds.get(getCharacterChosenGrantSelectionIdentityKey(entry)) ===
          target.subjectKind && entry.targetIds.includes(target.subjectId)
    )
  ) {
    next.intent.chosenGrantSelections = optionalArray(
      next.intent.chosenGrantSelections.flatMap((entry) => {
        if (
          chosenGrantKinds.get(getCharacterChosenGrantSelectionIdentityKey(entry)) !==
            target.subjectKind ||
          !entry.targetIds.includes(target.subjectId)
        )
          return [entry]
        const targetIds = entry.targetIds.filter((id) => id !== target.subjectId)
        return targetIds.length ? [{ ...entry, targetIds }] : []
      })
    )
  }
  return next
}

function removeSpell(character: CharacterAuthored, spellId: string): void {
  character.intent.spellSelections = optionalArray(
    (character.intent.spellSelections ?? [])
      .map((selection) => ({
        ...selection,
        spells: selection.spells.filter((id) => id !== spellId)
      }))
      .filter((selection) => selection.spells.length > 0)
  )
  character.state.classes = optionalArray(
    (character.state.classes ?? []).map((entry) => {
      const learned = entry.spells?.learned?.filter((id) => id !== spellId)
      const prepared = entry.spells?.prepared?.filter((id) => id !== spellId)
      return learned?.length || prepared?.length
        ? {
            ...entry,
            spells: {
              ...(learned?.length ? { learned } : {}),
              ...(prepared?.length ? { prepared } : {})
            }
          }
        : omit(entry, 'spells')
    })
  )
}

function removeEquipment(character: CharacterAuthored, equipmentId: string): void {
  const removedItemIds = new Set(
    character.state.equipment.inventory
      .filter((item) => item.equipmentId === equipmentId && !item.retainedRulesJson)
      .map((item) => item.id)
  )
  character.state.equipment.inventory = character.state.equipment.inventory
    .filter((item) => !removedItemIds.has(item.id))
    .map((item) =>
      item.containerId && removedItemIds.has(item.containerId) ? omit(item, 'containerId') : item
    )
  character.state.equipment.equipped = character.state.equipment.equipped.filter(
    (itemId) => !removedItemIds.has(itemId)
  )
  character.state.equipment.attuned = character.state.equipment.attuned.filter(
    (itemId) => !removedItemIds.has(itemId)
  )
  setEquipmentAssignments(character, 'creatureEquipment', removedItemIds)
  setEquipmentAssignments(character, 'vehicleEquipment', removedItemIds)
  for (const source of ['class', 'background'] as const) {
    const decision = character.intent.startingEquipment?.[source]
    if (!decision?.groups) continue
    decision.groups = decision.groups.map((group) => {
      const selections = group.selections?.filter((entry) => entry.equipmentId !== equipmentId)
      return selections?.length ? { ...group, selections } : omit(group, 'selections')
    })
  }
}

function setEquipmentAssignments(
  character: CharacterAuthored,
  key: 'creatureEquipment' | 'vehicleEquipment',
  removedItemIds: ReadonlySet<string>
): void {
  const assignments = character.state[key]
  if (!assignments) return
  const retained = Object.fromEntries(
    Object.entries(assignments).flatMap(([ownerId, values]) => {
      const next = values.filter((value) => !removedItemIds.has(value.equipmentItemId))
      return next.length > 0 ? [[ownerId, next]] : []
    })
  )
  if (Object.keys(retained).length > 0) character.state[key] = retained
  else delete character.state[key]
}

function removeCreature(character: CharacterAuthored, creatureId: string): void {
  const removedInstanceIds = new Set(
    (character.state.creatures ?? [])
      .filter((entry) => entry.creatureId === creatureId)
      .map((entry) => entry.id)
  )
  character.state.creatures = optionalArray(
    (character.state.creatures ?? []).filter((entry) => entry.creatureId !== creatureId)
  )
  removeRosterAssignments(character, 'creatureEquipment', removedInstanceIds)
}

function removeVehicle(character: CharacterAuthored, vehicleId: string): void {
  const removedInstanceIds = new Set(
    (character.state.vehicles ?? [])
      .filter((entry) => entry.vehicleId === vehicleId)
      .map((entry) => entry.id)
  )
  character.state.vehicles = optionalArray(
    (character.state.vehicles ?? []).filter((entry) => entry.vehicleId !== vehicleId)
  )
  removeRosterAssignments(character, 'vehicleEquipment', removedInstanceIds)
}

function removeRosterAssignments(
  character: CharacterAuthored,
  key: 'creatureEquipment' | 'vehicleEquipment',
  removedInstanceIds: ReadonlySet<string>
): void {
  const assignments = character.state[key]
  if (!assignments) return
  const retained = Object.fromEntries(
    Object.entries(assignments).filter(([instanceId]) => !removedInstanceIds.has(instanceId))
  )
  if (Object.keys(retained).length > 0) character.state[key] = retained
  else delete character.state[key]
}

function removeRace(character: CharacterAuthored, raceId: string): void {
  const removesBase = character.intent.race.raceId === raceId
  const removedSubraceId = removesBase ? character.intent.race.subraceId : undefined
  if (removesBase) {
    character.intent.race.raceId = ''
    delete character.intent.race.subraceId
  } else if (character.intent.race.subraceId === raceId) {
    delete character.intent.race.subraceId
  }
  character.intent.ancestrySelections = optionalArray(
    (character.intent.ancestrySelections ?? []).filter(
      (selection) =>
        !(
          (selection.source.kind === 'RACE' && selection.source.raceId === raceId) ||
          (selection.source.kind === 'SUBRACE' &&
            (selection.source.subraceId === raceId ||
              selection.source.subraceId === removedSubraceId))
        )
    )
  )
  removeProvenance(
    character,
    (source) =>
      (source.kind === 'RACE' && source.raceId === raceId) ||
      (source.kind === 'SUBRACE' &&
        (source.subraceId === raceId || source.subraceId === removedSubraceId))
  )
}

function removeClass(character: CharacterAuthored, classId: string): void {
  const removesPrimaryClass = character.intent.classes[0]?.classId === classId
  const removedSubclassIds = new Set(
    character.intent.classes
      .filter((entry) => entry.classId === classId)
      .flatMap((entry) => (entry.subclassId ? [entry.subclassId] : []))
  )
  character.intent.classes = character.intent.classes
    .filter((entry) => entry.classId !== classId)
    .map((entry) => (entry.subclassId === classId ? omit(entry, 'subclassId') : entry))
  character.intent.hitpoints.levels = character.intent.hitpoints.levels.filter(
    (entry) => entry.classId !== classId
  )
  character.state.classes = optionalArray(
    (character.state.classes ?? []).filter((entry) => entry.classId !== classId)
  )
  character.intent.ancestrySelections = optionalArray(
    (character.intent.ancestrySelections ?? []).filter(
      (selection) => !hasClassTiming(selection.timing, classId)
    )
  )
  if (removesPrimaryClass) {
    delete character.intent.startingEquipment?.class
    removeEmptyStartingEquipment(character)
  }
  removeProvenance(
    character,
    (source) =>
      (source.kind === 'CLASS' && source.classId === classId) ||
      (source.kind === 'SUBCLASS' &&
        (source.subclassId === classId || removedSubclassIds.has(source.subclassId))),
    (timing) => hasClassTiming(timing, classId)
  )
}

function removeBackground(character: CharacterAuthored, backgroundId: string): void {
  if (character.intent.background.backgroundId === backgroundId) {
    character.intent.background.backgroundId = ''
    delete character.intent.startingEquipment?.background
    removeEmptyStartingEquipment(character)
  }
  removeProvenance(
    character,
    (source) => source.kind === 'BACKGROUND' && source.backgroundId === backgroundId
  )
}

function removeProvenance(
  character: CharacterAuthored,
  matchesSource: (source: CharacterProvenance) => boolean,
  matchesTiming: (timing: CharacterAcquisitionTiming) => boolean = () => false
): void {
  const removedIds = new Set<string>()
  let changed = true
  while (changed) {
    changed = false
    for (const acquisition of character.intent.featureAcquisitions) {
      if (
        matchesSource(acquisition.source) ||
        matchesTiming(acquisition.timing) ||
        (acquisition.source.kind === 'OPTION' &&
          removedIds.has(acquisition.source.acquiredParentId))
      ) {
        if (!removedIds.has(acquisition.id)) {
          removedIds.add(acquisition.id)
          changed = true
        }
      }
    }
  }
  character.intent.featureAcquisitions = character.intent.featureAcquisitions.filter(
    (entry) => !removedIds.has(entry.id)
  )
  const removedSource = (source: CharacterProvenance): boolean =>
    matchesSource(source) || (source.kind === 'OPTION' && removedIds.has(source.acquiredParentId))
  character.intent.chosenGrantSelections = optionalArray(
    (character.intent.chosenGrantSelections ?? []).filter(
      (entry) => !removedSource(entry.source) && !matchesTiming(entry.timing)
    )
  )
  character.intent.spellSelections = optionalArray(
    (character.intent.spellSelections ?? []).filter(
      (entry) => !removedSource(entry.source) && !matchesTiming(entry.timing)
    )
  )
  character.intent.resourceGrants = optionalArray(
    (character.intent.resourceGrants ?? []).filter(
      (entry) => !removedSource(entry.source) && !matchesTiming(entry.timing)
    )
  )
}

function optionalArray<T>(values: T[]): T[] | undefined {
  return values.length > 0 ? values : undefined
}

function hasClassTiming(timing: CharacterAcquisitionTiming, classId: string): boolean {
  return timing.kind === 'CLASS_LEVEL' && timing.classId === classId
}

function removeEmptyStartingEquipment(character: CharacterAuthored): void {
  if (
    character.intent.startingEquipment &&
    !character.intent.startingEquipment.class &&
    !character.intent.startingEquipment.background
  ) {
    delete character.intent.startingEquipment
  }
}

function omit<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const next = { ...value }
  delete next[key]
  return next
}
