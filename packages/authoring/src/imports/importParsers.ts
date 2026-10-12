import type {
  ArtificerPortableContentDto,
  ImportIssueDto,
  JsonImportEntryDto
} from '@artificer-toolkit/schema/api/imports'
import {
  artificerPortableContentDtoSchema,
  IMPORT_MAX_FOUNDRY_ITEMS
} from '@artificer-toolkit/schema/api/imports'
import type { AuthoredSubjectKindDto } from '@artificer-toolkit/schema/api/content'
import {
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_GRIP,
  EQUIPMENT_PROPERTY_CODE,
  MEASUREMENT_UNIT_CODE,
  type EquipmentCategoryCode,
  type EquipmentGrip,
  type EquipmentPropertyCode
} from '@artificer-toolkit/shared/core'

export type ImportReferenceRole =
  | 'RACE'
  | 'BACKGROUND'
  | 'CLASS'
  | 'SUBCLASS'
  | 'EQUIPMENT'
  | 'FEAT'
  | 'SPELL'

export interface ExternalContentReference {
  role: ImportReferenceRole
  subjectKind: AuthoredSubjectKindDto
  externalId?: string
  nativeId?: string
  label: string
  path: Array<string | number>
  level?: number
  quantity?: number
  equipped?: boolean
  attuned?: boolean
}

/**
 * A custom weapon's attack as the source states it. Damage types are named, not identified: the
 * import runner resolves the name to the System's damage-type vocabulary and builds the attack
 * effects (`applyImportedWeaponAttack`).
 */
export interface ImportedWeaponAttack {
  damageTypeName: string
  dice: string
  /** The two-handed dice of a versatile weapon, when the source states them. */
  versatileDice?: string
  grip: EquipmentGrip
  /** Present when the weapon makes a melee attack. */
  meleeReachFeet?: number
  /** Present when the weapon makes a ranged attack, including a thrown melee weapon. */
  ranged?: { normalFeet: number; longFeet?: number }
}

export interface ExternalCustomContent {
  subjectKind: AuthoredSubjectKindDto
  externalId: string
  label: string
  path: Array<string | number>
  payload: Record<string, unknown>
  weaponAttack?: ImportedWeaponAttack
  /** Flat bonus a magic weapon adds to attack and damage rolls, or a magic armor adds to AC. */
  magicBonus?: number
  /** The source's rarity name; preparation resolves it against the System's rarity vocabulary. */
  rarityName?: string
  /** The source's price in gold pieces; preparation resolves it through the System's currencies. */
  costGold?: number
  /** The Strength score armor needs to avoid the speed penalty. Armor only; absent when none. */
  strengthRequirement?: number
  /** Whether the armor gives its wearer disadvantage on Stealth checks. Armor only. */
  stealthDisadvantage?: boolean
}

export interface ParsedExternalCharacter {
  externalId: string
  label: string
  description?: string
  profile: Record<string, string>
  abilities?: Record<
    'STRENGTH' | 'DEXTERITY' | 'CONSTITUTION' | 'INTELLIGENCE' | 'WISDOM' | 'CHARISMA',
    number
  >
  hitPoints?: { current: number; temp?: number }
  references: ExternalContentReference[]
  customContent: ExternalCustomContent[]
  issues: ImportIssueDto[]
}

const DND_BEYOND_HOSTS = new Set(['dndbeyond.com', 'www.dndbeyond.com'])
const DND_BEYOND_CHARACTER_PATH = /^\/characters\/(\d+)\/?$/

export function parseDndBeyondCharacterUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !DND_BEYOND_HOSTS.has(url.hostname.toLowerCase())) return null
    return DND_BEYOND_CHARACTER_PATH.exec(url.pathname)?.[1] ?? null
  } catch {
    return null
  }
}

export function parseDndBeyondCharacterPayload(
  payload: unknown,
  expectedCharacterId: string
): ParsedExternalCharacter | null {
  const envelope = asRecord(payload)
  const source = asRecord(envelope?.data) ?? envelope
  if (!source) return null

  const label = readString(source.name)
  if (!label) return null

  const externalId = readIdentifier(source.id) ?? expectedCharacterId
  const traits = asRecord(source.traits)
  const notes = asRecord(source.notes)
  const references: ExternalContentReference[] = []
  const customContent: ExternalCustomContent[] = []
  const customContentKeys = new Set<string>()
  const issues: ImportIssueDto[] = []
  const addCustomContent = (content: ExternalCustomContent) => {
    const key = `${content.subjectKind}:${content.externalId}`
    if (customContentKeys.has(key)) return
    customContentKeys.add(key)
    customContent.push(content)
  }

  const race = asRecord(source.race)
  if (race) {
    references.push({
      role: 'RACE',
      subjectKind: 'RACE',
      externalId:
        readIdentifier(race.baseRaceId) ??
        readIdentifier(race.entityRaceId) ??
        readIdentifier(race.id),
      label:
        readString(race.fullName) ??
        readString(race.baseRaceName) ??
        readString(race.name) ??
        'Imported race',
      path: ['race']
    })
  }

  const background = asRecord(source.background)
  const backgroundDefinition = asRecord(background?.definition) ?? background
  if (backgroundDefinition) {
    references.push({
      role: 'BACKGROUND',
      subjectKind: 'BACKGROUND',
      externalId: readIdentifier(backgroundDefinition.id),
      label: readString(backgroundDefinition.name) ?? 'Imported background',
      path: ['background']
    })
  }

  for (const [index, classValue] of asArray(source.classes).entries()) {
    const classRecord = asRecord(classValue)
    const definition = asRecord(classRecord?.definition)
    if (!classRecord || !definition) continue
    references.push({
      role: 'CLASS',
      subjectKind: 'CLASS',
      externalId: readIdentifier(definition.id),
      label: readString(definition.name) ?? 'Imported class',
      level: readInteger(classRecord.level) ?? 1,
      path: ['classes', index]
    })

    const subclass = asRecord(classRecord.subclassDefinition)
    if (subclass) {
      references.push({
        role: 'SUBCLASS',
        subjectKind: 'CLASS',
        externalId: readIdentifier(subclass.id),
        label: readString(subclass.name) ?? 'Imported subclass',
        path: ['classes', index, 'subclassDefinition']
      })
    }
  }

  for (const [index, itemValue] of asArray(source.inventory).entries()) {
    const item = asRecord(itemValue)
    const definition = asRecord(item?.definition)
    if (!item || !definition) continue
    const itemExternalId = readIdentifier(definition.id)
    const itemLabel = readString(definition.name) ?? 'Imported equipment'
    references.push({
      role: 'EQUIPMENT',
      subjectKind: 'EQUIPMENT',
      externalId: itemExternalId,
      label: itemLabel,
      quantity: readPositiveInteger(item.quantity) ?? 1,
      equipped: item.equipped === true,
      attuned: item.isAttuned === true,
      path: ['inventory', index]
    })
    if (itemExternalId && isDndBeyondCustomDefinition(definition)) {
      addCustomContent(
        customEquipmentContent(
          {
            externalId: itemExternalId,
            label: itemLabel,
            path: ['inventory', index, 'definition'],
            description: readString(definition.description)
          },
          mapDndBeyondEquipment(definition),
          issues
        )
      )
    }
  }

  for (const [index, customValue] of asArray(source.customItems).entries()) {
    const custom = asRecord(customValue)
    if (!custom) continue
    addCustomContent(
      customEquipmentContent(
        {
          externalId: readIdentifier(custom.id) ?? `custom-item-${index + 1}`,
          label: readString(custom.name) ?? `Imported custom item ${index + 1}`,
          path: ['customItems', index],
          description: readString(custom.description)
        },
        mapDndBeyondEquipment(custom),
        issues
      )
    )
  }

  const hasSpecificSubrace =
    readIdentifier(race?.baseRaceId) !== undefined &&
    readIdentifier(race?.entityRaceId) !== undefined &&
    readIdentifier(race?.baseRaceId) !== readIdentifier(race?.entityRaceId)
  const unsupportedMechanicsPath =
    [
      'modifiers',
      'options',
      'choices',
      'actions',
      'conditions',
      'deathSaves',
      'features',
      'campaign',
      'campaignId'
    ].find((key) => source[key] !== undefined) ?? (hasSpecificSubrace ? 'race' : undefined)
  if (unsupportedMechanicsPath) {
    issues.push(
      issue(
        'INFO',
        'DND_BEYOND_MECHANICS_NOT_IMPORTED',
        'D&D Beyond modifiers, options, conditions, subrace intent, and campaign-specific rules were not imported.',
        [unsupportedMechanicsPath],
        false
      )
    )
  }
  for (const [index, value] of asArray(source.feats).entries()) {
    const record = asRecord(value)
    const definition = asRecord(record?.definition) ?? record
    if (!definition) continue
    const featId = readIdentifier(definition.id)
    const featLabel = readString(definition.name) ?? 'Imported feat'
    references.push({
      role: 'FEAT',
      subjectKind: 'FEAT',
      externalId: featId,
      label: featLabel,
      path: ['feats', index]
    })
    if (featId && isDndBeyondCustomDefinition(definition)) {
      addCustomContent({
        subjectKind: 'FEAT',
        externalId: featId,
        label: featLabel,
        path: ['feats', index, 'definition'],
        payload: {
          label: featLabel,
          description: sanitizeImportedRichText(readString(definition.description) ?? '')
        }
      })
    }
  }

  const spellEntries: Array<{ value: unknown; path: Array<string | number> }> = []
  const spellsBySource = asRecord(source.spells)
  if (spellsBySource) {
    for (const [sourceName, spells] of Object.entries(spellsBySource)) {
      for (const [index, value] of asArray(spells).entries()) {
        spellEntries.push({ value, path: ['spells', sourceName, index] })
      }
    }
  } else {
    for (const [index, value] of asArray(source.spells).entries()) {
      spellEntries.push({ value, path: ['spells', index] })
    }
  }
  for (const [groupIndex, groupValue] of asArray(source.classSpells).entries()) {
    const group = asRecord(groupValue)
    for (const [spellIndex, value] of asArray(group?.spells).entries()) {
      spellEntries.push({ value, path: ['classSpells', groupIndex, 'spells', spellIndex] })
    }
  }

  const seenSpellIds = new Set<string>()
  for (const { value, path } of spellEntries) {
    const record = asRecord(value)
    const definition = asRecord(record?.definition) ?? record
    if (!definition) continue
    const spellId = readIdentifier(definition.id)
    if (spellId && seenSpellIds.has(spellId)) continue
    if (spellId) seenSpellIds.add(spellId)
    const spellLabel = readString(definition.name) ?? 'Imported spell'
    references.push({
      role: 'SPELL',
      subjectKind: 'SPELL',
      externalId: spellId,
      label: spellLabel,
      path
    })
    if (spellId && isDndBeyondCustomDefinition(definition)) {
      addCustomContent({
        subjectKind: 'SPELL',
        externalId: spellId,
        label: spellLabel,
        path: [...path, 'definition'],
        payload: {
          label: spellLabel,
          description: sanitizeImportedRichText(readString(definition.description) ?? '')
        }
      })
    }
  }

  return {
    externalId,
    label,
    description: readString(source.readonlyUrl),
    profile: compactStrings({
      personalityTraits: readString(traits?.personalityTraits),
      ideals: readString(traits?.ideals),
      bonds: readString(traits?.bonds),
      flaws: readString(traits?.flaws),
      physicalCharacteristics: readString(traits?.appearance),
      organizations: readString(notes?.organizations),
      allies: readString(notes?.allies),
      enemies: readString(notes?.enemies),
      backstory: readString(notes?.backstory),
      notes: readString(notes?.otherNotes)
    }),
    abilities: parseDndBeyondAbilities(source),
    hitPoints: parseDndBeyondHitPoints(source),
    references,
    customContent,
    issues
  }
}

export function parseFoundryActorPayload(payload: unknown): ParsedExternalCharacter | null {
  const source = asRecord(payload)
  if (!source) return null
  const stats = asRecord(source._stats)
  const explicitSystemId = readString(stats?.systemId)
  if (explicitSystemId?.toLowerCase() !== 'dnd5e') return null
  if (source.type !== 'character' || !asRecord(source.system) || !Array.isArray(source.items)) {
    return null
  }
  if (source.items.length > IMPORT_MAX_FOUNDRY_ITEMS) return null

  const label = readString(source.name)
  if (!label) return null

  const externalId = readIdentifier(source._id) ?? readIdentifier(source.id)
  if (!externalId) return null

  const system = asRecord(source.system)!
  const details = asRecord(system.details)
  const biography = asRecord(details?.biography)
  const references: ExternalContentReference[] = []
  const customContent: ExternalCustomContent[] = []
  const issues: ImportIssueDto[] = [
    issue(
      'WARNING',
      'FOUNDRY_MECHANICS_REQUIRE_REVIEW',
      'Foundry-specific active effects, automation, advancement, and module data cannot be reconstructed automatically and require review.',
      ['system'],
      true
    )
  ]

  if (
    source.prototypeToken !== undefined ||
    source.token !== undefined ||
    source.folder !== undefined ||
    source.sort !== undefined ||
    source.ownership !== undefined
  ) {
    issues.push(
      issue(
        'INFO',
        'IGNORED_FOUNDRY_PRESENTATION',
        'Foundry token, folder, sorting, ownership, and UI data will not be imported.',
        [],
        false
      )
    )
  }

  for (const [index, value] of source.items.entries()) {
    const item = asRecord(value)
    if (!item) continue
    const type = readString(item.type)?.toLowerCase()
    const itemLabel = readString(item.name) ?? `Imported item ${index + 1}`
    const itemExternalId = readIdentifier(item._id) ?? readIdentifier(item.id)
    const itemSystem = asRecord(item.system)
    const nativeId = readNestedString(item, ['flags', 'artificer', 'subjectId'])
    const path = ['items', index]
    const common = {
      externalId: itemExternalId,
      nativeId,
      label: itemLabel,
      path
    }

    if (type === 'class') {
      references.push({
        ...common,
        role: 'CLASS',
        subjectKind: 'CLASS',
        level: readPositiveInteger(itemSystem?.levels) ?? 1
      })
      continue
    }
    if (type === 'subclass') {
      references.push({ ...common, role: 'SUBCLASS', subjectKind: 'CLASS' })
      continue
    }
    if (type === 'race') {
      references.push({ ...common, role: 'RACE', subjectKind: 'RACE' })
      continue
    }
    if (type === 'background') {
      references.push({ ...common, role: 'BACKGROUND', subjectKind: 'BACKGROUND' })
      continue
    }

    const equipmentType =
      type === 'weapon' ||
      type === 'equipment' ||
      type === 'consumable' ||
      type === 'tool' ||
      type === 'loot' ||
      type === 'backpack'
    if (equipmentType) {
      if (isFoundryCustomItem(item)) {
        if (!itemExternalId) {
          issues.push(
            issue(
              'WARNING',
              'CUSTOM_CONTENT_MISSING_ID',
              `Custom equipment "${itemLabel}" has no stable Foundry id and cannot be linked.`,
              path,
              true
            )
          )
          continue
        }
        customContent.push(
          customEquipmentContent(
            {
              externalId: itemExternalId,
              label: itemLabel,
              path,
              description: itemSystem
                ? readNestedString(itemSystem, ['description', 'value'])
                : undefined
            },
            mapFoundryEquipment(type, itemSystem),
            issues
          )
        )
      }
      references.push({
        ...common,
        role: 'EQUIPMENT',
        subjectKind: 'EQUIPMENT',
        quantity: readPositiveInteger(itemSystem?.quantity) ?? 1,
        equipped: itemSystem ? readNestedBoolean(itemSystem, ['equipped']) : false,
        attuned: itemSystem ? readNestedNumber(itemSystem, ['attunement']) === 2 : false
      })
      continue
    }

    if (type === 'feat' || type === 'spell') {
      const subjectKind = type === 'feat' ? 'FEAT' : 'SPELL'
      if (isFoundryCustomItem(item) && itemExternalId) {
        customContent.push({
          subjectKind,
          externalId: itemExternalId,
          label: itemLabel,
          path,
          payload: {
            label: itemLabel,
            description: sanitizeImportedRichText(
              itemSystem ? readNestedString(itemSystem, ['description', 'value']) : undefined
            )
          }
        })
      } else {
        references.push({
          ...common,
          role: subjectKind,
          subjectKind
        })
      }
      continue
    }

    issues.push(
      issue(
        'WARNING',
        'UNSUPPORTED_FOUNDRY_ITEM',
        `Foundry item "${itemLabel}" (${type ?? 'unknown type'}) is not supported.`,
        path,
        true
      )
    )
  }

  const abilities = parseFoundryAbilities(system)
  const hp = asRecord(asRecord(system.attributes)?.hp)
  const hpCurrent = readNonnegativeInteger(hp?.value)
  const hpTemp = readNonnegativeInteger(hp?.temp)

  return {
    externalId,
    label,
    description: sanitizeImportedRichText(readString(biography?.value) ?? ''),
    profile: compactStrings({
      backstory: sanitizeImportedRichText(readString(biography?.value)),
      physicalCharacteristics: readString(details?.appearance),
      personalityTraits: readString(details?.trait),
      ideals: readString(details?.ideal),
      bonds: readString(details?.bond),
      flaws: readString(details?.flaw)
    }),
    abilities,
    hitPoints:
      hpCurrent === undefined
        ? undefined
        : { current: hpCurrent, ...(hpTemp ? { temp: hpTemp } : {}) },
    references,
    customContent,
    issues
  }
}

export function parseArtificerPortableEntry(
  entry: JsonImportEntryDto
): { envelope: ArtificerPortableContentDto; issues: ImportIssueDto[] } | null {
  try {
    const parsedJson: unknown = JSON.parse(entry.text)
    const parsed = artificerPortableContentDtoSchema.safeParse(parsedJson)
    if (!parsed.success) return null
    return { envelope: parsed.data, issues: [] }
  } catch {
    return null
  }
}

export function sanitizeImportedValue(value: unknown, key?: string): unknown {
  if (typeof value === 'string') {
    return isRichTextKey(key) ? sanitizeImportedRichText(value) : value
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeImportedValue(item, key))
  const record = asRecord(value)
  if (!record) return value
  return Object.fromEntries(
    Object.entries(record).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeImportedValue(entryValue, entryKey)
    ])
  )
}

export function sanitizeImportedRichText(value: string | undefined): string {
  if (!value) return ''
  const withoutDangerousElements = value
    .replace(
      /<\s*(script|style|iframe|object|embed|svg|math|template|form|textarea|button)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      ''
    )
    .replace(
      /<\s*\/?\s*(script|style|iframe|object|embed|svg|math|template|form|textarea|button|link|meta|base|input|img|video|audio|source)\b[^>]*>/gi,
      ''
    )

  return withoutDangerousElements.replace(
    /<\s*(\/?)\s*([a-z][a-z0-9]*)\b[^>]*>/gi,
    (_match, closing: string, tag: string) => {
      const normalizedTag = tag.toLowerCase()
      if (!IMPORTED_RICH_TEXT_TAGS.has(normalizedTag)) return ''
      return `<${closing ? '/' : ''}${normalizedTag}>`
    }
  )
}

const IMPORTED_RICH_TEXT_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strong',
  'u',
  'ul'
])

function parseDndBeyondAbilities(
  source: Record<string, unknown>
): ParsedExternalCharacter['abilities'] | undefined {
  const byId = new Map<number, number>()
  for (const value of asArray(source.stats)) {
    const stat = asRecord(value)
    const id = readInteger(stat?.id)
    const score = readInteger(stat?.value)
    if (id !== undefined && score !== undefined) byId.set(id, score)
  }
  if ([1, 2, 3, 4, 5, 6].some((id) => !byId.has(id))) return undefined
  return {
    STRENGTH: byId.get(1)!,
    DEXTERITY: byId.get(2)!,
    CONSTITUTION: byId.get(3)!,
    INTELLIGENCE: byId.get(4)!,
    WISDOM: byId.get(5)!,
    CHARISMA: byId.get(6)!
  }
}

function parseDndBeyondHitPoints(
  source: Record<string, unknown>
): ParsedExternalCharacter['hitPoints'] | undefined {
  const override = readNonnegativeInteger(source.overrideHitPoints)
  const base = override ?? readNonnegativeInteger(source.baseHitPoints)
  if (base === undefined) return undefined
  const bonus = readNonnegativeInteger(source.bonusHitPoints) ?? 0
  const removed = readNonnegativeInteger(source.removedHitPoints) ?? 0
  const temp = readNonnegativeInteger(source.temporaryHitPoints)
  return {
    current: Math.max(0, base + bonus - removed),
    ...(temp ? { temp } : {})
  }
}

function parseFoundryAbilities(
  system: Record<string, unknown>
): ParsedExternalCharacter['abilities'] | undefined {
  const abilities = asRecord(system.abilities)
  if (!abilities) return undefined
  const keys = [
    ['str', 'STRENGTH'],
    ['dex', 'DEXTERITY'],
    ['con', 'CONSTITUTION'],
    ['int', 'INTELLIGENCE'],
    ['wis', 'WISDOM'],
    ['cha', 'CHARISMA']
  ] as const
  const result = {} as NonNullable<ParsedExternalCharacter['abilities']>
  for (const [sourceKey, targetKey] of keys) {
    const score = readInteger(asRecord(abilities[sourceKey])?.value)
    if (score === undefined) return undefined
    result[targetKey] = score
  }
  return result
}

function isFoundryCustomItem(item: Record<string, unknown>): boolean {
  return (
    readNestedString(item, ['flags', 'core', 'sourceId']) === undefined &&
    readNestedString(item, ['_stats', 'compendiumSource']) === undefined
  )
}

interface MappedEquipment {
  category: EquipmentCategoryCode
  properties: EquipmentPropertyCode[]
  armorClass?: number
  requiresAttunement?: boolean
  weaponAttack?: ImportedWeaponAttack
  /** A weapon whose attack the source does not state in a form this import can read exactly. */
  weaponAttackUnreadable?: boolean
  magicBonus?: number
  rarityName?: string
  costGold?: number
  weightPounds?: number
  strengthRequirement?: number
  stealthDisadvantage?: boolean
}

const DND_BEYOND_STEALTH_DISADVANTAGE = 2

const DND_BEYOND_WEAPON_PROPERTIES: Record<string, EquipmentPropertyCode> = {
  'two-handed': EQUIPMENT_PROPERTY_CODE.TWO_HANDED,
  versatile: EQUIPMENT_PROPERTY_CODE.VERSATILE,
  finesse: EQUIPMENT_PROPERTY_CODE.FINESSE,
  light: EQUIPMENT_PROPERTY_CODE.LIGHT,
  heavy: EQUIPMENT_PROPERTY_CODE.HEAVY,
  thrown: EQUIPMENT_PROPERTY_CODE.THROWN,
  reach: EQUIPMENT_PROPERTY_CODE.REACH,
  ammunition: EQUIPMENT_PROPERTY_CODE.AMMUNITION,
  loading: EQUIPMENT_PROPERTY_CODE.LOADING,
  special: EQUIPMENT_PROPERTY_CODE.SPECIAL
}

const DND_BEYOND_ARMOR_WEIGHT: Record<number, EquipmentPropertyCode> = {
  1: EQUIPMENT_PROPERTY_CODE.LIGHT,
  2: EQUIPMENT_PROPERTY_CODE.MEDIUM,
  3: EQUIPMENT_PROPERTY_CODE.HEAVY
}
const DND_BEYOND_SHIELD_ARMOR_TYPE = 4
const DND_BEYOND_TOOL_GEAR_TYPE = 11
/** `filterType` values (lower-cased) that name a kind of item the Equipment properties can state. */
const DND_BEYOND_ITEM_KIND_PROPERTIES: Record<string, EquipmentPropertyCode> = {
  'wondrous item': EQUIPMENT_PROPERTY_CODE.WONDEROUS_ITEM,
  potion: EQUIPMENT_PROPERTY_CODE.POTION,
  scroll: EQUIPMENT_PROPERTY_CODE.SCROLL
}

const FOUNDRY_WEAPON_PROPERTIES: Record<string, EquipmentPropertyCode> = {
  two: EQUIPMENT_PROPERTY_CODE.TWO_HANDED,
  ver: EQUIPMENT_PROPERTY_CODE.VERSATILE,
  fin: EQUIPMENT_PROPERTY_CODE.FINESSE,
  lgt: EQUIPMENT_PROPERTY_CODE.LIGHT,
  hvy: EQUIPMENT_PROPERTY_CODE.HEAVY,
  thr: EQUIPMENT_PROPERTY_CODE.THROWN,
  rch: EQUIPMENT_PROPERTY_CODE.REACH,
  amm: EQUIPMENT_PROPERTY_CODE.AMMUNITION,
  lod: EQUIPMENT_PROPERTY_CODE.LOADING,
  spc: EQUIPMENT_PROPERTY_CODE.SPECIAL,
  mgc: EQUIPMENT_PROPERTY_CODE.MAGIC
}

const FOUNDRY_ARMOR_WEIGHT: Record<string, EquipmentPropertyCode> = {
  light: EQUIPMENT_PROPERTY_CODE.LIGHT,
  medium: EQUIPMENT_PROPERTY_CODE.MEDIUM,
  heavy: EQUIPMENT_PROPERTY_CODE.HEAVY
}

const WEAPON_DICE = /^\s*(\d+d\d+)(?:\s*\+\s*@mod)?\s*$/

function readWeaponDice(value: unknown): string | undefined {
  return typeof value === 'string' ? WEAPON_DICE.exec(value)?.[1] : undefined
}

function buildWeaponAttack(input: {
  damageTypeName: string | undefined
  dice: string | undefined
  versatileDice: string | undefined
  properties: EquipmentPropertyCode[]
  rangedWeapon: boolean
  normalFeet: number | undefined
  longFeet: number | undefined
}): ImportedWeaponAttack | undefined {
  const { damageTypeName, dice, properties, rangedWeapon, normalFeet, longFeet } = input
  const twoHanded = properties.includes(EQUIPMENT_PROPERTY_CODE.TWO_HANDED)
  const makesRangedAttack = rangedWeapon || properties.includes(EQUIPMENT_PROPERTY_CODE.THROWN)
  if (!damageTypeName || !dice) return undefined
  if (makesRangedAttack && normalFeet === undefined) return undefined
  return {
    damageTypeName,
    dice,
    ...(input.versatileDice && !twoHanded ? { versatileDice: input.versatileDice } : {}),
    grip: twoHanded ? EQUIPMENT_GRIP.TWO_HANDED : EQUIPMENT_GRIP.ONE_HANDED,
    ...(rangedWeapon
      ? {}
      : {
          meleeReachFeet: properties.includes(EQUIPMENT_PROPERTY_CODE.REACH) ? 10 : 5
        }),
    ...(makesRangedAttack && normalFeet !== undefined
      ? {
          ranged: {
            normalFeet,
            ...(longFeet !== undefined && longFeet > normalFeet ? { longFeet } : {})
          }
        }
      : {})
  }
}

function mapDndBeyondEquipment(definition: Record<string, unknown>): MappedEquipment {
  const filterType = readString(definition.filterType)?.toLowerCase()
  const armorTypeId = readInteger(definition.armorTypeId)
  const magic: EquipmentPropertyCode[] =
    definition.magic === true ? [EQUIPMENT_PROPERTY_CODE.MAGIC] : []
  const rarityName = readString(definition.rarity)
  const costGold = readPositiveNumber(definition.cost)
  const weightPounds = readPositiveNumber(definition.weight)
  const shared = {
    ...(definition.canAttune === true ? { requiresAttunement: true } : {}),
    ...(rarityName ? { rarityName } : {}),
    ...(costGold === undefined ? {} : { costGold }),
    ...(weightPounds === undefined ? {} : { weightPounds })
  }

  if (filterType === 'armor') {
    const shield = armorTypeId === DND_BEYOND_SHIELD_ARMOR_TYPE
    const weight = armorTypeId === undefined ? undefined : DND_BEYOND_ARMOR_WEIGHT[armorTypeId]
    const armorClass = readInteger(definition.armorClass)
    const magicBonus = readDndBeyondMagicBonus(definition, 'armor-class')
    const strengthRequirement = shield
      ? undefined
      : readPositiveInteger(definition.strengthRequirement)
    return {
      category: shield ? EQUIPMENT_CATEGORY_CODE.SHIELD : EQUIPMENT_CATEGORY_CODE.ARMOR,
      properties: [...(weight && !shield ? [weight] : []), ...magic],
      ...(armorClass === undefined ? {} : { armorClass }),
      ...(magicBonus === undefined ? {} : { magicBonus }),
      ...(strengthRequirement === undefined ? {} : { strengthRequirement }),
      // D&D Beyond's stealthCheck: 1 is no penalty, 2 is disadvantage.
      ...(!shield && readInteger(definition.stealthCheck) === DND_BEYOND_STEALTH_DISADVANTAGE
        ? { stealthDisadvantage: true }
        : {}),
      ...shared
    }
  }

  if (filterType !== 'weapon') {
    const tool =
      readInteger(definition.gearTypeId) === DND_BEYOND_TOOL_GEAR_TYPE ||
      readString(definition.subType)?.toLowerCase() === 'tool'
    const itemKind = filterType ? DND_BEYOND_ITEM_KIND_PROPERTIES[filterType] : undefined
    return {
      category: tool ? EQUIPMENT_CATEGORY_CODE.TOOL : EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
      properties: [...(itemKind ? [itemKind] : []), ...magic],
      ...shared
    }
  }

  const rangedWeapon = readInteger(definition.attackType) === 2
  const named = asArray(definition.properties).flatMap((value) => {
    const property = asRecord(value)
    const code = DND_BEYOND_WEAPON_PROPERTIES[readString(property?.name)?.toLowerCase() ?? '']
    return code ? [{ code, notes: readString(property?.notes) }] : []
  })
  const properties = [
    rangedWeapon ? EQUIPMENT_PROPERTY_CODE.RANGED : EQUIPMENT_PROPERTY_CODE.MELEE,
    ...named.map(({ code }) => code),
    ...magic
  ]
  const weaponAttack = buildWeaponAttack({
    damageTypeName: readString(definition.damageType),
    dice: readWeaponDice(asRecord(definition.damage)?.diceString),
    versatileDice: readWeaponDice(
      named.find(({ code }) => code === EQUIPMENT_PROPERTY_CODE.VERSATILE)?.notes
    ),
    properties,
    rangedWeapon,
    normalFeet: readPositiveInteger(definition.range),
    longFeet: readPositiveInteger(definition.longRange)
  })
  const magicBonus = readDndBeyondMagicBonus(definition, 'magic')
  return {
    category: EQUIPMENT_CATEGORY_CODE.WEAPON,
    properties: [...new Set(properties)],
    ...(magicBonus === undefined ? {} : { magicBonus }),
    ...shared,
    ...(weaponAttack ? { weaponAttack } : { weaponAttackUnreadable: true })
  }
}

/** The flat bonus a definition's granted `bonus` modifier of the given subtype adds, if any. */
function readDndBeyondMagicBonus(
  definition: Record<string, unknown>,
  subType: 'magic' | 'armor-class'
): number | undefined {
  for (const value of asArray(definition.grantedModifiers)) {
    const modifier = asRecord(value)
    const bonus = readPositiveInteger(modifier?.value)
    if (
      bonus !== undefined &&
      readString(modifier?.type) === 'bonus' &&
      readString(modifier?.subType) === subType
    )
      return bonus
  }
  return undefined
}

function readFoundryDamage(damage: Record<string, unknown> | null): {
  damageTypeName?: string
  dice?: string
  versatileDice?: string
} {
  if (!damage) return {}
  const rollDice = (value: unknown): string | undefined => {
    const roll = asRecord(value)
    const number = readPositiveInteger(roll?.number)
    const denomination = readPositiveInteger(roll?.denomination)
    return number && denomination ? `${number}d${denomination}` : undefined
  }
  const versatileDice = rollDice(damage.versatile) ?? readWeaponDice(damage.versatile)
  const base = asRecord(damage.base)
  if (base) {
    const types = asArray(base.types).flatMap((type) => readString(type) ?? [])
    const custom = readNestedBoolean(base, ['custom', 'enabled'])
    return types.length === 1 && !custom
      ? { damageTypeName: types[0], dice: rollDice(base), versatileDice }
      : {}
  }
  const parts = asArray(damage.parts)
  const part = parts.length === 1 ? asArray(parts[0]) : []
  return { damageTypeName: readString(part[1]), dice: readWeaponDice(part[0]), versatileDice }
}

/** A Foundry item's property flags, stored either as a list of codes or as a code-to-boolean map. */
function readFoundryPropertyCodes(system: Record<string, unknown> | null): string[] {
  const raw = system?.properties
  return Array.isArray(raw)
    ? raw.flatMap((code) => (typeof code === 'string' ? [code] : []))
    : Object.entries(asRecord(raw) ?? {}).flatMap(([code, enabled]) =>
        enabled === true ? [code] : []
      )
}

function mapFoundryEquipment(
  type: string | undefined,
  system: Record<string, unknown> | null
): MappedEquipment {
  const attunement = system?.attunement
  const requiresAttunement =
    attunement === 'required' || (typeof attunement === 'number' && attunement >= 1)
      ? { requiresAttunement: true }
      : {}
  const subtype = system ? readNestedString(system, ['type', 'value']) : undefined

  if (type === 'weapon') {
    const rangedWeapon = subtype?.endsWith('R') === true
    const proficiency = subtype?.startsWith('simple')
      ? [EQUIPMENT_PROPERTY_CODE.SIMPLE]
      : subtype?.startsWith('martial')
        ? [EQUIPMENT_PROPERTY_CODE.MARTIAL]
        : []
    const codes = readFoundryPropertyCodes(system)
    const properties = [
      ...proficiency,
      rangedWeapon ? EQUIPMENT_PROPERTY_CODE.RANGED : EQUIPMENT_PROPERTY_CODE.MELEE,
      ...codes.flatMap((code) => FOUNDRY_WEAPON_PROPERTIES[code] ?? [])
    ]
    const range = asRecord(system?.range)
    const damage = readFoundryDamage(asRecord(system?.damage))
    const weaponAttack = buildWeaponAttack({
      damageTypeName: damage.damageTypeName,
      dice: damage.dice,
      versatileDice: damage.versatileDice,
      properties,
      rangedWeapon,
      normalFeet: readPositiveInteger(range?.value),
      longFeet: readPositiveInteger(range?.long)
    })
    return {
      category: EQUIPMENT_CATEGORY_CODE.WEAPON,
      properties: [...new Set(properties)],
      ...requiresAttunement,
      ...(weaponAttack ? { weaponAttack } : { weaponAttackUnreadable: true })
    }
  }

  if (type === 'equipment' && subtype) {
    const shield = subtype === 'shield'
    const weight = FOUNDRY_ARMOR_WEIGHT[subtype]
    if (shield || weight) {
      const armorClass = readInteger(asRecord(system?.armor)?.value)
      const strengthRequirement = shield ? undefined : readPositiveInteger(system?.strength)
      const stealthDisadvantage =
        !shield && readFoundryPropertyCodes(system).includes('stealthDisadvantage')
      return {
        category: shield ? EQUIPMENT_CATEGORY_CODE.SHIELD : EQUIPMENT_CATEGORY_CODE.ARMOR,
        properties: weight ? [weight] : [],
        ...(armorClass === undefined ? {} : { armorClass }),
        ...(strengthRequirement === undefined ? {} : { strengthRequirement }),
        ...(stealthDisadvantage ? { stealthDisadvantage } : {}),
        ...requiresAttunement
      }
    }
  }

  return {
    category:
      type === 'tool' ? EQUIPMENT_CATEGORY_CODE.TOOL : EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    ...requiresAttunement
  }
}

function customEquipmentContent(
  base: { externalId: string; label: string; path: Array<string | number>; description?: string },
  mapped: MappedEquipment,
  issues: ImportIssueDto[]
): ExternalCustomContent {
  if (mapped.weaponAttackUnreadable) {
    issues.push(
      issue(
        'INFO',
        'CUSTOM_WEAPON_ATTACK_NOT_IMPORTED',
        `Custom weapon "${base.label}" has no readable single-damage-type attack, so it was imported without one.`,
        base.path,
        false
      )
    )
  }
  return {
    subjectKind: 'EQUIPMENT',
    externalId: base.externalId,
    label: base.label,
    path: base.path,
    payload: {
      kind: 'EQUIPMENT',
      label: base.label,
      description: sanitizeImportedRichText(base.description),
      category: mapped.category,
      rarityId: '',
      properties: mapped.properties,
      ...(mapped.armorClass === undefined ? {} : { armorClass: mapped.armorClass }),
      ...(mapped.weightPounds === undefined
        ? {}
        : { weight: { amount: mapped.weightPounds, unit: MEASUREMENT_UNIT_CODE.POUNDS } }),
      ...(mapped.requiresAttunement ? { requiresAttunement: true } : {})
    },
    ...(mapped.weaponAttack ? { weaponAttack: mapped.weaponAttack } : {}),
    ...(mapped.magicBonus === undefined ? {} : { magicBonus: mapped.magicBonus }),
    ...(mapped.rarityName ? { rarityName: mapped.rarityName } : {}),
    ...(mapped.costGold === undefined ? {} : { costGold: mapped.costGold }),
    ...(mapped.strengthRequirement === undefined
      ? {}
      : { strengthRequirement: mapped.strengthRequirement }),
    ...(mapped.stealthDisadvantage ? { stealthDisadvantage: true } : {})
  }
}

function isRichTextKey(key: string | undefined): boolean {
  return (
    key === 'description' ||
    key === 'quote' ||
    key === 'materialDescription' ||
    key === 'backstory' ||
    key === 'notes' ||
    key === 'physicalCharacteristics' ||
    key === 'personalityTraits' ||
    key === 'ideals' ||
    key === 'bonds' ||
    key === 'flaws'
  )
}

function isDndBeyondCustomDefinition(definition: Record<string, unknown>): boolean {
  return definition.isHomebrew === true || definition.isCustomItem === true
}

function issue(
  severity: ImportIssueDto['severity'],
  code: string,
  message: string,
  path: Array<string | number>,
  correctionRequired: boolean
): ImportIssueDto {
  return { severity, code, message, path, correctionRequired }
}

function compactStrings(values: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).flatMap(([key, value]) =>
      value && value.trim() ? [[key, sanitizeImportedRichText(value)]] : []
    )
  )
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readIdentifier(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return readString(value)
}

function readInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined
}

function readPositiveInteger(value: unknown): number | undefined {
  const number = readInteger(value)
  return number !== undefined && number > 0 ? number : undefined
}

function readPositiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function readNonnegativeInteger(value: unknown): number | undefined {
  const number = readInteger(value)
  return number !== undefined && number >= 0 ? number : undefined
}

function readNestedString(record: Record<string, unknown>, path: string[]): string | undefined {
  let value: unknown = record
  for (const segment of path) {
    const next = asRecord(value)
    if (!next) return undefined
    value = next[segment]
  }
  return readString(value)
}

function readNestedBoolean(record: Record<string, unknown>, path: string[]): boolean {
  let value: unknown = record
  for (const segment of path) {
    const next = asRecord(value)
    if (!next) return false
    value = next[segment]
  }
  return value === true
}

function readNestedNumber(record: Record<string, unknown>, path: string[]): number | undefined {
  let value: unknown = record
  for (const segment of path) {
    const next = asRecord(value)
    if (!next) return undefined
    value = next[segment]
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
