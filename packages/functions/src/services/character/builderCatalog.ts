import {
  getBackgroundListQuery,
  getClassListQuery,
  getEquipmentListQuery,
  getFeatListQuery,
  getRaceListQuery,
  getSpellListQuery,
  type DBLike
} from '@artificer-toolkit/db'
import {
  CASTING_TIME_UNIT_CODE,
  CLASS_CATEGORY,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  RACE_CATEGORY_CODE,
  SPELL_ATTRIBUTE,
  SPELL_COMPONENT,
  type EquipmentCategoryCode,
  type EquipmentPropertyCode
} from '@artificer-toolkit/shared/core'
import type {
  ClassAuthored,
  SpellAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type { ResolvedRace } from '@artificer-toolkit/shared/subjects/compilers'

export type CharacterBuilderRaceCatalogRecord = {
  id: string
  label: string
  category: ResolvedRace['category']
  parentRaceId?: string
}

export type CharacterBuilderClassCatalogRecord = {
  id: string
  label: string
  category: ClassAuthored['category']
  parentClassId?: string
  subclassSelectionLevel?: number
}

export type CharacterBuilderBackgroundCatalogRecord = {
  id: string
  label: string
}

export type CharacterBuilderEquipmentCatalogRecord = {
  id: string
  label: string
  category?: EquipmentCategoryCode
  isContainer: boolean
  properties: EquipmentPropertyCode[]
  requiresAttunement: boolean
}

export type CharacterBuilderFeatCatalogRecord = {
  id: string
  label: string
}

export type CharacterBuilderSpellCatalogRecord = Pick<
  SpellAuthored,
  | 'attributes'
  | 'castingTime'
  | 'classIds'
  | 'components'
  | 'description'
  | 'id'
  | 'label'
  | 'level'
  | 'magicSchoolId'
  | 'materialDescription'
>

export interface CharacterBuilderCatalog {
  races: CharacterBuilderRaceCatalogRecord[]
  classes: CharacterBuilderClassCatalogRecord[]
  backgrounds: CharacterBuilderBackgroundCatalogRecord[]
  equipment: CharacterBuilderEquipmentCatalogRecord[]
  feats: CharacterBuilderFeatCatalogRecord[]
  spells: CharacterBuilderSpellCatalogRecord[]
}

type CharacterBuilderCatalogLoadOptions = {
  includeSpells: boolean
}

function requireRaceCategory(id: string, value: string): ResolvedRace['category'] {
  if (!(value in RACE_CATEGORY_CODE)) {
    throw new Error(`Race "${id}" has unsupported category "${value}".`)
  }

  return value as ResolvedRace['category']
}

function requireClassCategory(id: string, value: string | null): ClassAuthored['category'] {
  if (!value || !(value in CLASS_CATEGORY)) {
    throw new Error(`Class "${id}" has unsupported category "${value ?? 'null'}".`)
  }

  return value as ClassAuthored['category']
}

function requireEquipmentCategory(id: string, value: string | null): EquipmentCategoryCode | undefined {
  if (value === null) return undefined
  if (!(value in EQUIPMENT_CATEGORY_CODE)) {
    throw new Error(`Equipment "${id}" has unsupported category "${value}".`)
  }

  return value as EquipmentCategoryCode
}

function requireEquipmentProperty(id: string, value: string): EquipmentPropertyCode {
  if (!(value in EQUIPMENT_PROPERTY_CODE)) {
    throw new Error(`Equipment "${id}" has unsupported property "${value}".`)
  }

  return value as EquipmentPropertyCode
}

function requireSpellCastingTimeUnit(
  spellId: string,
  value: string
): SpellAuthored['castingTime']['unit'] {
  if (!(value in CASTING_TIME_UNIT_CODE)) {
    throw new Error(`Spell "${spellId}" has unsupported casting time unit "${value}".`)
  }

  return value as SpellAuthored['castingTime']['unit']
}

function requireSpellMagicSchool(
  spellId: string,
  value: string | null
): SpellAuthored['magicSchoolId'] {
  if (!value) {
    throw new Error(`Spell "${spellId}" is missing its magic school.`)
  }

  return value
}

export async function loadCharacterBuilderSpellCatalog(
  db: DBLike,
  systemId: string
): Promise<CharacterBuilderSpellCatalogRecord[]> {
  const { items, meta } = await getSpellListQuery(db, { systemId })
  const attributeCodesBySpellId = new Map<string, string[]>()
  const classIdsBySpellId = new Map<string, string[]>()

  for (const group of meta.attributes) {
    for (const spellId of group.spellIds) {
      const codes = attributeCodesBySpellId.get(spellId) ?? []
      codes.push(group.id)
      attributeCodesBySpellId.set(spellId, codes)
    }
  }
  for (const group of meta.classes) {
    for (const spellId of group.spellIds) {
      const classIds = classIdsBySpellId.get(spellId) ?? []
      classIds.push(group.id)
      classIdsBySpellId.set(spellId, classIds)
    }
  }

  return items.map((item) => {
    const codes = attributeCodesBySpellId.get(item.id) ?? []
    const attributes = codes.filter(
      (code): code is NonNullable<SpellAuthored['attributes']>[number] => code in SPELL_ATTRIBUTE
    )
    const components = codes.filter(
      (code): code is NonNullable<SpellAuthored['components']>[number] => code in SPELL_COMPONENT
    )

    return {
      id: item.id,
      label: item.label,
      description: item.description ?? '',
      level: item.level,
      magicSchoolId: requireSpellMagicSchool(item.id, item.magicSchoolId),
      castingTime: {
        unit: requireSpellCastingTimeUnit(item.id, item.castingTimeUnit),
        amount: item.castingTimeAmount
      },
      classIds: classIdsBySpellId.get(item.id) ?? [],
      attributes: attributes.length > 0 ? attributes : undefined,
      components: components.length > 0 ? components : undefined,
      materialDescription: item.materialDescription ?? undefined
    }
  })
}

export async function loadCharacterBuilderCatalog(
  db: DBLike,
  systemId: string,
  options: CharacterBuilderCatalogLoadOptions
): Promise<CharacterBuilderCatalog> {
  const [raceResult, classResult, backgroundResult, equipmentResult, featResult, spells] =
    await Promise.all([
      getRaceListQuery(db, { systemId }),
      getClassListQuery(db, { systemId }),
      getBackgroundListQuery(db, { systemId }),
      getEquipmentListQuery(db, { systemId }),
      getFeatListQuery(db, { systemId }),
      options.includeSpells
        ? loadCharacterBuilderSpellCatalog(db, systemId)
        : Promise.resolve([])
    ])

  return {
    races: raceResult.items.map((record) => ({
      id: record.id,
      label: record.label,
      category: requireRaceCategory(record.id, record.category),
      parentRaceId: record.parentRaceId ?? undefined
    })),
    classes: classResult.items.map((record) => ({
      id: record.id,
      label: record.label,
      category: requireClassCategory(record.id, record.category),
      parentClassId: record.parentClassId ?? undefined,
      subclassSelectionLevel: record.subclassSelectionLevel ?? undefined
    })),
    backgrounds: backgroundResult.items.map((record) => ({
      id: record.id,
      label: record.label
    })),
    equipment: equipmentResult.items.map((record) => ({
      id: record.id,
      label: record.label,
      category: requireEquipmentCategory(record.id, record.category),
      isContainer: record.capacityAmount !== null,
      properties: record.properties.map((property) =>
        requireEquipmentProperty(record.id, property)
      ),
      requiresAttunement: record.requiresAttunement
    })),
    feats: featResult.items.map((record) => ({
      id: record.id,
      label: record.label
    })),
    spells
  }
}
