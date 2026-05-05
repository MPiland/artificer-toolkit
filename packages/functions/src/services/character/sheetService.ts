import {
  ConcurrencyError,
  createCharacterEventRepository,
  createCharacterRepository,
  type DBLike
} from '@artificer-toolkit/db'
import {
  AUTHORED_RECORD_STATUS,
  CLASS_CATEGORY,
  dnd5e2014RulesSystem,
  runEngine,
  type CharacterAssemblyRegistry,
  type CharacterBuildSnapshot,
  type EngineSpellSlots,
  type CharacterEvent
} from '@artificer-toolkit/shared/core'
import {
  compileClass,
  compileCharge,
  compileFeature,
  compileResolvedEquipment,
  resolveCompiledChargeMaximum
} from '@artificer-toolkit/shared/compilers'
import type {
  CharacterAcquisitionTiming,
  CharacterAuthored,
  CharacterProvenance
} from '@artificer-toolkit/shared/subjects/authored'
import type {
  CharacterHistoryEntryDto,
  CharacterSheetCommandInputDto,
  CharacterSheetCommandResponseDto,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characters'
import {
  resolveCharacterBuilder,
  type CharacterBuilderResolution
} from './builderService.js'

export class CharacterSheetCommandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CharacterSheetCommandError'
  }
}

function createNamedError(name: string, message: string): Error {
  const error = new Error(message)
  error.name = name
  return error
}

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : String(value)
}

const ENGINE_ABILITY_ALIASES: Readonly<Record<string, string>> = {
  STRENGTH: 'STR',
  DEXTERITY: 'DEX',
  CONSTITUTION: 'CON',
  INTELLIGENCE: 'INT',
  WISDOM: 'WIS',
  CHARISMA: 'CHA'
}

function getCalculatedMaxHitPoints(character: CharacterAuthored): number {
  return character.intent.hitpoints.levels.reduce((total, level) => total + level.value, 0)
}

function getMaxHitPoints(character: CharacterAuthored): number {
  const calculated = getCalculatedMaxHitPoints(character)
  return character.state.hitpoints.maxOverride ?? (calculated > 0 ? calculated : character.state.hitpoints.current)
}

function formatClassSummary(resolution: CharacterBuilderResolution): string {
  const summary = resolution.summary.classes
    .map((classSummary) => {
      const subclass = classSummary.subclassLabel ? ` (${classSummary.subclassLabel})` : ''
      return `${classSummary.classLabel}${subclass} ${classSummary.classLevel}`
    })
    .join(' / ')

  return summary || 'No class selected'
}

function formatSlotLabel(slotKey: string, level: number | null): string {
  if (slotKey === 'PACT') return 'Pact Magic'
  return level == null ? slotKey : `Level ${level}`
}

function getSpellSlotKey(level: number): string {
  return `STANDARD:${level}`
}

function parseSlotLevel(slotKey: string): number | null {
  const [, level] = slotKey.split(':')
  return level ? Number(level) : null
}

type EngineFeatureSource = CharacterBuildSnapshot['features'][number]['source']
type EngineFeatureTiming = CharacterBuildSnapshot['features'][number]['timing']
type EngineEquippedItem = CharacterBuildSnapshot['equippedItems'][number]
type EngineCompiledEquipment = EngineEquippedItem['compiledItem']
type EngineEquippedState = EngineEquippedItem['equippedState']

function toEngineFeatureSource(source: CharacterProvenance): EngineFeatureSource {
  switch (source.kind) {
    case 'CLASS':
      return { kind: source.kind, classId: source.classId, classLevel: source.classLevel }
    case 'SUBCLASS':
      return { kind: source.kind, subclassId: source.subclassId, classLevel: source.classLevel }
    case 'RACE':
      return { kind: source.kind, raceId: source.raceId }
    case 'SUBRACE':
      return { kind: source.kind, subraceId: source.subraceId }
    case 'ANCESTRY':
      return { kind: source.kind, ancestryId: source.ancestryId, optionId: source.optionId }
    case 'BACKGROUND':
      return { kind: source.kind, backgroundId: source.backgroundId }
    case 'FEAT':
      return { kind: source.kind, featId: source.featId }
    case 'FEATURE':
      return { kind: source.kind, featureId: source.featureId }
    case 'OPTION':
      return { kind: source.kind, acquiredParentId: source.acquiredParentId, optionId: source.optionId }
    case 'MANUAL':
      return { kind: source.kind, reason: source.reason }
  }
}

function toEngineFeatureTiming(timing: CharacterAcquisitionTiming): EngineFeatureTiming {
  switch (timing.kind) {
    case 'IMMEDIATE':
      return { kind: timing.kind }
    case 'CHARACTER_LEVEL':
      return { kind: timing.kind, level: timing.level }
    case 'CLASS_LEVEL':
      return { kind: timing.kind, classId: timing.classId, classLevel: timing.classLevel }
  }
}

function addEngineAbilityScore(abilities: Record<string, number>, ability: string, score: number): void {
  abilities[ability] = score
  const alias = ENGINE_ABILITY_ALIASES[ability]
  if (alias) abilities[alias] = score
}

function getEngineEquippedState(compiledItem: EngineCompiledEquipment): EngineEquippedState {
  if (compiledItem.category === 'VARIANT') return { slot: 'GENERIC' }

  switch (compiledItem.category) {
    case 'ARMOR':
      return { slot: 'ARMOR' }
    case 'SHIELD':
      return { slot: 'SHIELD' }
    default:
      return { slot: 'GENERIC' }
  }
}

function createCharacterEngineInput(
  character: CharacterAuthored,
  resolution: CharacterBuilderResolution
): {
  registry: CharacterAssemblyRegistry
  snapshot: CharacterBuildSnapshot
} {
  const classes = Object.fromEntries(
    resolution.registry.classes.map((record) => [record.id, compileClass(record)])
  ) satisfies CharacterAssemblyRegistry['classes']
  const equipment = Object.fromEntries(
    resolution.registry.equipment.map((record) => [record.id, compileResolvedEquipment(record)])
  ) satisfies CharacterAssemblyRegistry['equipment']
  const features = Object.fromEntries(
    resolution.registry.features.map((record) => [record.id, compileFeature(record)])
  ) satisfies CharacterAssemblyRegistry['features']
  const abilities: Record<string, number> = {}
  for (const [ability, score] of Object.entries(resolution.summary.abilities)) {
    if (typeof score === 'number') addEngineAbilityScore(abilities, ability, score)
  }

  const equippedIds = new Set(character.state.equipment.equipped)
  const equippedItems: CharacterBuildSnapshot['equippedItems'] = []
  for (const item of character.state.equipment.inventory) {
    if (!equippedIds.has(item.id)) continue

    const compiledItem = equipment[item.equipmentId]
    if (!compiledItem) continue

    equippedItems.push({
      instanceId: item.id,
      contentRef: {
        contentId: item.equipmentId,
        systemId: character.systemId
      },
      equippedState: getEngineEquippedState(compiledItem),
      compiledItem
    })
  }

  return {
    registry: {
      classes,
      equipment,
      feats: {},
      features,
      races: {},
      spells: {}
    },
    snapshot: {
      characterId: character.id,
      systemId: character.systemId,
      totalLevel: resolution.summary.totalLevel,
      classes: character.intent.classes.flatMap((classIntent) => [
        {
          classId: classIntent.classId,
          level: classIntent.classLevel,
          subclassId: classIntent.subclassId,
          specializationId: classIntent.specializationId
        },
        ...(classIntent.subclassId
          ? [
              {
                classId: classIntent.subclassId,
                level: classIntent.classLevel
              }
            ]
          : [])
      ]),
      abilities,
      hitpoints: [],
      features: character.intent.featureAcquisitions.map((feature) => ({
        featureId: feature.featureId,
        source: toEngineFeatureSource(feature.source),
        timing: toEngineFeatureTiming(feature.timing)
      })),
      equippedItems
    }
  }
}

function getSpellSlotMaximums(slotMaximums: EngineSpellSlots) {
  const standardSlots = Object.entries(slotMaximums.maxByLevel).map(([level, max]) => {
    const slotLevel = Number(level)
    return {
      slotKey: getSpellSlotKey(slotLevel),
      label: formatSlotLabel(getSpellSlotKey(slotLevel), slotLevel),
      level: slotLevel,
      max
    }
  })
  const pactSlots = slotMaximums.pactMagic && slotMaximums.pactMagic.slots > 0
    ? [
        {
          slotKey: 'PACT',
          label: formatSlotLabel('PACT', slotMaximums.pactMagic.level),
          level: slotMaximums.pactMagic.level,
          max: slotMaximums.pactMagic.slots
        }
      ]
    : []

  return [...standardSlots, ...pactSlots]
    .filter((slot) => slot.max > 0)
    .sort((left, right) => (left.level ?? 0) - (right.level ?? 0))
}

function getPreparedAndKnownSpellIds(character: CharacterAuthored): {
  learned: Set<string>
  prepared: Set<string>
} {
  const learned = new Set<string>()
  const prepared = new Set<string>()

  for (const classState of character.state.classes ?? []) {
    for (const spellId of classState.spells?.learned ?? []) learned.add(spellId)
    for (const spellId of classState.spells?.prepared ?? []) prepared.add(spellId)
  }

  for (const selection of character.intent.spellSelections ?? []) {
    for (const spellId of selection.spells) learned.add(spellId)
  }

  return { learned, prepared }
}

function getKnownSpellIdsForClass(character: CharacterAuthored, classId: string): Set<string> {
  const known = new Set<string>()
  const classIntent = character.intent.classes.find((row) => row.classId === classId)
  const classState = character.state.classes?.find((row) => row.classId === classId)
  for (const spellId of classState?.spells?.learned ?? []) known.add(spellId)
  for (const spellId of classState?.spells?.prepared ?? []) known.add(spellId)

  for (const selection of character.intent.spellSelections ?? []) {
    if (selection.source.kind === 'CLASS' && selection.source.classId === classId) {
      for (const spellId of selection.spells) known.add(spellId)
    }

    if (
      selection.source.kind === 'SUBCLASS'
      && classIntent?.subclassId === selection.source.subclassId
    ) {
      for (const spellId of selection.spells) known.add(spellId)
    }
  }

  return known
}

function findResourceDefinition(
  resolution: CharacterBuilderResolution,
  resource: CharacterBuilderResolution['grants']['resources'][number],
  resourceDefinitionId = resource.id
) {
  switch (resource.source.kind) {
    case 'CLASS': {
      const source = resource.source
      const record = resolution.registry.classes.find((candidate) => candidate.id === source.classId)
      return record?.resources?.id === resourceDefinitionId ? record.resources : undefined
    }
    case 'SUBCLASS': {
      const source = resource.source
      const record = resolution.registry.classes.find((candidate) => candidate.category === CLASS_CATEGORY.SUBCLASS
        && candidate.resources?.id === resourceDefinitionId
        && (
          candidate.id === source.subclassId
          || candidate.label === resource.sourceLabel
        ))
      return record?.resources?.id === resourceDefinitionId ? record.resources : undefined
    }
    default:
      return undefined
  }
}

type CharacterResourceGrantRecord = NonNullable<CharacterAuthored['intent']['resourceGrants']>[number]

function isSameResourceGrantSource(
  left: CharacterResourceGrantRecord['source'],
  right: CharacterBuilderResolution['grants']['resources'][number]['source']
): boolean {
  if (left.kind !== right.kind) return false

  if (left.kind === 'CLASS' && right.kind === 'CLASS') {
    return left.classId === right.classId
  }

  if (left.kind === 'SUBCLASS' && right.kind === 'SUBCLASS') {
    return left.subclassId === right.subclassId
  }

  return false
}

function findResourceGrantRecord(
  character: CharacterAuthored,
  resource: CharacterBuilderResolution['grants']['resources'][number]
): CharacterResourceGrantRecord | undefined {
  return character.intent.resourceGrants?.find((grant) => grant.resourceId === resource.id
    && isSameResourceGrantSource(grant.source, resource.source))
}

function getResourceClassLevel(
  character: CharacterAuthored,
  resource: CharacterBuilderResolution['grants']['resources'][number]
): number {
  switch (resource.source.kind) {
    case 'CLASS': {
      const source = resource.source
      return source.classLevel
        ?? character.intent.classes.find((row) => row.classId === source.classId)?.classLevel
        ?? 1
    }
    case 'SUBCLASS': {
      const source = resource.source
      return source.classLevel
        ?? character.intent.classes.find((row) => row.subclassId === source.subclassId)?.classLevel
        ?? 1
    }
    default:
      return 1
  }
}

function getResourceRecovery(resetKind: string): 'SHORT_REST' | 'LONG_REST' | 'OTHER' {
  switch (resetKind) {
    case 'SHORT_REST':
      return 'SHORT_REST'
    case 'LONG_REST':
      return 'LONG_REST'
    default:
      return 'OTHER'
  }
}

function getResourceSheetConfig(params: {
  character: CharacterAuthored
  proficiencyBonus: number
  resolution: CharacterBuilderResolution
  resource: CharacterBuilderResolution['grants']['resources'][number]
  resourceDefinitionId?: string
  totalLevel: number
}): {
  max: number
  recovery: 'SHORT_REST' | 'LONG_REST' | 'OTHER'
} | null {
  const definition = findResourceDefinition(params.resolution, params.resource, params.resourceDefinitionId)
  if (!definition) return null

  const charge = compileCharge(definition.charges)
  return {
    max: resolveCompiledChargeMaximum(charge, {
      abilities: params.resolution.summary.abilities,
      classLevel: getResourceClassLevel(params.character, params.resource),
      proficiencyBonus: params.proficiencyBonus,
      totalLevel: params.totalLevel
    }),
    recovery: getResourceRecovery(definition.charges.resetKind)
  }
}

async function getConditionOptions(
  db: DBLike,
  systemId: string
): Promise<Array<{ id: string, label: string }>> {
  const rows = await db
    .selectFrom('condition_types')
    .select(['id', 'label'])
    .where('system_id', '=', systemId)
    .orderBy('label', 'asc')
    .execute()

  return rows.map((row) => ({
    id: String(row.id),
    label: String(row.label)
  }))
}

export async function buildCharacterSheetResponse(params: {
  db: DBLike
  character: CharacterAuthored
  resolution: CharacterBuilderResolution
  streamVersion: number
  hasBuilderDraft?: boolean
}): Promise<CharacterSheetResponseDto> {
  const { character, resolution } = params
  const totalLevel = Math.max(resolution.summary.totalLevel, 1)
  const engineInput = createCharacterEngineInput(character, resolution)
  const engineOutput = runEngine(engineInput.snapshot, engineInput.registry, dnd5e2014RulesSystem)
  const proficiencyBonus = engineOutput.derivedStats.proficiencyBonus
  const maxHitPoints = getMaxHitPoints(character)
  const conditionOptions = await getConditionOptions(params.db, character.systemId)
  const conditionLabels = new Map(conditionOptions.map((condition) => [condition.id, condition.label]))
  const equipmentLabels = new Map(resolution.registry.equipment.map((equipment) => [equipment.id, equipment.label]))
  const currencyOptions = resolution.registry.system?.currencies.map((currency) => ({
    id: currency.id,
    label: currency.label
  })) ?? []
  const currencyLabels = new Map(currencyOptions.map((currency) => [currency.id, currency.label]))
  const spellSlotsUsed = new Map((character.state.spellSlots ?? []).map((slot) => [slot.slotKey, slot.used]))
  const spellSlots = getSpellSlotMaximums(engineOutput.spellSlots).map((slot) => {
    const used = Math.min(spellSlotsUsed.get(slot.slotKey) ?? 0, slot.max)
    return {
      ...slot,
      used,
      remaining: Math.max(slot.max - used, 0)
    }
  })
  const { learned, prepared } = getPreparedAndKnownSpellIds(character)
  const knownSpellIds = new Set([...learned, ...prepared])
  const resourceUsage = new Map((character.state.resources ?? []).map((resource) => [resource.resourceGrantId, resource.used]))

  return {
    meta: {
      characterId: character.id,
      systemId: character.systemId,
      status: character.status ?? AUTHORED_RECORD_STATUS.ACTIVE,
      streamVersion: params.streamVersion,
      hasBuilderDraft: params.hasBuilderDraft
    },
    identity: {
      label: character.label || 'Untitled Character',
      description: character.description,
      concept: character.profile.backstory,
      classSummary: formatClassSummary(resolution),
      raceLabel: resolution.summary.selectedRace?.subraceLabel ?? resolution.summary.selectedRace?.raceLabel,
      backgroundLabel: resolution.summary.selectedBackground?.label,
      totalLevel
    },
    overview: {
      abilities: Object.entries(resolution.summary.abilities).map(([ability, score]) => ({
        ability: ability as keyof typeof resolution.summary.abilities,
        score,
        modifier: abilityModifier(score)
      })),
      facts: [
        { label: 'Initiative', value: formatModifier(engineOutput.derivedStats.initiative) },
        { label: 'Proficiency', value: formatModifier(proficiencyBonus) },
        { label: 'Hit Dice', value: character.state.hitpoints.hitDice.map((die) => `${die.total - die.used}/${die.total}d${die.die}`).join(', ') || 'None' }
      ],
      armorClass: engineOutput.derivedStats.armorClass,
      initiative: engineOutput.derivedStats.initiative,
      proficiencyBonus,
      currentHitPoints: character.state.hitpoints.current,
      maxHitPoints,
      tempHitPoints: character.state.hitpoints.temp ?? 0,
      maxHitPointsOverride: character.state.hitpoints.maxOverride ?? null,
      exhaustionLevel: character.state.exhaustion?.level ?? 0,
      conditions: (character.state.conditions ?? []).map((condition) => ({
        conditionTypeId: condition.conditionTypeId,
        label: conditionLabels.get(condition.conditionTypeId) ?? 'Unknown condition',
        notes: condition.notes
      })),
      hitDice: character.state.hitpoints.hitDice.map((die) => ({
        die: die.die,
        total: die.total,
        used: die.used,
        remaining: Math.max(die.total - die.used, 0)
      }))
    },
    actions: {
      items: resolution.grants.features.map((feature) => ({
        id: feature.id,
        label: feature.label,
        kind: 'OTHER',
        sourceLabel: feature.sourceLabel
      }))
    },
    resources: {
      items: resolution.grants.resources.flatMap((resource) => {
        const grantRecord = findResourceGrantRecord(character, resource)
        const resourceGrantId = grantRecord?.id ?? resource.id
        const config = getResourceSheetConfig({
          character,
          proficiencyBonus,
          resolution,
          resource,
          resourceDefinitionId: grantRecord?.resourceId,
          totalLevel
        })
        if (!config) return []
        const max = config.max
        const used = Math.min(resourceUsage.get(resourceGrantId) ?? 0, max)
        return [
          {
            id: resourceGrantId,
            label: resource.label,
            sourceLabel: resource.sourceLabel,
            used,
            max,
            remaining: Math.max(max - used, 0),
            recovery: config.recovery
          }
        ]
      }),
      hitDice: character.state.hitpoints.hitDice.map((die) => ({
        die: die.die,
        total: die.total,
        used: die.used,
        remaining: Math.max(die.total - die.used, 0)
      }))
    },
    spells: {
      saveDc: engineOutput.derivedStats.spellSaveDC ?? null,
      attackBonus: engineOutput.derivedStats.spellAttackBonus ?? null,
      slots: spellSlots.map((slot) => ({
        ...slot,
        level: slot.level ?? parseSlotLevel(slot.slotKey)
      })),
      spells: resolution.registry.spells
        .filter((spell) => knownSpellIds.has(spell.id))
        .map((spell) => ({
          id: spell.id,
          label: spell.label,
          level: spell.level,
          school: spell.magicSchoolId,
          prepared: prepared.has(spell.id),
          known: learned.has(spell.id)
        }))
    },
    inventory: {
      items: character.state.equipment.inventory.map((item) => ({
        id: item.id,
        equipmentId: item.equipmentId,
        label: item.customName ?? equipmentLabels.get(item.equipmentId) ?? 'Unknown item',
        quantity: item.quantity,
        equipped: character.state.equipment.equipped.includes(item.id),
        attuned: character.state.equipment.attuned.includes(item.id),
        containerId: item.containerId,
        notes: item.notes
      })),
      currencies: character.state.currency.flatMap((group) => group.currencies.map((currency) => ({
        currencyId: currency.currencyId,
        label: currencyLabels.get(currency.currencyId) ?? 'Currency',
        amount: currency.amount,
        containerId: group.containerId
      })))
    },
    reference: {
      features: resolution.grants.features,
      proficiencies: [],
      defenses: [],
      senses: [],
      conditionOptions,
      equipmentOptions: resolution.registry.equipment.map((equipment) => ({
        id: equipment.id,
        label: equipment.label
      })),
      currencyOptions
    },
    notes: {
      alignment: character.profile.alignmentId,
      lifestyle: character.profile.lifestyleId,
      faith: character.profile.faith,
      gender: character.profile.gender,
      age: character.profile.age,
      appearance: [
        character.profile.height,
        character.profile.weight,
        character.profile.eyes,
        character.profile.hair,
        character.profile.skin,
        character.profile.physicalCharacteristics
      ].filter(Boolean).join(', ') || undefined,
      personalityTraits: character.profile.personalityTraits,
      ideals: character.profile.ideals,
      bonds: character.profile.bonds,
      flaws: character.profile.flaws,
      organizations: character.profile.organizations,
      allies: character.profile.allies,
      enemies: character.profile.enemies,
      backstory: character.profile.backstory,
      notes: character.profile.notes
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function restoreHitDiceForLongRest(
  hitDice: CharacterAuthored['state']['hitpoints']['hitDice']
): CharacterAuthored['state']['hitpoints']['hitDice'] {
  const totalHitDice = hitDice.reduce((total, die) => total + die.total, 0)
  let remainingRecovery = Math.max(Math.floor(totalHitDice / 2), 1)

  return hitDice.map((die) => {
    const recovered = Math.min(die.used, remainingRecovery)
    remainingRecovery -= recovered

    return {
      ...die,
      used: die.used - recovered
    }
  })
}

function clearEmptyStateArrays(character: CharacterAuthored): CharacterAuthored {
  return {
    ...character,
    state: {
      ...character.state,
      conditions: character.state.conditions?.length ? character.state.conditions : undefined,
      resources: character.state.resources?.length ? character.state.resources : undefined,
      spellSlots: character.state.spellSlots?.length ? character.state.spellSlots : undefined,
      classes: character.state.classes?.length ? character.state.classes : undefined
    }
  }
}

function ensureResource(sheet: CharacterSheetResponseDto, resourceGrantId: string) {
  const resource = sheet.resources.items.find((item) => item.id === resourceGrantId)
  if (!resource) throw new CharacterSheetCommandError(`Resource "${resourceGrantId}" is not available on this character.`)
  return resource
}

function ensureSpellSlot(sheet: CharacterSheetResponseDto, slotKey: string) {
  const slot = sheet.spells.slots.find((item) => item.slotKey === slotKey)
  if (!slot) throw new CharacterSheetCommandError(`Spell slot "${slotKey}" is not available on this character.`)
  return slot
}

function ensureInventoryItem(character: CharacterAuthored, itemId: string) {
  const item = character.state.equipment.inventory.find((candidate) => candidate.id === itemId)
  if (!item) throw new CharacterSheetCommandError(`Inventory item "${itemId}" is not on this character.`)
  return item
}

function updateResourceUsage(
  character: CharacterAuthored,
  resourceGrantId: string,
  max: number,
  updater: (used: number) => number
): CharacterAuthored {
  const existing = character.state.resources ?? []
  const next = new Map(existing.map((resource) => [resource.resourceGrantId, resource.used]))
  const used = clamp(updater(next.get(resourceGrantId) ?? 0), 0, max)
  next.set(resourceGrantId, used)

  return clearEmptyStateArrays({
    ...character,
    state: {
      ...character.state,
      resources: [...next.entries()]
        .filter(([, amount]) => amount > 0)
        .map(([id, amount]) => ({ resourceGrantId: id, used: amount }))
    }
  })
}

function updateSpellSlotUsage(
  character: CharacterAuthored,
  slotKey: string,
  max: number,
  updater: (used: number) => number
): CharacterAuthored {
  const existing = character.state.spellSlots ?? []
  const next = new Map(existing.map((slot) => [slot.slotKey, slot.used]))
  const used = clamp(updater(next.get(slotKey) ?? 0), 0, max)
  next.set(slotKey, used)

  return clearEmptyStateArrays({
    ...character,
    state: {
      ...character.state,
      spellSlots: [...next.entries()]
        .filter(([, amount]) => amount > 0)
        .map(([key, amount]) => ({ slotKey: key, used: amount }))
    }
  })
}

type CharacterSheetResourceRecovery = NonNullable<CharacterSheetResponseDto['resources']['items'][number]['recovery']>

function restoreResourcesForRecoveries(
  character: CharacterAuthored,
  sheet: CharacterSheetResponseDto,
  recoveries: readonly CharacterSheetResourceRecovery[]
): CharacterAuthored {
  const recoverySet = new Set(recoveries)
  const restorableResourceIds = new Set(
    sheet.resources.items
      .filter((resource) => resource.recovery && recoverySet.has(resource.recovery))
      .map((resource) => resource.id)
  )
  if (restorableResourceIds.size === 0) return character

  return {
    ...character,
    state: {
      ...character.state,
      resources: character.state.resources?.filter((resource) => !restorableResourceIds.has(resource.resourceGrantId))
    }
  }
}

function restoreResourcesForRest(
  character: CharacterAuthored,
  sheet: CharacterSheetResponseDto,
  recovery: CharacterSheetResourceRecovery
): CharacterAuthored {
  return restoreResourcesForRecoveries(character, sheet, [recovery])
}

function restorePactSpellSlotsForShortRest(
  character: CharacterAuthored,
  sheet: CharacterSheetResponseDto
): CharacterAuthored {
  const pactSlotKeys = new Set(
    sheet.spells.slots
      .filter((slot) => slot.slotKey === 'PACT')
      .map((slot) => slot.slotKey)
  )
  if (pactSlotKeys.size === 0) return character

  return {
    ...character,
    state: {
      ...character.state,
      spellSlots: character.state.spellSlots?.filter((slot) => !pactSlotKeys.has(slot.slotKey))
    }
  }
}

function applyShortRestRecovery(
  character: CharacterAuthored,
  sheet: CharacterSheetResponseDto
): CharacterAuthored {
  const withResources = restoreResourcesForRest(character, sheet, 'SHORT_REST')
  return restorePactSpellSlotsForShortRest(withResources, sheet)
}

function setOptionalText(value: string | null | undefined): string | undefined {
  return value == null || value.trim().length === 0 ? undefined : value
}

export function applyCharacterSheetCommand(
  character: CharacterAuthored,
  command: CharacterSheetCommandInputDto,
  sheet: CharacterSheetResponseDto
): CharacterAuthored {
  const next = structuredClone(character)

  switch (command.type) {
    case 'SET_HIT_POINTS': {
      next.state.hitpoints.temp = command.temp == null ? next.state.hitpoints.temp : command.temp
      next.state.hitpoints.maxOverride = command.maxOverride === null ? undefined : command.maxOverride ?? next.state.hitpoints.maxOverride
      const maxHitPoints = getMaxHitPoints(next)
      next.state.hitpoints.current = clamp(command.current ?? next.state.hitpoints.current, 0, maxHitPoints)
      return clearEmptyStateArrays(next)
    }

    case 'ADJUST_HIT_POINTS': {
      const maxHitPoints = sheet.overview.maxHitPoints
      if (command.mode === 'HEAL') {
        next.state.hitpoints.current = clamp(next.state.hitpoints.current + command.amount, 0, maxHitPoints)
        return clearEmptyStateArrays(next)
      }

      const currentTemp = next.state.hitpoints.temp ?? 0
      const absorbed = Math.min(currentTemp, command.amount)
      const remainingDamage = command.amount - absorbed
      next.state.hitpoints.temp = Math.max(currentTemp - absorbed, 0)
      next.state.hitpoints.current = clamp(next.state.hitpoints.current - remainingDamage, 0, maxHitPoints)
      return clearEmptyStateArrays(next)
    }

    case 'USE_HIT_DIE': {
      const hitDie = next.state.hitpoints.hitDice.find((die) => die.die === command.die)
      if (!hitDie) throw new CharacterSheetCommandError(`No d${command.die} hit dice are available on this character.`)
      if (hitDie.used >= hitDie.total) throw new CharacterSheetCommandError(`All d${command.die} hit dice are already used.`)
      next.state.hitpoints.hitDice = next.state.hitpoints.hitDice.map((die) => die.die === command.die
        ? { ...die, used: clamp(die.used + 1, 0, die.total) }
        : die)
      return clearEmptyStateArrays(next)
    }

    case 'APPLY_REST':
      if (command.restKind === 'LONG') {
        const maxHitPoints = sheet.overview.maxHitPoints
        next.state.hitpoints.current = maxHitPoints
        next.state.hitpoints.temp = 0
        next.state.hitpoints.hitDice = restoreHitDiceForLongRest(next.state.hitpoints.hitDice)
        next.state.resources = restoreResourcesForRecoveries(next, sheet, ['SHORT_REST', 'LONG_REST']).state.resources
        next.state.spellSlots = undefined
        next.state.exhaustion = next.state.exhaustion && next.state.exhaustion.level > 0
          ? { ...next.state.exhaustion, level: next.state.exhaustion.level - 1 }
          : undefined
      } else {
        return clearEmptyStateArrays(applyShortRestRecovery(next, sheet))
      }
      return clearEmptyStateArrays(next)

    case 'SET_EXHAUSTION': {
      const notes = command.notes === undefined ? next.state.exhaustion?.notes : command.notes
      next.state.exhaustion = command.level > 0
        ? { level: command.level, notes: notes || undefined }
        : undefined
      return clearEmptyStateArrays(next)
    }

    case 'ADD_CONDITION': {
      const conditionKnown = sheet.reference.conditionOptions.some((condition) => condition.id === command.conditionTypeId)
      if (!conditionKnown) throw new CharacterSheetCommandError(`Condition "${command.conditionTypeId}" is not available for this system.`)
      const existing = next.state.conditions?.filter((condition) => condition.conditionTypeId !== command.conditionTypeId) ?? []
      next.state.conditions = [
        ...existing,
        {
          conditionTypeId: command.conditionTypeId,
          notes: command.notes
        }
      ]
      return clearEmptyStateArrays(next)
    }

    case 'REMOVE_CONDITION':
      next.state.conditions = next.state.conditions?.filter((condition) => condition.conditionTypeId !== command.conditionTypeId)
      return clearEmptyStateArrays(next)

    case 'USE_RESOURCE': {
      const resource = ensureResource(sheet, command.resourceGrantId)
      return updateResourceUsage(next, command.resourceGrantId, resource.max, (used) => used + (command.amount ?? 1))
    }

    case 'RESTORE_RESOURCE': {
      const resource = ensureResource(sheet, command.resourceGrantId)
      return updateResourceUsage(next, command.resourceGrantId, resource.max, (used) => command.all ? 0 : used - (command.amount ?? 1))
    }

    case 'USE_SPELL_SLOT': {
      const slot = ensureSpellSlot(sheet, command.slotKey)
      return updateSpellSlotUsage(next, command.slotKey, slot.max, (used) => used + 1)
    }

    case 'RESTORE_SPELL_SLOT': {
      const slot = ensureSpellSlot(sheet, command.slotKey)
      return updateSpellSlotUsage(next, command.slotKey, slot.max, (used) => command.all ? 0 : used - 1)
    }

    case 'SET_PREPARED_SPELLS': {
      if (!next.intent.classes.some((classIntent) => classIntent.classId === command.classId)) {
        throw new CharacterSheetCommandError(`Class "${command.classId}" is not on this character.`)
      }
      const preparedSpellIds = [...new Set(command.spellIds)]
      const knownSpellIds = getKnownSpellIdsForClass(next, command.classId)
      const unavailableSpell = preparedSpellIds.find((spellId) => !knownSpellIds.has(spellId))
      if (unavailableSpell) throw new CharacterSheetCommandError(`Spell "${unavailableSpell}" is not available for class "${command.classId}".`)
      const existing = next.state.classes ?? []
      const currentClassState = existing.find((classState) => classState.classId === command.classId)
      const otherClasses = existing.filter((classState) => classState.classId !== command.classId)
      const preparedSpellIdSet = new Set(preparedSpellIds)
      const learned = (currentClassState?.spells?.learned ?? [])
        .filter((spellId) => !preparedSpellIdSet.has(spellId))
      const spells = {
        learned: learned.length ? learned : undefined,
        prepared: preparedSpellIds.length ? preparedSpellIds : undefined
      }
      next.state.classes = spells.learned || spells.prepared
        ? [
            ...otherClasses,
            {
              classId: command.classId,
              spells
            }
          ]
        : otherClasses
      return clearEmptyStateArrays(next)
    }

    case 'ADD_INVENTORY_ITEM': {
      const equipmentKnown = sheet.reference.equipmentOptions.some((equipment) => equipment.id === command.equipmentId)
      if (!equipmentKnown) throw new CharacterSheetCommandError(`Equipment "${command.equipmentId}" is not available for this character.`)
      next.state.equipment.inventory = [
        ...next.state.equipment.inventory,
        {
          id: crypto.randomUUID(),
          equipmentId: command.equipmentId,
          quantity: command.quantity,
          customName: command.customName,
          notes: command.notes
        }
      ]
      return clearEmptyStateArrays(next)
    }

    case 'REMOVE_INVENTORY_ITEM': {
      const existingItem = ensureInventoryItem(next, command.itemId)
      const quantityToRemove = command.quantity ?? existingItem.quantity
      const removesEntireStack = quantityToRemove >= existingItem.quantity
      next.state.equipment.inventory = removesEntireStack
        ? next.state.equipment.inventory.filter((item) => item.id !== command.itemId)
        : next.state.equipment.inventory.map((item) => item.id === command.itemId
            ? { ...item, quantity: item.quantity - quantityToRemove }
            : item)
      if (removesEntireStack) {
        next.state.equipment.equipped = next.state.equipment.equipped.filter((itemId) => itemId !== command.itemId)
        next.state.equipment.attuned = next.state.equipment.attuned.filter((itemId) => itemId !== command.itemId)
      }
      return clearEmptyStateArrays(next)
    }

    case 'UPDATE_INVENTORY_ITEM': {
      ensureInventoryItem(next, command.itemId)
      if (command.quantity === 0) {
        next.state.equipment.inventory = next.state.equipment.inventory.filter((item) => item.id !== command.itemId)
        next.state.equipment.equipped = next.state.equipment.equipped.filter((itemId) => itemId !== command.itemId)
        next.state.equipment.attuned = next.state.equipment.attuned.filter((itemId) => itemId !== command.itemId)
        return clearEmptyStateArrays(next)
      }

      next.state.equipment.inventory = next.state.equipment.inventory.map((item) => item.id === command.itemId
        ? {
            ...item,
            quantity: command.quantity ?? item.quantity,
            containerId: command.containerId === null ? undefined : command.containerId ?? item.containerId,
            customName: command.customName === null ? undefined : command.customName ?? item.customName,
            notes: command.notes === null ? undefined : command.notes ?? item.notes
          }
        : item)
      return clearEmptyStateArrays(next)
    }

    case 'EQUIP_ITEM':
      ensureInventoryItem(next, command.itemId)
      next.state.equipment.equipped = [...new Set([...next.state.equipment.equipped, command.itemId])]
      return clearEmptyStateArrays(next)

    case 'UNEQUIP_ITEM':
      ensureInventoryItem(next, command.itemId)
      next.state.equipment.equipped = next.state.equipment.equipped.filter((itemId) => itemId !== command.itemId)
      return clearEmptyStateArrays(next)

    case 'ATTUNE_ITEM':
      ensureInventoryItem(next, command.itemId)
      if (!next.state.equipment.attuned.includes(command.itemId) && next.state.equipment.attuned.length >= 3) {
        throw new CharacterSheetCommandError('A character cannot attune to more than three items.')
      }
      next.state.equipment.attuned = [...new Set([...next.state.equipment.attuned, command.itemId])]
      return clearEmptyStateArrays(next)

    case 'UNATTUNE_ITEM':
      ensureInventoryItem(next, command.itemId)
      next.state.equipment.attuned = next.state.equipment.attuned.filter((itemId) => itemId !== command.itemId)
      return clearEmptyStateArrays(next)

    case 'ADJUST_CURRENCY': {
      const currencyKnown = sheet.reference.currencyOptions.some((currency) => currency.id === command.currencyId)
      if (!currencyKnown) throw new CharacterSheetCommandError(`Currency "${command.currencyId}" is not available for this system.`)
      const groupIndex = next.state.currency.findIndex((group) => group.containerId === command.containerId)
      const groups = groupIndex >= 0 ? next.state.currency : [...next.state.currency, { containerId: command.containerId, currencies: [] }]
      const targetIndex = groupIndex >= 0 ? groupIndex : groups.length - 1
      const group = groups[targetIndex]
      if (!group) return next

      const currencyIndex = group.currencies.findIndex((currency) => currency.currencyId === command.currencyId)
      const currencies = currencyIndex >= 0
        ? group.currencies.map((currency) => currency.currencyId === command.currencyId
            ? { ...currency, amount: Math.max(currency.amount + command.amount, 0) }
            : currency)
        : [...group.currencies, { currencyId: command.currencyId, amount: Math.max(command.amount, 0) }]
      groups[targetIndex] = { ...group, currencies }
      next.state.currency = groups
      return clearEmptyStateArrays(next)
    }

    case 'UPDATE_NOTES':
      next.description = command.description === undefined ? next.description : setOptionalText(command.description)
      next.profile.personalityTraits = command.personalityTraits === undefined ? next.profile.personalityTraits : setOptionalText(command.personalityTraits)
      next.profile.ideals = command.ideals === undefined ? next.profile.ideals : setOptionalText(command.ideals)
      next.profile.bonds = command.bonds === undefined ? next.profile.bonds : setOptionalText(command.bonds)
      next.profile.flaws = command.flaws === undefined ? next.profile.flaws : setOptionalText(command.flaws)
      next.profile.organizations = command.organizations === undefined ? next.profile.organizations : setOptionalText(command.organizations)
      next.profile.allies = command.allies === undefined ? next.profile.allies : setOptionalText(command.allies)
      next.profile.enemies = command.enemies === undefined ? next.profile.enemies : setOptionalText(command.enemies)
      next.profile.backstory = command.backstory === undefined ? next.profile.backstory : setOptionalText(command.backstory)
      next.profile.notes = command.notes === undefined ? next.profile.notes : setOptionalText(command.notes)
      return clearEmptyStateArrays(next)

    default:
      return next
  }
}

export function summarizeCharacterSheetCommand(command: CharacterSheetCommandInputDto): string {
  switch (command.type) {
    case 'SET_HIT_POINTS':
      return 'Hit points updated'
    case 'ADJUST_HIT_POINTS':
      return command.mode === 'DAMAGE' ? `${command.amount} damage applied` : `${command.amount} HP restored`
    case 'USE_HIT_DIE':
      return `Used one d${command.die} hit die`
    case 'APPLY_REST':
      return command.restKind === 'LONG' ? 'Long rest applied' : 'Short rest applied'
    case 'SET_EXHAUSTION':
      return command.level > 0 ? `Exhaustion set to level ${command.level}` : 'Exhaustion cleared'
    case 'ADD_CONDITION':
      return 'Condition added'
    case 'REMOVE_CONDITION':
      return 'Condition removed'
    case 'USE_RESOURCE':
      return 'Resource used'
    case 'RESTORE_RESOURCE':
      return 'Resource restored'
    case 'USE_SPELL_SLOT':
      return 'Spell slot used'
    case 'RESTORE_SPELL_SLOT':
      return 'Spell slot restored'
    case 'SET_PREPARED_SPELLS':
      return 'Prepared spells updated'
    case 'ADD_INVENTORY_ITEM':
      return 'Inventory item added'
    case 'REMOVE_INVENTORY_ITEM':
      return 'Inventory item removed'
    case 'UPDATE_INVENTORY_ITEM':
      return 'Inventory item updated'
    case 'EQUIP_ITEM':
      return 'Item equipped'
    case 'UNEQUIP_ITEM':
      return 'Item unequipped'
    case 'ATTUNE_ITEM':
      return 'Item attuned'
    case 'UNATTUNE_ITEM':
      return 'Item unattuned'
    case 'ADJUST_CURRENCY':
      return 'Currency updated'
    case 'UPDATE_NOTES':
      return 'Notes updated'
    default:
      return 'Sheet updated'
  }
}

export async function executeCharacterSheetCommand(params: {
  db: DBLike
  characterId: string
  command: CharacterSheetCommandInputDto
  userId: string
}): Promise<CharacterSheetCommandResponseDto> {
  const repository = createCharacterRepository(params.db)
  const [row, character] = await Promise.all([
    repository.findById(params.characterId),
    repository.findAuthoredById(params.characterId)
  ])
  if (!character || !row) {
    throw createNamedError('NotFoundError', `Character "${params.characterId}" was not found.`)
  }

  if (character.userId !== params.userId) {
    throw createNamedError('AuthoredContentOwnershipError', `Character "${params.characterId}" cannot be updated by the current user.`)
  }

  if ((character.status ?? AUTHORED_RECORD_STATUS.ACTIVE) !== AUTHORED_RECORD_STATUS.ACTIVE) {
    throw new CharacterSheetCommandError(`Character "${params.characterId}" is not finalized yet.`)
  }

  if (row.stream_version !== params.command.expectedVersion) {
    throw new ConcurrencyError(params.characterId, params.command.expectedVersion)
  }

  const resolution = await resolveCharacterBuilder(params.db, character, 'edit')
  const currentSheet = await buildCharacterSheetResponse({
    db: params.db,
    character,
    resolution,
    streamVersion: row.stream_version
  })
  const nextCharacter = applyCharacterSheetCommand(character, params.command, currentSheet)
  const summary = summarizeCharacterSheetCommand(params.command)
  const event = {
    type: 'CHARACTER_SHEET_COMMAND_APPLIED',
    eventId: crypto.randomUUID(),
    characterId: params.characterId,
    occurredAt: new Date().toISOString(),
    actorId: params.userId,
    commandId: params.command.commandId ?? crypto.randomUUID(),
    schemaVersion: 1,
    commandType: params.command.type,
    summary
  } satisfies CharacterEvent
  const nextStreamVersion = await repository.upsertAuthored(nextCharacter, {
    expectedStreamVersion: params.command.expectedVersion,
    incrementStreamVersion: true,
    afterPersist: async (trx) => {
      await createCharacterEventRepository(trx).append(event)
    }
  })

  const persisted = await repository.findAuthoredById(params.characterId)
  const sheet = await buildCharacterSheetResponse({
    db: params.db,
    character: persisted ?? nextCharacter,
    resolution: await resolveCharacterBuilder(params.db, persisted ?? nextCharacter, 'edit'),
    streamVersion: nextStreamVersion
  })
  const historyEntry: CharacterHistoryEntryDto = {
    eventId: event.eventId,
    occurredAt: event.occurredAt,
    actorId: event.actorId,
    eventType: event.type,
    summary
  }

  return {
    characterId: params.characterId,
    streamVersion: nextStreamVersion,
    sheet,
    historyEntry
  }
}
