import type {
  CharacterBuildState,
  CharacterBuildSnapshot,
  CharacterAssemblyRegistry,
  EquippedState
} from '@artificer-toolkit/shared'

/**
 * Assembles a CharacterBuildSnapshot from the current CharacterBuildState
 * and a pre-populated CharacterAssemblyRegistry.
 *
 * This is the only place that translates persisted state into engine input.
 * The engine itself never touches the DB.
 */
export function buildSnapshot(
  state: CharacterBuildState,
  registry: CharacterAssemblyRegistry
): CharacterBuildSnapshot {
  const totalLevel = state.classes.reduce((sum, c) => sum + c.level, 0)

  const classes = state.classes.map((c) => ({
    classId: c.classRef.contentId,
    level: c.level,
    subclassId: c.subclassRef?.contentId,
    specializationId: c.specializationRef?.contentId
  }))

  const hitpoints = state.hitpointsByLevel.map((h) => ({
    classId: h.classRef.contentId,
    classLevel: h.classLevel,
    value: h.value
  }))

  // Assemble equipped items from owned equipment that has an equippedState
  const equippedItems: CharacterBuildSnapshot['equippedItems'] = []
  for (const owned of state.ownedEquipment) {
    if (!owned.equippedState) continue

    const compiledItem = registry.equipment[owned.contentRef.contentId]
    if (!compiledItem) continue

    equippedItems.push({
      instanceId: owned.instanceId,
      contentRef: owned.contentRef,
      equippedState: owned.equippedState as EquippedState,
      compiledItem
    })
  }

  // Feature acquisitions — for Phase 6.5 these come from class features
  // derived from class levels in the build state. Full feature assembly
  // (per-level class features, racial traits, etc.) is done by the content
  // assembler; here we pass an empty list as a foundation.
  // TODO: hook up to existing character assembly pipeline
  const features: CharacterBuildSnapshot['features'] = []

  return {
    characterId: state.characterId,
    systemId: state.systemId,
    totalLevel: Math.max(totalLevel, 1),
    classes,
    abilities: { ...state.abilityScores },
    hitpoints,
    features,
    equippedItems
  }
}
