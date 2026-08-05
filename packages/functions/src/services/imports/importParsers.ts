import type {
  ArtificerPortableContentDto,
  ImportIssueDto,
  JsonImportEntryDto
} from '@artificer-toolkit/schema/api/imports'
import { artificerPortableContentDtoSchema } from '@artificer-toolkit/schema/api/imports'
import type { AuthoredSubjectKindDto } from '@artificer-toolkit/schema/api/content'

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

export interface ExternalCustomContent {
  subjectKind: AuthoredSubjectKindDto
  externalId: string
  label: string
  path: Array<string | number>
  payload: Record<string, unknown>
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
      addCustomContent({
        subjectKind: 'EQUIPMENT',
        externalId: itemExternalId,
        label: itemLabel,
        path: ['inventory', index, 'definition'],
        payload: {
          kind: 'EQUIPMENT',
          label: itemLabel,
          description: sanitizeImportedRichText(readString(definition.description) ?? ''),
          category: 'ADVENTURING_GEAR',
          rarityId: '',
          properties: []
        }
      })
    }
  }

  for (const [index, customValue] of asArray(source.customItems).entries()) {
    const custom = asRecord(customValue)
    if (!custom) continue
    const customId = readIdentifier(custom.id) ?? `custom-item-${index + 1}`
    const customLabel = readString(custom.name) ?? `Imported custom item ${index + 1}`
    addCustomContent({
      subjectKind: 'EQUIPMENT',
      externalId: customId,
      label: customLabel,
      path: ['customItems', index],
      payload: {
        kind: 'EQUIPMENT',
        label: customLabel,
        description: sanitizeImportedRichText(readString(custom.description) ?? ''),
        category: 'ADVENTURING_GEAR',
        rarityId: '',
        properties: []
      }
    })
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
        customContent.push({
          subjectKind: 'EQUIPMENT',
          externalId: itemExternalId,
          label: itemLabel,
          path,
          payload: {
            kind: 'EQUIPMENT',
            label: itemLabel,
            description: sanitizeImportedRichText(
              itemSystem ? readNestedString(itemSystem, ['description', 'value']) : undefined
            ),
            category: foundryEquipmentCategory(type),
            rarityId: '',
            properties: []
          }
        })
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

function foundryEquipmentCategory(type: string | undefined): string {
  if (type === 'weapon') return 'WEAPON'
  if (type === 'tool') return 'TOOL'
  if (type === 'equipment') return 'ARMOR'
  return 'ADVENTURING_GEAR'
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
