import type {
  CharacterBuildState,
  CharacterAssemblyRegistry,
  RulesSystem,
  CharacterEvent,
  ContentRef,
  OwnedEquipmentInstance,
  EquippedState,
} from '@artificer-toolkit/shared'

import type {
  CreateCharacterCommand,
  AssignAbilityScoresCommand,
  GainClassLevelCommand,
  ApplyHitPointsCommand,
  MakeFeatureSelectionCommand,
  ChooseFeatCommand,
  UpdateSpellSelectionCommand,
  AcquireEquipmentCommand,
  EquipItemCommand,
  UnequipItemCommand,
} from '@artificer-toolkit/schema'

/* ──────────────────────────────────────────────
 * Command handler contract
 * ────────────────────────────────────────────── */

export type CommandResult<TResult = void> = {
  events: CharacterEvent[]
  newState: CharacterBuildState
  result: TResult
}

export type CommandHandler<TCommand, TResult = void> = (
  command: TCommand,
  currentState: CharacterBuildState,
  registry: CharacterAssemblyRegistry,
  rules: RulesSystem
) => Promise<CommandResult<TResult>>

/* ──────────────────────────────────────────────
 * createCharacter
 * ────────────────────────────────────────────── */

export const handleCreateCharacter: CommandHandler<CreateCharacterCommand> = async (
  command,
  _currentState,
  _registry,
  _rules
) => {
  const now = new Date().toISOString()
  const event: CharacterEvent = {
    type: 'CHARACTER_CREATED',
    eventId: crypto.randomUUID(),
    characterId: command.characterId,
    occurredAt: now,
    actorId: command.actorId,
    commandId: command.commandId,
    schemaVersion: 1,
    name: command.name,
    systemId: command.systemId,
  }

  const newState: CharacterBuildState = {
    characterId: command.characterId,
    systemId: command.systemId,
    streamVersion: 1,
    name: command.name,
    classes: [],
    abilityScores: {},
    abilityGenerationMethod: 'STANDARD_ARRAY',
    hitpointsByLevel: [],
    featureSelections: [],
    featRefs: [],
    spellRefs: [],
    ownedEquipment: [],
  }

  return { events: [event], newState, result: undefined }
}

/* ──────────────────────────────────────────────
 * assignAbilityScores
 * ────────────────────────────────────────────── */

export const handleAssignAbilityScores: CommandHandler<AssignAbilityScoresCommand> = async (
  command,
  currentState,
  _registry,
  _rules
) => {
  const event: CharacterEvent = {
    type: 'ABILITY_SCORES_GENERATED',
    eventId: crypto.randomUUID(),
    characterId: command.characterId,
    occurredAt: new Date().toISOString(),
    actorId: command.actorId,
    commandId: command.commandId,
    schemaVersion: 1,
    method: command.method,
    rolls: command.rolls,
    assignments: command.assignments,
  }

  const newState: CharacterBuildState = {
    ...currentState,
    streamVersion: currentState.streamVersion + 1,
    abilityScores: command.assignments,
    abilityGenerationMethod: command.method,
  }

  return { events: [event], newState, result: undefined }
}

/* ──────────────────────────────────────────────
 * gainClassLevel
 * ────────────────────────────────────────────── */

export const handleGainClassLevel: CommandHandler<GainClassLevelCommand> = async (
  command,
  currentState,
  _registry,
  _rules
) => {
  const existing = currentState.classes.find(
    (c) => c.classRef.contentId === command.classRef.contentId
  )
  const newLevel = (existing?.level ?? 0) + 1
  const totalLevel = currentState.classes.reduce((sum, c) => sum + c.level, 0) + 1

  const event: CharacterEvent = {
    type: 'CLASS_LEVEL_GAINED',
    eventId: crypto.randomUUID(),
    characterId: command.characterId,
    occurredAt: new Date().toISOString(),
    actorId: command.actorId,
    commandId: command.commandId,
    schemaVersion: 1,
    classRef: command.classRef,
    subclassRef: command.subclassRef,
    newLevel,
    totalCharacterLevel: totalLevel,
  }

  const updatedClasses = existing
    ? currentState.classes.map((c) =>
        c.classRef.contentId === command.classRef.contentId
          ? { ...c, level: newLevel, subclassRef: command.subclassRef ?? c.subclassRef }
          : c
      )
    : [...currentState.classes, { classRef: command.classRef, subclassRef: command.subclassRef, level: 1 }]

  const newState: CharacterBuildState = {
    ...currentState,
    streamVersion: currentState.streamVersion + 1,
    classes: updatedClasses,
  }

  return { events: [event], newState, result: undefined }
}

/* ──────────────────────────────────────────────
 * applyHitPoints
 * ────────────────────────────────────────────── */

export const handleApplyHitPoints: CommandHandler<ApplyHitPointsCommand> = async (
  command,
  currentState,
  _registry,
  _rules
) => {
  // Value calculation (CON mod expected to be pre-computed by caller or fixed average)
  const value = command.roll ?? command.classLevel // placeholder — real value from caller
  const event: CharacterEvent = {
    type: 'HITPOINTS_APPLIED',
    eventId: crypto.randomUUID(),
    characterId: command.characterId,
    occurredAt: new Date().toISOString(),
    actorId: command.actorId,
    commandId: command.commandId,
    schemaVersion: 1,
    classRef: command.classRef,
    classLevel: command.classLevel,
    method: command.method,
    roll: command.roll,
    value,
  }

  const newState: CharacterBuildState = {
    ...currentState,
    streamVersion: currentState.streamVersion + 1,
    hitpointsByLevel: [
      ...currentState.hitpointsByLevel,
      { classRef: command.classRef, classLevel: command.classLevel, value },
    ],
  }

  return { events: [event], newState, result: undefined }
}

/* ──────────────────────────────────────────────
 * makeFeatureSelection
 * ────────────────────────────────────────────── */

export const handleMakeFeatureSelection: CommandHandler<MakeFeatureSelectionCommand> = async (
  command,
  currentState,
  _registry,
  _rules
) => {
  const event: CharacterEvent = {
    type: 'FEATURE_SELECTION_MADE',
    eventId: crypto.randomUUID(),
    characterId: command.characterId,
    occurredAt: new Date().toISOString(),
    actorId: command.actorId,
    commandId: command.commandId,
    schemaVersion: 1,
    featureId: command.featureId,
    choiceKey: command.choiceKey,
    selectedOptionRefs: command.selectedOptionRefs,
    atLevel: command.atLevel,
  }

  const filtered = currentState.featureSelections.filter(
    (s) => !(s.featureId === command.featureId && s.choiceKey === command.choiceKey)
  )
  const newState: CharacterBuildState = {
    ...currentState,
    streamVersion: currentState.streamVersion + 1,
    featureSelections: [
      ...filtered,
      {
        featureId: command.featureId,
        choiceKey: command.choiceKey,
        selectedOptionIds: command.selectedOptionRefs.map((r) => r.contentId),
        atLevel: command.atLevel,
      },
    ],
  }

  return { events: [event], newState, result: undefined }
}

/* ──────────────────────────────────────────────
 * chooseFeat
 * ────────────────────────────────────────────── */

export const handleChooseFeat: CommandHandler<ChooseFeatCommand> = async (
  command,
  currentState,
  _registry,
  _rules
  // TODO: prerequisite evaluation — call evaluateEntryPrerequisite before emitting
) => {
  const event: CharacterEvent = {
    type: 'FEAT_CHOSEN',
    eventId: crypto.randomUUID(),
    characterId: command.characterId,
    occurredAt: new Date().toISOString(),
    actorId: command.actorId,
    commandId: command.commandId,
    schemaVersion: 1,
    featRef: command.featRef,
    sourceFeatureId: command.sourceFeatureId,
  }

  const newState: CharacterBuildState = {
    ...currentState,
    streamVersion: currentState.streamVersion + 1,
    featRefs: [...currentState.featRefs, command.featRef],
  }

  return { events: [event], newState, result: undefined }
}

/* ──────────────────────────────────────────────
 * updateSpellSelection
 * ────────────────────────────────────────────── */

export const handleUpdateSpellSelection: CommandHandler<UpdateSpellSelectionCommand> = async (
  command,
  currentState,
  _registry,
  _rules
) => {
  const event: CharacterEvent = {
    type: 'SPELL_SELECTION_UPDATED',
    eventId: crypto.randomUUID(),
    characterId: command.characterId,
    occurredAt: new Date().toISOString(),
    actorId: command.actorId,
    commandId: command.commandId,
    schemaVersion: 1,
    classRef: command.classRef,
    added: command.added,
    removed: command.removed,
  }

  const removedIds = new Set(command.removed.map((r) => r.contentId))
  const newSpellRefs: ContentRef[] = [
    ...currentState.spellRefs.filter((r) => !removedIds.has(r.contentId)),
    ...command.added,
  ]

  const newState: CharacterBuildState = {
    ...currentState,
    streamVersion: currentState.streamVersion + 1,
    spellRefs: newSpellRefs,
  }

  return { events: [event], newState, result: undefined }
}

/* ──────────────────────────────────────────────
 * acquireEquipment
 * ────────────────────────────────────────────── */

export const handleAcquireEquipment: CommandHandler<AcquireEquipmentCommand> = async (
  command,
  currentState,
  _registry,
  _rules
) => {
  const event: CharacterEvent = {
    type: 'EQUIPMENT_ACQUIRED',
    eventId: crypto.randomUUID(),
    characterId: command.characterId,
    occurredAt: new Date().toISOString(),
    actorId: command.actorId,
    commandId: command.commandId,
    schemaVersion: 1,
    instanceId: command.instanceId,
    contentRef: command.contentRef,
    quantity: command.quantity,
    source: command.source,
  }

  const newItem: OwnedEquipmentInstance = {
    instanceId: command.instanceId,
    contentRef: command.contentRef,
    quantity: command.quantity,
  }

  const newState: CharacterBuildState = {
    ...currentState,
    streamVersion: currentState.streamVersion + 1,
    ownedEquipment: [...currentState.ownedEquipment, newItem],
  }

  return { events: [event], newState, result: undefined }
}

/* ──────────────────────────────────────────────
 * equipItem
 * ────────────────────────────────────────────── */

export const handleEquipItem: CommandHandler<EquipItemCommand> = async (
  command,
  currentState,
  _registry,
  _rules
) => {
  const equippedState: EquippedState =
    command.slot === 'RING'
      ? { slot: 'RING', position: command.ringPosition ?? 1 }
      : { slot: command.slot as Exclude<EquippedState['slot'], 'RING'> }

  const event: CharacterEvent = {
    type: 'ITEM_EQUIPPED',
    eventId: crypto.randomUUID(),
    characterId: command.characterId,
    occurredAt: new Date().toISOString(),
    actorId: command.actorId,
    commandId: command.commandId,
    schemaVersion: 1,
    instanceId: command.instanceId,
    equippedSlot: command.slot,
    slotPosition: command.ringPosition,
  }

  const newState: CharacterBuildState = {
    ...currentState,
    streamVersion: currentState.streamVersion + 1,
    ownedEquipment: currentState.ownedEquipment.map((item) =>
      item.instanceId === command.instanceId
        ? { ...item, equippedState }
        : item
    ),
  }

  return { events: [event], newState, result: undefined }
}

/* ──────────────────────────────────────────────
 * unequipItem
 * ────────────────────────────────────────────── */

export const handleUnequipItem: CommandHandler<UnequipItemCommand> = async (
  command,
  currentState,
  _registry,
  _rules
) => {
  const item = currentState.ownedEquipment.find((i) => i.instanceId === command.instanceId)

  const event: CharacterEvent = {
    type: 'ITEM_UNEQUIPPED',
    eventId: crypto.randomUUID(),
    characterId: command.characterId,
    occurredAt: new Date().toISOString(),
    actorId: command.actorId,
    commandId: command.commandId,
    schemaVersion: 1,
    instanceId: command.instanceId,
    unequippedFromSlot: item?.equippedState?.slot ?? 'UNKNOWN',
  }

  const newState: CharacterBuildState = {
    ...currentState,
    streamVersion: currentState.streamVersion + 1,
    ownedEquipment: currentState.ownedEquipment.map((i) =>
      i.instanceId === command.instanceId
        ? { instanceId: i.instanceId, contentRef: i.contentRef, quantity: i.quantity }
        : i
    ),
  }

  return { events: [event], newState, result: undefined }
}
